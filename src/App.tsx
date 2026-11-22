import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { NavTab, AnimeMedia } from './types/anime';
import { WatchlistProvider } from './context/WatchlistContext';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { ContinueWatchingRow } from './components/ContinueWatchingRow';
import { AnimeRow } from './components/AnimeRow';
import { AnimeCard } from './components/AnimeCard';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { AnimeDetailModal } from './components/AnimeDetailModal';
import { SearchModal } from './components/SearchModal';
import { Footer } from './components/Footer';
import { HomeFaqSection } from './components/HomeFaqSection';
import { LegalModal, LegalTab } from './components/LegalModal';
import { DecentralizedAddonsModal, ArchitectureModalTab } from './components/DecentralizedAddonsModal';
import { MirrorsModal } from './components/MirrorsModal';
import { AnimeDownloadModal } from './components/AnimeDownloadModal';
import { UiCustomizerModal } from './components/UiCustomizerModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  getTrendingAnime,
  getPopularAnime,
  getTopRatedAnime,
  getAnimeByGenre,
  FALLBACK_ANIME_LIST,
} from './services/anilist';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  UiCustomizationProvider,
  useUiCustomization,
  HomeSectionId,
  DEFAULT_HOME_SECTION_META,
} from './context/UiCustomizationContext';
import { AuthProfileModal } from './components/AuthProfileModal';
import { Flame, TrendingUp, Monitor, Maximize2, Loader2, WifiOff, X } from 'lucide-react';
import { WindowsTitleBar } from './components/WindowsTitleBar';

// Code-split secondary views & heavy desktop modal
const BrowseView = lazy(() =>
  import('./components/BrowseView').then((m) => ({ default: m.BrowseView }))
);
const WatchlistView = lazy(() =>
  import('./components/WatchlistView').then((m) => ({ default: m.WatchlistView }))
);
const MangaSectionView = lazy(() =>
  import('./components/MangaSectionView').then((m) => ({ default: m.MangaSectionView }))
);
const WatchPartyView = lazy(() =>
  import('./components/WatchPartyView').then((m) => ({ default: m.WatchPartyView }))
);
const WindowsSetupWizardModal = lazy(() =>
  import('./components/WindowsSetupWizardModal').then((m) => ({
    default: m.WindowsSetupWizardModal,
  }))
);
import { PwaInstallBanner } from './components/PwaInstallBanner';

const ROUTE_META: Record<NavTab, { path: string; title: string; description: string }> = {
  home: {
    path: '/',
    title: 'KuroStream — Anime Streaming, Manga & Watch Parties',
    description:
      'Stream anime with AniList metadata, synchronized WebSocket Watch Parties, verified Manga chapters, and Google account cloud sync.',
  },
  trending: {
    path: '/trending',
    title: 'Trending Anime — KuroStream',
    description: 'Browse the top trending anime series updated live from AniList.',
  },
  popular: {
    path: '/top-rated',
    title: 'Top Rated Anime — KuroStream',
    description: 'Explore highest-rated anime series and movies of all time.',
  },
  browse: {
    path: '/browse',
    title: 'Browse Categories — KuroStream',
    description: 'Filter anime by genre, format, release status, and ranking.',
  },
  manga: {
    path: '/manga',
    title: 'Manga Reader — KuroStream',
    description: 'Read verified manga chapters with Honey and Sol integration.',
  },
  watchparty: {
    path: '/watch-party',
    title: 'Watch Party — KuroStream',
    description: 'Host or join real-time synchronized anime Watch Parties across devices.',
  },
  watchlist: {
    path: '/watchlist',
    title: 'My Watchlist — KuroStream',
    description: 'Manage your anime watchlist, exact resume timestamps, and cloud progress.',
  },
};

