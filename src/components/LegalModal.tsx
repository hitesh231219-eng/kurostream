import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  ShieldAlert,
  FileText,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
} from 'lucide-react';

export type LegalTab = 'terms' | 'dmca' | 'notice' | 'privacy';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: LegalTab;
  onClose: () => void;
}

interface NoticeReceipt {
  caseId: string;
  receivedAt: number;
  delistedMediaId: number | null;
  message: string;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  // Interactive 17 U.S.C. § 512(c)(3) DMCA Notice form state
  const [claimantName, setClaimantName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [infringingUrlOrId, setInfringingUrlOrId] = useState('');
  const [electronicSignature, setElectronicSignature] = useState('');
  const [goodFaithStatement, setGoodFaithStatement] = useState(false);
  const [accuracyUnderPerjury, setAccuracyUnderPerjury] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<NoticeReceipt | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmitNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/dmca/notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimantName: claimantName.trim(),
          organization: organization.trim(),
          email: email.trim(),
          workTitle: workTitle.trim(),
          infringingUrlOrId: infringingUrlOrId.trim(),
          electronicSignature: electronicSignature.trim(),
          goodFaithStatement,
          accuracyUnderPerjury,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data?.error || 'Unable to submit DMCA notice. Please review your entries.');
      } else {
        setReceipt({
          caseId: data.caseId,
          receivedAt: data.receivedAt,
          delistedMediaId: data.delistedMediaId ?? null,
          message: data.message,
        });
        setClaimantName('');
        setOrganization('');
        setEmail('');
        setWorkTitle('');
        setInfringingUrlOrId('');
        setElectronicSignature('');
        setGoodFaithStatement(false);
        setAccuracyUnderPerjury(false);
      }
    } catch {
      setSubmitError('Network error while contacting compliance endpoint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: Array<{ id: LegalTab; label: string; icon: React.ReactNode }> = [
    { id: 'terms', label: 'Terms of Service', icon: <Scale className="w-3.5 h-3.5" /> },
    { id: 'dmca', label: 'DMCA & Safe Harbor', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { id: 'notice', label: 'Submit Takedown', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'privacy', label: 'Privacy Policy', icon: <Lock className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-[#0c0e14] border border-[#1d2232] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-[#191e2c] bg-[#090b10]">
          <div>
            <h2 id="legal-modal-title" className="text-lg font-bold text-white tracking-tight">
              Legal, Terms of Service &amp; Copyright Compliance
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Effective Date: January 1, 2026 · 17 U.S.C. § 512(d) Information Location Framework
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#141721] border border-[#232738] text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            aria-label="Close legal documentation"
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-6 text-sm text-slate-300 leading-relaxed">
          {activeTab === 'terms' && (
            <div className="space-y-6 max-w-3xl">
              <div className="p-4 rounded-lg bg-[#111520] border border-[#1f2638] text-xs text-slate-300 space-y-1.5">
                <p className="font-semibold text-white">Plain-Language Summary</p>
                <p>
                  KuroStream operates strictly as a metadata search and external index interface
                  powered by AniList GraphQL. KuroStream does not host, upload, transcode, or store
                  copyrighted video files on its servers, respects digital access controls, enforces
                  a strict Repeat Infringer policy, and honors prompt takedown requests under 17 U.S.C. § 512.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">1. Acceptance of Terms</h3>
                <p>
                  By accessing or using KuroStream (including web playback, the Manga reader interface,
                  Watch Party rooms, or the Windows Desktop wrapper), you agree to be bound by these
                  Terms of Service and our DMCA Copyright Policy. You must be at least 13 years of age
                  (or the minimum age of digital consent in your jurisdiction) to use the service.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  2. Architecture &amp; Non-Hosting Information Location Role
                </h3>
                <p>
                  KuroStream provides an automated discovery interface displaying public catalog metadata
                  from AniList alongside links and embedded players provided by independent third-party
                  services (labeled Ryu, War, Warp, Volt for video streams, and Honey, Sol for manga
                  indices). KuroStream does not originate, store, cache, or distribute video or audio
                  streams on proprietary media servers, and exercises no editorial control over
                  third-party upstream sources.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  3. Intellectual Property, Respect for Access Controls &amp; Prohibited Use
                </h3>
                <p>Users and visitors agree not to:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  <li>
                    Use KuroStream to distribute, monetize, or reproduce copyrighted works without
                    authorization from the applicable rights holder.
                  </li>
                  <li>
                    Bypass, strip, reverse-engineer, or circumvent any technological protection
                    measure (TPM), DRM control, geo-restriction, or X-Frame / no-embed directive as
                    prohibited under 17 U.S.C. § 1201.
                  </li>
                  <li>
                    Abuse automated proxies, launch denial-of-service requests, or scrape third-party
                    media servers through platform endpoints.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  4. Repeat Infringer &amp; Account Termination Policy (17 U.S.C. § 512(i))
                </h3>
                <p>
                  KuroStream maintains a strict policy providing for the termination, in appropriate
                  circumstances, of user accounts, Watch Party rooms, or access privileges of users who
                  are repeat copyright infringers or who repeatedly post links to infringing materials.
                  Accounts accumulating verified infringement strikes are permanently suspended.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  5. Reservation of Removal &amp; Delisting Rights
                </h3>
                <p>
                  KuroStream reserves the unilateral right to disable access to, suppress, or delist
                  any title ID, Watch Party room, or external server reference immediately upon
                  receiving a valid DMCA takedown notice or upon obtaining actual or red-flag knowledge
                  of unauthorized material, without prior notice or liability.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  6. Watch Party Rooms &amp; Real-Time Chat Conduct
                </h3>
                <p>
                  Room hosts and participants are solely responsible for messages and reactions shared
                  in synchronized Watch Party sessions. Sharing unlawful links, harassment, malware, or
                  spam results in immediate disconnection and session termination.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  7. Disclaimer of Warranties &amp; Limitation of Liability
                </h3>
                <p>
                  THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
                  WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
                  PARTICULAR PURPOSE, OR NON-INFRINGEMENT. TO THE MAXIMUM EXTENT PERMITTED BY LAW,
                  KUROSTREAM SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                  OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THIRD-PARTY EMBEDS OR PLATFORM FEATURES.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">8. Indemnification</h3>
                <p>
                  You agree to indemnify and hold harmless KuroStream, its operators, and affiliates from
                  any claims, damages, liabilities, and legal expenses arising out of your violation of
                  these Terms, infringement of third-party intellectual property rights, or misuse of
                  external links.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'dmca' && (
            <div className="space-y-6 max-w-3xl">
              <div className="p-4 rounded-lg bg-[#111520] border border-[#1f2638] space-y-2 text-xs">
                <p className="font-semibold text-white">
                  Operator Legal Requirement — U.S. Copyright Office Registration
                </p>
                <p className="text-slate-300">
                  Under 17 U.S.C. § 512(c)(2) &amp; § 512(d), statutory DMCA Safe Harbor protection only
                  applies after the site operator formally registers a Designated Copyright Agent in the
                  U.S. Copyright Office electronic directory (copyright.gov/dmca-directory) and updates
                  the contact block below with their real legal name, physical address, and active email.
                  No Terms of Service can override court orders or protect deliberate infringement.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  17 U.S.C. § 512(d) Information Location Tools Compliance
                </h3>
                <p>
                  KuroStream respects the intellectual property rights of creators, studios, and
                  licensors worldwide. Because KuroStream indexes public metadata and external links
                  rather than hosting copyrighted video files, we respond expeditiously to valid
                  notices submitted under the Digital Millennium Copyright Act (DMCA).
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">Designated Copyright Agent</h3>
                <div className="p-4 rounded-lg bg-[#111520] border border-[#1f2638] font-mono text-xs text-slate-300 space-y-1">
                  <p>Attention: Designated DMCA Compliance Agent</p>
                  <p>Entity / Operator: [Operator Legal Name / Entity — Update Upon USCO Filing]</p>
                  <p>Compliance Email: dmca@kurostream.example (Or use interactive Takedown tab)</p>
                  <p>Mailing Address: [Registered Street Address for Process Service]</p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  Required Elements of a Valid Notice (17 U.S.C. § 512(c)(3))
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>Physical or electronic signature of a person authorized to act for the rights owner.</li>
                  <li>Identification of the copyrighted work claimed to have been infringed.</li>
                  <li>Specific URL, anime ID, or manga link reasonably sufficient to locate and disable the reference.</li>
                  <li>Contact details (name, email, phone/mailing address) of the complaining party.</li>
                  <li>A statement of good-faith belief that the disputed use is not authorized by the owner, agent, or law.</li>
                  <li>A statement under penalty of perjury that the notice is accurate and the signer is authorized to act.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  Counter-Notification Procedure (17 U.S.C. § 512(g))
                </h3>
                <p>
                  If material or a link was removed or disabled due to mistake or misidentification, an
                  affected party may submit a written counter-notice including identification of the
                  disabled material, a statement under penalty of perjury of good-faith mistake, consent
                  to federal district court jurisdiction, and a valid signature. Absent notice of a court
                  action within 10–14 business days, access may be restored.
                </p>
              </section>

              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('notice')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Interactive Takedown Form</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notice' && (
            <div className="max-w-2xl space-y-5">
              <div>
                <h3 className="text-base font-bold text-white">
                  Submit a 17 U.S.C. § 512(c)(3) Copyright Removal Notice
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Submit a compliant notice to immediately log a compliance case and suppress any matching
                  AniList media ID from playback.
                </p>
              </div>

              {receipt && (
                <div className="p-4 rounded-lg bg-emerald-950/35 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Notice Logged &amp; Actioned — Reference {receipt.caseId}</span>
                  </div>
                  <p className="text-xs text-emerald-100/90">{receipt.message}</p>
                  <p className="text-[11px] font-mono text-emerald-300/80 tabular-nums">
                    Timestamp: {new Date(receipt.receivedAt).toISOString()}
                    {receipt.delistedMediaId !== null
                      ? ` · Delisted Media ID: ${receipt.delistedMediaId}`
                      : ''}
                  </p>
                </div>
              )}

              {submitError && (
                <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 flex items-center gap-2.5 text-xs text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitNotice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Claimant Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={claimantName}
                      onChange={(e) => setClaimantName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Rights Holder / Studio (Optional)
                    </label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Rights Holder Studio LLC"
                      className="w-full px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Contact Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="legal@rightsholder.com"
                      className="w-full px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Copyrighted Work Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={workTitle}
                      onChange={(e) => setWorkTitle(e.target.value)}
                      placeholder="Official title of protected series/work"
                      className="w-full px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Specific URL Path or AniList Media ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={infringingUrlOrId}
                    onChange={(e) => setInfringingUrlOrId(e.target.value)}
                    placeholder="e.g., https://domain.example/anime/154587 or numeric ID 154587"
                    className="w-full px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-2.5 pt-1">
                  <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={goodFaithStatement}
                      onChange={(e) => setGoodFaithStatement(e.target.checked)}
                      className="mt-0.5 accent-violet-600 rounded"
                    />
                    <span>
                      I have a good-faith belief that use of the material in the manner complained of
                      is not authorized by the copyright owner, its agent, or the law (17 U.S.C. § 512(c)(3)(A)(v)).
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accuracyUnderPerjury}
                      onChange={(e) => setAccuracyUnderPerjury(e.target.checked)}
                      className="mt-0.5 accent-violet-600 rounded"
                    />
                    <span>
                      Under penalty of perjury, the information in this notification is accurate and I am
                      the copyright owner or authorized to act on the owner&apos;s behalf.
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Electronic Signature (Type Full Legal Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={electronicSignature}
                    onChange={(e) => setElectronicSignature(e.target.value)}
                    placeholder="/s/ Jane Doe"
                    className="w-full px-3 py-2 rounded-lg bg-[#12151f] border border-[#23293a] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{submitting ? 'Submitting Notice...' : 'Submit Official DMCA Notice'}</span>
                </button>
              </form>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6 max-w-3xl">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">1. Local Browser Storage (Guest Mode)</h3>
                <p>
                  When browsing without signing in, your watchlist, playback resume timestamps, Daily
                  Quests, and player preferences remain strictly in your browser&apos;s local storage
                  and are never transmitted to advertising brokers.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  2. Google Sign-In &amp; Cloud Synchronization
                </h3>
                <p>
                  If you choose to sign in with Google via Firebase Authentication, we store your public
                  profile identifier, email, watchlist progress, and progression statistics in Cloud
                  Firestore solely to synchronize your state across devices. Signing out clears local
                  session credentials safely.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  3. Security, Rate Limiting &amp; DMCA Records
                </h3>
                <p>
                  Express API endpoints process transient request IP headers solely for abuse rate-limiting
                  and SSRF proxy validation. Submitted DMCA notices are retained strictly for statutory
                  compliance verification and potential counter-notification forwarding as required by law.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
