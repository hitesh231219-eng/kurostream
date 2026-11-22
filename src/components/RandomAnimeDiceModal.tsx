import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Dices,
  Play,
  Info,
  Star,
  Film,
  Calendar,
  Sparkles,
  RefreshCw,
  Loader2,
  Tv,
} from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import { getRandomAnime, GENRE_LIST } from '../services/anilist';

interface RandomAnimeDiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnime: (anime: AnimeMedia) => void;
  onPlayEpisode: (anime: AnimeMedia, episode: number) => void;
}

const POPULAR_DICE_GENRES = [
  'ALL',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Romance',
  'Sci-Fi',
  'Mystery',
  'Supernatural',
];

export const RandomAnimeDiceModal: React.FC<RandomAnimeDiceModalProps> = ({
  isOpen,
  onClose,
  onSelectAnime,
  onPlayEpisode,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [anime, setAnime] = useState<AnimeMedia | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [rollCount, setRollCount] = useState<number>(0);
  const [diceNumber, setDiceNumber] = useState<number>(6);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const performRoll = useCallback(async (genre: string = selectedGenre, format: string = selectedFormat) => {
    setIsRolling(true);
    setErrorNotice(null);

    // Rapidly cycle dice faces while rolling for visual delight
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    rollIntervalRef.current = setInterval(() => {
      setDiceNumber(Math.floor(Math.random() * 6) + 1);
    }, 80);

    const startTime = Date.now();

    try {
      const picked = await getRandomAnime({
        genre: genre === 'ALL' ? undefined : genre,
        format: format === 'ALL' ? undefined : format,
        minScore: 65,
      });

      // Keep rolling animation active for at least 500ms so the user feels the roll
      const elapsed = Date.now() - startTime;
      const remainingWait = Math.max(0, 500 - elapsed);

      setTimeout(() => {
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        setAnime(picked);
        setIsRolling(false);
        setRollCount((prev) => prev + 1);
      }, remainingWait);
    } catch (err: any) {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      setIsRolling(false);
      setErrorNotice('Could not reach AniList for a new roll; showing catalog pick.');
    }
  }, [selectedGenre, selectedFormat]);

  // When modal opens, auto-roll immediately if no anime is currently picked
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (!anime) {
        performRoll('ALL', 'ALL');
      }
    } else {
      document.body.style.overflow = '';
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
    }
    return () => {
      document.body.style.overflow = '';
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
    };
  }, [isOpen, anime, performRoll]);

  // Keyboard shortcut listener (Escape to close, Space/R to reroll)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.key === 'r' || e.key === 'R' || e.key === ' ') && !isRolling) {
        // Prevent default spacebar page scrolling
        if (e.key === ' ') e.preventDefault();
        performRoll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRolling, performRoll, onClose]);

  if (!isOpen) return null;

  const englishTitle = anime?.title?.english || anime?.title?.romaji || 'Random Anime';
  const romajiTitle = anime?.title?.romaji || '';
  const coverUrl =
    anime?.coverImage?.extraLarge ||
    anime?.coverImage?.large ||
    anime?.coverImage?.medium ||
    '';
  const bannerUrl = anime?.bannerImage || coverUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Roll the Dice — Random Anime"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0c0e14] border border-[#202638] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1b2131] bg-[#10131d]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400">
              <Dices className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Fate's Dice Roll</span>
                <span className="text-[11px] font-normal text-slate-400">· Random Anime Discovery</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Roll #{rollCount} · Press <kbd className="font-mono text-[10px] bg-slate-800 px-1 py-0.5 rounded text-slate-300">R</kbd> or <kbd className="font-mono text-[10px] bg-slate-800 px-1 py-0.5 rounded text-slate-300">Space</kbd> to roll again
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#161a26] text-slate-400 hover:text-white border border-[#22283a] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters Strip */}
        <div className="px-5 py-2.5 bg-[#0a0c12] border-b border-[#161b28] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Genre:</span>
            <select
              value={selectedGenre}
              onChange={(e) => {
                const nextGenre = e.target.value;
                setSelectedGenre(nextGenre);
                performRoll(nextGenre, selectedFormat);
              }}
              disabled={isRolling}
              className="bg-[#141824] border border-[#23293c] text-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-violet-500"
            >
              {POPULAR_DICE_GENRES.map((g) => (
                <option key={g} value={g}>
                  {g === 'ALL' ? 'Any Genre' : g}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Format:</span>
            <select
              value={selectedFormat}
              onChange={(e) => {
                const nextFormat = e.target.value;
                setSelectedFormat(nextFormat);
                performRoll(selectedGenre, nextFormat);
              }}
              disabled={isRolling}
              className="bg-[#141824] border border-[#23293c] text-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-violet-500"
            >
              <option value="ALL">Any Format</option>
              <option value="TV">TV Series Only</option>
              <option value="MOVIE">Movies Only</option>
              <option value="OVA">OVA & Specials</option>
            </select>
          </div>

          <button
            onClick={() => performRoll()}
            disabled={isRolling}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors shadow-sm ml-auto"
          >
            {isRolling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Rolling...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Roll Again</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 relative">
          {isRolling ? (
            <div className="py-16 sm:py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-900/40 to-fuchsia-900/40 border border-violet-500/50 shadow-2xl shadow-violet-500/20 animate-bounce">
                <Dices className="w-10 h-10 text-violet-300 animate-spin" />
                <span className="absolute -bottom-2 -right-2 bg-violet-600 text-white text-[11px] font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0c0e14]">
                  {diceNumber}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-white">Rolling the Dice...</p>
                <p className="text-xs text-slate-400">Summoning a top-rated anime pick just for you</p>
              </div>
            </div>
          ) : anime ? (
            <div className="space-y-5">
              {/* Anime Banner & Hero Card */}
              <div className="relative rounded-xl overflow-hidden border border-[#20273a] bg-[#121520]">
                {bannerUrl && (
                  <div className="h-32 sm:h-40 w-full relative overflow-hidden">
                    <img
                      src={bannerUrl}
                      alt={englishTitle}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover blur-[1px] opacity-40 scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#121520] via-[#121520]/70 to-transparent" />
                  </div>
                )}

                <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 relative -mt-16 sm:-mt-20">
                  {/* Poster */}
                  <div className="w-24 sm:w-28 shrink-0 rounded-lg overflow-hidden border border-[#262e44] shadow-xl bg-slate-900 aspect-[2/3] self-start">
                    <img
                      src={coverUrl}
                      alt={englishTitle}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Metadata & Title */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {anime.averageScore && (
                        <span className="flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                          <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                          <span>{anime.averageScore}%</span>
                        </span>
                      )}
                      <span className="text-slate-300 font-medium">{anime.format || 'TV'}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-300">{anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing'}</span>
                      {anime.seasonYear && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">{anime.seasonYear}</span>
                        </>
                      )}
                      {anime.status && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400 capitalize">{anime.status.toLowerCase().replace('_', ' ')}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-lg sm:text-xl font-extrabold text-white leading-tight">
                      {englishTitle}
                    </h3>
                    {romajiTitle && romajiTitle !== englishTitle && (
                      <p className="text-xs text-slate-400 italic">{romajiTitle}</p>
                    )}

                    {/* Genres (unboxed clean typography per constitution) */}
                    {anime.genres && anime.genres.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-violet-300">
                        {anime.genres.slice(0, 5).map((genre, idx) => (
                          <React.Fragment key={genre}>
                            <span>{genre}</span>
                            {idx < Math.min(anime.genres.length, 5) - 1 && (
                              <span className="text-slate-600">·</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Synopsis */}
              {anime.description && (
                <div className="space-y-1.5 bg-[#0e111a] p-4 rounded-xl border border-[#1b2131]">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Synopsis</p>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed line-clamp-4">
                    {anime.description}
                  </p>
                </div>
              )}

              {errorNotice && (
                <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-600/30 p-2.5 rounded-lg">
                  {errorNotice}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Action Footer */}
        {anime && !isRolling && (
          <div className="p-4 sm:p-5 border-t border-[#1b2131] bg-[#10131d] flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={() => performRoll()}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#171c2a] hover:bg-[#20273c] border border-[#273048] text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Dices className="w-4 h-4 text-violet-400" />
              <span>Roll Again</span>
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => {
                  onClose();
                  onSelectAnime(anime);
                }}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[#171c2a] hover:bg-[#20273c] border border-[#273048] text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Details</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onPlayEpisode(anime, 1);
                }}
                className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition-colors shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Watch Ep 1</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
