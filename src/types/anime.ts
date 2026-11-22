export interface AnimeTitle {
  romaji: string;
  english?: string | null;
  native?: string | null;
}

export interface AnimeCoverImage {
  extraLarge?: string;
  large?: string;
  medium?: string;
  color?: string | null;
}

export interface AnimeTrailer {
  id?: string | null;
  site?: string | null;
  thumbnail?: string | null;
}

export interface AnimeStudioNode {
  name: string;
}

export interface AnimeCharacter {
  node: {
    id: number;
    name: {
      full: string;
      native?: string | null;
    };
    image?: {
      medium?: string;
      large?: string;
    };
  };
  role: string;
  voiceActors?: Array<{
    name: {
      full: string;
    };
    image?: {
      medium?: string;
    };
    language?: string;
  }>;
}

export interface AnimeRecommendation {
  mediaRecommendation?: {
    id: number;
    title: AnimeTitle;
    coverImage: AnimeCoverImage;
    bannerImage?: string | null;
    averageScore?: number | null;
    format?: string;
    episodes?: number | null;
  };
}

export interface AnimeRelation {
  relationType: string;
  node: {
    id: number;
    title: AnimeTitle;
    coverImage: AnimeCoverImage;
    format?: string;
    status?: string;
    type?: string;
  };
}

export interface AnimeMedia {
  id: number;
  idMal?: number | null;
  title: AnimeTitle;
  coverImage: AnimeCoverImage;
  bannerImage?: string | null;
  description?: string | null;
  episodes?: number | null;
  duration?: number | null;
  genres: string[];
  averageScore?: number | null;
  popularity?: number;
  season?: string | null;
  seasonYear?: number | null;
  status?: string;
  format?: string;
  nextAiringEpisode?: {
    episode: number;
    timeUntilAiring: number;
  } | null;
  trailer?: AnimeTrailer | null;
  studios?: {
    nodes: AnimeStudioNode[];
  };
  characters?: {
    edges: AnimeCharacter[];
  };
  recommendations?: {
    nodes: AnimeRecommendation[];
  };
  relations?: {
    edges: AnimeRelation[];
  };
}

export type WatchStatus = 'watching' | 'plan_to_watch' | 'completed' | 'on_hold' | 'dropped';

export interface WatchlistEntry {
  anime: AnimeMedia;
  status: WatchStatus;
  currentEpisode: number;
  totalEpisodes: number;
  episodesUnknown?: boolean;
  progressPercent: number;
  currentTimeSec?: number;
  durationSec?: number;
  isFavorite: boolean;
  updatedAt: number;
}

export interface FilterState {
  search: string;
  genre: string;
  format: string;
  status: string;
  seasonYear: string;
}

export type NavTab = 'home' | 'trending' | 'popular' | 'browse' | 'watchlist' | 'manga' | 'watchparty';

export interface MangaStaff {
  role: string;
  name: string;
  nativeName?: string;
  image?: string;
}

export interface MangaCharacterDetail {
  id: number;
  name: string;
  nativeName?: string;
  role: string;
  image: string;
}

export interface MangaRelation {
  id: number;
  type: string;
  relationType: string;
  title: string;
  coverImage?: string;
  format?: string;
  status?: string;
}

export interface MangaMedia {
  id: number;
  title: AnimeTitle;
  coverImage: AnimeCoverImage;
  bannerImage?: string | null;
  description?: string | null;
  chapters?: number | null;
  volumes?: number | null;
  genres: string[];
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  status?: string;
  format?: string;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  };
  endDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  };
  serialization?: string;
  tags?: { name: string; rank: number }[];
  staff?: MangaStaff[];
  characters?: MangaCharacterDetail[];
  relations?: MangaRelation[];
  mangapillId?: string;
  mangapillSlug?: string;
}

export interface MangaChapter {
  id: string;
  title: string;
  chapterNumber: number | string;
  url?: string;
  externalUrl?: string;
  releaseDate?: string;
  source?: 'mangadex' | 'mangapill' | 'weebcentral' | 'none';
}

export interface UserStats {
  watchHours: number;
  episodesWatched: number;
  mangaChaptersRead: number;
  completedAnime: number;
  currentStreakDays: number;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  favoriteGenres: string[];
}

export interface UserBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: string;
}

export interface AnimeCharacterProfile {
  id: string;
  name: string;
  nativeName: string;
  series: string;
  role: string;
  epithet: string;
  voiceActor: string;
  bountyOrPower: string;
  quote: string;
  url: string;
}

export type PreferredServerType = 'anixo' | 'animeembed' | 'megaplay-mal' | 'zokoanime';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  banner?: string;
  bio?: string;
  favoriteAnime?: string;
  createdAt: number;
  isGoogleVerified: boolean;
  isCloudSynced?: boolean;
  googleId?: string;
  joinedDate?: string;
  preferredAudio?: 'sub' | 'dub';
  preferredServer?: PreferredServerType;
  stats?: UserStats;
  badges?: UserBadge[];
  activeCharacter?: AnimeCharacterProfile;
}

export interface WatchPartyMessage {
  id: string;
  senderName: string;
  senderAvatar: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  current: number;
  target: number;
  claimed: boolean;
  category: 'watch' | 'manga' | 'party' | 'social';
  dateKey?: string;
}

export interface WatchPartyReaction {
  id: string;
  emoji: string;
  senderName: string;
  senderAvatar: string;
  timestamp: number;
}

export interface WatchPartyParticipant {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: number;
  pingMs?: number;
}

export interface WatchPartyRoomState {
  roomId: string;
  roomName: string;
  hostId: string;
  hostName: string;
  anime: AnimeMedia;
  episode: number;
  server: PreferredServerType;
  audio: 'sub' | 'dub';
  isPlaying: boolean;
  timestamp: number;
  seekTime?: number;
  lastAction?: string;
  participants?: WatchPartyParticipant[];
}

declare global {
  interface Window {
    electronAPI?: {
      isWindowsDesktop: boolean;
      platform: string;
      version: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      setDiscordPresence: (details: Record<string, any>) => void;
      openExternal: (url: string) => void;
      getSystemSpecs: () => Record<string, string>;
    };
  }
}
