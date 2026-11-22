import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  GitBranch,
  Globe,
  X,
  Server,
  Link2,
} from 'lucide-react';
import {
  GITHUB_REPO_URL,
  OFFICIAL_MIRRORS,
  getActiveDeploymentUrl,
  getSavedCustomDeploymentUrl,
  setCustomDeploymentUrl,
} from '../services/deploymentUrl';

interface GitHubDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubDeploymentModal: React.FC<GitHubDeploymentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [repoSlug, setRepoSlug] = useState(
    () => (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim() || 'hitesh231219-eng/kurostream'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [pagesStatus, setPagesStatus] = useState<{
    buildType?: string;
    branch?: string;
    siteUrl?: string;
    checkedAt?: string;
    error?: string;
  } | null>(null);

  const [deploymentUrlInput, setDeploymentUrlInput] = useState(() => getSavedCustomDeploymentUrl());
  const [deploymentNotice, setDeploymentNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDeploymentUrlInput(getSavedCustomDeploymentUrl());
    setDeploymentNotice(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleSaveDeploymentUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const res = setCustomDeploymentUrl(deploymentUrlInput);
    if (!res.ok) {
      setDeploymentNotice({ ok: false, text: res.error || 'Invalid URL' });
      return;
    }
    setDeploymentUrlInput(res.url);
    setDeploymentNotice({
      ok: true,
      text: res.url
        ? `Updated active Netlify / Vercel deployment link to ${res.url}.`
        : 'Cleared custom URL; reverted to active host origin.',
    });
  };

  const checkStatus = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = repoSlug.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(cleaned)) {
      setPagesStatus({ error: 'Enter a valid GitHub repository in owner/repo format.' });
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${cleaned}/pages`);
      if (res.ok) {
        const data = await res.json();
        setPagesStatus({
          buildType: data.build_type || 'legacy',
          branch: data.source?.branch || 'main',
          siteUrl: data.html_url,
          checkedAt: new Date().toLocaleTimeString(),
        });
      } else {
        setPagesStatus({
          error: `GitHub API returned HTTP ${res.status}`,
          checkedAt: new Date().toLocaleTimeString(),
        });
      }
    } catch {
      setPagesStatus({
        error: 'Unable to reach GitHub API.',
        checkedAt: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  const effectiveOrigin = getActiveDeploymentUrl();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Self-Hosting & Deployment Diagnostics"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0e111a] border border-[#232738] rounded-2xl shadow-2xl overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2436] bg-[#121624]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Self-Hosting & Deployment Console
              </h2>
              <p className="text-xs text-slate-400">
                Deploy cleanly on Netlify, Vercel, or a full-stack Node.js host
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close deployment console"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c2236] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm max-h-[75vh] overflow-y-auto">
          {/* Custom Netlify / Vercel / Public Deployment Link */}
          <div className="p-4 rounded-xl bg-[#131724] border border-[#232738] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Link2 className="w-4 h-4 text-emerald-400" />
                <span>Netlify / Vercel Deployment URL</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[280px]">
                Active: {effectiveOrigin}
              </span>
            </div>

            <form onSubmit={handleSaveDeploymentUrl} className="flex items-center gap-2">
              <input
                type="url"
                value={deploymentUrlInput}
                onChange={(e) => setDeploymentUrlInput(e.target.value)}
                placeholder="https://your-site.netlify.app or https://your-site.vercel.app"
                className="flex-1 bg-[#0b0e17] border border-[#252c40] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-slate-950 shrink-0"
              >
                Save Link
              </button>
            </form>

            {deploymentNotice && (
              <p className={`text-xs ${deploymentNotice.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                {deploymentNotice.text}
              </p>
            )}

            <div className="pt-2 border-t border-[#1d2233] space-y-2">
              <div className="text-[11px] font-medium text-slate-400">
                Official KuroStream Netlify &amp; Vercel Mirrors
              </div>
              <div className="flex flex-wrap gap-1.5">
                {OFFICIAL_MIRRORS.map((mirror) => {
                  const isSelected = effectiveOrigin === mirror.url;
                  return (
                    <button
                      key={mirror.id}
                      type="button"
                      onClick={() => {
                        const res = setCustomDeploymentUrl(mirror.url);
                        if (res.ok) {
                          setDeploymentUrlInput(res.url);
                          setDeploymentNotice({
                            ok: true,
                            text: `Switched active link to ${mirror.label} (${res.url}).`,
                          });
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#0b0e17] border-[#252c40] text-slate-300 hover:text-white hover:border-slate-500'
                      }`}
                    >
                      {mirror.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#131724] border border-[#232738] space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
              <span className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-violet-400" />
                <span>Check Your GitHub Pages Deployment</span>
              </span>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-cyan-300 hover:underline flex items-center gap-1"
              >
                <span>Open Repo</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <form onSubmit={checkStatus} className="flex items-center gap-2">
              <input
                type="text"
                value={repoSlug}
                onChange={(e) => setRepoSlug(e.target.value)}
                placeholder="owner/repository (e.g. octocat/kurostream)"
                className="flex-1 bg-[#0b0e17] border border-[#252c40] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={isChecking || !repoSlug.trim()}
                className="px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Inspect</span>
              </button>
            </form>

            {pagesStatus && (
              <div className="p-3 rounded-lg bg-[#0b0e17] border border-[#1f263a] text-xs space-y-1">
                {pagesStatus.error ? (
                  <p className="text-amber-300">{pagesStatus.error}</p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Branch: <strong>{pagesStatus.branch}</strong> · Type:{' '}
                      <strong>{pagesStatus.buildType}</strong>
                    </span>
                    {pagesStatus.siteUrl && (
                      <a
                        href={pagesStatus.siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-300 hover:underline flex items-center gap-1"
                      >
                        <span>Visit Site</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noreferrer"
              className="p-3.5 rounded-xl bg-[#141826] hover:bg-[#1a2033] border border-[#232738] hover:border-emerald-500/50 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-white font-semibold text-xs mb-1">
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    Vercel Hosting
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Configured via <code className="text-emerald-300">vercel.json</code> and{' '}
                  <code className="text-emerald-300">/api/*</code> serverless routes.
                </p>
              </div>
            </a>

            <a
              href="https://app.netlify.com/"
              target="_blank"
              rel="noreferrer"
              className="p-3.5 rounded-xl bg-[#141826] hover:bg-[#1a2033] border border-[#232738] hover:border-cyan-500/50 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-white font-semibold text-xs mb-1">
                  <span className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    Netlify Hosting
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Pre-configured via <code className="text-cyan-300">netlify.toml</code> with serverless functions and SPA routing.
                </p>
              </div>
            </a>

            <a
              href="https://dash.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              className="p-3.5 rounded-xl bg-[#141826] hover:bg-[#1a2033] border border-[#232738] hover:border-violet-500/50 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-white font-semibold text-xs mb-1">
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-amber-400" />
                    Full-Stack Node Host
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Build with <code className="text-slate-300">npm run build</code> and start{' '}
                  <code className="text-slate-300">npm start</code> for full WebSocket sync.
                </p>
              </div>
            </a>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1f2436] bg-[#101420] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1c2236] hover:bg-[#252d47] text-xs font-semibold text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
