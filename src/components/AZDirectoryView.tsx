import React, { useState, useEffect } from 'react';
import {
  ArrowDownAZ,
  Dices,
  Search,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Film,
  Sparkles,
  Filter,
} from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import { getAnimeByLetter, GENRE_LIST } from '../services/anilist';
import { AnimeCard } from './AnimeCard';

interface AZDirectoryViewProps {
  onSelectAnime: (anime: AnimeMedia) => void;
  onQuickPlay: (anime: AnimeMedia) => void;
  onOpenDice?: () => void;
}

const ALPHABET = [
  '#',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

export const AZDirectoryView: React.FC<AZDirectoryViewProps> = ({
  onSelectAnime,
  onQuickPlay,
  onOpenDice,
}) => {
  const [selectedLetter, setSelectedLetter] = useState<string>('A');
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [selectedSort, setSelectedSort] = useState<string>('TITLE_ROMAJI');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [animeList, setAnimeList] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getAnimeByLetter({
      letter: selectedLetter,
      page: 1,
      perPage: 28,
      genre: selectedGenre === 'ALL' ? undefined : selectedGenre,
      format: selectedFormat === 'ALL' ? undefined : selectedFormat,
      sort: selectedSort,
    })
      .then((res) => {
        if (isMounted) {
          setAnimeList(res.media);
          setHasNextPage(res.hasNextPage);
          setOfflineNotice(
            res.isOfflineFallback ? 'AniList offline; showing cached catalog.' : null
          );
          setPage(1);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('A-Z letter fetch error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedLetter, selectedGenre, selectedFormat, selectedSort]);

  const loadMore = async () => {
    if (loading || !hasNextPage) return;
    const nextPage = page + 1;
    setLoading(true);

    try {
      const res = await getAnimeByLetter({
        letter: selectedLetter,
        page: nextPage,
        perPage: 28,
        genre: selectedGenre === 'ALL' ? undefined : selectedGenre,
        format: selectedFormat === 'ALL' ? undefined : selectedFormat,
        sort: selectedSort,
      });

      setAnimeList((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = res.media.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newItems];
      });
      setHasNextPage(res.hasNextPage);
      setPage(nextPage);
    } catch (e) {
      console.error('Failed to load more A-Z anime:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedLetter('A');
    setSelectedFormat('ALL');
    setSelectedGenre('ALL');
    setSelectedSort('TITLE_ROMAJI');
    setSearchQuery('');
  };

  // Filter client-side if user types inside this specific letter
  const displayedAnime = animeList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const eng = (item.title.english || '').toLowerCase();
    const rom = (item.title.romaji || '').toLowerCase();
    return eng.includes(q) || rom.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Offline Alert */}
      {offlineNotice && (
        <div className="p-3.5 rounded-xl bg-amber-950/35 border border-amber-500/40 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{offlineNotice}</span>
          </div>
          <button
            onClick={() => setOfflineNotice(null)}
            className="text-amber-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c2233] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <ArrowDownAZ className="w-7 h-7 text-violet-400" />
            <span>A to Z Anime Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse the complete anime catalog alphabetically from # and A to Z.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {onOpenDice && (
            <button
              onClick={onOpenDice}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-violet-600/20"
              title="Roll the Dice to discover a random anime"
            >
              <Dices className="w-4 h-4 animate-bounce" />
              <span>Roll the Dice</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#131622] hover:bg-[#1b2030] border border-[#232a3d] text-xs text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Alphabet Selector Strip */}
      <div className="bg-[#0e111a] border border-[#1d2334] rounded-2xl p-3 sm:p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Select Starting Letter
          </span>
          <span>
            Active: <span className="font-bold text-violet-400">{selectedLetter}</span> · {displayedAnime.length} Titles
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-0.5">
          {ALPHABET.map((letter) => {
            const isActive = selectedLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                className={`min-w-[36px] sm:min-w-[40px] h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center shrink-0 ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105'
                    : 'bg-[#151926] text-slate-300 hover:text-white hover:bg-[#1f263a] border border-[#22293e]'
                }`}
                title={`Browse anime starting with ${letter}`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Filter Bar */}
      <div className="bg-[#0d1017] border border-[#1b2132] rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search within active letter */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter titles in "${selectedLetter}"...`}
            className="w-full bg-[#131724] border border-[#22293d] rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-violet-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Format */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Format:</span>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="bg-[#131724] border border-[#22293d] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-violet-500"
            >
              <option value="ALL">All Formats</option>
              <option value="TV">TV Series</option>
              <option value="MOVIE">Movie</option>
              <option value="OVA">OVA</option>
              <option value="SPECIAL">Special</option>
            </select>
          </div>

          {/* Genre */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Genre:</span>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="bg-[#131724] border border-[#22293d] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-violet-500"
            >
              <option value="ALL">All Genres</option>
              {GENRE_LIST.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Sort:</span>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="bg-[#131724] border border-[#22293d] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-violet-500"
            >
              <option value="TITLE_ROMAJI">Title (A to Z)</option>
              <option value="SCORE_DESC">Top Rated (Score)</option>
              <option value="POPULARITY_DESC">Most Popular</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      {loading && animeList.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden bg-[#111420] border border-[#1b2132] aspect-[2/3] animate-pulse"
            />
          ))}
        </div>
      ) : displayedAnime.length > 0 ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayedAnime.map((anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                onSelectAnime={onSelectAnime}
                onQuickPlay={onQuickPlay}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-[#141824] hover:bg-[#1d2334] border border-[#252c41] text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center gap-2 shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                    <span>Loading more titles in "{selectedLetter}"...</span>
                  </>
                ) : (
                  <span>Load More in "{selectedLetter}"</span>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-16 text-center space-y-4 bg-[#0d1017] border border-[#1b2132] rounded-2xl p-8">
          <div className="w-12 h-12 mx-auto rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <ArrowDownAZ className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              No anime found starting with "{selectedLetter}"
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try adjusting your format or genre filters, or roll the dice for an instant surprise pick.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-[#161a26] hover:bg-[#20273a] border border-[#262f44] text-xs font-medium text-slate-200 hover:text-white transition-colors"
            >
              Reset Filters
            </button>
            {onOpenDice && (
              <button
                onClick={onOpenDice}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-md shadow-violet-600/20"
              >
                <Dices className="w-4 h-4" />
                <span>Roll Dice</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
