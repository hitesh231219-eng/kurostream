import React, { useState } from 'react';
import { Play, Star, Plus, Check, Film } from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import { useWatchlist } from '../context/WatchlistContext';
import { computeEpisodeMetadata } from '../utils/validation';
import { useUiCustomization } from '../context/UiCustomizationContext';

interface AnimeCardProps {
  anime: AnimeMedia;
  onSelect: (anime: AnimeMedia) => void;
  onQuickPlay?: (anime: AnimeMedia) => void;
  rank?: number;
  isGridItem?: boolean;
}

const ASPECT_CLASS_MAP = {
  '2/3': 'aspect-[2/3]',
  '3/4': 'aspect-[3/4]',
  '1/1': 'aspect-square',
  '16/9': 'aspect-video',
} as const;

const FILTER_CLASS_MAP = {
  none: '',
  vivid: 'kuro-filter-vivid',
  cinema: 'kuro-filter-cinema',
  noir: 'kuro-filter-noir',
  warm: 'kuro-filter-warm',
} as const;

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  onSelect,
  onQuickPlay,
  rank,
  isGridItem = false,
}) => {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const { config } = useUiCustomization();
  const [imgFailed, setImgFailed] = useState(false);
  const inWatchlist = isInWatchlist(anime.id);

  const displayTitle = anime.title?.english || anime.title?.romaji || 'Anime';
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const coverUrl =
    config.cardAspect === '16/9' && anime.bannerImage
      ? anime.bannerImage
      : anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium;
  const epMeta = computeEpisodeMetadata(anime);

  const aspectClass = ASPECT_CLASS_MAP[config.cardAspect] || 'aspect-[2/3]';
  const filterClass = FILTER_CLASS_MAP[config.cardImageFilter] || '';
  const hoverContainerClass =
    config.cardHoverEffect === 'lift'
      ? 'kuro-hover-lift'
      : config.cardHoverEffect === 'glow'
      ? 'kuro-hover-glow'
      : config.cardHoverEffect === 'tilt'
      ? 'kuro-hover-tilt'
      : '';

  const showOverlayMeta = config.cardMetadataPosition === 'overlay';
  const showBelowMeta =
    config.cardMetadataPosition === 'below' || config.cardMetadataPosition === 'minimal';

  return (
    <div
      className={`group relative flex flex-col ${isGridItem ? 'w-full' : 'shrink-0'} transition-transform duration-200`}
      style={isGridItem ? undefined : { width: `${config.cardWidthPx}px` }}
    >
      {/* Poster Image Container */}
      <div
        onClick={() => onSelect(anime)}
        className={`relative ${aspectClass} w-full overflow-hidden cursor-pointer kuro-card-frame ${hoverContainerClass}`}
      >
        {coverUrl && !imgFailed ? (
          <img
            src={coverUrl}
            alt={displayTitle}
            className={`w-full h-full object-cover ${filterClass} ${
              config.cardHoverEffect === 'scale'
                ? 'transform group-hover:scale-105 transition-transform duration-300 ease-out'
                : 'transition-all duration-300'
            }`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2 bg-gradient-to-br from-[#161a29] via-[#10131e] to-[#0a0c12]">
            <Film className="w-7 h-7" style={{ color: 'var(--kuro-accent)' }} />
            <span className="text-xs font-semibold text-slate-200 line-clamp-3 leading-snug kuro-on-media">
              {displayTitle}
            </span>
          </div>
        )}

        {/* Rank Number */}
        {rank !== undefined && config.cardShowRank && (
          <div className="absolute top-2 left-2 z-10 font-mono font-bold text-xs px-2 py-0.5 rounded bg-black/80 text-white border border-white/15 tabular-nums kuro-on-media">
            #{rank}
          </div>
        )}

        {/* Optional Score Badge inside poster when overlay or minimal mode */}
        {score && config.cardShowScore && config.cardMetadataPosition !== 'below' && (
          <div className="absolute top-2 right-2 z-10 font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-black/80 text-amber-400 border border-white/15 tabular-nums flex items-center gap-0.5 kuro-on-media">
            <Star className="w-2.5 h-2.5 fill-current" />
            {score}
          </div>
        )}

        {/* Persistent Overlay Metadata Mode */}
        {showOverlayMeta && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3 pt-8 pointer-events-none">
            <h3 className="text-xs sm:text-sm font-semibold text-white line-clamp-1 kuro-on-media">
              {displayTitle}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mt-0.5 font-mono tabular-nums kuro-on-media">
              <span>{anime.format || 'TV'}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>{epMeta.displayTotalLabel}</span>
            </div>
          </div>
        )}

        {/* Hover Overlay with Quick Play & Watchlist Actions */}
        {(config.cardShowQuickPlay || config.cardShowWatchlistBtn) && (
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
            <div className="flex items-center gap-2 mb-1.5">
              {onQuickPlay && config.cardShowQuickPlay && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickPlay(anime);
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 kuro-on-accent"
                  style={{
                    backgroundColor: 'var(--kuro-accent)',
                    color: 'var(--kuro-accent-text)',
                  }}
                  title="Watch Episode 1"
                  aria-label={`Watch ${displayTitle}`}
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              )}

              {config.cardShowWatchlistBtn && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inWatchlist) {
                      removeFromWatchlist(anime.id);
                    } else {
                      addToWatchlist(anime, 'plan_to_watch');
                    }
                  }}
                  className="w-9 h-9 rounded-full bg-[#151925]/95 border border-white/20 text-slate-100 flex items-center justify-center transition-transform hover:scale-105 kuro-on-media"
                  title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  aria-label={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                >
                  {inWatchlist ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Plus className="w-4 h-4 text-slate-200" />
                  )}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-200 line-clamp-1 leading-tight kuro-on-media">
              {(anime.genres || []).slice(0, 2).join(' · ')}
            </p>
          </div>
        )}
      </div>

      {/* Metadata Below Card */}
      {showBelowMeta && (
        <div className="pt-2.5 px-0.5">
          <h3
            onClick={() => onSelect(anime)}
            className="text-xs sm:text-sm font-semibold transition-colors line-clamp-1 cursor-pointer"
            style={{ color: 'var(--kuro-text)' }}
            title={displayTitle}
          >
            {displayTitle}
          </h3>

          {config.cardMetadataPosition === 'below' && (
            <div
              className="flex items-center gap-1.5 text-[11px] mt-1 font-mono tabular-nums"
              style={{ color: 'var(--kuro-text-muted)' }}
            >
              {score && config.cardShowScore && (
                <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                  <Star className="w-3 h-3 fill-current inline" />
                  {score}
                </span>
              )}
              {score && config.cardShowScore && <span aria-hidden="true">·</span>}
              <span>{anime.format || 'TV'}</span>
              <span aria-hidden="true">·</span>
              <span>{epMeta.displayTotalLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
