# Contributing to KuroStream

Thank you for helping improve **KuroStream**!

## Development Workflow

1. **Fork & Clone**
   ```bash
   git clone https://github.com/hitesh231219-eng/kurostream.git
   cd kurostream
   npm install
   cp .env.example .env
   ```

2. **Start Full-Stack Dev Server (Port 3000)**
   ```bash
   npm run dev
   ```

3. **Run Full Verification Before Opening a PR**
   ```bash
   npm run verify
   ```
   This single cross-platform command verifies:
   - `npm run lint` (`tsc --noEmit`)
   - `npm test` (all Vitest test suites)
   - `npm run build` (Vite production frontend bundle)
   - `npm run build:electron-server` (embedded Electron backend bundle)

## Guidelines

- **No Secrets**: Never commit API keys, GitHub PATs, or private credentials.
- **Cross-Platform Commands**: Keep `package.json` scripts and CI workflows compatible across Windows, macOS, and Linux.
- **Tests**: Add unit or integration tests in `tests/` for any new API routes, download resolvers, or UI configuration features.
