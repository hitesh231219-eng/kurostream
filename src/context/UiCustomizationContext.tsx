import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { NavTab } from '../types/anime';

export const UI_CONFIG_STORAGE_KEY = 'kurostream_ui_customizer_v1';
export const UI_SAVED_PROFILES_KEY = 'kurostream_ui_saved_profiles_v1';

export type ColorSchemeMode = 'dark' | 'light';
export type BackgroundMode = 'solid' | 'gradient' | 'image';
export type NavPositionMode =
  | 'top-sticky'
  | 'top-static'
  | 'left-sidebar'
  | 'right-sidebar'
  | 'bottom-dock'
  | 'hidden';
export type HeroLayoutMode = 'full' | 'compact' | 'split' | 'minimal' | 'hidden';
export type CardViewMode = 'carousel' | 'grid';
export type CardAspectRatio = '2/3' | '3/4' | '1/1' | '16/9';
export type CardMetadataPosition = 'below' | 'overlay' | 'minimal' | 'hidden';
export type CardHoverEffect = 'scale' | 'lift' | 'glow' | 'tilt' | 'none';
export type CardImageFilter = 'none' | 'vivid' | 'cinema' | 'noir' | 'warm';
export type HomeSectionId =
  | 'hero'
  | 'continue'
  | 'trending'
  | 'topRated'
  | 'action'
  | 'fantasy'
  | 'romance'
  | 'faq';

export interface UiConfig {
  presetId: string;
  colorScheme: ColorSchemeMode;

  // Palette (Zero restrictions — any CSS hex)
  bgColor: string;
  surfaceColor: string;
  surfaceAltColor: string;
  borderColor: string;
  textColor: string;
  textMutedColor: string;
  accentColor: string;
  accentHoverColor: string;
  accentTextColor: string;
  accentSecondaryColor: string;

  // Background Canvas
  bgMode: BackgroundMode;
  bgGradientAngle: number;
  bgGradientStart: string;
  bgGradientMid: string;
  bgGradientEnd: string;
  bgImageUrl: string;
  bgImageOpacityPct: number;
  bgImageBlurPx: number;
  bgImageOverlayOpacityPct: number;

  // Typography
  displayFont: string;
  bodyFont: string;
  monoFont: string;
  customGoogleFont: string;
  baseFontSizePx: number;
  headingWeight: number;
  headingTrackingEm: number;
  bodyLineHeight: number;

  // Geometry, Borders, Glass & Effects
  radiusPx: number;
  borderWidthPx: number;
  glassBlurPx: number;
  surfaceOpacityPct: number;
  shadowDepth: number; // 0..3
  motionSpeed: '0' | '0.5' | '1' | '1.8';
  scrollbarWidthPx: number;

  // Navigation & App Shell
  navPosition: NavPositionMode;
  sidebarWidthPx: number;
  brandName: string;
  visibleNavTabs: NavTab[];
  showHeaderDownloads: boolean;
  showHeaderSearch: boolean;
  showHeaderProfile: boolean;
  showHeaderDesktopApp: boolean;
  containerMaxWidth: string; // '1024px' | '1180px' | '1280px' | '1440px' | '1680px' | '100%'
  sectionSpacingPx: number;
  showFooter: boolean;

  // Hero Showcase
  heroMode: HeroLayoutMode;
  heroHeightPx: number;
  heroAutoSlide: boolean;
  heroShowNativeTitle: boolean;
  heroShowDescription: boolean;
  heroShowGenres: boolean;
  heroBrightnessPct: number;
  heroBackdropBlurPx: number;

  // Anime Cards & Grids
  cardViewMode: CardViewMode;
  cardGridColumns: number;
  cardAspect: CardAspectRatio;
  cardWidthPx: number;
  cardGapPx: number;
  cardMetadataPosition: CardMetadataPosition;
  cardHoverEffect: CardHoverEffect;
  cardImageFilter: CardImageFilter;
  cardShowRank: boolean;
  cardShowScore: boolean;
  cardShowQuickPlay: boolean;
  cardShowWatchlistBtn: boolean;

  // Home Sections Builder
  homeSectionOrder: HomeSectionId[];
  hiddenHomeSections: HomeSectionId[];
  customSectionTitles: Partial<Record<HomeSectionId, string>>;

  // Unlimited Custom CSS
  customCss: string;
}

