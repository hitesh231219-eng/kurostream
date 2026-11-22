import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Zap,
  Globe,
} from 'lucide-react';
import {
  GITHUB_REPO_URL,
  OFFICIAL_MIRRORS,
  MirrorEndpoint,
  MirrorProbeResult,
  getActiveDeploymentUrl,
  probeAllMirrors,
  setCustomDeploymentUrl,
} from '../services/deploymentUrl';

interface MirrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MirrorsModal: React.FC<MirrorsModalProps> = ({ isOpen, onClose }) => {
  const [probes, setProbes] = useState<Record<string, MirrorProbeResult>>({});
  const [isProbing, setIsProbing] = useState(false);
  const [activeUrl, setActiveUrl] = useState(() => getActiveDeploymentUrl());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const runHealthChecks = useCallback(async () => {
    setIsProbing(true);
    setStatusNotice(null);
    const checkingMap: Record<string, MirrorProbeResult> = {};
    for (const m of OFFICIAL_MIRRORS) {
      checkingMap[m.id] = { id: m.id, status: 'checking', latencyMs: null, checkedAt: null };
    }
    setProbes(checkingMap);

    const results = await probeAllMirrors(OFFICIAL_MIRRORS);
    const nextMap: Record<string, MirrorProbeResult> = {};
    for (const r of results) {
      nextMap[r.id] = r;
    }
    setProbes(nextMap);
    setIsProbing(false);
    return results;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveUrl(getActiveDeploymentUrl());
    void runHealthChecks();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, runHealthChecks]);

  if (!isOpen) return null;

  const handleCopy = async (mirror: MirrorEndpoint) => {
    try {
      await navigator.clipboard.writeText(mirror.url);
      setCopiedId(mirror.id);
      setTimeout(() => setCopiedId((prev) => (prev === mirror.id ? null : prev)), 1800);
    } catch {
      setStatusNotice(`Copy failed — select manually: ${mirror.url}`);
    }
  };

  const handleCopyAll = async () => {
    const urls = OFFICIAL_MIRRORS.filter((m) => m.role === 'Mirror')
      .map((m) => m.url)
      .join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      setCopiedId('all');
      setStatusNotice('Copied all 5 mirror URLs to clipboard.');
      setTimeout(() => setCopiedId((prev) => (prev === 'all' ? null : prev)), 2000);
    } catch {
      setStatusNotice('Unable to write to clipboard.');
    }
  };

  const handleSetActive = (mirror: MirrorEndpoint) => {
    const res = setCustomDeploymentUrl(mirror.url);
    if (res.ok) {
      setActiveUrl(res.url);
      setStatusNotice(`Active deployment link switched to ${mirror.label} (${mirror.url}).`);
    }
  };

  const handleAutoFailover = async () => {
    const results = await runHealthChecks();
    const onlineSorted = results
      .filter((r) => r.status === 'online' && r.latencyMs !== null)
      .sort((a, b) => (a.latencyMs ?? 99999) - (b.latencyMs ?? 99999));

    if (onlineSorted.length === 0) {
      setStatusNotice('No responsive mirrors detected during health probe.');
      return;
    }

    const best = OFFICIAL_MIRRORS.find((m) => m.id === onlineSorted[0].id);
    if (!best) return;
    setCustomDeploymentUrl(best.url);
    setActiveUrl(best.url);
    setStatusNotice(
      `Failover selected ${best.label} (${best.url}) at ${onlineSorted[0].latencyMs} ms.`
    );
  };

  const onlineCount = Object.values(probes).filter((p) => p.status === 'online').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="KuroStream Live Mirrors Directory"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-[#0e111a] border border-[#232738] rounded-xl shadow-2xl overflow-hidden my-8"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#191e2c] bg-[#111522]">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              KuroStream Mirrors Directory
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              Primary site + 5 Netlify &amp; 5 Vercel mirrors · {onlineCount}/{OFFICIAL_MIRRORS.length} online
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close mirrors directory"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1b2033] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400 min-w-0">
              <span>Active Link: </span>
              <span className="font-mono text-slate-200 break-all">{activeUrl}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161b2b] hover:bg-[#1d2438] border border-[#252c40] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span>GitHub Repo</span>
              </a>

              <button
                onClick={runHealthChecks}
                disabled={isProbing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161b2b] hover:bg-[#1d2438] border border-[#252c40] text-xs font-medium text-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
                <span>Test Mirrors</span>
              </button>

              <button
                onClick={handleCopyAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161b2b] hover:bg-[#1d2438] border border-[#252c40] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedId === 'all' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedId === 'all' ? 'Copied All' : 'Copy All 10'}</span>
              </button>

              <button
                onClick={handleAutoFailover}
                disabled={isProbing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Auto-Failover</span>
              </button>
            </div>
          </div>

          {statusNotice && (
            <div className="px-4 py-2.5 rounded-lg bg-[#141928] border border-[#252c40] text-xs text-slate-200">
              {statusNotice}
            </div>
          )}

          <div className="border border-[#1d2233] rounded-lg overflow-hidden divide-y divide-[#191e2c]">
            {OFFICIAL_MIRRORS.map((mirror) => {
              const probe = probes[mirror.id];
              const isCurrent = activeUrl === mirror.url;
              const status = probe?.status ?? 'checking';

              return (
                <div
                  key={mirror.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-[#0c0f17] hover:bg-[#121623] transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-white">{mirror.label}</span>
                      <span aria-hidden="true">·</span>
                      <span>{mirror.provider}</span>
                      {isCurrent && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-violet-300 font-medium">Active</span>
                        </>
                      )}
                    </div>
                    <div className="font-mono text-xs text-slate-300 truncate">{mirror.url}</div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums min-w-[112px] sm:justify-end">
                      {status === 'online' ? (
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Online · {probe.latencyMs}ms</span>
                        </span>
                      ) : status === 'offline' ? (
                        <span className="flex items-center gap-1.5 text-rose-400">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Offline</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span>Checking</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopy(mirror)}
                        title={`Copy ${mirror.url}`}
                        className="px-2.5 py-1.5 rounded-md bg-[#161b2b] hover:bg-[#1f263b] border border-[#252c40] text-xs text-slate-200 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                      >
                        {copiedId === mirror.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === mirror.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        onClick={() => handleSetActive(mirror)}
                        disabled={isCurrent}
                        className="px-2.5 py-1.5 rounded-md bg-[#161b2b] hover:bg-[#1f263b] disabled:opacity-45 border border-[#252c40] text-xs text-slate-200 transition-colors whitespace-nowrap shrink-0"
                      >
                        {isCurrent ? 'Selected' : 'Use'}
                      </button>

                      <a
                        href={mirror.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-md bg-[#1c2236] hover:bg-[#252d47] border border-[#2c344d] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
