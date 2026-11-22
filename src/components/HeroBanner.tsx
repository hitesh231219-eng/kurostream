import React, { useState, useEffect } from 'react';
import { Play, Plus, Check, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimeMedia } from '../types/anime';
import { useWatchlist } from '../context/WatchlistContext';
import { cleanHtmlDescription } from '../utils/text';
import { useUiCustomization } from '../context/UiCustomizationContext';

interface HeroBannerProps {
  featuredList: AnimeMedia[];
  onPlayEpisode: (anime: AnimeMedia, episode: number) => void;
  onOpenDetails: (anime: AnimeMedia) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  featuredList,
  onPlayEpisode,
  onOpenDetails,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [failedThumbs, setFailedThumbs] = useState<Record<number, boolean>>({});
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const { config } = useUiCustomization();

  const slideCount = Math.min(5, featuredList.length);

  // Auto-slide every 7 seconds when enabled and not paused
  useEffect(() => {
    if (!config.heroAutoSlide || !featuredList || slideCount <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slideCount);
    }, 7000);

    return () => clearInterval(timer);
  }, [config.heroAutoSlide, featuredList, slideCount, isPaused]);

  if (config.heroMode === 'hidden' || !featuredList || featuredList.length === 0) {
    return null;
  }

  const currentAnime = featuredList[currentIndex] || featuredList[0];
  const inWatchlist = isInWatchlist(currentAnime.id);

  const bannerUrl =
    currentAnime.bannerImage || currentAnime.coverImage?.extraLarge || currentAnime.coverImage?.large;
  const posterUrl =
    currentAnime.coverImage?.extraLarge || currentAnime.coverImage?.large || currentAnime.bannerImage;
  const englishTitle = currentAnime.title.english || currentAnime.title.romaji || 'Anime Showcase';
  const nativeTitle = currentAnime.title.native;
  const score = currentAnime.averageScore ? (currentAnime.averageScore / 10).toFixed(1) : null;
  const cleanDesc = cleanHtmlDescription(currentAnime.description);

  const handlePrevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + slideCount) % slideCount);
  };

  const handleNextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % slideCount);
  };

  // Split 2-column editorial layout
  if (config.heroMode === 'split') {
    return (
      <section
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{
          borderBottom: `var(--kuro-border-width) solid var(--kuro-border)`,
          backgroundColor: 'var(--kuro-surface)',
        }}
      >
        <div
          className="mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
          style={{ maxWidth: config.containerMaxWidth }}
        >
          <div className="lg:col-span-7 flex flex-col justify-center space-y-4">
            <div
              className="flex flex-wrap items-center gap-2.5 text-xs font-medium"
              style={{ color: 'var(--kuro-text-muted)' }}
            >
              {score && (
                <span className="flex items-center gap-1 text-amber-500 font-mono tabular-nums font-semibold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {score}
                </span>
              )}
              {score && <span aria-hidden="true">·</span>}
              <span>{currentAnime.format || 'TV Series'}</span>
              {currentAnime.seasonYear && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{currentAnime.seasonYear}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {currentAnime.format === 'MOVIE'
                  ? 'Feature Film'
                  : currentAnime.episodes
                  ? `${currentAnime.episodes} Episodes`
                  : 'Ongoing'}
              </span>
            </div>

            <div>
              {config.heroShowNativeTitle && nativeTitle && (
                <p className="text-xs tracking-wide mb-1" style={{ color: 'var(--kuro-text-muted)' }}>
                  {nativeTitle}
                </p>
              )}
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-balance line-clamp-2"
                style={{ color: 'var(--kuro-text)' }}
              >
                {englishTitle}
              </h1>
            </div>

            {config.heroShowGenres && (currentAnime.genres || []).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--kuro-text-muted)' }}>
                {(currentAnime.genres || []).slice(0, 4).map((genre, idx) => (
                  <React.Fragment key={genre}>
                    {idx > 0 && <span aria-hidden="true">·</span>}
                    <span>{genre}</span>
                  </React.Fragment>
                ))}
              </div>
            )}

            {config.heroShowDescription && (
              <p
                className="text-sm line-clamp-3 leading-relaxed max-w-xl"
                style={{ color: 'var(--kuro-text-muted)' }}
              >
                {cleanDesc ||
                  'Follow the epic journey, unforgettable battles, and legendary characters in this acclaimed anime masterpiece.'}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onPlayEpisode(currentAnime, 1)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all shadow-lg whitespace-nowrap shrink-0 active:scale-95 kuro-on-accent"
                style={{
                  backgroundColor: 'var(--kuro-accent)',
                  color: 'var(--kuro-accent-text)',
                  borderRadius: 'var(--kuro-radius-sm)',
                }}
              >
                <Play className="w-4 h-4 fill-current" />
                {currentAnime.format === 'MOVIE' ? 'Watch Movie' : 'Watch Episode 1'}
              </button>

              <button
                onClick={() => {
                  if (inWatchlist) {
                    removeFromWatchlist(currentAnime.id);
                  } else {
                    addToWatchlist(currentAnime, 'watching');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 border text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: 'var(--kuro-surface-alt)',
                  borderColor: inWatchlist ? 'var(--kuro-accent-2)' : 'var(--kuro-border)',
                  color: inWatchlist ? 'var(--kuro-accent-2)' : 'var(--kuro-text)',
                  borderRadius: 'var(--kuro-radius-sm)',
                }}
              >
                {inWatchlist ? (
                  <>
                    <Check className="w-4 h-4" />
                    In Watchlist
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Watchlist
                  </>
                )}
              </button>

              <button
                onClick={() => onOpenDetails(currentAnime)}
                className="flex items-center gap-2 px-4 py-2.5 border text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: 'var(--kuro-surface-alt)',
                  borderColor: 'var(--kuro-border)',
                  color: 'var(--kuro-text)',
                  borderRadius: 'var(--kuro-radius-sm)',
                }}
              >
                <Info className="w-4 h-4" />
                Details
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between gap-3">
            <div
              className="relative overflow-hidden border h-64 sm:h-80 lg:h-full min-h-[300px]"
              style={{
                borderRadius: 'var(--kuro-radius)',
                borderColor: 'var(--kuro-border)',
                borderWidth: 'var(--kuro-border-width)',
              }}
            >
              {posterUrl && !failedImages[currentAnime.id] ? (
                <img
                  key={currentAnime.id}
                  src={posterUrl}
                  alt={englishTitle}
                  className="w-full h-full object-cover transition-all duration-500"
                  style={{
                    filter: `brightness(${config.heroBrightnessPct}%) blur(${config.heroBackdropBlurPx}px)`,
                  }}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImages((prev) => ({ ...prev, [currentAnime.id]: true }))}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-950/60 via-[#0e1220] to-[#08090d]" />
              )}

              {slideCount > 1 && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/75 backdrop-blur-md p-1 rounded-lg border border-white/15">
                  <button
                    onClick={handlePrevSlide}
                    className="w-7 h-7 rounded flex items-center justify-center text-white hover:bg-white/15 transition-colors kuro-on-media"
                    aria-label="Previous featured anime"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-1.5 text-[11px] font-mono tabular-nums text-white kuro-on-media">
                    0{currentIndex + 1} / 0{slideCount}
                  </span>
                  <button
                    onClick={handleNextSlide}
                    className="w-7 h-7 rounded flex items-center justify-center text-white hover:bg-white/15 transition-colors kuro-on-media"
                    aria-label="Next featured anime"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Full / Compact / Minimal overlay hero modes
  const resolvedHeight =
    config.heroMode === 'minimal'
      ? Math.min(config.heroHeightPx, 290)
      : config.heroMode === 'compact'
      ? Math.min(config.heroHeightPx, 400)
      : config.heroHeightPx;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full overflow-hidden bg-[#08090d]"
      style={{
        height: `${resolvedHeight}px`,
        borderBottom: `var(--kuro-border-width) solid var(--kuro-border)`,
      }}
    >
      {/* Background Banner with measured contrast scrim */}
      <div className="absolute inset-0">
        {bannerUrl && !failedImages[currentAnime.id] ? (
          <img
            key={currentAnime.id}
            src={bannerUrl}
            alt={englishTitle}
            className="w-full h-full object-cover object-center transform scale-105 transition-all duration-700 ease-out"
            style={{
              filter: `brightness(${config.heroBrightnessPct}%) blur(${config.heroBackdropBlurPx}px)`,
            }}
            referrerPolicy="no-referrer"
            onError={() => setFailedImages((prev) => ({ ...prev, [currentAnime.id]: true }))}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-950/60 via-[#0e1220] to-[#08090d]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08090d] via-[#08090d]/85 to-transparent w-full md:w-3/4" />
      </div>

      {/* Content Container */}
      <div
        className="relative z-10 mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-8 md:pb-12"
        style={{ maxWidth: config.containerMaxWidth }}
      >
        <div className="max-w-2xl space-y-3">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium text-slate-300 kuro-on-media">
            {score && (
              <span className="flex items-center gap-1 text-amber-400 font-mono tabular-nums">
                <Star className="w-3.5 h-3.5 fill-current" />
                {score}
              </span>
            )}
            {score && <span aria-hidden="true" className="text-slate-500">·</span>}
            <span>{currentAnime.format || 'TV Series'}</span>
            {currentAnime.seasonYear && (
              <>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="tabular-nums">{currentAnime.seasonYear}</span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="font-mono tabular-nums">
              {currentAnime.format === 'MOVIE'
                ? 'Feature Film'
                : currentAnime.episodes
                ? `${currentAnime.episodes} Episodes`
                : 'Ongoing'}
            </span>
          </div>

          {/* Titles */}
          <div>
            {config.heroShowNativeTitle && nativeTitle && config.heroMode !== 'minimal' && (
              <p className="text-xs text-slate-400 tracking-wide mb-1 kuro-on-media">
                {nativeTitle}
              </p>
            )}
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight text-balance line-clamp-2 kuro-on-media">
              {englishTitle}
            </h1>
          </div>

          {/* Clean Genre Line */}
          {config.heroShowGenres && config.heroMode !== 'minimal' && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 kuro-on-media">
              {(currentAnime.genres || []).slice(0, 4).map((genre, idx) => (
                <React.Fragment key={genre}>
                  {idx > 0 && <span aria-hidden="true" className="text-slate-500">·</span>}
                  <span>{genre}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Description */}
          {config.heroShowDescription && config.heroMode !== 'minimal' && (
            <p className="text-sm text-slate-200 line-clamp-3 leading-relaxed max-w-xl kuro-on-media">
              {cleanDesc ||
                'Follow the epic journey, unforgettable battles, and legendary characters in this acclaimed anime masterpiece.'}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1.5">
            <button
              onClick={() => onPlayEpisode(currentAnime, 1)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all shadow-lg whitespace-nowrap shrink-0 active:scale-95 kuro-on-accent"
              style={{
                backgroundColor: 'var(--kuro-accent)',
                color: 'var(--kuro-accent-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
            >
              <Play className="w-4 h-4 fill-current" />
              {currentAnime.format === 'MOVIE' ? 'Watch Movie' : 'Watch Episode 1'}
            </button>

            <button
              onClick={() => {
                if (inWatchlist) {
                  removeFromWatchlist(currentAnime.id);
                } else {
                  addToWatchlist(currentAnime, 'watching');
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 border text-sm font-medium transition-colors whitespace-nowrap shrink-0 kuro-on-media ${
                inWatchlist
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-950/80'
                  : 'bg-[#12151f]/90 border-[#242a3b] text-slate-100 hover:text-white hover:bg-[#191e2e]'
              }`}
              style={{ borderRadius: 'var(--kuro-radius-sm)' }}
            >
              {inWatchlist ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  In Watchlist
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-slate-300" />
                  Watchlist
                </>
              )}
            </button>

            <button
              onClick={() => onOpenDetails(currentAnime)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#12151f]/80 border border-[#242a3b] text-slate-200 hover:text-white hover:bg-[#191e2e] text-sm font-medium transition-colors whitespace-nowrap shrink-0 kuro-on-media"
              style={{ borderRadius: 'var(--kuro-radius-sm)' }}
            >
              <Info className="w-4 h-4 text-slate-300" />
              Details
            </button>
          </div>
        </div>

        {/* Hero Slide Selector & Arrow Controls */}
        {slideCount > 1 && config.heroMode !== 'minimal' && (
          <div className="hidden lg:flex items-center gap-2 absolute right-8 bottom-10 z-20">
            <button
              onClick={handlePrevSlide}
              className="w-9 h-9 rounded-lg bg-[#0d0f15]/85 hover:bg-[#181d2b] border border-[#23293a] text-slate-200 hover:text-white flex items-center justify-center transition-colors kuro-on-media"
              aria-label="Previous featured anime"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 bg-[#0d0f15]/85 backdrop-blur-md p-1.5 rounded-xl border border-[#1f2433]">
              {featuredList.slice(0, 5).map((anime, idx) => (
                <button
                  key={anime.id}
                  onClick={() => setCurrentIndex(idx)}
                  className="relative w-12 h-16 rounded-lg overflow-hidden border transition-all bg-[#141824]"
                  style={{
                    borderColor: idx === currentIndex ? 'var(--kuro-accent)' : 'transparent',
                    opacity: idx === currentIndex ? 1 : 0.6,
                    transform: idx === currentIndex ? 'scale(1.05)' : undefined,
                  }}
                  title={anime.title.english || anime.title.romaji}
                >
                  {(anime.coverImage?.medium || anime.coverImage?.large) && !failedThumbs[anime.id] ? (
                    <img
                      src={anime.coverImage?.medium || anime.coverImage?.large}
                      alt={anime.title.romaji}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setFailedThumbs((prev) => ({ ...prev, [anime.id]: true }))}
                    />
                  ) : null}
                  <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[10px] text-center font-mono py-0.5 text-white tabular-nums kuro-on-media">
                    0{idx + 1}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleNextSlide}
              className="w-9 h-9 rounded-lg bg-[#0d0f15]/85 hover:bg-[#181d2b] border border-[#23293a] text-slate-200 hover:text-white flex items-center justify-center transition-colors kuro-on-media"
              aria-label="Next featured anime"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
