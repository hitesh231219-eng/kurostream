import React from 'react';
import {
  Search,
  User,
  Monitor,
  Download,
  Dices,
  Compass,
  Flame,
  Trophy,
  BookOpen,
  Users,
  Bookmark,
  Home,
  ArrowDownAZ,
} from 'lucide-react';
import { NavTab } from '../types/anime';
import { useWatchlist } from '../context/WatchlistContext';
import { useAuth } from '../context/AuthContext';
import { ALL_NAV_TABS, useUiCustomization } from '../context/UiCustomizationContext';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenSearch: () => void;
  onOpenDownloads: () => void;
  onOpenWindowsWizard: () => void;
  onOpenDice?: () => void;
}

const TAB_ICONS: Record<NavTab, React.ReactNode> = {
  home: <Home className="w-4 h-4 shrink-0" />,
  trending: <Flame className="w-4 h-4 shrink-0" />,
  popular: <Trophy className="w-4 h-4 shrink-0" />,
  browse: <Compass className="w-4 h-4 shrink-0" />,
  az: <ArrowDownAZ className="w-4 h-4 shrink-0" />,
  manga: <BookOpen className="w-4 h-4 shrink-0" />,
  watchparty: <Users className="w-4 h-4 shrink-0" />,
  watchlist: <Bookmark className="w-4 h-4 shrink-0" />,
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenSearch,
  onOpenDownloads,
  onOpenWindowsWizard,
  onOpenDice,
}) => {
  const { watchlist } = useWatchlist();
  const { user, openAuthModal } = useAuth();
  const { config } = useUiCustomization();
  const watchlistCount = watchlist.length;

  const defaultVisibleTabs: NavTab[] = [
    'home',
    'trending',
    'popular',
    'browse',
    'az',
    'manga',
    'watchparty',
    'watchlist',
  ];

  const visibleTabs = Array.isArray(config?.visibleNavTabs) && config.visibleNavTabs.length > 0
    ? ['home' as NavTab, ...config.visibleNavTabs.filter((t) => t !== 'home')]
    : defaultVisibleTabs;

  // Ensure 'az' is in visibleTabs
  if (!visibleTabs.includes('az')) {
    const browseIndex = visibleTabs.indexOf('browse');
    if (browseIndex !== -1) {
      visibleTabs.splice(browseIndex + 1, 0, 'az');
    } else {
      visibleTabs.push('az');
    }
  }

  const navItems = visibleTabs.map((tabId) => {
    const meta = ALL_NAV_TABS.find((t) => t.id === tabId);
    return {
      id: tabId,
      label: meta?.label || (tabId === 'az' ? 'A-Z' : tabId),
      count: tabId === 'watchlist' ? watchlistCount : undefined,
    };
  });

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#08090d]/95 backdrop-blur-md border-b border-[#1b2030] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 md:gap-8">
          {/* Zone 1: Single element brand wordmark */}
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2 text-lg sm:text-xl font-extrabold tracking-tight text-white hover:text-violet-400 transition-colors whitespace-nowrap shrink-0 group focus:outline-none"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-md shadow-violet-600/30 group-hover:scale-105 transition-transform">
              K
            </span>
            <span className="font-extrabold tracking-tight">KUROSTREAM</span>
          </button>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 overflow-x-auto no-scrollbar py-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-[#151926]'
                  }`}
                >
                  {TAB_ICONS[item.id]}
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-violet-900/60 text-violet-200 border border-violet-500/40 tabular-nums">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Actions & Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* 🎲 Random Anime Dice Button */}
            {onOpenDice && (
              <button
                onClick={onOpenDice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold transition-all shadow-md shadow-violet-600/25 shrink-0 group active:scale-95"
                title="Roll the Dice — Discover a Random Anime"
                aria-label="Roll the Dice"
              >
                <Dices className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                <span className="hidden sm:inline">Random</span>
              </button>
            )}

            {/* Search Trigger */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#131724] hover:bg-[#1c2234] border border-[#23293d] text-slate-300 hover:text-white text-xs font-medium transition-colors shrink-0"
              title="Search Anime & Manga (Cmd+K)"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden xl:inline-block font-mono text-[10px] text-slate-500 bg-[#191e2e] px-1 py-0.5 rounded border border-[#252c42]">
                ⌘K
              </kbd>
            </button>

            {/* Downloads Hub */}
            <button
              onClick={onOpenDownloads}
              className="p-2 rounded-xl bg-[#131724] hover:bg-[#1c2234] border border-[#23293d] text-slate-300 hover:text-violet-400 transition-colors shrink-0"
              title="Anime Downloads & Offline Packs"
              aria-label="Downloads"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Profile / Account */}
            <button
              onClick={openAuthModal}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#131724] hover:bg-[#1c2234] border border-[#23293d] text-slate-200 hover:text-white transition-colors shrink-0"
              title={user?.name || 'User Profile & Cloud Sync'}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-lg object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
              <span className="hidden xl:inline text-xs font-semibold max-w-[80px] truncate">
                {user?.name || 'Sign In'}
              </span>
            </button>

            {/* Desktop / Native App */}
            {onOpenWindowsWizard && (
              <button
                onClick={onOpenWindowsWizard}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131724] hover:bg-[#1c2234] border border-[#23293d] text-xs font-semibold text-slate-300 hover:text-white transition-colors shrink-0"
                title="Download Windows App & Setup Package"
              >
                <Monitor className="w-3.5 h-3.5 text-violet-400" />
                <span className="hidden md:inline">Desktop</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Horizontal Navigation Scroller */}
        <div className="lg:hidden flex items-center gap-1 px-4 py-2 bg-[#090b10] border-t border-[#171b26] overflow-x-auto no-scrollbar text-xs">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-violet-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {TAB_ICONS[item.id]}
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-[10px] font-mono opacity-80">({item.count})</span>
                )}
              </button>
            );
          })}
        </div>
      </header>
    </>
  );
};
