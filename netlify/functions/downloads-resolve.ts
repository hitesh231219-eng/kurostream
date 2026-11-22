import { resolveAnimeDownloadSource } from '../../src/server/downloadService';

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
  const rawUrl =
    event?.httpMethod === 'POST'
      ? String(bodyObj.url || bodyObj.source || bodyObj.id || '')
      : String(q.url || q.id || '');

  if (!rawUrl || rawUrl.length > 2048) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        ok: false,
        error:
          'Provide a valid NekoStream Pahe URL or short ID (e.g. https://pahe.nekostream.site/ENxxw or ENxxw).',
      }),
    };
  }

  try {
    const resolved = await resolveAnimeDownloadSource(rawUrl);
    return {
      statusCode: resolved.ok ? 200 : 400,
      headers,
      body: JSON.stringify(resolved),
    };
  } catch (err: any) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        ok: false,
        error: err?.message || 'Download source trace failed',
      }),
    };
  }
}
