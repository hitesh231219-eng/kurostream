import React, { useState, useEffect, useCallback } from 'react';
import { MangaMedia, MangaChapter, AnimeMedia } from '../types/anime';
import {
  fetchMangaCatalog,
  fetchRealMangaChapters,
  fetchMangaDetails,
} from '../services/manga';
import {
  BookOpen,
  Search,
  Star,
  Compass,
  Layers,
  ExternalLink,
  ChevronRight,
  Feather,
  Tv,
  X,
  TrendingUp,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { MangaReaderModal } from './MangaReaderModal';

export interface SavedMangaProgress {
  mangaId: number;
  title: string;
  lastChapterId: string;
  lastChapterNumber: string;
  lastPage: number;
  updatedAt: number;
}

interface MangaSectionViewProps {
  onPlayAnime?: (anime: AnimeMedia, episode: number) => void;
  onOpenAnimeDetails?: (anime: AnimeMedia) => void;
}

export const MangaSectionView: React.FC<MangaSectionViewProps> = ({
  onPlayAnime,
}) => {
  const { authScopeKey, firebaseUser, authReady } = useAuth();

  const [mangaList, setMangaList] = useState<MangaMedia[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<
    'TRENDING_DESC' | 'POPULARITY_DESC' | 'SCORE_DESC' | 'FAVOURITES_DESC'
  >('TRENDING_DESC');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Reader Modal & Real Chapter Resolution State
  const [readerManga, setReaderManga] = useState<MangaMedia | null>(null);
  const [readerChapter, setReaderChapter] = useState<MangaChapter | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState<boolean>(false);
  const [activeChapters, setActiveChapters] = useState<MangaChapter[]>([]);
  const [resolvingChaptersId, setResolvingChaptersId] = useState<number | null>(null);
  const [chapterFetchError, setChapterFetchError] = useState<{
    manga: MangaMedia;
    message: string;
  } | null>(null);

  // Detailed Manga Inspector Modal
  const [selectedMangaDetail, setSelectedMangaDetail] = useState<MangaMedia | null>(null);
  const [detailChapters, setDetailChapters] = useState<MangaChapter[]>([]);
  const [loadingDetailChapters, setLoadingDetailChapters] = useState<boolean>(false);
  const [detailChapterError, setDetailChapterError] = useState<string | null>(null);
  const [detailChapterFilter, setDetailChapterFilter] = useState<string>('');

  // Featured Highlight Manga
  const [heroManga, setHeroManga] = useState<MangaMedia | null>(null);

  // Per-user reading progress map keyed by mangaId
  const [progressMap, setProgressMap] = useState<Record<number, SavedMangaProgress>>({});
  const [brokenCovers, setBrokenCovers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedMangaDetail || isReaderOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMangaDetail(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMangaDetail, isReaderOpen]);

  // Load saved manga reading progress isolated per profile / Google UID
  useEffect(() => {
    let cancelled = false;
    const localKey = `kurostream_manga_progress_${authScopeKey}`;

    try {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setProgressMap(parsed);
        } else {
          setProgressMap({});
        }
      } else {
        setProgressMap({});
      }
    } catch {
      setProgressMap({});
    }

    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) {
      return;
    }

    const colPath = `users/${firebaseUser.uid}/mangaProgress`;
    getDocs(collection(db, 'users', firebaseUser.uid, 'mangaProgress'))
      .then((snap) => {
        if (cancelled) return;
        const merged: Record<number, SavedMangaProgress> = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const mId = Number(d.mangaId);
          if (!Number.isInteger(mId) || mId <= 0) return;
          merged[mId] = {
            mangaId: mId,
            title: String(d.title || 'Manga'),
            lastChapterId: String(d.lastChapterId || ''),
            lastChapterNumber: String(d.lastChapterNumber || '1'),
            lastPage: Math.max(1, Number(d.lastPage) || 1),
            updatedAt: d.updatedAt?.toMillis?.() || Date.now(),
          };
        });
        setProgressMap((prev) => {
          const next = { ...prev, ...merged };
          try {
            localStorage.setItem(localKey, JSON.stringify(next));
          } catch {}
          return next;
        });
      })
      .catch((err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, colPath);
        } catch (wrapped) {
          console.error(wrapped);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authScopeKey, authReady, firebaseUser]);

  // Fetch Manga Catalog
  useEffect(() => {
    let isCancelled = false;

    async function loadManga() {
      setLoading(true);
      try {
        const result = await fetchMangaCatalog({
          search: searchQuery.trim() || undefined,
          genre: selectedGenre,
          sort: sortBy,
          status: statusFilter,
          perPage: 24,
        });

        if (!isCancelled) {
          setMangaList(result.items);
          setOfflineNotice(result.isOfflineFallback ? result.error || 'Showing limited offline manga catalog.' : null);
          if (result.items.length > 0 && !heroManga) {
            setHeroManga(result.items[0]);
          }
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      loadManga();
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedGenre, sortBy, statusFilter]);

  const genres = [
    'ALL',
    'Action',
    'Adventure',
    'Fantasy',
    'Comedy',
    'Supernatural',
    'Dark Fantasy',
    'Drama',
    'Horror',
    'Slice of Life',
    'Psychological',
  ];

  const handleOpenReader = useCallback(
    async (manga: MangaMedia, preferredChapter?: MangaChapter) => {
      setChapterFetchError(null);
      setResolvingChaptersId(manga.id);

      try {
        const res = await fetchRealMangaChapters(manga);
        if (!res.chapters || res.chapters.length === 0) {
          setChapterFetchError({
            manga,
            message:
              res.error ||
              `No verified English chapters found for "${manga.title.english || manga.title.romaji}".`,
          });
          return;
        }

        const saved = progressMap[manga.id];
        let targetChapter = preferredChapter;
        if (!targetChapter && saved) {
          targetChapter =
            res.chapters.find((c) => c.id === saved.lastChapterId) ||
            res.chapters.find(
              (c) => String(c.chapterNumber) === String(saved.lastChapterNumber)
            );
        }
        if (!targetChapter) {
          // Prefer earliest chapter (e.g. Chapter 1) when starting fresh
          targetChapter = res.chapters[res.chapters.length - 1] || res.chapters[0];
        }

        setActiveChapters(res.chapters);
        setReaderManga(manga);
        setReaderChapter(targetChapter);
        setIsReaderOpen(true);
      } finally {
        setResolvingChaptersId(null);
      }
    },
    [progressMap]
  );

  const handleOpenDetails = useCallback(async (manga: MangaMedia) => {
    setSelectedMangaDetail(manga);
    setDetailChapters([]);
    setDetailChapterError(null);
    setDetailChapterFilter('');
    setLoadingDetailChapters(true);

    try {
      const [enriched, chaptersRes] = await Promise.all([
        fetchMangaDetails(manga.id),
        fetchRealMangaChapters(manga),
      ]);
      if (enriched) {
        setSelectedMangaDetail(enriched);
      }
      setDetailChapters(chaptersRes.chapters || []);
      if (!chaptersRes.chapters || chaptersRes.chapters.length === 0) {
        setDetailChapterError(chaptersRes.error || 'No verified chapters detected upstream.');
      }
    } finally {
      setLoadingDetailChapters(false);
    }
  }, []);

  const handleProgressSaved = useCallback((saved: SavedMangaProgress) => {
    setProgressMap((prev) => ({
      ...prev,
      [saved.mangaId]: saved,
    }));
  }, []);

  const activeHero = heroManga || mangaList[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Offline Catalog Notice */}
      {offlineNotice && (
        <div className="p-3.5 rounded-2xl bg-amber-950/35 border border-amber-500/40 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{offlineNotice}</span>
          </div>
          <button
            onClick={() => setOfflineNotice(null)}
            className="text-amber-300 hover:text-white shrink-0"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chapter Resolution Failure Notice with Retry */}
      {chapterFetchError && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Unable to open chapter directory</p>
              <p className="text-rose-200/90 mt-0.5">{chapterFetchError.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenReader(chapterFetchError.manga)}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => setChapterFetchError(null)}
              className="px-2.5 py-1.5 rounded-lg bg-[#151926] text-slate-300 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Featured Manga Hero */}
      {activeHero && (
        <div className="relative rounded-3xl overflow-hidden border border-[#232738] bg-gradient-to-r from-[#0c0e16] via-[#121624] to-[#0c0e16] shadow-2xl">
          <div className="absolute inset-0 z-0 opacity-20">
            {!brokenCovers[`hero-bg:${activeHero.id}`] && (
              <img
                src={activeHero.bannerImage || activeHero.coverImage.large}
                alt=""
                referrerPolicy="no-referrer"
                onError={() =>
                  setBrokenCovers((prev) => ({ ...prev, [`hero-bg:${activeHero.id}`]: true }))
                }
                className="w-full h-full object-cover filter blur-sm scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#08090d] via-[#08090d]/85 to-transparent" />
          </div>

          <div className="relative z-10 p-6 sm:p-10 flex flex-col md:flex-row items-center gap-8">
            <div className="relative group shrink-0">
              {brokenCovers[`hero-cover:${activeHero.id}`] ? (
                <div className="w-44 sm:w-56 aspect-[3/4.2] rounded-2xl shadow-2xl border-2 border-violet-500/40 bg-[#151926] flex items-center justify-center p-4 text-center text-xs text-slate-400">
                  {activeHero.title.english || activeHero.title.romaji}
                </div>
              ) : (
                <img
                  src={activeHero.coverImage.large}
                  alt={activeHero.title.english || activeHero.title.romaji}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setBrokenCovers((prev) => ({ ...prev, [`hero-cover:${activeHero.id}`]: true }))
                  }
                  className="w-44 sm:w-56 rounded-2xl shadow-2xl object-cover border-2 border-violet-500/40"
                />
              )}
              {activeHero.averageScore && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center gap-1 shadow-lg">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{activeHero.averageScore}%</span>
                </div>
              )}
            </div>

            <div className="space-y-4 text-center md:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-slate-400">
                <span className="text-violet-300 font-semibold">AniList Metadata</span>
                {activeHero.serialization && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-200">{activeHero.serialization}</span>
                  </>
                )}
                {activeHero.status && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        activeHero.status === 'RELEASING'
                          ? 'text-emerald-400 font-medium'
                          : 'text-sky-400 font-medium'
                      }
                    >
                      {activeHero.status}
                    </span>
                  </>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {activeHero.title.english || activeHero.title.romaji}
                </h1>
                {activeHero.title.native && (
                  <p className="text-xs sm:text-sm text-violet-300/80 font-mono mt-0.5">
                    {activeHero.title.native} · {activeHero.title.romaji}
                  </p>
                )}
              </div>

              {activeHero.staff && activeHero.staff.length > 0 && (
                <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-slate-300">
                  <Feather className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-slate-400">{activeHero.staff[0].role}:</span>
                  <strong className="text-white font-semibold">{activeHero.staff[0].name}</strong>
                  {activeHero.staff[0].nativeName && (
                    <span className="text-slate-400 font-mono">
                      ({activeHero.staff[0].nativeName})
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs sm:text-sm text-slate-300 line-clamp-3 leading-relaxed max-w-2xl">
                {activeHero.description?.replace(/<[^>]*>/g, '')}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                {activeHero.genres.map((g) => (
                  <span
                    key={g}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1a1f30] text-slate-300 border border-[#2a324b]"
                  >
                    {g}
                  </span>
                ))}
                {activeHero.volumes && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#151a29] text-violet-300 border border-violet-500/30 font-mono">
                    {activeHero.volumes} Volumes
                  </span>
                )}
                {activeHero.chapters && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#151a29] text-emerald-300 border border-emerald-500/30 font-mono">
                    {activeHero.chapters} Chapters
                  </span>
                )}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                <button
                  onClick={() => handleOpenReader(activeHero)}
                  disabled={resolvingChaptersId === activeHero.id}
                  className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-xl shadow-violet-600/30 transition-all flex items-center gap-2"
                >
                  {resolvingChaptersId === activeHero.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BookOpen className="w-4 h-4" />
                  )}
                  <span>
                    {resolvingChaptersId === activeHero.id
                      ? 'Loading Verified Chapters...'
                      : progressMap[activeHero.id]
                      ? `Continue Ch. ${progressMap[activeHero.id].lastChapterNumber}`
                      : 'Read Verified Chapters'}
                  </span>
                </button>

                <button
                  onClick={() => handleOpenDetails(activeHero)}
                  className="px-4 py-3 rounded-xl bg-[#171b28] hover:bg-[#202638] text-slate-300 hover:text-white font-semibold text-xs transition-colors border border-[#262c40] flex items-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  <span>Chapters & Metadata</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search, Sort & Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#0e111a] border border-[#1e2333] space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search manga by English, Romaji or Japanese..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#151926] border border-[#232738] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline">Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-[#151926] border border-[#232738] text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            >
              <option value="TRENDING_DESC">Trending</option>
              <option value="POPULARITY_DESC">Most Popular</option>
              <option value="SCORE_DESC">Highest Rated</option>
              <option value="FAVOURITES_DESC">Most Favourited</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#151926] border border-[#232738] text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            >
              <option value="ALL">All Status</option>
              <option value="RELEASING">Releasing</option>
              <option value="FINISHED">Finished</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <Compass className="w-4 h-4 text-violet-400 shrink-0 mr-1" />
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedGenre === genre
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
                  : 'bg-[#151926] text-slate-400 hover:text-white hover:bg-[#1c2236]'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Manga Grid Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-400" />
            <span>Manga Directory · Honey + Sol Verified</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {mangaList.length} titles loaded
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[3/4.2] rounded-2xl bg-[#121520] animate-pulse" />
            ))}
          </div>
        ) : mangaList.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-[#0e111a] border border-[#1e2333] text-slate-400 text-xs">
            No manga found matching your current search or filter settings.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mangaList.map((manga) => {
              const saved = progressMap[manga.id];
              const isResolving = resolvingChaptersId === manga.id;
              return (
                <div
                  key={manga.id}
                  className="group relative rounded-2xl bg-[#0f121c] border border-[#1f2436] hover:border-violet-500/50 overflow-hidden transition-all duration-200 flex flex-col hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-600/10"
                >
                  <div className="relative aspect-[3/4.2] overflow-hidden bg-[#151926]">
                    {brokenCovers[`card:${manga.id}`] ? (
                      <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-slate-400">
                        {manga.title.english || manga.title.romaji}
                      </div>
                    ) : (
                      <img
                        src={manga.coverImage.large}
                        alt={manga.title.english || manga.title.romaji}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenCovers((prev) => ({ ...prev, [`card:${manga.id}`]: true }))
                        }
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                      <button
                        onClick={() => handleOpenReader(manga)}
                        disabled={isResolving}
                        className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-violet-600/40"
                      >
                        {isResolving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5" />
                        )}
                        <span>{saved ? `Resume Ch. ${saved.lastChapterNumber}` : 'Read Online'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenDetails(manga)}
                        className="w-full py-1.5 rounded-xl bg-[#1c2132] hover:bg-[#252c42] text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1"
                      >
                        <span>Chapters & Info</span>
                      </button>
                    </div>

                    {manga.averageScore && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-sm text-[10px] font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        {manga.averageScore}%
                      </span>
                    )}

                    {saved && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-violet-600/90 text-[10px] font-mono font-bold text-white">
                        Ch. {saved.lastChapterNumber}
                      </span>
                    )}

                    {manga.status && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[9px] font-mono font-semibold text-slate-300">
                        {manga.status}
                      </span>
                    )}
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-violet-400 transition-colors">
                        {manga.title.english || manga.title.romaji}
                      </h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {manga.staff && manga.staff.length > 0
                          ? manga.staff[0].name
                          : manga.genres[0] || 'Manga'}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#1a1f2e] flex items-center justify-between text-[11px]">
                      <button
                        onClick={() => {
                          setHeroManga(manga);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        Feature
                      </button>

                      <button
                        onClick={() => handleOpenReader(manga)}
                        disabled={isResolving}
                        className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-0.5"
                      >
                        <span>{isResolving ? 'Loading...' : saved ? `Ch. ${saved.lastChapterNumber}` : 'Read'}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manga Details & Verified Chapters Modal */}
      {selectedMangaDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedMangaDetail.title.english || selectedMangaDetail.title.romaji}
          onClick={() => setSelectedMangaDetail(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl bg-[#0c0e14] border border-[#232738] rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2130] bg-[#10131d]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    {selectedMangaDetail.title.english || selectedMangaDetail.title.romaji}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedMangaDetail.title.native || selectedMangaDetail.title.romaji} · AniList Metadata
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedMangaDetail(null)}
                aria-label="Close manga details"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a1f2e] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-300">
              <div className="flex flex-col sm:flex-row gap-6">
                {brokenCovers[`detail:${selectedMangaDetail.id}`] ? (
                  <div className="w-36 sm:w-44 aspect-[3/4.2] rounded-2xl border border-[#2b334d] shadow-xl shrink-0 mx-auto sm:mx-0 bg-[#151926] flex items-center justify-center p-3 text-center text-xs text-slate-400">
                    {selectedMangaDetail.title.english || selectedMangaDetail.title.romaji}
                  </div>
                ) : (
                  <img
                    src={selectedMangaDetail.coverImage.large}
                    alt={selectedMangaDetail.title.english || selectedMangaDetail.title.romaji}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBrokenCovers((prev) => ({
                        ...prev,
                        [`detail:${selectedMangaDetail.id}`]: true,
                      }))
                    }
                    className="w-36 sm:w-44 rounded-2xl object-cover border border-[#2b334d] shadow-xl shrink-0 mx-auto sm:mx-0"
                  />
                )}

                <div className="space-y-3 flex-1 min-w-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-[#131622] border border-[#202538]">
                      <span className="text-[10px] text-slate-400 block font-semibold">Status</span>
                      <strong className="text-white text-xs">{selectedMangaDetail.status || 'Releasing'}</strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#131622] border border-[#202538]">
                      <span className="text-[10px] text-slate-400 block font-semibold">Total Chapters</span>
                      <strong className="text-emerald-400 text-xs font-mono">
                        {selectedMangaDetail.chapters || detailChapters.length || 'Ongoing'}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#131622] border border-[#202538]">
                      <span className="text-[10px] text-slate-400 block font-semibold">Volumes</span>
                      <strong className="text-violet-300 text-xs font-mono">
                        {selectedMangaDetail.volumes || 'N/A'}
                      </strong>
                    </div>
                  </div>

                  {selectedMangaDetail.staff && selectedMangaDetail.staff.length > 0 && (
                    <div className="p-3 rounded-xl bg-[#131622] border border-[#202538] space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Author & Creators
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {selectedMangaDetail.staff.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <Feather className="w-3 h-3 text-violet-400" />
                            <span className="text-slate-300 font-medium">{s.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({s.role})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Synopsis
                    </span>
                    <p className="text-slate-300 leading-relaxed text-xs">
                      {selectedMangaDetail.description?.replace(/<[^>]*>/g, '') || 'No synopsis available.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verified Chapter Directory */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Verified Chapter Directory
                  </span>
                  {loadingDetailChapters && (
                    <span className="text-[11px] text-violet-300 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Querying Honey &amp; Sol...
                    </span>
                  )}
                </div>

                {detailChapterError && detailChapters.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/30 text-amber-200 text-xs">
                    {detailChapterError}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailChapters.length > 12 && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={detailChapterFilter}
                          onChange={(e) => setDetailChapterFilter(e.target.value)}
                          placeholder={`Search among ${detailChapters.length} chapters...`}
                          aria-label="Filter detail chapters"
                          className="flex-1 px-3 py-1.5 rounded-xl bg-[#121522] border border-[#202538] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                        />
                        {detailChapters[detailChapters.length - 1] && (
                          <button
                            onClick={() => {
                              const firstCh = detailChapters[detailChapters.length - 1];
                              const target = selectedMangaDetail;
                              setActiveChapters(detailChapters);
                              setReaderManga(target);
                              setReaderChapter(firstCh);
                              setSelectedMangaDetail(null);
                              setIsReaderOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/40 text-violet-200 font-semibold text-xs whitespace-nowrap"
                          >
                            Start First ({detailChapters[detailChapters.length - 1].title})
                          </button>
                        )}
                      </div>
                    )}
                    <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                      {detailChapters
                        .filter((ch) => {
                          const q = detailChapterFilter.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            ch.title.toLowerCase().includes(q) ||
                            String(ch.chapterNumber).toLowerCase().includes(q)
                          );
                        })
                        .slice(0, detailChapterFilter.trim() ? 200 : 120)
                        .map((ch) => (
                          <button
                            key={ch.id}
                            onClick={() => {
                              const target = selectedMangaDetail;
                              setActiveChapters(detailChapters);
                              setReaderManga(target);
                              setReaderChapter(ch);
                              setSelectedMangaDetail(null);
                              setIsReaderOpen(true);
                            }}
                            className="p-2.5 rounded-xl bg-[#121522] hover:bg-[#191f33] border border-[#202538] hover:border-violet-500/40 text-left flex items-center justify-between gap-2 transition-colors"
                          >
                            <span className="font-semibold text-white truncate">{ch.title}</span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0 uppercase">
                              {ch.source === 'mangadex'
                                ? 'Honey'
                                : ch.source === 'mangapill' || ch.source === 'weebcentral'
                                ? 'Sol'
                                : 'live'}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedMangaDetail.relations && selectedMangaDetail.relations.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Franchise Relations & Anime Adaptations
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedMangaDetail.relations.map((rel) => (
                      <div
                        key={rel.id}
                        className="p-3 rounded-xl bg-[#121522] border border-[#202538] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                            <Tv className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-bold text-white truncate text-[11px]">{rel.title}</h5>
                            <span className="text-[10px] text-violet-300 font-mono">
                              {rel.relationType} · {rel.format}
                            </span>
                          </div>
                        </div>

                        {onPlayAnime && rel.type === 'ANIME' && (
                          <button
                            onClick={() => {
                              setSelectedMangaDetail(null);
                              onPlayAnime(
                                {
                                  id: rel.id,
                                  title: { english: rel.title, romaji: rel.title },
                                  coverImage: { large: selectedMangaDetail.coverImage.large },
                                  genres: selectedMangaDetail.genres,
                                } as AnimeMedia,
                                1
                              );
                            }}
                            className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-[10px] whitespace-nowrap"
                          >
                            Stream Anime
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#1a1f2e] flex flex-wrap items-center justify-between gap-3">
                <a
                  href={`https://mangapill.com/search?q=${encodeURIComponent(
                    selectedMangaDetail.title.english || selectedMangaDetail.title.romaji
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#151926] hover:bg-[#1d2334] text-slate-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-colors border border-[#232738]"
                >
                  <span>Search Sol</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedMangaDetail(null)}
                    className="px-4 py-2 rounded-xl bg-[#151926] text-slate-300 hover:text-white font-semibold text-xs"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      const m = selectedMangaDetail;
                      setSelectedMangaDetail(null);
                      handleOpenReader(m);
                    }}
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-violet-600/30"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Launch Manga Reader</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reader Modal */}
      <MangaReaderModal
        manga={readerManga}
        chapter={readerChapter}
        isOpen={isReaderOpen}
        onClose={() => setIsReaderOpen(false)}
        onSelectChapter={(ch) => setReaderChapter(ch)}
        allChapters={activeChapters}
        onProgressSaved={handleProgressSaved}
      />
    </div>
  );
};
