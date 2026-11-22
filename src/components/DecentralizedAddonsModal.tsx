import React, { useState, useEffect } from 'react';
import {
  X,
  Puzzle,
  Globe,
  Terminal,
  Plus,
  Trash2,
  Power,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Share2,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import {
  exportAddonsBundleJson,
  fetchAndInstallAddonFromUrl,
  getCleanCoreMode,
  importAddonsBundleJson,
  installAddonFromObject,
  isEnvCleanCoreLocked,
  KuroAddonManifest,
  loadInstalledAddons,
  removeInstalledAddon,
  SAMPLE_ADDON_MANIFEST_TEMPLATE,
  setCleanCoreMode,
  toggleAddonEnabled,
} from '../services/addons';
import {
  DEFAULT_IPFS_GATEWAYS,
  DEFAULT_NOSTR_RELAYS,
  DiscoveredNostrManifest,
  generateCleanCoreEnvSnippet,
  generateIpfsDeploymentScript,
  generateTorHiddenServiceConfig,
  hasNip07Extension,
  IpfsGatewayProbeResult,
  loadDecentralizedConfig,
  NostrRelayProbeResult,
  probeIpfsGateway,
  publishAddonToNostr,
  queryNostrNetwork,
  saveDecentralizedConfig,
  validateIpfsCid,
} from '../services/decentralized';

export type ArchitectureModalTab = 'addons' | 'network' | 'deploy';

interface DecentralizedAddonsModalProps {
  isOpen: boolean;
  initialTab?: ArchitectureModalTab;
  onClose: () => void;
}

export const DecentralizedAddonsModal: React.FC<DecentralizedAddonsModalProps> = ({
  isOpen,
  initialTab = 'addons',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ArchitectureModalTab>(initialTab);

  // Track A: Clean-Core + Remote Manifest Add-ons
  const [addons, setAddons] = useState<KuroAddonManifest[]>(() => loadInstalledAddons());
  const [cleanCoreOnly, setCleanCoreOnly] = useState<boolean>(() => getCleanCoreMode());
  const envLockedCleanCore = isEnvCleanCoreLocked();

  const [manifestUrlInput, setManifestUrlInput] = useState('');
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [addonBusy, setAddonBusy] = useState(false);
  const [addonNotice, setAddonNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Track B: Decentralized Nostr & IPFS Network
  const [decentralConfig, setDecentralConfig] = useState(() => loadDecentralizedConfig());
  const [newRelayInput, setNewRelayInput] = useState('');
  const [authorPubkeyFilter, setAuthorPubkeyFilter] = useState('');
  const [probingNostr, setProbingNostr] = useState(false);
  const [nostrProbes, setNostrProbes] = useState<NostrRelayProbeResult[]>([]);
  const [discoveredManifests, setDiscoveredManifests] = useState<DiscoveredNostrManifest[]>([]);
  const [nostrActionMsg, setNostrActionMsg] = useState<string | null>(null);

  const [customGatewayInput, setCustomGatewayInput] = useState(decentralConfig.ipfsGateway);
  const [cidInput, setCidInput] = useState(decentralConfig.pinnedFrontendCid);
  const [onionInput, setOnionInput] = useState(decentralConfig.onionMirrorHost);
  const [probingIpfs, setProbingIpfs] = useState(false);
  const [ipfsProbe, setIpfsProbe] = useState<IpfsGatewayProbeResult | null>(null);

  // Copy states for Deploy snippets
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setAddons(loadInstalledAddons());
      setCleanCoreOnly(getCleanCoreMode());
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleCleanCore = () => {
    if (envLockedCleanCore) return;
    const next = !cleanCoreOnly;
    setCleanCoreOnly(setCleanCoreMode(next));
    setAddonNotice({
      type: 'ok',
      text: next
        ? 'Clean-Core Mode enabled: built-in mirrors are hidden and player uses only user-installed add-ons.'
        : 'Hybrid Mode restored: built-in Ryu/War/Warp/Volt mirrors and installed add-ons are both active.',
    });
  };

  const handleInstallFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddonNotice(null);
    setAddonBusy(true);
    const result = await fetchAndInstallAddonFromUrl(manifestUrlInput);
    setAddonBusy(false);
    if (result.ok) {
      setAddons(result.list);
      setManifestUrlInput('');
      setAddonNotice({ type: 'ok', text: `Installed add-on "${result.addon.name}" v${result.addon.version}.` });
    } else {
      setAddonNotice({ type: 'err', text: result.error });
    }
  };

  const handleInstallFromJson = () => {
    setAddonNotice(null);
    try {
      const parsed = JSON.parse(rawJsonInput);
      const res = installAddonFromObject(parsed);
      if (res.ok) {
        setAddons(res.list);
        setRawJsonInput('');
        setShowJsonEditor(false);
        setAddonNotice({ type: 'ok', text: `Installed "${res.addon.name}" locally.` });
      } else {
        setAddonNotice({ type: 'err', text: res.error });
      }
    } catch {
      setAddonNotice({ type: 'err', text: 'Invalid JSON syntax. Please check braces and quotes.' });
    }
  };

  const handleExportAddons = () => {
    const json = exportAddonsBundleJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kurostream-addons.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importAddonsBundleJson(String(reader.result || ''));
      if (res.ok) {
        setAddons(res.list);
        setAddonNotice({ type: 'ok', text: `Imported ${res.count} add-on manifest(s).` });
      } else {
        setAddonNotice({ type: 'err', text: res.error });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleProbeNostr = async () => {
    setProbingNostr(true);
    setNostrActionMsg(null);
    const { probes, manifests } = await queryNostrNetwork(
      decentralConfig.nostrRelays,
      authorPubkeyFilter
    );
    setNostrProbes(probes);
    setDiscoveredManifests(manifests);
    setProbingNostr(false);
  };

  const handleAddRelay = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRelayInput.trim();
    if (!/^wss?:\/\/[^\s/]+/i.test(clean)) {
      setNostrActionMsg('Relay URL must start with wss:// or ws://');
      return;
    }
    if (decentralConfig.nostrRelays.includes(clean)) {
      setNewRelayInput('');
      return;
    }
    const next = saveDecentralizedConfig({
      ...decentralConfig,
      nostrRelays: [...decentralConfig.nostrRelays, clean],
    });
    setDecentralConfig(next);
    setNewRelayInput('');
    setNostrActionMsg(null);
  };

  const handleRemoveRelay = (relayUrl: string) => {
    const remaining = decentralConfig.nostrRelays.filter((r) => r !== relayUrl);
    const next = saveDecentralizedConfig({
      ...decentralConfig,
      nostrRelays: remaining.length > 0 ? remaining : DEFAULT_NOSTR_RELAYS,
    });
    setDecentralConfig(next);
  };

  const handlePublishAddonViaNostr = async (addon: KuroAddonManifest) => {
    setNostrActionMsg('Waiting for NIP-07 signature...');
    const res = await publishAddonToNostr(decentralConfig.nostrRelays, addon);
    if (res.ok) {
      const okCount = res.relayAcks.filter((a) => a.accepted).length;
      setNostrActionMsg(`Published event ${res.eventId?.slice(0, 12)}... to ${okCount} relay(s).`);
    } else {
      setNostrActionMsg(res.error || 'Could not publish manifest to Nostr.');
    }
  };

  const handleVerifyIpfs = async () => {
    const cleanGateway = customGatewayInput.trim().replace(/\/+$/, '');
    const cleanCid = cidInput.trim();
    const next = saveDecentralizedConfig({
      ...decentralConfig,
      ipfsGateway: cleanGateway || DEFAULT_IPFS_GATEWAYS[0],
      pinnedFrontendCid: cleanCid,
      onionMirrorHost: onionInput.trim(),
    });
    setDecentralConfig(next);
    setProbingIpfs(true);
    const res = await probeIpfsGateway(next.ipfsGateway, next.pinnedFrontendCid);
    setIpfsProbe(res);
    setProbingIpfs(false);
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedBlock(id);
      setTimeout(() => setCopiedBlock(null), 2000);
    }).catch(() => {});
  };

  const validCidEntered = cidInput.trim().length > 0 && validateIpfsCid(cidInput);

  const tabs: Array<{ id: ArchitectureModalTab; label: string; icon: React.ReactNode }> = [
    { id: 'addons', label: 'Add-On Manifests', icon: <Puzzle className="w-3.5 h-3.5" /> },
    { id: 'network', label: 'Nostr & IPFS Network', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'deploy', label: 'Tor & Static Deploy', icon: <Terminal className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="addons-hub-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl bg-[#0c0e14] border border-[#1d2232] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-[#191e2c] bg-[#090b10]">
          <div>
            <h2 id="addons-hub-title" className="text-lg font-bold text-white tracking-tight">
              Clean-Core Add-Ons &amp; Decentralized Infrastructure
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              User-supplied remote manifests (Stremio/Kodi pattern) plus Nostr, IPFS, and Tor Onion support.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#141721] border border-[#232738] text-slate-400 hover:text-white transition-colors"
            aria-label="Close add-ons and decentralized hub"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-[#191e2c] bg-[#0a0c12] overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-violet-500 text-white bg-[#12151f]/70'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-6 text-sm text-slate-300">
          {activeTab === 'addons' && (
            <div className="space-y-6">
              {/* Clean-Core Architecture Switch */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#111520] border border-[#1f2638] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-bold text-white">
                      Clean-Core Architecture Mode
                    </h3>
                    <span className="font-mono text-[11px] text-slate-400">
                      {cleanCoreOnly ? '(Add-Ons Only)' : '(Built-In + Add-Ons)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    Follows the Stremio/Kodi open-source model: when enabled, KuroStream operates
                    strictly as a metadata &amp; player client using only add-on manifests you install
                    locally in your browser, hiding all built-in embed domains.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={envLockedCleanCore}
                  onClick={handleToggleCleanCore}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
                    cleanCoreOnly
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/70'
                      : 'bg-[#171c2b] border-[#29324a] text-slate-200 hover:bg-[#1f263a]'
                  }`}
                >
                  {envLockedCleanCore
                    ? 'Locked by Build Env'
                    : cleanCoreOnly
                    ? 'Clean-Core: ON'
                    : 'Enable Clean-Core'}
                </button>
              </div>

              {addonNotice && (
                <div
                  className={`p-3.5 rounded-lg border flex items-center gap-2.5 text-xs ${
                    addonNotice.type === 'ok'
                      ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {addonNotice.type === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{addonNotice.text}</span>
                </div>
              )}

              {/* Install Remote Manifest Form */}
              <div className="p-5 rounded-xl bg-[#0e111a] border border-[#1b2131] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">Install External Add-On Manifest</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Add-ons are stored strictly in your browser&apos;s local storage and never saved to server databases.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowJsonEditor((prev) => !prev);
                      if (!rawJsonInput) {
                        setRawJsonInput(JSON.stringify(SAMPLE_ADDON_MANIFEST_TEMPLATE, null, 2));
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#141824] border border-[#242b3f] text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap"
                  >
                    {showJsonEditor ? 'Hide JSON Editor' : 'Paste JSON / Template'}
                  </button>
                </div>

                <form onSubmit={handleInstallFromUrl} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="url"
                    required
                    value={manifestUrlInput}
                    onChange={(e) => setManifestUrlInput(e.target.value)}
                    placeholder="https://example.com/kurostream-addon/manifest.json"
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#12151f] border border-[#23293a] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={addonBusy}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    {addonBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Install Manifest URL</span>
                  </button>
                </form>

                {showJsonEditor && (
                  <div className="space-y-3 pt-2 border-t border-[#181e2d]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Supported placeholders: <code className="font-mono text-violet-300">{'{anilistId}'}</code>,{' '}
                        <code className="font-mono text-violet-300">{'{malId}'}</code>,{' '}
                        <code className="font-mono text-violet-300">{'{episode}'}</code>,{' '}
                        <code className="font-mono text-violet-300">{'{audio}'}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRawJsonInput(JSON.stringify(SAMPLE_ADDON_MANIFEST_TEMPLATE, null, 2))}
                        className="text-violet-400 hover:text-violet-300 font-medium"
                      >
                        Reset Example Template
                      </button>
                    </div>
                    <textarea
                      rows={9}
                      value={rawJsonInput}
                      onChange={(e) => setRawJsonInput(e.target.value)}
                      className="w-full p-3 rounded-lg bg-[#090b10] border border-[#23293a] font-mono text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={handleInstallFromJson}
                      className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
                    >
                      Validate &amp; Install JSON Manifest
                    </button>
                  </div>
                )}
              </div>

              {/* Installed Add-Ons List */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white">
                    Installed Local Add-Ons ({addons.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141721] hover:bg-[#1a1f2e] border border-[#232738] text-xs font-medium text-slate-300 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import JSON</span>
                      <input type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
                    </label>
                    <button
                      type="button"
                      disabled={addons.length === 0}
                      onClick={handleExportAddons}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141721] hover:bg-[#1a1f2e] disabled:opacity-40 border border-[#232738] text-xs font-medium text-slate-300"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>

                {addons.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-[#23293a] text-center space-y-2">
                    <p className="text-sm font-semibold text-white">No User Add-Ons Installed</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Install a remote JSON manifest URL above, paste custom manifest JSON, or discover
                      shared manifests from Nostr relays in the next tab.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#181d2b] border border-[#181d2b] rounded-xl bg-[#0e111a] overflow-hidden">
                    {addons.map((addon) => (
                      <div key={addon.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-white">{addon.name}</span>
                            <span className="font-mono text-[11px] text-slate-400">v{addon.version}</span>
                            <span className="text-[11px] text-slate-500">· {addon.id}</span>
                          </div>
                          {addon.description && (
                            <p className="text-xs text-slate-400 truncate">{addon.description}</p>
                          )}
                          <p className="text-[11px] font-mono text-slate-500 truncate">
                            {addon.sourceUrl || addon.streamTemplate?.seriesUrlTemplate || addon.mangaCatalogEndpoint}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePublishAddonViaNostr(addon)}
                            title={hasNip07Extension() ? 'Broadcast manifest via Nostr NIP-07' : 'Requires NIP-07 Nostr extension'}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141721] hover:bg-[#1a1f2e] border border-[#232738] text-xs font-medium text-slate-300"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share Nostr</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAddons(toggleAddonEnabled(addon.id))}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              addon.enabled
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                : 'bg-[#141721] border-[#232738] text-slate-400'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{addon.enabled ? 'Enabled' : 'Paused'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAddons(removeInstalledAddon(addon.id))}
                            className="p-2 rounded-lg bg-[#141721] hover:bg-rose-950/50 border border-[#232738] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-colors"
                            aria-label={`Remove ${addon.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-8">
              {/* Nostr Relays Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Nostr Relay Discovery Cluster (NIP-01)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Connect over live WebSockets to check relay EOSE latency and discover signed{' '}
                      <code className="font-mono text-slate-300">#kurostream-addon</code> manifests without a central catalog database.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={probingNostr}
                    onClick={handleProbeNostr}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    {probingNostr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Connect &amp; Query Relays</span>
                  </button>
                </div>

                {nostrActionMsg && (
                  <div className="p-3 rounded-lg bg-[#121622] border border-[#242c42] text-xs text-slate-200">
                    {nostrActionMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <form onSubmit={handleAddRelay} className="flex gap-2">
                    <input
                      type="text"
                      value={newRelayInput}
                      onChange={(e) => setNewRelayInput(e.target.value)}
                      placeholder="wss://relay.example.com"
                      className="flex-1 px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-lg bg-[#171c2b] hover:bg-[#1f263a] border border-[#262f46] text-xs font-semibold text-white whitespace-nowrap"
                    >
                      Add Relay
                    </button>
                  </form>

                  <input
                    type="text"
                    value={authorPubkeyFilter}
                    onChange={(e) => setAuthorPubkeyFilter(e.target.value)}
                    placeholder="Optional Author Hex Pubkey (64-char filter)"
                    className="px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* Configured Relay Table */}
                <div className="border border-[#181d2b] rounded-xl bg-[#0e111a] divide-y divide-[#181d2b]">
                  {decentralConfig.nostrRelays.map((relay) => {
                    const probe = nostrProbes.find((p) => p.relayUrl === relay);
                    return (
                      <div key={relay} className="px-4 py-3 flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-slate-200 truncate">{relay}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {probe ? (
                            probe.eoseReceived ? (
                              <span className="font-mono text-emerald-400 tabular-nums">
                                EOSE · {probe.latencyMs}ms · {probe.eventsFound} manifests
                              </span>
                            ) : (
                              <span className="font-mono text-rose-400">
                                {probe.error || 'Unreachable'}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500">Not probed yet</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveRelay(relay)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                            aria-label={`Remove relay ${relay}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {discoveredManifests.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white">Discovered Manifests on Relays</h4>
                    <div className="divide-y divide-[#181d2b] border border-[#181d2b] rounded-xl bg-[#0e111a]">
                      {discoveredManifests.map((item) => (
                        <div key={item.eventId} className="p-3.5 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white">{item.manifest.name}</p>
                            <p className="text-[11px] font-mono text-slate-400 truncate">
                              Pubkey: {item.pubkey.slice(0, 16)}... · via {item.relayUrl}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const res = installAddonFromObject(item.manifest, `nostr:${item.eventId}`);
                              if (res.ok) {
                                setAddons(res.list);
                                setActiveTab('addons');
                                setAddonNotice({ type: 'ok', text: `Installed "${res.addon.name}" from Nostr relay.` });
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shrink-0"
                          >
                            Install Add-On
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* IPFS Gateway & Static Frontend Pin Verifier */}
              <div className="pt-6 border-t border-[#181d2b] space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">IPFS Frontend CID &amp; Gateway Verifier</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure a local IPFS Kubo gateway or public HTTP gateway and verify pinned static builds by Content Identifier.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Preferred IPFS Gateway Origin
                    </label>
                    <input
                      type="url"
                      value={customGatewayInput}
                      onChange={(e) => setCustomGatewayInput(e.target.value)}
                      placeholder="https://ipfs.io or http://127.0.0.1:8080"
                      className="w-full px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] font-mono text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DEFAULT_IPFS_GATEWAYS.map((gw) => (
                        <button
                          key={gw}
                          type="button"
                          onClick={() => setCustomGatewayInput(gw)}
                          className="text-[11px] font-mono text-slate-400 hover:text-violet-300 underline"
                        >
                          {gw.replace(/^https?:\/\//, '')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Pinned Frontend CID (Optional)
                    </label>
                    <input
                      type="text"
                      value={cidInput}
                      onChange={(e) => setCidInput(e.target.value)}
                      placeholder="bafybeig..."
                      className="w-full px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] font-mono text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                    {cidInput.trim() && !validCidEntered && (
                      <p className="text-[11px] text-amber-400 mt-1">
                        CID format should be CIDv0 (Qm...) or CIDv1 (baf...).
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={probingIpfs}
                    onClick={handleVerifyIpfs}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold"
                  >
                    {probingIpfs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Save &amp; Probe Gateway</span>
                  </button>

                  {validCidEntered && (
                    <a
                      href={`${customGatewayInput.replace(/\/+$/, '')}/ipfs/${cidInput.trim()}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#141721] border border-[#232738] text-xs font-semibold text-slate-200 hover:text-white"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open IPFS Gateway URL</span>
                    </a>
                  )}
                </div>

                {ipfsProbe && (
                  <div
                    className={`p-3.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      ipfsProbe.reachable
                        ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    <span>
                      {ipfsProbe.reachable
                        ? `Gateway reachable (${ipfsProbe.gatewayOrigin}) · HTTP ${ipfsProbe.statusCode}`
                        : `Probe failed: ${ipfsProbe.error || 'Unreachable'}`}
                    </span>
                    {ipfsProbe.latencyMs !== null && (
                      <span className="font-mono tabular-nums">{ipfsProbe.latencyMs}ms</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'deploy' && (
            <div className="space-y-6 max-w-3xl">
              <p className="text-xs text-slate-400 leading-relaxed">
                Use these configuration snippets to deploy your own independent Clean-Core GitHub fork,
                pin a relocatable static build to IPFS/IPNS, or expose a Tor v3{' '}
                <code className="font-mono text-slate-300">.onion</code> mirror alongside your Express server.
              </p>

              {/* Snippet 1: Clean-Core GitHub Fork */}
              <div className="rounded-xl border border-[#1d2232] bg-[#0e111a] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#181d2b] flex items-center justify-between">
                  <span className="text-xs font-bold text-white">1. Clean-Core GitHub Fork (.env)</span>
                  <button
                    type="button"
                    onClick={() => copyText('env', generateCleanCoreEnvSnippet())}
                    className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium"
                  >
                    {copiedBlock === 'env' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBlock === 'env' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                  {generateCleanCoreEnvSnippet()}
                </pre>
              </div>

              {/* Snippet 2: IPFS Static Build */}
              <div className="rounded-xl border border-[#1d2232] bg-[#0e111a] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#181d2b] flex items-center justify-between">
                  <span className="text-xs font-bold text-white">2. Relocatable Static Build &amp; IPFS / IPNS Pinning</span>
                  <button
                    type="button"
                    onClick={() => copyText('ipfs', generateIpfsDeploymentScript())}
                    className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium"
                  >
                    {copiedBlock === 'ipfs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBlock === 'ipfs' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                  {generateIpfsDeploymentScript()}
                </pre>
              </div>

              {/* Snippet 3: Tor v3 Hidden Service */}
              <div className="rounded-xl border border-[#1d2232] bg-[#0e111a] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#181d2b] flex items-center justify-between">
                  <span className="text-xs font-bold text-white">3. Tor v3 Onion Service Mirror (torrc)</span>
                  <button
                    type="button"
                    onClick={() => copyText('tor', generateTorHiddenServiceConfig(3000))}
                    className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium"
                  >
                    {copiedBlock === 'tor' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBlock === 'tor' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                  {generateTorHiddenServiceConfig(3000)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
