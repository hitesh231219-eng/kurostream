export interface DownloadTraceHop {
  step: number;
  url: string;
  host: string;
  status: number | null;
  type: 'ad-interstitial' | 'redirect' | 'filehost' | 'direct';
  note: string;
}

export interface ResolvedDownloadSource {
  ok: boolean;
  inputUrl: string;
  normalizedUrl: string;
  resolvedUrl: string | null;
  directDownloadUrl: string | null;
  sourceProvider: 'nekostream-pahe' | 'kwik' | 'pahe';
  sourceHost: string | null;
  paheId: string | null;
  kwikFileId: string | null;
  fileName: string | null;
  adGateBypassed: boolean;
  requiresBrowserChallenge: boolean;
  hops: DownloadTraceHop[];
  error?: string;
}

export interface EpisodeDirectMirror {
  host: string;
  url: string;
  verified?: 'live' | 'browser-check';
}

export interface EpisodeDownloadRelease {
  id: string;
  title: string;
  releaseGroup: string | null;
  episode: number;
  isBatch: boolean;
  quality: '2160p' | '1080p' | '720p' | '480p' | '360p' | 'unknown';
  audioType: 'sub' | 'dub' | 'dual';
  fileSize: string | null;
  seeders: number | null;
  viewUrl: string | null;
  anidbId: number | null;
  seriesMatchedById: boolean;
  directMirrors: EpisodeDirectMirror[];
  torrentUrl: string | null;
  magnetUrl: string | null;
  source: 'animetosho' | 'nyaa' | 'nekobt' | 'subsplease';
  matchScore: number;
}

export interface SearchAnimeDownloadsParams {
  anilistId?: number | null;
  malId?: number | null;
  title: string;
  englishTitle?: string | null;
  romajiTitle?: string | null;
  synonyms?: string[];
  episode: number;
  audio?: 'sub' | 'dub';
  quality?: '1080p' | '720p' | '480p' | '360p';
}

export interface SearchAnimeDownloadsResponse {
  ok: boolean;
  animeTitle: string;
  episode: number;
  audio: 'sub' | 'dub';
  anilistId: number | null;
  malId: number | null;
  anidbId: number | null;
  identityVerified: boolean;
  sourcesChecked?: string[];
  verifiedLiveMirrorsCount?: number;
  results: EpisodeDownloadRelease[];
  batches: EpisodeDownloadRelease[];
  error?: string;
}

export interface SavedEpisodeDownload {
  id: string;
  animeId: number | null;
  animeTitle: string;
  coverImage?: string;
  episode: number;
  audio: 'sub' | 'dub';
  quality: '1080p' | '720p' | '480p' | '360p';
  inputUrl: string;
  resolvedUrl: string;
  directDownloadUrl?: string | null;
  paheId?: string | null;
  kwikFileId?: string | null;
  sourceProvider: string;
  adGateBypassed: boolean;
  savedAt: number;
}

export const NEKOSTREAM_PAHE_SOURCE = {
  id: 'nekostream-pahe',
  name: 'NekoStream Pahe',
  baseUrl: 'https://pahe.nekostream.site/',
  relayUrl: 'https://testpahe.nekostream.site/',
  description:
    'Traces any pahe.nekostream.site/<id> episode link past its ad gate through testpahe.nekostream.site directly to Kwik.',
} as const;

const DOWNLOADS_STORAGE_KEY = 'kurostream_episode_downloads_v1';
export const DOWNLOADS_UPDATED_EVENT = 'kuro:downloads-updated';

