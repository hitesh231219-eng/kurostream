import {
  getProxyUpstreamHeaders,
  MAX_PROXY_IMAGE_BYTES,
  RateLimiter,
  validateProxyTargetUrlWithDns,
} from './_lib/security.mjs';

const limiter = new RateLimiter(180, 60 * 1000);

export default async function handler(req, res) {
  const clientIp = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const limit = limiter.consume(`vercel-proxy:${clientIp}`);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    return res.status(429).send('Rate limit exceeded');
  }

  const check = await validateProxyTargetUrlWithDns(String(req.query?.url || ''));
  if (!check.valid || !check.url) {
    return res.status(403).send(`Blocked proxy target: ${check.reason}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const imgRes = await fetch(check.url.toString(), {
      signal: controller.signal,
      redirect: 'manual',
      headers: getProxyUpstreamHeaders(check.url),
    });
    if (imgRes.status >= 300 && imgRes.status < 400) {
      return res.status(403).send('Upstream redirects are blocked');
    }
    if (!imgRes.ok) {
      return res.status(imgRes.status).send(`Upstream returned HTTP ${imgRes.status}`);
    }
    const contentType = (imgRes.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return res.status(415).send('Blocked non-image content');
    }
    const len = Number(imgRes.headers.get('content-length') || 0);
    if (len > MAX_PROXY_IMAGE_BYTES) {
      return res.status(413).send('Image exceeds 25 MB limit');
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (buffer.length > MAX_PROXY_IMAGE_BYTES) {
      return res.status(413).send('Image exceeds 25 MB limit');
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(err?.name === 'AbortError' ? 504 : 502).send(err?.message || 'Proxy error');
  } finally {
    clearTimeout(timer);
  }
}
