import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  SkipForward,
  SkipBack,
  Moon,
  Server,
  RefreshCw,
  ExternalLink,
  Search,
  ListFilter,
  Users,
  Expand,
  Film,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Puzzle,
  Download,
} from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import {
  fetchServerHealthStatuses,
  getServerDisplayName,
  isServerSupportedForMedia,
  resolveBestAvailableStream,
  ServerProbeStatus,
  STREAMING_SERVERS,
  StreamingServerType,
} from '../services/megaplay';
import {
  ADDON_UPDATED_EVENT,
  getCleanCoreMode,
  KuroAddonManifest,
  loadInstalledAddons,
  resolveAddonStreamUrl,
} from '../services/addons';
import { getAnimeDetails } from '../services/anilist';
import { computeEpisodeMetadata, parseVerifiedPlayerMessage } from '../utils/validation';
import { useWatchlist } from '../context/WatchlistContext';
import { useAuth } from '../context/AuthContext';

interface VideoPlayerModalProps {
  anime: AnimeMedia;
  initialEpisode?: number;
  isOpen: boolean;
  onClose: () => void;
  onOpenDetails?: (anime: AnimeMedia) => void;
  onStartWatchParty?: (anime: AnimeMedia, episode: number) => void;
  onOpenAddonsHub?: () => void;
  onOpenDownload?: (anime: AnimeMedia, episode: number, audio: 'sub' | 'dub') => void;
}

