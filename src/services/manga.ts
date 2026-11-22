import { MangaMedia, MangaChapter } from '../types/anime';
import { fetchAniListGraphQL } from './anilist';

export interface MangaQueryOptions {
  page?: number;
  perPage?: number;
  search?: string;
  genre?: string;
  sort?: 'TRENDING_DESC' | 'POPULARITY_DESC' | 'SCORE_DESC' | 'FAVOURITES_DESC' | 'UPDATED_AT_DESC';
  status?: string;
}

export const POPULAR_MANGA_CATALOG: MangaMedia[] = [
  {
    id: 30013,
    title: { english: 'One Piece', romaji: 'ONE PIECE', native: 'ワンピース' },
    coverImage: {
      large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30013-BeslEMqiPhlk.jpg',
      color: '#0a84ff',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/30013-s9F2gYk2U0iA.jpg',
    description: 'Gol D. Roger was known as the "Pirate King", the strongest and most infamous being to have sailed the Grand Line.',
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    chapters: null,
    volumes: null,
    status: 'RELEASING',
    format: 'MANGA',
    serialization: 'Weekly Shonen Jump',
    averageScore: 92,
    meanScore: 91,
    popularity: 285400,
    favourites: 64200,
    startDate: { year: 1997, month: 7, day: 22 },
    staff: [{ role: 'Story & Art', name: 'Eiichiro Oda', nativeName: '尾田栄一郎' }],
  },
  {
    id: 105778,
    title: { english: 'Chainsaw Man', romaji: 'Chainsaw Man', native: 'チェンソーマン' },
    coverImage: {
      large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105778-9M8iA8B7H1N3.jpg',
      color: '#e53935',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/105778-aU57vOwhaJ1A.jpg',
    description: 'Denji was a small-time devil hunter just trying to survive in a harsh world until revived with Pochita as Chainsaw Man.',
    genres: ['Action', 'Supernatural', 'Horror', 'Comedy'],
    chapters: null,
    volumes: 18,
    status: 'RELEASING',
    format: 'MANGA',
    serialization: 'Shonen Jump+',
    averageScore: 88,
    meanScore: 87,
    popularity: 242000,
    favourites: 41800,
    startDate: { year: 2018, month: 12, day: 3 },
    staff: [{ role: 'Story & Art', name: 'Tatsuki Fujimoto', nativeName: '藤本タツキ' }],
  },
  {
    id: 101517,
    title: { english: 'Jujutsu Kaisen', romaji: 'Jujutsu Kaisen', native: '呪術廻戦' },
    coverImage: {
      large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx101517-H2P8bWk0B7zY.jpg',
      color: '#7b1fa2',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/101517-T7p4t3U8f2.jpg',
    description: 'Yuji Itadori enters Tokyo Jujutsu High to exorcise curses after becoming the vessel of Ryomen Sukuna.',
    genres: ['Action', 'Supernatural', 'Dark Fantasy'],
    chapters: 271,
    volumes: 28,
    status: 'FINISHED',
    format: 'MANGA',
    serialization: 'Weekly Shonen Jump',
    averageScore: 86,
    meanScore: 85,
    popularity: 238000,
    favourites: 37500,
    startDate: { year: 2018, month: 3, day: 5 },
    staff: [{ role: 'Story & Art', name: 'Gege Akutami', nativeName: '芥見下々' }],
  },
  {
    id: 105398,
    title: { english: 'Solo Leveling', romaji: 'Na Honjaman Level Up', native: '나 혼자만 레벨업' },
    coverImage: {
      large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105398-b6VIgtF5Bup8.png',
      color: '#3949ab',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-842xL.jpg',
    description: 'Weakest hunter Sung Jinwoo awakens the mysterious System after surviving a double dungeon.',
    genres: ['Action', 'Fantasy', 'Adventure'],
    chapters: 179,
    volumes: 14,
    status: 'FINISHED',
    format: 'MANGA',
    serialization: 'KakaoPage',
    averageScore: 88,
    meanScore: 87,
    popularity: 260000,
    favourites: 44000,
    startDate: { year: 2018, month: 3, day: 4 },
    staff: [{ role: 'Art', name: 'DUBU (REDICE STUDIO)' }],
  },
  {
    id: 30002,
    title: { english: 'Berserk', romaji: 'Berserk', native: 'ベルセルク' },
    coverImage: {
      large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30002-79M9c9b1f.jpg',
      color: '#b71c1c',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/30002-v7A1N0vQ1w7P.jpg',
    description: 'Guts, the Black Swordsman, wanders a brutal dark fantasy realm marked by the Brand of Sacrifice.',
    genres: ['Action', 'Dark Fantasy', 'Horror', 'Drama'],
    chapters: null,
    volumes: 42,
    status: 'RELEASING',
    format: 'MANGA',
    serialization: 'Young Animal',
    averageScore: 94,
    meanScore: 93,
    popularity: 290000,
    favourites: 72000,
    startDate: { year: 1989, month: 8, day: 25 },
    staff: [{ role: 'Story & Art', name: 'Kentaro Miura', nativeName: '三浦建太郎' }],
  },
];

const MANGA_MEDIA_FRAGMENT = `
  id
  title {
    english
    romaji
    native
    userPreferred
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  description(asHtml: false)
  format
  status
  startDate { year month day }
  endDate { year month day }
  chapters
  volumes
  genres
  tags { name rank }
  averageScore
  meanScore
  popularity
  favourites
  staff(sort: [RELEVANCE], perPage: 3) {
    edges {
      role
      node {
        name { full native }
        image { medium }
      }
    }
  }
  characters(sort: [ROLE, RELEVANCE], perPage: 4) {
    edges {
      role
      node {
        id
        name { full native }
        image { medium }
      }
    }
  }
  relations {
    edges {
      relationType
      node {
        id
        type
        title { english romaji }
        format
        status
        coverImage { medium }
      }
    }
  }
`;

function mapAniListManga(m: any): MangaMedia {
  const safeSlug = (m.title?.english || m.title?.romaji || 'manga')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    id: m.id,
    title: {
      english: m.title?.english || m.title?.romaji || 'Untitled Manga',
      romaji: m.title?.romaji || m.title?.english || 'Untitled Manga',
      native: m.title?.native || null,
    },
    coverImage: {
      large: m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium,
      medium: m.coverImage?.medium,
      color: m.coverImage?.color || '#8b5cf6',
    },
    bannerImage: m.bannerImage || undefined,
    description: m.description,
    format: m.format,
    status: m.status,
    startDate: m.startDate,
    endDate: m.endDate,
    chapters: m.chapters ?? null,
    volumes: m.volumes ?? null,
    genres: Array.isArray(m.genres) ? m.genres : [],
    tags: m.tags?.slice(0, 5).map((t: any) => ({ name: t.name, rank: t.rank })) || [],
    averageScore: m.averageScore,
    meanScore: m.meanScore,
    popularity: m.popularity,
    favourites: m.favourites,
    staff:
      m.staff?.edges?.map((e: any) => ({
        role: e.role,
        name: e.node?.name?.full,
        nativeName: e.node?.name?.native,
        image: e.node?.image?.medium,
      })) || [],
    characters:
      m.characters?.edges?.map((e: any) => ({
        id: e.node?.id,
        name: e.node?.name?.full,
        nativeName: e.node?.name?.native,
        role: e.role,
        image: e.node?.image?.medium,
      })) || [],
    relations:
      m.relations?.edges?.map((e: any) => ({
        id: e.node?.id,
        type: e.node?.type,
        relationType: e.relationType,
        title: e.node?.title?.english || e.node?.title?.romaji,
        format: e.node?.format,
        status: e.node?.status,
        coverImage: e.node?.coverImage?.medium,
      })) || [],
    mangapillSlug: safeSlug,
  };
}

export async function fetchMangaCatalog(options: MangaQueryOptions = {}): Promise<{
  items: MangaMedia[];
  isOfflineFallback: boolean;
  error?: string;
}> {
  const {
    page = 1,
    perPage = 24,
    search,
    genre,
    sort = 'TRENDING_DESC',
    status,
  } = options;

  try {
    const query = `
      query ($page: Int, $perPage: Int, $search: String, $genre: String, $sort: [MediaSort], $status: MediaStatus) {
        Page(page: $page, perPage: $perPage) {
          media(type: MANGA, search: $search, genre: $genre, sort: $sort, status: $status, isAdult: false) {
            ${MANGA_MEDIA_FRAGMENT}
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      page,
      perPage,
      sort: [sort],
    };
    if (search && search.trim()) variables.search = search.trim();
    if (genre && genre !== 'ALL') variables.genre = genre;
    if (status && status !== 'ALL') variables.status = status;

    const data = await fetchAniListGraphQL(query, variables);
    const rawList = data?.Page?.media || [];
    return {
      items: rawList.map(mapAniListManga),
      isOfflineFallback: false,
    };
  } catch (err: any) {
    // Offline fallback strictly applies status, genre, search, AND sort filters!
    const filtered = POPULAR_MANGA_CATALOG.filter((m) => {
      const matchesGenre = !genre || genre === 'ALL' || m.genres.includes(genre);
      const matchesStatus = !status || status === 'ALL' || m.status === status;
      const matchesSearch =
        !search ||
        (m.title.english || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.title.romaji || '').toLowerCase().includes(search.toLowerCase());
      return matchesGenre && matchesStatus && matchesSearch;
    }).sort((a, b) => {
      if (sort === 'SCORE_DESC') return (b.averageScore || 0) - (a.averageScore || 0);
      if (sort === 'FAVOURITES_DESC') return (b.favourites || 0) - (a.favourites || 0);
      return (b.popularity || 0) - (a.popularity || 0);
    });

    return {
      items: filtered,
      isOfflineFallback: true,
      error: err?.message || 'AniList Manga API unreachable; showing limited offline catalog.',
    };
  }
}

/**
 * Fetches rich manga details strictly by numeric AniList Media ID (fixes old search: String(id) bug).
 */
export async function fetchMangaDetails(id: number): Promise<MangaMedia | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: MANGA) {
          ${MANGA_MEDIA_FRAGMENT}
        }
      }
    `;
    const data = await fetchAniListGraphQL(query, { id });
    if (data?.Media) {
      return mapAniListManga(data.Media);
    }
  } catch {
    // fall through
  }
  return POPULAR_MANGA_CATALOG.find(m => m.id === id) || null;
}

const MAX_CHAPTER_CACHE = 80;
const CHAPTER_LIST_CACHE = new Map<string, { chapters: MangaChapter[]; source: string }>();
const CHAPTER_PAGES_CACHE = new Map<string, { pages: string[]; directUrl?: string; total: number; source: string }>();

export async function fetchRealMangaChapters(manga: MangaMedia): Promise<{
  chapters: MangaChapter[];
  source: string;
  error?: string;
}> {
  const title = manga.title.english || manga.title.romaji;
  const altTitle =
    manga.title.romaji && manga.title.romaji !== title ? manga.title.romaji : undefined;
  const cacheKey = `${manga.id}:${title.toLowerCase()}`;
  const cached = CHAPTER_LIST_CACHE.get(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const altParam = altTitle ? `&altTitle=${encodeURIComponent(altTitle)}` : '';
      const res = await fetch(`/api/manga/chapters?title=${encodeURIComponent(title)}${altParam}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        return {
          chapters: [],
          source: 'none',
          error: `Chapter server returned HTTP ${res.status}`,
        };
      }
      const data = await res.json();
      const chapters: MangaChapter[] = Array.isArray(data?.chapters) ? data.chapters : [];
      if (chapters.length === 0) {
        return {
          chapters: [],
          source: data?.source || 'none',
          error: data?.errors?.join(' | ') || `No verified chapters found for "${title}" on Honey or Sol.`,
        };
      }

      if (CHAPTER_LIST_CACHE.size >= MAX_CHAPTER_CACHE) {
        const oldest = CHAPTER_LIST_CACHE.keys().next().value;
        if (oldest) CHAPTER_LIST_CACHE.delete(oldest);
      }
      const entry = { chapters, source: data.source || 'mangadex' };
      CHAPTER_LIST_CACHE.set(cacheKey, entry);
      return entry;
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    return {
      chapters: [],
      source: 'none',
      error: err?.message || 'Network error while fetching manga chapter list.',
    };
  }
}

export async function fetchRealChapterPages(
  manga: MangaMedia,
  chapter: MangaChapter
): Promise<{
  success: boolean;
  pages: string[];
  directUrl?: string;
  total: number;
  source?: string;
  error?: string;
}> {
  const title = manga.title.english || manga.title.romaji;
  const altTitle =
    manga.title.romaji && manga.title.romaji !== title ? manga.title.romaji : undefined;
  const chNum = String(chapter.chapterNumber || '1');
  const cacheKey = `${manga.id}:${chapter.id}:${chNum}`;

  const cached = CHAPTER_PAGES_CACHE.get(cacheKey);
  if (cached) {
    return { success: true, ...cached };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 16000);
    try {
      const altParam = altTitle ? `&altTitle=${encodeURIComponent(altTitle)}` : '';
      const url = `/api/manga/chapter-pages?title=${encodeURIComponent(title)}${altParam}&chapter=${encodeURIComponent(chNum)}&chapterId=${encodeURIComponent(chapter.id)}&source=${encodeURIComponent(chapter.source || '')}`;
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && Array.isArray(data.pages) && data.pages.length > 0) {
        if (CHAPTER_PAGES_CACHE.size >= MAX_CHAPTER_CACHE) {
          const oldest = CHAPTER_PAGES_CACHE.keys().next().value;
          if (oldest) CHAPTER_PAGES_CACHE.delete(oldest);
        }
        const entry = {
          pages: data.pages as string[],
          directUrl: data.directUrl as string | undefined,
          total: data.pages.length,
          source: (data.source as string) || 'mangadex',
        };
        CHAPTER_PAGES_CACHE.set(cacheKey, entry);
        return { success: true, ...entry };
      }

      return {
        success: false,
        pages: [],
        directUrl: data?.directUrl || chapter.externalUrl,
        total: 0,
        error: data?.error || `Chapter ${chNum} pages could not be resolved from upstream servers.`,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    return {
      success: false,
      pages: [],
      directUrl: chapter.externalUrl,
      total: 0,
      error: err?.message || 'Failed to connect to Manga reader API.',
    };
  }
}
