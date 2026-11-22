import { resolveMangaChapters } from '../_lib/mangaService.mjs';

export default async function handler(req, res) {
  const q = req.query || {};
  const title = String(q.title || '').trim();
  const altTitle = q.altTitle ? String(q.altTitle).trim() : undefined;

  if (!title || title.length > 200) {
    return res.status(400).json({ error: 'Missing or invalid manga title', chapters: [] });
  }

  try {
    const result = await resolveMangaChapters(title, altTitle);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    return res.status(502).json({
      chapters: [],
      source: 'none',
      errors: [err?.message || 'Upstream manga resolution failed'],
    });
  }
}
