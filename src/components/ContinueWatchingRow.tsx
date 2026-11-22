import React, { useState } from 'react';
import { Play, X, Clock } from 'lucide-react';
import { AnimeMedia, WatchlistEntry } from '../types/anime';
import { useWatchlist } from '../context/WatchlistContext';
import { computeEpisodeMetadata } from '../utils/validation';
import { useUiCustomization } from '../context/UiCustomizationContext';

interface ContinueWatchingRowProps {
  onPlayEpisode: (anime: AnimeMedia, episode: number) => void;
  onOpenDetails: (anime: AnimeMedia) => void;
  title?: string;
}

function formatResumeTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(rem)}` : `${mins}:${pad(rem)}`;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({
  onPlayEpisode,
  onOpenDetails,
  title = 'Continue Watching',
}) => {
  const { continueWatching, removeFromWatchlist } = useWatchlist();
  const { config } = useUiCustomization();
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  if (!continueWatching || continueWatching.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        paddingTop: `${config.sectionSpacingPx}px`,
        paddingBottom: `${config.sectionSpacingPx}px`,
        borderBottom: `var(--kuro-border-width) solid var(--kuro-border)`,
        backgroundColor: 'rgba(var(--kuro-accent-rgb), 0.03)',
      }}
    >
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8"
        style={{ maxWidth: config.containerMaxWidth }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"
            style={{ color: 'var(--kuro-text)', fontFamily: 'var(--font-display)' }}
          >
            <Clock className="w-5 h-5" style={{ color: 'var(--kuro-accent)' }} />
            <span>{title}</span>
          </h2>
          <span className="text-xs font-mono" style={{ color: 'var(--kuro-text-muted)' }}>
            {continueWatching.length} in progress
          </span>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          style={{ gap: `${Math.max(12, config.cardGapPx)}px` }}
        >
          {continueWatching.slice(0, 4).map((entry: WatchlistEntry) => {
            const { anime, currentEpisode, progressPercent, currentTimeSec, durationSec } = entry;
            const animeTitle = anime.title?.english || anime.title?.romaji || 'Anime';
            const banner = anime.bannerImage || anime.coverImage?.large;
            const epMeta = computeEpisodeMetadata(anime);
            const hasTimestamp = typeof currentTimeSec === 'number' && currentTimeSec > 0;
            const barWidth =
              hasTimestamp && durationSec && durationSec > 0
                ? Math.min(100, Math.round((currentTimeSec / durationSec) * 100))
                : Math.min(100, Math.max(0, progressPercent || 0));

            return (
              <div
                key={anime.id}
                className="group relative overflow-hidden transition-all flex flex-col justify-between kuro-card-frame"
              >
                <div
                  onClick={() => onPlayEpisode(anime, currentEpisode || 1)}
                  className="relative aspect-video w-full bg-[#181c29] cursor-pointer overflow-hidden"
                >
                  {banner && !brokenImages[anime.id] ? (
                    <img
                      src={banner}
                      alt={animeTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [anime.id]: true }))}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-950/60 via-[#181c29] to-[#111420] flex items-center justify-center px-4 text-center text-xs font-semibold text-slate-300 kuro-on-media">
                      {animeTitle}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform kuro-on-accent"
                      style={{
                        backgroundColor: 'var(--kuro-accent)',
                        color: 'var(--kuro-accent-text)',
                      }}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  <span className="absolute bottom-2 left-2 text-[11px] font-mono px-2 py-0.5 rounded bg-black/80 text-white border border-white/10 tabular-nums kuro-on-media">
                    {epMeta.isMovie ? 'Movie' : `Ep ${currentEpisode} / ${epMeta.displayTotalLabel}`}
                  </span>

                  {hasTimestamp && (
                    <span className="absolute bottom-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/85 text-white border border-white/15 tabular-nums kuro-on-media">
                      {formatResumeTime(currentTimeSec)}
                    </span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(anime.id);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-red-950/80 hover:text-red-400 text-slate-300 flex items-center justify-center transition-colors kuro-on-media"
                    title="Remove from history"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-full h-1.5" style={{ backgroundColor: 'var(--kuro-surface-alt)' }}>
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${barWidth}%`, backgroundColor: 'var(--kuro-accent)' }}
                  />
                </div>

                <div className="p-3">
                  <h3
                    onClick={() => onOpenDetails(anime)}
                    className="text-xs sm:text-sm font-semibold cursor-pointer line-clamp-1 transition-colors"
                    style={{ color: 'var(--kuro-text)' }}
                  >
                    {animeTitle}
                  </h3>
                  <div
                    className="flex items-center justify-between mt-1 text-[11px] font-mono"
                    style={{ color: 'var(--kuro-text-muted)' }}
                  >
                    <span>{epMeta.isMovie ? 'Feature Film' : `Episode ${currentEpisode}`}</span>
                    <button
                      onClick={() => onPlayEpisode(anime, currentEpisode || 1)}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--kuro-accent)' }}
                    >
                      {hasTimestamp ? `Resume ${formatResumeTime(currentTimeSec)}` : 'Resume'} &rarr;
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
