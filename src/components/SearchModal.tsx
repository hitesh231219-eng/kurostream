import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, Play, Loader2, ArrowRight, Sparkles, Tv } from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import { searchAndFilterAnime } from '../services/anilist';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnime: (anime: AnimeMedia) => void;
  onPlayEpisode: (anime: AnimeMedia, episode: number) => void;
}

interface AiRecommendation {
  title: string;
  reason: string;
  matchScore: number;
}

const POPULAR_QUERIES = [
  'Solo Leveling',
  'Frieren',
  'Jujutsu Kaisen',
  'Demon Slayer',
  'Chainsaw Man',
  'One Piece',
  'Attack on Titan',
  'Bleach',
];

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectAnime,
  onPlayEpisode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  // AI Mood Recommender
  const [aiMoodInput, setAiMoodInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const currentQueryRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      setSearchTerm('');
      setResults([]);
      setBrokenImages({});
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    currentQueryRef.current = trimmed;

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const { media } = await searchAndFilterAnime({ search: trimmed, perPage: 12 });
        if (currentQueryRef.current === trimmed) {
          setResults(media);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (currentQueryRef.current === trimmed) {
          setLoading(false);
        }
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const handleAskAiMood = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = aiMoodInput.trim();
    if (trimmed.length < 2) return;

    setAiLoading(true);
    setAiError(null);
    setAiRecommendations([]);

    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data?.error || 'Could not generate recommendations right now.');
      } else {
        setAiRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      }
    } catch {
      setAiError('Recommendation backend unreachable.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results.length > 0) {
      onClose();
      onSelectAnime(results[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search Anime"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-20 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0c0e14] border border-[#1e2333] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
      >
        <div className="relative flex items-center border-b border-[#1e2333] px-4 py-3.5 bg-[#11141e]">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search anime by title (e.g. Solo Leveling, Frieren)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDownInput}
            className="w-full bg-transparent text-white placeholder-slate-500 text-sm sm:text-base focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-violet-400 animate-spin mr-2 shrink-0" />}
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-400 hover:text-white mr-1"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2.5 py-1 rounded bg-[#181c28] border border-[#232738] text-slate-400 hover:text-white shrink-0 ml-2"
          >
            Esc
          </button>
        </div>

        {/* Popular Queries & Mood Finder when search input is empty */}
        {!searchTerm && (
          <div className="p-4 bg-[#0a0c12] border-b border-[#141721] space-y-4">
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium">Trending Searches</p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setSearchTerm(q)}
                    className="px-2.5 py-1 rounded-md bg-[#141721] hover:bg-[#1f2434] border border-[#1e2333] text-xs text-slate-300 hover:text-violet-300 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood Concierge (/api/ai/recommend) */}
            <div className="pt-3 border-t border-[#151926] space-y-2.5">
              <p className="text-xs text-violet-300 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>Mood & Vibe Finder</span>
              </p>
              <form onSubmit={handleAskAiMood} className="flex items-center gap-2">
                <input
                  type="text"
                  value={aiMoodInput}
                  onChange={(e) => setAiMoodInput(e.target.value)}
                  placeholder="Describe a vibe (e.g. 'dark psychological thriller like Death Note')..."
                  className="flex-1 bg-[#141721] border border-[#232738] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={aiLoading || aiMoodInput.trim().length < 2}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  {aiLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Suggest</span>
                </button>
              </form>

              {aiError && <p className="text-[11px] text-amber-300">{aiError}</p>}

              {aiRecommendations.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {aiRecommendations.map((rec, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSearchTerm(rec.title)}
                      className="text-left p-2.5 rounded-xl bg-[#121623] hover:bg-[#192034] border border-[#232b40] hover:border-violet-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">{rec.title}</span>
                        <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                          {rec.matchScore}% match
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{rec.reason}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-2 flex-1">
          {searchTerm && !loading && results.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              <p>No anime found matching "{searchTerm}"</p>
              <p className="text-xs text-slate-500 mt-1">Try searching by romaji or English title</p>
            </div>
          )}

          {results.map((anime) => {
            const title = anime.title?.english || anime.title?.romaji || 'Anime';
            const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
            const poster = anime.coverImage?.medium || anime.coverImage?.large;

            return (
              <div
                key={anime.id}
                onClick={() => {
                  onClose();
                  onSelectAnime(anime);
                }}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-[#12151f] hover:bg-[#1a1f2e] border border-[#1e2333] hover:border-violet-500/50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-[#181c29] shrink-0 border border-[#232738] flex items-center justify-center">
                    {poster && !brokenImages[anime.id] ? (
                      <img
                        src={poster}
                        alt={title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenImages((prev) => ({ ...prev, [anime.id]: true }))}
                      />
                    ) : (
                      <Tv className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
                      {title}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                      {score && (
                        <span className="flex items-center gap-0.5 text-amber-400 tabular-nums">
                          <Star className="w-3 h-3 fill-current" />
                          {score}
                        </span>
                      )}
                      {score && <span aria-hidden="true" className="text-slate-600">·</span>}
                      <span>{anime.format || 'TV'}</span>
                      {anime.seasonYear && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span>{anime.seasonYear}</span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>
                        {anime.format === 'MOVIE'
                          ? 'Movie'
                          : anime.episodes
                          ? `${anime.episodes} eps`
                          : 'Ongoing'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {(anime.genres || []).slice(0, 3).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      onPlayEpisode(anime, 1);
                    }}
                    className="p-2 rounded-lg bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 transition-all"
                    title="Watch Episode 1"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