export interface SavedUiProfile {
  id: string;
  name: string;
  config: UiConfig;
  savedAt: number;
}

export interface UiPreset {
  id: string;
  name: string;
  description: string;
  patch: Partial<UiConfig>;
}

export const ALL_NAV_TABS: { id: NavTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'trending', label: 'Trending' },
  { id: 'popular', label: 'Top Rated' },
  { id: 'browse', label: 'Categories' },
  { id: 'az', label: 'A-Z' },
  { id: 'manga', label: 'Manga' },
  { id: 'watchparty', label: 'Watch Party' },
  { id: 'watchlist', label: 'Watchlist' },
];

export const DEFAULT_HOME_SECTION_META: Record<HomeSectionId, { label: string; defaultTitle: string }> = {
  hero: { label: 'Hero Showcase Banner', defaultTitle: 'Hero Showcase' },
  continue: { label: 'Continue Watching', defaultTitle: 'Continue Watching' },
  trending: { label: 'Trending Now', defaultTitle: 'Trending Now' },
  topRated: { label: 'Top Rated Masterpieces', defaultTitle: 'Top Rated Masterpieces' },
  action: { label: 'Action & Shounen Hits', defaultTitle: 'Action & Shounen Hits' },
  fantasy: { label: 'Fantasy & Supernatural', defaultTitle: 'Fantasy & Supernatural' },
  romance: { label: 'Romance & Slice of Life', defaultTitle: 'Romance & Slice of Life' },
  faq: { label: 'Questions & Platform Guide', defaultTitle: 'Frequently Asked Questions' },
};

export const DEFAULT_UI_CONFIG: UiConfig = {
  presetId: 'kuro-midnight',
  colorScheme: 'dark',

  bgColor: '#08090d',
  surfaceColor: '#12151f',
  surfaceAltColor: '#191e2e',
  borderColor: '#1f2536',
  textColor: '#f1f5f9',
  textMutedColor: '#94a3b8',
  accentColor: '#7c3aed',
  accentHoverColor: '#8b5cf6',
  accentTextColor: '#ffffff',
  accentSecondaryColor: '#10b981',

  bgMode: 'solid',
  bgGradientAngle: 135,
  bgGradientStart: '#08090d',
  bgGradientMid: '#111426',
  bgGradientEnd: '#090b12',
  bgImageUrl: '',
  bgImageOpacityPct: 28,
  bgImageBlurPx: 6,
  bgImageOverlayOpacityPct: 72,

  displayFont: 'Outfit',
  bodyFont: 'Plus Jakarta Sans',
  monoFont: 'JetBrains Mono',
  customGoogleFont: '',
  baseFontSizePx: 16,
  headingWeight: 800,
  headingTrackingEm: -0.02,
  bodyLineHeight: 1.55,

  radiusPx: 12,
  borderWidthPx: 1,
  glassBlurPx: 12,
  surfaceOpacityPct: 100,
  shadowDepth: 1,
  motionSpeed: '1',
  scrollbarWidthPx: 8,

  navPosition: 'top-sticky',
  sidebarWidthPx: 236,
  brandName: 'KUROSTREAM',
  visibleNavTabs: ['trending', 'popular', 'browse', 'az', 'manga', 'watchparty', 'watchlist'],
  showHeaderDownloads: true,
  showHeaderSearch: true,
  showHeaderProfile: true,
  showHeaderDesktopApp: true,
  containerMaxWidth: '1280px',
  sectionSpacingPx: 24,
  showFooter: true,

  heroMode: 'full',
  heroHeightPx: 560,
  heroAutoSlide: true,
  heroShowNativeTitle: true,
  heroShowDescription: true,
  heroShowGenres: true,
  heroBrightnessPct: 90,
  heroBackdropBlurPx: 0,

  cardViewMode: 'carousel',
  cardGridColumns: 6,
  cardAspect: '2/3',
  cardWidthPx: 192,
  cardGapPx: 20,
  cardMetadataPosition: 'below',
  cardHoverEffect: 'scale',
  cardImageFilter: 'none',
  cardShowRank: true,
  cardShowScore: true,
  cardShowQuickPlay: true,
  cardShowWatchlistBtn: true,

  homeSectionOrder: [
    'hero',
    'continue',
    'trending',
    'topRated',
    'action',
    'fantasy',
    'romance',
    'faq',
  ],
  hiddenHomeSections: [],
  customSectionTitles: {},

  customCss: '',
};

