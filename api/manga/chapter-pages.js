import { resolveChapterPages } from '../_lib/mangaService.mjs';

export default async function handler(req, res) {
  const q = req.query || {};
  const title = String(q.title || '').trim();
  const altTitle = q.altTitle ? String(q.altTitle).trim() : undefined;
  const chapter = String(q.chapter || '1').trim();
  const chapterId = q.chapterId ? String(q.chapterId).trim() : undefined;
  const source = q.source ? String(q.source).trim() : undefined;

  if (!title || title.length > 200) {
    return res.status(400).json({ success: false, pages: [], error: 'Missing or invalid manga title' });
  }

  const result = await resolveChapterPages({ title, altTitle, chapter, chapterId, source });
  return res.status(result.success ? 200 : 404).json(result);
}
