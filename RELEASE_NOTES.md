### Discord RPC
- App now always visible in Discord activities — even when nothing is playing (Idle state)
- Activity type set to **Listening to** (instead of Playing)
- Paused: album art + pause icon, no timer, ⏸ Paused label
- Playing: album art + play icon, elapsed timer shown
- Three duplicate PlayerContext functions merged into one

### Logging
- All `console.*` calls replaced with **electron-log**
- Empty `catch` blocks now log errors instead of swallowing them
- Logs written to `%APPDATA%/Yandex-Music/logs/`

### CI/CD
- **New Release workflow** — manual trigger with version bump (patch/minor/major/skip) and release notes
- Builds for Windows, macOS, Linux with optional code signing
- Release notes read from `RELEASE_NOTES.md` + auto-generated commit log
- `tsconfig.*.tsbuildinfo` removed from git tracking

## 1.300.0

### Highlights
- Replace Python server with Rust server (axum) — faster, lower memory, reliable Windows builds
- Move `server/` to submodule (`blueberry-music-lib`)
- Adapt to Vite 8 / rolldown
- My Wave: artist-tracks endpoint, Yandex-only artist queries
- New modal component with spring animation & portal rendering
- Wave phrase generator with color presets

### Features
- Rust axum server replaces Python (Flask) backend
- Auto-extract SoundCloud `client_id` from page on fetch (no hardcoded keys)
- Rust watcher for dev mode via `cargo-watch` + `concurrently`
- My Wave: artist-tracks endpoint, Yandex-only artist queries, CI .env generation
- Sidecar auto-restart on crash with exponential backoff
- Layout-matched skeleton loaders
- pytubefix priority for stream extraction
- Rate-limit retry via `requests.Session` + caching for search endpoints
- Modal component with spring animation & portal rendering
- Wave phrase generator (`WavePhrase`) with color presets

### Fixes
- Modal animation and portal rendering
- Adapt to Vite 8 / rolldown, update deps, fix dev-watch.bat
- Call `log.initialize()` in main process to register electron-log IPC handlers
- Prevent premature track advance on HLS stream errors
- PlaylistCard crash on playlist tab in search
- Remove duplicate `useTranslation` destructuring in PlaylistCard
- Build and production launch for Rust server
- SSH auth for private submodules (deploy key, GitHub App token, GH_PAT)
- CI artifact cleanup — pagination, auto-delete old artifacts
- Dependabot YAML pattern quoting for `@` compatibility
- Remove `shell: bash` from build step (breaks Windows)
- Rust toolchain action name
- Build workflow: replace Python with Rust, increase timeout

### Performance
- Swap YouTube search priority — yt-dlp first, pytubefix fallback

### Refactor
- Move `server/` to submodule (`blueberry-music-lib`)

### CI
- Dependabot config for npm (main repo) and cargo (submodule)
- Rust cache via `Swatinem/rust-cache` for faster builds
- Fix release artifacts: skip helpers (elevate.exe, music-server.exe, portable exe)

### Docs
- Update README with badges, Rust stack, submodule setup

### Diff summary (v1.201.0 → 1.300.0)
```
50 files changed, 3559 insertions(+), 10464 deletions(-)
```

Key changes:
- `pnpm-lock.yaml` — 3129 lines changed (Rust deps, Vite 8)
- `package.json` — 63 lines changed
- `electron.vite.config.ts` — updated for Vite 8 / rolldown
- `src/main/index.ts` — 201 lines changed (Rust sidecar, electron-log)
- `src/renderer/src/App.tsx` — layout, glow layer, lazily-loaded panels
- `src/renderer/src/components/PlasmaWave.tsx` — 456 lines (refactored wave renderer)
- `src/renderer/src/components/NowPlayingPanel.tsx` — 248 lines (RPC, fullscreen, layout)
- `src/renderer/src/components/SearchView.tsx` — 187 lines (SoundCloud auth, skeleton)
- `src/renderer/src/components/MoodList.tsx` — mood icon blur/outline
- `server/` — removed (moved to `blueberry-music-lib` submodule)
