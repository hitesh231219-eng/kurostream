import { BoundedTtlCache } from './security';

export type MangaSourceId = 'mangadex' | 'mangapill' | 'weebcentral';

export interface ResolvedChapter {
  id: string;
  chapterNumber: string;
  title: string;
  volume?: string | null;
  pages?: number;
  releaseDate: string;
  source: MangaSourceId;
  externalUrl: string;
}

export interface ChapterPagesResult {
  success: boolean;
  pages: string[];
  rawPages: string[];
  chapterTitle: string;
  directUrl: string;
  source: MangaSourceId | 'unavailable';
  total: number;
  error?: string;
}

const chapterListCache = new BoundedTtlCache<ResolvedChapter[]>(250, 10 * 60 * 1000);
const chapterPagesCache = new BoundedTtlCache<ChapterPagesResult>(400, 15 * 60 * 1000);
const inflightPages = new Map<string, Promise<ChapterPagesResult>>();

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&#0?39;|&#x27;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&times;/gi, ' x ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
    });
}

export function normalizeMangaTitle(title: string): string {
  return decodeBasicEntities(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00d7/g, ' x ')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEAVY_SPINOFF_MARKERS = [
  'doujinshi',
  'anthology',
  'parody',
  'fanbook',
  '4 koma',
  '4koma',
  'spinoff',
  'spin off',
  'guidebook',
  'ultra analysis',
  'character guide',
  'school briefs',
  'buddy stories',
  'gaiden',
  'illustration',
  'one shot',
  'oneshot',
];

const EDITION_MARKERS = [
  'official comic',
  'fan colored',
  'digital colored',
  'colored comics',
  'book version',
  'light novel',
  'novel',
  'side b',
  'b side',
  'relax',
];

export function computeTitleSimilarity(queryTitle: string, candidateTitle: string): number {
  const rawCandidate = decodeBasicEntities(candidateTitle).trim();
  const nonSpaceChars = rawCandidate.replace(/\s+/g, '');
  const asciiAlphaNum = rawCandidate.replace(/[^a-zA-Z0-9.,:;!?'"()\-/\u00d7[\]【】~&+#]/g, '');
  const asciiRatio = nonSpaceChars.length > 0 ? asciiAlphaNum.length / nonSpaceChars.length : 1;

  // Reject non-Latin script alt-titles (e.g., Thai/Arabic/Russian) when querying in Latin characters
  if (/[a-z]/i.test(queryTitle) && asciiRatio < 0.65) {
    return 0;
  }

  const a = normalizeMangaTitle(queryTitle);
  const b = normalizeMangaTitle(candidateTitle);
  if (!a || !b) return 0;
  if (a === b) return 1.0;

  const aTokens = new Set(a.split(' '));
  const bTokens = new Set(b.split(' '));
  let intersection = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) intersection++;
  }
  if (intersection === 0) return 0;

  const union = new Set([...aTokens, ...bTokens]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  const containment = aTokens.size > 0 ? intersection / aTokens.size : 0;

  let score = jaccard * 0.55 + containment * 0.45;

  // Strongly penalize spin-offs / doujinshi / anthologies / guidebooks unless explicitly searched
  let penalized = false;
  for (const marker of HEAVY_SPINOFF_MARKERS) {
    if (b.includes(marker) && !a.includes(marker)) {
      score -= 0.4;
      penalized = true;
      break;
    }
  }
  if (!penalized) {
    for (const marker of EDITION_MARKERS) {
      if (b.includes(marker) && !a.includes(marker)) {
        score -= 0.16;
        break;
      }
    }
  }

  return Math.max(0, Math.min(0.99, score));
}

export function buildSearchVariants(title: string, altTitle?: string): {
  primary: string[];
  fallbacks: string[];
} {
  const seenPrimary = new Set<string>();
  const seenAnyRaw = new Set<string>();
  const primary: string[] = [];
  const fallbacks: string[] = [];

  const pushPrimary = (raw?: string) => {
    const cleaned = decodeBasicEntities(raw || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return;
    const norm = normalizeMangaTitle(cleaned);
    if (!norm || seenPrimary.has(norm)) return;
    seenPrimary.add(norm);
    seenAnyRaw.add(cleaned.toLowerCase());
    primary.push(cleaned);
  };

  const pushFallback = (raw?: string) => {
    const cleaned = decodeBasicEntities(raw || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return;
    const rawKey = cleaned.toLowerCase();
    if (seenAnyRaw.has(rawKey)) return;
    seenAnyRaw.add(rawKey);
    fallbacks.push(cleaned);
  };

  pushPrimary(title);
  pushPrimary(altTitle);

  for (const base of [...primary]) {
    // Bracket stripping: "【Oshi no Ko】" -> "Oshi no Ko"
    const noBrackets = base
      .replace(/[\[\]【】()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    pushFallback(noBrackets);

    // Replace Unicode multiplication sign with ASCII ' x ' for upstream search engines
    const asciiX = noBrackets.replace(/\u00d7/g, ' x ').replace(/\s+/g, ' ').trim();
    pushFallback(asciiX);

    // Subtitle split on ":" or " - " (e.g., "Demon Slayer: Kimetsu no Yaiba", "Re:ZERO -Starting Life...")
    const colonParts = noBrackets.split(/\s*:\s+/);
    if (colonParts.length >= 2) {
      if (colonParts[0].trim().length >= 4) pushFallback(colonParts[0].trim());
      if (colonParts.slice(1).join(': ').trim().length >= 4) {
        pushFallback(colonParts.slice(1).join(': ').trim());
      }
    }
    const dashParts = noBrackets.split(/\s+-\s*|-\s+/);
    if (dashParts.length >= 2 && dashParts[0].trim().length >= 4) {
      pushFallback(dashParts[0].trim());
    }
  }

  return {
    primary: primary.slice(0, 2),
    fallbacks: fallbacks.slice(0, 4),
  };
}

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts: number = 3,
  timeoutMs: number = 7500
): Promise<Response> {
  const isMangaDex = url.includes('api.mangadex.org');
  const defaultUa = isMangaDex
    ? 'KuroStream/2.0 (+https://kurostream.app)'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            'User-Agent': defaultUa,
            Accept: isMangaDex
              ? 'application/json'
              : 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
            ...(init.headers || {}),
          },
        });
        if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
          const retryAfter = Number(res.headers.get('retry-after') || 0);
          const delayMs = retryAfter > 0 && retryAfter <= 3 ? retryAfter * 1000 : 450 * (i + 1);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        return res;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Upstream request failed');
}

function getAllTitleVariants(titles: Record<string, any> | Array<Record<string, string>>): string[] {
  const out: string[] = [];
  if (Array.isArray(titles)) {
    for (const item of titles) {
      if (item && typeof item === 'object') {
        for (const v of Object.values(item)) {
          if (typeof v === 'string') out.push(v);
        }
      }
    }
  } else if (titles && typeof titles === 'object') {
    for (const v of Object.values(titles)) {
      if (typeof v === 'string') out.push(v);
    }
  }
  return out;
}

export async function findMangaDexCandidatesByTitle(
  title: string,
  scoreAgainstTitles: string[] = [title]
): Promise<Array<{ id: string; matchedTitle: string; score: number }>> {
  const searchUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(
    title
  )}&availableTranslatedLanguage[]=en&limit=15&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&order[relevance]=desc`;
  const res = await fetchWithRetry(searchUrl);
  if (!res.ok) {
    throw new Error(`Honey search failed with HTTP ${res.status}`);
  }
  const json = await res.json();
  const candidates = Array.isArray(json?.data) ? json.data : [];

  const ranked: Array<{ id: string; matchedTitle: string; score: number }> = [];
  for (const item of candidates) {
    const attrs = item?.attributes;
    if (!attrs) continue;
    const allTitles = [
      ...getAllTitleVariants(attrs.title),
      ...getAllTitleVariants(attrs.altTitles),
    ];
    let bestForItem: { id: string; matchedTitle: string; score: number } | null = null;
    for (const candidateTitle of allTitles) {
      for (const queryVariant of scoreAgainstTitles) {
        const score = computeTitleSimilarity(queryVariant, candidateTitle);
        if (!bestForItem || score > bestForItem.score) {
          bestForItem = { id: item.id, matchedTitle: candidateTitle, score };
        }
      }
    }
    if (bestForItem && bestForItem.score >= 0.45) {
      ranked.push(bestForItem);
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

export async function findMangaDexIdByTitle(title: string): Promise<{ id: string; matchedTitle: string } | null> {
  const ranked = await findMangaDexCandidatesByTitle(title);
  if (ranked.length === 0) return null;
  return { id: ranked[0].id, matchedTitle: ranked[0].matchedTitle };
}

function parseMangaDexFeedRows(rows: any[]): ResolvedChapter[] {
  const seenChapters = new Set<string>();
  const chapters: ResolvedChapter[] = [];

  for (const ch of rows) {
    const attr = ch.attributes || {};
    const chNum = attr.chapter ? String(attr.chapter) : '0';
    if (attr.externalUrl) continue;
    if (!attr.pages || attr.pages <= 0) continue;
    if (seenChapters.has(chNum)) continue;
    seenChapters.add(chNum);

    const published = attr.publishAt || attr.readableAt || attr.createdAt;
    const releaseDate = published ? new Date(published).toISOString().slice(0, 10) : 'Verified';

    chapters.push({
      id: ch.id,
      chapterNumber: chNum,
      title: attr.title ? `Ch. ${chNum}: ${attr.title}` : `Chapter ${chNum}`,
      volume: attr.volume || null,
      pages: attr.pages,
      releaseDate,
      source: 'mangadex',
      externalUrl: `https://mangadex.org/chapter/${ch.id}`,
    });
  }

  chapters.sort((a, b) => parseFloat(b.chapterNumber) - parseFloat(a.chapterNumber));
  return chapters;
}

