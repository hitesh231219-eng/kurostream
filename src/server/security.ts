import dns from 'node:dns/promises';
import net from 'node:net';

export const ALLOWED_PROXY_DOMAINS = [
  'mangapill.com',
  'readdetectiveconan.com',
  'mangadex.org',
  'uploads.mangadex.org',
  'mangadex.network',
  'weebcentral.com',
  'planeptune.us',
  'lastation.us',
  'lowee.us',
  'leanbox.us',
  'compsci88.com',
  'anilist.co',
  's4.anilist.co',
  'myanimelist.net',
  'cdn.myanimelist.net',
] as const;

export const ALLOWED_DOWNLOAD_SOURCE_DOMAINS = [
  'pahe.nekostream.site',
  'testpahe.nekostream.site',
  'kwik.cx',
  'kwik.si',
  'pahe.win',
] as const;

export const ALLOWED_DOWNLOAD_SEARCH_DOMAINS = [
  'arm.haglund.dev',
  'animetosho.org',
  'subsplease.org',
  'nyaa.si',
  'nekobt.to',
] as const;

export const ALLOWED_DDL_VERIFY_DOMAINS = [
  'gofile.io',
  'buzzheavier.com',
  'pixeldrain.com',
  'krakenfiles.com',
  'akirabox.com',
  'download.gg',
  'clicknupload.red',
  'clicknupload.to',
  'down.mdiaload.com',
  'mdiaload.com',
  'multiup.io',
  '1fichier.com',
  'send.cm',
] as const;

export const MAX_PROXY_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB

export function isPrivateOrReservedIp(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase();
  if (!trimmed) return true;

  // Strip IPv6 zone index or IPv4-mapped IPv6 prefix
  const normalized = trimmed.replace(/^::ffff:/, '').split('%')[0];

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 127) return true; // Loopback 127.0.0.0/8
    if (a === 169 && b === 254) return true; // Link-local & cloud metadata 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
    if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking
    if (a >= 224) return true; // Multicast / reserved
    return false;
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true; // Link-local fe80::/10
    }
    if (normalized.startsWith('ff')) return true; // Multicast
    return false;
  }

  return true;
}

export function isHostInAllowlist(hostname: string, allowlist: readonly string[] = ALLOWED_PROXY_DOMAINS): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return false;
  }
  if (net.isIP(host) !== 0) {
    return false; // Raw IP literals are never allowlisted
  }

  return allowlist.some(allowed => {
    const cleanAllowed = allowed.toLowerCase();
    return host === cleanAllowed || host.endsWith(`.${cleanAllowed}`);
  });
}

export interface UrlValidationResult {
  valid: boolean;
  url?: URL;
  reason?: string;
}

export function validateProxyTargetUrlStatic(
  rawUrl: string,
  allowlist: readonly string[] = ALLOWED_PROXY_DOMAINS
): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > 2048) {
    return { valid: false, reason: 'Invalid or oversized URL parameter' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTPS URLs are permitted' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Embedded URL credentials are forbidden' };
  }

  if (parsed.port && parsed.port !== '443') {
    return { valid: false, reason: 'Non-standard ports are forbidden' };
  }

  if (!isHostInAllowlist(parsed.hostname, allowlist)) {
    return { valid: false, reason: `Host "${parsed.hostname}" is not in the permitted CDN allowlist` };
  }

  return { valid: true, url: parsed };
}

export async function validateProxyTargetUrlWithDns(
  rawUrl: string,
  allowlist: readonly string[] = ALLOWED_PROXY_DOMAINS
): Promise<UrlValidationResult> {
  const staticCheck = validateProxyTargetUrlStatic(rawUrl, allowlist);
  if (!staticCheck.valid || !staticCheck.url) {
    return staticCheck;
  }

  try {
    const records = await dns.lookup(staticCheck.url.hostname, { all: true });
    if (!records || records.length === 0) {
      return { valid: false, reason: 'DNS resolution returned no records' };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return { valid: false, reason: 'Destination resolves to a private or reserved network address' };
      }
    }
  } catch {
    return { valid: false, reason: 'Failed to resolve destination hostname' };
  }

  return staticCheck;
}

export function getProxyUpstreamHeaders(targetUrl: URL): Record<string, string> {
  const host = targetUrl.hostname.toLowerCase();
  let referer = `${targetUrl.origin}/`;
  if (host === 'mangapill.com' || host.endsWith('.mangapill.com') || host === 'readdetectiveconan.com' || host.endsWith('.readdetectiveconan.com')) {
    referer = 'https://mangapill.com/';
  } else if (host === 'mangadex.org' || host.endsWith('.mangadex.org') || host === 'mangadex.network' || host.endsWith('.mangadex.network')) {
    referer = 'https://mangadex.org/';
  } else if (
    host === 'weebcentral.com' ||
    host.endsWith('.weebcentral.com') ||
    host === 'planeptune.us' ||
    host.endsWith('.planeptune.us') ||
    host === 'lastation.us' ||
    host.endsWith('.lastation.us') ||
    host === 'lowee.us' ||
    host.endsWith('.lowee.us') ||
    host === 'leanbox.us' ||
    host.endsWith('.leanbox.us') ||
    host === 'compsci88.com' ||
    host.endsWith('.compsci88.com')
  ) {
    referer = 'https://weebcentral.com/';
  }

  return {
    Referer: referer,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  };
}

/**
 * Bounded LRU + TTL Cache with in-flight request deduplication (singleflight).
 */
export class BoundedTtlCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<V>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(
    maxEntries: number = 250,
    defaultTtlMs: number = 5 * 60 * 1000
  ) {
    if (maxEntries < 1) throw new Error('maxEntries must be >= 1');
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number = this.defaultTtlMs): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1000, ttlMs),
    });
  }

  async coalesce(key: string, fetcher: () => Promise<V>, ttlMs: number = this.defaultTtlMs): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const existingPromise = this.inflight.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = fetcher()
      .then((res) => {
        this.set(key, res, ttlMs);
        return res;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

/**
 * Sliding-window per-IP/key rate limiter with periodic pruning.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxBuckets: number;

  constructor(
    maxRequests: number,
    windowMs: number,
    maxBuckets: number = 5000
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxBuckets = maxBuckets;
  }

  consume(key: string, now: number = Date.now()): {
    allowed: boolean;
    remaining: number;
    retryAfterSec: number;
  } {
    const cutoff = now - this.windowMs;
    const prev = this.buckets.get(key) || [];
    const active = prev.filter(ts => ts > cutoff);

    if (active.length >= this.maxRequests) {
      const oldest = active[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.buckets.set(key, active);
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    active.push(now);
    if (!this.buckets.has(key) && this.buckets.size >= this.maxBuckets) {
      const oldestBucket = this.buckets.keys().next().value;
      if (oldestBucket !== undefined) this.buckets.delete(oldestBucket);
    }
    this.buckets.set(key, active);

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - active.length),
      retryAfterSec: 0,
    };
  }
}
