import React from 'react';
import {
  Search,
  User,
  Monitor,
  Download,
  SlidersHorizontal,
  Compass,
  Flame,
  Trophy,
  BookOpen,
  Users,
  Bookmark,
  Home,
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
}

const TAB_ICONS: Record<NavTab, React.ReactNode> = {
  home: <Home className="w-4 h-4 shrink-0" />,
  trending: <Flame className="w-4 h-4 shrink-0" />,
  popular: <Trophy className="w-4 h-4 shrink-0" />,
  browse: <Compass className="w-4 h-4 shrink-0" />,
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
}) => {
  const { watchlist } = useWatchlist();
  const { user, openAuthModal } = useAuth();
  const { config, openCustomizer } = useUiCustomization();
  const watchlistCount = watchlist.length;

  const navItems = config.visibleNavTabs.map((tabId) => {
    const meta = ALL_NAV_TABS.find((t) => t.id === tabId);
    return {
      id: tabId,
      label: meta?.label || tabId,
      count: tabId === 'watchlist' ? watchlistCount : undefined,
    };
  });

  // Hidden navigation mode: keep floating quick-access triggers so user can always open Settings/Search/Home
  if (config.navPosition === 'hidden') {
    return (
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <button
          onClick={() => onSelectTab('home')}
          className="px-3 py-2 text-xs font-extrabold tracking-tight border backdrop-blur-md transition-colors whitespace-nowrap shrink-0"
          style={{
            backgroundColor: 'var(--kuro-surface)',
            borderColor: 'var(--kuro-border)',
            color: 'var(--kuro-text)',
            borderRadius: 'var(--kuro-radius-sm)',
          }}
        >
          {config.brandName || 'KUROSTREAM'}
        </button>
        {config.showHeaderSearch && (
          <button
            onClick={onOpenSearch}
            className="p-2 border backdrop-blur-md transition-colors shrink-0"
            style={{
              backgroundColor: 'var(--kuro-surface)',
              borderColor: 'var(--kuro-border)',
              color: 'var(--kuro-text)',
              borderRadius: 'var(--kuro-radius-sm)',
            }}
            title="Search anime & manga (Cmd+K)"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={openCustomizer}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border shadow-lg transition-colors whitespace-nowrap shrink-0 kuro-on-accent"
          style={{
            backgroundColor: 'var(--kuro-accent)',
            borderColor: 'var(--kuro-accent)',
            color: 'var(--kuro-accent-text)',
            borderRadius: 'var(--kuro-radius-sm)',
          }}
          title="Open Full UI Customizer (Ctrl+,)"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Customize UI</span>
        </button>
      </div>
    );
  }

  // Bottom floating dock layout
  if (config.navPosition === 'bottom-dock') {
    return (
      <>
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] overflow-x-auto no-scrollbar border shadow-2xl px-3 py-2 flex items-center gap-2"
          style={{
            backgroundColor: 'var(--kuro-surface)',
            borderColor: 'var(--kuro-border)',
            borderWidth: 'var(--kuro-border-width)',
            borderRadius: 'var(--kuro-radius)',
            backdropFilter: 'blur(var(--kuro-blur))',
            boxShadow: 'var(--kuro-shadow)',
          }}
        >
          <button
            onClick={() => onSelectTab('home')}
            className="px-2.5 py-1.5 text-sm font-extrabold tracking-tight transition-colors whitespace-nowrap shrink-0"
            style={{ color: currentTab === 'home' ? 'var(--kuro-accent)' : 'var(--kuro-text)' }}
          >
            {config.brandName || 'KUROSTREAM'}
          </button>

          <div className="h-5 w-px shrink-0" style={{ backgroundColor: 'var(--kuro-border)' }} />

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'kuro-on-accent font-semibold' : ''
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--kuro-accent)' : 'transparent',
                    color: isActive ? 'var(--kuro-accent-text)' : 'var(--kuro-text-muted)',
                    borderRadius: 'var(--kuro-radius-sm)',
                  }}
                >
                  {TAB_ICONS[item.id]}
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[10px] font-mono tabular-nums opacity-85">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="h-5 w-px shrink-0" style={{ backgroundColor: 'var(--kuro-border)' }} />

          <div className="flex items-center gap-1.5 shrink-0">
            {config.showHeaderDownloads && (
              <button
                onClick={onOpenDownloads}
                className="p-2 border transition-colors shrink-0"
                style={{
                  backgroundColor: 'var(--kuro-surface-alt)',
                  borderColor: 'var(--kuro-border)',
                  color: 'var(--kuro-accent-2)',
                  borderRadius: 'var(--kuro-radius-sm)',
                }}
                title="Anime Downloads"
                aria-label="Downloads"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            {config.showHeaderSearch && (
              <button
                onClick={onOpenSearch}
                className="p-2 border transition-colors shrink-0"
                style={{
                  backgroundColor: 'var(--kuro-surface-alt)',
                  borderColor: 'var(--kuro-border)',
                  color: 'var(--kuro-text)',
                  borderRadius: 'var(--kuro-radius-sm)',
                }}
                title="Search (Cmd+K)"
                aria-label="Search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={openCustomizer}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 kuro-on-accent"
              style={{
                backgroundColor: 'var(--kuro-accent)',
                borderColor: 'var(--kuro-accent)',
                color: 'var(--kuro-accent-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
              title="Customize Full UI (Ctrl+,)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">UI Studio</span>
            </button>
            {config.showHeaderProfile && (
              <button
                onClick={openAuthModal}
                className="p-1.5 border transition-colors shrink-0"
                style={{
                  backgroundColor: 'var(--kuro-surface-alt)',
                  borderColor: 'var(--kuro-border)',
                  color: 'var(--kuro-text)',
                  borderRadius: 'var(--kuro-radius-sm)',
                }}
                title={user?.name || 'Profile'}
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded object-cover"
                  />
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {config.showHeaderDesktopApp && (
              <button
                onClick={onOpenWindowsWizard}
                className="p-2 border transition-colors shrink-0"
                style={{
                  backgroundColor: 'var(--kuro-surface-alt)',
                  borderColor: 'var(--kuro-border)',
                  color: 'var(--kuro-text)',
                  borderRadius: 'var(--kuro-radius-sm)',
                }}
                title="Desktop App"
                aria-label="Desktop App"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // Vertical Sidebar Layout (left-sidebar or right-sidebar on desktop; clean compact top bar on mobile)
  const isSidebar = config.navPosition === 'left-sidebar' || config.navPosition === 'right-sidebar';

  const topHeaderElement = (
    <header
      className={`${
        config.navPosition === 'top-sticky' ? 'sticky top-0' : 'relative'
      } z-40 ${isSidebar ? 'lg:hidden' : ''}`}
      style={{
        backgroundColor: 'var(--kuro-surface)',
        borderBottom: `var(--kuro-border-width) solid var(--kuro-border)`,
        backdropFilter: 'blur(var(--kuro-blur))',
      }}
    >
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-6"
        style={{ maxWidth: config.containerMaxWidth }}
      >
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => onSelectTab('home')}
          className="text-left text-xl font-extrabold tracking-tight transition-colors whitespace-nowrap shrink-0"
          style={{
            color: 'var(--kuro-text)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {config.brandName || 'KUROSTREAM'}
        </button>

        {/* Zone 2: Single-line Nav Links */}
        <nav
          className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium overflow-x-auto no-scrollbar"
          style={{ color: 'var(--kuro-text-muted)' }}
        >
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className="whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors"
                style={{
                  color: isActive ? 'var(--kuro-text)' : 'var(--kuro-text-muted)',
                  borderColor: isActive ? 'var(--kuro-accent)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {item.label}
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className="ml-1.5 text-xs font-mono tabular-nums"
                    style={{ color: 'var(--kuro-accent)' }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Action Cluster */}
        <div className="flex items-center gap-2 shrink-0">
          {config.showHeaderDownloads && (
            <button
              onClick={onOpenDownloads}
              className="flex items-center gap-1.5 px-3 py-2 border transition-colors text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--kuro-surface-alt)',
                borderColor: 'var(--kuro-border)',
                color: 'var(--kuro-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
              title="Anime Downloads & Source Resolver"
            >
              <Download className="w-3.5 h-3.5" style={{ color: 'var(--kuro-accent-2)' }} />
              <span className="hidden xl:inline">Downloads</span>
            </button>
          )}

          {config.showHeaderSearch && (
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-2 border transition-colors text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--kuro-surface-alt)',
                borderColor: 'var(--kuro-border)',
                color: 'var(--kuro-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
              title="Search anime & manga (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5" style={{ color: 'var(--kuro-text-muted)' }} />
              <span className="hidden xl:inline">Search</span>
              <kbd
                className="hidden lg:inline-block font-mono text-[10px]"
                style={{ color: 'var(--kuro-text-muted)' }}
              >
                ⌘K
              </kbd>
            </button>
          )}

          <button
            onClick={openCustomizer}
            className="flex items-center gap-1.5 px-3 py-2 border transition-colors text-xs font-semibold whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'var(--kuro-surface-alt)',
              borderColor: 'var(--kuro-accent)',
              color: 'var(--kuro-text)',
              borderRadius: 'var(--kuro-radius-sm)',
            }}
            title="Full UI Customization Studio (Ctrl+,)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--kuro-accent)' }} />
            <span className="hidden lg:inline">Customize UI</span>
          </button>

          {config.showHeaderProfile && (
            <button
              onClick={openAuthModal}
              className="flex items-center gap-2 px-2.5 py-1.5 border transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--kuro-surface-alt)',
                borderColor: 'var(--kuro-border)',
                color: 'var(--kuro-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
              title="Profile, Otaku Progression & Daily Quests"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-md object-cover shrink-0"
                />
              ) : (
                <User className="w-4 h-4 shrink-0" style={{ color: 'var(--kuro-accent)' }} />
              )}
              <span className="hidden lg:inline text-xs font-semibold max-w-[90px] truncate">
                {user?.name || 'Guest'}
              </span>
              <span
                className="hidden xl:inline text-[11px] font-mono tabular-nums"
                style={{ color: 'var(--kuro-text-muted)' }}
              >
                Lv.{user?.stats?.level ?? 1}
              </span>
            </button>
          )}

          {config.showHeaderDesktopApp && (
            <button
              onClick={onOpenWindowsWizard}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 kuro-on-accent"
              style={{
                backgroundColor: 'var(--kuro-accent)',
                color: 'var(--kuro-accent-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Desktop App</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div
        className="md:hidden flex items-center justify-around px-2 py-2 text-xs font-medium overflow-x-auto no-scrollbar"
        style={{
          borderTop: `var(--kuro-border-width) solid var(--kuro-border)`,
          backgroundColor: 'var(--kuro-bg)',
          color: 'var(--kuro-text-muted)',
        }}
      >
        <button
          onClick={() => onSelectTab('home')}
          className="px-2 py-1 whitespace-nowrap"
          style={{ color: currentTab === 'home' ? 'var(--kuro-text)' : 'var(--kuro-text-muted)' }}
        >
          Home
        </button>
        {navItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className="px-2 py-1 whitespace-nowrap"
            style={{
              color: currentTab === item.id ? 'var(--kuro-text)' : 'var(--kuro-text-muted)',
              fontWeight: currentTab === item.id ? 600 : 500,
            }}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 ? ` (${item.count})` : ''}
          </button>
        ))}
      </div>
    </header>
  );

  if (!isSidebar) {
    return topHeaderElement;
  }

  const isRight = config.navPosition === 'right-sidebar';

  return (
    <>
      {topHeaderElement}
      <aside
        className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen z-30 p-4 justify-between"
        style={{
          width: `${config.sidebarWidthPx}px`,
          backgroundColor: 'var(--kuro-surface)',
          borderRight: isRight ? 'none' : `var(--kuro-border-width) solid var(--kuro-border)`,
          borderLeft: isRight ? `var(--kuro-border-width) solid var(--kuro-border)` : 'none',
          backdropFilter: 'blur(var(--kuro-blur))',
        }}
      >
        <div className="space-y-6 overflow-y-auto no-scrollbar">
          <button
            onClick={() => onSelectTab('home')}
            className="w-full text-left text-xl font-extrabold tracking-tight px-2.5 py-1.5 transition-colors whitespace-nowrap truncate"
            style={{
              color: 'var(--kuro-text)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {config.brandName || 'KUROSTREAM'}
          </button>

          <nav className="space-y-1">
            <button
              onClick={() => onSelectTab('home')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                currentTab === 'home' ? 'kuro-on-accent font-semibold' : ''
              }`}
              style={{
                backgroundColor: currentTab === 'home' ? 'var(--kuro-accent)' : 'transparent',
                color: currentTab === 'home' ? 'var(--kuro-accent-text)' : 'var(--kuro-text-muted)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
            >
              {TAB_ICONS.home}
              <span>Home</span>
            </button>

            {navItems
              .filter((i) => i.id !== 'home')
              .map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive ? 'kuro-on-accent font-semibold' : ''
                    }`}
                    style={{
                      backgroundColor: isActive ? 'var(--kuro-accent)' : 'transparent',
                      color: isActive ? 'var(--kuro-accent-text)' : 'var(--kuro-text-muted)',
                      borderRadius: 'var(--kuro-radius-sm)',
                    }}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      {TAB_ICONS[item.id]}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="text-xs font-mono tabular-nums opacity-85">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

        <div className="space-y-2 pt-4" style={{ borderTop: `1px solid var(--kuro-border)` }}>
          {config.showHeaderSearch && (
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3 py-2 border text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--kuro-surface-alt)',
                borderColor: 'var(--kuro-border)',
                color: 'var(--kuro-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5" style={{ color: 'var(--kuro-text-muted)' }} />
                <span>Search</span>
              </span>
              <kbd className="font-mono text-[10px]" style={{ color: 'var(--kuro-text-muted)' }}>
                ⌘K
              </kbd>
            </button>
          )}

          {config.showHeaderDownloads && (
            <button
              onClick={onOpenDownloads}
              className="w-full flex items-center gap-2 px-3 py-2 border text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--kuro-surface-alt)',
                borderColor: 'var(--kuro-border)',
                color: 'var(--kuro-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
            >
              <Download className="w-3.5 h-3.5" style={{ color: 'var(--kuro-accent-2)' }} />
              <span>Downloads</span>
            </button>
          )}

          <button
            onClick={openCustomizer}
            className="w-full flex items-center gap-2 px-3 py-2 border text-xs font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--kuro-surface-alt)',
              borderColor: 'var(--kuro-accent)',
              color: 'var(--kuro-text)',
              borderRadius: 'var(--kuro-radius-sm)',
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--kuro-accent)' }} />
            <span>Customize Full UI</span>
          </button>

          {config.showHeaderProfile && (
            <button
              onClick={openAuthModal}
              className="w-full flex items-center gap-2.5 px-3 py-2 border text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--kuro-surface-alt)',
                borderColor: 'var(--kuro-border)',
                color: 'var(--kuro-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded object-cover shrink-0"
                />
              ) : (
                <User className="w-4 h-4 shrink-0" style={{ color: 'var(--kuro-accent)' }} />
              )}
              <span className="truncate flex-1 text-left">{user?.name || 'Guest'}</span>
              <span className="font-mono text-[10px]" style={{ color: 'var(--kuro-text-muted)' }}>
                Lv.{user?.stats?.level ?? 1}
              </span>
            </button>
          )}

          {config.showHeaderDesktopApp && (
            <button
              onClick={onOpenWindowsWizard}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold transition-colors kuro-on-accent"
              style={{
                backgroundColor: 'var(--kuro-accent)',
                color: 'var(--kuro-accent-text)',
                borderRadius: 'var(--kuro-radius-sm)',
              }}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop App</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
