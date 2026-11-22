import { z } from 'zod';
import { AnimeMedia, DailyQuest, WatchlistEntry } from '../types/anime';

export const ALLOWED_PLAYER_ORIGINS = new Set<string>([
  'https://anixo.buzz',
  'https://animeembed.com',
  'https://megaplay.buzz',
  'https://zokoanime.video',
  'https://www.youtube.com',
  'https://youtube.com',
]);

export const StreamingServerSchema = z.enum([
  'anixo',
  'animeembed',
  'megaplay-mal',
  'zokoanime',
]);

export const AudioTrackSchema = z.enum(['sub', 'dub']);

export const WatchStatusSchema = z.enum([
  'watching',
  'plan_to_watch',
  'completed',
  'on_hold',
  'dropped',
]);

export const AnimeMediaSchema = z.object({
  id: z.number().int().positive(),
  idMal: z.number().int().positive().nullable().optional(),
  title: z.object({
    romaji: z.string().min(1).max(300),
    english: z.string().max(300).nullable().optional(),
    native: z.string().max(300).nullable().optional(),
  }),
  coverImage: z.object({
    extraLarge: z.string().max(600).optional(),
    large: z.string().max(600).optional(),
    medium: z.string().max(600).optional(),
    color: z.string().max(32).nullable().optional(),
  }).default({}),
  bannerImage: z.string().max(600).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  episodes: z.number().int().nonnegative().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  genres: z.array(z.string().max(64)).max(30).default([]),
  averageScore: z.number().min(0).max(100).nullable().optional(),
  popularity: z.number().nonnegative().optional(),
  season: z.string().max(32).nullable().optional(),
  seasonYear: z.number().int().nullable().optional(),
  status: z.string().max(32).optional(),
  format: z.string().max(32).optional(),
  nextAiringEpisode: z.object({
    episode: z.number().int().positive(),
    timeUntilAiring: z.number().int(),
  }).nullable().optional(),
  trailer: z.object({
    id: z.string().max(128).nullable().optional(),
    site: z.string().max(64).nullable().optional(),
    thumbnail: z.string().max(600).nullable().optional(),
  }).nullable().optional(),
});

export const WatchlistEntrySchema = z.object({
  anime: AnimeMediaSchema,
  status: WatchStatusSchema,
  currentEpisode: z.number().int().min(0).max(10000),
  totalEpisodes: z.number().int().min(0).max(10000),
  episodesUnknown: z.boolean().optional(),
  progressPercent: z.number().min(0).max(100),
  currentTimeSec: z.number().min(0).max(86400).optional(),
  durationSec: z.number().min(0).max(86400).optional(),
  isFavorite: z.boolean(),
  updatedAt: z.number().nonnegative(),
});

export const WatchlistImportSchema = z.array(WatchlistEntrySchema).max(2000);

export function validateAndParseWatchlistImport(rawJson: string): {
  ok: true;
  entries: WatchlistEntry[];
} | {
  ok: false;
  error: string;
} {
  if (!rawJson || rawJson.length > 5 * 1024 * 1024) {
    return { ok: false, error: 'Import file is empty or exceeds 5 MB limit.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax.' };
  }

  const result = WatchlistImportSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue?.path?.join('.') || 'root';
    return {
      ok: false,
      error: `Invalid watchlist schema at "${path}": ${firstIssue?.message || 'validation failed'}`,
    };
  }

  // Deduplicate by anime.id keeping the most recently updated entry
  const dedupedMap = new Map<number, WatchlistEntry>();
  for (const item of result.data) {
    const existing = dedupedMap.get(item.anime.id);
    if (!existing || item.updatedAt > existing.updatedAt) {
      dedupedMap.set(item.anime.id, {
        ...item,
        anime: item.anime as AnimeMedia,
      });
    }
  }

  return { ok: true, entries: Array.from(dedupedMap.values()) };
}

export const PlayerMessageSchema = z.object({
  type: z.enum(['ended', 'timeupdate', 'play', 'pause', 'ready', 'error', 'seeked']),
  data: z.object({
    currentTime: z.number().min(0).max(86400).optional(),
    duration: z.number().min(0).max(86400).optional(),
    episode: z.number().int().positive().max(10000).optional(),
    status: z.string().max(64).optional(),
    message: z.string().max(300).optional(),
  }).optional(),
});

