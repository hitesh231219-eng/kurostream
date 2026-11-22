import { AddonManifestInputSchema, KuroAddonManifest } from './addons';

const DECENTRALIZED_CFG_KEY = 'kurostream_decentralized_cfg_v1';

export const DEFAULT_NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

export const DEFAULT_IPFS_GATEWAYS = [
  'https://ipfs.io',
  'https://dweb.link',
  'https://w3s.link',
  'http://127.0.0.1:8080',
];

export interface DecentralizedConfig {
  nostrRelays: string[];
  ipfsGateway: string;
  pinnedFrontendCid: string;
  onionMirrorHost: string;
}

export interface NostrRelayProbeResult {
  relayUrl: string;
  connected: boolean;
  eoseReceived: boolean;
  latencyMs: number | null;
  eventsFound: number;
  error?: string;
}

export interface DiscoveredNostrManifest {
  eventId: string;
  pubkey: string;
  createdAt: number;
  relayUrl: string;
  manifest: Record<string, any>;
}

export interface IpfsGatewayProbeResult {
  gatewayOrigin: string;
  reachable: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  resolvedUrl: string;
  error?: string;
}

export function loadDecentralizedConfig(): DecentralizedConfig {
  if (typeof window === 'undefined') {
    return {
      nostrRelays: DEFAULT_NOSTR_RELAYS,
      ipfsGateway: DEFAULT_IPFS_GATEWAYS[0],
      pinnedFrontendCid: '',
      onionMirrorHost: '',
    };
  }
  try {
    const raw = localStorage.getItem(DECENTRALIZED_CFG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        nostrRelays:
          Array.isArray(parsed?.nostrRelays) && parsed.nostrRelays.length > 0
            ? parsed.nostrRelays.filter((r: unknown) => typeof r === 'string' && /^wss?:\/\//i.test(r))
            : DEFAULT_NOSTR_RELAYS,
        ipfsGateway:
          typeof parsed?.ipfsGateway === 'string' && parsed.ipfsGateway.startsWith('http')
            ? parsed.ipfsGateway.replace(/\/+$/, '')
            : DEFAULT_IPFS_GATEWAYS[0],
        pinnedFrontendCid: typeof parsed?.pinnedFrontendCid === 'string' ? parsed.pinnedFrontendCid.trim() : '',
        onionMirrorHost: typeof parsed?.onionMirrorHost === 'string' ? parsed.onionMirrorHost.trim() : '',
      };
    }
  } catch {}
  return {
    nostrRelays: DEFAULT_NOSTR_RELAYS,
    ipfsGateway: DEFAULT_IPFS_GATEWAYS[0],
    pinnedFrontendCid: '',
    onionMirrorHost: '',
  };
}

export function saveDecentralizedConfig(cfg: DecentralizedConfig): DecentralizedConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DECENTRALIZED_CFG_KEY, JSON.stringify(cfg));
    } catch {}
  }
  return cfg;
}

export function validateIpfsCid(cid: string): boolean {
  const trimmed = cid.trim();
  // CIDv0 (Qm + 44 base58 chars) or CIDv1 base32/base36 (bafy..., bafk..., bafz...)
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed) || /^baf[a-z0-9]{50,}$/i.test(trimmed);
}

/**
 * Opens a real NIP-01 WebSocket session to a Nostr relay, queries #kurostream-addon events,
 * measures EOSE round-trip latency, and returns any schema-valid add-on announcements.
 */
