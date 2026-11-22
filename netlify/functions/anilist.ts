import { z } from 'zod';
import { BoundedTtlCache } from '../../src/server/security';

const anilistCache = new BoundedTtlCache<any>(200, 5 * 60 * 1000);

const bodySchema = z.object({
  query: z.string().min(10).max(16000),
  variables: z.record(z.string(), z.any()).optional().default({}),
});

export async function handler(event: any) {
  if (event?.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let bodyObj: unknown;
  try {
    bodyObj = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON request payload' }),
    };
  }

  const parsed = bodySchema.safeParse(bodyObj);
  if (!parsed.success) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid GraphQL request payload' }),
    };
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120',
      },
      body: JSON.stringify(data),
    };
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 502;
    return {
      statusCode: status >= 400 && status < 600 ? status : 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Failed to fetch from AniList' }),
    };
  }
}