export async function fetchMangaDexChapters(
  title: string,
  scoreAgainstTitles: string[] = [title]
): Promise<ResolvedChapter[]> {
  const candidates = await findMangaDexCandidatesByTitle(title, scoreAgainstTitles);
  if (candidates.length === 0) return [];

  let fallbackChapters: ResolvedChapter[] = [];
  for (const match of candidates.slice(0, 3)) {
    const feedUrl = `https://api.mangadex.org/manga/${match.id}/feed?translatedLanguage[]=en&limit=500&order[chapter]=desc&includeEmptyPages=0&includeExternalUrl=0`;
    const res = await fetchWithRetry(feedUrl);
    if (!res.ok) {
      if (match === candidates[0]) {
        throw new Error(`Honey feed failed with HTTP ${res.status}`);
      }
      continue;
    }
    const json = await res.json();
    let rows: any[] = Array.isArray(json?.data) ? json.data : [];

    // Fetch a second page if the series has >500 English feed rows
    const total = Number(json?.total || rows.length);
    if (rows.length === 500 && total > 500) {
      try {
        const res2 = await fetchWithRetry(
          `https://api.mangadex.org/manga/${match.id}/feed?translatedLanguage[]=en&limit=500&offset=500&order[chapter]=desc&includeEmptyPages=0&includeExternalUrl=0`
        );
        if (res2.ok) {
          const json2 = await res2.json();
          if (Array.isArray(json2?.data)) {
            rows = [...rows, ...json2.data];
          }
        }
      } catch {
        // keep first 500 rows cleanly
      }
    }

    const parsed = parseMangaDexFeedRows(rows);
    if (parsed.length >= 5) {
      return parsed;
    }
    if (parsed.length > fallbackChapters.length) {
      fallbackChapters = parsed;
    }
  }

  return fallbackChapters;
}

