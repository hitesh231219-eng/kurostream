const STREAM_PROBE_URLS = [
  { id: 'anixo', url: 'https://anixo.buzz/' },
  { id: 'animeembed', url: 'https://animeembed.com/' },
  { id: 'megaplay-mal', url: 'https://megaplay.buzz/' },
  { id: 'zokoanime', url: 'https://zokoanime.video/' },
];

export default async function handler(_req, res) {
  try {
    const checks = await Promise.all(
      STREAM_PROBE_URLS.map(async (srv) => {
        const started = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const headers = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        };
        try {
          let probeRes = await fetch(srv.url, {
            method: 'HEAD',
            signal: controller.signal,
            headers,
          });
          if (probeRes.status >= 405) {
            probeRes = await fetch(srv.url, {
              method: 'GET',
              signal: controller.signal,
              headers,
            });
          }
          const latencyMs = Date.now() - started;
          return {
            id: srv.id,
            url: srv.url,
            reachable: probeRes.status < 500,
            latencyMs,
            statusCode: probeRes.status,
            checkedAt: Date.now(),
          };
        } catch {
          return {
            id: srv.id,
            url: srv.url,
            reachable: false,
            latencyMs: null,
            statusCode: null,
            checkedAt: Date.now(),
          };
        } finally {
          clearTimeout(timer);
        }
      })
    );

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ servers: checks });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Health probe failed', servers: [] });
  }
}
