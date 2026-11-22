import { describe, it, expect, beforeEach } from 'vitest';
import {
  AddonManifestInputSchema,
  resolveAddonStreamUrl,
  SAMPLE_ADDON_MANIFEST_TEMPLATE,
  KuroAddonManifest,
} from '../src/services/addons';
import {
  generateCleanCoreEnvSnippet,
  generateIpfsDeploymentScript,
  generateTorHiddenServiceConfig,
  validateIpfsCid,
} from '../src/services/decentralized';

describe('Clean-Core Add-On Manifests & Decentralized Helpers', () => {
  it('validates add-on manifests strictly and rejects insecure URL templates', () => {
    const valid = AddonManifestInputSchema.safeParse(SAMPLE_ADDON_MANIFEST_TEMPLATE);
    expect(valid.success).toBe(true);

    const insecure = AddonManifestInputSchema.safeParse({
      ...SAMPLE_ADDON_MANIFEST_TEMPLATE,
      id: 'bad-addon',
      streamTemplate: {
        seriesUrlTemplate: 'javascript:alert(1)//{anilistId}',
      },
    });
    expect(insecure.success).toBe(false);

    const httpExternal = AddonManifestInputSchema.safeParse({
      ...SAMPLE_ADDON_MANIFEST_TEMPLATE,
      id: 'http-external',
      streamTemplate: {
        seriesUrlTemplate: 'http://unencrypted.example/embed/{anilistId}/{episode}',
      },
    });
    expect(httpExternal.success).toBe(false);
  });

  it('interpolates add-on stream URLs accurately for TV series and feature movies', () => {
    const addon: KuroAddonManifest = {
      ...SAMPLE_ADDON_MANIFEST_TEMPLATE,
      enabled: true,
      addedAt: Date.now(),
    };

    const tvRes = resolveAddonStreamUrl(addon, {
      anilistId: 154587,
      malId: 52991,
      episode: 12,
      audio: 'sub',
      accentColor: '8b5cf6',
      format: 'TV',
    });
    expect(tvRes.available).toBe(true);
    expect(tvRes.url).toBe(
      'https://your-provider.example/embed/ani/154587/12?track=sub&color=8b5cf6'
    );

    const movieRes = resolveAddonStreamUrl(addon, {
      anilistId: 21519,
      malId: 32281,
      episode: 5,
      audio: 'dub',
      format: 'MOVIE',
    });
    expect(movieRes.available).toBe(true);
    expect(movieRes.url).toBe('https://your-provider.example/embed/movie/21519?track=dub');
  });

  it('enforces requiresMalId strictly inside add-on stream templates', () => {
    const malAddon: KuroAddonManifest = {
      id: 'org.example.mal-only',
      name: 'MAL Only Mirror',
      version: '1.0.0',
      description: '',
      author: 'Test',
      types: ['anime'],
      enabled: true,
      addedAt: Date.now(),
      streamTemplate: {
        seriesUrlTemplate: 'https://mirror.example/mal/{malId}/{episode}',
        requiresMalId: true,
      },
    };

    const missingMal = resolveAddonStreamUrl(malAddon, {
      anilistId: 154587,
      malId: null,
      episode: 1,
      audio: 'sub',
    });
    expect(missingMal.available).toBe(false);
    expect(missingMal.url).toBeNull();
  });

  it('validates IPFS CIDv0/CIDv1 formats and generates Tor, IPFS & Clean-Core configs', () => {
    expect(validateIpfsCid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(true);
    expect(validateIpfsCid('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')).toBe(true);
    expect(validateIpfsCid('not-a-valid-cid')).toBe(false);

    expect(generateTorHiddenServiceConfig(3000)).toContain('HiddenServicePort 80 127.0.0.1:3000');
    expect(generateIpfsDeploymentScript()).toContain('VITE_IPFS_BUILD=true');
    expect(generateCleanCoreEnvSnippet()).toContain('VITE_CLEAN_CORE_ONLY=true');
  });
});