function parseInitialRoute(): {
  tab: NavTab;
  genre: string;
  roomCode: string | null;
  legalTab: LegalTab | null;
  addonsTab: ArchitectureModalTab | null;
  mirrorsOpen: boolean;
  downloadsOpen: boolean;
  settingsOpen: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      tab: 'home',
      genre: 'ALL',
      roomCode: null,
      legalTab: null,
      addonsTab: null,
      mirrorsOpen: false,
      downloadsOpen: false,
      settingsOpen: false,
    };
  }
  const rawPath = window.location.pathname;
  const path = rawPath.toLowerCase();
  const params = new URLSearchParams(window.location.search);

  const partyQuery = params.get('party');
  const partyPathMatch = rawPath.match(/^\/watch-party\/([a-zA-Z0-9_-]+)/i);
  if (partyQuery || path.startsWith('/watch-party')) {
    const code = (partyQuery || partyPathMatch?.[1] || '').trim().toUpperCase() || null;
    return { tab: 'watchparty', genre: 'ALL', roomCode: code, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  }
  if (path.startsWith('/settings')) return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: true };
  if (path.startsWith('/downloads')) return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: true, settingsOpen: false };
  if (path.startsWith('/mirrors')) return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: true, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/addons')) return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: 'addons', mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/decentralized')) return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: 'network', mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/terms')) return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: 'terms', addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/dmca')) return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: 'dmca', addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/privacy')) return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: 'privacy', addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/trending')) return { tab: 'trending', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/top-rated')) return { tab: 'popular', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/browse')) {
    return { tab: 'browse', genre: params.get('genre') || 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  }
  if (path.startsWith('/manga')) return { tab: 'manga', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  if (path.startsWith('/watchlist')) return { tab: 'watchlist', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
  return { tab: 'home', genre: 'ALL', roomCode: null, legalTab: null, addonsTab: null, mirrorsOpen: false, downloadsOpen: false, settingsOpen: false };
}

function ViewLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-28" style={{ color: 'var(--kuro-text-muted)' }}>
      <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: 'var(--kuro-accent)' }} />
      <p className="text-xs font-medium">Loading view...</p>
    </div>
  );
}

