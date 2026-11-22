import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Star,
  Plus,
  Check,
  Film,
  Clock,
  ChevronDown,
  Tv,
  Users,
  Download,
} from 'lucide-react';
import { AnimeMedia, WatchStatus } from '../types/anime';
import { getAnimeDetails } from '../services/anilist';
import { useWatchlist } from '../context/WatchlistContext';
import { cleanHtmlDescription, formatTimeUntilAiring } from '../utils/text';
import { computeEpisodeMetadata } from '../utils/validation';

interface AnimeDetailModalProps {
  anime: AnimeMedia | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayEpisode: (anime: AnimeMedia, episode: number) => void;
  onSelectAnime: (anime: AnimeMedia) => void;
  onOpenDownload?: (anime: AnimeMedia, episode: number) => void;
}

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({
  anime,
  isOpen,
  onClose,
  onPlayEpisode,
  onSelectAnime,
  onOpenDownload,
}) => {
  const [detailedAnime, setDetailedAnime] = useState<AnimeMedia | null>(null);
  const [expandedSynopsis, setExpandedSynopsis] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const { isInWatchlist, getEntry, addToWatchlist, removeFromWatchlist, updateStatus } = useWatchlist();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    setPosterError(false);
    setBannerError(false);
    setBrokenImages({});
    if (!isOpen || !anime) {
      setDetailedAnime(null);
      return;
    }

    let isMounted = true;

    getAnimeDetails(anime.id)
      .then((res) => {
        if (isMounted) {
          setDetailedAnime(res || anime);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDetailedAnime(anime);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, anime]);

  if (!isOpen || !anime) return null;

  const current = detailedAnime || anime;
  const englishTitle = current.title?.english || current.title?.romaji || 'Anime Details';
  const romajiTitle = current.title?.romaji || '';
  const nativeTitle = current.title?.native;
  const score = current.averageScore ? (current.averageScore / 10).toFixed(1) : null;
  const inWatchlist = isInWatchlist(current.id);
  const watchlistEntry = getEntry(current.id);
  const epMeta = computeEpisodeMetadata(current);

  const cleanDescription = cleanHtmlDescription(current.description);

  const handleStatusChange = (status: WatchStatus) => {
    if (!inWatchlist) {
      addToWatchlist(current, status);
    } else {
      updateStatus(current.id, status);
    }
    setShowStatusDropdown(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={englishTitle}
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex justify-center items-start p-2 sm:p-4 md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-[#0c0e14] border border-[#1e2333] rounded-2xl overflow-hidden shadow-2xl my-auto"
      >
        <button
          onClick={onClose}
          aria-label="Close anime details"
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero Backdrop Banner */}
        <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-[#141721]">
          {current.bannerImage && !bannerError ? (
            <img
              src={current.bannerImage}
              alt={englishTitle}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setBannerError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-violet-950 via-[#101420] to-[#0c0e14]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e14] via-[#0c0e14]/50 to-transparent" />
        </div>

        {/* Main Info Body */}
        <div className="px-5 sm:px-8 pb-8 pt-0 -mt-16 sm:-mt-24 relative z-10">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-36 sm:w-48 shrink-0 mx-auto md:mx-0">
              <div className="aspect-[2/3] w-full rounded-xl overflow-hidden border-2 border-[#232738] shadow-xl bg-[#141721] flex items-center justify-center">
                {(current.coverImage?.extraLarge || current.coverImage?.large) && !posterError ? (
                  <img
                    src={current.coverImage?.extraLarge || current.coverImage?.large}
                    alt={englishTitle}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setPosterError(true)}
                  />
                ) : (
                  <Tv className="w-10 h-10 text-slate-500" />
                )}
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-300 bg-[#12151f] p-3 rounded-xl border border-[#1e2333]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Format:</span>
                  <span className="font-semibold text-white">{current.format || 'TV'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-semibold text-white">{current.status || 'Finished'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Episodes:</span>
                  <span className="font-mono text-white">{epMeta.displayTotalLabel}</span>
                </div>
                {current.duration && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Duration:</span>
                    <span className="font-mono text-white">{current.duration} min</span>
                  </div>
                )}
                {current.seasonYear && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Season:</span>
                    <span className="text-white capitalize">
                      {current.season?.toLowerCase()} {current.seasonYear}
                    </span>
                  </div>
                )}
                {current.studios?.nodes && current.studios.nodes.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Studio:</span>
                    <span className="text-violet-300 font-medium truncate max-w-[100px]">
                      {current.studios.nodes[0].name}
                    </span>
                  </div>
                )}
              </div>

              {current.nextAiringEpisode && (
                <div className="mt-3 p-2.5 rounded-xl bg-violet-950/30 border border-violet-500/30 text-xs text-violet-200">
                  <p className="font-medium flex items-center gap-1 text-[11px] text-violet-300">
                    <Clock className="w-3.5 h-3.5 text-violet-400" />
                    Episode {current.nextAiringEpisode.episode} Airing in:
                  </p>
                  <p className="font-mono font-bold mt-1 text-white">
                    {formatTimeUntilAiring(current.nextAiringEpisode.timeUntilAiring)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                {nativeTitle && (
                  <p className="text-xs text-slate-400 tracking-wider font-light">
                    {nativeTitle}
                  </p>
                )}
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mt-0.5">
                  {englishTitle}
                </h1>
                {romajiTitle && romajiTitle !== englishTitle && (
                  <p className="text-xs text-slate-400 mt-0.5">{romajiTitle}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
                {score && (
                  <span className="flex items-center gap-1 text-amber-400 font-mono tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {score} / 10
                  </span>
                )}
                {score && <span aria-hidden="true" className="text-slate-600">·</span>}
                <span>{current.format || 'TV Series'}</span>
                {current.seasonYear && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>{current.seasonYear}</span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {(current.genres || []).map((genre, idx) => (
                  <React.Fragment key={genre}>
                    {idx > 0 && <span aria-hidden="true" className="text-slate-600">·</span>}
                    <span className="text-slate-300">{genre}</span>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => {
                    onClose();
                    onPlayEpisode(current, epMeta.isMovie ? 1 : watchlistEntry?.currentEpisode || 1);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all shadow-lg shadow-violet-600/30 whitespace-nowrap shrink-0 group active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                  <span>
                    {epMeta.isMovie
                      ? 'Watch Movie'
                      : watchlistEntry?.currentEpisode && watchlistEntry.currentEpisode > 1
                      ? `Resume Episode ${watchlistEntry.currentEpisode}`
                      : 'Watch Episode 1'}
                  </span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      inWatchlist
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#141721] border-[#232738] text-slate-200 hover:text-white hover:bg-[#1a1f2e]'
                    }`}
                  >
                    {inWatchlist ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="capitalize">{watchlistEntry?.status.replace('_', ' ')}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-slate-400" />
                        <span>Watchlist</span>
                      </>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400" />
                  </button>

                  {showStatusDropdown && (
                    <div className="absolute left-0 mt-1 w-44 rounded-xl bg-[#141721] border border-[#232738] shadow-2xl py-1 z-30 text-xs">
                      <button
                        onClick={() => handleStatusChange('watching')}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:bg-violet-600 hover:text-white"
                      >
                        Watching
                      </button>
                      <button
                        onClick={() => handleStatusChange('plan_to_watch')}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:bg-violet-600 hover:text-white"
                      >
                        Plan to Watch
                      </button>
                      <button
                        onClick={() => handleStatusChange('completed')}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:bg-violet-600 hover:text-white"
                      >
                        Completed
                      </button>
                      {inWatchlist && (
                        <button
                          onClick={() => {
                            removeFromWatchlist(current.id);
                            setShowStatusDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-950/50 border-t border-[#1e2333]"
                        >
                          Remove from Watchlist
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {onOpenDownload && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenDownload(
                        current,
                        epMeta.isMovie ? 1 : watchlistEntry?.currentEpisode || 1
                      )
                    }
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 hover:text-white text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Download</span>
                  </button>
                )}

                {current.trailer?.id && (
                  <a
                    href={`https://www.youtube.com/watch?v=${current.trailer.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#141721] border border-[#232738] text-slate-300 hover:text-white hover:bg-[#1a1f2e] text-sm font-medium transition-colors"
                  >
                    <Film className="w-4 h-4 text-amber-400" />
                    <span>Trailer</span>
                  </a>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Synopsis
                </h3>
                <p
                  className={`text-sm text-slate-300 leading-relaxed whitespace-pre-line ${
                    !expandedSynopsis ? 'line-clamp-4' : ''
                  }`}
                >
                  {cleanDescription || 'No description available for this anime.'}
                </p>
                {cleanDescription.length > 280 && (
                  <button
                    onClick={() => setExpandedSynopsis(!expandedSynopsis)}
                    className="text-xs text-violet-400 hover:text-violet-300 font-medium mt-1"
                  >
                    {expandedSynopsis ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>

              {current.characters?.edges && current.characters.edges.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Characters & Voice Cast
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {current.characters.edges.slice(0, 4).map((char, idx) => {
                      const va = char.voiceActors?.[0];
                      const castKey = `cast-${idx}`;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-lg bg-[#12151f] border border-[#1e2333]"
                        >
                          <div className="w-10 h-10 rounded-md bg-[#1c2130] shrink-0 overflow-hidden flex items-center justify-center">
                            {char.node.image?.medium && !brokenImages[castKey] ? (
                              <img
                                src={char.node.image.medium}
                                alt={char.node.name.full}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setBrokenImages((prev) => ({ ...prev, [castKey]: true }))
                                }
                              />
                            ) : (
                              <Users className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div className="overflow-hidden text-[11px]">
                            <p className="font-semibold text-slate-200 truncate">
                              {char.node.name.full}
                            </p>
                            <p className="text-slate-400 truncate">
                              {va?.name.full || char.role}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {current.recommendations?.nodes && current.recommendations.nodes.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    You Might Also Like
                  </h3>
                  <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                    {current.recommendations.nodes.slice(0, 6).map((rec, idx) => {
                      const recMedia = rec.mediaRecommendation;
                      if (!recMedia) return null;
                      const recKey = `rec-${recMedia.id}`;
                      return (
                        <button
                          key={idx}
                          onClick={() => onSelectAnime(recMedia as AnimeMedia)}
                          className="shrink-0 w-24 text-left group"
                        >
                          <div className="aspect-[2/3] w-full rounded-lg overflow-hidden bg-[#181c29] border border-[#232738] group-hover:border-violet-500 flex items-center justify-center">
                            {recMedia.coverImage?.large && !brokenImages[recKey] ? (
                              <img
                                src={recMedia.coverImage.large}
                                alt={recMedia.title?.romaji || 'Anime'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setBrokenImages((prev) => ({ ...prev, [recKey]: true }))
                                }
                              />
                            ) : (
                              <Tv className="w-5 h-5 text-slate-500" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 group-hover:text-violet-300 truncate mt-1">
                            {recMedia.title?.english || recMedia.title?.romaji}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
