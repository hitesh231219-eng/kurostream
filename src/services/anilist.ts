import { AnimeMedia } from '../types/anime';
import { cleanHtmlDescription } from '../utils/text';

const ANILIST_DIRECT_URL = 'https://graphql.anilist.co';
const MAX_CACHE_ENTRIES = 120;
const CACHE_TTL_MS = 5 * 60 * 1000;

const queryCache = new Map<string, { data: any; expiresAt: number }>();
const inflightRequests = new Map<string, Promise<any>>();

function getCachedQuery(key: string): any | undefined {
  const hit = queryCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    queryCache.delete(key);
    return undefined;
  }
  queryCache.delete(key);
  queryCache.set(key, hit);
  return hit.data;
}

function setCachedQuery(key: string, data: any): void {
  if (queryCache.has(key)) {
    queryCache.delete(key);
  } else if (queryCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export class AniListServiceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'AniListServiceError';
  }
}

async function postGraphQLWithTimeout(
  url: string,
  query: string,
  variables: Record<string, any>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAniListGraphQL(
  query: string,
  variables: Record<string, any> = {}
): Promise<any> {
  const cacheKey = JSON.stringify({ query, variables });
  const cached = getCachedQuery(cacheKey);
  if (cached) return cached;

  const existing = inflightRequests.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    // Prefer server-side cached /api/anilist proxy first; fall back to direct AniList if static hosting
    const endpoints = ['/api/anilist', ANILIST_DIRECT_URL];
    let lastError: unknown;

    for (const endpoint of endpoints) {
      try {
        const res = await postGraphQLWithTimeout(endpoint, query, variables, 8500);
        if (!res.ok) {
          // If local serverless function is absent (404), try direct upstream
          if (endpoint === '/api/anilist' && res.status === 404) {
            continue;
          }
          throw new AniListServiceError(
            `AniList request failed (${res.status} ${res.statusText})`,
            res.status
          );
        }
        const json = await res.json();
        if (!json?.data) {
          throw new AniListServiceError(
            json?.errors?.[0]?.message || 'AniList returned an empty payload'
          );
        }
        setCachedQuery(cacheKey, json.data);
        return json.data;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AniListServiceError('Unable to reach AniList metadata service');
  })().finally(() => {
    inflightRequests.delete(cacheKey);
  });

  inflightRequests.set(cacheKey, promise);
  return promise;
}

const MEDIA_BASE_FRAGMENT = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  description(asHtml: false)
  episodes
  duration
  genres
  averageScore
  popularity
  season
  seasonYear
  status
  format
  nextAiringEpisode {
    episode
    timeUntilAiring
  }
  trailer {
    id
    site
  }
`;

function sanitizeMedia(media: any): AnimeMedia {
  return {
    ...media,
    genres: Array.isArray(media.genres) ? media.genres : [],
    description: cleanHtmlDescription(media.description),
    title: {
      romaji: media.title?.romaji || 'Untitled Anime',
      english: media.title?.english || media.title?.romaji || 'Untitled Anime',
      native: media.title?.native || null,
    },
    coverImage: media.coverImage || {},
  };
}

export async function getTrendingAnime(page: number = 1, perPage: number = 16): Promise<AnimeMedia[]> {
  try {
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC], isAdult: false) {
            ${MEDIA_BASE_FRAGMENT}
          }
        }
      }
    `;
    const res = await fetchAniListGraphQL(query, { page, perPage });
    const list = res?.Page?.media;
    if (Array.isArray(list) && list.length > 0) {
      return list.map(sanitizeMedia);
    }
    return FALLBACK_ANIME_LIST;
  } catch {
    return FALLBACK_ANIME_LIST;
  }
}