export async function fetchMangaDexChapterPages(
  chapterId: string,
  directUrl: string,
  chapterTitle: string
): Promise<ChapterPagesResult> {
  const res = await fetchWithRetry(`https://api.mangadex.org/at-home/server/${encodeURIComponent(chapterId)}`);
  if (!res.ok) {
    throw new Error(`Honey at-home returned HTTP ${res.status}`);
  }
  const data = await res.json();
  const baseUrl = data?.baseUrl;
  const hash = data?.chapter?.hash;
  const fullFiles: string[] = Array.isArray(data?.chapter?.data) ? data.chapter.data : [];
  const saverFiles: string[] = Array.isArray(data?.chapter?.dataSaver) ? data.chapter.dataSaver : [];

  const useSaver = fullFiles.length === 0 && saverFiles.length > 0;
  const files = useSaver ? saverFiles : fullFiles;
  const folder = useSaver ? 'data-saver' : 'data';

  if (!baseUrl || !hash || files.length === 0) {
    return {
      success: false,
      pages: [],
      rawPages: [],
      chapterTitle,
      directUrl,
      source: 'unavailable',
      total: 0,
      error: 'Chapter has no image files available on Honey',
    };
  }

  const rawPages = files.map((f) => `${baseUrl}/${folder}/${hash}/${f}`);
  const pages = rawPages.map((p) => `/api/manga-proxy?url=${encodeURIComponent(p)}`);

  return {
    success: true,
    pages,
    rawPages,
    chapterTitle,
    directUrl,
    source: 'mangadex',
    total: pages.length,
  };
}

export interface MangaPillCandidate {
  id: string;
  slug: string;
  title: string;
  titles?: string[];
}

export function parseMangaPillSearchResults(html: string): MangaPillCandidate[] {
  const byId = new Map<string, MangaPillCandidate>();
  const regex = /<a[^>]*href="\/manga\/([0-9]+)\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    const slug = match[2];
    const withNewlines = match[3]
      .replace(/<\/?(?:div|span|p|br|h[1-6]|li)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    const segments = withNewlines
      .split(/\n+/)
      .map((s) => decodeBasicEntities(s).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const mergedText = segments.join(' ').trim();
    const fallbackSlugTitle = slug.replace(/-/g, ' ');

    const existing = byId.get(id);
    if (!existing) {
      const titles = Array.from(new Set([...segments, mergedText, fallbackSlugTitle].filter(Boolean)));
      byId.set(id, {
        id,
        slug,
        title: mergedText || fallbackSlugTitle,
        titles,
      });
    } else {
      const mergedTitles = Array.from(
        new Set([...(existing.titles || [existing.title]), ...segments, mergedText, fallbackSlugTitle].filter(Boolean))
      );
      if (mergedText && (!existing.title || existing.title === fallbackSlugTitle)) {
        existing.title = mergedText;
      }
      existing.titles = mergedTitles;
    }
  }

  return Array.from(byId.values());
}

export function parseMangaPillChapters(html: string): ResolvedChapter[] {
  const regex = /href="\/chapters\/([0-9]+-[0-9]+)\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const chapters: ResolvedChapter[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const id = m[1];
    const slug = m[2];
    const label = decodeBasicEntities(m[3]).trim();
    if (seen.has(id)) continue;
    seen.add(id);

    // Match explicit "Chapter N" or URL slug "chapter-N" before bare digits (avoids "Group 2 Chapter 203" -> "2")
    const numMatch =
      label.match(/chapter\s*(\d+(?:\.\d+)?)/i) ||
      slug.match(/chapter-(\d+(?:-\d+)?)/i) ||
      label.match(/(\d+(?:\.\d+)?)/);
    const chNum = numMatch ? numMatch[1].replace('-', '.') : label;

    chapters.push({
      id,
      chapterNumber: chNum,
      title: label,
      releaseDate: 'Sol',
      source: 'mangapill',
      externalUrl: `https://mangapill.com/chapters/${id}/${slug}`,
    });
  }
  chapters.sort((a, b) => {
    const na = parseFloat(a.chapterNumber);
    const nb = parseFloat(b.chapterNumber);
    if (Number.isNaN(na) || Number.isNaN(nb)) return 0;
    return nb - na;
  });
  return chapters;
}

