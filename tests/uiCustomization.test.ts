import { describe, it, expect } from 'vitest';
import {
  ALL_NAV_TABS,
  DEFAULT_HOME_SECTION_META,
  DEFAULT_UI_CONFIG,
  sanitizeLoadedUiConfig,
  UI_PRESETS,
} from '../src/context/UiCustomizationContext';

describe('UI Customization Engine & Config Sanitization', () => {
  it('provides unique valid presets with light and dark polarity options', () => {
    const ids = UI_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(UI_PRESETS.length);
    expect(UI_PRESETS.length).toBeGreaterThanOrEqual(6);

    const schemes = new Set<string>();
    for (const preset of UI_PRESETS) {
      const merged = sanitizeLoadedUiConfig({ ...DEFAULT_UI_CONFIG, ...preset.patch });
      schemes.add(merged.colorScheme);
      expect(merged.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(merged.bgColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(merged.textColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(merged.visibleNavTabs.length).toBeGreaterThan(0);
    }
    expect(schemes.has('dark')).toBe(true);
    expect(schemes.has('light')).toBe(true);
  });

  it('sanitizes malformed or null inputs back to safe defaults', () => {
    expect(sanitizeLoadedUiConfig(null)).toEqual(DEFAULT_UI_CONFIG);
    expect(sanitizeLoadedUiConfig(undefined)).toEqual(DEFAULT_UI_CONFIG);
    expect(sanitizeLoadedUiConfig('corrupt-string')).toEqual(DEFAULT_UI_CONFIG);
  });

  it('keeps at least one nav tab and filters unknown nav tabs', () => {
    const emptyTabs = sanitizeLoadedUiConfig({ visibleNavTabs: [] });
    expect(emptyTabs.visibleNavTabs).toEqual(['home']);

    const noisyTabs = sanitizeLoadedUiConfig({
      visibleNavTabs: ['trending', 'invalid-route', 'manga', 'trending'],
    });
    expect(noisyTabs.visibleNavTabs).toContain('trending');
    expect(noisyTabs.visibleNavTabs).toContain('manga');
    expect(noisyTabs.visibleNavTabs).not.toContain('invalid-route');
    expect(ALL_NAV_TABS.some((t) => t.id === 'watchlist')).toBe(true);
  });

  it('preserves custom home section order while recovering missing sections', () => {
    const partial = sanitizeLoadedUiConfig({
      homeSectionOrder: ['faq', 'hero', 'bogus-id'],
      hiddenHomeSections: ['romance', 'not-a-section'],
      customSectionTitles: { trending: 'Hot Right Now' },
    });

    expect(partial.homeSectionOrder[0]).toBe('faq');
    expect(partial.homeSectionOrder[1]).toBe('hero');
    expect(partial.homeSectionOrder).not.toContain('bogus-id');
    expect(partial.homeSectionOrder.length).toBe(DEFAULT_UI_CONFIG.homeSectionOrder.length);
    for (const sec of DEFAULT_UI_CONFIG.homeSectionOrder) {
      expect(partial.homeSectionOrder).toContain(sec);
      expect(DEFAULT_HOME_SECTION_META[sec]).toBeDefined();
    }
    expect(partial.hiddenHomeSections).toEqual(['romance']);
    expect(partial.customSectionTitles.trending).toBe('Hot Right Now');
  });

  it('preserves arbitrary custom colors, fonts, nav modes, and unrestricted custom CSS', () => {
    const custom = sanitizeLoadedUiConfig({
      colorScheme: 'light',
      bgColor: '#fff8f0',
      accentColor: '#ff007f',
      navPosition: 'left-sidebar',
      heroMode: 'split',
      cardViewMode: 'grid',
      cardGridColumns: 8,
      cardAspect: '16/9',
      radiusPx: 28,
      customGoogleFont: 'Space Grotesk',
      customCss: '.kuro-card-frame { outline: 3px solid hotpink; }',
    });

    expect(custom.colorScheme).toBe('light');
    expect(custom.bgColor).toBe('#fff8f0');
    expect(custom.accentColor).toBe('#ff007f');
    expect(custom.navPosition).toBe('left-sidebar');
    expect(custom.heroMode).toBe('split');
    expect(custom.cardViewMode).toBe('grid');
    expect(custom.cardGridColumns).toBe(8);
    expect(custom.cardAspect).toBe('16/9');
    expect(custom.radiusPx).toBe(28);
    expect(custom.customGoogleFont).toBe('Space Grotesk');
    expect(custom.customCss).toContain('outline: 3px solid hotpink');
  });
});
