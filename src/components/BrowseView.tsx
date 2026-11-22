import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, RotateCcw, Loader2, AlertTriangle, X } from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import { searchAndFilterAnime, GENRE_LIST } from '../services/anilist';
import { AnimeCard } from './AnimeCard';

interface BrowseViewProps {
  onSelectAnime: (anime: AnimeMedia) => void;
  onQuickPlay: (anime: AnimeMedia) => void;
  initialGenre?: string;
}

export const BrowseView: React.FC<BrowseViewProps> = ({
  onSelectAnime,
  onQuickPlay,
  initialGenre,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre || 'ALL');
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSort, setSelectedSort] = useState<string>('POPULARITY_DESC');
  const [animeList, setAnimeList] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialGenre) {
      setSelectedGenre(initialGenre);
    }
  }, [initialGenre]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    searchAndFilterAnime({
      genre: selectedGenre === 'ALL' ? undefined : selectedGenre,
      format: selectedFormat === 'ALL' ? undefined : selectedFormat,
      status: selectedStatus === 'ALL' ? undefined : selectedStatus,
      sort: selectedSort,
      page: 1,
      perPage: 24,
    })
      .then((res) => {
        if (isMounted) {
          setAnimeList(res.media);
          setHasNextPage(res.hasNextPage);
          setOfflineNotice(
            res.isOfflineFallback ? res.error || 'AniList offline; showing cached sample catalog.' : null
          );
          setPage(1);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Filter fetch error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedGenre, selectedFormat, selectedStatus, selectedSort]);

  const loadMore = async () => {
    if (loading || !hasNextPage) return;
    const nextPage = page + 1;
    setLoading(true);

    try {
      const res = await searchAndFilterAnime({
        genre: selectedGenre === 'ALL' ? undefined : selectedGenre,
        format: selectedFormat === 'ALL' ? undefined : selectedFormat,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        sort: selectedSort,
        page: nextPage,
        perPage: 24,
      });

      setAnimeList((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = res.media.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newItems];
      });
      setHasNextPage(res.hasNextPage);
      setPage(nextPage);
    } catch (e) {
      console.error('Failed to load more:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedGenre('ALL');
    setSelectedFormat('ALL');
    setSelectedStatus('ALL');
    setSelectedSort('POPULARITY_DESC');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {offlineNotice && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-950/35 border border-amber-500/40 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{offlineNotice}</span>
          </div>
          <button
            onClick={() => setOfflineNotice(null)}
            className="text-amber-300 hover:text-white"
            aria-label="Dismiss offline notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-violet-400" />
            <span>Browse & Filter Anime</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Explore catalog filtered by genre, format, release status, and ranking.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141721] border border-[#232738] text-xs text-slate-300 hover:text-white transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>

      <div className="bg-[#0c0e14] border border-[#1e2333] rounded-2xl p-4 sm:p-5 mb-8 space-y-4">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Genre
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedGenre('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedGenre === 'ALL'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-[#141721] text-slate-300 hover:bg-[#1a1f2e] hover:text-white border border-[#232738]'
              }`}
            >
              All Genres
            </button>
            {GENRE_LIST.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedGenre === genre
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-[#141721] text-slate-300 hover:bg-[#1a1f2e] hover:text-white border border-[#232738]'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#181c28]">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full bg-[#141721] border border-[#232738] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="ALL">All Formats</option>
              <option value="TV">TV Series</option>
              <option value="MOVIE">Movie</option>
              <option value="TV_SHORT">TV Short</option>
              <option value="OVA">OVA</option>
              <option value="ONA">ONA</option>
              <option value="SPECIAL">Special</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#141721] border border-[#232738] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="FINISHED">Completed</option>
              <option value="RELEASING">Currently Airing</option>
              <option value="NOT_YET_RELEASED">Upcoming</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Sort By</label>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="w-full bg-[#141721] border border-[#232738] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="POPULARITY_DESC">Most Popular</option>
              <option value="SCORE_DESC">Highest Rated</option>
              <option value="TRENDING_DESC">Trending</option>
              <option value="START_DATE_DESC">Newest Release</option>
              <option value="TITLE_ROMAJI">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {loading && animeList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-3" />
          <p className="text-sm">Fetching catalog from AniList...</p>
        </div>
      ) : animeList.length === 0 ? (
        <div className="text-center py-20 bg-[#0c0e14] rounded-2xl border border-[#1e2333] p-8">
          <p className="text-slate-300 font-semibold text-lg">No anime match your filters</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Try relaxing some of your filter criteria.
          </p>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {animeList.map((anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                onSelect={onSelectAnime}
                onQuickPlay={onQuickPlay}
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-10">
              <button
                onClick={loadMore}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#141721] hover:bg-[#1e2333] border border-[#232738] text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load More Anime</span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
