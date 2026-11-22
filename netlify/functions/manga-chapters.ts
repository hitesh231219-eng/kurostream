import { resolveMangaChapters } from '../../src/server/mangaService';

export async function handler(event: any) {
  const title = String(event?.queryStringParameters?.title || '').trim();
  const altTitle = event?.queryStringParameters?.altTitle
    ? String(event.queryStringParameters.altTitle).trim()
    : undefined;
  if (!title || title.length > 200) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing or invalid manga title', chapters: [] }),
    };
  }
  const result = await resolveMangaChapters(title, altTitle);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
}
