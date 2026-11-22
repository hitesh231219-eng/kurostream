import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import { AnimeCard } from './AnimeCard';
import { useUiCustomization } from '../context/UiCustomizationContext';

interface AnimeRowProps {
  title: string;
  subtitle?: string;
  animeList: AnimeMedia[];
  onSelectAnime: (anime: AnimeMedia) => void;
  onQuickPlay: (anime: AnimeMedia) => void;
  showRank?: boolean;
  onViewAll?: () => void;
}

export const AnimeRow: React.FC<AnimeRowProps> = ({
  title,
  subtitle,
  animeList,
  onSelectAnime,
  onQuickPlay,
  showRank = false,
  onViewAll,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { config } = useUiCustomization();

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -600 : 600;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!animeList || animeList.length === 0) {
    return null;
  }

  const isGrid = config.cardViewMode === 'grid';

  return (
    <section
      className="last:border-none"
      style={{
        paddingTop: `${config.sectionSpacingPx}px`,
        paddingBottom: `${config.sectionSpacingPx}px`,
        borderBottom: `var(--kuro-border-width) solid var(--kuro-border)`,
      }}
    >
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8"
        style={{ maxWidth: config.containerMaxWidth }}
      >
        {/* Header row */}
        <div className="flex items-end justify-between mb-4 gap-4">
          <div>
            <h2
              className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"
              style={{ color: 'var(--kuro-text)', fontFamily: 'var(--font-display)' }}
            >
              <span>{title}</span>
            </h2>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--kuro-text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onViewAll && (
              <button
                onClick={onViewAll}
                className="text-xs font-medium transition-colors mr-2 whitespace-nowrap"
                style={{ color: 'var(--kuro-accent)' }}
              >
                View all &rarr;
              </button>
            )}

            {!isGrid && (
              <>
                <button
                  onClick={() => handleScroll('left')}
                  className="w-8 h-8 border flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: 'var(--kuro-surface)',
                    borderColor: 'var(--kuro-border)',
                    color: 'var(--kuro-text-muted)',
                    borderRadius: 'var(--kuro-radius-sm)',
                  }}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleScroll('right')}
                  className="w-8 h-8 border flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: 'var(--kuro-surface)',
                    borderColor: 'var(--kuro-border)',
                    color: 'var(--kuro-text-muted)',
                    borderRadius: 'var(--kuro-radius-sm)',
                  }}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Carousel or Responsive Custom Grid */}
        {isGrid ? (
          <div
            className="kuro-anime-grid py-2"
            style={{ ['--kuro-grid-cols' as any]: config.cardGridColumns }}
          >
            {animeList.map((anime, idx) => (
              <AnimeCard
                key={`${anime.id}-${idx}`}
                anime={anime}
                rank={showRank ? idx + 1 : undefined}
                onSelect={onSelectAnime}
                onQuickPlay={onQuickPlay}
                isGridItem={true}
              />
            ))}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex items-stretch overflow-x-auto no-scrollbar py-2 -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth"
            style={{ gap: `${config.cardGapPx}px` }}
          >
            {animeList.map((anime, idx) => (
              <AnimeCard
                key={`${anime.id}-${idx}`}
                anime={anime}
                rank={showRank ? idx + 1 : undefined}
                onSelect={onSelectAnime}
                onQuickPlay={onQuickPlay}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
