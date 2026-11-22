import React, { useState } from 'react';
import { ChevronDown, ArrowUpRight, Search, Scale, ShieldCheck, Monitor, Users, BookOpen, Puzzle, Globe } from 'lucide-react';
import { NavTab } from '../types/anime';
import { LegalTab } from './LegalModal';
import { ArchitectureModalTab } from './DecentralizedAddonsModal';
import { useUiCustomization } from '../context/UiCustomizationContext';

type FaqCategory = 'all' | 'streaming' | 'features' | 'legal';

interface FaqAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, 'all'>;
  categoryLabel: string;
  question: string;
  answer: string[];
  actions?: (handlers: HomeFaqSectionProps) => FaqAction[];
}

export interface HomeFaqSectionProps {
  onSelectTab: (tab: NavTab) => void;
  onOpenSearch: () => void;
  onOpenAuth: () => void;
  onOpenWindowsWizard: () => void;
  onOpenLegal: (tab: LegalTab) => void;
  onOpenAddonsHub?: (tab?: ArchitectureModalTab) => void;
  customTitle?: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-servers',
    category: 'streaming',
    categoryLabel: 'Streaming & Manga',
    question: 'How do streaming servers Ryu, War, Warp, and Volt work?',
    answer: [
      'KuroStream monitors upstream server reachability continuously via our health probe endpoint and automatically prioritizes healthy mirrors for both Sub and Dub playback.',
      'Series route across Ryu, War, Warp, and Volt, while feature films automatically route through movie-compatible endpoints (Ryu, War, and Warp) without forcing episodic mismatches. You can switch servers anytime directly inside the player bar.',
    ],
    actions: (h) => [
      { label: 'Browse All Categories', onClick: () => h.onSelectTab('browse'), variant: 'primary' },
      { label: 'Quick Search (Cmd+K)', onClick: h.onOpenSearch, variant: 'secondary' },
    ],
  },
  {
    id: 'faq-manga',
    category: 'streaming',
    categoryLabel: 'Streaming & Manga',
    question: 'Why does the Manga reader switch between Honey and Sol?',
    answer: [
      'Honey provides high-speed indexed chapter directories, while Sol serves as our verified cross-source catalog. When a title has incomplete or region-stubbed chapters on Honey, KuroStream automatically selects Sol so full chapter runs load reliably without broken pages.',
      'All manga page images route through our SSRF-hardened proxy with strict host allowlists, DNS validation, and upstream Referer forwarding.',
    ],
    actions: (h) => [
      { label: 'Open Manga Library', onClick: () => h.onSelectTab('manga'), variant: 'primary' },
    ],
  },
  {
    id: 'faq-watch-party',
    category: 'features',
    categoryLabel: 'Sync & Features',
    question: 'How do Watch Parties synchronize playback across different devices?',
    answer: [
      'Watch Party rooms are managed on our real-time WebSocket server rather than browser-only channels. Every room generates a shareable room code and URL so friends on separate networks and devices join the exact anime, episode, and timestamp selected by the host.',
      'Latency is calibrated automatically with round-trip ping measurements, and host playback controls (play, pause, seek, episode switch, and server switch) are verified server-side with a host authorization token.',
    ],
    actions: (h) => [
      { label: 'Host or Join a Watch Party', onClick: () => h.onSelectTab('watchparty'), variant: 'primary' },
    ],
  },
  {
    id: 'faq-sync',
    category: 'features',
    categoryLabel: 'Sync & Features',
    question: 'Does my Watchlist, exact timestamp resume, and XP sync across devices?',
    answer: [
      'Yes. Guests automatically save watchlists, exact playback timestamps, and date-keyed Daily Quests locally in their browser without losing guest data unless cleared.',
      'Signing in with Google via Firebase Authentication synchronizes your watchlist, resume timestamps, XP, level, and completed quests to Cloud Firestore across every browser and device you sign into.',
    ],
    actions: (h) => [
      { label: 'Open Profile & Sync', onClick: h.onOpenAuth, variant: 'primary' },
      { label: 'View My Watchlist', onClick: () => h.onSelectTab('watchlist'), variant: 'secondary' },
    ],
  },
  {
    id: 'faq-non-hosting',
    category: 'legal',
    categoryLabel: 'Copyright & Terms',
    question: 'Does KuroStream host or store copyrighted video files on its servers?',
    answer: [
      'No. KuroStream acts solely as a discovery catalog and information location interface. Metadata, synopses, scores, and artwork come from the public AniList GraphQL API, and video playback renders third-party external embeds without storing or transcoding media files locally.',
      'Because KuroStream does not host video streams, all Terms of Service and copyright workflows operate under the Information Location Tools framework defined in 17 U.S.C. § 512(d).',
    ],
    actions: (h) => [
      { label: 'Read Terms of Service', onClick: () => h.onOpenLegal('terms'), variant: 'primary' },
    ],
  },
  {
    id: 'faq-dmca-safe-harbor',
    category: 'legal',
    categoryLabel: 'Copyright & Terms',
    question: 'How does KuroStream handle copyright protection and DMCA takedowns?',
    answer: [
      'KuroStream combines technical compliance with strict legal policies: non-hosting indexing under 17 U.S.C. § 512(d), zero DRM or access-control circumvention (17 U.S.C. § 1201), a strict Repeat Infringer termination rule (§ 512(i)), and rapid delisting of reported references.',
      'Rights holders can file a verified 17 U.S.C. § 512(c)(3) notice through our built-in Takedown Form. Valid notices specifying an AniList media ID log a compliance Case ID and immediately suppress that ID from player resolution.',
    ],
    actions: (h) => [
      { label: 'View DMCA & Safe Harbor Policy', onClick: () => h.onOpenLegal('dmca'), variant: 'secondary' },
      { label: 'Submit Takedown Notice', onClick: () => h.onOpenLegal('notice'), variant: 'primary' },
    ],
  },
  {
    id: 'faq-decentralized-addons',
    category: 'legal',
    categoryLabel: 'Copyright & Terms',
    question: 'How do Clean-Core Add-On Manifests, Nostr, IPFS, and Tor Onion support work?',
    answer: [
      'KuroStream supports the Clean-Core Add-On architecture (similar to Stremio/Kodi): you can install custom remote JSON manifest URLs locally in your browser and optionally hide all built-in embed domains so the platform operates strictly as a metadata and player shell.',
      'For decentralized resilience, the built-in Nostr NIP-01 client probes live WebSocket relays to discover signed manifest announcements, the IPFS verifier checks static bundle CIDs across public or local Kubo gateways, and the Deploy tab generates ready-to-use Tor v3 .onion configurations.',
    ],
    actions: (h) =>
      h.onOpenAddonsHub
        ? [
            { label: 'Open Add-On Manifests', onClick: () => h.onOpenAddonsHub?.('addons'), variant: 'primary' },
            { label: 'Nostr & IPFS Network', onClick: () => h.onOpenAddonsHub?.('network'), variant: 'secondary' },
            { label: 'Tor & Static Deploy', onClick: () => h.onOpenAddonsHub?.('deploy'), variant: 'secondary' },
          ]
        : [],
  },
  {
    id: 'faq-desktop',
    category: 'features',
    categoryLabel: 'Sync & Features',
    question: 'How do I install or launch KuroStream as a Windows Desktop app?',
    answer: [
      'Click Desktop App in the top navigation bar to open the Windows installer and Edge App-Mode launcher wizard. You can copy the live PowerShell command tied directly to this server origin or download the native launcher script for borderless desktop playback.',
    ],
    actions: (h) => [
      { label: 'Open Desktop Setup Wizard', onClick: h.onOpenWindowsWizard, variant: 'primary' },
    ],
  },
];

