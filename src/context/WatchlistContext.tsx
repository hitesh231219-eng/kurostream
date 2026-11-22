import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { AnimeMedia, WatchStatus, WatchlistEntry } from '../types/anime';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { computeEpisodeMetadata, validateAndParseWatchlistImport } from '../utils/validation';

interface WatchlistImportResult {
  ok: boolean;
  count?: number;
  error?: string;
}

interface WatchlistContextType {
  watchlist: WatchlistEntry[];
  continueWatching: WatchlistEntry[];
  addToWatchlist: (anime: AnimeMedia, status?: WatchStatus) => void;
  removeFromWatchlist: (animeId: number) => void;
  updateStatus: (animeId: number, status: WatchStatus) => void;
  updateProgress: (animeId: number, episode: number, currentTimeSec?: number, durationSec?: number) => void;
  updatePlaybackTimestamp: (animeId: number, currentTimeSec: number, durationSec?: number) => void;
  toggleFavorite: (animeId: number) => void;
  isInWatchlist: (animeId: number) => boolean;
  getEntry: (animeId: number) => WatchlistEntry | undefined;
  recordWatchHistory: (anime: AnimeMedia, episode: number, currentTimeSec?: number, durationSec?: number) => void;
  exportWatchlistJSON: () => string;
  importWatchlistJSON: (jsonStr: string) => WatchlistImportResult;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

function getStorageKey(scopeKey: string): string {
  return `kurostream_watchlist_v2_${scopeKey}`;
}

function buildFirestoreWatchlistFields(uid: string, entry: WatchlistEntry) {
  const title = (entry.anime.title?.english || entry.anime.title?.romaji || 'Anime').slice(0, 240);
  const cover = (entry.anime.coverImage?.extraLarge || entry.anime.coverImage?.large || entry.anime.coverImage?.medium || '').slice(0, 512);
  const banner = (entry.anime.bannerImage || '').slice(0, 512);
  const payload: Record<string, any> = {
    uid,
    animeId: Math.floor(entry.anime.id),
    title,
    status: entry.status,
    currentEpisode: Math.max(0, Math.min(10000, Math.floor(entry.currentEpisode || 0))),
    currentTimeSec: Math.max(0, Math.min(86400, Number(entry.currentTimeSec || 0))),
    durationSec: Math.max(0, Math.min(86400, Number(entry.durationSec || 0))),
    isFavorite: Boolean(entry.isFavorite),
    episodesUnknown: Boolean(entry.episodesUnknown),
    totalEpisodes: Math.max(0, Math.min(10000, Math.floor(entry.totalEpisodes || 0))),
    updatedAt: serverTimestamp(),
  };

  if (entry.anime.idMal && entry.anime.idMal > 0) {
    payload.malId = Math.floor(entry.anime.idMal);
  }
  if (cover) {
    payload.coverImage = cover;
  }
  if (banner) {
    payload.bannerImage = banner;
  }
  if (entry.anime.format) {
    payload.format = String(entry.anime.format).slice(0, 32);
  }
  return payload;
}

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authScopeKey, firebaseUser, authReady, incrementQuestProgress } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const watchlistRef = useRef<WatchlistEntry[]>(watchlist);
  watchlistRef.current = watchlist;
  const cloudDocIdsRef = useRef<Set<number>>(new Set());
  const pendingCloudCreatesRef = useRef<Set<number>>(new Set());

  // Load isolated local cache whenever active profile / Google UID changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(authScopeKey));
      if (saved) {
        const parsed = validateAndParseWatchlistImport(saved);
        if (parsed.ok) {
          watchlistRef.current = parsed.entries;
          setWatchlist(parsed.entries);
          return;
        }
      }
    } catch {
      // ignore corrupted cache
    }
    watchlistRef.current = [];
    setWatchlist([]);
  }, [authScopeKey]);

  // Persist local cache scoped strictly by authScopeKey
  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(authScopeKey), JSON.stringify(watchlist));
    } catch (e) {
      console.warn('Failed to persist isolated watchlist:', e);
    }
  }, [watchlist, authScopeKey]);

  // Real-time Firestore sync for verified Google accounts
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) {
      cloudDocIdsRef.current = new Set();
      return;
    }

    const colPath = `users/${firebaseUser.uid}/watchlist`;
    const q = query(collection(db, 'users', firebaseUser.uid, 'watchlist'), orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextIds = new Set<number>();
        const syncedEntries: WatchlistEntry[] = [];

        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const animeId = Number(d.animeId);
          if (!Number.isInteger(animeId) || animeId <= 0) return;
          nextIds.add(animeId);

          const totalEps = Number(d.totalEpisodes) || 0;
          const curEp = Number(d.currentEpisode) || 0;
          const progressPercent =
            totalEps > 0 ? Math.min(100, Math.round((curEp / totalEps) * 100)) : 0;

          syncedEntries.push({
            anime: {
              id: animeId,
              idMal: typeof d.malId === 'number' ? d.malId : null,
              title: {
                romaji: String(d.title || 'Anime'),
                english: String(d.title || 'Anime'),
              },
              coverImage: {
                large: d.coverImage || undefined,
                extraLarge: d.coverImage || undefined,
                medium: d.coverImage || undefined,
              },
              bannerImage: d.bannerImage || undefined,
              format: d.format || 'TV',
              episodes: totalEps > 0 ? totalEps : null,
              genres: [],
            },
            status: d.status || 'watching',
            currentEpisode: curEp,
            totalEpisodes: totalEps,
            episodesUnknown: Boolean(d.episodesUnknown),
            progressPercent,
            currentTimeSec: Number(d.currentTimeSec) || 0,
            durationSec: Number(d.durationSec) || 0,
            isFavorite: Boolean(d.isFavorite),
            updatedAt: d.updatedAt?.toMillis?.() || Date.now(),
          });
        });

        cloudDocIdsRef.current = nextIds;
        for (const id of nextIds) {
          pendingCloudCreatesRef.current.delete(id);
        }
        watchlistRef.current = syncedEntries;
        setWatchlist(syncedEntries);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, colPath);
        } catch (wrapped) {
          console.error(wrapped);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, firebaseUser]);

  const syncEntryToCloud = useCallback(
    (entry: WatchlistEntry) => {
      if (!firebaseUser || !firebaseUser.emailVerified) return;
      const docId = String(Math.floor(entry.anime.id));
      const docPath = `users/${firebaseUser.uid}/watchlist/${docId}`;
      const docRef = doc(db, 'users', firebaseUser.uid, 'watchlist', docId);
      const baseFields = buildFirestoreWatchlistFields(firebaseUser.uid, entry);

      const createDoc = () => {
        cloudDocIdsRef.current.add(entry.anime.id);
        pendingCloudCreatesRef.current.add(entry.anime.id);
        setDoc(docRef, {
          ...baseFields,
          createdAt: serverTimestamp(),
        })
          .catch((err) => {
            try {
              handleFirestoreError(err, OperationType.CREATE, docPath);
            } catch (wrapped) {
              console.error(wrapped);
            }
          })
          .finally(() => {
            pendingCloudCreatesRef.current.delete(entry.anime.id);
          });
      };

      if (cloudDocIdsRef.current.has(entry.anime.id) && !pendingCloudCreatesRef.current.has(entry.anime.id)) {
        const { uid: _u, animeId: _a, ...updatableFields } = baseFields;
        updateDoc(docRef, updatableFields).catch((err: any) => {
          if (err?.code === 'not-found') {
            createDoc();
            return;
          }
          try {
            handleFirestoreError(err, OperationType.UPDATE, docPath);
          } catch (wrapped) {
            console.error(wrapped);
          }
        });
      } else {
        createDoc();
      }
    },
    [firebaseUser]
  );

  const deleteEntryFromCloud = useCallback(
    (animeId: number) => {
      if (!firebaseUser || !firebaseUser.emailVerified) return;
      cloudDocIdsRef.current.delete(animeId);
      const docPath = `users/${firebaseUser.uid}/watchlist/${animeId}`;
      deleteDoc(doc(db, 'users', firebaseUser.uid, 'watchlist', String(animeId))).catch((err) => {
        try {
          handleFirestoreError(err, OperationType.DELETE, docPath);
        } catch (wrapped) {
          console.error(wrapped);
        }
      });
    },
    [firebaseUser]
  );

  const addToWatchlist = (anime: AnimeMedia, status: WatchStatus = 'plan_to_watch') => {
    const meta = computeEpisodeMetadata(anime);
    const total = meta.totalEpisodes ?? 0;
    const prev = watchlistRef.current;
    const existing = prev.find((item) => item.anime.id === anime.id);

    if (existing) {
      const updated: WatchlistEntry = { ...existing, anime, status, updatedAt: Date.now() };
      const next = prev.map((item) => (item.anime.id === anime.id ? updated : item));
      watchlistRef.current = next;
      setWatchlist(next);
      syncEntryToCloud(updated);
      return;
    }

    let initialEp = 0;
    if (status === 'completed' && total > 0) initialEp = total;
    else if (status === 'watching') initialEp = 1;

    const progress = total > 0 ? Math.min(100, Math.round((initialEp / total) * 100)) : 0;

    const newEntry: WatchlistEntry = {
      anime,
      status,
      currentEpisode: initialEp,
      totalEpisodes: total,
      episodesUnknown: meta.episodesUnknown,
      progressPercent: progress,
      currentTimeSec: 0,
      durationSec: 0,
      isFavorite: false,
      updatedAt: Date.now(),
    };
    const next = [newEntry, ...prev];
    watchlistRef.current = next;
    setWatchlist(next);
    syncEntryToCloud(newEntry);
    incrementQuestProgress('social');
  };

  const removeFromWatchlist = (animeId: number) => {
    const next = watchlistRef.current.filter((item) => item.anime.id !== animeId);
    watchlistRef.current = next;
    setWatchlist(next);
    deleteEntryFromCloud(animeId);
  };

  const updateStatus = (animeId: number, status: WatchStatus) => {
    let changedEntry: WatchlistEntry | null = null;
    const next = watchlistRef.current.map((item) => {
      if (item.anime.id !== animeId) return item;
      const total = item.totalEpisodes;
      let ep = item.currentEpisode;
      if (status === 'completed' && total > 0) ep = total;
      else if (status === 'watching' && ep === 0) ep = 1;

      const progress = total > 0 ? Math.min(100, Math.round((ep / total) * 100)) : 0;
      const updated: WatchlistEntry = {
        ...item,
        status,
        currentEpisode: ep,
        progressPercent: progress,
        updatedAt: Date.now(),
      };
      changedEntry = updated;
      return updated;
    });
    if (changedEntry) {
      watchlistRef.current = next;
      setWatchlist(next);
      syncEntryToCloud(changedEntry);
    }
  };

  const updateProgress = (
    animeId: number,
    episode: number,
    currentTimeSec?: number,
    durationSec?: number
  ) => {
    let changedEntry: WatchlistEntry | null = null;
    const next = watchlistRef.current.map((item) => {
      if (item.anime.id !== animeId) return item;
      const total = item.totalEpisodes;
      const maxBound = !item.episodesUnknown && total > 0 ? total : 10000;
      const ep = Math.max(0, Math.min(episode, maxBound));
      const isComplete = !item.episodesUnknown && total > 0 && ep >= total;
      const progress = total > 0 ? Math.min(100, Math.round((ep / total) * 100)) : 0;

      const updated: WatchlistEntry = {
        ...item,
        currentEpisode: ep,
        status: isComplete ? 'completed' : 'watching',
        progressPercent: progress,
        currentTimeSec:
          typeof currentTimeSec === 'number'
            ? currentTimeSec
            : ep !== item.currentEpisode
            ? 0
            : item.currentTimeSec || 0,
        durationSec: typeof durationSec === 'number' ? durationSec : item.durationSec || 0,
        updatedAt: Date.now(),
      };
      changedEntry = updated;
      return updated;
    });
    if (changedEntry) {
      watchlistRef.current = next;
      setWatchlist(next);
      syncEntryToCloud(changedEntry);
    }
  };

  const updatePlaybackTimestamp = (
    animeId: number,
    currentTimeSec: number,
    durationSec?: number
  ) => {
    let changedEntry: WatchlistEntry | null = null;
    const next = watchlistRef.current.map((item) => {
      if (item.anime.id !== animeId) return item;
      const safeTime = Math.max(0, Math.min(86400, Math.round(currentTimeSec)));
      const safeDur =
        typeof durationSec === 'number'
          ? Math.max(0, Math.min(86400, Math.round(durationSec)))
          : item.durationSec || 0;
      const updated: WatchlistEntry = {
        ...item,
        currentTimeSec: safeTime,
        durationSec: safeDur,
        updatedAt: Date.now(),
      };
      changedEntry = updated;
      return updated;
    });
    if (changedEntry) {
      watchlistRef.current = next;
      setWatchlist(next);
      syncEntryToCloud(changedEntry);
    }
  };

  const toggleFavorite = (animeId: number) => {
    let changedEntry: WatchlistEntry | null = null;
    const next = watchlistRef.current.map((item) => {
      if (item.anime.id !== animeId) return item;
      const updated = { ...item, isFavorite: !item.isFavorite, updatedAt: Date.now() };
      changedEntry = updated;
      return updated;
    });
    if (changedEntry) {
      watchlistRef.current = next;
      setWatchlist(next);
      syncEntryToCloud(changedEntry);
    }
  };

  const isInWatchlist = (animeId: number) => watchlist.some((item) => item.anime.id === animeId);

  const getEntry = (animeId: number) => watchlist.find((item) => item.anime.id === animeId);

  const recordWatchHistory = (
    anime: AnimeMedia,
    episode: number,
    currentTimeSec?: number,
    durationSec?: number
  ) => {
    const meta = computeEpisodeMetadata(anime);
    const total = meta.totalEpisodes ?? 0;
    const safeEp = meta.isMovie ? 1 : Math.max(1, Math.floor(episode || 1));
    const isComplete =
      !meta.episodesUnknown &&
      total > 0 &&
      safeEp >= total &&
      (currentTimeSec === undefined || (durationSec && currentTimeSec >= durationSec * 0.9));
    const progress = total > 0 ? Math.min(100, Math.round((safeEp / total) * 100)) : 0;

    const prev = watchlistRef.current;
    const existing = prev.find((item) => item.anime.id === anime.id);
    if (existing) {
      const updated: WatchlistEntry = {
        ...existing,
        anime,
        totalEpisodes: total,
        episodesUnknown: meta.episodesUnknown,
        status: isComplete ? 'completed' : 'watching',
        currentEpisode: safeEp,
        progressPercent: progress,
        currentTimeSec:
          typeof currentTimeSec === 'number'
            ? Math.max(0, Math.round(currentTimeSec))
            : safeEp !== existing.currentEpisode
            ? 0
            : existing.currentTimeSec || 0,
        durationSec:
          typeof durationSec === 'number'
            ? Math.max(0, Math.round(durationSec))
            : existing.durationSec || 0,
        updatedAt: Date.now(),
      };
      const next = prev.map((item) => (item.anime.id === anime.id ? updated : item));
      watchlistRef.current = next;
      setWatchlist(next);
      syncEntryToCloud(updated);
      return;
    }

    const newEntry: WatchlistEntry = {
      anime,
      status: isComplete ? 'completed' : 'watching',
      currentEpisode: safeEp,
      totalEpisodes: total,
      episodesUnknown: meta.episodesUnknown,
      progressPercent: progress,
      currentTimeSec: typeof currentTimeSec === 'number' ? Math.max(0, Math.round(currentTimeSec)) : 0,
      durationSec: typeof durationSec === 'number' ? Math.max(0, Math.round(durationSec)) : 0,
      isFavorite: false,
      updatedAt: Date.now(),
    };
    const next = [newEntry, ...prev];
    watchlistRef.current = next;
    setWatchlist(next);
    syncEntryToCloud(newEntry);
  };

  const exportWatchlistJSON = (): string => JSON.stringify(watchlist, null, 2);

  const importWatchlistJSON = (jsonStr: string): WatchlistImportResult => {
    const parsed = validateAndParseWatchlistImport(jsonStr);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    setWatchlist(parsed.entries);
    if (firebaseUser && firebaseUser.emailVerified) {
      parsed.entries.forEach((entry) => syncEntryToCloud(entry));
    }
    return { ok: true, count: parsed.entries.length };
  };

  const continueWatching = useMemo(() => {
    return watchlist
      .filter((item) => item.status === 'watching' && item.currentEpisode > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [watchlist]);

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        continueWatching,
        addToWatchlist,
        removeFromWatchlist,
        updateStatus,
        updateProgress,
        updatePlaybackTimestamp,
        toggleFavorite,
        isInWatchlist,
        getEntry,
        recordWatchHistory,
        exportWatchlistJSON,
        importWatchlistJSON,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export function useWatchlist(): WatchlistContextType {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
}
