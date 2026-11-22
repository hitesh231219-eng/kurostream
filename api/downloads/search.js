import { searchAnimeEpisodeDownloads } from '../_lib/downloadService.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const q = req.query || {};
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const src = req.method === 'POST' ? body : q;

  const title = String(src.title || src.englishTitle || src.romajiTitle || '').trim();
  if (!title || title.length > 240) {
    return res.status(400).json({
      ok: false,
      results: [],
      batches: [],
      error: 'Provide an anime title and episode number to search episode downloads.',
    });
  }

  const anilistId = src.anilistId || src.id ? Number(src.anilistId || src.id) : null;
  const malId = src.malId ? Number(src.malId) : null;
  const episode = Math.max(1, Math.min(5000, Math.floor(Number(src.episode) || 1)));
  const audio = src.audio === 'dub' ? 'dub' : 'sub';
  const quality = ['1080p', '720p', '480p', '360p'].includes(String(src.quality))
    ? String(src.quality)
    : '1080p';

  try {
    const result = await searchAnimeEpisodeDownloads({
      anilistId: Number.isFinite(anilistId) && anilistId > 0 ? anilistId : null,
      malId: Number.isFinite(malId) && malId > 0 ? malId : null,
      title,
      englishTitle: src.englishTitle ? String(src.englishTitle) : null,
      romajiTitle: src.romajiTitle ? String(src.romajiTitle) : null,
      episode,
      audio,
      quality,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    return res.status(502).json({
      ok: false,
      results: [],
      batches: [],
      error: err?.message || 'Episode download search failed',
    });
  }
}
