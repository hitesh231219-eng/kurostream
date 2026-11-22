import { searchAnimeEpisodeDownloads } from '../../src/server/downloadService';

export async function handler(event: any) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };

  if (event?.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  let bodyObj: Record<string, any> = {};
  if (event?.httpMethod === 'POST' && event?.body) {
    try {
      bodyObj = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      bodyObj = {};
    }
  }

  const q = event?.queryStringParameters || {};
  const src = event?.httpMethod === 'POST' ? bodyObj : q;

  const title = String(src.title || src.englishTitle || src.romajiTitle || '').trim();
  if (!title || title.length > 240) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        ok: false,
        results: [],
        batches: [],
        error: 'Provide an anime title and episode number to search episode downloads.',
      }),
    };
  }

  const anilistId = src.anilistId || src.id ? Number(src.anilistId || src.id) : null;
  const malId = src.malId ? Number(src.malId) : null;
  const episode = Math.max(1, Math.min(5000, Math.floor(Number(src.episode) || 1)));
  const audio = src.audio === 'dub' ? 'dub' : 'sub';
  const quality = ['1080p', '720p', '480p', '360p'].includes(String(src.quality))
    ? (String(src.quality) as '1080p' | '720p' | '480p' | '360p')
    : '1080p';

  try {
    const result = await searchAnimeEpisodeDownloads({
      anilistId: anilistId !== null && Number.isFinite(anilistId) && anilistId > 0 ? anilistId : null,
      malId: malId !== null && Number.isFinite(malId) && malId > 0 ? malId : null,
      title,
      englishTitle: src.englishTitle ? String(src.englishTitle) : null,
      romajiTitle: src.romajiTitle ? String(src.romajiTitle) : null,
      episode,
      audio,
      quality,
    });
    return {
      statusCode: result.ok ? 200 : 400,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        ok: false,
        results: [],
        batches: [],
        error: err?.message || 'Episode download search failed',
      }),
    };
  }
}