export async function searchAnimeDownloads(
  params: SearchAnimeDownloadsParams,
  externalSignal?: AbortSignal
): Promise<SearchAnimeDownloadsResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    const res = await fetch('/api/downloads/search', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data && typeof data.ok === 'boolean') {
      return data as SearchAnimeDownloadsResponse;
    }
    return {
      ok: false,
      animeTitle: params.title,
      episode: params.episode,
      audio: params.audio || 'sub',
      anilistId: params.anilistId ?? null,
      malId: params.malId ?? null,
      anidbId: null,
      identityVerified: false,
      results: [],
      batches: [],
      error: `Download search returned HTTP ${res.status}`,
    };
  } catch (err: any) {
    if (externalSignal?.aborted) {
      return {
        ok: false,
        animeTitle: params.title,
        episode: params.episode,
        audio: params.audio || 'sub',
        anilistId: params.anilistId ?? null,
        malId: params.malId ?? null,
        anidbId: null,
        identityVerified: false,
        results: [],
        batches: [],
        error: 'Search superseded',
      };
    }
    return {
      ok: false,
      animeTitle: params.title,
      episode: params.episode,
      audio: params.audio || 'sub',
      anilistId: params.anilistId ?? null,
      malId: params.malId ?? null,
      anidbId: null,
      identityVerified: false,
      results: [],
      batches: [],
      error:
        err?.name === 'AbortError'
          ? 'Timed out searching episode downloads.'
          : err?.message || 'Unable to reach episode download search endpoint.',
    };
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function resolveAnimeDownload(rawInput: string): Promise<ResolvedDownloadSource> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      inputUrl: rawInput,
      normalizedUrl: rawInput,
      resolvedUrl: null,
      directDownloadUrl: null,
      sourceProvider: 'nekostream-pahe',
      sourceHost: null,
      paheId: null,
      kwikFileId: null,
      fileName: null,
      adGateBypassed: false,
      requiresBrowserChallenge: false,
      hops: [],
      error: 'Enter a NekoStream Pahe URL or link ID.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('/api/downloads/resolve', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ url: trimmed }),
    });
    const data = await res.json();
    if (data && typeof data.ok === 'boolean') {
      return data as ResolvedDownloadSource;
    }
    return {
      ok: false,
      inputUrl: rawInput,
      normalizedUrl: trimmed,
      resolvedUrl: null,
      directDownloadUrl: null,
      sourceProvider: 'nekostream-pahe',
      sourceHost: null,
      paheId: null,
      kwikFileId: null,
      fileName: null,
      adGateBypassed: false,
      requiresBrowserChallenge: false,
      hops: [],
      error: `Download resolver returned HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      inputUrl: rawInput,
      normalizedUrl: trimmed,
      resolvedUrl: null,
      directDownloadUrl: null,
      sourceProvider: 'nekostream-pahe',
      sourceHost: null,
      paheId: null,
      kwikFileId: null,
      fileName: null,
      adGateBypassed: false,
      requiresBrowserChallenge: false,
      hops: [],
      error:
        err?.name === 'AbortError'
          ? 'Timed out while tracing the download source.'
          : err?.message || 'Unable to reach download resolver endpoint.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function loadSavedEpisodeDownloads(): SavedEpisodeDownload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DOWNLOADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedEpisodeDownloads(list: SavedEpisodeDownload[]): SavedEpisodeDownload[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent(DOWNLOADS_UPDATED_EVENT));
    } catch {}
  }
  return list;
}

export function saveEpisodeDownload(
  entry: Omit<SavedEpisodeDownload, 'id' | 'savedAt'>
): SavedEpisodeDownload[] {
  const existing = loadSavedEpisodeDownloads();
  const dedupeKey = `${entry.animeId ?? 'custom'}:${entry.episode}:${entry.audio}:${entry.resolvedUrl}`;
  const filtered = existing.filter(
    (item) => `${item.animeId ?? 'custom'}:${item.episode}:${item.audio}:${item.resolvedUrl}` !== dedupeKey
  );
  const next: SavedEpisodeDownload = {
    ...entry,
    id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: Date.now(),
  };
  return persistSavedEpisodeDownloads([next, ...filtered].slice(0, 100));
}

export function removeSavedEpisodeDownload(id: string): SavedEpisodeDownload[] {
  const next = loadSavedEpisodeDownloads().filter((item) => item.id !== id);
  return persistSavedEpisodeDownloads(next);
}

export function openResolvedDownloadTarget(url: string): void {
  if (!url) return;
  if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
