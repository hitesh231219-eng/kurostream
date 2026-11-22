export type StreamingServerType =
  | 'anixo'
  | 'animeembed'
  | 'megaplay-mal'
  | 'zokoanime';

export interface PlayerSourceConfig {
  serverId: StreamingServerType;
  serverName?: string;
  anilistId: number;
  malId?: number | null;
  episode: number;
  audio: 'sub' | 'dub';
  accentColor?: string;
  trailerId?: string | null;
  format?: string;
}

export interface ServerOption {
  id: StreamingServerType;
  name: string;
  description: string;
  badge: string;
  requiresMalId: boolean;
  origin: string;
  supportsAudioSwitch: boolean;
}

export interface ServerProbeStatus {
  id: StreamingServerType;
  url: string;
  reachable: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  checkedAt: number;
}

export interface ResolvedStreamSource {
  available: boolean;
  url: string | null;
  reason?: string;
  effectiveServerId: StreamingServerType;
  usedFailover: boolean;
}

export const STREAMING_SERVERS: ServerOption[] = [
  {
    id: 'anixo',
    name: 'Ryu',
    description: 'Ryu AniList-native direct embed supporting series, OVAs & movies',
    badge: 'Ryu',
    requiresMalId: false,
    origin: 'https://anixo.buzz',
    supportsAudioSwitch: true,
  },
  {
    id: 'animeembed',
    name: 'War',
    description: 'War AniList-native HLS player with multi-resolution adaptive streaming',
    badge: 'War',
    requiresMalId: false,
    origin: 'https://animeembed.com',
    supportsAudioSwitch: true,
  },
  {
    id: 'megaplay-mal',
    name: 'Warp',
    description: 'Warp MyAnimeList ID mirror (requires verified idMal)',
    badge: 'Warp',
    requiresMalId: true,
    origin: 'https://megaplay.buzz',
    supportsAudioSwitch: true,
  },
  {
    id: 'zokoanime',
    name: 'Volt',
    description: 'Volt HLS mirror mapped via verified MyAnimeList ID',
    badge: 'Volt',
    requiresMalId: true,
    origin: 'https://zokoanime.video',
    supportsAudioSwitch: true,
  },
];

export function getServerDisplayName(serverId: StreamingServerType): string {
  return STREAMING_SERVERS.find(s => s.id === serverId)?.badge || serverId;
}

export function isServerSupportedForMedia(
  serverId: StreamingServerType,
  anilistId: number,
  malId?: number | null
): { supported: boolean; reason?: string } {
  const srv = STREAMING_SERVERS.find(s => s.id === serverId);
  if (!srv) {
    return { supported: false, reason: `Unknown server "${serverId}"` };
  }
  if (!anilistId || anilistId <= 0) {
    return { supported: false, reason: 'Missing valid AniList ID' };
  }
  if (srv.requiresMalId && (!malId || malId <= 0)) {
    return {
      supported: false,
      reason: `${srv.badge} requires a verified MyAnimeList ID (never maps AniList IDs blindly).`,
    };
  }
  return { supported: true };
}

/**
 * Strictly constructs an embed URL without fabricating MAL IDs from AniList IDs.
 */
export function buildStrictStreamUrl(config: PlayerSourceConfig): ResolvedStreamSource {
  const { serverId, anilistId, malId, episode, audio, accentColor = '8b5cf6', format } = config;
  const isMovie = (format || '').toUpperCase() === 'MOVIE';
  const safeEpisode = isMovie ? 1 : Math.max(1, Math.floor(episode || 1));

  const support = isServerSupportedForMedia(serverId, anilistId, malId);
  if (!support.supported) {
    return {
      available: false,
      url: null,
      reason: support.reason,
      effectiveServerId: serverId,
      usedFailover: false,
    };
  }

  switch (serverId) {
    case 'anixo':
      return {
        available: true,
        url: `https://anixo.buzz/embed/ani/${anilistId}/${safeEpisode}?track=${audio}&color=${accentColor}`,
        effectiveServerId: 'anixo',
        usedFailover: false,
      };

    case 'animeembed':
      return {
        available: true,
        url: `https://animeembed.com/embed/ani/${anilistId}/${safeEpisode}?track=${audio}&accent=${accentColor}&autoPlay=1`,
        effectiveServerId: 'animeembed',
        usedFailover: false,
      };

    case 'megaplay-mal':
      return {
        available: true,
        url: `https://megaplay.buzz/stream/mal/${malId}/${safeEpisode}/${audio}?color=%23${accentColor}&autoplay=1`,
        effectiveServerId: 'megaplay-mal',
        usedFailover: false,
      };

    case 'zokoanime':
      return {
        available: true,
        url: `https://zokoanime.video/stream/mal/${malId}/${safeEpisode}/${audio}?color=${accentColor}`,
        effectiveServerId: 'zokoanime',
        usedFailover: false,
      };
  }
}

/**
 * Resolves the requested server or automatically fails over to the next compatible healthy server.
 */
export function resolveBestAvailableStream(
  config: PlayerSourceConfig,
  failedServers: Set<StreamingServerType> = new Set()
): ResolvedStreamSource {
  const direct = buildStrictStreamUrl(config);
  if (direct.available && !failedServers.has(config.serverId)) {
    return direct;
  }

  for (const srv of STREAMING_SERVERS) {
    if (srv.id === config.serverId || failedServers.has(srv.id)) continue;
    const candidate = buildStrictStreamUrl({ ...config, serverId: srv.id });
    if (candidate.available && candidate.url) {
      return {
        ...candidate,
        usedFailover: true,
        reason: direct.reason || `Failed over from ${getServerDisplayName(config.serverId)} to ${srv.badge}`,
      };
    }
  }

  return direct;
}

// Backward-compatible export returning safe string URL (never invalid MAL fallback)
export function getMegaPlayStreamUrl(config: PlayerSourceConfig): string {
  const resolved = resolveBestAvailableStream(config);
  return resolved.url || `https://anixo.buzz/embed/ani/${config.anilistId}/${Math.max(1, config.episode || 1)}?track=${config.audio}`;
}

export async function fetchServerHealthStatuses(): Promise<ServerProbeStatus[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('/api/servers/health', { signal: controller.signal });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.servers) ? data.servers : [];
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}