export async function fetchMangaPillChapters(
  title: string,
  scoreAgainstTitles: string[] = [title]
): Promise<ResolvedChapter[]> {
  const sRes = await fetchWithRetry(`https://mangapill.com/search?q=${encodeURIComponent(title)}`);
  if (!sRes.ok) {
    throw new Error(`Sol search returned HTTP ${sRes.status}`);
  }
  const sHtml = await sRes.text();
  const candidates = parseMangaPillSearchResults(sHtml);

  const ranked: Array<{ id: string; slug: string; score: number }> = [];
  for (const c of candidates) {
    const candidateTexts = c.titles && c.titles.length > 0 ? c.titles : [c.title, c.slug.replace(/-/g, ' ')];
    let bestScore = 0;
    for (const cText of candidateTexts) {
      for (const qText of scoreAgainstTitles) {
        bestScore = Math.max(bestScore, computeTitleSimilarity(qText, cText));
      }
    }
    if (bestScore >= 0.45) {
      ranked.push({ id: c.id, slug: c.slug, score: bestScore });
    }
  }

  if (ranked.length === 0) return [];
  ranked.sort((a, b) => b.score - a.score);

  let fallbackChapters: ResolvedChapter[] = [];
  for (const cand of ranked.slice(0, 3)) {
    try {
      const mRes = await fetchWithRetry(`https://mangapill.com/manga/${cand.id}/${cand.slug}`);
      if (!mRes.ok) continue;
      const mHtml = await mRes.text();
      const parsed = parseMangaPillChapters(mHtml);
      if (parsed.length >= 5) return parsed;
      if (parsed.length > fallbackChapters.length) {
        fallbackChapters = parsed;
      }
    } catch {
      // try next candidate
    }
  }

  return fallbackChapters;
}

export interface WeebCentralCandidate {
  id: string;
  slug: string;
  titles: string[];
}

export function parseWeebCentralSearchResults(html: string): WeebCentralCandidate[] {
  const byId = new Map<string, WeebCentralCandidate>();
  const regex = /<a[^>]*href="(?:https:\/\/weebcentral\.com)?\/series\/([A-Z0-9]+)\/([^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    const slug = match[2];
    const slugTitle = slug.replace(/-/g, ' ');
    const withNewlines = match[3]
      .replace(/<\/?(?:div|span|p|br|h[1-6]|li)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    const segments = withNewlines
      .split(/\n+/)
      .map((s) => decodeBasicEntities(s).replace(/\s+/g, ' ').trim())
      .map((s) => s.replace(/^official\s+/i, '').trim())
      .filter((s) => s && s.toLowerCase() !== 'official');

    const altMatch = match[3].match(/alt="([^"]+?)\s+cover"/i);
    if (altMatch?.[1]) {
      segments.push(decodeBasicEntities(altMatch[1]).trim());
    }

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        id,
        slug,
        titles: Array.from(new Set([...segments, slugTitle].filter(Boolean))),
      });
    } else {
      existing.titles = Array.from(new Set([...existing.titles, ...segments, slugTitle].filter(Boolean)));
    }
  }

  return Array.from(byId.values());
}

