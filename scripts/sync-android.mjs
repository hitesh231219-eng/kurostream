#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const androidAssetsPublic = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');
const skipCap = process.argv.includes('--skip-cap');

const FORBIDDEN_TOP_LEVEL = [
  'windows',
  'KuroStream-Windows-Setup-Package.zip',
  'kurostream-full-source-code.zip',
  'KuroStream.bat',
  'launch-kurostream.bat',
  'install-kurostream.ps1',
  'install.ps1',
  'installer.iss',
  'kurostream.ico',
];

const FORBIDDEN_EXTENSIONS = ['.bat', '.ps1', '.iss', '.zip', '.exe', '.vbs'];

function stripForbiddenAssets(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let removedCount = 0;

  for (const name of FORBIDDEN_TOP_LEVEL) {
    const target = path.join(dirPath, name);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[android-sync] Removed Windows asset: ${path.relative(rootDir, target)}`);
      removedCount++;
    }
  }

  function walkAndClean(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === 'windows') {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`[android-sync] Removed Windows directory: ${path.relative(rootDir, fullPath)}`);
          removedCount++;
        } else {
          walkAndClean(fullPath);
        }
      } else {
        const lower = entry.name.toLowerCase();
        if (
          FORBIDDEN_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
          lower === 'kurostream.ico'
        ) {
          fs.rmSync(fullPath, { force: true });
          console.log(`[android-sync] Removed non-Android asset: ${path.relative(rootDir, fullPath)}`);
          removedCount++;
        }
      }
    }
  }

  walkAndClean(dirPath);
  return removedCount;
}

if (!skipCap) {
  console.log('[android-sync] Running npx cap sync android...');
  execSync('npx cap sync android', { stdio: 'inherit', cwd: rootDir });
}

if (!fs.existsSync(androidAssetsPublic)) {
  throw new Error(`Expected Capacitor Android web assets directory not found: ${androidAssetsPublic}`);
}

const removed = stripForbiddenAssets(androidAssetsPublic);
const indexPath = path.join(androidAssetsPublic, 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error(`Android web bundle missing index.html at ${indexPath}`);
}

console.log(`[android-sync] Verified clean Android web bundle (${removed} Windows asset entries stripped).`);
