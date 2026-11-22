import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { NavTab } from '../types/anime';
import { LegalTab } from './LegalModal';
import { ArchitectureModalTab } from './DecentralizedAddonsModal';
import { useUiCustomization } from '../context/UiCustomizationContext';
import { GITHUB_REPO_URL } from '../services/deploymentUrl';

interface FooterProps {
  onSelectTab: (tab: NavTab) => void;
  onOpenWindowsWizard?: () => void;
  onOpenLegal?: (tab: LegalTab) => void;
  onOpenAddonsHub?: (tab?: ArchitectureModalTab) => void;
  onOpenMirrors?: () => void;
  onJumpToFaq?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectTab,
  onOpenWindowsWizard,
  onOpenLegal,
  onOpenAddonsHub,
  onOpenMirrors,
  onJumpToFaq,
}) => {
  const { config, openCustomizer } = useUiCustomization();

  if (!config.showFooter) {
    return null;
  }

  return (
    <footer
      className="py-10 text-xs"
      style={{
        borderTop: `var(--kuro-border-width) solid var(--kuro-border)`,
        backgroundColor: 'var(--kuro-surface)',
        color: 'var(--kuro-text-muted)',
      }}
    >
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
        style={{ maxWidth: config.containerMaxWidth }}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-1.5">
            <div
              className="font-extrabold tracking-tight text-sm"
              style={{ color: 'var(--kuro-text)', fontFamily: 'var(--font-display)' }}
            >
              {config.brandName || 'KUROSTREAM'}
            </div>
            <p className="max-w-md leading-relaxed" style={{ color: 'var(--kuro-text-muted)' }}>
              Stream anime and read manga with AniList GraphQL metadata, synchronized Watch Parties, and native Windows desktop support.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <button onClick={() => onSelectTab('home')} className="hover:underline transition-colors">
              Home
            </button>
            <button onClick={() => onSelectTab('trending')} className="hover:underline transition-colors">
              Trending
            </button>
            <button onClick={() => onSelectTab('popular')} className="hover:underline transition-colors">
              Top Rated
            </button>
            <button onClick={() => onSelectTab('browse')} className="hover:underline transition-colors">
              Categories
            </button>
            <button onClick={() => onSelectTab('manga')} className="hover:underline transition-colors">
              Manga
            </button>
            <button onClick={() => onSelectTab('watchparty')} className="hover:underline transition-colors">
              Watch Party
            </button>
            <button onClick={() => onSelectTab('watchlist')} className="hover:underline transition-colors">
              Watchlist
            </button>
            {onJumpToFaq && (
              <button onClick={onJumpToFaq} className="hover:underline transition-colors">
                Questions
              </button>
            )}
            {onOpenAddonsHub && (
              <button
                onClick={() => onOpenAddonsHub('addons')}
                className="font-medium hover:underline transition-colors"
                style={{ color: 'var(--kuro-text)' }}
              >
                Add-Ons &amp; P2P
              </button>
            )}
            {onOpenMirrors && (
              <button
                onClick={onOpenMirrors}
                className="font-medium hover:underline transition-colors"
                style={{ color: 'var(--kuro-text)' }}
              >
                Mirrors
              </button>
            )}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:underline transition-colors"
              style={{ color: 'var(--kuro-text)' }}
            >
              GitHub
            </a>
            <button
              onClick={openCustomizer}
              className="inline-flex items-center gap-1.5 font-semibold hover:underline transition-colors"
              style={{ color: 'var(--kuro-accent)' }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Customize UI</span>
            </button>
            {onOpenWindowsWizard && (
              <button
                onClick={onOpenWindowsWizard}
                className="font-medium hover:underline transition-colors"
                style={{ color: 'var(--kuro-accent)' }}
              >
                Desktop App
              </button>
            )}
          </div>

          <div className="text-center md:text-right text-[11px] space-y-1">
            <p>
              Metadata:{' '}
              <a
                href="https://anilist.co"
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: 'var(--kuro-text)' }}
              >
                AniList
              </a>{' '}
              · Reader: Honey &amp; Sol
            </p>
            <p>Servers: Ryu · War · Warp · Volt</p>
            <p>© 2026 {config.brandName || 'KuroStream'}</p>
          </div>
        </div>

        <div
          className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]"
          style={{ borderTop: `1px solid var(--kuro-border)` }}
        >
          <p className="text-center sm:text-left">
            KuroStream indexes public AniList metadata and renders external embeds under 17 U.S.C. § 512(d) notice-and-takedown compliance without storing copyrighted video files.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 shrink-0">
            {onOpenAddonsHub && (
              <button onClick={() => onOpenAddonsHub('network')} className="hover:underline transition-colors">
                Nostr / IPFS / Tor
              </button>
            )}
            {onOpenLegal && (
              <>
                <button onClick={() => onOpenLegal('terms')} className="hover:underline transition-colors">
                  Terms of Service
                </button>
                <button onClick={() => onOpenLegal('dmca')} className="hover:underline transition-colors">
                  DMCA &amp; Copyright
                </button>
                <button
                  onClick={() => onOpenLegal('notice')}
                  className="hover:underline transition-colors"
                  style={{ color: 'var(--kuro-accent)' }}
                >
                  Submit Takedown
                </button>
                <button onClick={() => onOpenLegal('privacy')} className="hover:underline transition-colors">
                  Privacy Policy
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
