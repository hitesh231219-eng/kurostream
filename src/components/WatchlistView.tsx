import React, { useState, useRef } from 'react';
import {
  Bookmark,
  Play,
  Trash2,
  Star,
  CheckCircle2,
  Clock,
  Compass,
  Heart,
  Download,
  Upload,
  Check,
  AlertCircle,
  X,
  Tv,
} from 'lucide-react';
import { AnimeMedia, WatchStatus, WatchlistEntry } from '../types/anime';
import { useWatchlist } from '../context/WatchlistContext';
import { computeEpisodeMetadata } from '../utils/validation';

interface WatchlistViewProps {
  onSelectAnime: (anime: AnimeMedia) => void;
  onPlayEpisode: (anime: AnimeMedia, episode: number) => void;
  onGoToBrowse: () => void;
}

function formatSecToTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(rem)}` : `${mins}:${pad(rem)}`;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  onSelectAnime,
  onPlayEpisode,
  onGoToBrowse,
}) => {
  const {
    watchlist,
    removeFromWatchlist,
    updateStatus,
    updateProgress,
    toggleFavorite,
    exportWatchlistJSON,
    importWatchlistJSON,
  } = useWatchlist();

  const [activeTab, setActiveTab] = useState<'all' | WatchStatus | 'favorites'>('all');
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEntries = watchlist.filter((entry) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'favorites') return entry.isFavorite;
    return entry.status === activeTab;
  });

  const getCount = (tab: 'all' | WatchStatus | 'favorites') => {
    if (tab === 'all') return watchlist.length;
    if (tab === 'favorites') return watchlist.filter((i) => i.isFavorite).length;
    return watchlist.filter((i) => i.status === tab).length;
  };

  const handleExport = () => {
    const json = exportWatchlistJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kurostream-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importWatchlistJSON(content);
        if (res.ok) {
          setImportNotice({
            type: 'success',
            message: `Validated and imported ${res.count ?? 0} watchlist entries.`,
          });
        } else {
          setImportNotice({
            type: 'error',
            message: res.error || 'Failed to validate watchlist JSON file.',
          });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-violet-400" />
            <span>My Anime Watchlist</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Isolated per profile, schema-validated imports, and exact timestamp resume tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141721] border border-[#232738] text-xs text-slate-300 hover:text-white transition-colors"
            title="Import Watchlist JSON file"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Import</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141721] border border-[#232738] text-xs text-slate-300 hover:text-white transition-colors"
            title="Export Watchlist to JSON file"
          >
            {copyFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Saved</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inline Import Feedback Banner (No window.alert) */}
      {importNotice && (
        <div
          className={`mb-5 p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            importNotice.type === 'success'
              ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/35 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {importNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{importNotice.message}</span>
          </div>
          <button
            onClick={() => setImportNotice(null)}
            className="p-1 text-slate-300 hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs / Filter Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-6 border-b border-[#181c28]">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'all'
              ? 'bg-violet-600 text-white'
              : 'bg-[#141721] text-slate-300 hover:text-white border border-[#232738]'
          }`}
        >
          <span>All</span>
          <span className="font-mono text-[11px] opacity-80">({getCount('all')})</span>
        </button>

        <button
          onClick={() => setActiveTab('watching')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'watching'
              ? 'bg-violet-600 text-white'
              : 'bg-[#141721] text-slate-300 hover:text-white border border-[#232738]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>Watching</span>
          <span className="font-mono text-[11px] opacity-80">({getCount('watching')})</span>
        </button>

        <button
          onClick={() => setActiveTab('plan_to_watch')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'plan_to_watch'
              ? 'bg-violet-600 text-white'
              : 'bg-[#141721] text-slate-300 hover:text-white border border-[#232738]'
          }`}
        >
          <span>Plan to Watch</span>
          <span className="font-mono text-[11px] opacity-80">({getCount('plan_to_watch')})</span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'completed'
              ? 'bg-violet-600 text-white'
              : 'bg-[#141721] text-slate-300 hover:text-white border border-[#232738]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Completed</span>
          <span className="font-mono text-[11px] opacity-80">({getCount('completed')})</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'favorites'
              ? 'bg-violet-600 text-white'
              : 'bg-[#141721] text-slate-300 hover:text-white border border-[#232738]'
          }`}
        >
          <Heart className="w-3.5 h-3.5 text-rose-400 fill-current" />
          <span>Favorites</span>
          <span className="font-mono text-[11px] opacity-80">({getCount('favorites')})</span>
        </button>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-20 bg-[#0c0e14] rounded-2xl border border-[#1e2333] p-8">
          <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-white font-semibold text-lg">No anime in this section</h3>
          <p className="text-xs text-slate-400 mt-1 mb-5 max-w-sm mx-auto">
            Browse our anime catalog and add series to your watchlist to track episodes and resume streaming anytime.
          </p>
          <button
            onClick={onGoToBrowse}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-violet-600/30"
          >
            <Compass className="w-4 h-4" />
            <span>Discover Anime</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry: WatchlistEntry) => {
            const { anime, status, currentEpisode, progressPercent, isFavorite, currentTimeSec } = entry;
            const title = anime.title?.english || anime.title?.romaji || 'Anime';
            const poster = anime.coverImage?.medium || anime.coverImage?.large;
            const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
            const epMeta = computeEpisodeMetadata(anime);

            return (
              <div
                key={anime.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 sm:p-4 rounded-xl bg-[#0c0e14] border border-[#1e2333] hover:border-violet-500/40 transition-all"
              >
                <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                  <div
                    onClick={() => onSelectAnime(anime)}
                    className="w-16 h-22 sm:w-20 sm:h-28 rounded-lg overflow-hidden bg-[#181c28] border border-[#232738] shrink-0 cursor-pointer flex items-center justify-center"
                  >
                    {poster && !brokenImages[anime.id] ? (
                      <img
                        src={poster}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenImages((prev) => ({ ...prev, [anime.id]: true }))}
                      />
                    ) : (
                      <Tv className="w-6 h-6 text-slate-500" />
                    )}
                  </div>

                  <div className="overflow-hidden space-y-1">
                    <h3
                      onClick={() => onSelectAnime(anime)}
                      className="text-sm sm:text-base font-bold text-white group-hover:text-violet-300 transition-colors truncate cursor-pointer"
                      title={title}
                    >
                      {title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      {score && (
                        <span className="flex items-center gap-0.5 text-amber-400">
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
                    </div>

                    <div className="flex items-center flex-wrap gap-2.5 pt-1">
                      <span className="text-xs text-slate-300 font-mono">
                        {epMeta.isMovie
                          ? `Movie${currentTimeSec && currentTimeSec > 0 ? ` · ${formatSecToTimestamp(currentTimeSec)}` : ''}`
                          : `Ep ${currentEpisode} / ${epMeta.displayTotalLabel} (${progressPercent}%)${
                              currentTimeSec && currentTimeSec > 0
                                ? ` · ${formatSecToTimestamp(currentTimeSec)}`
                                : ''
                            }`}
                      </span>

                      {!epMeta.isMovie && (
                        <button
                          onClick={() => updateProgress(anime.id, currentEpisode + 1)}
                          className="px-2 py-0.5 rounded bg-[#181c28] hover:bg-violet-600 text-[11px] font-mono text-slate-300 hover:text-white border border-[#232738] transition-colors"
                          title="Increment episode count by 1"
                        >
                          +1 Ep
                        </button>
                      )}
                    </div>

                    <div className="w-36 sm:w-48 bg-[#181c28] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-violet-500 h-full rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#181c28]">
                  <select
                    value={status}
                    onChange={(e) => updateStatus(anime.id, e.target.value as WatchStatus)}
                    className="bg-[#141721] border border-[#232738] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="watching">Watching</option>
                    <option value="plan_to_watch">Plan to Watch</option>
                    <option value="completed">Completed</option>
                  </select>

                  <button
                    onClick={() => toggleFavorite(anime.id)}
                    className={`p-2 rounded-lg border transition-colors ${
                      isFavorite
                        ? 'bg-rose-950/40 text-rose-400 border-rose-500/40'
                        : 'bg-[#141721] text-slate-400 border-[#232738] hover:text-slate-200'
                    }`}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => onPlayEpisode(anime, currentEpisode || 1)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{epMeta.isMovie ? 'Watch Movie' : `Watch Ep ${currentEpisode || 1}`}</span>
                  </button>

                  <button
                    onClick={() => removeFromWatchlist(anime.id)}
                    className="p-2 rounded-lg bg-[#141721] hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-[#232738] transition-colors"
                    title="Remove from Watchlist"
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
  );
};
