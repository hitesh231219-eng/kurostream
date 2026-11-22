import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import {
  BoundedTtlCache,
  getProxyUpstreamHeaders,
  MAX_PROXY_IMAGE_BYTES,
  RateLimiter,
  validateProxyTargetUrlWithDns,
} from './security';
import { resolveChapterPages, resolveMangaChapters } from './mangaService';
import { resolveAnimeDownloadSource, searchAnimeEpisodeDownloads } from './downloadService';
import { WatchPartyHub } from './watchPartyHub';
import { ComplianceStore, DmcaNoticeInputSchema } from './complianceStore';
import { AnimeMediaSchema, AudioTrackSchema, StreamingServerSchema } from '../utils/validation';

export interface ServerHealthEntry {
  id: 'anixo' | 'animeembed' | 'megaplay-mal' | 'zokoanime';
  url: string;
  reachable: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  checkedAt: number;
}

const STREAM_PROBE_URLS: Array<{ id: ServerHealthEntry['id']; url: string }> = [
  { id: 'anixo', url: 'https://anixo.buzz/' },
  { id: 'animeembed', url: 'https://animeembed.com/' },
  { id: 'megaplay-mal', url: 'https://megaplay.buzz/' },
  { id: 'zokoanime', url: 'https://zokoanime.video/' },
];

