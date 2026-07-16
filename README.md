# Blueberry Desktop — Яндекс Музыка

Electron desktop client for Yandex Music with caching, lyrics, and a reactive shader background. Search and play tracks from SoundCloud and YouTube without authentication.

## Features

- **Multi-source playback** — resolves tracks across SoundCloud, YouTube, and Yandex Music (charts).
- **Lyrics** — auto-loaded from lrclib.net, synced (LRC) and plain text, cached locally.
- **System tray** — play/pause, next/previous, window hide to tray.
- **Reactive background** — Three.js plasma shader that responds to audio frequencies.
- **Persistent storage** — likes, playlists, play history survive restarts (localStorage + file backup).
- **"My Wave"** — infinite genre-based queue generator.
- **No authentication** — everything works anonymously.

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.10+ (for the sidecar, dev mode only)
- Windows (macOS/Linux builds not tested)

### Install

```bash
npm install
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `server/.env` and fill in `SOUNDCLOUD_CLIENT_ID` (a public SoundCloud client ID — obtain from any SoundCloud web request or community sources).

### Development

```bash
npm run dev
```

The Electron window opens, the Python sidecar starts automatically on port 8787.

### Production build

```bash
npm run dist:win
```

This will:
1. Compile the Python sidecar into `music-server.exe` via PyInstaller
2. Build the Electron app via electron-vite
3. Package into a Windows installer via electron-builder

No Python runtime is needed on the target machine — the server is a self-contained executable.

## Architecture

```
src/
  main/          Electron main process (window, tray, sidecar, IPC)
  preload/       Context bridge (IPC API for renderer)
  renderer/src/
    api/         HTTP client for the Python sidecar
    components/  React components (NowPlayingPanel, SearchView, etc.)
    player/      Player state (React Context + HTML5 Audio + HLS.js)
    services/    Lyrics cache, persistent store (IPC + localStorage)
    store/       Reactive stores for likes, playlists, history
    utils/       LRC parser
server/
  main.py        FastAPI sidecar (search, stream resolve, lyrics)
```

The renderer communicates with the Python sidecar over `localhost:8787`. In production, the sidecar is a PyInstaller-packed executable bundled into the app resources.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 32 |
| UI | React 18, TypeScript |
| Animations | Motion |
| Audio | HTML5 Audio, HLS.js, Web Audio API |
| Background | Three.js (custom GLSL shader) |
| Sidecar | Python, FastAPI, uvicorn, yt-dlp |
| Icons | Inline SVG |

## License

GPL v3
