import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizeMangaTitle,
  computeTitleSimilarity,
  parseMangaPillSearchResults,
  parseMangaPillChapters,
  parseWeebCentralSearchResults,
  parseWeebCentralChapters,
  buildSearchVariants,
  resolveMangaChapters,
  resolveChapterPages,
} from '../src/server/mangaService';

describe('Manga Title Similarity & HTML Parsers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accurately scores exact and similar titles while penalizing unrelated spin-offs', () => {
    expect(normalizeMangaTitle("Frieren: Beyond Journey's End")).toBe('frieren beyond journeys end');
    expect(normalizeMangaTitle('Hunter × Hunter')).toBe('hunter x hunter');
    expect(normalizeMangaTitle('SPY×FAMILY')).toBe('spy x family');
    expect(normalizeMangaTitle('【OSHI NO KO】')).toBe('oshi no ko');
    expect(computeTitleSimilarity('Chainsaw Man', 'Chainsaw Man')).toBe(1);
    expect(computeTitleSimilarity('Hunter × Hunter', 'Hunter x Hunter')).toBe(1);
    expect(computeTitleSimilarity('【OSHI NO KO】', '[Oshi no Ko]')).toBe(1);

    const spinoffScore = computeTitleSimilarity('Chainsaw Man', 'Chainsaw Man: Buddy Stories');
    expect(spinoffScore).toBeLessThan(0.5);
    expect(computeTitleSimilarity('Solo Leveling', 'Naruto Shippuden')).toBe(0);

    // Non-Latin alt titles should be rejected for Latin queries
    expect(computeTitleSimilarity('Frieren', 'คำอธิษฐานในวันที่จากลา Frieren')).toBe(0);
    // HTML entities should decode cleanly and multi-word query containment should score well
    expect(
      computeTitleSimilarity('Frieren', "Sousou no Frieren Frieren - Beyond Journey&#39;s End")
    ).toBeGreaterThanOrEqual(0.45);
    // Spin-off / anthology / doujinshi entries should be strongly demoted vs canonical title
    const anthologyScore = computeTitleSimilarity('Frieren', 'Frieren Official Anthology Comic');
    expect(anthologyScore).toBeLessThan(0.25);
    // Distinct franchises sharing a prefix word should remain low
    expect(computeTitleSimilarity('One Piece', 'One Punch Man')).toBeLessThan(0.45);
  });

  it('builds bracket-stripped and subtitle search variants cleanly', () => {
    const variants = buildSearchVariants(
      'Demon Slayer: Kimetsu no Yaiba',
      'Kimetsu no Yaiba'
    );
    expect(variants.primary).toEqual(['Demon Slayer: Kimetsu no Yaiba', 'Kimetsu no Yaiba']);
    expect(variants.fallbacks).toContain('Demon Slayer');

    const bracketVariants = buildSearchVariants('【Oshi no Ko】');
    expect(bracketVariants.fallbacks).toContain('Oshi no Ko');
  });

  it('parses MangaPill search results and chapter links including Group N prefixes and multi-line titles', () => {
    const searchHtml = `
      <div>
        <a href="/manga/2285/kimetsu-no-yaiba"></a>
        <a href="/manga/2285/kimetsu-no-yaiba"><div>Kimetsu no Yaiba</div><div>Demon Slayer: Kimetsu no Yaiba</div></a>
        <a href="/manga/999/other-series"><span>Other Series</span></a>
      </div>
    `;
    const parsedSearch = parseMangaPillSearchResults(searchHtml);
    expect(parsedSearch).toHaveLength(2);
    expect(parsedSearch[0].id).toBe('2285');
    expect(parsedSearch[0].titles).toContain('Demon Slayer: Kimetsu no Yaiba');

    const mangaHtml = `
      <div class="chapters">
        <a href="/chapters/8136-20203000/solo-leveling-novel-chapter-203">Group 2 Chapter 203</a>
        <a href="/chapters/1-10386000/berserk-chapter-386">Group 2 Chapter 386</a>
        <a href="/chapters/329-10002000/chainsaw-man-chapter-2">Chapter 2</a>
        <a href="/chapters/329-10001000/chainsaw-man-chapter-1">Chapter 1</a>
      </div>
    `;
    const chapters = parseMangaPillChapters(mangaHtml);
    expect(chapters).toHaveLength(4);
    expect(chapters[0].chapterNumber).toBe('386');
    expect(chapters[1].chapterNumber).toBe('203');
    expect(chapters[2].chapterNumber).toBe('2');
    expect(chapters[3].chapterNumber).toBe('1');
  });

  it('parses WeebCentral search results and season-prefixed chapter lists in exact chronological order', () => {
    const searchHtml = `
      <article>
        <a href="https://weebcentral.com/series/01J76XY7M0W9WWJ55VJYYB2J1S/Tower-Of-God">
          <div>Official</div><div>Tower of God</div>
        </a>
      </article>
    `;
    const parsedSearch = parseWeebCentralSearchResults(searchHtml);
    expect(parsedSearch).toHaveLength(1);
    expect(parsedSearch[0].titles).toContain('Tower of God');

    const chapterHtml = `
      <a href="/chapters/01AAA"><span class="">S1 - Chapter 1</span></a>
      <a href="/chapters/01BBB"><span class="">S3 - Chapter 235</span></a>
      <a href="/chapters/01CCC"><span class="">S2 - Chapter 1</span></a>
    `;
    const chapters = parseWeebCentralChapters(chapterHtml);
    expect(chapters).toHaveLength(3);
    expect(chapters[0].chapterNumber).toBe('S3-235');
    expect(chapters[1].chapterNumber).toBe('S2-1');
    expect(chapters[2].chapterNumber).toBe('S1-1');
  });

  it('refuses to silently return the wrong chapter if requested chapter number is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('api.mangadex.org/manga?')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: 'md-123',
                  attributes: { title: { en: 'Exact Test Manga' }, altTitles: [] },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.mangadex.org/manga/md-123/feed')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: 'ch-uuid-1',
                  attributes: { chapter: '1', pages: 18, title: 'Opening' },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      }) as any
    );

    const res = await resolveChapterPages({
      title: 'Exact Test Manga',
      chapter: '99',
    });
    expect(res.success).toBe(false);
    expect(res.pages).toHaveLength(0);
    expect(res.error).toContain('Chapter 99');
  });

  it('prefers Sol over a partial Honey run and falls back from 1-page Honey stubs', async () => {
    const mdPartialRows = Array.from({ length: 30 }, (_, idx) => ({
      id: `md-ch-${30 - idx}`,
      attributes: {
        chapter: String(30 - idx),
        pages: idx === 0 ? 1 : 19,
        title: `Part ${30 - idx}`,
      },
    }));

    const mpLinks = Array.from({ length: 60 }, (_, idx) => {
      const ch = 60 - idx;
      return `<a href="/chapters/777-${10000000 + ch * 1000}/partial-run-series-chapter-${ch}">Chapter ${ch}</a>`;
    }).join('\n');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('api.mangadex.org/manga?')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: 'md-partial',
                  attributes: { title: { en: 'Partial Run Series' }, altTitles: [] },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.mangadex.org/manga/md-partial/feed')) {
          return new Response(JSON.stringify({ data: mdPartialRows }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('api.mangadex.org/at-home/server/md-stub-ch-60')) {
          return new Response(
            JSON.stringify({
              baseUrl: 'https://uploads.mangadex.org',
              chapter: { hash: 'stubhash', data: ['1-stub.png'] },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('mangapill.com/search?')) {
          return new Response(
            '<a href="/manga/777/partial-run-series">Partial Run Series</a>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        }
        if (url.includes('mangapill.com/manga/777/partial-run-series')) {
          return new Response(`<div>${mpLinks}</div>`, {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }
        if (url.includes('mangapill.com/chapters/777-10060000/')) {
          return new Response(
            Array.from({ length: 18 }, (_, i) => `<img data-src="https://cdn.readdetectiveconan.com/file/mangap/777/60/${i + 1}.jpeg">`).join(''),
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        }
        return new Response('Not found', { status: 404 });
      }) as any
    );

    const directory = await resolveMangaChapters('Partial Run Series');
    expect(directory.source).toBe('mangapill');
    expect(directory.chapters).toHaveLength(60);
    expect(directory.chapters[0].chapterNumber).toBe('60');

    const pagesRes = await resolveChapterPages({
      title: 'Partial Run Series',
      chapter: '60',
      chapterId: 'md-stub-ch-60',
      source: 'mangadex',
    });
    expect(pagesRes.success).toBe(true);
    expect(pagesRes.source).toBe('mangapill');
    expect(pagesRes.total).toBe(18);
  });

  it('prefers Sol Mirror (WeebCentral) when Honey is missing Chapter 1 and supports MangaDex dataSaver fallback', async () => {
    const mdMissingEarly = Array.from({ length: 150 }, (_, idx) => ({
      id: `md-tg-${179 - idx}`,
      attributes: {
        chapter: String(179 - idx),
        pages: 19,
        title: `Ch ${179 - idx}`,
      },
    }));

    const wcLinks = Array.from({ length: 143 }, (_, idx) => {
      const ch = 143 - idx;
      return `<a href="/chapters/01WC${String(ch).padStart(4, '0')}"><span class="">Chapter ${ch}</span></a>`;
    }).join('\n');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('api.mangadex.org/manga?')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: 'md-tg-series',
                  attributes: { title: { en: 'Truncated Honey Series' }, altTitles: [] },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.mangadex.org/manga/md-tg-series/feed')) {
          return new Response(JSON.stringify({ data: mdMissingEarly }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('weebcentral.com/search/data')) {
          return new Response(
            '<a href="https://weebcentral.com/series/01WC001/Truncated-Honey-Series">Truncated Honey Series</a>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        }
        if (url.includes('weebcentral.com/series/01WC001/full-chapter-list')) {
          return new Response(`<div>${wcLinks}</div>`, {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }
        if (url.includes('weebcentral.com/chapters/01WC0001/images')) {
          return new Response(
            '<img\n\tsrc="https://scans-hot.planeptune.us/manga/Test/0001-001.png" />\n<img\n\tsrc="https://scans-hot.planeptune.us/manga/Test/0001-002.png" />\n<img\n\tsrc="https://scans-hot.planeptune.us/manga/Test/0001-003.png" />',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        }
        if (url.includes('api.mangadex.org/at-home/server/md-datasaver-only')) {
          return new Response(
            JSON.stringify({
              baseUrl: 'https://uploads.mangadex.org',
              chapter: { hash: 'dshash', data: [], dataSaver: ['1.jpg', '2.jpg', '3.jpg'] },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      }) as any
    );

    const dir = await resolveMangaChapters('Truncated Honey Series');
    expect(dir.source).toBe('weebcentral');
    expect(dir.chapters[dir.chapters.length - 1].chapterNumber).toBe('1');

    const wcPages = await resolveChapterPages({
      title: 'Truncated Honey Series',
      chapter: '1',
      chapterId: '01WC0001',
      source: 'weebcentral',
    });
    expect(wcPages.success).toBe(true);
    expect(wcPages.total).toBe(3);
    expect(wcPages.rawPages[0]).toContain('scans-hot.planeptune.us');

    const dsPages = await resolveChapterPages({
      title: 'Truncated Honey Series',
      chapter: '50',
      chapterId: 'md-datasaver-only',
      source: 'mangadex',
    });
    expect(dsPages.success).toBe(true);
    expect(dsPages.total).toBe(3);
    expect(dsPages.rawPages[0]).toBe('https://uploads.mangadex.org/data-saver/dshash/1.jpg');
  });
});
