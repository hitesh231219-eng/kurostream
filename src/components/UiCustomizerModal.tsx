import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Type,
  Layout,
  Sparkles,
  Layers,
  Code2,
  Sliders,
  RotateCcw,
  Shuffle,
  Download,
  Upload,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  PanelRight,
  Maximize2,
  Check,
} from 'lucide-react';
import {
  ALL_NAV_TABS,
  CardAspectRatio,
  CardHoverEffect,
  CardImageFilter,
  CardMetadataPosition,
  CardViewMode,
  DEFAULT_HOME_SECTION_META,
  HeroLayoutMode,
  HomeSectionId,
  NavPositionMode,
  UI_PRESETS,
  UiConfig,
  useUiCustomization,
} from '../context/UiCustomizationContext';
import { NavTab } from '../types/anime';

type StudioTab =
  | 'presets'
  | 'colors'
  | 'typography'
  | 'layout'
  | 'cards'
  | 'sections'
  | 'advanced';

const FONT_CHOICES = [
  'Outfit',
  'Plus Jakarta Sans',
  'Playfair Display',
  'Bricolage Grotesque',
  'Manrope',
  'DM Sans',
  'Oswald',
  'Space Mono',
  'IBM Plex Mono',
  'JetBrains Mono',
  'Lora',
  'Source Serif 4',
  'Urbanist',
  'Antonio',
  'Archivo',
  'Cinzel',
];

const STUDIO_TABS: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
  { id: 'presets', label: 'Presets', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'colors', label: 'Colors & BG', icon: <Palette className="w-3.5 h-3.5" /> },
  { id: 'typography', label: 'Typography', icon: <Type className="w-3.5 h-3.5" /> },
  { id: 'layout', label: 'Layout & Nav', icon: <Layout className="w-3.5 h-3.5" /> },
  { id: 'cards', label: 'Hero & Cards', icon: <Sliders className="w-3.5 h-3.5" /> },
  { id: 'sections', label: 'Sections', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'advanced', label: 'Geometry & CSS', icon: <Code2 className="w-3.5 h-3.5" /> },
];

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

const ColorField: React.FC<ColorFieldProps> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-surface-alt)]/50">
    <span className="text-xs font-medium text-[var(--kuro-text)] truncate">{label}</span>
    <div className="flex items-center gap-2 shrink-0">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} hex`}
        className="w-20 px-2 py-1 rounded bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-[11px] font-mono text-[var(--kuro-text)] focus:outline-none focus:border-[var(--kuro-accent)]"
      />
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#7c3aed'}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} picker`}
        className="w-8 h-7 rounded cursor-pointer border border-[var(--kuro-border)] bg-transparent p-0"
      />
    </div>
  </label>
);

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

const SliderField: React.FC<SliderFieldProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium text-[var(--kuro-text)]">{label}</span>
      <span className="font-mono tabular-nums text-[var(--kuro-text-muted)]">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[var(--kuro-accent)] cursor-pointer"
    />
  </div>
);

