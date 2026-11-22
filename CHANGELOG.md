# Changelog

All notable releases and engineering upgrades for **KuroStream** are documented in this file.

## [v2.0.0] — 2026-11-21

### Added
- **Zero-Limits Full UI Customization Studio (`/settings` & `Ctrl+,`)**: Complete real-time customization across theme color schemes, 3-stop gradients, wallpapers with opacity/blur/dimmer controls, arbitrary Google Fonts & typography scale, navigation shell modes (`top`, `sidebar`, `bottom`, `hidden`), hero layouts (`full`, `compact`, `split`, `minimal`, `hidden`), responsive 2–8 column grids, custom section visibility/order/titles, named presets, JSON import/export, and live raw CSS injection.
- **GitHub Releases `v2.0.0` Desktop Distribution**: Hosted Windows x64 Portable `.ZIP` & `.EXE`, NSIS Setup Installer `.EXE`, Windows Setup Kit `.ZIP`, and SHA-256 checksums directly on GitHub Releases.
- **Automated GitHub Actions CI & Windows Release Workflows**:
  - Continuous TypeScript typechecking (`npm run lint`), Vitest unit test verification (`npm test`), Vite frontend builds, and embedded Electron backend bundling.
  - Automated `windows-latest` build pipeline compiling native Windows Portable & NSIS `.EXE` installers and attaching binaries cleanly to GitHub Releases.
- **Repository Showcase & Community Templates**: Upgraded README with live CI/Release badges, visual studio banners, mirror status index, MIT License, Bug Report & Feature Request YAML forms, and Pull Request template.

### Changed
- **Desktop Setup Wizard Routing**: Updated `WindowsSetupWizardModal` to point Windows binary downloads directly to official `v2.0.0` GitHub Release assets with single-line controls, high-contrast tabular tags, and quick access to local 1-click GPU/PowerShell launchers.
- **Electron Packaging Configuration**: Updated `electron-builder.json` to emit both `KuroStream-Portable-2.0.0-x64.exe` and `KuroStream-Setup-2.0.0-x64.exe` cleanly.
- **Mirror & Deployment Links**: Synchronized canonical repository links (`hitesh231219-eng/kurostream`), GitHub Pages mirror, and all Netlify/Vercel cluster links across web, server, and installer scripts.

### Fixed
- Hardened verified anime download resolution across **NekoStream Pahe -> Kwik**, **AnimeTosho**, **Nyaa**, **NekoBT**, and **SubsPlease** using strict AniList/MyAnimeList/AniDB identity matching.
- Improved Cloud Firestore offline fallback handling so watchlist and history state remain resilient when backend connectivity is degraded.

---

## [v1.0.0] — Initial Platform Release

- Live AniList GraphQL anime & manga discovery catalog.
- Multi-server streaming (`Ryu`, `War`, `Warp`, `Volt`) and Manga Reader (`Honey`, `Sol`).
- Synchronized WebSocket Watch Parties and Firebase Auth + Firestore profile sync.
- Initial Electron desktop wrapper and Windows batch/PowerShell setup scripts.
