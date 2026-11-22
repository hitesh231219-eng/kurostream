import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  Download,
  Copy,
  Check,
  Terminal,
  Play,
  Package,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  FileCode2,
  AppWindow,
} from 'lucide-react';

import {
  DEPLOYMENT_URL_UPDATED_EVENT,
  GITHUB_LATEST_RELEASE_URL,
  GITHUB_RELEASE_ASSETS,
  RELEASE_TAG,
  getActiveDeploymentUrl,
} from '../services/deploymentUrl';

interface WindowsSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnableDesktopMode?: () => void;
  isDesktopModeActive?: boolean;
}

type HubTab = 'portable' | 'powershell' | 'desktop';

export const WindowsSetupWizardModal: React.FC<WindowsSetupWizardModalProps> = ({
  isOpen,
  onClose,
  onEnableDesktopMode,
  isDesktopModeActive = false,
}) => {
  const [activeTab, setActiveTab] = useState<HubTab>('portable');
  const [selectedMode, setSelectedMode] = useState<'standard' | 'bypass'>('standard');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState<string>(() => getActiveDeploymentUrl());

  useEffect(() => {
    if (!isOpen) return;
    setAppOrigin(getActiveDeploymentUrl());
    const syncOrigin = () => setAppOrigin(getActiveDeploymentUrl());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener(DEPLOYMENT_URL_UPDATED_EVENT, syncOrigin);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener(DEPLOYMENT_URL_UPDATED_EVENT, syncOrigin);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const installerScriptUrl = `${appOrigin}/install-kurostream.ps1`;

  const commands: Record<'standard' | 'bypass', { label: string; cmd: string; note: string }> = {
    standard: {
      label: 'Standard',
      cmd: `irm "${installerScriptUrl}" | iex`,
      note: 'Downloads and executes the local instance script. Installs desktop shortcut, silent GPU app launcher, Start Menu entry, and clean Apps uninstaller.',
    },
    bypass: {
      label: 'Policy Bypass',
      cmd: `powershell -ExecutionPolicy Bypass -Command "irm '${installerScriptUrl}' | iex"`,
      note: 'Use if Windows displays a PowerShell script execution policy restriction.',
    },
  };

  const activeCommand = commands[selectedMode];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleToggleDesktop = () => {
    if (onEnableDesktopMode) {
      onEnableDesktopMode();
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="KuroStream Desktop & Downloads"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0d1018] border border-[#252c3f] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200"
      >
        <div className="px-5 py-4 bg-[#121622] border-b border-[#1f2638] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/kurostream.ico"
              alt="KuroStream"
              className="w-8 h-8 rounded-lg shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                KuroStream Desktop &amp; Downloads ({RELEASE_TAG})
              </h2>
              <p className="text-xs text-slate-400 truncate">
                GitHub Release Binaries · Windows 10/11 Portable &amp; Installer · 1-Click Script
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1c2336] text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-0 bg-[#0f131d] border-b border-[#1d2436] flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('portable')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'portable'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>GitHub Release ({RELEASE_TAG})</span>
          </button>

          <button
            onClick={() => setActiveTab('powershell')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'powershell'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>1-Click PowerShell</span>
          </button>

          <button
            onClick={() => setActiveTab('desktop')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'desktop'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-violet-400" />
            <span>Desktop Frame &amp; Hosting</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {activeTab === 'portable' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-[#121622] border border-[#232b40] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">
                    Official Windows Release {RELEASE_TAG} (GitHub Hosted)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Includes standalone Electron Windows builds, setup installer bundle, and SHA-256 checksums.
                  </p>
                </div>
                <a
                  href={GITHUB_LATEST_RELEASE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <span>Open {RELEASE_TAG} Release</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={GITHUB_RELEASE_ASSETS.portableExe}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-xl bg-[#121622] hover:bg-[#171d2c] border border-emerald-500/40 hover:border-emerald-400 transition-colors flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap">
                      <AppWindow className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Windows Portable .EXE</span>
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-emerald-400 shrink-0">
                      x64 · EXE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Single-file native Windows executable built via Electron CI. Double-click to launch immediately.
                  </p>
                </a>

                <a
                  href={GITHUB_RELEASE_ASSETS.portableZip}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-xl bg-[#121622] hover:bg-[#171d2c] border border-[#232b40] hover:border-cyan-400 transition-colors flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap">
                      <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Portable App Archive</span>
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-cyan-400 shrink-0">
                      x64 · ZIP
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pre-unpacked Windows Electron bundle with embedded local backend server. Extract and run cleanly.
                  </p>
                </a>

                <a
                  href={GITHUB_RELEASE_ASSETS.installerExe}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-xl bg-[#121622] hover:bg-[#171d2c] border border-[#232b40] hover:border-violet-400 transition-colors flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap">
                      <Package className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>Windows Setup .EXE</span>
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-violet-300 shrink-0">
                      NSIS · EXE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Full Windows installer with Start Menu entry, desktop shortcut, custom icon, and clean uninstaller.
                  </p>
                </a>

                <a
                  href="/KuroStream.bat"
                  download="KuroStream.bat"
                  className="p-4 rounded-xl bg-[#121622] hover:bg-[#171d2c] border border-[#232b40] hover:border-amber-400 transition-colors flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap">
                      <FileCode2 className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Instant GPU Launcher</span>
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-amber-300 shrink-0">
                      .BAT · 2KB
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Lightweight Edge/Chrome/Brave desktop app-mode launcher, or grab full setup zip from{' '}
                    <span className="text-slate-200 underline">Release {RELEASE_TAG}</span>.
                  </p>
                </a>
              </div>
            </div>
          )}

          {activeTab === 'powershell' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Native Windows Installer ({RELEASE_TAG})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Paste into Windows Terminal or PowerShell. No Admin privileges needed.
                  </p>
                </div>

                <div className="flex items-center p-1 bg-[#141824] border border-[#22293d] rounded-lg">
                  {(['standard', 'bypass'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedMode(key)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                        selectedMode === key
                          ? 'bg-violet-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {commands[key].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#07090e] border border-[#22293d] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <code className="text-xs sm:text-sm font-mono text-cyan-300 break-all select-all">
                    {activeCommand.cmd}
                  </code>
                  <button
                    onClick={() => handleCopy(activeCommand.cmd, 'ps-cmd')}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    {copiedKey === 'ps-cmd' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed border-t border-[#171c2b] pt-2">
                  {activeCommand.note}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-[#121622] border border-[#1f2638] space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span>Zero Console Flash</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Launches via a silent VBScript wrapper with Edge, Chrome, or Brave in GPU app mode.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#121622] border border-[#1f2638] space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Clean Windows Uninstall</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Embeds custom .ICO icon, Start Menu entry, kurostream:// handler, and Windows Apps uninstaller.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'desktop' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#121622] border border-[#1f2638] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    In-Browser Windows 11 Titlebar Mode
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Preview native window frame controls, system tray minimize, and fullscreen toggle right inside the browser.
                  </p>
                </div>

                <button
                  onClick={handleToggleDesktop}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                    isDesktopModeActive
                      ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                      : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isDesktopModeActive ? 'Desktop Mode Active' : 'Enable Desktop Mode'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#121622] border border-[#1f2638] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">Active Hosting URL</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 truncate max-w-[260px]">
                    {appOrigin}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={appOrigin}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-[#192032] hover:bg-[#222b42] border border-[#2a334d] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Open Standalone Tab</span>
                  </a>
                  <a
                    href={GITHUB_RELEASE_ASSETS.setupPackageZip}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-[#192032] hover:bg-[#222b42] border border-[#2a334d] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Setup Package (.ZIP)</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-[#0a0c12] border-t border-[#1b2232] flex items-center justify-between text-[11px] text-slate-500">
          <span>Active Streaming Servers: Ryu · War · Warp · Volt</span>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white font-medium whitespace-nowrap shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