export type VerifiedPlayerMessage = z.infer<typeof PlayerMessageSchema>;

export function parseVerifiedPlayerMessage(
  event: MessageEvent,
  expectedWindow: Window | null | undefined,
  allowedOrigins: Set<string> = ALLOWED_PLAYER_ORIGINS
): VerifiedPlayerMessage | null {
  if (!event.origin || !allowedOrigins.has(event.origin)) {
    return null;
  }

  if (expectedWindow && event.source && event.source !== expectedWindow) {
    return null;
  }

  let raw: unknown = event.data;
  if (typeof raw === 'string') {
    if (raw.length > 8192) return null;
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  // Support both { type, data } and direct { event, currentTime, duration } player shapes
  const candidate = raw as Record<string, unknown>;
  const normalizedType =
    typeof candidate.type === 'string'
      ? candidate.type
      : typeof candidate.event === 'string'
      ? candidate.event
      : null;

  if (!normalizedType) return null;

  const normalizedPayload = {
    type: normalizedType,
    data:
      typeof candidate.data === 'object' && candidate.data !== null
        ? candidate.data
        : {
            currentTime: typeof candidate.currentTime === 'number' ? candidate.currentTime : undefined,
            duration: typeof candidate.duration === 'number' ? candidate.duration : undefined,
            episode: typeof candidate.episode === 'number' ? candidate.episode : undefined,
          },
  };

  const parsed = PlayerMessageSchema.safeParse(normalizedPayload);
  return parsed.success ? parsed.data : null;
}

export function getUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function createFreshDailyQuests(dateKey: string = getUtcDateKey()): DailyQuest[] {
  return [
    {
      id: 'quest-watch-2',
      title: 'Binge Apprentice',
      description: 'Stream 2 anime episodes cleanly',
      xpReward: 100,
      current: 0,
      target: 2,
      claimed: false,
      category: 'watch',
      dateKey,
    },
    {
      id: 'quest-manga-3',
      title: 'Manga Scholar',
      description: 'Read 3 manga chapters in the reader',
      xpReward: 80,
      current: 0,
      target: 3,
      claimed: false,
      category: 'manga',
      dateKey,
    },
    {
      id: 'quest-party-react',
      title: 'Watch Party Energy',
      description: 'Join or host a live Watch Party and participate',
      xpReward: 60,
      current: 0,
      target: 1,
      claimed: false,
      category: 'party',
      dateKey,
    },
    {
      id: 'quest-watchlist-add',
      title: 'Curator',
      description: 'Add an anime to your personal watchlist',
      xpReward: 40,
      current: 0,
      target: 1,
      claimed: false,
      category: 'social',
      dateKey,
    },
  ];
}

export function computeEpisodeMetadata(anime: AnimeMedia): {
  totalEpisodes: number | null;
  episodesUnknown: boolean;
  isMovie: boolean;
  displayTotalLabel: string;
} {
  const format = (anime.format || '').toUpperCase();
  const isMovie = format === 'MOVIE';

  if (isMovie) {
    return {
      totalEpisodes: 1,
      episodesUnknown: false,
      isMovie: true,
      displayTotalLabel: 'Movie',
    };
  }

  if (typeof anime.episodes === 'number' && anime.episodes > 0) {
    return {
      totalEpisodes: anime.episodes,
      episodesUnknown: false,
      isMovie: false,
      displayTotalLabel: String(anime.episodes),
    };
  }

  // If ongoing with nextAiringEpisode, use aired episode estimate (never hardcode 12!)
  if (anime.nextAiringEpisode && anime.nextAiringEpisode.episode > 1) {
    const airedEstimate = anime.nextAiringEpisode.episode - 1;
    return {
      totalEpisodes: airedEstimate,
      episodesUnknown: true,
      isMovie: false,
      displayTotalLabel: `${airedEstimate}+`,
    };
  }

  return {
    totalEpisodes: null,
    episodesUnknown: true,
    isMovie: false,
    displayTotalLabel: 'Ongoing',
  };
}
