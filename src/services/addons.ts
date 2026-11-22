import { z } from 'zod';
import { PlayerSourceConfig } from './megaplay';

const ADDONS_STORAGE_KEY = 'kurostream_user_addons_v1';
const CLEAN_CORE_STORAGE_KEY = 'kurostream_clean_core_mode_v1';

export const ADDON_UPDATED_EVENT = 'kuro:addons-updated';

function isSafeHttpUrlTemplate(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Reject script/data URIs and validate protocol
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://localhost') && !trimmed.startsWith('http://127.0.0.1')) {
    return false;
  }
  return true;
}

export const AddonManifestInputSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, 'Add-on ID must be at least 2 characters')
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i, 'Add-on ID must use letters, numbers, dots, underscores, or hyphens'),
  name: z.string().trim().min(2, 'Add-on name is required').max(80),
  version: z.string().trim().min(1).max(24).default('1.0.0'),
  description: z.string().trim().max(300).optional().default(''),
  author: z.string().trim().max(80).optional().default('Community'),
  types: z.array(z.enum(['anime', 'manga'])).min(1).default(['anime']),
  streamTemplate: z
    .object({
      seriesUrlTemplate: z
        .string()
        .trim()
        .min(10)
        .max(500)
        .refine(isSafeHttpUrlTemplate, {
          message: 'seriesUrlTemplate must begin with https:// (or localhost for local dev)',
        }),
      movieUrlTemplate: z
        .string()
        .trim()
        .max(500)
        .refine((v) => !v || isSafeHttpUrlTemplate(v), {
          message: 'movieUrlTemplate must begin with https://',
        })
        .optional(),
      requiresMalId: z.boolean().optional().default(false),
    })
    .optional(),
  mangaCatalogEndpoint: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || isSafeHttpUrlTemplate(v), {
      message: 'mangaCatalogEndpoint must begin with https://',
    })
    .optional(),
});

export type AddonManifestInput = z.infer<typeof AddonManifestInputSchema>;

export interface KuroAddonManifest extends AddonManifestInput {
  enabled: boolean;
  addedAt: number;
  sourceUrl?: string;
}

export function isEnvCleanCoreLocked(): boolean {
  try {
    return import.meta.env.VITE_CLEAN_CORE_ONLY === 'true';
  } catch {
    return false;
  }
}

export function getCleanCoreMode(): boolean {
  if (isEnvCleanCoreLocked()) return true;
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(CLEAN_CORE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setCleanCoreMode(enabled: boolean): boolean {
  if (isEnvCleanCoreLocked()) return true;
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(CLEAN_CORE_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent(ADDON_UPDATED_EVENT));
  } catch {}
  return enabled;
}

export function loadInstalledAddons(): KuroAddonManifest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ADDONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: KuroAddonManifest[] = [];
    for (const item of parsed) {
      const check = AddonManifestInputSchema.safeParse(item);
      if (check.success) {
        valid.push({
          ...check.data,
          enabled: item.enabled !== false,
          addedAt: typeof item.addedAt === 'number' ? item.addedAt : Date.now(),
          sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
        });
      }
    }
    return valid;
  } catch {
    return [];
  }
}

function persistAddons(addons: KuroAddonManifest[]): KuroAddonManifest[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(addons));
      window.dispatchEvent(new CustomEvent(ADDON_UPDATED_EVENT));
    } catch {}
  }
  return addons;
}

export function installAddonFromObject(
  rawInput: unknown,
  sourceUrl?: string
): { ok: true; addon: KuroAddonManifest; list: KuroAddonManifest[] } | { ok: false; error: string } {
  const parsed = AddonManifestInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || 'Invalid Add-on manifest JSON structure',
    };
  }

  if (!parsed.data.streamTemplate && !parsed.data.mangaCatalogEndpoint) {
    return {
      ok: false,
      error: 'Manifest must define either a streamTemplate or mangaCatalogEndpoint',
    };
  }

  const nextAddon: KuroAddonManifest = {
    ...parsed.data,
    enabled: true,
    addedAt: Date.now(),
    sourceUrl,
  };

  const existing = loadInstalledAddons().filter((a) => a.id !== nextAddon.id);
  const updated = persistAddons([nextAddon, ...existing]);
  return { ok: true, addon: nextAddon, list: updated };
}

