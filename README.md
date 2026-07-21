# 🫐 Blueberry Desktop

<p align="center">
  <a href="https://github.com/blueberry-devs/blueberry-desktop/actions/workflows/build.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/blueberry-devs/blueberry-desktop/build.yml?branch=main&label=Build&style=flat-square" alt="Build status" />
  </a>
  <a href="https://github.com/blueberry-devs/blueberry-desktop/releases">
    <img src="https://img.shields.io/github/v/release/blueberry-devs/blueberry-desktop?style=flat-square&color=%23cb3837" alt="Release" />
  </a>
  <a href="https://github.com/blueberry-devs/blueberry-desktop/commits/main">
    <img src="https://img.shields.io/github/last-commit/blueberry-devs/blueberry-desktop?style=flat-square&label=Updated" alt="Last commit" />
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform" />
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-GPLv3-blue?style=flat-square" alt="License" />
  </a>
</p>

<pre align="center">An independent, open-source Electron music player.</pre>

Search and play tracks from **SoundCloud**, **YouTube**, **Spotify**, and **Yandex Music**, with synced lyrics, a reactive shader background, and an infinite "wave" queue generator — no account or authentication required.

> **Disclaimer:** Blueberry Desktop is an independent, unofficial, community-built project. It is **not affiliated with, endorsed by, sponsored by, or in any way officially connected to** Yandex LLC, Yandex Music, or any of their subsidiaries or affiliates. Any resemblance in name or UI concept to Yandex Music is coincidental/inspirational only — no Yandex trademarks, branding, logos, or proprietary assets are used, and no Yandex source code is included. "Yandex" and "Яндекс Музыка" are trademarks of their respective owners. This project only talks to Yandex's public catalog API for optional chart/search data, exactly as any third-party client is free to do, and is licensed entirely separately from and independently of Yandex's own software.

## Preview

<p align="center">
  <img src="github/1.jpg" width="32%" alt="Screenshot 1" />
  <img src="github/2.jpg" width="32%" alt="Screenshot 2" />
  <img src="github/3.jpg" width="32%" alt="Screenshot 3" />
</p>

## Features

- **Multi-source playback** — resolves tracks across SoundCloud, YouTube, Spotify, and Yandex Music's public catalog.
- **Lyrics** — auto-loaded from lrclib.net, synced (LRC) and plain text, cached locally.
- **System tray** — play/pause, next/previous, window hide to tray.
- **Reactive background** — Three.js plasma shader that responds to audio frequencies.
- **Persistent storage** — likes, playlists, play history survive restarts.
- **"My Wave"** — infinite queue generator, biased toward your own likes/history as it goes.
- **Fullscreen player** — optional YouTube video-clip background, synced lyrics view.
- **Play history** — dedicated History tab with "play it all" shortcut.
- **Manual source override** — force a track to stream via SoundCloud, YouTube, or Spotify specifically.
- **Offline downloads** — save a track locally for offline playback.
- **Keyboard shortcuts** — play/pause, search, next/previous track, like, close fullscreen player.
- **No authentication** — everything works anonymously, no account required.
- **Auto-update** — checks GitHub Releases on startup, prompts to restart once downloaded.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Space` | Play / pause |
| `Ctrl+K` | Jump to search |
| `Ctrl+→` / `Ctrl+←` | Next / previous track |
| `Ctrl+L` | Like current track |
| `Esc` | Close fullscreen player |

## Getting started

### Prerequisites

- Node.js 18+
- Rust toolchain (for the server sidecar)
- Windows, macOS, or Linux

### Install & run (dev)

The server lives in a [private submodule](https://github.com/blueberry-devs/blueberry-music-lib) — clone with:

```bash
git clone --recurse-submodules https://github.com/blueberry-devs/blueberry-desktop.git
# or if already cloned:
git submodule update --init --recursive
```

Then:

```bash
pnpm install
cp server/.env.example server/.env    # fill in credentials
npm run dev
```

The Electron window opens, and the Rust sidecar starts automatically on port 8787.

### Production build

```bash
npm run dist:win     # Windows
npm run dist:mac     # macOS
npm run dist:linux   # Linux
```

This will:

1. Build the Rust sidecar into `build/packed-server/music-server` (`music-server.exe` on Windows)
2. Build the Electron app via electron-vite
3. Package into a platform installer via electron-builder

No Rust toolchain is needed on the target machine — the server is compiled to a standalone binary.

### Releasing

```bash
$env:GH_TOKEN = "<token>"   # or use the Release workflow in GitHub Actions
npm run release:win
```

Builds and uploads the installer to [GitHub Releases](https://github.com/blueberry-devs/blueberry-desktop/releases). You can also trigger a release from the Actions tab — **Actions → Release → Run workflow** — which bumps the version, builds all platforms, and publishes automatically.

## Architecture

```
blueberry-desktop/
├── src/
│   ├── main/            Electron main process (window, tray, sidecar, IPC, Discord RPC)
│   ├── preload/         Context bridge (IPC API for renderer)
│   └── renderer/src/
│       ├── api/         HTTP client for the Rust sidecar
│       ├── components/  React components (SearchView, NowPlayingPanel, etc.)
│       ├── player/      Player state (React Context + HTML5 Audio + HLS.js)
│       ├── services/    Lyrics cache, persistent store (IPC + localStorage)
│       ├── store/       Reactive stores for likes, playlists, history
│       └── utils/       LRC parser, translations
├── server/              Git submodule → Rust sidecar (Axum + reqwest)
│   └── src/
│       ├── main.rs      Axum server entry point (port 8787)
│       ├── routes.rs    16 API endpoints
│       ├── youtube.rs   InnerTube API client
│       ├── yandex.rs    Yandex Music API client
│       ├── soundcloud.rs SoundCloud API client
│       ├── spotify.rs   Spotify API client (Client Credentials)
│       ├── deezer.rs    Deezer API client (artist photos)
│       └── cache.rs     Shared state with moka caches
```

The renderer communicates with the Rust sidecar over `localhost:8787`. In production, the sidecar binary is bundled into the app resources via electron-builder's `extraResources`.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 32 |
| UI | React 18, TypeScript |
| Animations | Motion (React) |
| Audio | HTML5 Audio, HLS.js, Web Audio API |
| Background | Three.js (custom GLSL shader) |
| Sidecar | Rust, Axum 0.8, Tokio, reqwest |
| Music sources | InnerTube (YouTube), SoundCloud API, Yandex Music API, Spotify Web API, Deezer API |
| Caching | moka (in-memory, TTL-based) |
| HTTP | reqwest, tower-http (CORS, tracing) |
| Icons | Inline SVG |
| Updates | electron-updater (GitHub Releases) |

## License

Licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE) for the full text. This covers this project's own source code only; it does not grant any rights to any third-party trademarks, logos, or branding mentioned above.
