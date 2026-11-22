import React, { useState, useEffect, useRef } from 'react';
import { MangaMedia, MangaChapter } from '../types/anime';
import {
  X,
  ChevronLeft,
  ChevronRight,
  List,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Columns,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { fetchRealChapterPages } from '../services/manga';
import { useAuth } from '../context/AuthContext';
import type { SavedMangaProgress } from './MangaSectionView';

interface MangaReaderModalProps {
  manga: MangaMedia | null;
  chapter: MangaChapter | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (chapter: MangaChapter) => void;
  allChapters: MangaChapter[];
  onProgressSaved?: (progress: SavedMangaProgress) => void;
}

const REQUIRED_READ_DWELL_MS = 15000;

export const MangaReaderModal: React.FC<MangaReaderModalProps> = ({
  manga,
  chapter,
  isOpen,
  onClose,
  onSelectChapter,
  allChapters,
  onProgressSaved,
}) => {
  const { addXp, incrementQuestProgress, authScopeKey, firebaseUser } = useAuth();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [readingMode, setReadingMode] = useState<'single' | 'webtoon'>('webtoon');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showChapterDrawer, setShowChapterDrawer] = useState<boolean>(false);
  const [pages, setPages] = useState<string[]>([]);
  const [loadingPages, setLoadingPages] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string>('');
  const [sourceLabel, setSourceLabel] = useState<string>('Honey Live');
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [hasAwardedXp, setHasAwardedXp] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});
  const [chapterFilter, setChapterFilter] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const onProgressSavedRef = useRef(onProgressSaved);
  onProgressSavedRef.current = onProgressSaved;
  const cloudDocExistsSetRef = useRef<Set<string>>(new Set());

  const chapterNumLabel = chapter ? String(chapter.chapterNumber || '1') : '1';
  const title = manga?.title.english || manga?.title.romaji || 'Manga';

  // Reset per-chapter XP state cleanly whenever the chapter or manga changes
  useEffect(() => {
    setHasAwardedXp(false);
    setBrokenImages({});
  }, [manga?.id, chapter?.id]);

  // Persist reading progress per user (localStorage + Firestore)
  useEffect(() => {
    if (!isOpen || !manga || !chapter || loadingPages || pages.length === 0) return;

    const savedRecord: SavedMangaProgress = {
      mangaId: manga.id,
      title,
      lastChapterId: chapter.id,
      lastChapterNumber: chapterNumLabel,
      lastPage: Math.max(1, currentPage),
      updatedAt: Date.now(),
    };

    try {
      const localKey = `kurostream_manga_progress_${authScopeKey}`;
      const existingRaw = localStorage.getItem(localKey);
      const existingMap = existingRaw ? JSON.parse(existingRaw) : {};
      const nextMap = { ...(typeof existingMap === 'object' && existingMap ? existingMap : {}), [manga.id]: savedRecord };
      localStorage.setItem(localKey, JSON.stringify(nextMap));
    } catch {}

    onProgressSavedRef.current?.(savedRecord);

    if (firebaseUser && firebaseUser.emailVerified) {
      const cacheKey = `${firebaseUser.uid}:${manga.id}`;
      const docPath = `users/${firebaseUser.uid}/mangaProgress/${manga.id}`;
      const docRef = doc(db, 'users', firebaseUser.uid, 'mangaProgress', String(manga.id));

      const createDoc = () =>
        setDoc(docRef, {
          uid: firebaseUser.uid,
          mangaId: Math.floor(manga.id),
          title: title.slice(0, 240),
          lastChapterId: chapter.id.slice(0, 128),
          lastChapterNumber: chapterNumLabel.slice(0, 32),
          lastPage: Math.max(1, Math.min(1000, currentPage)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).then(() => {
          cloudDocExistsSetRef.current.add(cacheKey);
        });

      const writePromise = updateDoc(docRef, {
        lastChapterId: chapter.id.slice(0, 128),
        lastChapterNumber: chapterNumLabel.slice(0, 32),
        lastPage: Math.max(1, Math.min(1000, currentPage)),
        updatedAt: serverTimestamp(),
      })
        .then(() => {
          cloudDocExistsSetRef.current.add(cacheKey);
        })
        .catch((err: any) => {
          if (err?.code === 'not-found') {
            return createDoc();
          }
          throw err;
        });

      writePromise.catch((err) => {
        try {
          handleFirestoreError(err, OperationType.WRITE, docPath);
        } catch (wrapped) {
          console.error(wrapped);
        }
      });
    }
  }, [
    isOpen,
    manga?.id,
    chapter?.id,
    currentPage,
    loadingPages,
    pages.length,
    authScopeKey,
    firebaseUser,
    title,
    chapterNumLabel,
  ]);

  // Load real chapter pages using verified chapter object
  useEffect(() => {
    if (!isOpen || !manga || !chapter) return;

    let isMounted = true;
    setLoadingPages(true);
    setLoadError(null);
    setCurrentPage(1);
    setPages([]);
    setDirectUrl(chapter.externalUrl || '');

    fetchRealChapterPages(manga, chapter)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.pages.length > 0) {
          setPages(res.pages);
          setDirectUrl(res.directUrl || chapter.externalUrl || '');
          setSourceLabel(res.source === 'mangadex' ? 'Honey Live' : 'Sol Live');
        } else {
          setLoadError(res.error || 'No pages could be loaded for this chapter.');
          setDirectUrl(res.directUrl || chapter.externalUrl || '');
        }
        setLoadingPages(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err?.message || 'Failed to load chapter panels.');
        setLoadingPages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, manga?.id, chapter?.id, reloadNonce]);

  // Award chapter XP only after 15 seconds of genuine active reading dwell while tab is visible
  useEffect(() => {
    if (!isOpen || !manga || !chapter || loadingPages || pages.length === 0 || hasAwardedXp) {
      return;
    }

    let elapsed = 0;
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') {
        elapsed += 1000;
        if (elapsed >= REQUIRED_READ_DWELL_MS) {
          clearInterval(tick);
          setHasAwardedXp(true);
          const dedupeKey = `ch:${manga.id}:${chapter.id}`;
          const awarded = addXp(40, `Read ${title} (Ch. ${chapterNumLabel})`, dedupeKey, {
            mangaChaptersRead: 1,
          });
          if (awarded) {
            incrementQuestProgress('manga');
          }
        }
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [
    isOpen,
    manga?.id,
    chapter?.id,
    loadingPages,
    pages.length,
    hasAwardedXp,
    addXp,
    incrementQuestProgress,
    title,
    chapterNumLabel,
  ]);

  // Lock body scroll and handle keyboard shortcuts when open
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !manga || !chapter) return null;

  const totalPages = pages.length;
  const currentChapterIndex = allChapters.findIndex((c) => c.id === chapter.id);
  const nextChapter =
    currentChapterIndex > 0 ? allChapters[currentChapterIndex - 1] : null;
  const prevChapter =
    currentChapterIndex >= 0 && currentChapterIndex < allChapters.length - 1
      ? allChapters[currentChapterIndex + 1]
      : null;

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (prevChapter) {
      onSelectChapter(prevChapter);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (nextChapter) {
      onSelectChapter(nextChapter);
    }
  };

  const fallbackSearchUrl = `https://mangapill.com/search?q=${encodeURIComponent(title)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Manga Reader: ${title} ${chapter.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#07080c] text-slate-100 overflow-hidden animate-in fade-in duration-200"
    >
      {/* Top Header */}
      <header className="h-14 border-b border-[#1b1f2e] bg-[#0c0e15] px-4 flex items-center justify-between gap-4 z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#141824] hover:bg-[#1f2538] text-slate-300 hover:text-white transition-colors"
            title="Exit Reader"
            aria-label="Exit Reader"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 shrink-0">
                {sourceLabel}
              </span>
              <span className="truncate">{title}</span>
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="text-violet-300 font-semibold truncate">{chapter.title}</span>
              <span>·</span>
              <span>
                {loadingPages
                  ? 'Loading...'
                  : readingMode === 'single'
                  ? `Page ${currentPage} of ${totalPages}`
                  : `${totalPages} Pages`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowChapterDrawer(!showChapterDrawer)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showChapterDrawer
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-[#141824] border-[#22283a] text-slate-300 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chapters ({allChapters.length})</span>
          </button>

          <button
            onClick={() => setReadingMode(readingMode === 'webtoon' ? 'single' : 'webtoon')}
            className="px-2.5 py-1.5 rounded-xl bg-[#141824] border border-[#22283a] text-xs font-semibold text-slate-300 hover:text-white hidden sm:flex items-center gap-1.5"
            title="Toggle Webtoon vs Single Page Mode"
          >
            <Columns className="w-3.5 h-3.5 text-violet-400" />
            <span>{readingMode === 'webtoon' ? 'Webtoon' : 'Single'}</span>
          </button>

          <div className="hidden md:flex items-center gap-1 bg-[#141824] border border-[#22283a] rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(60, z - 20))}
              disabled={zoomLevel <= 60}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="px-1.5 font-mono text-[11px] text-slate-300 hover:text-white"
              title="Reset Zoom"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.min(180, z + 20))}
              disabled={zoomLevel >= 180}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <a
            href={directUrl || fallbackSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all hidden sm:flex items-center gap-1.5"
          >
            <span>Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onClose}
            aria-label="Close Reader"
            className="p-2 rounded-xl bg-[#141824] border border-[#22283a] text-slate-400 hover:text-white hover:border-rose-500/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Reader Body */}
      <div className="relative flex-1 flex overflow-hidden">
        <main
          ref={containerRef}
          className="flex-1 overflow-y-auto bg-[#050608] flex flex-col items-center p-2 sm:p-4 select-none"
        >
          {loadingPages ? (
            <div className="my-auto flex flex-col items-center justify-center p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <p className="text-sm font-bold text-white">
                Loading {chapter.title} Panels...
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Retrieving verified chapter assets through SSRF-hardened proxy
              </p>
            </div>
          ) : pages.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center p-12 text-center space-y-4 max-w-md">
              <AlertCircle className="w-9 h-9 text-amber-400" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  Unable to load {chapter.title}
                </p>
                <p className="text-xs text-slate-400">
                  {loadError || 'The upstream manga source did not return any readable panels for this chapter.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  onClick={() => setReloadNonce((n) => n + 1)}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Chapter</span>
                </button>
                <a
                  href={directUrl || fallbackSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#141824] border border-[#232a3f] hover:bg-[#1c2336] text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <span>Open External Mirror</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : readingMode === 'webtoon' ? (
            <div
              className="flex flex-col items-center space-y-2 transition-all duration-200"
              style={{ width: `${Math.min(100, zoomLevel)}%`, maxWidth: `${zoomLevel * 8}px` }}
            >
              {pages.map((pageUrl, idx) => (
                <div
                  key={`${chapter.id}-${idx}`}
                  className="relative w-full shadow-2xl bg-[#090b10] rounded-lg overflow-hidden border border-[#161a29] min-h-[240px]"
                >
                  {brokenImages[idx] ? (
                    <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                      <p>Panel {idx + 1} failed to load from upstream CDN.</p>
                      <button
                        onClick={() =>
                          setBrokenImages((prev) => {
                            const next = { ...prev };
                            delete next[idx];
                            return next;
                          })
                        }
                        className="px-3 py-1 rounded bg-[#181e2f] text-violet-300 hover:text-white"
                      >
                        Retry Panel
                      </button>
                    </div>
                  ) : (
                    <img
                      src={pageUrl}
                      alt={`Page ${idx + 1}`}
                      loading={idx < 3 ? 'eager' : 'lazy'}
                      className="w-full h-auto object-contain block mx-auto"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (!img.dataset.retried) {
                          img.dataset.retried = '1';
                          img.src = pageUrl + (pageUrl.includes('?') ? '&' : '?') + 'retry=1';
                        } else {
                          setBrokenImages((prev) => ({ ...prev, [idx]: true }));
                        }
                      }}
                    />
                  )}
                  <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/75 backdrop-blur-sm text-slate-300 px-2 py-0.5 rounded border border-white/10">
                    {idx + 1} / {totalPages}
                  </span>
                </div>
              ))}

              <div className="w-full py-12 flex flex-col items-center justify-center space-y-4 border-t border-[#1a1f2e] mt-8 text-center">
                <p className="text-sm font-bold text-white">End of {chapter.title}</p>
                <div className="flex items-center gap-3">
                  {prevChapter && (
                    <button
                      onClick={() => onSelectChapter(prevChapter)}
                      className="px-4 py-2 rounded-xl bg-[#141824] hover:bg-[#1e2436] text-xs font-semibold text-slate-200 border border-[#22283a]"
                    >
                      Previous Chapter
                    </button>
                  )}
                  {nextChapter && (
                    <button
                      onClick={() => onSelectChapter(nextChapter)}
                      className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white shadow-lg shadow-violet-600/30"
                    >
                      Next Chapter
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center space-y-4 my-auto transition-all"
              style={{ width: `${Math.min(100, zoomLevel)}%`, maxWidth: `${zoomLevel * 8}px` }}
            >
              <div className="relative shadow-2xl bg-[#090b10] rounded-xl overflow-hidden border border-[#161a29]">
                {brokenImages[currentPage - 1] ? (
                  <div className="p-12 text-center text-xs text-slate-400 space-y-2.5 min-w-[260px]">
                    <p>Panel {currentPage} failed to load from upstream CDN.</p>
                    <button
                      onClick={() =>
                        setBrokenImages((prev) => {
                          const next = { ...prev };
                          delete next[currentPage - 1];
                          return next;
                        })
                      }
                      className="px-3.5 py-1.5 rounded-lg bg-[#181e2f] text-violet-300 hover:text-white font-semibold"
                    >
                      Retry Panel
                    </button>
                  </div>
                ) : (
                  <img
                    key={`${chapter.id}-single-${currentPage}`}
                    src={pages[currentPage - 1]}
                    alt={`Page ${currentPage}`}
                    className="max-h-[82vh] w-auto object-contain block mx-auto"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const pageUrl = pages[currentPage - 1];
                      if (!img.dataset.retried && pageUrl) {
                        img.dataset.retried = '1';
                        img.src = pageUrl + (pageUrl.includes('?') ? '&' : '?') + 'retry=1';
                      } else {
                        setBrokenImages((prev) => ({ ...prev, [currentPage - 1]: true }));
                      }
                    }}
                  />
                )}
              </div>

              <div className="flex items-center gap-3 bg-[#0d101a] border border-[#1f2538] px-4 py-2 rounded-2xl shadow-xl">
                <button
                  onClick={handlePrevPage}
                  className="p-1.5 rounded-lg bg-[#141824] text-slate-300 hover:text-white"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="font-mono text-xs font-bold text-violet-300">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={handleNextPage}
                  className="p-1.5 rounded-lg bg-[#141824] text-slate-300 hover:text-white"
                  aria-label="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>

        {showChapterDrawer && (
          <aside className="w-72 sm:w-80 border-l border-[#1b1f2e] bg-[#0c0e15] flex flex-col z-30 shadow-2xl animate-in slide-in-from-right-4 duration-200">
            <div className="p-4 border-b border-[#1a1f2e] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Chapters ({allChapters.length})
                </h3>
              </div>
              <button
                onClick={() => setShowChapterDrawer(false)}
                className="p-1 text-slate-400 hover:text-white"
                aria-label="Close chapters drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-[#1a1f2e]">
              <input
                type="text"
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                placeholder="Jump to chapter #..."
                aria-label="Filter chapters"
                className="w-full px-3 py-1.5 rounded-lg bg-[#141824] border border-[#22283a] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {allChapters
                .filter((ch) => {
                  const q = chapterFilter.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    ch.title.toLowerCase().includes(q) ||
                    String(ch.chapterNumber).toLowerCase().includes(q)
                  );
                })
                .map((ch) => {
                  const isCurrent = ch.id === chapter.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        onSelectChapter(ch);
                        setShowChapterDrawer(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                        isCurrent
                          ? 'bg-violet-600 text-white font-bold shadow-md shadow-violet-600/30'
                          : 'text-slate-300 hover:bg-[#141824] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{ch.title}</span>
                      {isCurrent && <span className="text-[10px] font-mono">Reading</span>}
                    </button>
                  );
                })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