const VERIFIED_DWELL_SECONDS = 45;

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  anime,
  initialEpisode = 1,
  isOpen,
  onClose,
  onOpenDetails,
  onStartWatchParty,
  onOpenAddonsHub,
  onOpenDownload,
}) => {
  const { recordWatchHistory, getEntry, updatePlaybackTimestamp } = useWatchlist();
  const { user, addXp, incrementQuestProgress, updateProfile } = useAuth();

  const [resolvedAnime, setResolvedAnime] = useState<AnimeMedia>(anime);
  const [currentEpisode, setCurrentEpisode] = useState<number>(initialEpisode);
  const [audio, setAudio] = useState<'sub' | 'dub'>(user?.preferredAudio || 'sub');
  const [serverId, setServerId] = useState<StreamingServerType>(user?.preferredServer || 'anixo');
  const [failedServers, setFailedServers] = useState<Set<StreamingServerType>>(new Set());
  const [serverHealth, setServerHealth] = useState<Record<string, ServerProbeStatus>>({});
  const [failoverNotice, setFailoverNotice] = useState<string | null>(null);
  const [isTheater, setIsTheater] = useState<boolean>(false);
  const [autoNext, setAutoNext] = useState<boolean>(true);
  const [isLightOff, setIsLightOff] = useState<boolean>(false);
  const [episodeSearch, setEpisodeSearch] = useState<string>('');
  const [episodeRange, setEpisodeRange] = useState<number>(0);
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [dwellSeconds, setDwellSeconds] = useState<number>(0);
  const [resumeInfo, setResumeInfo] = useState<{ currentTimeSec: number; durationSec: number } | null>(null);
  const [isComplianceDelisted, setIsComplianceDelisted] = useState<boolean>(false);
  const [installedAddons, setInstalledAddons] = useState<KuroAddonManifest[]>(() =>
    loadInstalledAddons()
  );
  const [cleanCoreOnly, setCleanCoreOnly] = useState<boolean>(() => getCleanCoreMode());
  const [activeAddonId, setActiveAddonId] = useState<string | null>(null);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeAnime = resolvedAnime.id === anime.id ? resolvedAnime : anime;
  const epMeta = useMemo(() => computeEpisodeMetadata(activeAnime), [activeAnime]);

  // Keep volatile callbacks in refs so intervals/listeners never tear down mid-playback
  const addXpRef = useRef(addXp);
  addXpRef.current = addXp;
  const incrementQuestRef = useRef(incrementQuestProgress);
  incrementQuestRef.current = incrementQuestProgress;
  const updatePlaybackTimestampRef = useRef(updatePlaybackTimestamp);
  updatePlaybackTimestampRef.current = updatePlaybackTimestamp;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset state whenever modal opens or anime/initialEpisode changes
  useEffect(() => {
    if (!isOpen) return;
    const nextMeta = computeEpisodeMetadata(anime);
    setResolvedAnime(anime);
    setCurrentEpisode(nextMeta.isMovie ? 1 : Math.max(1, initialEpisode || 1));
    setFailedServers(new Set());
    setFailoverNotice(null);
    setDwellSeconds(0);
    setEpisodeRange(Math.floor(Math.max(0, (initialEpisode || 1) - 1) / 50));

    const existing = getEntry(anime.id);
    if (existing && existing.currentTimeSec && existing.currentTimeSec > 0) {
      setResumeInfo({
        currentTimeSec: existing.currentTimeSec,
        durationSec: existing.durationSec || 0,
      });
    } else {
      setResumeInfo(null);
    }

    // Enrich missing MAL ID / full metadata from AniList if needed
    if (!anime.idMal || anime.episodes === undefined) {
      let active = true;
      getAnimeDetails(anime.id)
        .then((full) => {
          if (active && full) setResolvedAnime(full);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [isOpen, anime.id, initialEpisode]);

  // Probe compliance delist status & streaming server health asynchronously when player opens
  useEffect(() => {
    if (!isOpen) return;
    setIsComplianceDelisted(false);
    let complianceActive = true;
    fetch(`/api/compliance/status?anilistId=${anime.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (complianceActive && data?.delisted) {
          setIsComplianceDelisted(true);
        }
      })
      .catch(() => {});

    // Probe streaming server health asynchronously when player opens
    let active = true;
    fetchServerHealthStatuses().then((list) => {
      if (!active || list.length === 0) return;
      const map: Record<string, ServerProbeStatus> = {};
      for (const item of list) {
        map[item.id] = item;
      }
      setServerHealth(map);
    });
    return () => {
      active = false;
      complianceActive = false;
    };
  }, [isOpen, anime.id]);

  // Keep installed Add-ons & Clean-Core mode synced live when modified
  useEffect(() => {
    const syncAddons = () => {
      setInstalledAddons(loadInstalledAddons());
      setCleanCoreOnly(getCleanCoreMode());
    };
    window.addEventListener(ADDON_UPDATED_EVENT, syncAddons);
    return () => window.removeEventListener(ADDON_UPDATED_EVENT, syncAddons);
  }, []);

  // Lock body scroll
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

  // Record history entry cleanly without prematurely granting XP
  useEffect(() => {
    if (isOpen && activeAnime) {
      recordWatchHistory(activeAnime, currentEpisode);
      setDwellSeconds(0);
    }
  }, [isOpen, activeAnime?.id, currentEpisode]);

  // Verified dwell timer: only grants episode XP after 45s of genuine active playback viewing
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setDwellSeconds((prev) => {
        const next = prev + 1;
        if (next === VERIFIED_DWELL_SECONDS) {
          const dedupeKey = `ep:${activeAnime.id}:${currentEpisode}`;
          const granted = addXpRef.current(
            50,
            `Verified Watch: ${activeAnime.title.english || activeAnime.title.romaji} (${epMeta.isMovie ? 'Movie' : `Ep. ${currentEpisode}`})`,
            dedupeKey,
            {
              episodesWatched: 1,
              watchMinutes: activeAnime.duration || 24,
            }
          );
          if (granted) {
            incrementQuestRef.current('watch');
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, activeAnime.id, currentEpisode, epMeta.isMovie]);

  // Strict stream resolution: only exclude unreachable mirrors when at least one compatible mirror is healthy
  const effectiveFailed = useMemo(() => {
    const merged = new Set<StreamingServerType>(failedServers);
    const hasHealthyCompatible = STREAMING_SERVERS.some((srv) => {
      const support = isServerSupportedForMedia(srv.id, activeAnime.id, activeAnime.idMal);
      const probed = serverHealth[srv.id];
      return support.supported && probed?.reachable === true;
    });
    if (hasHealthyCompatible) {
      for (const srv of STREAMING_SERVERS) {
        const probed = serverHealth[srv.id];
        if (probed && !probed.reachable) {
          merged.add(srv.id);
        }
      }
    }
    return merged;
  }, [failedServers, serverHealth, activeAnime.id, activeAnime.idMal]);

  const streamAddons = useMemo(
    () => installedAddons.filter((a) => a.enabled && Boolean(a.streamTemplate)),
    [installedAddons]
  );

  const selectedAddon = useMemo(() => {
    if (activeAddonId) {
      return streamAddons.find((a) => a.id === activeAddonId) || null;
    }
    if (cleanCoreOnly && streamAddons.length > 0) {
      return streamAddons[0];
    }
    return null;
  }, [activeAddonId, cleanCoreOnly, streamAddons]);

  const resolvedSource = useMemo(() => {
    if (selectedAddon) {
      const addonRes = resolveAddonStreamUrl(selectedAddon, {
        anilistId: activeAnime.id,
        malId: activeAnime.idMal,
        episode: currentEpisode,
        audio,
        accentColor: '8b5cf6',
        format: activeAnime.format,
      });
      return {
        available: addonRes.available,
        url: addonRes.url,
        reason: addonRes.reason,
        effectiveServerId: serverId,
        usedFailover: false,
      };
    }

    if (cleanCoreOnly) {
      return {
        available: false,
        url: null,
        reason: 'Clean-Core Mode is enabled. Install an external Add-On Manifest to load streams.',
        effectiveServerId: serverId,
        usedFailover: false,
      };
    }

    return resolveBestAvailableStream(
      {
        serverId,
        anilistId: activeAnime.id,
        malId: activeAnime.idMal,
        episode: currentEpisode,
        audio,
        accentColor: '8b5cf6',
        trailerId: activeAnime.trailer?.id,
        format: activeAnime.format,
      },
      effectiveFailed
    );
  }, [
    selectedAddon,
    cleanCoreOnly,
    serverId,
    activeAnime.id,
    activeAnime.idMal,
    activeAnime.trailer?.id,
    activeAnime.format,
    currentEpisode,
    audio,
    effectiveFailed,
  ]);

  useEffect(() => {
    if (resolvedSource.usedFailover && resolvedSource.reason) {
      setFailoverNotice(resolvedSource.reason);
    } else {
      setFailoverNotice(null);
    }
  }, [resolvedSource.usedFailover, resolvedSource.reason]);

  const knownEpisodeUpperBound = epMeta.isMovie
    ? 1
    : epMeta.totalEpisodes
    ? Math.max(epMeta.totalEpisodes, currentEpisode)
    : Math.max(24, currentEpisode + 12);

  const handleNextEpisode = () => {
    if (epMeta.isMovie) return;
    if (epMeta.episodesUnknown || currentEpisode < knownEpisodeUpperBound) {
      const nextEp = currentEpisode + 1;
      setCurrentEpisode(nextEp);
      setIframeKey((k) => k + 1);
    }
  };

  const handlePrevEpisode = () => {
    if (epMeta.isMovie) return;
    if (currentEpisode > 1) {
      const prevEp = currentEpisode - 1;
      setCurrentEpisode(prevEp);
      setIframeKey((k) => k + 1);
    }
  };

  const handleSelectEpisode = (ep: number) => {
    setCurrentEpisode(ep);
    setIframeKey((k) => k + 1);
  };

  const handleToggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleNextRef = useRef(handleNextEpisode);
  handleNextRef.current = handleNextEpisode;
  const handlePrevRef = useRef(handlePrevEpisode);
  handlePrevRef.current = handlePrevEpisode;

  const triggerManualFailover = () => {
    setFailedServers((prev) => {
      const next = new Set(prev);
      next.add(resolvedSource.effectiveServerId);
      if (next.size >= STREAMING_SERVERS.length) {
        return new Set(); // cycle cleanly back
      }
      return next;
    });
    setIframeKey((k) => k + 1);
  };

  // Origin + source + schema-validated postMessage listener ONLY active while player modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      const msg = parseVerifiedPlayerMessage(event, iframeRef.current?.contentWindow);
      if (!msg) return;

      if (msg.type === 'timeupdate' && typeof msg.data?.currentTime === 'number') {
        const dur = msg.data.duration || 0;
        setResumeInfo({ currentTimeSec: msg.data.currentTime, durationSec: dur });
        updatePlaybackTimestampRef.current(activeAnime.id, msg.data.currentTime, dur);

        // Verified >= 70% playback completion immediately unlocks episode XP
        if (dur > 60 && msg.data.currentTime / dur >= 0.7) {
          const dedupeKey = `ep:${activeAnime.id}:${currentEpisode}`;
          const granted = addXpRef.current(
            50,
            `Completed ${activeAnime.title.english || activeAnime.title.romaji} (Ep. ${currentEpisode})`,
            dedupeKey,
            { episodesWatched: 1, watchMinutes: Math.round(dur / 60) }
          );
          if (granted) incrementQuestRef.current('watch');
        }
      } else if (msg.type === 'error') {
        setFailedServers((prev) => {
          const next = new Set(prev);
          next.add(resolvedSource.effectiveServerId);
          return next;
        });
      } else if (msg.type === 'ended' && autoNext && !epMeta.isMovie) {
        if (epMeta.episodesUnknown || currentEpisode < knownEpisodeUpperBound) {
          handleNextRef.current();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, activeAnime.id, activeAnime.title, currentEpisode, knownEpisodeUpperBound, autoNext, epMeta.isMovie, epMeta.episodesUnknown, resolvedSource.effectiveServerId]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
      } else if (e.key === 't' || e.key === 'T') {
        setIsTheater((prev) => !prev);
      } else if (e.key === 'l' || e.key === 'L') {
        setIsLightOff((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFullscreen();
      } else if (e.key === 'n' || e.key === 'N') {
        handleNextRef.current();
      } else if (e.key === 'p' || e.key === 'P') {
        handlePrevRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const englishTitle = activeAnime.title.english || activeAnime.title.romaji;
  const userEntry = getEntry(activeAnime.id);
  const watchedEp = userEntry?.currentEpisode || 0;

  const episodesPerPage = 50;
  const totalRanges = Math.ceil(knownEpisodeUpperBound / episodesPerPage);
  const startEp = episodeRange * episodesPerPage + 1;
  const endEp = Math.min(knownEpisodeUpperBound, (episodeRange + 1) * episodesPerPage);

  const episodeNumbers = Array.from(
    { length: Math.max(0, endEp - startEp + 1) },
    (_, i) => startEp + i
  ).filter((ep) => {
    if (!episodeSearch.trim()) return true;
    return ep.toString().includes(episodeSearch.trim());
  });

  const formatDurationLabel = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.floor(sec % 60);
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Streaming ${englishTitle}`}
      className={`fixed inset-0 z-50 overflow-y-auto ${
        isLightOff ? 'bg-black' : 'bg-black/92 backdrop-blur-md'
      } transition-colors duration-200`}
    >
      <div
        className={`min-h-screen flex flex-col justify-center items-center py-4 px-2 sm:px-6 ${
          isTheater ? 'max-w-full' : 'max-w-7xl mx-auto'
        }`}
      >
        {/* Top Bar */}
        <div className="w-full flex items-center justify-between mb-3 text-slate-300 bg-[#0c0e14] border border-[#1d2232] px-4 py-2.5 rounded-xl">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-bold text-white text-sm sm:text-base truncate">{englishTitle}</h2>
            <span className="text-slate-600 hidden sm:inline">·</span>
            <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
              {epMeta.isMovie
                ? 'Feature Movie'
                : `Ep ${currentEpisode} / ${epMeta.displayTotalLabel}`}
            </span>
            {resumeInfo && resumeInfo.currentTimeSec > 10 && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                <Clock className="w-3 h-3" />
                Saved @ {formatDurationLabel(resumeInfo.currentTimeSec)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onStartWatchParty && (
              <button
                onClick={() => onStartWatchParty(activeAnime, currentEpisode)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141721] hover:bg-[#1b2030] border border-[#232738] text-xs font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Users className="w-3.5 h-3.5 text-violet-400" />
                <span>Watch Party</span>
              </button>
            )}

            <button
              onClick={() => setIsLightOff(!isLightOff)}
              className={`p-2 rounded-lg border text-xs transition-colors ${
                isLightOff
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#141721] text-slate-400 hover:text-white border-[#232738]'
              }`}
              aria-label="Toggle cinema lights"
              title="Lights Off (L)"
            >
              <Moon className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsTheater(!isTheater)}
              className={`p-2 rounded-lg border transition-colors ${
                isTheater
                  ? 'bg-violet-600/20 text-violet-300 border-violet-500/40'
                  : 'bg-[#141721] border-[#232738] text-slate-400 hover:text-white'
              }`}
              aria-label="Toggle theater mode"
              title="Theater Mode (T)"
            >
              {isTheater ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="p-2 rounded-lg bg-[#141721] border border-[#232738] text-slate-400 hover:text-white transition-colors hidden sm:block"
              aria-label="Fullscreen player"
              title="Fullscreen (F)"
            >
              <Expand className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#141721] border border-[#232738] text-slate-400 hover:text-white hover:border-rose-500/50 transition-colors"
              aria-label="Close player"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Automatic Failover Notification Banner */}
        {failoverNotice && (
          <div className="w-full mb-3 px-4 py-2 rounded-xl bg-amber-950/40 border border-amber-500/35 text-xs text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{failoverNotice}</span>
            </div>
            <span className="font-mono text-[11px] text-amber-300 shrink-0">
              Active: {getServerDisplayName(resolvedSource.effectiveServerId)}
            </span>
          </div>
        )}

        {/* Main Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          {/* Video Column */}
          <div className={`${isTheater || epMeta.isMovie ? 'lg:col-span-4' : 'lg:col-span-3'} flex flex-col gap-3`}>
            <div
              ref={playerContainerRef}
              className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#1d2232] shadow-2xl"
            >
              {isComplianceDelisted ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#0c0e14]">
                  <AlertTriangle className="w-8 h-8 text-amber-400" />
                  <p className="text-sm font-bold text-white">
                    Content Disabled Under Copyright Compliance
                  </p>
                  <p className="text-xs text-slate-400 max-w-md">
                    External playback references for this title (ID {activeAnime.id}) have been
                    disabled in accordance with a 17 U.S.C. § 512 takedown notice.
                  </p>
                </div>
              ) : resolvedSource.url ? (
                <iframe
                  ref={iframeRef}
                  key={`${resolvedSource.url}-${iframeKey}`}
                  src={resolvedSource.url}
                  title={`${englishTitle} - ${epMeta.isMovie ? 'Movie' : `Episode ${currentEpisode}`}`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="origin"
                  onError={triggerManualFailover}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#0c0e14]">
                  <AlertTriangle className="w-8 h-8 text-amber-400" />
                  <p className="text-sm font-bold text-white">
                    {cleanCoreOnly
                      ? 'Clean-Core Mode — External Add-On Required'
                      : 'No Compatible Stream Mirror Selected'}
                  </p>
                  <p className="text-xs text-slate-400 max-w-md">{resolvedSource.reason}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    {cleanCoreOnly && onOpenAddonsHub ? (
                      <button
                        onClick={onOpenAddonsHub}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
                      >
                        <Puzzle className="w-3.5 h-3.5" />
                        <span>Install Add-On Manifest</span>
                      </button>
                    ) : (
                      <button
                        onClick={triggerManualFailover}
                        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
                      >
                        Switch to Available AniList Mirror
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Playback & Server Switcher Bar */}
            <div className="bg-[#0c0e14] border border-[#1d2232] rounded-xl p-3 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Episode / Movie Navigation */}
                <div className="flex items-center gap-2">
                  {!epMeta.isMovie ? (
                    <>
                      <button
                        onClick={handlePrevEpisode}
                        disabled={currentEpisode <= 1}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141721] border border-[#232738] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <span className="font-mono px-3 py-1.5 rounded-lg bg-[#151925] border border-[#232738] text-white font-semibold tabular-nums">
                        Ep {currentEpisode}
                      </span>

                      <button
                        onClick={handleNextEpisode}
                        disabled={!epMeta.episodesUnknown && currentEpisode >= knownEpisodeUpperBound}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        <span>Next</span>
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setAutoNext(!autoNext)}
                        className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                          autoNext
                            ? 'bg-violet-600/15 border-violet-500/40 text-violet-300'
                            : 'bg-[#141721] border-[#232738] text-slate-400'
                        }`}
                      >
                        <span>Auto-Next: {autoNext ? 'On' : 'Off'}</span>
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-200 font-semibold">
                      <Film className="w-3.5 h-3.5" />
                      <span>Feature Film Stream</span>
                    </span>
                  )}

                  {/* Verified Watch XP Progress Indicator */}
                  <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#121622] border border-[#202638] text-[11px] font-mono text-slate-400">
                    {dwellSeconds >= VERIFIED_DWELL_SECONDS ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">XP Verified</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-violet-400" />
                        <span>XP in {VERIFIED_DWELL_SECONDS - dwellSeconds}s</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Audio Track & Stream Actions */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center p-1 bg-[#141721] rounded-lg border border-[#232738]">
                    <button
                      onClick={() => {
                        setAudio('sub');
                        updateProfile({ preferredAudio: 'sub' });
                        setIframeKey((k) => k + 1);
                      }}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        audio === 'sub' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      SUB
                    </button>
                    <button
                      onClick={() => {
                        setAudio('dub');
                        updateProfile({ preferredAudio: 'dub' });
                        setIframeKey((k) => k + 1);
                      }}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        audio === 'dub' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      DUB
                    </button>
                  </div>

                  <button
                    onClick={triggerManualFailover}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200 text-xs font-semibold transition-colors"
                    title="Auto-switch to next available streaming mirror"
                  >
                    Auto-Failover
                  </button>

                  <button
                    onClick={() => setIframeKey((k) => k + 1)}
                    className="p-2 rounded-lg bg-[#141721] border border-[#232738] text-slate-400 hover:text-white transition-colors"
                    aria-label="Reload stream"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  {onOpenDownload && (
                    <button
                      type="button"
                      onClick={() => onOpenDownload(activeAnime, currentEpisode, audio)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 hover:text-white transition-colors whitespace-nowrap"
                      title="Trace NekoStream Pahe / Kwik download source for this episode"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                  )}

                  {resolvedSource.url && (
                    <a
                      href={resolvedSource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141721] border border-[#232738] text-slate-300 hover:text-white transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Open Direct</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Mirror & User Add-On Switcher */}
              <div className="pt-2.5 border-t border-[#181c29] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5 mr-1">
                    <Server className="w-3.5 h-3.5 text-violet-400" />
                    <span>{cleanCoreOnly ? 'Add-On Source:' : 'Mirror:'}</span>
                  </span>
                  {!cleanCoreOnly &&
                    STREAMING_SERVERS.map((srv) => {
                      const active = !selectedAddon && resolvedSource.effectiveServerId === srv.id;
                      const support = isServerSupportedForMedia(srv.id, activeAnime.id, activeAnime.idMal);
                      const health = serverHealth[srv.id];
                      const dotColor = !support.supported
                        ? 'bg-slate-600'
                        : health?.reachable === false
                        ? 'bg-rose-500'
                        : health?.reachable === true
                        ? 'bg-emerald-400'
                        : 'bg-amber-400';

                      return (
                        <button
                          key={srv.id}
                          disabled={!support.supported}
                          onClick={() => {
                            setActiveAddonId(null);
                            setFailedServers((prev) => {
                              const next = new Set(prev);
                              next.delete(srv.id);
                              return next;
                            });
                            setServerId(srv.id);
                            updateProfile({ preferredServer: srv.id });
                            setIframeKey((k) => k + 1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                            active
                              ? 'bg-violet-600 text-white font-semibold'
                              : 'bg-[#141721] text-slate-300 hover:text-white hover:bg-[#1c2132] border border-[#22283a]'
                          }`}
                          title={!support.supported ? support.reason : srv.description}
                        >
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span>{srv.badge}</span>
                          {health?.latencyMs && (
                            <span className="text-[10px] font-mono opacity-75">{health.latencyMs}ms</span>
                          )}
                        </button>
                      );
                    })}

                  {streamAddons.map((addon) => {
                    const isActiveAddon = selectedAddon?.id === addon.id;
                    return (
                      <button
                        key={addon.id}
                        onClick={() => {
                          setActiveAddonId(addon.id);
                          setIframeKey((k) => k + 1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                          isActiveAddon
                            ? 'bg-violet-600 text-white font-semibold'
                            : 'bg-[#141721] text-slate-300 hover:text-white hover:bg-[#1c2132] border border-[#22283a]'
                        }`}
                        title={addon.description || `User Add-On: ${addon.name}`}
                      >
                        <Puzzle className="w-3 h-3 text-violet-300" />
                        <span>{addon.name}</span>
                      </button>
                    );
                  })}

                  {onOpenAddonsHub && (
                    <button
                      type="button"
                      onClick={onOpenAddonsHub}
                      className="px-2.5 py-1.5 rounded-lg bg-[#121622] hover:bg-[#191f30] border border-[#242c42] text-xs font-medium text-violet-300 hover:text-white transition-colors whitespace-nowrap flex items-center gap-1.5"
                    >
                      <Puzzle className="w-3 h-3" />
                      <span>Add-Ons</span>
                    </button>
                  )}
                </div>

                <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
                  Keys: N Next · P Prev · T Theater · L Lights · F Fullscreen
                </span>
              </div>
            </div>
          </div>

          {/* Episode Sidebar (Hidden cleanly for Feature Movies) */}
          {!epMeta.isMovie && (
            <div className={`${isTheater ? 'lg:col-span-4' : 'lg:col-span-1'} bg-[#0c0e14] border border-[#1d2232] rounded-xl p-4 flex flex-col max-h-[580px]`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <ListFilter className="w-4 h-4 text-violet-400" />
                  <span>Episodes</span>
                </h3>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  1–{epMeta.displayTotalLabel}
                </span>
              </div>

              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Jump to episode..."
                  value={episodeSearch}
                  onChange={(e) => setEpisodeSearch(e.target.value)}
                  className="w-full bg-[#141721] border border-[#232738] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {totalRanges > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 mb-2 text-xs">
                  {Array.from({ length: totalRanges }, (_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setEpisodeRange(idx)}
                      className={`px-2 py-1 rounded text-[11px] whitespace-nowrap shrink-0 transition-colors font-mono tabular-nums ${
                        episodeRange === idx
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#141721] text-slate-400 hover:text-white'
                      }`}
                    >
                      {idx * episodesPerPage + 1}–{Math.min((idx + 1) * episodesPerPage, knownEpisodeUpperBound)}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 content-start">
                {episodeNumbers.map((ep) => {
                  const isCurrent = ep === currentEpisode;
                  const isWatched = watchedEp >= ep;

                  return (
                    <button
                      key={ep}
                      onClick={() => handleSelectEpisode(ep)}
                      className={`relative aspect-square rounded-lg flex flex-col items-center justify-center font-mono text-xs tabular-nums transition-colors ${
                        isCurrent
                          ? 'bg-violet-600 text-white font-bold ring-2 ring-violet-400/50'
                          : isWatched
                          ? 'bg-[#181c29] text-slate-300 border border-[#2b3247] hover:border-violet-500/60'
                          : 'bg-[#12141d] text-slate-400 hover:bg-[#1a1f2e] hover:text-white'
                      }`}
                    >
                      <span>{ep}</span>
                      {isWatched && !isCurrent && (
                        <span className="absolute bottom-0.5 right-1 text-emerald-400 text-[9px]">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {onOpenDetails && (
                <div className="mt-4 pt-3 border-t border-[#1e2333] flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate max-w-[150px]">
                    {activeAnime.genres?.slice(0, 2).join(' · ')}
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDetails(activeAnime);
                    }}
                    className="text-violet-400 hover:text-violet-300 font-medium whitespace-nowrap"
                  >
                    Details &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