export function parseWeebCentralChapters(html: string): ResolvedChapter[] {
  const regex = /<a[^>]*href="(?:https:\/\/weebcentral\.com)?\/chapters\/([A-Z0-9]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const parsedRows: Array<ResolvedChapter & { sortKey: number; seasonNum: number }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  let maxSeason = 0;

  while ((m = regex.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);

    const inner = m[2];
    // Prefer the bare label <span class="">Chapter N</span>, fallback to stripped first line
    const labelSpan = inner.match(/<span[^>]*class=""[^>]*>([\s\S]*?)<\/span>/i);
    const cleaned = decodeBasicEntities(
      (labelSpan ? labelSpan[1] : inner)
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
    const label = cleaned.replace(/\s*Last Read.*$/i, '').trim();
    if (!label) continue;

    const seasonMatch = label.match(/(?:^|\b)s(?:eason)?\s*(\d+)\s*[-:]\s*(?:chapter|ch\.?|episode|ep\.?)?\s*(\d+(?:\.\d+)?)/i);
    let seasonNum = 0;
    let rawChNum = '';
    if (seasonMatch) {
      seasonNum = Number(seasonMatch[1]);
      rawChNum = seasonMatch[2];
      if (seasonNum > maxSeason) maxSeason = seasonNum;
    } else {
      const numMatch =
        label.match(/(?:chapter|ch\.?|episode|ep\.?)\s*(\d+(?:\.\d+)?)/i) ||
        label.match(/(\d+(?:\.\d+)?)/);
      rawChNum = numMatch ? numMatch[1] : label;
    }

    const numericPart = parseFloat(rawChNum);
    const sortKey = Number.isNaN(numericPart) ? -1 : seasonNum * 100000 + numericPart;

    parsedRows.push({
      id,
      chapterNumber: seasonNum > 0 ? `S${seasonNum}-${rawChNum}` : rawChNum,
      title: label,
      releaseDate: 'Sol',
      source: 'weebcentral',
      externalUrl: `https://weebcentral.com/chapters/${id}`,
      sortKey,
      seasonNum,
    });
  }

  // Only keep season prefix if multiple seasons exist, or keep clean format
  if (maxSeason > 0) {
    parsedRows.sort((a, b) => b.sortKey - a.sortKey);
  } else {
    parsedRows.sort((a, b) => {
      if (a.sortKey < 0 || b.sortKey < 0) return 0;
      return b.sortKey - a.sortKey;
    });
  }

  return parsedRows.map(({ sortKey: _s, seasonNum: _sn, ...rest }) => rest);
}

export async function fetchWeebCentralChapters(
  title: string,
  scoreAgainstTitles: string[] = [title]
): Promise<ResolvedChapter[]> {
  const searchUrl = `https://weebcentral.com/search/data?text=${encodeURIComponent(
    title
  )}&sort=Best%20Match&order=Ascending&official=Any&anime=Any&adult=Any&display_mode=Full%20Display`;
  const sRes = await fetchWithRetry(searchUrl);
  if (!sRes.ok) {
    throw new Error(`Sol Mirror search returned HTTP ${sRes.status}`);
  }
  const sHtml = await sRes.text();
  const candidates = parseWeebCentralSearchResults(sHtml);

  const ranked: Array<{ id: string; slug: string; score: number }> = [];
  for (const c of candidates) {
    let bestScore = 0;
    for (const cText of c.titles) {
      for (const qText of scoreAgainstTitles) {
        bestScore = Math.max(bestScore, computeTitleSimilarity(qText, cText));
      }
    }
    if (bestScore >= 0.45) {
      ranked.push({ id: c.id, slug: c.slug, score: bestScore });
    }
  }

  if (ranked.length === 0) return [];
  ranked.sort((a, b) => b.score - a.score);

  let fallbackChapters: ResolvedChapter[] = [];
  for (const cand of ranked.slice(0, 3)) {
    try {
      const chRes = await fetchWithRetry(`https://weebcentral.com/series/${cand.id}/full-chapter-list`);
      if (!chRes.ok) continue;
      const chHtml = await chRes.text();
      const parsed = parseWeebCentralChapters(chHtml);
      if (parsed.length >= 5) return parsed;
      if (parsed.length > fallbackChapters.length) {
        fallbackChapters = parsed;
      }
    } catch {
      // try next candidate
    }
  }

  return fallbackChapters;
}

function chapterRunMetrics(chapters: ResolvedChapter[]) {
  if (chapters.length === 0) {
    return { count: 0, minNum: Infinity, maxNum: -1, hasEarlyChapter: false, avgPages: 0, hasRecentStubs: false };
  }
  const numericValues: number[] = [];
  let hasSeasonZeroOrOne = false;
  for (const c of chapters) {
    const chStr = String(c.chapterNumber);
    if (/^S1-(?:0|1|2)(?:\.|$)/i.test(chStr)) {
      hasSeasonZeroOrOne = true;
    }
    const stripped = chStr.replace(/^S\d+-/i, '');
    const n = parseFloat(stripped);
    if (!Number.isNaN(n)) numericValues.push(n);
  }
  const minNum = numericValues.length > 0 ? Math.min(...numericValues) : Infinity;
  const maxNum = numericValues.length > 0 ? Math.max(...numericValues) : -1;
  const hasEarlyChapter = hasSeasonZeroOrOne || minNum <= 2;
  const isHoney = chapters[0]?.source === 'mangadex';
  const avgPages = isHoney
    ? chapters.reduce((sum, c) => sum + (c.pages || 0), 0) / Math.max(1, chapters.length)
    : 15;
  const hasRecentStubs = isHoney ? chapters.slice(0, 5).some((c) => (c.pages || 0) <= 2) : false;

  return { count: chapters.length, minNum, maxNum, hasEarlyChapter, avgPages, hasRecentStubs };
}

function selectBestChapterRun(
  mdChapters: ResolvedChapter[],
  mpChapters: ResolvedChapter[],
  wcChapters: ResolvedChapter[]
): { chapters: ResolvedChapter[]; source: MangaSourceId | 'none' } {
  const mdMeta = chapterRunMetrics(mdChapters);
  const mpMeta = chapterRunMetrics(mpChapters);
  const wcMeta = chapterRunMetrics(wcChapters);

  // Pick the fuller / earlier-starting Sol-side mirror (MangaPill vs WeebCentral)
  let bestMirror: ResolvedChapter[] = [];
  if (mpMeta.count > 0 || wcMeta.count > 0) {
    if (mpMeta.count === 0) {
      bestMirror = wcChapters;
    } else if (wcMeta.count === 0) {
      bestMirror = mpChapters;
    } else if (wcMeta.hasEarlyChapter && !mpMeta.hasEarlyChapter && wcMeta.count >= mpMeta.count * 0.6) {
      bestMirror = wcChapters;
    } else if (mpMeta.hasEarlyChapter && !wcMeta.hasEarlyChapter && mpMeta.count >= wcMeta.count * 0.6) {
      bestMirror = mpChapters;
    } else if (wcMeta.count > Math.ceil(mpMeta.count * 1.1)) {
      bestMirror = wcChapters;
    } else {
      bestMirror = mpChapters;
    }
  }

  const mirrorMeta = chapterRunMetrics(bestMirror);

  if (mdMeta.count === 0 && mirrorMeta.count === 0) {
    return { chapters: [], source: 'none' };
  }
  if (mdMeta.count === 0) {
    return { chapters: bestMirror, source: bestMirror[0].source };
  }
  if (mirrorMeta.count === 0) {
    return { chapters: mdChapters, source: 'mangadex' };
  }

  // Prefer mirror if Honey is stubbed, missing Chapter 1 while mirror has Chapter 1, or mirror has noticeably more chapters
  const mirrorFixesMissingEarly = !mdMeta.hasEarlyChapter && mirrorMeta.hasEarlyChapter && mirrorMeta.count >= mdMeta.count * 0.5;
  const mirrorSignificantlyFuller = mirrorMeta.count > Math.ceil(mdMeta.count * 1.12);
  const mirrorFixesStubsOrLowPages =
    mdMeta.avgPages < 5 || (mdMeta.hasRecentStubs && mirrorMeta.count >= mdMeta.count);
  const honeyCappedWithFullerMirror = mdMeta.count >= 245 && mirrorMeta.count >= mdMeta.count;

  if (mirrorFixesMissingEarly || mirrorSignificantlyFuller || mirrorFixesStubsOrLowPages || honeyCappedWithFullerMirror) {
    return { chapters: bestMirror, source: bestMirror[0].source };
  }

  return { chapters: mdChapters, source: 'mangadex' };
}

export async function resolveMangaChapters(
  title: string,
  altTitle?: string
): Promise<{
  chapters: ResolvedChapter[];
  source: MangaSourceId | 'none';
  errors: string[];
}> {
  const { primary, fallbacks } = buildSearchVariants(title, altTitle);
  const scoreAgainst = Array.from(new Set([...primary, ...fallbacks]));
  const key = `chlist:${primary.map(normalizeMangaTitle).join('|')}`;
  const errors: string[] = [];

  const cached = chapterListCache.get(key);
  if (cached && cached.length > 0) {
    return {
      chapters: cached,
      source: cached[0]?.source || 'none',
      errors,
    };
  }

  let bestMd: ResolvedChapter[] = [];
  let bestMp: ResolvedChapter[] = [];
  let bestWc: ResolvedChapter[] = [];

  const runSingleQuery = async (qTitle: string, onlySparse: boolean) => {
    const tasks: Array<Promise<void>> = [];

    if (!onlySparse || bestMd.length < 10) {
      tasks.push(
        fetchMangaDexChapters(qTitle, scoreAgainst)
          .then((list) => {
            if (list.length > bestMd.length) bestMd = list;
          })
          .catch((err: any) => {
            errors.push(`Honey(${qTitle}): ${err?.message || 'failed'}`);
          })
      );
    }
    if (!onlySparse || bestMp.length < 10) {
      tasks.push(
        fetchMangaPillChapters(qTitle, scoreAgainst)
          .then((list) => {
            if (list.length > bestMp.length) bestMp = list;
          })
          .catch((err: any) => {
            errors.push(`Sol(${qTitle}): ${err?.message || 'failed'}`);
          })
      );
    }
    if (!onlySparse || bestWc.length < 10) {
      tasks.push(
        fetchWeebCentralChapters(qTitle, scoreAgainst)
          .then((list) => {
            if (list.length > bestWc.length) bestWc = list;
          })
          .catch((err: any) => {
            errors.push(`Mirror(${qTitle}): ${err?.message || 'failed'}`);
          })
      );
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  };

  // Pass 1: Search primary title across all 3 providers in parallel
  if (primary[0]) {
    await runSingleQuery(primary[0], false);
  }
  // Query altTitle only for providers that returned sparse/empty results
  if (primary[1]) {
    await runSingleQuery(primary[1], true);
  }

  let selected = selectBestChapterRun(bestMd, bestMp, bestWc);

  // Pass 2: If best run is still empty or ultra-sparse (< 5 chapters), try cleaned/subtitle fallbacks
  if (selected.chapters.length < 5 && fallbacks.length > 0) {
    for (const fbTitle of fallbacks.slice(0, 2)) {
      await runSingleQuery(fbTitle, true);
      selected = selectBestChapterRun(bestMd, bestMp, bestWc);
      if (selected.chapters.length >= 10) break;
    }
  }

  if (selected.chapters.length > 0) {
    chapterListCache.set(key, selected.chapters);
  }

  return {
    chapters: selected.chapters,
    source: selected.source,
    errors,
  };
}

function normalizeImageUrl(rawUrl: string): string | null {
  const cleaned = decodeBasicEntities(rawUrl).trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('//')) return `https:${cleaned}`;
  if (cleaned.startsWith('https://')) return cleaned;
  return null;
}

async function fetchSolPagesFromChapter(exactChapter: ResolvedChapter): Promise<ChapterPagesResult | null> {
  const chRes = await fetchWithRetry(exactChapter.externalUrl);
  if (!chRes.ok) {
    throw new Error(`Sol chapter returned HTTP ${chRes.status}`);
  }
  const chHtml = await chRes.text();
  const rawMatches = [
    ...Array.from(chHtml.matchAll(/data-src="([^"]+)"/gi)).map((m) => m[1]),
    ...Array.from(chHtml.matchAll(/data-lazy-src="([^"]+)"/gi)).map((m) => m[1]),
  ];
  const imgFallback =
    rawMatches.length > 0
      ? rawMatches
      : Array.from(chHtml.matchAll(/<img[^>]*src="((?:https?:)?\/\/[^"]*\/mangap\/[^"]+)"/gi)).map((m) => m[1]);

  const normalized = imgFallback.map(normalizeImageUrl).filter((u): u is string => Boolean(u));
  if (normalized.length === 0) return null;

  return {
    success: true,
    pages: normalized.map((p) => `/api/manga-proxy?url=${encodeURIComponent(p)}`),
    rawPages: normalized,
    chapterTitle: exactChapter.title,
    directUrl: exactChapter.externalUrl,
    source: 'mangapill',
    total: normalized.length,
  };
}

async function fetchWeebCentralPagesFromChapter(exactChapter: ResolvedChapter): Promise<ChapterPagesResult | null> {
  const url = `https://weebcentral.com/chapters/${encodeURIComponent(
    exactChapter.id
  )}/images?is_prev=False&current_page=1&reading_style=long_strip`;
  const pgRes = await fetchWithRetry(url);
  if (!pgRes.ok) {
    throw new Error(`Sol Mirror chapter returned HTTP ${pgRes.status}`);
  }
  const pgHtml = await pgRes.text();
  const candidates = [
    ...Array.from(pgHtml.matchAll(/<img[\s\S]*?\bsrc="([^"]+)"/gi)).map((m) => m[1]),
    ...Array.from(pgHtml.matchAll(/data-src="([^"]+)"/gi)).map((m) => m[1]),
  ];
  const normalized = candidates
    .map(normalizeImageUrl)
    .filter((u): u is string => Boolean(u))
    .filter((u) => !u.includes('/static/') && !u.includes('broken_image') && !u.includes('avatar'));

  const unique = Array.from(new Set(normalized));
  if (unique.length === 0) return null;

  return {
    success: true,
    pages: unique.map((p) => `/api/manga-proxy?url=${encodeURIComponent(p)}`),
    rawPages: unique,
    chapterTitle: exactChapter.title,
    directUrl: exactChapter.externalUrl,
    source: 'weebcentral',
    total: unique.length,
  };
}

function findMatchingChapter(chapters: ResolvedChapter[], cleanTarget: string, chapterId?: string): ResolvedChapter | undefined {
  if (chapterId) {
    const byId = chapters.find((c) => c.id === chapterId);
    if (byId) return byId;
  }
  const exact = chapters.find((c) => String(c.chapterNumber).trim().toLowerCase() === cleanTarget);
  if (exact) return exact;
  // Support season-prefixed matches like "1" -> "S1-1"
  return chapters.find((c) => String(c.chapterNumber).trim().toLowerCase().endsWith(`-${cleanTarget}`));
}

export async function resolveChapterPages(params: {
  title: string;
  altTitle?: string;
  chapter: string;
  chapterId?: string;
  source?: string;
}): Promise<ChapterPagesResult> {
  const { title, altTitle, chapter, chapterId, source } = params;
  const cacheKey = `pages:${normalizeMangaTitle(title)}:${chapter}:${chapterId || ''}`;

  const cached = chapterPagesCache.get(cacheKey);
  if (cached && cached.success && cached.total > 0) {
    return cached;
  }
  const existingInflight = inflightPages.get(cacheKey);
  if (existingInflight) {
    return existingInflight;
  }

  const task = (async (): Promise<ChapterPagesResult> => {
    const searchUrl = `https://mangapill.com/search?q=${encodeURIComponent(title)}`;
    const cleanTarget = String(chapter).trim().toLowerCase();
    let stubFallback: ChapterPagesResult | null = null;

    // 1. Direct lookup if chapterId & source are already supplied
    if (source === 'weebcentral' && chapterId) {
      try {
        const res = await fetchWeebCentralPagesFromChapter({
          id: chapterId,
          chapterNumber: chapter,
          title: `Chapter ${chapter}`,
          releaseDate: 'Sol',
          source: 'weebcentral',
          externalUrl: `https://weebcentral.com/chapters/${chapterId}`,
        });
        if (res && res.success && res.total > 2) return res;
        if (res && res.success && res.total > 0) stubFallback = res;
      } catch {
        // fall through
      }
    }

    if (source === 'mangadex' && chapterId) {
      try {
        const res = await fetchMangaDexChapterPages(
          chapterId,
          `https://mangadex.org/chapter/${chapterId}`,
          `Chapter ${chapter}`
        );
        if (res.success && res.total > 2) return res;
        if (res.success && res.total > 0) stubFallback = res;
      } catch {
        // fall through
      }
    }

    if (source === 'mangapill' && chapterId && /^[0-9]+-[0-9]+$/.test(chapterId)) {
      const directory = await resolveMangaChapters(title, altTitle).catch(() => ({
        chapters: [] as ResolvedChapter[],
        source: 'none' as const,
        errors: [],
      }));
      const match = directory.chapters.find((c) => c.id === chapterId);
      if (match) {
        try {
          const solRes = await fetchSolPagesFromChapter(match);
          if (solRes && solRes.total > 2) return solRes;
          if (solRes && solRes.total > (stubFallback?.total || 0)) stubFallback = solRes;
        } catch {
          // fall through
        }
      }
    }

    // 2. Resolve against directory + cross-mirror failover
    try {
      const directory = await resolveMangaChapters(title, altTitle);
      const exactChapter = findMatchingChapter(directory.chapters, cleanTarget, chapterId);

      if (exactChapter) {
        if (exactChapter.source === 'mangadex') {
          try {
            const mdRes = await fetchMangaDexChapterPages(
              exactChapter.id,
              exactChapter.externalUrl,
              exactChapter.title
            );
            if (mdRes.success && mdRes.total > 2) return mdRes;
            if (mdRes.success && mdRes.total > (stubFallback?.total || 0)) stubFallback = mdRes;
          } catch {
            // fall through
          }
        } else if (exactChapter.source === 'weebcentral') {
          try {
            const wcRes = await fetchWeebCentralPagesFromChapter(exactChapter);
            if (wcRes && wcRes.total > 2) return wcRes;
            if (wcRes && wcRes.total > (stubFallback?.total || 0)) stubFallback = wcRes;
          } catch {
            // fall through
          }
        } else {
          const candidates = [
            exactChapter,
            ...directory.chapters.filter(
              (c) => c.id !== exactChapter.id && String(c.chapterNumber).trim().toLowerCase() === cleanTarget
            ),
          ];
          for (const candidate of candidates) {
            try {
              const solRes = await fetchSolPagesFromChapter(candidate);
              if (solRes && solRes.total > 2) return solRes;
              if (solRes && solRes.total > (stubFallback?.total || 0)) stubFallback = solRes;
            } catch {
              // try next scan group
            }
          }
        }
      }

      // 3. Cross-mirror failover (MangaPill -> WeebCentral -> Honey) for stubs/failures
      const { primary } = buildSearchVariants(title, altTitle);
      for (const qTitle of primary) {
        try {
          const mpList = await fetchMangaPillChapters(qTitle, primary);
          const mpMatch = findMatchingChapter(mpList, cleanTarget);
          if (mpMatch) {
            const solRes = await fetchSolPagesFromChapter(mpMatch);
            if (solRes && solRes.total > (stubFallback?.total || 0)) {
              if (solRes.total > 2) return solRes;
              stubFallback = solRes;
            }
          }
        } catch {
          // continue
        }

        try {
          const wcList = await fetchWeebCentralChapters(qTitle, primary);
          const wcMatch = findMatchingChapter(wcList, cleanTarget);
          if (wcMatch) {
            const wcRes = await fetchWeebCentralPagesFromChapter(wcMatch);
            if (wcRes && wcRes.total > (stubFallback?.total || 0)) {
              if (wcRes.total > 2) return wcRes;
              stubFallback = wcRes;
            }
          }
        } catch {
          // continue
        }
      }

      if (stubFallback) return stubFallback;
    } catch (err: any) {
      if (stubFallback) return stubFallback;
      return {
        success: false,
        pages: [],
        rawPages: [],
        chapterTitle: `Chapter ${chapter}`,
        directUrl: searchUrl,
        source: 'unavailable',
        total: 0,
        error: err?.message || 'Failed to fetch chapter pages',
      };
    }

    return {
      success: false,
      pages: [],
      rawPages: [],
      chapterTitle: `Chapter ${chapter}`,
      directUrl: searchUrl,
      source: 'unavailable',
      total: 0,
      error: `Chapter ${chapter} was not found for "${title}" on Honey or Sol.`,
    };
  })()
    .then((result) => {
      if (result.success && result.pages.length > 0) {
        chapterPagesCache.set(cacheKey, result);
      }
      return result;
    })
    .finally(() => {
      inflightPages.delete(cacheKey);
    });

  inflightPages.set(cacheKey, task);
  return task;
}