export const UI_PRESETS: UiPreset[] = [
  {
    id: 'kuro-midnight',
    name: 'Kuro Midnight',
    description: 'Deep obsidian canvas with crisp violet highlights.',
    patch: { ...DEFAULT_UI_CONFIG },
  },
  {
    id: 'shibuya-light',
    name: 'Shibuya Daylight',
    description: 'Clean crisp alabaster light theme with cobalt ink.',
    patch: {
      presetId: 'shibuya-light',
      colorScheme: 'light',
      bgColor: '#f6f7fb',
      surfaceColor: '#ffffff',
      surfaceAltColor: '#eef1f7',
      borderColor: '#d9dfe9',
      textColor: '#0f172a',
      textMutedColor: '#475569',
      accentColor: '#4f46e5',
      accentHoverColor: '#4338ca',
      accentTextColor: '#ffffff',
      accentSecondaryColor: '#059669',
      bgMode: 'solid',
      radiusPx: 12,
      borderWidthPx: 1,
      shadowDepth: 1,
    },
  },
  {
    id: 'sakura-ivory',
    name: 'Sakura Editorial',
    description: 'Warm archival paper with crimson-rose editorial serif type.',
    patch: {
      presetId: 'sakura-ivory',
      colorScheme: 'light',
      bgColor: '#faf6f4',
      surfaceColor: '#ffffff',
      surfaceAltColor: '#f3eae6',
      borderColor: '#e5d5cf',
      textColor: '#1f1414',
      textMutedColor: '#6b5552',
      accentColor: '#be123c',
      accentHoverColor: '#9f1239',
      accentTextColor: '#ffffff',
      accentSecondaryColor: '#b45309',
      displayFont: 'Playfair Display',
      bodyFont: 'Plus Jakarta Sans',
      radiusPx: 6,
      bgMode: 'solid',
    },
  },
  {
    id: 'matcha-noir',
    name: 'Matcha Studio',
    description: 'Left-sidebar studio layout with forest slate and jade green.',
    patch: {
      presetId: 'matcha-noir',
      colorScheme: 'dark',
      bgColor: '#070c0a',
      surfaceColor: '#0e1714',
      surfaceAltColor: '#16241f',
      borderColor: '#1f332b',
      textColor: '#ecfdf5',
      textMutedColor: '#8fb3a3',
      accentColor: '#10b981',
      accentHoverColor: '#059669',
      accentTextColor: '#041f14',
      accentSecondaryColor: '#f59e0b',
      navPosition: 'left-sidebar',
      heroMode: 'split',
      radiusPx: 10,
      bgMode: 'gradient',
      bgGradientAngle: 145,
      bgGradientStart: '#070c0a',
      bgGradientMid: '#0b1813',
      bgGradientEnd: '#050807',
    },
  },
  {
    id: 'amber-cinema',
    name: 'Amber Cinema',
    description: 'Widescreen theater aesthetic with golden ochre accents and 16:9 cards.',
    patch: {
      presetId: 'amber-cinema',
      colorScheme: 'dark',
      bgColor: '#0b0a08',
      surfaceColor: '#161410',
      surfaceAltColor: '#211d17',
      borderColor: '#2e281f',
      textColor: '#faf5eb',
      textMutedColor: '#b3a792',
      accentColor: '#d97706',
      accentHoverColor: '#f59e0b',
      accentTextColor: '#140c02',
      accentSecondaryColor: '#ef4444',
      cardAspect: '16/9',
      cardWidthPx: 260,
      heroMode: 'full',
      heroHeightPx: 620,
      radiusPx: 8,
      bgMode: 'solid',
    },
  },
  {
    id: 'swiss-brutalist',
    name: 'Swiss Mono Grid',
    description: 'Sharp 0px corners, crisp 2px borders, high-contrast monochrome grid.',
    patch: {
      presetId: 'swiss-brutalist',
      colorScheme: 'dark',
      bgColor: '#050505',
      surfaceColor: '#0d0d0d',
      surfaceAltColor: '#171717',
      borderColor: '#303030',
      textColor: '#fafafa',
      textMutedColor: '#a3a3a3',
      accentColor: '#ffffff',
      accentHoverColor: '#e5e5e5',
      accentTextColor: '#050505',
      accentSecondaryColor: '#737373',
      displayFont: 'Space Mono',
      bodyFont: 'Manrope',
      radiusPx: 0,
      borderWidthPx: 2,
      cardViewMode: 'grid',
      cardGridColumns: 5,
      heroMode: 'compact',
      bgMode: 'solid',
    },
  },
  {
    id: 'crimson-eclipse',
    name: 'Crimson Eclipse',
    description: 'Deep carbon with razor scarlet CTAs and bottom floating dock.',
    patch: {
      presetId: 'crimson-eclipse',
      colorScheme: 'dark',
      bgColor: '#090608',
      surfaceColor: '#140d11',
      surfaceAltColor: '#1e1319',
      borderColor: '#2e1b24',
      textColor: '#fdf2f4',
      textMutedColor: '#b58d99',
      accentColor: '#e11d48',
      accentHoverColor: '#f43f5e',
      accentTextColor: '#ffffff',
      accentSecondaryColor: '#fb923c',
      navPosition: 'bottom-dock',
      radiusPx: 16,
      bgMode: 'gradient',
      bgGradientAngle: 160,
      bgGradientStart: '#090608',
      bgGradientMid: '#180a10',
      bgGradientEnd: '#070507',
    },
  },
  {
    id: 'arctic-glass',
    name: 'Arctic Frosted',
    description: 'Translucent sky-slate surfaces with elevated glass blur.',
    patch: {
      presetId: 'arctic-glass',
      colorScheme: 'dark',
      bgColor: '#060c14',
      surfaceColor: '#0d1929',
      surfaceAltColor: '#13243b',
      borderColor: '#1f3654',
      textColor: '#f0f9ff',
      textMutedColor: '#93b4d4',
      accentColor: '#0ea5e9',
      accentHoverColor: '#38bdf8',
      accentTextColor: '#031525',
      accentSecondaryColor: '#22d3ee',
      glassBlurPx: 22,
      surfaceOpacityPct: 82,
      radiusPx: 18,
      bgMode: 'gradient',
      bgGradientAngle: 130,
      bgGradientStart: '#060c14',
      bgGradientMid: '#0b1b30',
      bgGradientEnd: '#04080f',
    },
  },
];

