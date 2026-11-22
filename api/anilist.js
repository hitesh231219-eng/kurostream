import { z } from 'zod';
import { BoundedTtlCache, RateLimiter } from './_lib/security.mjs';

const anilistCache = new BoundedTtlCache(200, 5 * 60 * 1000);
const limiter = new RateLimiter(120, 60 * 1000);

const bodySchema = z.object({
  query: z.string().min(10).max(16000),
  variables: z.record(z.string(), z.any()).optional().default({}),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
  const limit = limiter.consume(`vercel-anilist:${clientIp}`);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    return res.status(429).json({ error: 'Rate limit exceeded. Please retry shortly.' });
  }

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

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch (err) {
    const status = typeof err?.status === 'number' ? err.status : 502;
    return res.status(status >= 400 && status < 600 ? status : 502).json({
      error: err?.message || 'Failed to fetch from AniList',
    });
  }
}