export function probeNostrRelay(
  relayUrl: string,
  options?: { authorPubkeyHex?: string; timeoutMs?: number }
): Promise<{ probe: NostrRelayProbeResult; discovered: DiscoveredNostrManifest[] }> {
  const timeoutMs = options?.timeoutMs ?? 5500;
  const started = Date.now();

  if (!/^wss?:\/\/[^\s/]+/i.test(relayUrl.trim())) {
    return Promise.resolve({
      probe: {
        relayUrl,
        connected: false,
        eoseReceived: false,
        latencyMs: null,
        eventsFound: 0,
        error: 'Relay URL must start with wss:// (or ws://)',
      },
      discovered: [],
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;
    const discovered: DiscoveredNostrManifest[] = [];
    const subId = `ks-${Math.random().toString(36).slice(2, 10)}`;

    const finish = (probe: NostrRelayProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['CLOSE', subId]));
          ws.close();
        } else if (ws && ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {}
      resolve({ probe, discovered });
    };

    const timer = setTimeout(() => {
      finish({
        relayUrl,
        connected: ws?.readyState === WebSocket.OPEN,
        eoseReceived: false,
        latencyMs: null,
        eventsFound: discovered.length,
        error: 'Timed out waiting for EOSE',
      });
    }, timeoutMs);

    try {
      ws = new WebSocket(relayUrl.trim());
    } catch (err: any) {
      finish({
        relayUrl,
        connected: false,
        eoseReceived: false,
        latencyMs: null,
        eventsFound: 0,
        error: err?.message || 'WebSocket initialization failed',
      });
      return;
    }

    ws.onopen = () => {
      const filter: Record<string, any> = {
        kinds: [30078, 1],
        '#t': ['kurostream-addon'],
        limit: 12,
      };
      if (options?.authorPubkeyHex && /^[a-f0-9]{64}$/i.test(options.authorPubkeyHex.trim())) {
        filter.authors = [options.authorPubkeyHex.trim().toLowerCase()];
        delete filter['#t'];
      }
      try {
        ws?.send(JSON.stringify(['REQ', subId, filter]));
      } catch {}
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(String(evt.data));
        if (!Array.isArray(payload)) return;

        if (payload[0] === 'EVENT' && payload[1] === subId && payload[2]) {
          const ev = payload[2];
          if (typeof ev.content === 'string') {
            try {
              const maybeJson = JSON.parse(ev.content);
              const valid = AddonManifestInputSchema.safeParse(maybeJson);
              if (valid.success) {
                discovered.push({
                  eventId: String(ev.id || ''),
                  pubkey: String(ev.pubkey || ''),
                  createdAt: typeof ev.created_at === 'number' ? ev.created_at : 0,
                  relayUrl,
                  manifest: valid.data,
                });
              }
            } catch {}
          }
        } else if (payload[0] === 'EOSE' && payload[1] === subId) {
          finish({
            relayUrl,
            connected: true,
            eoseReceived: true,
            latencyMs: Date.now() - started,
            eventsFound: discovered.length,
          });
        }
      } catch {}
    };

    ws.onerror = () => {
      finish({
        relayUrl,
        connected: false,
        eoseReceived: false,
        latencyMs: null,
        eventsFound: discovered.length,
        error: 'Relay connection refused or blocked',
      });
    };
  });
}

export async function queryNostrNetwork(
  relays: string[],
  authorPubkeyHex?: string
): Promise<{ probes: NostrRelayProbeResult[]; manifests: DiscoveredNostrManifest[] }> {
  const uniqueRelays = Array.from(new Set(relays.map((r) => r.trim()).filter(Boolean))).slice(0, 8);
  const results = await Promise.all(
    uniqueRelays.map((relay) => probeNostrRelay(relay, { authorPubkeyHex }))
  );

  const probes = results.map((r) => r.probe);
  const seenEvents = new Set<string>();
  const manifests: DiscoveredNostrManifest[] = [];
  for (const res of results) {
    for (const item of res.discovered) {
      const key = item.eventId || `${item.manifest.id}:${item.pubkey}`;
      if (!seenEvents.has(key)) {
        seenEvents.add(key);
        manifests.push(item);
      }
    }
  }

  return { probes, manifests };
}

export function hasNip07Extension(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).nostr?.signEvent === 'function';
}

/**
 * Signs an add-on manifest bundle using the viewer's NIP-07 Nostr extension
 * and broadcasts the signed NIP-01 event across connected relays.
 */