const BUILTIN_FONTS = new Set([
  'Outfit',
  'Plus Jakarta Sans',
  'JetBrains Mono',
]);

const LOADABLE_FONT_FAMILIES: Record<string, string> = {
  'Playfair Display': 'Playfair+Display:wght@400;600;700;800;900',
  'Bricolage Grotesque': 'Bricolage+Grotesque:wght@400;600;700;800',
  Manrope: 'Manrope:wght@400;500;600;700;800',
  'DM Sans': 'DM+Sans:wght@400;500;700',
  Oswald: 'Oswald:wght@400;500;600;700',
  'Space Mono': 'Space+Mono:wght@400;700',
  'IBM Plex Mono': 'IBM+Plex+Mono:wght@400;500;600;700',
  Lora: 'Lora:wght@400;500;600;700',
  'Source Serif 4': 'Source+Serif+4:wght@400;600;700',
  Urbanist: 'Urbanist:wght@400;600;700;800',
  Antonio: 'Antonio:wght@400;600;700',
  Archivo: 'Archivo:wght@400;600;700;800',
  Cinzel: 'Cinzel:wght@400;600;700;800',
};

function hexToRgbTuple(hex: string): string {
  const cleaned = String(hex || '').replace('#', '').trim();
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '124, 58, 237';
}

