export const CUSTOM_DEPLOYMENT_URL_KEY = 'kurostream_custom_public_url';
export const DEPLOYMENT_URL_UPDATED_EVENT = 'kurostream-deployment-url-updated';

export interface MirrorEndpoint {
  id: string;
  label: string;
  url: string;
  role: 'Primary' | 'Mirror';
  provider: 'Netlify' | 'Vercel';
}

export interface MirrorProbeResult {
  id: string;
  status: 'online' | 'offline' | 'checking';
  latencyMs: number | null;
  checkedAt: number | null;
}

export const PRIMARY_PRODUCTION_URL = 'https://kurostream-app.netlify.app';
export const LIVE_FULLSTACK_MIRROR_URL = 'https://kurostream-m1.vercel.app';
export const GITHUB_REPO_URL = 'https://github.com/hitesh231219-eng/kurostream';
export const GITHUB_PAGES_URL = 'https://hitesh231219-eng.github.io/kurostream';
export const RELEASE_VERSION = '2.0.0';
export const RELEASE_TAG = `v${RELEASE_VERSION}`;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const GITHUB_LATEST_RELEASE_URL = `${GITHUB_REPO_URL}/releases/tag/${RELEASE_TAG}`;
export const ANDROID_GOFILE_DOWNLOAD_URL = 'https://gofile.io/d/ChbZFtgH';
export const GITHUB_RELEASE_ASSETS = {
  portableZip: `${GITHUB_REPO_URL}/releases/download/${RELEASE_TAG}/KuroStream-Portable-${RELEASE_VERSION}-x64.zip`,
  setupPackageZip: `${GITHUB_REPO_URL}/releases/download/${RELEASE_TAG}/KuroStream-Windows-Setup-Package.zip`,
  portableExe: `${GITHUB_REPO_URL}/releases/download/${RELEASE_TAG}/KuroStream-Portable-${RELEASE_VERSION}-x64.exe`,
  installerExe: `${GITHUB_REPO_URL}/releases/download/${RELEASE_TAG}/KuroStream-Setup-${RELEASE_VERSION}-x64.exe`,
  androidApk: `${GITHUB_REPO_URL}/releases/download/${RELEASE_TAG}/KuroStream-Release-${RELEASE_VERSION}.apk`,
  sourceArchive: `${GITHUB_REPO_URL}/archive/refs/tags/${RELEASE_TAG}.zip`,
} as const;

export const OFFICIAL_MIRRORS: MirrorEndpoint[] = [
  { id: 'primary', label: 'Primary Origin', url: PRIMARY_PRODUCTION_URL, role: 'Primary', provider: 'Netlify' },
  { id: 'netlify-m1', label: 'Netlify Mirror 01', url: 'https://kurostream-m1.netlify.app', role: 'Mirror', provider: 'Netlify' },
  { id: 'netlify-m2', label: 'Netlify Mirror 02', url: 'https://kurostream-m2.netlify.app', role: 'Mirror', provider: 'Netlify' },
  { id: 'netlify-m3', label: 'Netlify Mirror 03', url: 'https://kurostream-m3.netlify.app', role: 'Mirror', provider: 'Netlify' },
  { id: 'netlify-m4', label: 'Netlify Mirror 04', url: 'https://kurostream-m4.netlify.app', role: 'Mirror', provider: 'Netlify' },
  { id: 'netlify-m5', label: 'Netlify Mirror 05', url: 'https://kurostream-m5.netlify.app', role: 'Mirror', provider: 'Netlify' },
  { id: 'vercel-m1', label: 'Vercel Mirror 01', url: 'https://kurostream-m1.vercel.app', role: 'Mirror', provider: 'Vercel' },
  { id: 'vercel-m2', label: 'Vercel Mirror 02', url: 'https://kurostream-m2.vercel.app', role: 'Mirror', provider: 'Vercel' },
  { id: 'vercel-m3', label: 'Vercel Mirror 03', url: 'https://kurostream-m3.vercel.app', role: 'Mirror', provider: 'Vercel' },
  { id: 'vercel-m4', label: 'Vercel Mirror 04', url: 'https://kurostream-m4.vercel.app', role: 'Mirror', provider: 'Vercel' },
  { id: 'vercel-m5', label: 'Vercel Mirror 05', url: 'https://kurostream-m5.vercel.app', role: 'Mirror', provider: 'Vercel' },
];

export function normalizeDeploymentUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol !== 'https:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getSavedCustomDeploymentUrl(): string {
  try {
    const stored = localStorage.getItem(CUSTOM_DEPLOYMENT_URL_KEY) || '';
    return normalizeDeploymentUrl(stored) || '';
  } catch {
    return '';
  }
}

export function setCustomDeploymentUrl(rawUrl: string): { ok: boolean; url: string; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    try {
      localStorage.removeItem(CUSTOM_DEPLOYMENT_URL_KEY);
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DEPLOYMENT_URL_UPDATED_EVENT, { detail: '' }));
    }
    return { ok: true, url: '' };
  }

  const normalized = normalizeDeploymentUrl(trimmed);
  if (!normalized) {
    return {
      ok: false,
      url: '',
      error: 'Enter a valid HTTPS deployment URL (e.g. https://your-site.netlify.app or https://your-site.vercel.app).',
    };
  }

  try {
    localStorage.setItem(CUSTOM_DEPLOYMENT_URL_KEY, normalized);
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEPLOYMENT_URL_UPDATED_EVENT, { detail: normalized }));
  }
  return { ok: true, url: normalized };
}

export function getActiveDeploymentUrl(): string {
  const saved = getSavedCustomDeploymentUrl();
  if (saved) return saved;
  const envUrl = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim();
  const normalizedEnv = envUrl ? normalizeDeploymentUrl(envUrl) : null;
  if (normalizedEnv) return normalizedEnv;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export async function probeMirrorHealth(mirror: MirrorEndpoint): Promise<MirrorProbeResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${mirror.url}/api/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    const latencyMs = Math.max(1, Math.round(performance.now() - started));
    if (!res.ok) {
      return { id: mirror.id, status: 'offline', latencyMs: null, checkedAt: Date.now() };
    }
    const data = await res.json().catch(() => null);
    return {
      id: mirror.id,
      status: data?.ok ? 'online' : 'offline',
      latencyMs: data?.ok ? latencyMs : null,
      checkedAt: Date.now(),
    };
  } catch {
    return { id: mirror.id, status: 'offline', latencyMs: null, checkedAt: Date.now() };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeAllMirrors(
  mirrors: MirrorEndpoint[] = OFFICIAL_MIRRORS
): Promise<MirrorProbeResult[]> {
  return Promise.all(mirrors.map((mirror) => probeMirrorHealth(mirror)));
}
