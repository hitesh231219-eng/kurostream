import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Monitor, Maximize2 } from 'lucide-react';

interface WindowsTitleBarProps {
  onOpenSetupWizard: () => void;
  onToggleDesktopMode: () => void;
  onMinimizeToTray: () => void;
  isDesktopModeActive: boolean;
}

export const WindowsTitleBar: React.FC<WindowsTitleBarProps> = ({
  onOpenSetupWizard,
  onToggleDesktopMode,
  onMinimizeToTray,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsMaximized(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimize();
    } else {
      onMinimizeToTray();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximize();
      setIsMaximized((prev) => !prev);
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.close();
    } else {
      onToggleDesktopMode();
    }
  };

  return (
    <div className="h-9 bg-[#090b12] border-b border-[#1b2234] pl-3.5 pr-0 flex items-center justify-between text-slate-300 select-none z-50 text-xs app-drag-region">
      {/* Left: App Icon & Clean Window Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <img
          src="/kurostream.ico"
          alt="KuroStream"
          className="w-4 h-4 rounded-sm shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="font-semibold text-slate-200 truncate">
          KuroStream Desktop
        </span>
        <span className="hidden sm:inline text-slate-500 font-mono text-[11px] tabular-nums">
          · Windows 11 Edition
        </span>
      </div>

      {/* Right: Setup Shortcut & Authentic Windows 11 Caption Controls */}
      <div className="flex items-center h-full shrink-0 app-no-drag">
        <button
          onClick={onOpenSetupWizard}
          className="h-full px-3 hover:bg-[#161c2b] text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap shrink-0 border-l border-[#171d2c]"
        >
          <Monitor className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Installer & Settings</span>
        </button>

        {/* Minimize to Tray */}
        <button
          onClick={handleMinimize}
          className="h-full w-11 hover:bg-[#1b2234] text-slate-400 hover:text-white transition-colors flex items-center justify-center"
          title="Minimize to System Tray"
          aria-label="Minimize window"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          className="h-full w-11 hover:bg-[#1b2234] text-slate-400 hover:text-white transition-colors flex items-center justify-center"
          title={isMaximized ? 'Restore Window' : 'Maximize Fullscreen'}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-90" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="h-full w-12 hover:bg-[#c42b1c] text-slate-400 hover:text-white transition-colors flex items-center justify-center"
          title={window.electronAPI ? 'Close KuroStream' : 'Exit Desktop Window Mode'}
          aria-label="Close window"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