function AnimeApp() {
  const { openAuthModal } = useAuth();
  const { config, openCustomizer, toggleCustomizer } = useUiCustomization();
  const initialRoute = parseInitialRoute();
  const [currentTab, setCurrentTab] = useState<NavTab>(initialRoute.tab);
  const [selectedGenreForBrowse, setSelectedGenreForBrowse] = useState<string>(initialRoute.genre);
  const [watchPartyRoomCode, setWatchPartyRoomCode] = useState<string | null>(initialRoute.roomCode);

  const [playerAnime, setPlayerAnime] = useState<AnimeMedia | null>(null);
  const [playerEpisode, setPlayerEpisode] = useState<number>(1);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);

  const [detailAnime, setDetailAnime] = useState<AnimeMedia | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isWindowsWizardOpen, setIsWindowsWizardOpen] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab | null>(initialRoute.legalTab);
  const [addonsModalTab, setAddonsModalTab] = useState<ArchitectureModalTab | null>(initialRoute.addonsTab);
  const [isMirrorsOpen, setIsMirrorsOpen] = useState<boolean>(initialRoute.mirrorsOpen);
  const [downloadModalState, setDownloadModalState] = useState<{
    isOpen: boolean;
    anime: AnimeMedia | null;
    episode: number;
    audio: 'sub' | 'dub';
  }>({
    isOpen: initialRoute.downloadsOpen,
    anime: null,
    episode: 1,
    audio: 'sub',
  });
  const [isMinimizedToTray, setIsMinimizedToTray] = useState<boolean>(false);
  const [watchPartySeed, setWatchPartySeed] = useState<{ anime: AnimeMedia; episode: number } | null>(null);
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState<boolean>(false);
  const [isOfflineCatalog, setIsOfflineCatalog] = useState<boolean>(false);

  const [isWindowsDesktopMode, setIsWindowsDesktopMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kuro_desktop_mode') === 'true' || !!(window as any).electronAPI;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (initialRoute.settingsOpen) {
      openCustomizer();
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('kuro_desktop_mode', String(isWindowsDesktopMode));
    } catch {}
  }, [isWindowsDesktopMode]);

  // Synchronize document title & meta description per active route
  useEffect(() => {
    const meta = ROUTE_META[currentTab] || ROUTE_META.home;
    const brand = config.brandName || 'KuroStream';
    document.title = meta.title.replace('KuroStream', brand);
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) {
      descEl.setAttribute('content', meta.description);
    }
  }, [currentTab, config.brandName]);

  // Browser back/forward navigation support
  useEffect(() => {
    const onPopState = () => {
      const parsed = parseInitialRoute();
      setCurrentTab(parsed.tab);
      setSelectedGenreForBrowse(parsed.genre);
      setWatchPartyRoomCode(parsed.roomCode);
      setLegalModalTab(parsed.legalTab);
      setAddonsModalTab(parsed.addonsTab);
      setIsMirrorsOpen(parsed.mirrorsOpen);
      setDownloadModalState((prev) => ({ ...prev, isOpen: parsed.downloadsOpen }));
      if (parsed.settingsOpen) openCustomizer();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [openCustomizer]);

  const handleJumpToFaq = useCallback(() => {
    if (currentTab !== 'home') {
      setCurrentTab('home');
      window.history.pushState({ tab: 'home' }, '', '/');
      setTimeout(() => {
        document.getElementById('home-faq')?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    } else {
      document.getElementById('home-faq')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentTab]);

  const navigateToTab = useCallback((tab: NavTab, extraQuery?: string) => {
    setCurrentTab(tab);
    const meta = ROUTE_META[tab] || ROUTE_META.home;
    const nextUrl = extraQuery ? `${meta.path}?${extraQuery}` : meta.path;
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.pushState({ tab }, '', nextUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleWatchPartyRoomChange = useCallback((roomId: string | null) => {
    const normalized = roomId ? roomId.trim().toUpperCase() : null;
    setWatchPartyRoomCode(normalized);
    const targetPath = normalized ? `/watch-party/${encodeURIComponent(normalized)}` : '/watch-party';
    if (window.location.pathname + window.location.search !== targetPath) {
      window.history.replaceState({ tab: 'watchparty', roomCode: normalized }, '', targetPath);
    }
  }, []);

  // Global shortcuts: Cmd/Ctrl + K (Search) and Cmd/Ctrl + , (UI Customizer Studio)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        toggleCustomizer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCustomizer]);

  const [trendingAnime, setTrendingAnime] = useState<AnimeMedia[]>(FALLBACK_ANIME_LIST);
  const [popularAnime, setPopularAnime] = useState<AnimeMedia[]>([]);
  const [topRatedAnime, setTopRatedAnime] = useState<AnimeMedia[]>([]);
  const [actionAnime, setActionAnime] = useState<AnimeMedia[]>([]);
  const [fantasyAnime, setFantasyAnime] = useState<AnimeMedia[]>([]);
  const [romanceAnime, setRomanceAnime] = useState<AnimeMedia[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [trending, popular, topRated, action, fantasy, romance] = await Promise.all([
          getTrendingAnime(1, 16),
          getPopularAnime(1, 16),
          getTopRatedAnime(1, 16),
          getAnimeByGenre('Action', 1, 16),
          getAnimeByGenre('Fantasy', 1, 16),
          getAnimeByGenre('Romance', 1, 16),
        ]);

        if (isMounted) {
          setIsOfflineCatalog(trending === FALLBACK_ANIME_LIST);
          if (trending && trending.length > 0) setTrendingAnime(trending);
          if (popular && popular.length > 0) setPopularAnime(popular);
          if (topRated && topRated.length > 0) setTopRatedAnime(topRated);
          if (action && action.length > 0) setActionAnime(action);
          if (fantasy && fantasy.length > 0) setFantasyAnime(fantasy);
          if (romance && romance.length > 0) setRomanceAnime(romance);
        }
      } catch (err) {
        console.error('Failed to load initial anime data:', err);
        if (isMounted) setIsOfflineCatalog(true);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlayEpisode = (anime: AnimeMedia, episode: number = 1) => {
    setPlayerAnime(anime);
    setPlayerEpisode(episode);
    setIsPlayerOpen(true);
  };

  const handleOpenDetails = (anime: AnimeMedia) => {
    setDetailAnime(anime);
    setIsDetailOpen(true);
  };

  const handleNavigateToBrowseWithGenre = (genre: string) => {
    setSelectedGenreForBrowse(genre);
    navigateToTab('browse', genre !== 'ALL' ? `genre=${encodeURIComponent(genre)}` : undefined);
  };

  const handleStartWatchPartyFromPlayer = (anime: AnimeMedia, episode: number) => {
    setIsPlayerOpen(false);
    setWatchPartySeed({ anime, episode });
    navigateToTab('watchparty');
  };

  const renderHomeSection = (sectionId: HomeSectionId): React.ReactNode => {
    const customTitle = config.customSectionTitles[sectionId]?.trim();
    const titleFor = (id: HomeSectionId) =>
      customTitle || DEFAULT_HOME_SECTION_META[id].defaultTitle;

    switch (sectionId) {
      case 'hero':
        return (
          <HeroBanner
            key="hero"
            featuredList={trendingAnime.slice(0, 5)}
            onPlayEpisode={handlePlayEpisode}
            onOpenDetails={handleOpenDetails}
          />
        );
      case 'continue':
        return (
          <ContinueWatchingRow
            key="continue"
            title={titleFor('continue')}
            onPlayEpisode={handlePlayEpisode}
            onOpenDetails={handleOpenDetails}
          />
        );
      case 'trending':
        return (
          <AnimeRow
            key="trending"
            title={titleFor('trending')}
            subtitle="Most watched and discussed series this week"
            animeList={trendingAnime}
            showRank={true}
            onSelectAnime={handleOpenDetails}
            onQuickPlay={(anime) => handlePlayEpisode(anime, 1)}
            onViewAll={() => navigateToTab('trending')}
          />
        );
      case 'topRated':
        return (
          <AnimeRow
            key="topRated"
            title={titleFor('topRated')}
            subtitle="Critically acclaimed series of all time"
            animeList={topRatedAnime.length > 0 ? topRatedAnime : trendingAnime}
            onSelectAnime={handleOpenDetails}
            onQuickPlay={(anime) => handlePlayEpisode(anime, 1)}
            onViewAll={() => navigateToTab('popular')}
          />
        );
      case 'action':
        return (
          <AnimeRow
            key="action"
            title={titleFor('action')}
            subtitle="High-octane fights, super powers, and adrenaline"
            animeList={actionAnime.length > 0 ? actionAnime : trendingAnime}
            onSelectAnime={handleOpenDetails}
            onQuickPlay={(anime) => handlePlayEpisode(anime, 1)}
            onViewAll={() => handleNavigateToBrowseWithGenre('Action')}
          />
        );
      case 'fantasy':
        return (
          <AnimeRow
            key="fantasy"
            title={titleFor('fantasy')}
            subtitle="Magical worlds, legendary spirits, and mythical adventures"
            animeList={fantasyAnime.length > 0 ? fantasyAnime : popularAnime}
            onSelectAnime={handleOpenDetails}
            onQuickPlay={(anime) => handlePlayEpisode(anime, 1)}
            onViewAll={() => handleNavigateToBrowseWithGenre('Fantasy')}
          />
        );
      case 'romance':
        return (
          <AnimeRow
            key="romance"
            title={titleFor('romance')}
            subtitle="Heartfelt stories, school days, and emotional bonds"
            animeList={romanceAnime.length > 0 ? romanceAnime : trendingAnime}
            onSelectAnime={handleOpenDetails}
            onQuickPlay={(anime) => handlePlayEpisode(anime, 1)}
            onViewAll={() => handleNavigateToBrowseWithGenre('Romance')}
          />
        );
      case 'faq':
        return (
          <HomeFaqSection
            key="faq"
            customTitle={customTitle}
            onSelectTab={(tab) => navigateToTab(tab)}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenAuth={openAuthModal}
            onOpenWindowsWizard={() => setIsWindowsWizardOpen(true)}
            onOpenLegal={(tab) => setLegalModalTab(tab)}
            onOpenAddonsHub={(tab = 'addons') => setAddonsModalTab(tab)}
          />
        );
      default:
        return null;
    }
  };

  if (isMinimizedToTray) {
    return (
      <div className="min-h-screen bg-[#06070a] flex items-end justify-end p-6">
        <button
          onClick={() => setIsMinimizedToTray(false)}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111521] hover:bg-[#181e2f] border border-[#2a334d] text-white shadow-2xl transition-colors"
        >
          <Monitor className="w-4 h-4 text-violet-400" />
          <div className="text-left">
            <p className="text-xs font-bold">{config.brandName || 'KuroStream'} Desktop</p>
            <p className="text-[11px] text-slate-400">Minimized to System Tray · Click to restore</p>
          </div>
          <Maximize2 className="w-4 h-4 text-slate-400 ml-2" />
        </button>
      </div>
    );
  }

  const isSidebar =
    config.navPosition === 'left-sidebar' || config.navPosition === 'right-sidebar';

  return (
    <div
      className={`kuro-app-shell relative min-h-screen flex flex-col ${
        isWindowsDesktopMode ? 'border border-[#232b40]' : ''
      } ${config.navPosition === 'bottom-dock' ? 'pb-24' : ''}`}
      style={{ color: 'var(--kuro-text)' }}
    >
      {/* Optional Custom Full-Bleed Wallpaper Canvas */}
      {config.bgMode === 'image' && config.bgImageUrl.trim() && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src={config.bgImageUrl}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            style={{
              opacity: Math.max(0.05, Math.min(1, config.bgImageOpacityPct / 100)),
              filter: `blur(${config.bgImageBlurPx}px)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: config.bgColor,
              opacity: Math.max(0, Math.min(0.95, config.bgImageOverlayOpacityPct / 100)),
            }}
          />
        </div>
      )}

      {isWindowsDesktopMode && (
        <div className="relative z-20">
          <WindowsTitleBar
            onOpenSetupWizard={() => setIsWindowsWizardOpen(true)}
            onToggleDesktopMode={() => setIsWindowsDesktopMode(false)}
            onMinimizeToTray={() => setIsMinimizedToTray(true)}
            isDesktopModeActive={isWindowsDesktopMode}
          />
        </div>
      )}

      <div
        className={`relative z-10 flex-1 flex flex-col ${
          isSidebar
            ? config.navPosition === 'right-sidebar'
              ? 'lg:flex-row-reverse'
              : 'lg:flex-row'
            : ''
        }`}
      >
        <Header
          currentTab={currentTab}
          onSelectTab={(tab) => navigateToTab(tab)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenDownloads={() =>
            setDownloadModalState({ isOpen: true, anime: null, episode: 1, audio: 'sub' })
          }
          onOpenWindowsWizard={() => setIsWindowsWizardOpen(true)}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          {isOfflineCatalog && !offlineBannerDismissed && (
            <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 max-w-7xl mx-auto">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Live AniList feed is temporarily unreachable. Showing cached showcase catalog.
                </span>
              </div>
              <button
                onClick={() => setOfflineBannerDismissed(true)}
                className="text-amber-300 hover:text-white shrink-0"
                aria-label="Dismiss offline banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <main className="flex-1">
            {currentTab === 'home' && (
              <div>
                {config.homeSectionOrder
                  .filter((id) => !config.hiddenHomeSections.includes(id))
                  .map((id) => renderHomeSection(id))}
              </div>
            )}

            {currentTab === 'trending' && (
              <div
                className="mx-auto px-4 sm:px-6 lg:px-8 py-8"
                style={{ maxWidth: config.containerMaxWidth }}
              >
                <div className="mb-6">
                  <h1
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2"
                    style={{ color: 'var(--kuro-text)' }}
                  >
                    <Flame className="w-6 h-6" style={{ color: 'var(--kuro-accent)' }} />
                    <span>Trending Anime</span>
                  </h1>
                  <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--kuro-text-muted)' }}>
                    Real-time rankings based on AniList global community activity.
                  </p>
                </div>

                <div
                  className="kuro-anime-grid"
                  style={{ ['--kuro-grid-cols' as any]: config.cardGridColumns }}
                >
                  {trendingAnime.map((anime, idx) => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      rank={idx + 1}
                      onSelect={handleOpenDetails}
                      onQuickPlay={(a) => handlePlayEpisode(a, 1)}
                      isGridItem={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {currentTab === 'popular' && (
              <div
                className="mx-auto px-4 sm:px-6 lg:px-8 py-8"
                style={{ maxWidth: config.containerMaxWidth }}
              >
                <div className="mb-6">
                  <h1
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2"
                    style={{ color: 'var(--kuro-text)' }}
                  >
                    <TrendingUp className="w-6 h-6" style={{ color: 'var(--kuro-accent)' }} />
                    <span>Top Rated All-Time</span>
                  </h1>
                  <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--kuro-text-muted)' }}>
                    The highest scored anime series and movies according to fans worldwide.
                  </p>
                </div>

                <div
                  className="kuro-anime-grid"
                  style={{ ['--kuro-grid-cols' as any]: config.cardGridColumns }}
                >
                  {(topRatedAnime.length > 0 ? topRatedAnime : trendingAnime).map((anime, idx) => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      rank={idx + 1}
                      onSelect={handleOpenDetails}
                      onQuickPlay={(a) => handlePlayEpisode(a, 1)}
                      isGridItem={true}
                    />
                  ))}
                </div>
              </div>
            )}

            <Suspense fallback={<ViewLoadingFallback />}>
              {currentTab === 'browse' && (
                <BrowseView
                  initialGenre={selectedGenreForBrowse}
                  onSelectAnime={handleOpenDetails}
                  onQuickPlay={(a) => handlePlayEpisode(a, 1)}
                />
              )}

              {currentTab === 'manga' && (
                <MangaSectionView
                  onPlayAnime={handlePlayEpisode}
                  onOpenAnimeDetails={handleOpenDetails}
                />
              )}

              {currentTab === 'watchparty' && (
                <WatchPartyView
                  animeList={trendingAnime}
                  onOpenPlayer={handlePlayEpisode}
                  initialSeed={watchPartySeed}
                  initialRoomCode={watchPartyRoomCode}
                  onRoomCodeChange={handleWatchPartyRoomChange}
                />
              )}

              {currentTab === 'watchlist' && (
                <WatchlistView
                  onSelectAnime={handleOpenDetails}
                  onPlayEpisode={handlePlayEpisode}
                  onGoToBrowse={() => navigateToTab('browse')}
                />
              )}
            </Suspense>
          </main>

          <Footer
            onSelectTab={(tab) => navigateToTab(tab)}
            onOpenWindowsWizard={() => setIsWindowsWizardOpen(true)}
            onOpenLegal={(tab) => setLegalModalTab(tab)}
            onOpenAddonsHub={(tab = 'addons') => setAddonsModalTab(tab)}
            onOpenMirrors={() => setIsMirrorsOpen(true)}
            onJumpToFaq={handleJumpToFaq}
          />
        </div>
      </div>

      {playerAnime && (
        <VideoPlayerModal
          anime={playerAnime}
          initialEpisode={playerEpisode}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          onOpenDetails={(a) => {
            setIsPlayerOpen(false);
            handleOpenDetails(a);
          }}
          onStartWatchParty={handleStartWatchPartyFromPlayer}
          onOpenAddonsHub={() => setAddonsModalTab('addons')}
          onOpenDownload={(a, ep, aud) =>
            setDownloadModalState({ isOpen: true, anime: a, episode: ep, audio: aud })
          }
        />
      )}

      {detailAnime && (
        <AnimeDetailModal
          anime={detailAnime}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onPlayEpisode={handlePlayEpisode}
          onSelectAnime={(a) => {
            setDetailAnime(a);
          }}
          onOpenDownload={(a, ep) =>
            setDownloadModalState({ isOpen: true, anime: a, episode: ep, audio: 'sub' })
          }
        />
      )}

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectAnime={handleOpenDetails}
        onPlayEpisode={handlePlayEpisode}
      />

      {isWindowsWizardOpen && (
        <Suspense fallback={null}>
          <WindowsSetupWizardModal
            isOpen={isWindowsWizardOpen}
            onClose={() => setIsWindowsWizardOpen(false)}
            onEnableDesktopMode={() => setIsWindowsDesktopMode((prev) => !prev)}
            isDesktopModeActive={isWindowsDesktopMode}
          />
        </Suspense>
      )}

      <LegalModal
        isOpen={legalModalTab !== null}
        initialTab={legalModalTab || 'terms'}
        onClose={() => setLegalModalTab(null)}
      />

      <DecentralizedAddonsModal
        isOpen={addonsModalTab !== null}
        initialTab={addonsModalTab || 'addons'}
        onClose={() => setAddonsModalTab(null)}
      />

      <MirrorsModal
        isOpen={isMirrorsOpen}
        onClose={() => setIsMirrorsOpen(false)}
      />

      <AnimeDownloadModal
        isOpen={downloadModalState.isOpen}
        onClose={() => setDownloadModalState((prev) => ({ ...prev, isOpen: false }))}
        anime={downloadModalState.anime}
        initialEpisode={downloadModalState.episode}
        initialAudio={downloadModalState.audio}
      />

      <UiCustomizerModal />

      <AuthProfileModal />

      <PwaInstallBanner />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <UiCustomizationProvider>
        <AuthProvider>
          <WatchlistProvider>
            <AnimeApp />
          </WatchlistProvider>
        </AuthProvider>
      </UiCustomizationProvider>
    </ErrorBoundary>
  );
}