export async function getPopularAnime(page: number = 1, perPage: number = 16): Promise<AnimeMedia[]> {
  try {
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: [POPULARITY_DESC], isAdult: false) {
            ${MEDIA_BASE_FRAGMENT}
          }
        }
      }
    `;
    const res = await fetchAniListGraphQL(query, { page, perPage });
    const list = res?.Page?.media;
    if (Array.isArray(list) && list.length > 0) {
      return list.map(sanitizeMedia);
    }
    return FALLBACK_ANIME_LIST;
  } catch {
    return FALLBACK_ANIME_LIST;
  }
}

export async function getTopRatedAnime(page: number = 1, perPage: number = 16): Promise<AnimeMedia[]> {
  try {
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: [SCORE_DESC], isAdult: false, format_in: [TV, MOVIE]) {
            ${MEDIA_BASE_FRAGMENT}
          }
        }
      }
    `;
    const res = await fetchAniListGraphQL(query, { page, perPage });
    const list = res?.Page?.media;
    if (Array.isArray(list) && list.length > 0) {
      return list.map(sanitizeMedia);
    }
    return FALLBACK_ANIME_LIST;
  } catch {
    return FALLBACK_ANIME_LIST;
  }
}

export async function getAnimeByGenre(genre: string, page: number = 1, perPage: number = 16): Promise<AnimeMedia[]> {
  try {
    const query = `
      query ($genre: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, genre: $genre, sort: [POPULARITY_DESC], isAdult: false) {
            ${MEDIA_BASE_FRAGMENT}
          }
        }
      }
    `;
    const res = await fetchAniListGraphQL(query, { genre, page, perPage });
    const list = res?.Page?.media;
    if (Array.isArray(list) && list.length > 0) {
      return list.map(sanitizeMedia);
    }
    return FALLBACK_ANIME_LIST.filter(a => a.genres?.includes(genre));
  } catch {
    return FALLBACK_ANIME_LIST.filter(a => a.genres?.includes(genre));
  }
}

export async function searchAndFilterAnime(params: {
  search?: string;
  genre?: string;
  format?: string;
  status?: string;
  seasonYear?: number;
  sort?: string;
  page?: number;
  perPage?: number;
}): Promise<{ media: AnimeMedia[]; hasNextPage: boolean; isOfflineFallback?: boolean; error?: string }> {
  try {
    const {
      search,
      genre,
      format,
      status,
      seasonYear,
      sort = 'POPULARITY_DESC',
      page = 1,
      perPage = 24,
    } = params;

    const query = `
      query ($search: String, $genre: String, $format: MediaFormat, $status: MediaStatus, $seasonYear: Int, $sort: [MediaSort], $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            hasNextPage
            total
          }
          media(
            type: ANIME,
            search: $search,
            genre: $genre,
            format: $format,
            status: $status,
            seasonYear: $seasonYear,
            sort: $sort,
            isAdult: false
          ) {
            ${MEDIA_BASE_FRAGMENT}
          }
        }
      }
    `;

    const variables: Record<string, any> = { page, perPage };
    if (search && search.trim()) variables.search = search.trim();
    if (genre && genre !== 'ALL') variables.genre = genre;
    if (format && format !== 'ALL') variables.format = format;
    if (status && status !== 'ALL') variables.status = status;
    if (seasonYear) variables.seasonYear = seasonYear;

    let sortValues: string[] = ['POPULARITY_DESC'];
    if (sort === 'SCORE_DESC') sortValues = ['SCORE_DESC'];
    else if (sort === 'TRENDING_DESC') sortValues = ['TRENDING_DESC', 'POPULARITY_DESC'];
    else if (sort === 'START_DATE_DESC') sortValues = ['START_DATE_DESC'];
    else if (sort === 'TITLE_ROMAJI') sortValues = ['TITLE_ROMAJI'];
    variables.sort = sortValues;

    const res = await fetchAniListGraphQL(query, variables);
    const mediaList = res?.Page?.media || [];
    return {
      media: mediaList.map(sanitizeMedia),
      hasNextPage: Boolean(res?.Page?.pageInfo?.hasNextPage),
      isOfflineFallback: false,
    };
  } catch (err: any) {
    const searchLow = (params.search || '').toLowerCase().trim();
    const filtered = FALLBACK_ANIME_LIST.filter(a => {
      const matchSearch =
        !searchLow ||
        a.title.romaji.toLowerCase().includes(searchLow) ||
        (a.title.english && a.title.english.toLowerCase().includes(searchLow));
      const matchGenre = !params.genre || params.genre === 'ALL' || a.genres.includes(params.genre);
      const matchFormat = !params.format || params.format === 'ALL' || a.format === params.format;
      const matchStatus = !params.status || params.status === 'ALL' || a.status === params.status;
      return matchSearch && matchGenre && matchFormat && matchStatus;
    });
    return {
      media: filtered.map(sanitizeMedia),
      hasNextPage: false,
      isOfflineFallback: true,
      error: err?.message || 'AniList offline; showing cached sample catalog',
    };
  }
}

