import { resolveChapterPages } from '../../src/server/mangaService';

export async function handler(event: any) {
  const q = event?.queryStringParameters || {};
  const title = String(q.title || '').trim();
  const altTitle = q.altTitle ? String(q.altTitle).trim() : undefined;
  const chapter = String(q.chapter || '1').trim();
  const chapterId = q.chapterId ? String(q.chapterId).trim() : undefined;
  const source = q.source ? String(q.source).trim() : undefined;

  if (!title || title.length > 200) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, pages: [], error: 'Missing or invalid title' }),
    };
  }
  const result = await resolveChapterPages({ title, altTitle, chapter, chapterId, source });
  return {
    statusCode: result.success ? 200 : 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
}