const CATEGORIES: Array<{ id: FaqCategory; label: string }> = [
  { id: 'all', label: 'All Questions' },
  { id: 'streaming', label: 'Streaming & Manga' },
  { id: 'features', label: 'Sync & Features' },
  { id: 'legal', label: 'Copyright & Terms' },
];

export const HomeFaqSection: React.FC<HomeFaqSectionProps> = (props) => {
  const { config } = useUiCustomization();
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>('all');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({ 'faq-servers': true });

  const filteredQuestions =
    selectedCategory === 'all'
      ? FAQ_ITEMS
      : FAQ_ITEMS.filter((item) => item.category === selectedCategory);

  const toggleQuestion = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section
      id="home-faq"
      className="py-14 sm:py-16"
      style={{
        borderTop: `var(--kuro-border-width) solid var(--kuro-border)`,
        backgroundColor: 'var(--kuro-bg)',
      }}
    >
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8 space-y-14"
        style={{ maxWidth: config.containerMaxWidth }}
      >
        {/* Structured Platform Architecture Strip */}
        <div className="space-y-6">
          <div
            className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5"
            style={{ borderBottom: `1px solid var(--kuro-border)` }}
          >
            <div>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-balance"
                style={{ color: 'var(--kuro-text)' }}
              >
                {props.customTitle || 'Built for uninterrupted streaming, reading & compliance'}
              </h2>
              <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
                Every core system runs on real-time verification — from multi-server health checks and
                cross-source manga validation to automated DMCA delisting.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
              {props.onOpenAddonsHub && (
                <button
                  onClick={() => props.onOpenAddonsHub?.('addons')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Puzzle className="w-3.5 h-3.5" />
                  <span>Add-Ons &amp; P2P Hub</span>
                </button>
              )}
              <button
                onClick={props.onOpenSearch}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#12151f] hover:bg-[#191e2e] border border-[#23293a] text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                <Search className="w-3.5 h-3.5 text-violet-400" />
                <span>Search Full Catalog</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#181d2b] rounded-xl overflow-hidden bg-[#0b0d14] divide-y sm:divide-y-0 sm:divide-x divide-[#181d2b]">
            <div className="p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="font-mono text-xs text-violet-400 tabular-nums">01</span>
                <h3 className="text-sm font-bold text-white">Four Streaming Mirrors</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Live health checks across Ryu, War, Warp, and Volt with Sub/Dub selection and movie detection.
                </p>
              </div>
              <button
                onClick={() => props.onSelectTab('browse')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors self-start whitespace-nowrap"
              >
                <span>Explore Anime</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="font-mono text-xs text-violet-400 tabular-nums">02</span>
                <h3 className="text-sm font-bold text-white">Honey &amp; Sol Manga</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automatic completeness checks fall back from Honey to Sol when chapters are partial or external-only.
                </p>
              </div>
              <button
                onClick={() => props.onSelectTab('manga')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors self-start whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open Manga Reader</span>
              </button>
            </div>

            <div className="p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="font-mono text-xs text-violet-400 tabular-nums">03</span>
                <h3 className="text-sm font-bold text-white">WebSocket Watch Parties</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cross-device synchronized playback rooms with ping drift calibration, chat, and host tokens.
                </p>
              </div>
              <button
                onClick={() => props.onSelectTab('watchparty')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors self-start whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Launch Watch Party</span>
              </button>
            </div>

            <div className="p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="font-mono text-xs text-violet-400 tabular-nums">04</span>
                <h3 className="text-sm font-bold text-white">Terms &amp; DMCA Safeguards</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Non-hosting 17 U.S.C. § 512(d) architecture with repeat-infringer rules and live takedown filing.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => props.onOpenLegal('terms')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Terms</span>
                </button>
                <button
                  onClick={() => props.onOpenLegal('dmca')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>DMCA</span>
                </button>
                {props.onOpenAddonsHub && (
                  <button
                    onClick={() => props.onOpenAddonsHub?.('network')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Nostr/IPFS</span>
                  </button>
                )}
                <button
                  onClick={props.onOpenWindowsWizard}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white transition-colors whitespace-nowrap"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Click-to-Answer Questions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Editorial Column */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
              Questions &amp; Answers
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Click any question to view how streaming failover, manga verification, cross-device
              Watch Parties, cloud sync, and copyright compliance work inside KuroStream.
            </p>

            {/* Clean Category Filter Buttons */}
            <div className="flex flex-wrap gap-2 pt-2" role="tablist" aria-label="Question categories">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                      active
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-[#111520] border-[#1f2638] text-slate-300 hover:text-white hover:border-[#2e3852]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Accordion Column */}
          <div className="lg:col-span-8 divide-y divide-[#181d2b] border border-[#181d2b] rounded-xl bg-[#0b0d14] overflow-hidden">
            {filteredQuestions.map((item, idx) => {
              const isOpen = !!openIds[item.id];
              const panelId = `faq-panel-${item.id}`;
              const headerId = `faq-header-${item.id}`;
              const actionList = item.actions ? item.actions(props) : [];

              return (
                <div key={item.id} className="transition-colors">
                  <button
                    id={headerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleQuestion(item.id)}
                    className="w-full px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 text-left hover:bg-[#10131e] transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0 mt-0.5 sm:mt-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="space-y-1 min-w-0">
                        <span className="block text-sm sm:text-base font-semibold text-white leading-snug">
                          {item.question}
                        </span>
                        <span className="block text-[11px] font-medium text-slate-500">
                          {item.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-violet-400' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={headerId}
                      className="px-5 sm:px-6 pb-5 pt-1 pl-12 sm:pl-14 space-y-3 bg-[#090b11]/60"
                    >
                      {item.answer.map((paragraph, pIdx) => (
                        <p key={pIdx} className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          {paragraph}
                        </p>
                      ))}

                      {actionList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2.5 pt-2">
                          {actionList.map((act) => (
                            <button
                              key={act.label}
                              type="button"
                              onClick={act.onClick}
                              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                                act.variant === 'primary'
                                  ? 'bg-violet-600 hover:bg-violet-500 text-white'
                                  : 'bg-[#12151f] hover:bg-[#191e2e] border border-[#23293a] text-slate-200'
                              }`}
                            >
                              {act.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