export async function getAnimeDetails(id: number): Promise<AnimeMedia | null> {
  try {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          ${MEDIA_BASE_FRAGMENT}
          studios(isMain: true) {
            nodes {
              name
            }
          }
          characters(sort: [ROLE, RELEVANCE], perPage: 8) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                }
                image {
                  medium
                  large
                }
              }
              voiceActors(language: JAPANESE, sort: [RELEVANCE]) {
                name {
                  full
                }
                image {
                  medium
                }
                language
              }
            }
          }
          recommendations(sort: [RATING_DESC], perPage: 6) {
            nodes {
              mediaRecommendation {
                id
                title {
                  romaji
                  english
                }
                coverImage {
                  large
                }
                averageScore
                format
                episodes
              }
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                title {
                  romaji
                  english
                }
                coverImage {
                  medium
                }
                format
                status
              }
            }
          }
        }
      }
    `;

    const res = await fetchAniListGraphQL(query, { id });
    if (res?.Media) {
      return sanitizeMedia(res.Media);
    }
    const fallback = FALLBACK_ANIME_LIST.find(a => a.id === id);
    return fallback ? sanitizeMedia(fallback) : null;
  } catch {
    const fallback = FALLBACK_ANIME_LIST.find(a => a.id === id);
    return fallback ? sanitizeMedia(fallback) : null;
  }
}

export const GENRE_LIST = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

export const FALLBACK_ANIME_LIST: AnimeMedia[] = [
  {
    id: 154587,
    idMal: 52991,
    title: {
      romaji: 'Sousou no Frieren',
      english: 'Frieren: Beyond Journey\'s End',
      native: '葬送のフリーレン',
    },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-U22qnRfOzrSQ.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587-U22qnRfOzrSQ.jpg',
      color: '#43a6d9',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-0bBmgdEt88z1.jpg',
    description: 'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about. The elf mage Frieren and her courageous fellow adventurers have defeated the Demon King and brought peace to the land.',
    episodes: 28,
    duration: 24,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    averageScore: 92,
    popularity: 380000,
    season: 'FALL',
    seasonYear: 2023,
    status: 'FINISHED',
    format: 'TV',
    trailer: { id: 'qgQunxD0qLk', site: 'youtube' },
    studios: { nodes: [{ name: 'Madhouse' }] },
  },
  {
    id: 151807,
    idMal: 52299,
    title: {
      romaji: 'Ore dake Level Up na Ken',
      english: 'Solo Leveling',
      native: '俺だけレベルアップな件',
    },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-g17vLwE66qH6.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx151807-g17vLwE66qH6.jpg',
      color: '#5c6fe4',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-2vP6P2K7L888.jpg',
    description: 'They say whatever doesn’t kill you makes you stronger, but that’s not the case for the world’s weakest hunter Sung Jinwoo.',
    episodes: 12,
    duration: 24,
    genres: ['Action', 'Adventure', 'Fantasy'],
    averageScore: 84,
    popularity: 420000,
    season: 'WINTER',
    seasonYear: 2024,
    status: 'FINISHED',
    format: 'TV',
    trailer: { id: '91t0HAkdZas', site: 'youtube' },
    studios: { nodes: [{ name: 'A-1 Pictures' }] },
  },
  {
    id: 145064,
    idMal: 51009,
    title: {
      romaji: 'Jujutsu Kaisen 2nd Season',
      english: 'Jujutsu Kaisen Season 2',
      native: '呪術廻戦 懐玉・玉折／渋谷事変',
    },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-7Oca8jA5q49O.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx145064-7Oca8jA5q49O.jpg',
      color: '#0d67d8',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/145064-0Nl2k8q6kFj7.jpg',
    description: 'The past comes to light when second-year students Satoru Gojo and Suguru Geto are tasked with escorting the Star Plasma Vessel.',
    episodes: 23,
    duration: 24,
    genres: ['Action', 'Fantasy', 'Supernatural'],
    averageScore: 88,
    popularity: 510000,
    season: 'SUMMER',
    seasonYear: 2023,
    status: 'FINISHED',
    format: 'TV',
    trailer: { id: 'O6qVieflwqs', site: 'youtube' },
    studios: { nodes: [{ name: 'MAPPA' }] },
  },
  {
    id: 16498,
    idMal: 16498,
    title: {
      romaji: 'Shingeki no Kyojin',
      english: 'Attack on Titan',
      native: '進撃の巨人',
    },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx16498-C6FPmWm59CyP.jpg',
      color: '#e45f35',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFfDggpHJy.jpg',
    description: 'Centuries ago, mankind was slaughtered to near extinction by monstrous humanoid creatures called Titans.',
    episodes: 25,
    duration: 24,
    genres: ['Action', 'Drama', 'Fantasy', 'Mystery'],
    averageScore: 86,
    popularity: 780000,
    season: 'SPRING',
    seasonYear: 2013,
    status: 'FINISHED',
    format: 'TV',
    trailer: { id: 'LHtdKWJgio4', site: 'youtube' },
    studios: { nodes: [{ name: 'WIT Studio' }] },
  },
  {
    id: 101922,
    idMal: 38000,
    title: {
      romaji: 'Kimetsu no Yaiba',
      english: 'Demon Slayer: Kimetsu no Yaiba',
      native: '鬼滅の刃',
    },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTDYxFly.png',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx101922-PEn1CTDYxFly.png',
      color: '#dc2626',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-WBsBl0ClmgYL.jpg',
    description: 'Ever since the death of his father, the burden of supporting the family has fallen upon Tanjirou Kamado.',
    episodes: 26,
    duration: 24,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy', 'Supernatural'],
    averageScore: 84,
    popularity: 720000,
    season: 'SPRING',
    seasonYear: 2019,
    status: 'FINISHED',
    format: 'TV',
    trailer: { id: '6vMuWuWlW4I', site: 'youtube' },
    studios: { nodes: [{ name: 'ufotable' }] },
  },
  {
    id: 127230,
    idMal: 44511,
    title: {
      romaji: 'Chainsaw Man',
      english: 'Chainsaw Man',
      native: 'チェンソーマン',
    },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FloCoGoBhZSZ.png',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx127230-FloCoGoBhZSZ.png',
      color: '#f97316',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/127230-kJnI5om2d7wR.jpg',
    description: 'Denji is robbed of a normal teenage life, left with nothing but his deceased father’s overwhelming debt.',
    episodes: 12,
    duration: 24,
    genres: ['Action', 'Comedy', 'Drama', 'Horror', 'Supernatural'],
    averageScore: 84,
    popularity: 580000,
    season: 'FALL',
    seasonYear: 2022,
    status: 'FINISHED',
    format: 'TV',
    trailer: { id: 'jk7Q4nnpq-E', site: 'youtube' },
    studios: { nodes: [{ name: 'MAPPA' }] },
  },
  {
    id: 21,
    idMal: 21,
    title: {
      romaji: 'ONE PIECE',
      english: 'ONE PIECE',
      native: 'ONE PIECE',
    },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkAxFn.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx21-YCDoj1EkAxFn.jpg',
      color: '#eab308',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJ5A0b.jpg',
    description: 'Gold Roger was known as the "Pirate King," the strongest and most infamous being to have sailed the Grand Line.',
    episodes: null,
    duration: 24,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    averageScore: 88,
    popularity: 810000,
    season: 'FALL',
    seasonYear: 1999,
    status: 'RELEASING',
    format: 'TV',
    trailer: { id: 'MCb13lbKmM8', site: 'youtube' },
    studios: { nodes: [{ name: 'Toei Animation' }] },
  },
];