export function createKuroStreamApp(options?: { hub?: WatchPartyHub }) {
  const app = express();
  const hub = options?.hub ?? new WatchPartyHub();
  const complianceStore = new ComplianceStore();

  const anilistCache = new BoundedTtlCache<any>(300, 5 * 60 * 1000);
  const serverHealthCache = new BoundedTtlCache<ServerHealthEntry[]>(4, 45 * 1000);
  const proxyLimiter = new RateLimiter(180, 60 * 1000);
  const apiLimiter = new RateLimiter(120, 60 * 1000);

  app.use(express.json({ limit: '512kb' }));

  const getClientIp = (req: Request): string => {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
  };

  // 1. Health & Diagnostics
  app.get('/api/health', (_req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      service: 'kurostream-api',
      activeRooms: hub.activeRoomCount,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: Date.now(),
    });
  });

  // 2. Streaming Server Availability Monitoring
  app.get('/api/servers/health', async (_req: Request, res: Response) => {
    try {
      const results = await serverHealthCache.coalesce('all', async () => {
        const checks = await Promise.all(
          STREAM_PROBE_URLS.map(async (srv): Promise<ServerHealthEntry> => {
            const started = Date.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4500);
            const headers = {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            };
            try {
              let probeRes = await fetch(srv.url, {
                method: 'HEAD',
                signal: controller.signal,
                headers,
              });
              if (probeRes.status >= 405) {
                probeRes = await fetch(srv.url, {
                  method: 'GET',
                  signal: controller.signal,
                  headers,
                });
              }
              const latencyMs = Date.now() - started;
              // 2xx, 3xx, or 403 Cloudflare challenge still means the upstream host is live
              const reachable = probeRes.status < 500;
              return {
                id: srv.id,
                url: srv.url,
                reachable,
                latencyMs,
                statusCode: probeRes.status,
                checkedAt: Date.now(),
              };
            } catch {
              return {
                id: srv.id,
                url: srv.url,
                reachable: false,
                latencyMs: null,
                statusCode: null,
                checkedAt: Date.now(),
              };
            } finally {
              clearTimeout(timer);
            }
          })
        );
        return checks;
      });
      res.json({ servers: results });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Health probe failed', servers: [] });
    }
  });

  // 3. AniList GraphQL Proxy with Bounded LRU Cache, Request Coalescing & Rate-Limit Resilience
  app.post('/api/anilist', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = apiLimiter.consume(`anilist:${ip}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({ error: 'Rate limit exceeded. Please retry shortly.' });
    }

    const bodySchema = z.object({
      query: z.string().min(10).max(16000),
      variables: z.record(z.string(), z.any()).optional().default({}),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid GraphQL request payload' });
    }

    const cacheKey = JSON.stringify(parsed.data);
    try {
      const data = await anilistCache.coalesce(cacheKey, async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8500);
        try {
          const upstream = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(parsed.data),
          });
          if (!upstream.ok) {
            throw Object.assign(new Error(`AniList HTTP ${upstream.status}`), {
              status: upstream.status,
            });
          }
          const json = await upstream.json();
          if (!json?.data) {
            throw new Error(json?.errors?.[0]?.message || 'Empty GraphQL response');
          }
          return json;
        } finally {
          clearTimeout(timer);
        }
      });

      return res.json(data);
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 502;
      return res.status(status >= 400 && status < 600 ? status : 502).json({
        error: err?.message || 'Failed to fetch from AniList',
      });
    }
  });

  // 4. Real Manga Chapter Directory (MangaDex + Verified MangaPill)
  app.get('/api/manga/chapters', async (req: Request, res: Response) => {
    const title = String(req.query.title || '').trim();
    const altTitle = req.query.altTitle ? String(req.query.altTitle).trim() : undefined;
    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'Missing or invalid manga title', chapters: [] });
    }

    try {
      const result = await resolveMangaChapters(title, altTitle);
      return res.json(result);
    } catch (err: any) {
      return res.status(502).json({
        chapters: [],
        source: 'none',
        errors: [err?.message || 'Upstream manga resolution failed'],
      });
    }
  });

  // 5. Real Manga Chapter Pages (Strict Chapter Match — No Silent Wrong Chapter)
  app.get('/api/manga/chapter-pages', async (req: Request, res: Response) => {
    const title = String(req.query.title || '').trim();
    const altTitle = req.query.altTitle ? String(req.query.altTitle).trim() : undefined;
    const chapter = String(req.query.chapter || '1').trim();
    const chapterId = req.query.chapterId ? String(req.query.chapterId).trim() : undefined;
    const source = req.query.source ? String(req.query.source).trim() : undefined;

    if (!title || title.length > 200) {
      return res.status(400).json({ success: false, pages: [], error: 'Missing or invalid title' });
    }

    const result = await resolveChapterPages({ title, altTitle, chapter, chapterId, source });
    return res.status(result.success ? 200 : 404).json(result);
  });

  // 6. SSRF-Hardened Streaming Image Proxy
  app.get('/api/manga-proxy', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = proxyLimiter.consume(`proxy:${ip}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return res.status(429).send('Rate limit exceeded for image proxy');
    }

    const targetUrl = String(req.query.url || '');
    const validation = await validateProxyTargetUrlWithDns(targetUrl);
    if (!validation.valid || !validation.url) {
      return res.status(403).send(`Blocked proxy target: ${validation.reason}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    req.on('close', () => controller.abort());

    try {
      const upstream = await fetch(validation.url.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: getProxyUpstreamHeaders(validation.url),
      });

      if (upstream.status >= 300 && upstream.status < 400) {
        return res.status(403).send('Upstream redirects are blocked for security');
      }

      if (!upstream.ok) {
        return res.status(upstream.status).send(`Upstream image returned HTTP ${upstream.status}`);
      }

      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(415).send('Blocked non-image response content type');
      }

      const contentLengthHeader = upstream.headers.get('content-length');
      if (contentLengthHeader && Number(contentLengthHeader) > MAX_PROXY_IMAGE_BYTES) {
        return res.status(413).send('Upstream image exceeds 25 MB size cap');
      }

      if (!upstream.body) {
        return res.status(502).send('Upstream response contained no body');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

      let totalBytes = 0;
      const nodeStream = Readable.fromWeb(upstream.body as any);

      nodeStream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_PROXY_IMAGE_BYTES) {
          controller.abort();
          nodeStream.destroy(new Error('Image exceeded 25 MB streaming limit'));
        }
      });

      nodeStream.on('error', () => {
        if (!res.headersSent) {
          res.status(413).send('Image stream aborted');
        } else {
          res.destroy();
        }
      });

      nodeStream.pipe(res);
    } catch (err: any) {
      if (!res.headersSent) {
        const isAbort = err?.name === 'AbortError';
        res.status(isAbort ? 504 : 502).send(isAbort ? 'Upstream image request timed out' : 'Proxy upstream fetch failed');
      }
    } finally {
      clearTimeout(timer);
    }
  });

  // 6b. Anime Download Source Tracer (NekoStream Pahe -> TestPahe -> Kwik)
  const handleResolveDownload = async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = apiLimiter.consume(`downloads:${ip}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({ ok: false, error: 'Rate limit exceeded. Please retry shortly.' });
    }

    const rawUrl =
      req.method === 'POST'
        ? String((req.body && (req.body.url || req.body.source || req.body.id)) || '')
        : String(req.query.url || req.query.id || '');

    if (!rawUrl || rawUrl.length > 2048) {
      return res.status(400).json({
        ok: false,
        error: 'Provide a valid NekoStream Pahe URL or short ID (e.g. https://pahe.nekostream.site/ENxxw or ENxxw).',
      });
    }

    const resolved = await resolveAnimeDownloadSource(rawUrl);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(resolved.ok ? 200 : 400).json(resolved);
  };

  app.get('/api/downloads/resolve', handleResolveDownload);
  app.post('/api/downloads/resolve', handleResolveDownload);

  // 6c. Per-Anime Verified Episode Download Search (AniList -> AniDB + AnimeTosho DDL + SubsPlease)
  const handleSearchDownloads = async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = apiLimiter.consume(`downloads-search:${ip}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({ ok: false, error: 'Rate limit exceeded. Please retry shortly.' });
    }

    const src = req.method === 'POST' && req.body && typeof req.body === 'object' ? req.body : req.query;
    const schema = z.object({
      anilistId: z.coerce.number().int().positive().optional(),
      malId: z.coerce.number().int().positive().optional(),
      title: z.string().min(1).max(240),
      englishTitle: z.string().max(240).optional().nullable(),
      romajiTitle: z.string().max(240).optional().nullable(),
      episode: z.coerce.number().int().min(1).max(5000).default(1),
      audio: z.enum(['sub', 'dub']).optional().default('sub'),
      quality: z.enum(['1080p', '720p', '480p', '360p']).optional().default('1080p'),
    });

    const parsed = schema.safeParse({
      anilistId: src.anilistId ?? src.id ?? undefined,
      malId: src.malId ?? undefined,
      title: String(src.title || src.englishTitle || src.romajiTitle || '').trim(),
      englishTitle: src.englishTitle ? String(src.englishTitle) : undefined,
      romajiTitle: src.romajiTitle ? String(src.romajiTitle) : undefined,
      episode: src.episode ?? 1,
      audio: src.audio === 'dub' ? 'dub' : 'sub',
      quality: ['1080p', '720p', '480p', '360p'].includes(String(src.quality))
        ? String(src.quality)
        : '1080p',
    });

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        results: [],
        batches: [],
        error: 'Provide an anime title and episode number to search episode downloads.',
      });
    }

    try {
      const result = await searchAnimeEpisodeDownloads(parsed.data);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      return res.status(502).json({
        ok: false,
        results: [],
        batches: [],
        error: err?.message || 'Episode download search failed',
      });
    }
  };

  app.get('/api/downloads/search', handleSearchDownloads);
  app.post('/api/downloads/search', handleSearchDownloads);

  // 7. Watch Party Rooms REST API (Backed by Server Hub)
  app.post('/api/party/rooms', (req: Request, res: Response) => {
    const schema = z.object({
      roomName: z.string().min(1).max(120),
      hostId: z.string().min(1).max(128),
      hostName: z.string().min(1).max(64),
      anime: AnimeMediaSchema,
      episode: z.number().int().min(1).max(5000),
      server: StreamingServerSchema,
      audio: AudioTrackSchema,
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid Watch Party creation payload', details: parsed.error.issues[0]?.message });
    }

    const created = hub.createRoom({
      roomName: parsed.data.roomName,
      hostId: parsed.data.hostId,
      hostName: parsed.data.hostName,
      anime: parsed.data.anime as any,
      episode: parsed.data.episode,
      server: parsed.data.server,
      audio: parsed.data.audio,
    });
    return res.status(201).json(created);
  });

  app.get('/api/party/rooms/:roomId', (req: Request, res: Response) => {
    const roomId = String(req.params.roomId || '');
    const found = hub.getRoom(roomId);
    if (!found) {
      return res.status(404).json({ error: `Watch Party room "${roomId.toUpperCase()}" was not found or has expired.` });
    }
    return res.json(found);
  });

  app.post('/api/party/rooms/:roomId/control', (req: Request, res: Response) => {
    const schema = z.object({
      hostToken: z.string().min(8),
      type: z.enum(['play', 'pause', 'seek', 'episode', 'server', 'audio']),
      seekTime: z.number().min(0).max(86400).optional(),
      episode: z.number().int().min(1).max(5000).optional(),
      server: StreamingServerSchema.optional(),
      audio: AudioTrackSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid control command' });
    }
    const result = hub.applyHostControl(String(req.params.roomId), parsed.data.hostToken, parsed.data);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ room: result.room, notice: result.notice });
  });

  // 8. Server-Side Gemini Anime Concierge (/api/ai/recommend)
  app.post('/api/ai/recommend', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = apiLimiter.consume(`ai:${ip}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({ error: 'Too many recommendation requests. Try again in a minute.' });
    }

    const promptSchema = z.object({
      mood: z.string().min(2).max(400),
    });
    const parsed = promptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please describe your mood or favorite anime (2–400 chars).' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server.',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Recommend 4 real anime titles matching this viewer request: "${parsed.data.mood}". Return exact searchable titles and a concise 1-sentence reason each.`,
        config: {
          systemInstruction: 'You are an expert anime curator. Only recommend real, widely recognized anime series or movies.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Official English or Romaji title to search on AniList' },
                reason: { type: Type.STRING, description: 'Short tailored explanation for why this matches' },
                matchScore: { type: Type.INTEGER, description: 'Match percentage from 75 to 99' },
              },
            },
          },
        },
      });

      const text = (response.text ?? '[]').trim();
      const recommendations = JSON.parse(text);
      return res.json({ recommendations });
    } catch (err: any) {
      return res.status(502).json({
        error: err?.message || 'AI recommendation service temporarily unavailable',
      });
    }
  });

  // 9. Dynamic-Origin Windows Installer & Launcher Scripts
  const serveDynamicScript = (relativePublicPath: string, contentType: string) => (req: Request, res: Response) => {
    const filePath = path.resolve(process.cwd(), 'public', relativePublicPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Script not found');
    }
    const rawProto = req.headers['x-forwarded-proto'];
    const proto = typeof rawProto === 'string' && rawProto.length > 0 ? rawProto.split(',')[0].trim() : req.protocol || 'https';
    const rawHost = req.headers['x-forwarded-host'] || req.get('host');
    const host = typeof rawHost === 'string' && rawHost.length > 0 ? rawHost.split(',')[0].trim() : '';
    let content = fs.readFileSync(filePath, 'utf8');
    if (host) {
      const origin = `${proto}://${host}`;
      content = content.replace(/https:\/\/(?:statuesque-capybara-5be511|kurostream-app)\.netlify\.app/gi, origin);
      content = content.replace(/https:\/\/kurostream-m[1-5]\.vercel\.app/gi, origin);
      content = content.replace(/https:\/\/ais-pre-4qmkwygrgyj4l6tszc6knk-852129490367\.asia-southeast1\.run\.app/gi, origin);
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(content);
  };

  app.get('/install-kurostream.ps1', serveDynamicScript('install-kurostream.ps1', 'text/plain; charset=utf-8'));
  app.get('/install.ps1', serveDynamicScript('install.ps1', 'text/plain; charset=utf-8'));
  app.get('/windows/install-kurostream.ps1', serveDynamicScript('windows/install-kurostream.ps1', 'text/plain; charset=utf-8'));
  app.get('/KuroStream.bat', serveDynamicScript('KuroStream.bat', 'application/x-bat; charset=utf-8'));
  app.get('/launch-kurostream.bat', serveDynamicScript('launch-kurostream.bat', 'application/x-bat; charset=utf-8'));
  app.get('/windows/launch-kurostream.bat', serveDynamicScript('windows/launch-kurostream.bat', 'application/x-bat; charset=utf-8'));

  // 10. DMCA Notice & Takedown Compliance API (17 U.S.C. § 512(c)(3) / § 512(d))
  app.post('/api/dmca/notice', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = apiLimiter.consume(`dmca:${ip}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait before submitting another notice.' });
    }

    const parsed = DmcaNoticeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Incomplete DMCA takedown notice',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const record = complianceStore.submitNotice(parsed.data);
    return res.status(201).json({
      ok: true,
      caseId: record.caseId,
      receivedAt: record.receivedAt,
      delistedMediaId: record.delistedMediaId,
      status: record.status,
      message:
        record.delistedMediaId !== null
          ? `Notice logged (${record.caseId}) and media ID ${record.delistedMediaId} added to the compliance delist registry.`
          : `Notice logged (${record.caseId}). Our designated compliance review queue has recorded your request.`,
    });
  });

  app.get('/api/compliance/status', (req: Request, res: Response) => {
    const rawId = req.query.anilistId;
    const parsedId = typeof rawId === 'string' && /^\d{1,9}$/.test(rawId.trim()) ? Number(rawId.trim()) : null;
    const summary = complianceStore.getSummary();
    return res.json({
      ...summary,
      ...(parsedId !== null ? { anilistId: parsedId, delisted: complianceStore.isMediaDelisted(parsedId) } : {}),
    });
  });

  // 11. Ensure unmatched /api/* routes never fall through to SPA index.html
  app.all('/api/*', (_req: Request, res: Response) => {
    return res.status(404).json({ error: 'API endpoint not found' });
  });

  return { app, hub };
}

export function attachWatchPartyWebSocket(server: http.Server, hub: WatchPartyHub): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (pathname === '/ws/party') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (process.env.DISABLE_HMR === 'true' || process.env.NODE_ENV === 'production') {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let joinedRoomId: string | null = null;

    ws.on('message', (rawBuf) => {
      let msg: any;
      try {
        const text = rawBuf.toString('utf8');
        if (text.length > 8192) return;
        msg = JSON.parse(text);
      } catch {
        return;
      }

      if (!msg || typeof msg.type !== 'string') return;

      if (msg.type === 'JOIN_ROOM') {
        const roomId = String(msg.roomId || '').trim().toUpperCase();
        const result = hub.registerSocket(roomId, ws, {
          id: String(msg.participantId || `guest-${Date.now()}`),
          name: String(msg.participantName || 'Viewer'),
          avatar: String(msg.participantAvatar || ''),
          hostToken: typeof msg.hostToken === 'string' ? msg.hostToken : undefined,
        });
        if (!result.ok) {
          ws.send(JSON.stringify({ type: 'ERROR', error: result.error }));
          return;
        }
        joinedRoomId = roomId;
        ws.send(
          JSON.stringify({
            type: 'ROOM_SNAPSHOT',
            isHost: result.isHost,
            room: result.room,
            messages: result.messages,
            serverNowMs: Date.now(),
          })
        );
        return;
      }

      if (!joinedRoomId) return;

      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', clientSentAt: msg.clientSentAt, serverNowMs: Date.now() }));
        if (typeof msg.lastRttMs === 'number') {
          hub.updateParticipantPing(joinedRoomId, ws, msg.lastRttMs);
        }
        return;
      }

      if (msg.type === 'HOST_CONTROL') {
        const result = hub.applyHostControl(joinedRoomId, String(msg.hostToken || ''), {
          type: msg.controlType,
          seekTime: msg.seekTime,
          episode: msg.episode,
          server: msg.server,
          audio: msg.audio,
        });
        if (!result.ok) {
          ws.send(JSON.stringify({ type: 'ERROR', error: result.error }));
        }
        return;
      }

      if (msg.type === 'CHAT_MESSAGE') {
        const res = hub.postChatMessage(joinedRoomId, {
          clientMsgId: String(msg.clientMsgId || ''),
          senderId: String(msg.senderId || 'anon'),
          senderName: String(msg.senderName || 'Viewer'),
          senderAvatar: String(msg.senderAvatar || ''),
          text: String(msg.text || ''),
        });
        if (!res.ok) {
          ws.send(JSON.stringify({ type: 'ERROR', error: res.error }));
        }
        return;
      }

      if (msg.type === 'REACTION') {
        hub.postReaction(joinedRoomId, {
          reactionId: String(msg.reactionId || `react-${Date.now()}`),
          emoji: String(msg.emoji || '🔥'),
          senderName: String(msg.senderName || 'Viewer'),
          senderAvatar: String(msg.senderAvatar || ''),
        });
      }
    });

    ws.on('close', () => {
      if (joinedRoomId) {
        hub.unregisterSocket(joinedRoomId, ws);
      }
    });
  });

  return wss;
}