export function sanitizeLoadedUiConfig(raw: unknown): UiConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_UI_CONFIG };
  const obj = raw as Record<string, any>;
  const merged: UiConfig = {
    ...DEFAULT_UI_CONFIG,
    ...obj,
    visibleNavTabs: Array.isArray(obj.visibleNavTabs)
      ? (obj.visibleNavTabs.filter((t: unknown) =>
          ALL_NAV_TABS.some((item) => item.id === t)
        ) as NavTab[])
      : DEFAULT_UI_CONFIG.visibleNavTabs,
    homeSectionOrder: Array.isArray(obj.homeSectionOrder)
      ? (Array.from(
          new Set([
            ...obj.homeSectionOrder.filter(
              (id: unknown): id is HomeSectionId =>
                typeof id === 'string' && id in DEFAULT_HOME_SECTION_META
            ),
            ...DEFAULT_UI_CONFIG.homeSectionOrder,
          ])
        ) as HomeSectionId[])
      : DEFAULT_UI_CONFIG.homeSectionOrder,
    hiddenHomeSections: Array.isArray(obj.hiddenHomeSections)
      ? (obj.hiddenHomeSections.filter(
          (id: unknown): id is HomeSectionId =>
            typeof id === 'string' && id in DEFAULT_HOME_SECTION_META
        ) as HomeSectionId[])
      : [],
    customSectionTitles:
      obj.customSectionTitles && typeof obj.customSectionTitles === 'object'
        ? obj.customSectionTitles
        : {},
  };
  if (merged.visibleNavTabs.length === 0) {
    merged.visibleNavTabs = ['home'];
  }
  return merged;
}

