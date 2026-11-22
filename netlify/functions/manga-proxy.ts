import {
  getProxyUpstreamHeaders,
  MAX_PROXY_IMAGE_BYTES,
  validateProxyTargetUrlWithDns,
} from '../../src/server/security';

export async function handler(event: any) {
  try {
    const rawUrl = event?.queryStringParameters?.url || '';
    const check = await validateProxyTargetUrlWithDns(rawUrl);
    if (!check.valid || !check.url) {
      return { statusCode: 403, body: `Blocked proxy target: ${check.reason}` };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const upstream = await fetch(check.url.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: getProxyUpstreamHeaders(check.url),
      });

      if (upstream.status >= 300 && upstream.status < 400) {
        return { statusCode: 403, body: 'Redirects are blocked for security' };
      }
      if (!upstream.ok) {
        return { statusCode: upstream.status, body: `Upstream returned HTTP ${upstream.status}` };
      }
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return { statusCode: 415, body: 'Blocked non-image content type' };
      }
      const cl = Number(upstream.headers.get('content-length') || 0);
      if (cl > MAX_PROXY_IMAGE_BYTES) {
        return { statusCode: 413, body: 'Image exceeds 25 MB limit' };
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > MAX_PROXY_IMAGE_BYTES) {
        return { statusCode: 413, body: 'Image exceeds 25 MB limit' };
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=86400',
        },
        body: buf.toString('base64'),
        isBase64Encoded: true,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    return { statusCode: 502, body: err?.message || 'Proxy error' };
  }
}