export async function fetchAndInstallAddonFromUrl(
  manifestUrl: string
): Promise<{ ok: true; addon: KuroAddonManifest; list: KuroAddonManifest[] } | { ok: false; error: string }> {
  const trimmed = manifestUrl.trim();
  if (!isSafeHttpUrlTemplate(trimmed)) {
    return {
      ok: false,
      error: 'Manifest URL must start with https:// (or http://localhost for local testing)',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Malformed manifest URL' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return { ok: false, error: `Manifest endpoint returned HTTP ${res.status}` };
      }
      const json = await res.json();
      return installAddonFromObject(json, parsedUrl.toString());
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    return {
      ok: false,
      error:
        err?.name === 'AbortError'
          ? 'Timed out fetching remote manifest URL'
          : err?.message || 'Unable to fetch remote manifest (ensure CORS is enabled on the manifest host)',
    };
  }
}

export function toggleAddonEnabled(addonId: string): KuroAddonManifest[] {
  const list = loadInstalledAddons().map((item) =>
    item.id === addonId ? { ...item, enabled: !item.enabled } : item
  );
  return persistAddons(list);
}

export function removeInstalledAddon(addonId: string): KuroAddonManifest[] {
  const list = loadInstalledAddons().filter((item) => item.id !== addonId);
  return persistAddons(list);
}

export function importAddonsBundleJson(
  rawJson: string
): { ok: true; count: number; list: KuroAddonManifest[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax' };
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  let installed = 0;
  let current = loadInstalledAddons();

  for (const item of items) {
    const res = installAddonFromObject(item, typeof (item as any)?.sourceUrl === 'string' ? (item as any).sourceUrl : undefined);
    if (res.ok) {
      current = res.list;
      installed++;
    }
  }

  if (installed === 0) {
    return { ok: false, error: 'No valid add-on manifests found in imported JSON' };
  }

  return { ok: true, count: installed, list: current };
}

export function exportAddonsBundleJson(): string {
  return JSON.stringify(loadInstalledAddons(), null, 2);
}

export function resolveAddonStreamUrl(
  addon: KuroAddonManifest,
  config: Pick<PlayerSourceConfig, 'anilistId' | 'malId' | 'episode' | 'audio' | 'accentColor' | 'format'>
): { available: boolean; url: string | null; reason?: string } {
  if (!addon.enabled || !addon.streamTemplate) {
    return { available: false, url: null, reason: 'Add-on does not provide video streams or is disabled.' };
  }

  const { requiresMalId, seriesUrlTemplate, movieUrlTemplate } = addon.streamTemplate;
  if (requiresMalId && (!config.malId || config.malId <= 0)) {
    return {
      available: false,
      url: null,
      reason: `${addon.name} requires a verified MyAnimeList ID for this title.`,
    };
  }

  const isMovie = (config.format || '').toUpperCase() === 'MOVIE';
  const rawTemplate = isMovie && movieUrlTemplate ? movieUrlTemplate : seriesUrlTemplate;
  const safeEpisode = isMovie ? 1 : Math.max(1, Math.floor(config.episode || 1));

  const interpolated = rawTemplate
    .replace(/\{anilistId\}/g, String(config.anilistId))
    .replace(/\{malId\}/g, config.malId ? String(config.malId) : '')
    .replace(/\{episode\}/g, String(safeEpisode))
    .replace(/\{audio\}/g, encodeURIComponent(config.audio))
    .replace(/\{accent\}/g, encodeURIComponent(config.accentColor || '8b5cf6'));

  try {
    const u = new URL(interpolated);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return { available: false, url: null, reason: 'Blocked insecure add-on stream URL protocol.' };
    }
    return { available: true, url: u.toString() };
  } catch {
    return { available: false, url: null, reason: 'Add-on produced an invalid stream URL.' };
  }
}

export const SAMPLE_ADDON_MANIFEST_TEMPLATE: AddonManifestInput = {
  id: 'org.example.custom-player',
  name: 'Custom External Player',
  version: '1.0.0',
  description: 'User-configured remote stream template compatible with AniList metadata IDs.',
  author: 'Self-Hosted Operator',
  types: ['anime'],
  streamTemplate: {
    seriesUrlTemplate: 'https://your-provider.example/embed/ani/{anilistId}/{episode}?track={audio}&color={accent}',
    movieUrlTemplate: 'https://your-provider.example/embed/movie/{anilistId}?track={audio}',
    requiresMalId: false,
  },
};