function buildFontHref(fontNames: string[]): string | null {
  const families: string[] = [];
  for (const rawName of fontNames) {
    const name = rawName.trim();
    if (!name || BUILTIN_FONTS.has(name)) continue;
    if (LOADABLE_FONT_FAMILIES[name]) {
      families.push(`family=${LOADABLE_FONT_FAMILIES[name]}`);
    } else if (/^[a-zA-Z0-9\s\-+]{2,64}$/.test(name)) {
      const encoded = name.replace(/\s+/g, '+');
      families.push(`family=${encoded}:wght@400;500;600;700;800`);
    }
  }
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${Array.from(new Set(families)).join('&')}&display=swap`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface UiCustomizationContextValue {
  config: UiConfig;
  isCustomizerOpen: boolean;
  customizerDockMode: 'drawer' | 'modal';
  savedProfiles: SavedUiProfile[];
  openCustomizer: () => void;
  closeCustomizer: () => void;
  toggleCustomizer: () => void;
  setCustomizerDockMode: (mode: 'drawer' | 'modal') => void;
  updateConfig: (patch: Partial<UiConfig>) => void;
  applyPreset: (presetId: string) => void;
  resetConfig: () => void;
  randomizeConfig: () => void;
  saveNamedProfile: (name: string) => void;
  loadNamedProfile: (profileId: string) => void;
  deleteNamedProfile: (profileId: string) => void;
  exportConfigJson: () => string;
  importConfigJson: (json: string) => { ok: boolean; error?: string };
}

const UiCustomizationContext = createContext<UiCustomizationContextValue | undefined>(undefined);

export const UiCustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<UiConfig>(() => {
    try {
      const raw = localStorage.getItem(UI_CONFIG_STORAGE_KEY);
      if (raw) {
        return sanitizeLoadedUiConfig(JSON.parse(raw));
      }
    } catch {
      // ignore corrupted storage
    }
    return { ...DEFAULT_UI_CONFIG };
  });

  const [savedProfiles, setSavedProfiles] = useState<SavedUiProfile[]>(() => {
    try {
      const raw = localStorage.getItem(UI_SAVED_PROFILES_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return [];
  });

  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [customizerDockMode, setCustomizerDockMode] = useState<'drawer' | 'modal'>('drawer');

  // Persist config locally
  useEffect(() => {
    try {
      localStorage.setItem(UI_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {}
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(UI_SAVED_PROFILES_KEY, JSON.stringify(savedProfiles));
    } catch {}
  }, [savedProfiles]);

  // Apply full-UI CSS tokens, dynamic Google Fonts, & unrestricted custom CSS
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const isLight = config.colorScheme === 'light';

    root.setAttribute('data-kuro-scheme', config.colorScheme);
    if (isLight) {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }

    const displayFace = config.customGoogleFont.trim() || config.displayFont;
    const surfaceRgb = hexToRgbTuple(config.surfaceColor);
    const surfaceAlpha = Math.max(0.2, Math.min(1, config.surfaceOpacityPct / 100));
    const shadowValues = [
      'none',
      '0 8px 24px -8px rgba(0, 0, 0, 0.35)',
      '0 16px 40px -10px rgba(0, 0, 0, 0.5)',
      `0 18px 48px -8px rgba(${hexToRgbTuple(config.accentColor)}, 0.32)`,
    ];

    root.style.setProperty('--kuro-bg', config.bgColor);
    root.style.setProperty('--kuro-surface', `rgba(${surfaceRgb}, ${surfaceAlpha})`);
    root.style.setProperty('--kuro-surface-solid', config.surfaceColor);
    root.style.setProperty('--kuro-surface-alt', config.surfaceAltColor);
    root.style.setProperty('--kuro-border', config.borderColor);
    root.style.setProperty('--kuro-text', config.textColor);
    root.style.setProperty('--kuro-text-muted', config.textMutedColor);
    root.style.setProperty('--kuro-accent', config.accentColor);
    root.style.setProperty('--kuro-accent-rgb', hexToRgbTuple(config.accentColor));
    root.style.setProperty('--kuro-accent-hover', config.accentHoverColor);
    root.style.setProperty('--kuro-accent-text', config.accentTextColor);
    root.style.setProperty('--kuro-accent-2', config.accentSecondaryColor);

    root.style.setProperty('--font-display', `'${displayFace}', sans-serif`);
    root.style.setProperty('--font-sans', `'${config.bodyFont}', -apple-system, BlinkMacSystemFont, sans-serif`);
    root.style.setProperty('--font-mono', `'${config.monoFont}', monospace`);

    root.style.setProperty('--kuro-base-size', `${config.baseFontSizePx}px`);
    root.style.setProperty('--kuro-heading-weight', String(config.headingWeight));
    root.style.setProperty('--kuro-heading-tracking', `${config.headingTrackingEm}em`);
    root.style.setProperty('--kuro-line-height', String(config.bodyLineHeight));
    root.style.setProperty('--kuro-radius', `${config.radiusPx}px`);
    root.style.setProperty('--kuro-radius-sm', `${Math.max(0, Math.round(config.radiusPx * 0.66))}px`);
    root.style.setProperty('--kuro-border-width', `${config.borderWidthPx}px`);
    root.style.setProperty('--kuro-blur', `${config.glassBlurPx}px`);
    root.style.setProperty('--kuro-shadow', shadowValues[config.shadowDepth] || shadowValues[1]);
    root.style.setProperty('--kuro-motion-scale', config.motionSpeed);
    root.style.setProperty('--kuro-scrollbar-width', `${config.scrollbarWidthPx}px`);
    root.style.setProperty('--kuro-container-max', config.containerMaxWidth);
    root.style.setProperty('--kuro-section-py', `${config.sectionSpacingPx}px`);
    root.style.setProperty('--kuro-card-width', `${config.cardWidthPx}px`);
    root.style.setProperty('--kuro-card-gap', `${config.cardGapPx}px`);

    // Load dynamic Google Fonts when non-default fonts are selected
    const fontHref = buildFontHref([
      displayFace,
      config.bodyFont,
      config.monoFont,
      config.customGoogleFont,
    ]);
    const existingLink = document.getElementById('kurostream-dynamic-fonts') as HTMLLinkElement | null;
    if (fontHref) {
      if (existingLink) {
        if (existingLink.href !== fontHref) existingLink.href = fontHref;
      } else {
        const link = document.createElement('link');
        link.id = 'kurostream-dynamic-fonts';
        link.rel = 'stylesheet';
        link.href = fontHref;
        document.head.appendChild(link);
      }
    } else if (existingLink) {
      existingLink.remove();
    }

    // Dynamic canvas background & light/dark bridge CSS
    let styleEl = document.getElementById('kurostream-theme-engine') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'kurostream-theme-engine';
      document.head.appendChild(styleEl);
    }

    const bgCss =
      config.bgMode === 'gradient'
        ? `linear-gradient(${config.bgGradientAngle}deg, ${config.bgGradientStart}, ${config.bgGradientMid}, ${config.bgGradientEnd})`
        : config.bgColor;

    styleEl.textContent = `
      html { font-size: ${config.baseFontSizePx}px; }
      body {
        background-color: ${config.bgColor};
        background-image: ${bgCss};
        background-attachment: fixed;
        color: ${config.textColor};
        line-height: ${config.bodyLineHeight};
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-display);
        font-weight: ${config.headingWeight};
        letter-spacing: ${config.headingTrackingEm}em;
      }
      ::-webkit-scrollbar { width: ${config.scrollbarWidthPx}px; height: ${config.scrollbarWidthPx}px; }
      ::-webkit-scrollbar-track { background: ${config.bgColor}; }
      ::-webkit-scrollbar-thumb { background: ${config.borderColor}; border-radius: ${Math.min(12, config.radiusPx)}px; }
      ::-webkit-scrollbar-thumb:hover { background: ${config.accentColor}; }
      ${
        config.motionSpeed === '0'
          ? `*, *::before, *::after { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }`
          : config.motionSpeed !== '1'
          ? `:root { --kuro-duration-mult: ${config.motionSpeed}; }`
          : ''
      }
      ${
        isLight
          ? `
        .kuro-app-shell .text-white:not(.kuro-on-media):not(.kuro-on-accent) { color: ${config.textColor}; }
        .kuro-app-shell .text-slate-100:not(.kuro-on-media),
        .kuro-app-shell .text-slate-200:not(.kuro-on-media),
        .kuro-app-shell .text-slate-300:not(.kuro-on-media) { color: ${config.textColor}; }
        .kuro-app-shell .text-slate-400:not(.kuro-on-media),
        .kuro-app-shell .text-slate-500:not(.kuro-on-media) { color: ${config.textMutedColor}; }
        .kuro-app-shell .bg-\\[\\#08090d\\],
        .kuro-app-shell .bg-\\[\\#07080c\\],
        .kuro-app-shell .bg-\\[\\#0a0c12\\] { background-color: ${config.bgColor}; }
        .kuro-app-shell .bg-\\[\\#0e111a\\],
        .kuro-app-shell .bg-\\[\\#10131e\\],
        .kuro-app-shell .bg-\\[\\#12151f\\],
        .kuro-app-shell .bg-\\[\\#141721\\],
        .kuro-app-shell .bg-\\[\\#111522\\],
        .kuro-app-shell .bg-\\[\\#0c0f17\\] { background-color: ${config.surfaceColor}; }
        .kuro-app-shell .bg-\\[\\#161b2b\\],
        .kuro-app-shell .bg-\\[\\#191e2e\\],
        .kuro-app-shell .bg-\\[\\#1d2438\\] { background-color: ${config.surfaceAltColor}; }
        .kuro-app-shell .border-\\[\\#141721\\],
        .kuro-app-shell .border-\\[\\#191e2c\\],
        .kuro-app-shell .border-\\[\\#1d2232\\],
        .kuro-app-shell .border-\\[\\#22283a\\],
        .kuro-app-shell .border-\\[\\#232738\\],
        .kuro-app-shell .border-\\[\\#252c40\\] { border-color: ${config.borderColor}; }
      `
          : ''
      }
    `;

    // Unrestricted raw user CSS injection
    let userStyleEl = document.getElementById('kurostream-custom-user-css') as HTMLStyleElement | null;
    if (!userStyleEl) {
      userStyleEl = document.createElement('style');
      userStyleEl.id = 'kurostream-custom-user-css';
      document.head.appendChild(userStyleEl);
    }
    userStyleEl.textContent = config.customCss || '';
  }, [config]);

  const updateConfig = useCallback((patch: Partial<UiConfig>) => {
    setConfig((prev) => sanitizeLoadedUiConfig({ ...prev, ...patch }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = UI_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setConfig((prev) =>
      sanitizeLoadedUiConfig({
        ...DEFAULT_UI_CONFIG,
        ...preset.patch,
        presetId: preset.id,
        customSectionTitles: prev.customSectionTitles,
      })
    );
  }, []);

  const resetConfig = useCallback(() => {
    setConfig({ ...DEFAULT_UI_CONFIG });
  }, []);

  const randomizeConfig = useCallback(() => {
    const isLight = Math.random() > 0.72;
    const hue = Math.floor(Math.random() * 360);
    const accentHue2 = (hue + 45 + Math.floor(Math.random() * 140)) % 360;
    const displayFonts = Object.keys(LOADABLE_FONT_FAMILIES).concat(['Outfit', 'Plus Jakarta Sans']);
    const navOptions: NavPositionMode[] = ['top-sticky', 'left-sidebar', 'right-sidebar', 'bottom-dock'];
    const heroOptions: HeroLayoutMode[] = ['full', 'compact', 'split'];
    const aspects: CardAspectRatio[] = ['2/3', '3/4', '1/1', '16/9'];

    const bg = isLight ? hslToHex(hue, 18, 96) : hslToHex(hue, 22, 5);
    const surface = isLight ? '#ffffff' : hslToHex(hue, 20, 9);
    const surfaceAlt = isLight ? hslToHex(hue, 18, 91) : hslToHex(hue, 20, 14);
    const border = isLight ? hslToHex(hue, 16, 84) : hslToHex(hue, 20, 20);
    const accent = hslToHex(hue, 82, isLight ? 46 : 56);
    const accentHover = hslToHex(hue, 86, isLight ? 40 : 64);

    setConfig((prev) =>
      sanitizeLoadedUiConfig({
        ...prev,
        presetId: 'custom-random',
        colorScheme: isLight ? 'light' : 'dark',
        bgColor: bg,
        surfaceColor: surface,
        surfaceAltColor: surfaceAlt,
        borderColor: border,
        textColor: isLight ? '#0f172a' : '#f1f5f9',
        textMutedColor: isLight ? '#475569' : '#94a3b8',
        accentColor: accent,
        accentHoverColor: accentHover,
        accentTextColor: '#ffffff',
        accentSecondaryColor: hslToHex(accentHue2, 75, 52),
        bgMode: Math.random() > 0.5 ? 'gradient' : 'solid',
        bgGradientAngle: Math.floor(Math.random() * 360),
        bgGradientStart: bg,
        bgGradientMid: isLight ? hslToHex(hue, 25, 92) : hslToHex(hue, 32, 11),
        bgGradientEnd: isLight ? hslToHex(accentHue2, 20, 94) : hslToHex(accentHue2, 28, 7),
        displayFont: displayFonts[Math.floor(Math.random() * displayFonts.length)],
        radiusPx: [0, 4, 8, 12, 16, 22][Math.floor(Math.random() * 6)],
        navPosition: navOptions[Math.floor(Math.random() * navOptions.length)],
        heroMode: heroOptions[Math.floor(Math.random() * heroOptions.length)],
        cardAspect: aspects[Math.floor(Math.random() * aspects.length)],
      })
    );
  }, []);

  const saveNamedProfile = useCallback(
    (name: string) => {
      const clean = name.trim().slice(0, 60);
      if (!clean) return;
      const entry: SavedUiProfile = {
        id: `ui-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: clean,
        config: { ...config, presetId: 'custom' },
        savedAt: Date.now(),
      };
      setSavedProfiles((prev) => [entry, ...prev].slice(0, 25));
    },
    [config]
  );

  const loadNamedProfile = useCallback(
    (profileId: string) => {
      const found = savedProfiles.find((p) => p.id === profileId);
      if (found) {
        setConfig(sanitizeLoadedUiConfig(found.config));
      }
    },
    [savedProfiles]
  );

  const deleteNamedProfile = useCallback((profileId: string) => {
    setSavedProfiles((prev) => prev.filter((p) => p.id !== profileId));
  }, []);

  const exportConfigJson = useCallback(() => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  const importConfigJson = useCallback((json: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'JSON must be a valid theme configuration object.' };
      }
      setConfig(sanitizeLoadedUiConfig(parsed));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Invalid JSON syntax.' };
    }
  }, []);

  const value = useMemo<UiCustomizationContextValue>(
    () => ({
      config,
      isCustomizerOpen,
      customizerDockMode,
      savedProfiles,
      openCustomizer: () => setIsCustomizerOpen(true),
      closeCustomizer: () => setIsCustomizerOpen(false),
      toggleCustomizer: () => setIsCustomizerOpen((prev) => !prev),
      setCustomizerDockMode,
      updateConfig,
      applyPreset,
      resetConfig,
      randomizeConfig,
      saveNamedProfile,
      loadNamedProfile,
      deleteNamedProfile,
      exportConfigJson,
      importConfigJson,
    }),
    [
      config,
      isCustomizerOpen,
      customizerDockMode,
      savedProfiles,
      updateConfig,
      applyPreset,
      resetConfig,
      randomizeConfig,
      saveNamedProfile,
      loadNamedProfile,
      deleteNamedProfile,
      exportConfigJson,
      importConfigJson,
    ]
  );

  return (
    <UiCustomizationContext.Provider value={value}>
      {children}
    </UiCustomizationContext.Provider>
  );
};

export function useUiCustomization(): UiCustomizationContextValue {
  const ctx = useContext(UiCustomizationContext);
  if (!ctx) {
    throw new Error('useUiCustomization must be used within a UiCustomizationProvider');
  }
  return ctx;
}
