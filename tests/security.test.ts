import { describe, it, expect } from 'vitest';
import {
  isPrivateOrReservedIp,
  isHostInAllowlist,
  validateProxyTargetUrlStatic,
  getProxyUpstreamHeaders,
  BoundedTtlCache,
  RateLimiter,
} from '../src/server/security';

describe('SSRF & Proxy Security Controls', () => {
  it('blocks private, loopback, metadata, CGNAT, and IPv6 local addresses', () => {
    const blocked = [
      '127.0.0.1',
      '10.0.0.1',
      '10.255.255.254',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fe80::1',
      'fc00::1',
      '::ffff:127.0.0.1',
      '',
    ];
    for (const ip of blocked) {
      expect(isPrivateOrReservedIp(ip)).toBe(true);
    }

    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('172.32.0.1')).toBe(false);
  });

  it('strictly enforces CDN hostname allowlist and rejects raw IPs or subdomains of unrelated hosts', () => {
    expect(isHostInAllowlist('uploads.mangadex.org')).toBe(true);
    expect(isHostInAllowlist('cdn.mangadex.network')).toBe(true);
    expect(isHostInAllowlist('cdn.mangapill.com')).toBe(true);
    expect(isHostInAllowlist('s4.anilist.co')).toBe(true);

    expect(isHostInAllowlist('localhost')).toBe(false);
    expect(isHostInAllowlist('evil-mangadex.org')).toBe(false);
    expect(isHostInAllowlist('mangadex.org.attacker.com')).toBe(false);
    expect(isHostInAllowlist('169.254.169.254')).toBe(false);
  });

  it('blocks insecure schemes, embedded credentials, non-443 ports, and untrusted hosts', () => {
    expect(validateProxyTargetUrlStatic('http://uploads.mangadex.org/a.jpg').valid).toBe(false);
    expect(validateProxyTargetUrlStatic('https://user:pass@uploads.mangadex.org/a.jpg').valid).toBe(false);
    expect(validateProxyTargetUrlStatic('https://uploads.mangadex.org:8443/a.jpg').valid).toBe(false);
    expect(validateProxyTargetUrlStatic('https://169.254.169.254/latest/meta-data/').valid).toBe(false);
    expect(validateProxyTargetUrlStatic('https://attacker.example/secret.png').valid).toBe(false);

    const ok = validateProxyTargetUrlStatic('https://uploads.mangadex.org/data/hash/1.png');
    expect(ok.valid).toBe(true);
    expect(ok.url?.hostname).toBe('uploads.mangadex.org');

    expect(
      getProxyUpstreamHeaders(new URL('https://cdn.readdetectiveconan.com/file/mangap/1/1.jpeg')).Referer
    ).toBe('https://mangapill.com/');
    expect(
      getProxyUpstreamHeaders(new URL('https://cmdxd98sb0x3yprd.mangadex.network/data/abc/1.png')).Referer
    ).toBe('https://mangadex.org/');
    expect(isHostInAllowlist('scans-hot.planeptune.us')).toBe(true);
    expect(isHostInAllowlist('official.lowee.us')).toBe(true);
    expect(isHostInAllowlist('scans.lastation.us')).toBe(true);
    expect(
      getProxyUpstreamHeaders(new URL('https://scans-hot.planeptune.us/manga/One-Piece/1-001.png')).Referer
    ).toBe('https://weebcentral.com/');
  });
});

describe('BoundedTtlCache & RateLimiter', () => {
  it('evicts least recently used entries and deduplicates concurrent coalesce calls', async () => {
    const cache = new BoundedTtlCache<number>(2, 60_000);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1); // refresh LRU for 'a'
    cache.set('c', 3); // evicts 'b'
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);

    let executions = 0;
    const [r1, r2] = await Promise.all([
      cache.coalesce('inflight', async () => {
        executions += 1;
        await new Promise((r) => setTimeout(r, 15));
        return 42;
      }),
      cache.coalesce('inflight', async () => {
        executions += 1;
        return 99;
      }),
    ]);
    expect(executions).toBe(1);
    expect(r1).toBe(42);
    expect(r2).toBe(42);
  });

  it('enforces sliding window rate limits cleanly', () => {
    const limiter = new RateLimiter(3, 10_000);
    const t0 = 1_000_000;
    expect(limiter.consume('ip1', t0).allowed).toBe(true);
    expect(limiter.consume('ip1', t0 + 100).allowed).toBe(true);
    expect(limiter.consume('ip1', t0 + 200).allowed).toBe(true);

    const blocked = limiter.consume('ip1', t0 + 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);

    // Next IP has independent budget
    expect(limiter.consume('ip2', t0 + 300).allowed).toBe(true);
  });
});
