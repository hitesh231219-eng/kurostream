import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyEpisodeRelease,
  extractNekostreamRedirectUrl,
  normalizeDownloadSourceInput,
  parseAnimeToshoEntries,
  resolveAnimeDownloadSource,
  searchAnimeEpisodeDownloads,
} from '../src/server/downloadService';
import { createKuroStreamApp } from '../src/server/app';

describe('NekoStream Pahe & Kwik Download Source Tracer', () => {
  it('normalizes NekoStream Pahe IDs and rejects SSRF / non-allowlisted hosts', () => {
    const fromId = normalizeDownloadSourceInput('ENxxw');
    expect(fromId.ok).toBe(true);
    expect(fromId.url).toBe('https://pahe.nekostream.site/ENxxw');
    expect(fromId.paheId).toBe('ENxxw');

    const fromUrl = normalizeDownloadSourceInput('https://pahe.nekostream.site/ENxxw');
    expect(fromUrl.ok).toBe(true);
    expect(fromUrl.url).toBe('https://pahe.nekostream.site/ENxxw');

    const blockedLocal = normalizeDownloadSourceInput('http://127.0.0.1/ENxxw');
    expect(blockedLocal.ok).toBe(false);

    const blockedOther = normalizeDownloadSourceInput('https://evil.example/ENxxw');
    expect(blockedOther.ok).toBe(false);
  });

  it('extracts testpahe.nekostream.site target from pahe.nekostream.site HTML ad-gate script', () => {
    const sampleHtml = `
      <script>
        function getId() {
          const parts = window.location.pathname.split('/').filter(Boolean);
          return parts[parts.length - 1];
        }
        function startDownload() {
          const id = getId();
          const url = "https://testpahe.nekostream.site/" + id;
          window.location.href = url;
        }
      </script>
    `;
    const nextUrl = extractNekostreamRedirectUrl(
      sampleHtml,
      'https://pahe.nekostream.site/ENxxw'
    );
    expect(nextUrl).toBe('https://testpahe.nekostream.site/ENxxw');
  });

  it('traces pahe.nekostream.site -> testpahe.nekostream.site -> kwik.cx across hops', async () => {
    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url === 'https://pahe.nekostream.site/ENxxw') {
        return new Response(
          `<script>function startDownload(){const id=getId();const url="https://testpahe.nekostream.site/"+id;window.location.href=url;}</script>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
      if (url === 'https://testpahe.nekostream.site/ENxxw') {
        return new Response('', {
          status: 302,
          headers: { location: 'https://kwik.cx/f/Cw8iW8xWK2sq' },
        });
      }
      if (url === 'https://kwik.cx/f/Cw8iW8xWK2sq') {
        return new Response('<html><title>Just a moment...</title></html>', {
          status: 403,
          headers: { 'cf-mitigated': 'challenge', 'Content-Type': 'text/html' },
        });
      }
      return new Response('Not found', { status: 404 });
    };

    const result = await resolveAnimeDownloadSource('ENxxw', fakeFetch, { bypassCache: true });
    expect(result.ok).toBe(true);
    expect(result.adGateBypassed).toBe(true);
    expect(result.resolvedUrl).toBe('https://kwik.cx/f/Cw8iW8xWK2sq');
    expect(result.kwikFileId).toBe('Cw8iW8xWK2sq');
    expect(result.requiresBrowserChallenge).toBe(true);
    expect(result.hops).toHaveLength(3);
    expect(result.hops[0].host).toBe('pahe.nekostream.site');
    expect(result.hops[1].host).toBe('testpahe.nekostream.site');
    expect(result.hops[2].host).toBe('kwik.cx');
  });

  describe('Per-Anime Episode Download Search & Series Verification', () => {
    it('classifies single episodes accurately and rejects mismatched episode numbers', () => {
      expect(classifyEpisodeRelease('[keenoe] Sousou no Frieren - 01 [1080p]', 1)).toEqual({
        matches: true,
        isBatch: false,
        confidence: 92,
      });
      expect(classifyEpisodeRelease('[TatakaeSubs] Attack on Titan - S01E02 (1080p)', 1).matches).toBe(
        false
      );
      expect(classifyEpisodeRelease('[Judas] Sousou no Frieren (01-28) (Batch)', 1)).toMatchObject({
        matches: true,
        isBatch: true,
      });
    });

    it('parses AnimeTosho HTML entries with <wbr/> tags and filters out Discord/Torrent from DDL mirrors', () => {
      const sampleHtml = `
        <div class="home_list_entry">
          <div class="size">1.25 GB</div>
          <div class="link"><a href="https://animetosho.org/view/toonshub-frieren-01.n1735151">[ToonsHub] Frieren: Beyond Journey's End - 01 (Mult<wbr/>i-Audio 1080p x264 AAC)</a></div>
          <div class="links">
            <span class="serieslink"><a href="https://animetosho.org/series/sousou-no-frieren.17617">ToonsHub</a></span>
            <a href="https://nyaa.si/download/1735151.torrent" class="dllink">Torrent</a>/<a href="magnet:?xt=urn:btih:ABC123">Magnet</a>
            <span title="Seeders: 42 / Leechers: 3">[42/3]</span>
            | <a href="https://gofile.io/d/oB0ENG" class="dllink">GoFile</a> | <a href="https://buzzheavier.com/0o6a8riobugt" class="dllink">BuzzHeavier</a> | <a href="https://discord.gg/abc">Discord</a>
          </div>
        </div>
      `;
      const entries = parseAnimeToshoEntries(sampleHtml);
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toContain('Multi-Audio 1080p');
      expect(entries[0].anidbId).toBe(17617);
      expect(entries[0].seeders).toBe(42);
      expect(entries[0].torrentUrl).toBe('https://nyaa.si/download/1735151.torrent');
      expect(entries[0].magnetUrl).toContain('magnet:?xt=');
      expect(entries[0].directMirrors).toEqual([
        { host: 'GoFile', url: 'https://gofile.io/d/oB0ENG' },
        { host: 'BuzzHeavier', url: 'https://buzzheavier.com/0o6a8riobugt' },
      ]);
    });

    it('verifies file-host mirrors live: drops 404/406 dead links and upgrades live Pixeldrain links', async () => {
      const { verifySingleDirectMirror } = await import('../src/server/downloadService');
      const fakeFetch: typeof fetch = async (input) => {
        const url = String(input);
        if (url.includes('krakenfiles.com')) {
          return new Response('<html><title>File not found</title></html>', { status: 404 });
        }
        if (url.includes('pixeldrain.com/api/file/abc123/info')) {
          return new Response(JSON.stringify({ success: true, name: 'ep01.mkv', size: 12345 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('multiup.io')) {
          return new Response('<html><title>Download mirror</title></html>', { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      };

      const deadKraken = await verifySingleDirectMirror(
        { host: 'KrakenFiles', url: 'https://krakenfiles.com/view/dead404test/file.html' },
        fakeFetch
      );
      expect(deadKraken).toBeNull();

      const livePd = await verifySingleDirectMirror(
        { host: 'Pixeldrain', url: 'https://pixeldrain.com/u/abc123' },
        fakeFetch
      );
      expect(livePd).toEqual({
        host: 'Pixeldrain',
        url: 'https://pixeldrain.com/api/file/abc123?download',
        verified: 'live',
      });

      const liveMu = await verifySingleDirectMirror(
        { host: 'MultiUp', url: 'https://multiup.io/download/live-test-01/ep01.mkv' },
        fakeFetch
      );
      expect(liveMu?.verified).toBe('live');
    });

    it('matches Frieren (AniList 154587 -> AniDB 17617) Episode 1 cleanly, strips dead 404 mirrors, and strictly rejects Attack on Titan (AniDB 9541)', async () => {
      const fakeFetch: typeof fetch = async (input) => {
        const url = String(input);
        if (url.startsWith('https://arm.haglund.dev/api/v2/ids?source=anilist&id=154587')) {
          return new Response(JSON.stringify({ anilist: 154587, anidb: 17617, myanimelist: 52991 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.startsWith('https://animetosho.org/search?aids=17617')) {
          const html = `
            <div class="home_list_entry">
              <div class="size">890 MB</div>
              <div class="link"><a href="https://animetosho.org/view/aot-wrong.n999">[TatakaeSubs] Attack on Titan - S01E01 (1080p)</a></div>
              <div class="links">
                <span class="serieslink"><a href="https://animetosho.org/series/shingeki-no-kyojin.9541">TatakaeSubs</a></span>
                <a href="https://gofile.io/d/WRONG_AOT" class="dllink">GoFile</a>
              </div>
            </div>
            <div class="home_list_entry">
              <div class="size">1.10 GB</div>
              <div class="link"><a href="https://animetosho.org/view/keenoe-sousou-no-frieren-01.n1954593">[keenoe] Sousou no Frieren - 01 (1080p Dual Audio)</a></div>
              <div class="links">
                <span class="serieslink"><a href="https://animetosho.org/series/sousou-no-frieren.17617">keenoe</a></span>
                <a href="https://nyaa.si/download/1954593.torrent" class="dllink">Torrent</a>
                <a href="https://krakenfiles.com/view/DEAD_LINK/file.html" class="dllink">KrakenFiles</a>
                <a href="https://down.mdiaload.com/LIVE_FRIEREN_01" class="dllink">MdiaLoad</a>
              </div>
            </div>
          `;
          return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
        }
        if (url.includes('krakenfiles.com/view/DEAD_LINK')) {
          return new Response('<html><title>File not found</title></html>', { status: 404 });
        }
        if (url.includes('down.mdiaload.com/LIVE_FRIEREN_01')) {
          return new Response('<html><title>Download LIVE_FRIEREN_01</title></html>', { status: 200 });
        }
        if (url.startsWith('https://nyaa.si/')) {
          return new Response('<rss><channel></channel></rss>', { status: 200 });
        }
        if (url.startsWith('https://nekobt.to/') || url.startsWith('https://subsplease.org/')) {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        return new Response('', { status: 404 });
      };

      const search = await searchAnimeEpisodeDownloads(
        {
          anilistId: 154587,
          malId: 52991,
          title: 'Sousou no Frieren',
          englishTitle: "Frieren: Beyond Journey's End",
          romajiTitle: 'Sousou no Frieren',
          episode: 1,
          audio: 'sub',
          quality: '1080p',
        },
        fakeFetch,
        { bypassCache: true }
      );

      expect(search.ok).toBe(true);
      expect(search.identityVerified).toBe(true);
      expect(search.anidbId).toBe(17617);
      expect(search.sourcesChecked).toEqual(['AnimeTosho', 'Nyaa', 'NekoBT', 'SubsPlease']);
      expect(search.results).toHaveLength(1);
      expect(search.results[0].title).toContain('Sousou no Frieren - 01');
      // Dead 404 KrakenFiles link removed automatically; live MdiaLoad kept!
      expect(search.results[0].directMirrors).toEqual([
        { host: 'MdiaLoad', url: 'https://down.mdiaload.com/LIVE_FRIEREN_01', verified: 'live' },
      ]);
      expect(JSON.stringify(search)).not.toContain('Attack on Titan');
      expect(JSON.stringify(search)).not.toContain('DEAD_LINK');
    });

    it('never pre-fills hardcoded ENxxw Attack on Titan link in AnimeDownloadModal.tsx', () => {
      const modalCode = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/AnimeDownloadModal.tsx'),
        'utf8'
      );
      expect(modalCode).not.toContain('ENxxw');
      expect(modalCode).not.toContain('exampleUrl');
    });
  });

  describe('Express /api/downloads routes', () => {
    let server: http.Server;
    let baseUrl: string;

    beforeAll(async () => {
      const { app } = createKuroStreamApp();
      server = http.createServer(app);
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
      });
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('rejects missing or non-allowlisted download URLs cleanly', async () => {
      const emptyRes = await fetch(`${baseUrl}/api/downloads/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '' }),
      });
      expect(emptyRes.status).toBe(400);

      const ssrfRes = await fetch(`${baseUrl}/api/downloads/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://169.254.169.254/latest/meta-data/' }),
      });
      expect(ssrfRes.status).toBe(400);
      const ssrfJson = await ssrfRes.json();
      expect(ssrfJson.ok).toBe(false);
    });

    it('validates /api/downloads/search payload and rejects empty titles', async () => {
      const badRes = await fetch(`${baseUrl}/api/downloads/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', episode: 1 }),
      });
      expect(badRes.status).toBe(400);
      const badJson = await badRes.json();
      expect(badJson.ok).toBe(false);
    });
  });
});
