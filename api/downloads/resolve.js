import { resolveAnimeDownloadSource } from '../_lib/downloadService.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const q = req.query || {};
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const rawUrl =
    req.method === 'POST'
      ? String(body.url || body.source || body.id || '')
      : String(q.url || q.id || '');

  if (!rawUrl || rawUrl.length > 2048) {
    return res.status(400).json({
      ok: false,
      error: 'Provide a valid NekoStream Pahe URL or short ID (e.g. https://pahe.nekostream.site/ENxxw or ENxxw).',
    });
  }

  try {
    const resolved = await resolveAnimeDownloadSource(rawUrl);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(resolved.ok ? 200 : 400).json(resolved);
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err?.message || 'Download source trace failed',
    });
  }
}
