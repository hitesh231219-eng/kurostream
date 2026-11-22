import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Download,
  Link2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Trash2,
  ArrowRight,
  ShieldCheck,
  BookmarkPlus,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  HardDriveDownload,
  Package,
  Magnet,
} from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import {
  DOWNLOADS_UPDATED_EVENT,
  EpisodeDownloadRelease,
  loadSavedEpisodeDownloads,
  openResolvedDownloadTarget,
  removeSavedEpisodeDownload,
  resolveAnimeDownload,
  ResolvedDownloadSource,
  SavedEpisodeDownload,
  saveEpisodeDownload,
  searchAnimeDownloads,
  SearchAnimeDownloadsResponse,
} from '../services/downloads';

interface AnimeDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  anime?: AnimeMedia | null;
  initialEpisode?: number;
  initialAudio?: 'sub' | 'dub';
}

const QUALITY_OPTIONS: Array<'1080p' | '720p' | '480p' | '360p'> = ['1080p', '720p', '480p', '360p'];

export const AnimeDownloadModal: React.FC<AnimeDownloadModalProps> = ({
  isOpen,
  onClose,
  anime = null,
  initialEpisode = 1,
  initialAudio = 'sub',
}) => {
  const [activeTab, setActiveTab] = useState<'episode-search' | 'pahe-tracer'>('episode-search');
  const [sourceInput, setSourceInput] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [episode, setEpisode] = useState<number>(Math.max(1, initialEpisode));
  const [audio, setAudio] = useState<'sub' | 'dub'>(initialAudio);
  const [quality, setQuality] = useState<'1080p' | '720p' | '480p' | '360p'>('1080p');

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<SearchAnimeDownloadsResponse | null>(null);
  const [searchRefreshKey, setSearchRefreshKey] = useState<number>(0);

  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolved, setResolved] = useState<ResolvedDownloadSource | null>(null);

  const [savedList, setSavedList] = useState<SavedEpisodeDownload[]>(() =>
    loadSavedEpisodeDownloads()
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<'anime' | 'all'>(anime ? 'anime' : 'all');

  // Reset modal controls cleanly whenever opened or switching anime
  useEffect(() => {
    if (!isOpen) return;
    setEpisode(Math.max(1, initialEpisode || 1));
    setAudio(initialAudio);
    setQueueFilter(anime ? 'anime' : 'all');
    setResolved(null);
    setSourceInput('');
    setSearchResult(null);
    setActiveTab('episode-search');
    if (anime) {
      setCustomTitle(anime.title.english || anime.title.romaji || '');
    } else {
      setCustomTitle('');
    }
  }, [isOpen, anime?.id, initialEpisode, initialAudio]);

  // Automatic exact per-anime, per-episode search whenever anime / episode / audio / quality changes
  useEffect(() => {
    if (!isOpen || activeTab !== 'episode-search') return;

    const queryTitle = anime
      ? anime.title.english || anime.title.romaji || ''
      : customTitle.trim();

    if (!queryTitle) {
      setSearchResult(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);

    searchAnimeDownloads(
      {
        anilistId: anime?.id ?? null,
        malId: anime?.idMal ?? null,
        title: queryTitle,
        englishTitle: anime?.title.english ?? null,
        romajiTitle: anime?.title.romaji ?? null,
        episode: Math.max(1, episode || 1),
        audio,
        quality,
      },
      controller.signal
    ).then((res) => {
      if (controller.signal.aborted) return;
      setSearchResult(res);
      setIsSearching(false);
    });

    return () => controller.abort();
  }, [
    isOpen,
    activeTab,
    anime?.id,
    anime?.idMal,
    anime?.title.english,
    anime?.title.romaji,
    episode,
    audio,
    quality,
    searchRefreshKey,
  ]);

  useEffect(() => {
    const sync = () => setSavedList(loadSavedEpisodeDownloads());
    window.addEventListener(DOWNLOADS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(DOWNLOADS_UPDATED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const filteredDownloads = useMemo(() => {
    if (queueFilter === 'anime' && anime) {
      return savedList.filter((item) => item.animeId === anime.id);
    }
    return savedList;
  }, [savedList, queueFilter, anime]);

  if (!isOpen) return null;

  const activeTitle =
    (anime ? anime.title.english || anime.title.romaji : customTitle.trim()) ||
    'Anime Episode Downloads';

  const handleManualSearch = () => {
    if (!customTitle.trim() && !anime) return;
    setSearchRefreshKey((k) => k + 1);
  };

  const handleTrace = async (overrideInput?: string) => {
    const target = (overrideInput ?? sourceInput).trim();
    if (!target) return;
    if (overrideInput !== undefined) {
      setSourceInput(overrideInput);
    }
    setIsResolving(true);
    const result = await resolveAnimeDownload(target);
    setResolved(result);
    setIsResolving(false);
  };

  const handleCopy = (value: string, key: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  };

  const handleSaveTracedToQueue = () => {
    if (!resolved?.ok || !resolved.resolvedUrl) return;
    const next = saveEpisodeDownload({
      animeId: anime?.id ?? null,
      animeTitle: resolved.fileName || activeTitle,
      coverImage: anime?.coverImage?.large || anime?.coverImage?.medium,
      episode: Math.max(1, episode || 1),
      audio,
      quality,
      inputUrl: resolved.normalizedUrl,
      resolvedUrl: resolved.resolvedUrl,
      directDownloadUrl: resolved.directDownloadUrl,
      paheId: resolved.paheId,
      kwikFileId: resolved.kwikFileId,
      sourceProvider: resolved.sourceProvider,
      adGateBypassed: resolved.adGateBypassed,
    });
    setSavedList(next);
  };

  const handleSaveReleaseToQueue = (release: EpisodeDownloadRelease, targetUrl: string, hostLabel: string) => {
    if (!targetUrl) return;
    const resolvedQuality =
      release.quality === '720p' || release.quality === '480p' || release.quality === '360p'
        ? release.quality
        : '1080p';
    const next = saveEpisodeDownload({
      animeId: anime?.id ?? null,
      animeTitle: activeTitle,
      coverImage: anime?.coverImage?.large || anime?.coverImage?.medium,
      episode: Math.max(1, episode || 1),
      audio: release.audioType === 'dub' ? 'dub' : audio,
      quality: resolvedQuality,
      inputUrl: release.viewUrl || targetUrl,
      resolvedUrl: targetUrl,
      directDownloadUrl: targetUrl,
      paheId: null,
      kwikFileId: null,
      sourceProvider: hostLabel.toLowerCase(),
      adGateBypassed: true,
    });
    setSavedList(next);
  };

  const downloadTargetUrl = resolved?.directDownloadUrl || resolved?.resolvedUrl || null;
  const maxEp = anime?.episodes || undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Anime Episode Downloads"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-[#0c0e14] border border-[#1e2333] rounded-2xl shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#10131c] border-b border-[#1b2030] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-violet-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {anime ? activeTitle : 'Episode Download Manager'}
                </h2>
                {searchResult?.identityVerified && searchResult.anidbId && (
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md shrink-0">
                    Verified Series · AniDB #{searchResult.anidbId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {anime
                  ? `Episode ${episode} · ${audio.toUpperCase()} · Exact Series Matched Mirrors`
                  : 'Search any anime title & episode for direct download mirrors or trace a NekoStream Pahe link'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close download modal"
            className="w-8 h-8 rounded-full bg-[#161a26] hover:bg-[#22283a] text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-5 pt-3 bg-[#0e1119] border-b border-[#191e2e] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('episode-search')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'episode-search'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>Episode Mirrors (Auto-Matched)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pahe-tracer')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'pahe-tracer'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>NekoStream Pahe Link Tracer</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Controls Bar */}
          <div className="bg-[#11141e] border border-[#1d2234] rounded-xl p-4 space-y-3.5">
            {!anime && activeTab === 'episode-search' && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualSearch();
                  }}
                  placeholder="Enter anime title (e.g. Sousou no Frieren, Dandadan)..."
                  className="flex-1 bg-[#090b10] border border-[#242a3d] rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  disabled={isSearching || !customTitle.trim()}
                  onClick={handleManualSearch}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 shrink-0"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Find Episode</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                  Episode
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous episode"
                    disabled={episode <= 1}
                    onClick={() => setEpisode((e) => Math.max(1, e - 1))}
                    className="p-1.5 rounded-lg bg-[#090b10] border border-[#242a3d] text-slate-300 hover:text-white disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={maxEp || 5000}
                    value={episode}
                    onChange={(e) =>
                      setEpisode(Math.max(1, Math.min(maxEp || 5000, Number(e.target.value) || 1)))
                    }
                    className="w-full bg-[#090b10] border border-[#242a3d] rounded-lg px-2.5 py-1.5 text-xs text-center text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    aria-label="Next episode"
                    disabled={Boolean(maxEp && episode >= maxEp)}
                    onClick={() =>
                      setEpisode((e) => Math.min(maxEp || 5000, e + 1))
                    }
                    className="p-1.5 rounded-lg bg-[#090b10] border border-[#242a3d] text-slate-300 hover:text-white disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                  Audio Track
                </label>
                <div className="grid grid-cols-2 gap-1 bg-[#090b10] p-0.5 rounded-lg border border-[#242a3d]">
                  {(['sub', 'dub'] as const).map((track) => (
                    <button
                      key={track}
                      type="button"
                      onClick={() => setAudio(track)}
                      className={`py-1.5 rounded text-[11px] font-semibold uppercase transition-colors ${
                        audio === track
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {track}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                  Preferred Quality
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as any)}
                  className="w-full bg-[#090b10] border border-[#242a3d] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
                >
                  {QUALITY_OPTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TAB 1: Automatic Exact Episode Downloads */}
          {activeTab === 'episode-search' && (
            <div className="space-y-4">
              {isSearching ? (
                <div className="bg-[#10131c] border border-[#1d2234] rounded-xl p-7 flex flex-col items-center justify-center gap-2.5 text-slate-300">
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                  <p className="text-xs sm:text-sm font-medium">
                    Resolving exact AniDB series identity & episode {episode} mirrors for{' '}
                    <span className="text-white font-semibold">{activeTitle}</span>...
                  </p>
                </div>
              ) : searchResult && !searchResult.ok && searchResult.error ? (
                <div className="rounded-xl border border-rose-500/35 bg-rose-950/20 p-4 flex items-center gap-2.5 text-xs text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{searchResult.error}</span>
                </div>
              ) : searchResult && searchResult.results.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Verified Episode {searchResult.episode} Downloads ({searchResult.results.length})
                      </h3>
                      {searchResult.sourcesChecked && searchResult.sourcesChecked.length > 0 && (
                        <span className="text-[10px] font-mono text-slate-400 bg-[#141826] border border-[#22293f] px-2 py-0.5 rounded">
                          {searchResult.sourcesChecked.join(' · ')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSearchRefreshKey((k) => k + 1)}
                      className="text-[11px] text-violet-300 hover:text-white underline underline-offset-2"
                    >
                      Refresh &amp; re-verify
                    </button>
                  </div>

                  {searchResult.results.map((rel) => {
                    const primaryMirror =
                      rel.directMirrors.find((m) => m.verified === 'live') || rel.directMirrors[0];
                    const primaryTarget =
                      primaryMirror?.url || rel.torrentUrl || rel.magnetUrl || rel.viewUrl || '';
                    const sourceLabel =
                      rel.source === 'nyaa'
                        ? 'Nyaa'
                        : rel.source === 'nekobt'
                        ? 'NekoBT'
                        : rel.source === 'subsplease'
                        ? 'SubsPlease'
                        : 'AnimeTosho';
                    return (
                      <div
                        key={rel.id}
                        className="p-3.5 rounded-xl bg-[#111520] border border-[#1f263b] hover:border-violet-500/40 transition-colors space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs sm:text-sm font-semibold text-white break-words">
                              {rel.title}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                {sourceLabel}
                              </span>
                              {rel.releaseGroup && (
                                <span className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
                                  {rel.releaseGroup}
                                </span>
                              )}
                              {rel.quality !== 'unknown' && (
                                <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  {rel.quality}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase">
                                {rel.audioType === 'dual'
                                  ? 'Dual Audio'
                                  : rel.audioType === 'dub'
                                  ? 'ENG Dub'
                                  : 'Sub'}
                              </span>
                              {rel.fileSize && (
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {rel.fileSize}
                                </span>
                              )}
                              {rel.seeders !== null && (
                                <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/40">
                                  {rel.seeders} seeders
                                </span>
                              )}
                            </div>
                          </div>

                          {primaryTarget && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSaveReleaseToQueue(
                                    rel,
                                    primaryTarget,
                                    primaryMirror?.host || sourceLabel
                                  )
                                }
                                title="Save to Episode Queue"
                                className="px-2.5 py-1.5 rounded-lg bg-[#161b29] hover:bg-[#1f263b] border border-[#273049] text-violet-300 hover:text-white text-[11px] font-medium flex items-center gap-1"
                              >
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                <span>Queue</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Live-Verified Direct HTTP File-Host Mirrors & Active .torrent / Magnet */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {rel.directMirrors.map((m) => (
                            <button
                              key={m.url}
                              type="button"
                              onClick={() => openResolvedDownloadTarget(m.url)}
                              title={
                                m.verified === 'live'
                                  ? 'Live HTTP 200 verified mirror'
                                  : 'Cloudflare/browser-checked file host'
                              }
                              className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                m.verified === 'live'
                                  ? 'bg-emerald-600 hover:bg-emerald-500'
                                  : 'bg-[#1a2234] hover:bg-[#232d45] border border-[#2d3958]'
                              }`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{m.host}</span>
                              {m.verified === 'live' && (
                                <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                              )}
                              <ExternalLink className="w-3 h-3 opacity-80" />
                            </button>
                          ))}

                          {rel.torrentUrl && (
                            <button
                              type="button"
                              onClick={() => openResolvedDownloadTarget(rel.torrentUrl!)}
                              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>.torrent</span>
                            </button>
                          )}

                          {rel.magnetUrl && (
                            <button
                              type="button"
                              onClick={() => openResolvedDownloadTarget(rel.magnetUrl!)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#161b29] hover:bg-[#20273b] border border-[#28314b] text-slate-200 text-[11px] font-medium transition-colors flex items-center gap-1"
                            >
                              <Magnet className="w-3 h-3 text-amber-400" />
                              <span>Magnet</span>
                            </button>
                          )}

                          {primaryTarget && (
                            <button
                              type="button"
                              onClick={() => handleCopy(primaryTarget, rel.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1c2132] border border-[#262d42] text-slate-300 text-[11px] transition-colors flex items-center gap-1"
                            >
                              {copiedKey === rel.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : searchResult ? (
                <div className="bg-[#10131c] border border-dashed border-[#22283a] rounded-xl p-5 text-center space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-slate-200">
                    No single-episode mirror matched for {activeTitle} · Episode {episode}.
                  </p>
                  <p className="text-xs text-slate-400">
                    Try adjusting the episode number or check a season pack below / paste a direct{' '}
                    <span className="font-mono text-slate-300">pahe.nekostream.site</span> link in the Tracer tab.
                  </p>
                </div>
              ) : null}

              {/* Optional Verified Season Batches */}
              {searchResult && searchResult.batches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span>Full Season / Batch Packs (Verified Series)</span>
                  </h4>
                  <div className="space-y-1.5">
                    {searchResult.batches.map((batch) => (
                      <div
                        key={batch.id}
                        className="p-3 rounded-xl bg-[#0f131d] border border-[#1d2336] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{batch.title}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {batch.quality} · {batch.fileSize || 'Batch'}{' '}
                            {batch.seeders !== null ? `· ${batch.seeders} seeders` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {batch.viewUrl && (
                            <button
                              type="button"
                              onClick={() => openResolvedDownloadTarget(batch.viewUrl!)}
                              className="px-2.5 py-1 rounded-lg bg-[#181e2e] hover:bg-[#222a40] text-violet-300 text-[11px] font-semibold"
                            >
                              Mirrors
                            </button>
                          )}
                          {batch.torrentUrl && (
                            <button
                              type="button"
                              onClick={() => openResolvedDownloadTarget(batch.torrentUrl!)}
                              className="px-2.5 py-1 rounded-lg bg-[#181e2e] hover:bg-[#222a40] text-slate-200 text-[11px]"
                            >
                              .torrent
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Explicit NekoStream Pahe Direct Link Tracer */}
          {activeTab === 'pahe-tracer' && (
            <div className="space-y-4">
              <div className="bg-[#11141e] border border-[#1d2234] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Link2 className="w-3.5 h-3.5 text-violet-400" />
                  <span>Paste NekoStream Pahe Link or Short ID for {activeTitle} · Ep {episode}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Only trace links matching this exact episode. KuroStream bypasses the NekoStream ad gate cleanly and resolves the direct Kwik file host URL.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sourceInput}
                    onChange={(e) => setSourceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleTrace();
                    }}
                    placeholder="Paste https://pahe.nekostream.site/<id> or short ID..."
                    className="flex-1 bg-[#090b10] border border-[#242a3d] rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    disabled={isResolving || !sourceInput.trim()}
                    onClick={() => void handleTrace()}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    {isResolving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Tracing...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Trace Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {resolved && (
                <div
                  className={`rounded-xl border p-4 space-y-3 ${
                    resolved.ok
                      ? 'bg-emerald-950/20 border-emerald-500/35'
                      : 'bg-rose-950/25 border-rose-500/35'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {resolved.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="text-xs sm:text-sm font-bold text-white">
                        {resolved.ok
                          ? `Resolved Direct Source (${resolved.sourceHost || 'kwik.cx'})`
                          : resolved.error || 'Could not resolve download source'}
                      </span>
                    </div>

                    {resolved.ok && resolved.adGateBypassed && (
                      <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                        Ad-Gate Bypassed
                      </span>
                    )}
                  </div>

                  {resolved.hops.length > 0 && (
                    <div className="space-y-1.5 bg-[#090b10]/80 border border-[#1c2233] rounded-lg p-3">
                      {resolved.hops.map((hop) => (
                        <div
                          key={`${hop.step}-${hop.url}`}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-violet-400 shrink-0">#{hop.step}</span>
                            <span className="font-mono text-slate-200 truncate">{hop.url}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                            <ArrowRight className="w-3 h-3 text-slate-500 hidden sm:inline" />
                            <span>{hop.note}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {resolved.ok && downloadTargetUrl && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openResolvedDownloadTarget(downloadTargetUrl)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {resolved.directDownloadUrl
                            ? 'Direct Download MP4'
                            : 'Open Kwik Download Page'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(downloadTargetUrl, 'resolved')}
                        className="px-3 py-2 rounded-lg bg-[#141824] hover:bg-[#1c2132] border border-[#262d42] text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        {copiedKey === 'resolved' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Source URL</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveTracedToQueue}
                        className="px-3 py-2 rounded-lg bg-[#141824] hover:bg-[#1c2132] border border-[#262d42] text-violet-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>Save to Episode Queue</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Saved Episode Download Queue */}
          <div className="space-y-2.5 pt-1 border-t border-[#181d2c]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Saved Download Queue ({filteredDownloads.length})
              </h3>
              {anime && (
                <div className="flex items-center gap-1 text-[11px] bg-[#121622] p-0.5 rounded-lg border border-[#20263a]">
                  <button
                    type="button"
                    onClick={() => setQueueFilter('anime')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      queueFilter === 'anime'
                        ? 'bg-violet-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    This Anime
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('all')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      queueFilter === 'all'
                        ? 'bg-violet-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({savedList.length})
                  </button>
                </div>
              )}
            </div>

            {filteredDownloads.length === 0 ? (
              <div className="bg-[#10131c] border border-dashed border-[#22283a] rounded-xl p-4 text-center text-xs text-slate-400">
                Click <strong className="text-slate-200">Queue</strong> on any verified episode mirror above to save direct download links per episode.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDownloads.map((item) => {
                  const target = item.directDownloadUrl || item.resolvedUrl;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-[#111520] border border-[#1d2336]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate max-w-[260px]">
                            {item.animeTitle}
                          </span>
                          <span className="text-[11px] font-mono text-violet-300">
                            Ep {item.episode} · {item.audio.toUpperCase()} · {item.quality}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          {target}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openResolvedDownloadTarget(target)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(target, item.id)}
                          className="p-1.5 rounded-lg bg-[#161b29] hover:bg-[#1f263a] border border-[#262e45] text-slate-300 hover:text-white transition-colors"
                          title="Copy resolved source URL"
                          aria-label="Copy resolved source URL"
                        >
                          {copiedKey === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSavedList(removeSavedEpisodeDownload(item.id))}
                          className="p-1.5 rounded-lg bg-[#161b29] hover:bg-rose-950/60 border border-[#262e45] text-slate-400 hover:text-rose-300 transition-colors"
                          title="Remove from queue"
                          aria-label="Remove saved download"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
