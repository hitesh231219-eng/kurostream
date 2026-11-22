import { describe, it, expect } from 'vitest';
import {
  GITHUB_REPO_URL,
  GITHUB_PAGES_URL,
  GITHUB_LATEST_RELEASE_URL,
  GITHUB_RELEASE_ASSETS,
  RELEASE_TAG,
  RELEASE_VERSION,
} from '../src/services/deploymentUrl';

describe('GitHub Release v2.0.0 & Repository URLs', () => {
  it('points to canonical hitesh231219-eng/kurostream repository and release v2.0.0', () => {
    expect(GITHUB_REPO_URL).toBe('https://github.com/hitesh231219-eng/kurostream');
    expect(GITHUB_PAGES_URL).toBe('https://hitesh231219-eng.github.io/kurostream');
    expect(RELEASE_VERSION).toBe('2.0.0');
    expect(RELEASE_TAG).toBe('v2.0.0');
    expect(GITHUB_LATEST_RELEASE_URL).toBe(
      'https://github.com/hitesh231219-eng/kurostream/releases/tag/v2.0.0'
    );
  });

  it('defines valid HTTPS download URLs for every Windows release package', () => {
    const assets = Object.values(GITHUB_RELEASE_ASSETS);
    expect(assets.length).toBeGreaterThanOrEqual(4);
    for (const url of assets) {
      expect(url.startsWith('https://github.com/hitesh231219-eng/kurostream/')).toBe(true);
    }
    expect(GITHUB_RELEASE_ASSETS.portableZip).toContain('KuroStream-Portable-2.0.0-x64.zip');
    expect(GITHUB_RELEASE_ASSETS.portableExe).toContain('KuroStream-Portable-2.0.0-x64.exe');
    expect(GITHUB_RELEASE_ASSETS.installerExe).toContain('KuroStream-Setup-2.0.0-x64.exe');
    expect(GITHUB_RELEASE_ASSETS.setupPackageZip).toContain('KuroStream-Windows-Setup-Package.zip');
    expect(GITHUB_RELEASE_ASSETS.androidApk).toContain('KuroStream-Release-2.0.0.apk');
  });
});