export async function publishAddonToNostr(
  relays: string[],
  addon: KuroAddonManifest
): Promise<{ ok: boolean; eventId?: string; relayAcks: Array<{ relay: string; accepted: boolean; reason?: string }>; error?: string }> {
  if (!hasNip07Extension()) {
    return {
      ok: false,
      relayAcks: [],
      error: 'No NIP-07 Nostr signer extension detected (e.g. Alby or nos2x).',
    };
  }

  try {
    const unsigned = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `kurostream-addon:${addon.id}`],
        ['t', 'kurostream-addon'],
      ],
      content: JSON.stringify({
        id: addon.id,
        name: addon.name,
        version: addon.version,
        description: addon.description,
        author: addon.author,
        types: addon.types,
        streamTemplate: addon.streamTemplate,
        mangaCatalogEndpoint: addon.mangaCatalogEndpoint,
      }),
    };

    const signedEvent = await (window as any).nostr.signEvent(unsigned);
    const acks = await Promise.all(
      relays.slice(0, 6).map(
        (relayUrl) =>
          new Promise<{ relay: string; accepted: boolean; reason?: string }>((resolve) => {
            let done = false;
            const ws = new WebSocket(relayUrl);
            const timer = setTimeout(() => {
              if (!done) {
                done = true;
                try { ws.close(); } catch {}
                resolve({ relay: relayUrl, accepted: false, reason: 'Timed out waiting for OK' });
              }
            }, 4500);

            ws.onopen = () => {
              ws.send(JSON.stringify(['EVENT', signedEvent]));
            };

            ws.onmessage = (evt) => {
              try {
                const msg = JSON.parse(String(evt.data));
                if (msg[0] === 'OK' && msg[1] === signedEvent.id) {
                  done = true;
                  clearTimeout(timer);
                  try { ws.close(); } catch {}
                  resolve({
                    relay: relayUrl,
                    accepted: Boolean(msg[2]),
                    reason: typeof msg[3] === 'string' ? msg[3] : undefined,
                  });
                }
              } catch {}
            };

            ws.onerror = () => {
              if (!done) {
                done = true;
                clearTimeout(timer);
                resolve({ relay: relayUrl, accepted: false, reason: 'Relay socket error' });
              }
            };
          })
      )
    );

    const anyAccepted = acks.some((a) => a.accepted);
    return {
      ok: anyAccepted,
      eventId: signedEvent.id,
      relayAcks: acks,
      error: anyAccepted ? undefined : 'Relays did not confirm event publication.',
    };
  } catch (err: any) {
    return {
      ok: false,
      relayAcks: [],
      error: err?.message || 'Signing rejected or Nostr extension failed',
    };
  }
}

export async function probeIpfsGateway(
  gatewayOrigin: string,
  cid?: string
): Promise<IpfsGatewayProbeResult> {
  const cleanOrigin = gatewayOrigin.trim().replace(/\/+$/, '');
  const cleanCid = (cid || '').trim();
  const targetUrl =
    cleanCid && validateIpfsCid(cleanCid)
      ? `${cleanOrigin}/ipfs/${cleanCid}/`
      : `${cleanOrigin}/ipfs/bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354`;

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return {
      gatewayOrigin: cleanOrigin,
      reachable: res.ok || res.status < 500,
      latencyMs: Date.now() - started,
      statusCode: res.status,
      resolvedUrl: targetUrl,
    };
  } catch (err: any) {
    return {
      gatewayOrigin: cleanOrigin,
      reachable: false,
      latencyMs: null,
      statusCode: null,
      resolvedUrl: targetUrl,
      error: err?.name === 'AbortError' ? 'Gateway timed out' : err?.message || 'CORS or host unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function generateTorHiddenServiceConfig(localPort = 3000): string {
  return `# Append to /etc/tor/torrc to publish a Tor v3 .onion mirror
HiddenServiceDir /var/lib/tor/kurostream_service/
HiddenServiceVersion 3
HiddenServicePort 80 127.0.0.1:${localPort}

# Restart Tor and read your generated .onion hostname:
# sudo systemctl restart tor
# sudo cat /var/lib/tor/kurostream_service/hostname`;
}

export function generateIpfsDeploymentScript(): string {
  return `# 1. Build a relocatable static bundle (no central API dependencies required for static shell)
VITE_IPFS_BUILD=true VITE_CLEAN_CORE_ONLY=true npm run build

# 2. Pin the static dist/ directory to your local IPFS Kubo node
ipfs add -r -Q dist/
# Outputs your Content ID (CID), e.g. bafybeig...

# 3. Publish or update a mutable IPNS pointer for zero-DNS updates
ipfs name publish /ipfs/<YOUR_CID>`;
}

export function generateCleanCoreEnvSnippet(): string {
  return `# Deploy KuroStream in strict Clean-Core mode (GitHub & Normal-Web Safe Architecture)
# Disables hardcoded built-in stream domains; viewers supply their own remote Add-On manifests locally.
VITE_CLEAN_CORE_ONLY=true
VITE_IPFS_BUILD=false`;
}
