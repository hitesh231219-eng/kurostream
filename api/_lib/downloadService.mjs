import {
  ALLOWED_DDL_VERIFY_DOMAINS,
  ALLOWED_DOWNLOAD_SEARCH_DOMAINS,
  ALLOWED_DOWNLOAD_SOURCE_DOMAINS,
  BoundedTtlCache,
  validateProxyTargetUrlStatic,
  validateProxyTargetUrlWithDns
} from "./security.mjs";
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
const downloadResolveCache = new BoundedTtlCache(250, 10 * 60 * 1e3);
const armIdCache = new BoundedTtlCache(
  500,
  60 * 60 * 1e3
);
const downloadSearchCache = new BoundedTtlCache(200, 4 * 60 * 1e3);
function normalizeDownloadSourceInput(rawInput) {
  const trimmed = String(rawInput || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a NekoStream Pahe URL or short ID." };
  }
  if (/^[A-Za-z0-9_-]{3,32}$/.test(trimmed)) {
    return {
      ok: true,
      url: `https://pahe.nekostream.site/${encodeURIComponent(trimmed)}`,
      paheId: trimmed
    };
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const staticCheck = validateProxyTargetUrlStatic(withProtocol, ALLOWED_DOWNLOAD_SOURCE_DOMAINS);
  if (!staticCheck.valid || !staticCheck.url) {
    return {
      ok: false,
      error: staticCheck.reason || "URL must use HTTPS on an allowed download source (pahe.nekostream.site, testpahe.nekostream.site, kwik.cx, pahe.win)."
    };
  }
  const parts = staticCheck.url.pathname.split("/").filter(Boolean);
  const host = staticCheck.url.hostname.toLowerCase();
  const paheId = host === "pahe.nekostream.site" || host === "testpahe.nekostream.site" ? parts[parts.length - 1] || null : null;
  return {
    ok: true,
    url: staticCheck.url.toString(),
    paheId
  };
}
function extractNekostreamRedirectUrl(html, sourceUrl) {
  let parsedSource;
  try {
    parsedSource = new URL(sourceUrl);
  } catch {
    return null;
  }
  const parts = parsedSource.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1] || "";
  const concatMatch = html.match(/["'](https:\/\/[^"'\s]+\/)["']\s*\+\s*([a-zA-Z_$][\w$]*)/i);
  if (concatMatch && id) {
    const candidate = `${concatMatch[1]}${encodeURIComponent(id)}`;
    if (validateProxyTargetUrlStatic(candidate, ALLOWED_DOWNLOAD_SOURCE_DOMAINS).valid) {
      return candidate;
    }
  }
  const directMatch = html.match(
    /(?:location\.href|window\.location|href)\s*=\s*["'](https:\/\/[^"'\s]+)["']/i
  );
  if (directMatch) {
    const candidate = directMatch[1];
    if (validateProxyTargetUrlStatic(candidate, ALLOWED_DOWNLOAD_SOURCE_DOMAINS).valid) {
      return candidate;
    }
  }
  const hrefMatch = html.match(
    /<a[^>]+href=["'](https:\/\/(?:testpahe\.nekostream\.site|kwik\.cx|kwik\.si|pahe\.win)\/[^"']+)["']/i
  );
  if (hrefMatch) {
    const candidate = hrefMatch[1];
    if (validateProxyTargetUrlStatic(candidate, ALLOWED_DOWNLOAD_SOURCE_DOMAINS).valid) {
      return candidate;
    }
  }
  if (parsedSource.hostname.toLowerCase() === "pahe.nekostream.site" && id) {
    return `https://testpahe.nekostream.site/${encodeURIComponent(id)}`;
  }
  return null;
}
function extractKwikFileMetadata(html, kwikUrl) {
  let fileName = null;
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const raw = titleMatch[1].replace(/\s*-\s*Kwik.*$/i, "").trim();
    if (raw && !/just a moment/i.test(raw)) {
      fileName = raw;
    }
  }
  const h1Match = html.match(/<h1[^>]*class=["'][^"']*title[^"']*["'][^>]*>([^<]+)<\/h1>/i);
  if (!fileName && h1Match) {
    fileName = h1Match[1].trim();
  }
  let directDownloadUrl = null;
  const mp4Match = html.match(/https:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/i);
  if (mp4Match) {
    directDownloadUrl = mp4Match[0];
  } else {
    try {
      const u = new URL(kwikUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      if ((u.hostname === "kwik.cx" || u.hostname === "kwik.si") && parts[0] === "f" && parts[1]) {
        directDownloadUrl = null;
      }
    } catch {
    }
  }
  return { fileName, directDownloadUrl };
}
function extractKwikFileId(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (host === "kwik.cx" || host === "kwik.si" || host.endsWith(".kwik.cx")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && (parts[0] === "f" || parts[0] === "d" || parts[0] === "e")) {
        return parts[1];
      }
      return parts[parts.length - 1] || null;
    }
  } catch {
  }
  return null;
}
async function fetchWithTimeout(url, init, fetchImpl, timeoutMs = 9e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function resolveAnimeDownloadSource(rawInput, fetchImpl = fetch, options) {
  const normalized = normalizeDownloadSourceInput(rawInput);
  if (!normalized.ok || !normalized.url) {
    return {
      ok: false,
      inputUrl: rawInput,
      normalizedUrl: rawInput,
      resolvedUrl: null,
      directDownloadUrl: null,
      sourceProvider: "nekostream-pahe",
      sourceHost: null,
      paheId: null,
      kwikFileId: null,
      fileName: null,
      adGateBypassed: false,
      requiresBrowserChallenge: false,
      hops: [],
      error: normalized.error || "Invalid download source URL"
    };
  }
  const startUrl = normalized.url;
  const cacheKey = startUrl;
  if (!options?.bypassCache) {
    const cached = downloadResolveCache.get(cacheKey);
    if (cached) return cached;
  }
  const hops = [];
  let currentUrl = startUrl;
  let adGateBypassed = false;
  let requiresBrowserChallenge = false;
  let fileName = null;
  let directDownloadUrl = null;
  let lastReferer = "https://pahe.nekostream.site/";
  const MAX_HOPS = 6;
  try {
    for (let step = 1; step <= MAX_HOPS; step++) {
      const dnsCheck = await validateProxyTargetUrlWithDns(
        currentUrl,
        ALLOWED_DOWNLOAD_SOURCE_DOMAINS
      );
      if (!dnsCheck.valid || !dnsCheck.url) {
        const failedResult = {
          ok: false,
          inputUrl: rawInput,
          normalizedUrl: startUrl,
          resolvedUrl: null,
          directDownloadUrl: null,
          sourceProvider: "nekostream-pahe",
          sourceHost: null,
          paheId: normalized.paheId || null,
          kwikFileId: null,
          fileName: null,
          adGateBypassed,
          requiresBrowserChallenge: false,
          hops,
          error: dnsCheck.reason || "Blocked unsafe redirect host"
        };
        return failedResult;
      }
      const host = dnsCheck.url.hostname.toLowerCase();
      const res = await fetchWithTimeout(
        currentUrl,
        {
          method: "GET",
          redirect: "manual",
          headers: {
            ...DEFAULT_HEADERS,
            Referer: lastReferer
          }
        },
        fetchImpl
      );
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          hops.push({
            step,
            url: currentUrl,
            host,
            status: res.status,
            type: "redirect",
            note: "Redirect response missing Location header"
          });
          break;
        }
        const nextUrl = new URL(location, currentUrl).toString();
        hops.push({
          step,
          url: currentUrl,
          host,
          status: res.status,
          type: "redirect",
          note: `HTTP ${res.status} redirect -> ${new URL(nextUrl).hostname}`
        });
        lastReferer = currentUrl;
        currentUrl = nextUrl;
        continue;
      }
      if (host === "pahe.nekostream.site") {
        const html = await res.text();
        const extractedNext = extractNekostreamRedirectUrl(html, currentUrl);
        if (extractedNext && extractedNext !== currentUrl) {
          adGateBypassed = true;
          hops.push({
            step,
            url: currentUrl,
            host,
            status: res.status,
            type: "ad-interstitial",
            note: `Bypassed ad interstitial and traced target -> ${new URL(extractedNext).hostname}`
          });
          lastReferer = currentUrl;
          currentUrl = extractedNext;
          continue;
        }
      }
      const isKwik = host === "kwik.cx" || host === "kwik.si" || host.endsWith(".kwik.cx");
      const cfMitigated = res.headers.get("cf-mitigated") === "challenge";
      if (isKwik) {
        if (res.status === 403 || cfMitigated) {
          requiresBrowserChallenge = true;
          hops.push({
            step,
            url: currentUrl,
            host,
            status: res.status,
            type: "filehost",
            note: "Resolved Kwik file host source (Cloudflare browser check runs on download open)"
          });
        } else {
          const html = await res.text();
          const meta = extractKwikFileMetadata(html, currentUrl);
          fileName = meta.fileName;
          directDownloadUrl = meta.directDownloadUrl;
          hops.push({
            step,
            url: currentUrl,
            host,
            status: res.status,
            type: directDownloadUrl ? "direct" : "filehost",
            note: directDownloadUrl ? "Resolved direct MP4 download URL from Kwik" : "Resolved Kwik file download page"
          });
        }
        break;
      }
      const body = await res.text();
      const nextFromHtml = extractNekostreamRedirectUrl(body, currentUrl);
      if (nextFromHtml && nextFromHtml !== currentUrl) {
        adGateBypassed = true;
        hops.push({
          step,
          url: currentUrl,
          host,
          status: res.status,
          type: "redirect",
          note: `Extracted next download hop -> ${new URL(nextFromHtml).hostname}`
        });
        lastReferer = currentUrl;
        currentUrl = nextFromHtml;
        continue;
      }
      hops.push({
        step,
        url: currentUrl,
        host,
        status: res.status,
        type: "filehost",
        note: `Resolved endpoint (HTTP ${res.status})`
      });
      break;
    }
    const finalHost = new URL(currentUrl).hostname.toLowerCase();
    const kwikFileId = extractKwikFileId(currentUrl);
    const result = {
      ok: true,
      inputUrl: rawInput,
      normalizedUrl: startUrl,
      resolvedUrl: currentUrl,
      directDownloadUrl,
      sourceProvider: startUrl.includes("nekostream.site") ? "nekostream-pahe" : kwikFileId ? "kwik" : "pahe",
      sourceHost: finalHost,
      paheId: normalized.paheId || null,
      kwikFileId,
      fileName,
      adGateBypassed,
      requiresBrowserChallenge,
      hops
    };
    if (!options?.bypassCache) {
      downloadResolveCache.set(cacheKey, result);
    }
    return result;
  } catch (err) {
    return {
      ok: false,
      inputUrl: rawInput,
      normalizedUrl: startUrl,
      resolvedUrl: null,
      directDownloadUrl: null,
      sourceProvider: "nekostream-pahe",
      sourceHost: null,
      paheId: normalized.paheId || null,
      kwikFileId: null,
      fileName: null,
      adGateBypassed,
      requiresBrowserChallenge: false,
      hops,
      error: err?.name === "AbortError" ? "Timed out tracing download source" : err?.message || "Failed to trace download source"
    };
  }
}
const IGNORED_DDL_LABELS = /* @__PURE__ */ new Set(["torrent", "magnet", "nzb", "website", "discord", "nyaa", "tt"]);
const KNOWN_DDL_HOSTS = [
  [/gofile\.io/i, "GoFile"],
  [/buzzheavier\.com/i, "BuzzHeavier"],
  [/pixeldrain\.com/i, "Pixeldrain"],
  [/krakenfiles\.com/i, "KrakenFiles"],
  [/akirabox\.com/i, "AkiraBox"],
  [/clicknupload\./i, "ClickNUpload"],
  [/send\.cm/i, "SendCM"],
  [/mdiaload\.com/i, "MdiaLoad"],
  [/multiup\.io/i, "MultiUp"],
  [/1fichier\.com/i, "1Fichier"],
  [/vikingfile\.com/i, "VikingFile"],
  [/qiwi\.gg/i, "Qiwi"],
  [/filechan\.org/i, "Filechan"],
  [/kwik\.(?:cx|si)/i, "Kwik"]
];
const MIRROR_PRIORITY = {
  GoFile: 1,
  BuzzHeavier: 2,
  Pixeldrain: 3,
  KrakenFiles: 4,
  AkiraBox: 5,
  ClickNUpload: 6,
  SendCM: 7,
  Kwik: 8,
  MdiaLoad: 9
};
const TITLE_STOPWORDS = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "no",
  "to",
  "of",
  "in",
  "and",
  "or",
  "wa",
  "ga",
  "season",
  "part",
  "cour",
  "tv",
  "end"
]);
function decodeHtmlEntities(text) {
  return text.replace(/<[^>]+>/g, "").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num))).replace(/\s+/g, " ").trim();
}
function normalizeTitleTokens(raw) {
  return raw.toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((tok) => tok.length >= 2 && !TITLE_STOPWORDS.has(tok));
}
function scoreTitleMatch(releaseTitle, candidateTitles) {
  const releaseClean = releaseTitle.toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ");
  let best = 0;
  for (const candidate of candidateTitles) {
    const cleanCand = candidate.toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    if (!cleanCand) continue;
    if (releaseClean.includes(cleanCand)) {
      best = Math.max(best, 1);
      continue;
    }
    const tokens = normalizeTitleTokens(candidate);
    if (tokens.length === 0) continue;
    let hits = 0;
    for (const tok of tokens) {
      if (releaseClean.includes(tok)) hits++;
    }
    const ratio = hits / tokens.length;
    best = Math.max(best, ratio);
  }
  return best;
}
function detectReleaseQuality(title) {
  if (/2160p|4k|uhd/i.test(title)) return "2160p";
  if (/1080p|fhd|1920x1080/i.test(title)) return "1080p";
  if (/720p|hd|1280x720/i.test(title)) return "720p";
  if (/480p|848x480/i.test(title)) return "480p";
  if (/360p/i.test(title)) return "360p";
  return "unknown";
}
function detectReleaseAudio(title) {
  if (/dual[\s._-]*audio|multi[\s._-]*audio/i.test(title)) return "dual";
  if (/\b(?:eng|english)[\s._-]*dub\b|\bdubbed\b/i.test(title)) return "dub";
  return "sub";
}
function classifyEpisodeRelease(releaseTitle, targetEpisode) {
  const clean = releaseTitle.replace(/<[^>]+>/g, "");
  const epStr = String(targetEpisode);
  const epPad = epStr.padStart(2, "0");
  const hasRange = new RegExp(`(?:^|[\\s\\(\\[])0*1\\s*[-~]\\s*0*\\d{2,3}(?=$|[\\s\\)\\]])`, "i").test(clean) || /\(\s*batch\s*\)|\[\s*batch\s*\]|\bfull\s+series\b|\bcomplete\b/i.test(clean);
  const stripped = clean.replace(/\[[0-9a-f]{8}\]/gi, " ").replace(/\b(?:2160p|1080p|720p|480p|360p|x264|x265|h264|h265|10bit|8bit|aac|flac|opus|ddp?\d(?:\.\d)?|2\.0|5\.1|hevc|av1)\b/gi, " ").replace(/\b(?:19\d\d|20\d\d)\b/g, " ");
  const sxeMatches = [...stripped.matchAll(/\bs\d{1,2}e0*(\d{1,4})(?!\d)/gi)];
  if (sxeMatches.length > 0) {
    const matchedTarget = sxeMatches.some((m) => Number(m[1]) === targetEpisode);
    return matchedTarget ? { matches: true, isBatch: false, confidence: 100 } : { matches: false, isBatch: false, confidence: 0 };
  }
  const epWordMatches = [...stripped.matchAll(/(?:^|[\s._\-\[\(])(?:ep(?:isode)?|e)\s*0*(\d{1,4})(?=$|[\s._\-\]\)\[v])/gi)];
  if (epWordMatches.length > 0) {
    const matchedTarget = epWordMatches.some((m) => Number(m[1]) === targetEpisode);
    return matchedTarget ? { matches: true, isBatch: false, confidence: 95 } : { matches: false, isBatch: false, confidence: 0 };
  }
  const dashEpRegex = /(?:^|\s)-\s*0*(\d{1,4})(?:v\d+)?(?=$|[\s\[\(\.\-_])/g;
  const dashMatches = [...stripped.matchAll(dashEpRegex)];
  if (dashMatches.length > 0) {
    const exactDash = dashMatches.some((m) => Number(m[1]) === targetEpisode);
    if (!hasRange && exactDash) {
      return { matches: true, isBatch: false, confidence: 92 };
    }
    if (!hasRange && !exactDash) {
      return { matches: false, isBatch: false, confidence: 0 };
    }
  }
  const bracketEpRegex = new RegExp(`\\s0*${epStr}(?:v\\d)?(?=\\s*[\\(\\[]|(?:\\.mkv|\\.mp4)$)`, "i");
  if (!hasRange && bracketEpRegex.test(stripped)) {
    return { matches: true, isBatch: false, confidence: 80 };
  }
  if (hasRange || /\bs0?\d\b|\bseason\s*0?\d\b/i.test(stripped)) {
    return { matches: true, isBatch: true, confidence: 40 };
  }
  const looseRegex = new RegExp(`(?:^|[\\s._-])${epPad}(?:$|[\\s._-])`);
  if (!hasRange && looseRegex.test(stripped)) {
    return { matches: true, isBatch: false, confidence: 65 };
  }
  return { matches: false, isBatch: false, confidence: 0 };
}
function normalizeMirrorHostLabel(rawLabel, url) {
  const clean = rawLabel.trim();
  if (IGNORED_DDL_LABELS.has(clean.toLowerCase())) {
    return null;
  }
  if (/animetosho\.org|tokyotosho\.info|nyaa\.si|anidb\.net|discord\.gg|discord\.com/i.test(url)) {
    return null;
  }
  for (const [pattern, name] of KNOWN_DDL_HOSTS) {
    if (pattern.test(url)) return name;
  }
  if (/^https?:\/\//i.test(url)) {
    return clean || new URL(url).hostname.replace(/^www\./, "");
  }
  return null;
}
function extractMirrorsFromHtmlFragment(html) {
  const directMirrors = [];
  const seenUrls = /* @__PURE__ */ new Set();
  let torrentUrl = null;
  let magnetUrl = null;
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRegex)) {
    const rawHref = match[1].replace(/&amp;/gi, "&").trim();
    const label = decodeHtmlEntities(match[2]);
    if (rawHref.startsWith("magnet:?")) {
      if (!magnetUrl) magnetUrl = rawHref;
      continue;
    }
    if (label.toLowerCase().includes("torrent") || rawHref.endsWith(".torrent") || /\/torrents\/\d+\/download/i.test(rawHref)) {
      if (!torrentUrl && /^https:\/\//i.test(rawHref)) {
        torrentUrl = rawHref;
      }
      continue;
    }
    if (!/^https?:\/\//i.test(rawHref)) continue;
    const hostLabel = normalizeMirrorHostLabel(label, rawHref);
    if (!hostLabel) continue;
    if (!seenUrls.has(rawHref)) {
      seenUrls.add(rawHref);
      directMirrors.push({ host: hostLabel, url: rawHref });
    }
  }
  directMirrors.sort((a, b) => {
    const isPartA = /\.00\d+$/.test(a.url) || /^part\d+$/i.test(a.host) ? 50 : 0;
    const isPartB = /\.00\d+$/.test(b.url) || /^part\d+$/i.test(b.host) ? 50 : 0;
    const pA = (MIRROR_PRIORITY[a.host] ?? 20) + isPartA;
    const pB = (MIRROR_PRIORITY[b.host] ?? 20) + isPartB;
    return pA - pB;
  });
  const seenHosts = /* @__PURE__ */ new Set();
  const filteredMirrors = [];
  for (const m of directMirrors) {
    if (seenHosts.has(m.host) && filteredMirrors.length >= 4) continue;
    if (!seenHosts.has(m.host)) {
      seenHosts.add(m.host);
      filteredMirrors.push(m);
    }
  }
  return { directMirrors: filteredMirrors.slice(0, 6), torrentUrl, magnetUrl };
}
function parseAnimeToshoEntries(html) {
  const chunks = html.split(/<div class="home_list_entry[^"]*">/i).slice(1);
  const parsed = [];
  for (const chunk of chunks) {
    const linkMatch = chunk.match(/<div class="link"><a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a><\/div>/i);
    if (!linkMatch) continue;
    const viewUrl = linkMatch[1].replace(/&amp;/gi, "&").trim();
    const title = decodeHtmlEntities(linkMatch[2]);
    if (!title) continue;
    const seriesMatch = chunk.match(/<span class="serieslink"><a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a><\/span>/i);
    let anidbId = null;
    let releaseGroup = null;
    if (seriesMatch) {
      const aidMatch = seriesMatch[1].match(/\.(\d+)(?:[?#]|$)/);
      if (aidMatch) anidbId = Number(aidMatch[1]);
      releaseGroup = decodeHtmlEntities(seriesMatch[2]) || null;
    }
    if (!releaseGroup) {
      const grp = title.match(/^\[([^\]]+)\]/);
      if (grp) releaseGroup = grp[1].trim();
    }
    const sizeMatch = chunk.match(/<div class="size"[^>]*>([\s\S]*?)<\/div>/i);
    const fileSize = sizeMatch ? decodeHtmlEntities(sizeMatch[1]) : null;
    const seedMatch = chunk.match(/title="Seeders:\s*(\d+)\s*\/\s*Leechers:/i);
    const seeders = seedMatch ? Number(seedMatch[1]) : null;
    const linksBlock = chunk.match(/<div class="links">([\s\S]*)$/i)?.[1] || chunk;
    const { directMirrors, torrentUrl, magnetUrl } = extractMirrorsFromHtmlFragment(linksBlock);
    parsed.push({
      title,
      viewUrl,
      anidbId,
      fileSize,
      seeders,
      releaseGroup,
      directMirrors,
      torrentUrl,
      magnetUrl
    });
  }
  return parsed;
}
async function resolveExactAnimeIds(params, fetchImpl = fetch) {
  const anilistId = params.anilistId && params.anilistId > 0 ? Number(params.anilistId) : null;
  const malId = params.malId && params.malId > 0 ? Number(params.malId) : null;
  if (!anilistId && !malId) {
    return { anidbId: null, malId: null, anilistId: null };
  }
  const cacheKey = anilistId ? `al:${anilistId}` : `mal:${malId}`;
  return armIdCache.coalesce(cacheKey, async () => {
    const queryUrl = anilistId ? `https://arm.haglund.dev/api/v2/ids?source=anilist&id=${anilistId}` : `https://arm.haglund.dev/api/v2/ids?source=myanimelist&id=${malId}`;
    const check = await validateProxyTargetUrlWithDns(queryUrl, ALLOWED_DOWNLOAD_SEARCH_DOMAINS);
    if (!check.valid) {
      return { anidbId: null, malId, anilistId };
    }
    try {
      const res = await fetchWithTimeout(
        queryUrl,
        { headers: { Accept: "application/json", "User-Agent": DEFAULT_HEADERS["User-Agent"] } },
        fetchImpl,
        5500
      );
      if (!res.ok) return { anidbId: null, malId, anilistId };
      const json = await res.json();
      return {
        anidbId: typeof json?.anidb === "number" ? json.anidb : null,
        malId: typeof json?.myanimelist === "number" ? json.myanimelist : malId,
        anilistId: typeof json?.anilist === "number" ? json.anilist : anilistId
      };
    } catch {
      return { anidbId: null, malId, anilistId };
    }
  });
}
async function fetchAnimeToshoSearchPage(url, fetchImpl) {
  const check = await validateProxyTargetUrlWithDns(url, ALLOWED_DOWNLOAD_SEARCH_DOMAINS);
  if (!check.valid) return [];
  try {
    const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, fetchImpl, 7500);
    if (!res.ok) return [];
    const html = await res.text();
    return parseAnimeToshoEntries(html);
  } catch {
    return [];
  }
}
async function enrichMirrorsFromViewPage(viewUrl, fetchImpl) {
  const check = await validateProxyTargetUrlWithDns(viewUrl, ALLOWED_DOWNLOAD_SEARCH_DOMAINS);
  if (!check.valid) return [];
  try {
    const res = await fetchWithTimeout(viewUrl, { headers: DEFAULT_HEADERS }, fetchImpl, 5e3);
    if (!res.ok) return [];
    const html = await res.text();
    return extractMirrorsFromHtmlFragment(html).directMirrors;
  } catch {
    return [];
  }
}
async function fetchSubsPleaseReleases(title, candidateTitles, episode, anidbId, fetchImpl) {
  const cleanQuery = title.replace(/[:\-–—()\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanQuery) return [];
  const url = `https://subsplease.org/api/?f=search&tz=UTC&s=${encodeURIComponent(cleanQuery)}`;
  const check = await validateProxyTargetUrlWithDns(url, ALLOWED_DOWNLOAD_SEARCH_DOMAINS);
  if (!check.valid) return [];
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { Accept: "application/json", "User-Agent": DEFAULT_HEADERS["User-Agent"] } },
      fetchImpl,
      5500
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (!json || typeof json !== "object") return [];
    const epPad = String(episode).padStart(2, "0");
    const out = [];
    for (const item of Object.values(json)) {
      if (!item || typeof item !== "object") continue;
      const show = String(item.show || "");
      const itemEp = String(item.episode || "").trim();
      if (!show || itemEp !== String(episode) && itemEp !== epPad) continue;
      const titleMatch = scoreTitleMatch(show, candidateTitles);
      if (titleMatch < 0.55) continue;
      const reqS2 = /\b(?:season\s*2|s2|2nd\s*season)\b/i.test(candidateTitles.join(" "));
      const itemS2 = /\b(?:s2|s02|2nd\s*season|season\s*2)\b/i.test(show);
      if (reqS2 !== itemS2 && candidateTitles.some((t) => !/\bs\d\b/i.test(t))) {
        continue;
      }
      const downloads = Array.isArray(item.downloads) ? item.downloads : [];
      for (const dl of downloads) {
        const resLabel = String(dl?.res || "1080");
        const quality = resLabel === "1080" ? "1080p" : resLabel === "720" ? "720p" : resLabel === "480" ? "480p" : "1080p";
        const magnetUrl = typeof dl?.magnet === "string" ? dl.magnet : null;
        if (!magnetUrl) continue;
        out.push({
          id: `sp-${show}-${itemEp}-${resLabel}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
          title: `[SubsPlease] ${show} - ${itemEp} (${quality})`,
          releaseGroup: "SubsPlease",
          episode,
          isBatch: false,
          quality,
          audioType: "sub",
          fileSize: null,
          seeders: null,
          viewUrl: null,
          anidbId,
          seriesMatchedById: false,
          directMirrors: [],
          torrentUrl: null,
          magnetUrl,
          source: "subsplease",
          matchScore: 86 + (quality === "1080p" ? 4 : 0)
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
const NYAA_DEFAULT_TRACKERS = [
  "http://nyaa.tracker.wf:7777/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.torrent.eu.org:451/announce"
];
function buildMagnetUri(infoHash, title) {
  const tr = NYAA_DEFAULT_TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${tr}`;
}
function passesSequelGuard(releaseTitle, candidateTitles) {
  const joinedReq = candidateTitles.join(" ");
  const reqSeasonMatch = joinedReq.match(/\b(?:season\s*(\d+)|s(\d+)|(\d+)(?:nd|rd|th)\s*season|part\s*(\d+))\b/i);
  const reqSeasonNum = reqSeasonMatch ? Number(reqSeasonMatch[1] || reqSeasonMatch[2] || reqSeasonMatch[3] || reqSeasonMatch[4]) : 1;
  const relSeasonMatch = releaseTitle.match(/\b(?:season\s*(\d+)|s0*(\d+)(?:e\d+)?|(\d+)(?:nd|rd|th)\s*season)\b/i);
  if (relSeasonMatch) {
    const relSeasonNum = Number(relSeasonMatch[1] || relSeasonMatch[2] || relSeasonMatch[3]);
    if (Number.isFinite(relSeasonNum) && relSeasonNum !== reqSeasonNum) {
      return false;
    }
  }
  return true;
}
function formatBytesHuman(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx >= 2 ? 2 : 0)} ${units[idx]}`;
}
async function fetchNyaaReleases(queryTitle, candidateTitles, episode, anidbId, audio, preferredQuality, fetchImpl) {
  const cleanQuery = queryTitle.replace(/[:\-–—()\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanQuery) return { singles: [], batches: [] };
  const epPad = String(episode).padStart(2, "0");
  const rssUrl = `https://nyaa.si/?page=rss&q=${encodeURIComponent(`${cleanQuery} ${epPad}`)}&c=1_2&s=seeders&o=desc`;
  const check = await validateProxyTargetUrlWithDns(rssUrl, ALLOWED_DOWNLOAD_SEARCH_DOMAINS);
  if (!check.valid) return { singles: [], batches: [] };
  try {
    const res = await fetchWithTimeout(rssUrl, { headers: DEFAULT_HEADERS }, fetchImpl, 7e3);
    if (!res.ok) return { singles: [], batches: [] };
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
    const singles = [];
    const batches = [];
    for (const match of items) {
      const body = match[1];
      const rawTitle = body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "";
      const title = decodeHtmlEntities(rawTitle.replace(/<!\[CDATA\[|\]\]>/g, ""));
      if (!title) continue;
      if (/\b(?:mini\s*anime|pv|trailer|ncop|nced|ost)\b/i.test(title)) continue;
      if (scoreTitleMatch(title, candidateTitles) < 0.6) continue;
      if (!passesSequelGuard(title, candidateTitles)) continue;
      const epClass = classifyEpisodeRelease(title, episode);
      if (!epClass.matches) continue;
      const torrentUrl = decodeHtmlEntities(body.match(/<link>([^<]+)<\/link>/i)?.[1] || "") || null;
      const viewUrl = decodeHtmlEntities(body.match(/<guid[^>]*>([^<]+)<\/guid>/i)?.[1] || "") || null;
      const infoHash = (body.match(/<nyaa:infoHash>([^<]+)<\/nyaa:infoHash>/i)?.[1] || "").trim();
      const seeders = Number(body.match(/<nyaa:seeders>(\d+)<\/nyaa:seeders>/i)?.[1] || 0);
      const fileSize = decodeHtmlEntities(body.match(/<nyaa:size>([^<]+)<\/nyaa:size>/i)?.[1] || "") || null;
      const magnetUrl = infoHash ? buildMagnetUri(infoHash, title) : null;
      if (!torrentUrl && !magnetUrl) continue;
      if (seeders <= 0) continue;
      const quality = detectReleaseQuality(title);
      const audioType = detectReleaseAudio(title);
      const grp = title.match(/^\[([^\]]+)\]/)?.[1]?.trim() || "Nyaa";
      let score = epClass.confidence + Math.min(20, Math.floor(seeders / 3));
      if (quality === preferredQuality) score += 12;
      else if (quality === "1080p") score += 8;
      if (audio === "dub" && (audioType === "dub" || audioType === "dual")) score += 18;
      if (audio === "sub" && (audioType === "sub" || audioType === "dual")) score += 10;
      const release = {
        id: viewUrl || `nyaa-${infoHash || title.slice(0, 16)}`,
        title,
        releaseGroup: grp,
        episode,
        isBatch: epClass.isBatch,
        quality,
        audioType,
        fileSize,
        seeders,
        viewUrl,
        anidbId,
        seriesMatchedById: false,
        directMirrors: [],
        torrentUrl,
        magnetUrl,
        source: "nyaa",
        matchScore: score
      };
      if (epClass.isBatch) {
        batches.push(release);
      } else {
        singles.push(release);
      }
    }
    return { singles, batches };
  } catch {
    return { singles: [], batches: [] };
  }
}
async function fetchNekoBtReleases(queryTitle, candidateTitles, episode, anidbId, audio, preferredQuality, fetchImpl) {
  const cleanQuery = queryTitle.replace(/[:\-–—()\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanQuery) return { singles: [], batches: [] };
  const epPad = String(episode).padStart(2, "0");
  const apiUrl = `https://nekobt.to/api/v1/torrents/search?query=${encodeURIComponent(`${cleanQuery} ${epPad}`)}`;
  const check = await validateProxyTargetUrlWithDns(apiUrl, ALLOWED_DOWNLOAD_SEARCH_DOMAINS);
  if (!check.valid) return { singles: [], batches: [] };
  try {
    const res = await fetchWithTimeout(
      apiUrl,
      { headers: { Accept: "application/json", "User-Agent": DEFAULT_HEADERS["User-Agent"] } },
      fetchImpl,
      6500
    );
    if (!res.ok) return { singles: [], batches: [] };
    const json = await res.json();
    const results = Array.isArray(json?.data?.results) ? json.data.results : [];
    const singles = [];
    const batches = [];
    for (const item of results) {
      const title = String(item?.title || "").trim();
      const id = String(item?.id || "").trim();
      if (!title || !id) continue;
      if (/\b(?:mini\s*anime|pv|trailer|ncop|nced|ost)\b/i.test(title)) continue;
      if (scoreTitleMatch(title, candidateTitles) < 0.6) continue;
      if (!passesSequelGuard(title, candidateTitles)) continue;
      const epClass = classifyEpisodeRelease(title, episode);
      if (!epClass.matches) continue;
      const torrentUrl = `https://nekobt.to/api/v1/torrents/${encodeURIComponent(id)}/download?public=true`;
      const magnetUrl = typeof item?.magnet === "string" ? item.magnet : null;
      const seeders = typeof item?.seeders === "number" ? item.seeders : null;
      const fileSize = typeof item?.filesize === "number" ? formatBytesHuman(item.filesize) : null;
      if (seeders !== null && seeders <= 0) continue;
      const quality = detectReleaseQuality(title);
      const audioType = detectReleaseAudio(title);
      const grp = title.match(/^\[([^\]]+)\]/)?.[1]?.trim() || "NekoBT";
      let score = epClass.confidence + (seeders ? Math.min(18, Math.floor(seeders / 3)) : 6);
      if (quality === preferredQuality) score += 12;
      else if (quality === "1080p") score += 8;
      if (audio === "dub" && (audioType === "dub" || audioType === "dual")) score += 18;
      if (audio === "sub" && (audioType === "sub" || audioType === "dual")) score += 10;
      const release = {
        id: `nekobt-${id}`,
        title,
        releaseGroup: grp,
        episode,
        isBatch: epClass.isBatch,
        quality,
        audioType,
        fileSize: fileSize || null,
        seeders,
        viewUrl: `https://nekobt.to/torrents/${encodeURIComponent(id)}`,
        anidbId,
        seriesMatchedById: false,
        directMirrors: [],
        torrentUrl,
        magnetUrl,
        source: "nekobt",
        matchScore: score
      };
      if (epClass.isBatch) {
        batches.push(release);
      } else {
        singles.push(release);
      }
    }
    return { singles, batches };
  } catch {
    return { singles: [], batches: [] };
  }
}
const mirrorVerifyCache = new BoundedTtlCache(400, 10 * 60 * 1e3);
async function verifySingleDirectMirror(mirror, fetchImpl = fetch) {
  return mirrorVerifyCache.coalesce(mirror.url, async () => {
    const check = await validateProxyTargetUrlWithDns(mirror.url, ALLOWED_DDL_VERIFY_DOMAINS);
    if (!check.valid || !check.url) {
      return null;
    }
    const host = check.url.hostname.toLowerCase();
    if (host === "pixeldrain.com" || host.endsWith(".pixeldrain.com")) {
      const fileMatch = check.url.pathname.match(/^\/(?:u|file)\/([A-Za-z0-9]+)/);
      if (fileMatch) {
        try {
          const r = await fetchWithTimeout(
            `https://pixeldrain.com/api/file/${fileMatch[1]}/info`,
            { headers: { Accept: "application/json", "User-Agent": DEFAULT_HEADERS["User-Agent"] } },
            fetchImpl,
            3e3
          );
          if (!r.ok) return null;
          const j = await r.json();
          if (j && j.success === true) {
            return {
              host: "Pixeldrain",
              url: `https://pixeldrain.com/api/file/${fileMatch[1]}?download`,
              verified: "live"
            };
          }
          return null;
        } catch {
          return null;
        }
      }
    }
    try {
      const res = await fetchWithTimeout(
        mirror.url,
        { headers: DEFAULT_HEADERS, redirect: "follow" },
        fetchImpl,
        3200
      );
      if (res.status === 404 || res.status === 406 || res.status === 410 || res.status >= 500) {
        return null;
      }
      const cfMitigated = res.headers.get("cf-mitigated") === "challenge";
      const html = await res.text();
      if (cfMitigated || /<title>\s*Just a moment\.\.\./i.test(html)) {
        return { ...mirror, verified: "browser-check" };
      }
      if (/file not found|does not exist|has been deleted|was deleted|no such file|file removed|404 not found/i.test(
        html
      )) {
        return null;
      }
      if (host === "gofile.io" || host.endsWith(".gofile.io")) {
        return { ...mirror, verified: "browser-check" };
      }
      if (res.ok) {
        return { ...mirror, verified: "live" };
      }
      return null;
    } catch {
      return null;
    }
  });
}
async function verifyAndFilterDirectMirrors(releases, fetchImpl) {
  const uniqueMirrors = /* @__PURE__ */ new Map();
  for (const rel of releases.slice(0, 8)) {
    for (const m of rel.directMirrors) {
      if (!uniqueMirrors.has(m.url)) {
        uniqueMirrors.set(m.url, m);
      }
    }
  }
  const verifiedMap = /* @__PURE__ */ new Map();
  await Promise.all(
    [...uniqueMirrors.values()].map(async (m) => {
      const result = await verifySingleDirectMirror(m, fetchImpl);
      verifiedMap.set(m.url, result);
    })
  );
  let liveCount = 0;
  for (const rel of releases) {
    const surviving = [];
    for (const m of rel.directMirrors) {
      if (verifiedMap.has(m.url)) {
        const checked = verifiedMap.get(m.url);
        if (checked) {
          surviving.push(checked);
          if (checked.verified === "live") liveCount++;
        }
      } else {
        surviving.push({ ...m, verified: "browser-check" });
      }
    }
    surviving.sort((a, b) => (a.verified === "live" ? 0 : 1) - (b.verified === "live" ? 0 : 1));
    rel.directMirrors = surviving;
    const liveMirrors = surviving.filter((m) => m.verified === "live").length;
    if (liveMirrors > 0) {
      rel.matchScore += 35 + liveMirrors * 5;
    } else if (surviving.length === 0 && !rel.torrentUrl && !rel.magnetUrl) {
      rel.matchScore -= 100;
    }
  }
  return liveCount;
}
async function searchAnimeEpisodeDownloads(input, fetchImpl = fetch, options) {
  const episode = Math.max(1, Math.floor(Number(input.episode) || 1));
  const audio = input.audio === "dub" ? "dub" : "sub";
  const preferredQuality = input.quality || "1080p";
  const candidateTitles = [
    input.englishTitle,
    input.romajiTitle,
    input.title,
    ...input.synonyms || []
  ].map((t) => String(t || "").trim()).filter((t, idx, arr) => t.length >= 2 && arr.indexOf(t) === idx);
  const primaryTitle = candidateTitles[0] || String(input.title || "").trim();
  if (!primaryTitle) {
    return {
      ok: false,
      animeTitle: "",
      episode,
      audio,
      anilistId: input.anilistId ?? null,
      malId: input.malId ?? null,
      anidbId: null,
      identityVerified: false,
      sourcesChecked: [],
      verifiedLiveMirrorsCount: 0,
      results: [],
      batches: [],
      error: "Provide an anime title or AniList ID to search episode downloads."
    };
  }
  const cacheKey = `${input.anilistId || 0}:${primaryTitle.toLowerCase()}:ep${episode}:${audio}:${preferredQuality}`;
  if (!options?.bypassCache) {
    const cached = downloadSearchCache.get(cacheKey);
    if (cached) return cached;
  }
  const ids = await resolveExactAnimeIds(
    { anilistId: input.anilistId, malId: input.malId },
    fetchImpl
  );
  const epPad = String(episode).padStart(2, "0");
  const searchQueries = [];
  if (ids.anidbId) {
    searchQueries.push(
      `https://animetosho.org/search?aids=${ids.anidbId}&q=${encodeURIComponent(`"- ${epPad}"`)}`,
      `https://animetosho.org/search?aids=${ids.anidbId}&q=${encodeURIComponent(`E${epPad}`)}`
    );
  } else {
    const cleanRomajiOrPrimary = (input.romajiTitle || primaryTitle).replace(/["]/g, "").trim();
    searchQueries.push(
      `https://animetosho.org/search?q=${encodeURIComponent(`"${cleanRomajiOrPrimary}" "${epPad}"`)}`,
      `https://animetosho.org/search?q=${encodeURIComponent(`${cleanRomajiOrPrimary} S01E${epPad}`)}`
    );
  }
  const canonicalQuery = input.romajiTitle || primaryTitle;
  const [atoshoBatches, nyaaRes, nekowebRes, subsPleaseResults] = await Promise.all([
    Promise.all(searchQueries.map((u) => fetchAnimeToshoSearchPage(u, fetchImpl))),
    fetchNyaaReleases(canonicalQuery, candidateTitles, episode, ids.anidbId, audio, preferredQuality, fetchImpl),
    fetchNekoBtReleases(canonicalQuery, candidateTitles, episode, ids.anidbId, audio, preferredQuality, fetchImpl),
    fetchSubsPleaseReleases(canonicalQuery, candidateTitles, episode, ids.anidbId, fetchImpl)
  ]);
  let rawEntries = atoshoBatches.flat();
  if (rawEntries.length === 0 && ids.anidbId) {
    const broadened = await fetchAnimeToshoSearchPage(
      `https://animetosho.org/search?aids=${ids.anidbId}&q=${encodeURIComponent(String(episode))}`,
      fetchImpl
    );
    rawEntries = broadened;
  }
  const dedupedRaw = /* @__PURE__ */ new Map();
  for (const entry of rawEntries) {
    const key = entry.viewUrl || entry.title.toLowerCase();
    if (!dedupedRaw.has(key)) {
      dedupedRaw.set(key, entry);
    }
  }
  const matchedSingles = [];
  const matchedBatches = [];
  for (const entry of dedupedRaw.values()) {
    if (ids.anidbId && entry.anidbId && entry.anidbId !== ids.anidbId) {
      continue;
    }
    const seriesMatchedById = Boolean(ids.anidbId && entry.anidbId === ids.anidbId);
    const titleScore = scoreTitleMatch(entry.title, candidateTitles);
    if (!seriesMatchedById && (titleScore < 0.65 || !passesSequelGuard(entry.title, candidateTitles))) {
      continue;
    }
    const isMiniSpecial = /\b(?:mini\s*anime|pv|trailer|ncop|nced|ost)\b/i.test(entry.title);
    if (isMiniSpecial) continue;
    const epClass = classifyEpisodeRelease(entry.title, episode);
    if (!epClass.matches) continue;
    const quality = detectReleaseQuality(entry.title);
    const audioType = detectReleaseAudio(entry.title);
    let score = epClass.confidence;
    if (seriesMatchedById) score += 25;
    if (entry.directMirrors.length > 0) score += 25;
    if (quality === preferredQuality) score += 12;
    else if (quality === "1080p") score += 8;
    if (audio === "dub" && (audioType === "dub" || audioType === "dual")) score += 18;
    if (audio === "sub" && (audioType === "sub" || audioType === "dual")) score += 10;
    if (entry.seeders) score += Math.min(12, Math.floor(entry.seeders / 8));
    const item = {
      id: entry.viewUrl || `at-${Buffer.from(entry.title).toString("base64url").slice(0, 18)}`,
      title: entry.title,
      releaseGroup: entry.releaseGroup,
      episode,
      isBatch: epClass.isBatch,
      quality,
      audioType,
      fileSize: entry.fileSize,
      seeders: entry.seeders,
      viewUrl: entry.viewUrl,
      anidbId: entry.anidbId,
      seriesMatchedById,
      directMirrors: entry.directMirrors,
      torrentUrl: entry.torrentUrl,
      magnetUrl: entry.magnetUrl,
      source: "animetosho",
      matchScore: score
    };
    if (epClass.isBatch) {
      matchedBatches.push(item);
    } else {
      matchedSingles.push(item);
    }
  }
  const seenNormalizedTitles = new Set(
    matchedSingles.map((r) => r.title.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );
  for (const extra of [...nyaaRes.singles, ...nekowebRes.singles, ...subsPleaseResults]) {
    const norm = extra.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seenNormalizedTitles.has(norm)) {
      seenNormalizedTitles.add(norm);
      matchedSingles.push(extra);
    }
  }
  const seenBatchTitles = new Set(
    matchedBatches.map((r) => r.title.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );
  for (const batch of [...nyaaRes.batches, ...nekowebRes.batches]) {
    const norm = batch.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seenBatchTitles.has(norm)) {
      seenBatchTitles.add(norm);
      matchedBatches.push(batch);
    }
  }
  matchedSingles.sort((a, b) => b.matchScore - a.matchScore);
  matchedBatches.sort((a, b) => b.matchScore - a.matchScore);
  const enrichTargets = matchedSingles.filter((r) => r.source === "animetosho" && r.viewUrl && r.directMirrors.length === 0).slice(0, 4);
  if (enrichTargets.length > 0) {
    await Promise.all(
      enrichTargets.map(async (target) => {
        if (!target.viewUrl) return;
        const mirrors = await enrichMirrorsFromViewPage(target.viewUrl, fetchImpl);
        if (mirrors.length > 0) {
          target.directMirrors = mirrors;
        }
      })
    );
  }
  const verifiedLiveMirrorsCount = await verifyAndFilterDirectMirrors(matchedSingles, fetchImpl);
  const workingSingles = matchedSingles.filter(
    (r) => r.directMirrors.length > 0 || Boolean(r.torrentUrl) || Boolean(r.magnetUrl)
  );
  const workingBatches = matchedBatches.filter(
    (r) => r.directMirrors.length > 0 || Boolean(r.torrentUrl) || Boolean(r.magnetUrl)
  );
  workingSingles.sort((a, b) => b.matchScore - a.matchScore);
  workingBatches.sort((a, b) => b.matchScore - a.matchScore);
  const sourcesChecked = ["AnimeTosho", "Nyaa", "NekoBT", "SubsPlease"];
  const result = {
    ok: true,
    animeTitle: primaryTitle,
    episode,
    audio,
    anilistId: ids.anilistId,
    malId: ids.malId,
    anidbId: ids.anidbId,
    identityVerified: Boolean(ids.anidbId),
    sourcesChecked,
    verifiedLiveMirrorsCount,
    results: workingSingles.slice(0, 14),
    batches: workingBatches.slice(0, 4)
  };
  if (!options?.bypassCache) {
    downloadSearchCache.set(cacheKey, result);
  }
  return result;
}
export {
  classifyEpisodeRelease,
  decodeHtmlEntities,
  detectReleaseAudio,
  detectReleaseQuality,
  extractKwikFileMetadata,
  extractMirrorsFromHtmlFragment,
  extractNekostreamRedirectUrl,
  fetchNekoBtReleases,
  fetchNyaaReleases,
  normalizeDownloadSourceInput,
  parseAnimeToshoEntries,
  resolveAnimeDownloadSource,
  resolveExactAnimeIds,
  scoreTitleMatch,
  searchAnimeEpisodeDownloads,
  verifySingleDirectMirror
};