export const UiCustomizerModal: React.FC = () => {
  const {
    config,
    isCustomizerOpen,
    customizerDockMode,
    savedProfiles,
    closeCustomizer,
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
  } = useUiCustomization();

  const [activeTab, setActiveTab] = useState<StudioTab>('presets');
  const [newProfileName, setNewProfileName] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (!isCustomizerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCustomizer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCustomizerOpen, closeCustomizer]);

  if (!isCustomizerOpen) return null;

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((prev) => (prev === msg ? null : prev)), 2500);
  };

  const toggleNavTab = (tabId: NavTab) => {
    const exists = config.visibleNavTabs.includes(tabId);
    if (exists && config.visibleNavTabs.length <= 1) {
      showTempNotice('Keep at least one navigation tab visible.');
      return;
    }
    const next = exists
      ? config.visibleNavTabs.filter((id) => id !== tabId)
      : [...config.visibleNavTabs, tabId];
    updateConfig({ visibleNavTabs: next });
  };

  const moveNavTab = (tabId: NavTab, dir: -1 | 1) => {
    const idx = config.visibleNavTabs.indexOf(tabId);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= config.visibleNavTabs.length) return;
    const next = [...config.visibleNavTabs];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateConfig({ visibleNavTabs: next });
  };

  const moveHomeSection = (sectionId: HomeSectionId, dir: -1 | 1) => {
    const idx = config.homeSectionOrder.indexOf(sectionId);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= config.homeSectionOrder.length) return;
    const next = [...config.homeSectionOrder];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateConfig({ homeSectionOrder: next });
  };

  const toggleHomeSection = (sectionId: HomeSectionId) => {
    const isHidden = config.hiddenHomeSections.includes(sectionId);
    const next = isHidden
      ? config.hiddenHomeSections.filter((id) => id !== sectionId)
      : [...config.hiddenHomeSections, sectionId];
    updateConfig({ hiddenHomeSections: next });
  };

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportConfigJson());
      setCopiedJson(true);
      showTempNotice('Full UI JSON copied to clipboard.');
      setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      setJsonInput(exportConfigJson());
      setShowImportBox(true);
    }
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportConfigJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kurostream-ui-${config.presetId || 'custom'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showTempNotice('Theme JSON downloaded.');
  };

  const handleImportSubmit = () => {
    const res = importConfigJson(jsonInput);
    if (res.ok) {
      setShowImportBox(false);
      setJsonInput('');
      showTempNotice('Imported custom UI configuration.');
    } else {
      showTempNotice(res.error || 'Import failed.');
    }
  };

  const isDrawer = customizerDockMode === 'drawer';

  return (
    <div
      role="dialog"
      aria-modal={!isDrawer}
      aria-label="Full UI Customization Studio"
      className={
        isDrawer
          ? 'fixed inset-y-0 right-0 z-50 w-full max-w-[440px] flex flex-col shadow-2xl border-l border-[var(--kuro-border)] bg-[var(--kuro-surface-solid)] text-[var(--kuro-text)]'
          : 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm'
      }
    >
      <div
        className={
          isDrawer
            ? 'flex flex-col h-full w-full overflow-hidden'
            : 'flex flex-col w-full max-w-4xl max-h-[88vh] rounded-xl border border-[var(--kuro-border)] bg-[var(--kuro-surface-solid)] text-[var(--kuro-text)] shadow-2xl overflow-hidden'
        }
      >
        {/* Studio Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--kuro-border)] bg-[var(--kuro-surface-alt)]/50 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold truncate">
              Full UI Customization Studio
            </h2>
            <p className="text-[11px] text-[var(--kuro-text-muted)] truncate">
              Unrestricted real-time control of colors, layout, cards, typography &amp; CSS
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={randomizeConfig}
              title="Generate a random full UI theme"
              className="p-2 rounded-lg border border-[var(--kuro-border)] hover:border-[var(--kuro-accent)] text-[var(--kuro-text)] transition-colors"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCustomizerDockMode(isDrawer ? 'modal' : 'drawer')}
              title={isDrawer ? 'Expand to centered modal' : 'Dock as live side drawer'}
              className="p-2 rounded-lg border border-[var(--kuro-border)] hover:border-[var(--kuro-accent)] text-[var(--kuro-text)] transition-colors"
            >
              {isDrawer ? <Maximize2 className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={resetConfig}
              title="Reset all UI settings to default"
              className="p-2 rounded-lg border border-[var(--kuro-border)] hover:border-rose-500 text-[var(--kuro-text)] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={closeCustomizer}
              aria-label="Close UI Studio"
              className="p-2 rounded-lg border border-[var(--kuro-border)] hover:bg-[var(--kuro-surface-alt)] text-[var(--kuro-text)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--kuro-border)] overflow-x-auto no-scrollbar shrink-0 bg-[var(--kuro-bg)]/40">
          {STUDIO_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'kuro-on-accent font-semibold'
                    : 'text-[var(--kuro-text-muted)] hover:text-[var(--kuro-text)] hover:bg-[var(--kuro-surface-alt)]'
                }`}
                style={
                  active
                    ? { backgroundColor: 'var(--kuro-accent)', color: 'var(--kuro-accent-text)' }
                    : undefined
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {notice && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-[var(--kuro-accent)]/40 bg-[var(--kuro-surface-alt)] text-xs text-[var(--kuro-text)] shrink-0">
            {notice}
          </div>
        )}

        {/* Scrollable Studio Controls */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: PRESETS & SAVED PROFILES */}
          {activeTab === 'presets' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)] mb-3">
                  Instant Full-UI Presets
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {UI_PRESETS.map((preset) => {
                    const isSelected = config.presetId === preset.id;
                    const bg = preset.patch.bgColor || '#08090d';
                    const acc = preset.patch.accentColor || '#7c3aed';
                    const txt = preset.patch.textColor || '#ffffff';
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          applyPreset(preset.id);
                          showTempNotice(`Applied ${preset.name}`);
                        }}
                        className={`text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-[var(--kuro-accent)] bg-[var(--kuro-surface-alt)]'
                            : 'border-[var(--kuro-border)] hover:border-[var(--kuro-accent)]/60 bg-[var(--kuro-bg)]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-[var(--kuro-text)]">
                            {preset.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: bg }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: acc }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: txt }}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-[var(--kuro-text-muted)] leading-snug">
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save Custom Profile */}
              <div className="space-y-3 pt-4 border-t border-[var(--kuro-border)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Saved Custom Themes ({savedProfiles.length})
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Profile name (e.g. Neon Tokyo)..."
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)] focus:outline-none focus:border-[var(--kuro-accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newProfileName.trim()) return;
                      saveNamedProfile(newProfileName);
                      setNewProfileName('');
                      showTempNotice('Saved current UI setup.');
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 kuro-on-accent whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: 'var(--kuro-accent)',
                      color: 'var(--kuro-accent-text)',
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>

                {savedProfiles.length > 0 && (
                  <div className="space-y-2">
                    {savedProfiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-bg)]/40"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            loadNamedProfile(profile.id);
                            showTempNotice(`Loaded "${profile.name}"`);
                          }}
                          className="text-left text-xs font-semibold text-[var(--kuro-text)] hover:text-[var(--kuro-accent)] truncate flex-1"
                        >
                          {profile.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteNamedProfile(profile.id)}
                          aria-label={`Delete ${profile.name}`}
                          className="p-1 text-[var(--kuro-text-muted)] hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Export / Import */}
              <div className="space-y-3 pt-4 border-t border-[var(--kuro-border)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Share &amp; Backup Configuration
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyExport}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-surface-alt)] text-xs font-medium text-[var(--kuro-text)] whitespace-nowrap shrink-0"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Copy JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExport}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-surface-alt)] text-xs font-medium text-[var(--kuro-text)] whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export .json</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImportBox((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-surface-alt)] text-xs font-medium text-[var(--kuro-text)] whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import JSON</span>
                  </button>
                </div>

                {showImportBox && (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder="Paste exported KuroStream UI JSON here..."
                      className="w-full p-2.5 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-[11px] font-mono text-[var(--kuro-text)] focus:outline-none focus:border-[var(--kuro-accent)]"
                    />
                    <button
                      type="button"
                      onClick={handleImportSubmit}
                      className="px-4 py-2 rounded-lg text-xs font-semibold kuro-on-accent"
                      style={{
                        backgroundColor: 'var(--kuro-accent)',
                        color: 'var(--kuro-accent-text)',
                      }}
                    >
                      Apply Imported Theme
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COLORS & BACKDROP */}
          {activeTab === 'colors' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-bg)]/40">
                <span className="text-xs font-semibold">Base Polarity Mode</span>
                <div className="flex gap-1.5">
                  {(['dark', 'light'] as const).map((scheme) => (
                    <button
                      key={scheme}
                      type="button"
                      onClick={() =>
                        updateConfig({
                          colorScheme: scheme,
                          ...(scheme === 'light' && config.colorScheme !== 'light'
                            ? {
                                bgColor: '#f6f7fb',
                                surfaceColor: '#ffffff',
                                surfaceAltColor: '#eef1f7',
                                borderColor: '#d9dfe9',
                                textColor: '#0f172a',
                                textMutedColor: '#475569',
                              }
                            : scheme === 'dark' && config.colorScheme !== 'dark'
                            ? {
                                bgColor: '#08090d',
                                surfaceColor: '#12151f',
                                surfaceAltColor: '#191e2e',
                                borderColor: '#1f2536',
                                textColor: '#f1f5f9',
                                textMutedColor: '#94a3b8',
                              }
                            : {}),
                        })
                      }
                      className="px-3 py-1 rounded-md text-xs font-semibold capitalize border border-[var(--kuro-border)]"
                      style={
                        config.colorScheme === scheme
                          ? {
                              backgroundColor: 'var(--kuro-accent)',
                              color: 'var(--kuro-accent-text)',
                            }
                          : undefined
                      }
                    >
                      {scheme}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Full Palette Overrides
                </h3>
                <ColorField label="Canvas Background" value={config.bgColor} onChange={(v) => updateConfig({ bgColor: v })} />
                <ColorField label="Card / Surface" value={config.surfaceColor} onChange={(v) => updateConfig({ surfaceColor: v })} />
                <ColorField label="Elevated / Hover" value={config.surfaceAltColor} onChange={(v) => updateConfig({ surfaceAltColor: v })} />
                <ColorField label="Borders & Dividers" value={config.borderColor} onChange={(v) => updateConfig({ borderColor: v })} />
                <ColorField label="Primary Text" value={config.textColor} onChange={(v) => updateConfig({ textColor: v })} />
                <ColorField label="Muted Text" value={config.textMutedColor} onChange={(v) => updateConfig({ textMutedColor: v })} />
                <ColorField label="Primary Accent" value={config.accentColor} onChange={(v) => updateConfig({ accentColor: v })} />
                <ColorField label="Accent Hover" value={config.accentHoverColor} onChange={(v) => updateConfig({ accentHoverColor: v })} />
                <ColorField label="Button Accent Text" value={config.accentTextColor} onChange={(v) => updateConfig({ accentTextColor: v })} />
                <ColorField label="Secondary Accent" value={config.accentSecondaryColor} onChange={(v) => updateConfig({ accentSecondaryColor: v })} />
              </div>

              {/* Background Mode */}
              <div className="space-y-3 pt-4 border-t border-[var(--kuro-border)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Canvas Backdrop Engine
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['solid', 'gradient', 'image'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateConfig({ bgMode: mode })}
                      className="py-2 rounded-lg text-xs font-semibold capitalize border border-[var(--kuro-border)]"
                      style={
                        config.bgMode === mode
                          ? {
                              backgroundColor: 'var(--kuro-accent)',
                              color: 'var(--kuro-accent-text)',
                            }
                          : undefined
                      }
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {config.bgMode === 'gradient' && (
                  <div className="space-y-2.5 pt-2">
                    <SliderField
                      label="Gradient Angle"
                      value={config.bgGradientAngle}
                      min={0}
                      max={360}
                      unit="°"
                      onChange={(v) => updateConfig({ bgGradientAngle: v })}
                    />
                    <ColorField label="Gradient Start" value={config.bgGradientStart} onChange={(v) => updateConfig({ bgGradientStart: v })} />
                    <ColorField label="Gradient Mid" value={config.bgGradientMid} onChange={(v) => updateConfig({ bgGradientMid: v })} />
                    <ColorField label="Gradient End" value={config.bgGradientEnd} onChange={(v) => updateConfig({ bgGradientEnd: v })} />
                  </div>
                )}

                {config.bgMode === 'image' && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Custom Wallpaper Image URL</label>
                      <input
                        type="url"
                        value={config.bgImageUrl}
                        onChange={(e) => updateConfig({ bgImageUrl: e.target.value })}
                        placeholder="https://example.com/anime-wallpaper.jpg"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)] focus:outline-none focus:border-[var(--kuro-accent)]"
                      />
                    </div>
                    <SliderField
                      label="Wallpaper Opacity"
                      value={config.bgImageOpacityPct}
                      min={5}
                      max={100}
                      unit="%"
                      onChange={(v) => updateConfig({ bgImageOpacityPct: v })}
                    />
                    <SliderField
                      label="Wallpaper Blur"
                      value={config.bgImageBlurPx}
                      min={0}
                      max={32}
                      unit="px"
                      onChange={(v) => updateConfig({ bgImageBlurPx: v })}
                    />
                    <SliderField
                      label="Readability Scrim"
                      value={config.bgImageOverlayOpacityPct}
                      min={0}
                      max={95}
                      unit="%"
                      onChange={(v) => updateConfig({ bgImageOverlayOpacityPct: v })}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TYPOGRAPHY */}
          {activeTab === 'typography' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Display / Heading Font</span>
                  <select
                    value={config.displayFont}
                    onChange={(e) => updateConfig({ displayFont: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)]"
                  >
                    {FONT_CHOICES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Body Text Font</span>
                  <select
                    value={config.bodyFont}
                    onChange={(e) => updateConfig({ bodyFont: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)]"
                  >
                    {FONT_CHOICES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Monospace / Badges Font</span>
                  <select
                    value={config.monoFont}
                    onChange={(e) => updateConfig({ monoFont: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)]"
                  >
                    {['JetBrains Mono', 'Space Mono', 'IBM Plex Mono', 'Outfit'].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold">
                    Load Any Google Font Override (Optional)
                  </span>
                  <input
                    type="text"
                    value={config.customGoogleFont}
                    onChange={(e) => updateConfig({ customGoogleFont: e.target.value })}
                    placeholder="e.g. Syne, Bebas Neue, Cormorant Garamond..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)] focus:outline-none focus:border-[var(--kuro-accent)]"
                  />
                </label>
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--kuro-border)]">
                <SliderField
                  label="Base UI Font Scale"
                  value={config.baseFontSizePx}
                  min={12}
                  max={22}
                  unit="px"
                  onChange={(v) => updateConfig({ baseFontSizePx: v })}
                />
                <SliderField
                  label="Heading Weight"
                  value={config.headingWeight}
                  min={400}
                  max={900}
                  step={100}
                  onChange={(v) => updateConfig({ headingWeight: v })}
                />
                <SliderField
                  label="Heading Letter Spacing"
                  value={config.headingTrackingEm}
                  min={-0.06}
                  max={0.16}
                  step={0.01}
                  unit="em"
                  onChange={(v) => updateConfig({ headingTrackingEm: v })}
                />
                <SliderField
                  label="Body Line Height"
                  value={config.bodyLineHeight}
                  min={1.2}
                  max={2.1}
                  step={0.05}
                  onChange={(v) => updateConfig({ bodyLineHeight: v })}
                />
              </div>
            </div>
          )}

          {/* TAB 4: LAYOUT & NAVIGATION */}
          {activeTab === 'layout' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Navigation Bar Placement
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['top-sticky', 'Top Sticky Bar'],
                      ['top-static', 'Top Static Bar'],
                      ['left-sidebar', 'Left Sidebar'],
                      ['right-sidebar', 'Right Sidebar'],
                      ['bottom-dock', 'Floating Bottom Dock'],
                      ['hidden', 'Hidden / Minimal'],
                    ] as [NavPositionMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateConfig({ navPosition: mode })}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--kuro-border)] text-left"
                      style={
                        config.navPosition === mode
                          ? {
                              backgroundColor: 'var(--kuro-accent)',
                              color: 'var(--kuro-accent-text)',
                            }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {(config.navPosition === 'left-sidebar' || config.navPosition === 'right-sidebar') && (
                <SliderField
                  label="Sidebar Width"
                  value={config.sidebarWidthPx}
                  min={180}
                  max={320}
                  step={4}
                  unit="px"
                  onChange={(v) => updateConfig({ sidebarWidthPx: v })}
                />
              )}

              <label className="block space-y-1">
                <span className="text-xs font-semibold">Custom Brand Wordmark</span>
                <input
                  type="text"
                  value={config.brandName}
                  onChange={(e) => updateConfig({ brandName: e.target.value })}
                  placeholder="KUROSTREAM"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold">Container Max Width</span>
                <select
                  value={config.containerMaxWidth}
                  onChange={(e) => updateConfig({ containerMaxWidth: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)]"
                >
                  <option value="1024px">Compact Editorial (1024px)</option>
                  <option value="1180px">Focused (1180px)</option>
                  <option value="1280px">Standard (1280px)</option>
                  <option value="1440px">Widescreen (1440px)</option>
                  <option value="1680px">Ultrawide (1680px)</option>
                  <option value="100%">Edge-to-Edge Full Bleed (100%)</option>
                </select>
              </label>

              <SliderField
                label="Section Vertical Spacing"
                value={config.sectionSpacingPx}
                min={8}
                max={64}
                step={2}
                unit="px"
                onChange={(v) => updateConfig({ sectionSpacingPx: v })}
              />

              {/* Reorder & Toggle Navigation Tabs */}
              <div className="space-y-2 pt-3 border-t border-[var(--kuro-border)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Navigation Links (Show / Hide / Order)
                </h3>
                <div className="space-y-1.5">
                  {config.visibleNavTabs.map((tabId, idx) => {
                    const meta = ALL_NAV_TABS.find((t) => t.id === tabId);
                    return (
                      <div
                        key={tabId}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-bg)]/40 text-xs"
                      >
                        <span className="font-medium">{meta?.label || tabId}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveNavTab(tabId, -1)}
                            disabled={idx === 0}
                            className="p-1 text-[var(--kuro-text-muted)] hover:text-[var(--kuro-text)] disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveNavTab(tabId, 1)}
                            disabled={idx === config.visibleNavTabs.length - 1}
                            className="p-1 text-[var(--kuro-text-muted)] hover:text-[var(--kuro-text)] disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleNavTab(tabId)}
                            className="p-1 text-emerald-400 hover:text-rose-400"
                            title="Hide link"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {ALL_NAV_TABS.filter((t) => !config.visibleNavTabs.includes(t.id)).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-dashed border-[var(--kuro-border)] opacity-65 text-xs"
                    >
                      <span>{t.label} (Hidden)</span>
                      <button
                        type="button"
                        onClick={() => toggleNavTab(t.id)}
                        className="p-1 text-[var(--kuro-text-muted)] hover:text-emerald-400"
                        title="Show link"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-[var(--kuro-border)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Visible Controls &amp; Chrome
                </h3>
                {(
                  [
                    ['showHeaderDownloads', 'Show Downloads Button'],
                    ['showHeaderSearch', 'Show Search Button'],
                    ['showHeaderProfile', 'Show Profile Button'],
                    ['showHeaderDesktopApp', 'Show Desktop App Button'],
                    ['showFooter', 'Show Website Footer'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-bg)]/40 cursor-pointer text-xs"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(config[key])}
                      onChange={(e) => updateConfig({ [key]: e.target.checked })}
                      className="w-4 h-4 accent-[var(--kuro-accent)]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: HERO & ANIME CARDS */}
          {activeTab === 'cards' && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Hero Showcase Architecture
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['full', 'Full'],
                      ['compact', 'Compact'],
                      ['split', 'Split 2-Col'],
                      ['minimal', 'Minimal'],
                      ['hidden', 'Hidden'],
                    ] as [HeroLayoutMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateConfig({ heroMode: mode })}
                      className="py-2 px-2 rounded-lg text-xs font-semibold border border-[var(--kuro-border)]"
                      style={
                        config.heroMode === mode
                          ? {
                              backgroundColor: 'var(--kuro-accent)',
                              color: 'var(--kuro-accent-text)',
                            }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {config.heroMode !== 'hidden' && (
                  <div className="space-y-3 pt-2">
                    <SliderField
                      label="Hero Height"
                      value={config.heroHeightPx}
                      min={240}
                      max={820}
                      step={10}
                      unit="px"
                      onChange={(v) => updateConfig({ heroHeightPx: v })}
                    />
                    <SliderField
                      label="Hero Backdrop Brightness"
                      value={config.heroBrightnessPct}
                      min={35}
                      max={125}
                      unit="%"
                      onChange={(v) => updateConfig({ heroBrightnessPct: v })}
                    />
                    <SliderField
                      label="Hero Backdrop Blur"
                      value={config.heroBackdropBlurPx}
                      min={0}
                      max={24}
                      unit="px"
                      onChange={(v) => updateConfig({ heroBackdropBlurPx: v })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ['heroAutoSlide', 'Auto-Slide'],
                          ['heroShowNativeTitle', 'Japanese Title'],
                          ['heroShowGenres', 'Genres Line'],
                          ['heroShowDescription', 'Synopsis'],
                        ] as const
                      ).map(([k, lbl]) => (
                        <label
                          key={k}
                          className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-[var(--kuro-border)] text-xs cursor-pointer"
                        >
                          <span>{lbl}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(config[k])}
                            onChange={(e) => updateConfig({ [k]: e.target.checked })}
                            className="accent-[var(--kuro-accent)]"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t border-[var(--kuro-border)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Anime Cards &amp; View Layout
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['carousel', 'Horizontal Carousels'],
                      ['grid', 'Multi-Column Grids'],
                    ] as [CardViewMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateConfig({ cardViewMode: mode })}
                      className="py-2 px-3 rounded-lg text-xs font-semibold border border-[var(--kuro-border)]"
                      style={
                        config.cardViewMode === mode
                          ? {
                              backgroundColor: 'var(--kuro-accent)',
                              color: 'var(--kuro-accent-text)',
                            }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {config.cardViewMode === 'grid' ? (
                  <SliderField
                    label="Desktop Grid Columns"
                    value={config.cardGridColumns}
                    min={2}
                    max={8}
                    onChange={(v) => updateConfig({ cardGridColumns: v })}
                  />
                ) : (
                  <SliderField
                    label="Carousel Card Width"
                    value={config.cardWidthPx}
                    min={115}
                    max={300}
                    step={4}
                    unit="px"
                    onChange={(v) => updateConfig({ cardWidthPx: v })}
                  />
                )}

                <SliderField
                  label="Gap Between Cards"
                  value={config.cardGapPx}
                  min={6}
                  max={36}
                  step={2}
                  unit="px"
                  onChange={(v) => updateConfig({ cardGapPx: v })}
                />

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold">Card Poster Aspect Ratio</span>
                  <div className="grid grid-cols-4 gap-2">
                    {(['2/3', '3/4', '1/1', '16/9'] as CardAspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => updateConfig({ cardAspect: ratio })}
                        className="py-1.5 rounded-lg text-xs font-mono font-semibold border border-[var(--kuro-border)]"
                        style={
                          config.cardAspect === ratio
                            ? {
                                backgroundColor: 'var(--kuro-accent)',
                                color: 'var(--kuro-accent-text)',
                              }
                            : undefined
                        }
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Metadata Placement</span>
                  <select
                    value={config.cardMetadataPosition}
                    onChange={(e) =>
                      updateConfig({ cardMetadataPosition: e.target.value as CardMetadataPosition })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)]"
                  >
                    <option value="below">Below Poster (Standard)</option>
                    <option value="overlay">Inside Bottom Scrim Overlay</option>
                    <option value="minimal">Title Only</option>
                    <option value="hidden">Clean Art Only (No Text)</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold">Hover Effect</span>
                    <select
                      value={config.cardHoverEffect}
                      onChange={(e) =>
                        updateConfig({ cardHoverEffect: e.target.value as CardHoverEffect })
                      }
                      className="w-full px-2.5 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)]"
                    >
                      <option value="scale">Zoom Image</option>
                      <option value="lift">Lift Card</option>
                      <option value="glow">Accent Glow</option>
                      <option value="tilt">3D Perspective Tilt</option>
                      <option value="none">Static</option>
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold">Artwork Filter</span>
                    <select
                      value={config.cardImageFilter}
                      onChange={(e) =>
                        updateConfig({ cardImageFilter: e.target.value as CardImageFilter })
                      }
                      className="w-full px-2.5 py-2 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)]"
                    >
                      <option value="none">Natural</option>
                      <option value="vivid">Vivid HDR</option>
                      <option value="cinema">Cinema Contrast</option>
                      <option value="noir">Monochrome Noir</option>
                      <option value="warm">Warm Film</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['cardShowRank', 'Rank (#1) Badges'],
                      ['cardShowScore', 'Score Stars'],
                      ['cardShowQuickPlay', 'Quick Play Button'],
                      ['cardShowWatchlistBtn', 'Watchlist + Button'],
                    ] as const
                  ).map(([k, lbl]) => (
                    <label
                      key={k}
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-[var(--kuro-border)] text-xs cursor-pointer"
                    >
                      <span>{lbl}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(config[k])}
                        onChange={(e) => updateConfig({ [k]: e.target.checked })}
                        className="accent-[var(--kuro-accent)]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: HOME SECTIONS BUILDER */}
          {activeTab === 'sections' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--kuro-text-muted)] leading-relaxed">
                Reorder, hide, or rename any section on your Home feed. Changes apply instantly with no limits.
              </p>

              <div className="space-y-2.5">
                {config.homeSectionOrder.map((secId, idx) => {
                  const meta = DEFAULT_HOME_SECTION_META[secId];
                  const isHidden = config.hiddenHomeSections.includes(secId);
                  const customTitle = config.customSectionTitles[secId] ?? '';
                  return (
                    <div
                      key={secId}
                      className={`p-3 rounded-lg border border-[var(--kuro-border)] bg-[var(--kuro-bg)]/45 space-y-2 ${
                        isHidden ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--kuro-text)]">
                          {idx + 1}. {meta.label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveHomeSection(secId, -1)}
                            disabled={idx === 0}
                            className="p-1 text-[var(--kuro-text-muted)] hover:text-[var(--kuro-text)] disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveHomeSection(secId, 1)}
                            disabled={idx === config.homeSectionOrder.length - 1}
                            className="p-1 text-[var(--kuro-text-muted)] hover:text-[var(--kuro-text)] disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHomeSection(secId)}
                            className={`p-1 ${isHidden ? 'text-rose-400' : 'text-emerald-400'}`}
                            title={isHidden ? 'Show section' : 'Hide section'}
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {secId !== 'hero' && secId !== 'continue' && secId !== 'faq' && (
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) =>
                            updateConfig({
                              customSectionTitles: {
                                ...config.customSectionTitles,
                                [secId]: e.target.value,
                              },
                            })
                          }
                          placeholder={`Custom heading (default: ${meta.defaultTitle})`}
                          className="w-full px-2.5 py-1.5 rounded bg-[var(--kuro-surface)] border border-[var(--kuro-border)] text-xs text-[var(--kuro-text)] focus:outline-none focus:border-[var(--kuro-accent)]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: GEOMETRY, EFFECTS & RAW CUSTOM CSS */}
          {activeTab === 'advanced' && (
            <div className="space-y-5">
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                  Surface Geometry &amp; Depth
                </h3>
                <SliderField
                  label="Global Corner Radius"
                  value={config.radiusPx}
                  min={0}
                  max={32}
                  unit="px"
                  onChange={(v) => updateConfig({ radiusPx: v })}
                />
                <SliderField
                  label="Border Thickness"
                  value={config.borderWidthPx}
                  min={0}
                  max={4}
                  unit="px"
                  onChange={(v) => updateConfig({ borderWidthPx: v })}
                />
                <SliderField
                  label="Glassmorphism Blur"
                  value={config.glassBlurPx}
                  min={0}
                  max={32}
                  unit="px"
                  onChange={(v) => updateConfig({ glassBlurPx: v })}
                />
                <SliderField
                  label="Surface Opacity"
                  value={config.surfaceOpacityPct}
                  min={20}
                  max={100}
                  unit="%"
                  onChange={(v) => updateConfig({ surfaceOpacityPct: v })}
                />
                <SliderField
                  label="Shadow / Glow Depth"
                  value={config.shadowDepth}
                  min={0}
                  max={3}
                  onChange={(v) => updateConfig({ shadowDepth: v })}
                />
                <SliderField
                  label="Scrollbar Width"
                  value={config.scrollbarWidthPx}
                  min={0}
                  max={14}
                  unit="px"
                  onChange={(v) => updateConfig({ scrollbarWidthPx: v })}
                />
              </div>

              <div className="space-y-2 pt-3 border-t border-[var(--kuro-border)]">
                <span className="text-xs font-semibold">Animation Speed</span>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ['0', 'Instant'],
                      ['0.5', 'Snappy'],
                      ['1', 'Normal'],
                      ['1.8', 'Cinema'],
                    ] as [UiConfig['motionSpeed'], string][]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => updateConfig({ motionSpeed: val })}
                      className="py-1.5 rounded-lg text-xs font-semibold border border-[var(--kuro-border)]"
                      style={
                        config.motionSpeed === val
                          ? {
                              backgroundColor: 'var(--kuro-accent)',
                              color: 'var(--kuro-accent-text)',
                            }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unrestricted Raw CSS */}
              <div className="space-y-2 pt-3 border-t border-[var(--kuro-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--kuro-text-muted)]">
                    Unrestricted Live CSS Override
                  </span>
                  {config.customCss && (
                    <button
                      type="button"
                      onClick={() => updateConfig({ customCss: '' })}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Clear CSS
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--kuro-text-muted)]">
                  Target any element or CSS token (<code className="font-mono">--kuro-accent</code>,{' '}
                  <code className="font-mono">.kuro-card-frame</code>, <code className="font-mono">header</code>,{' '}
                  <code className="font-mono">footer</code>). Applied instantaneously.
                </p>
                <textarea
                  rows={7}
                  value={config.customCss}
                  onChange={(e) => updateConfig({ customCss: e.target.value })}
                  spellCheck={false}
                  placeholder={`/* Example: custom CSS with zero limits */\n.kuro-card-frame {\n  box-shadow: 0 0 24px rgba(124, 58, 237, 0.35);\n}`}
                  className="w-full p-3 rounded-lg bg-[var(--kuro-bg)] border border-[var(--kuro-border)] font-mono text-[11px] text-[var(--kuro-text)] focus:outline-none focus:border-[var(--kuro-accent)]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
