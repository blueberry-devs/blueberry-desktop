 # Sidecar service (no authorization)
 
 Everything runs anonymously — no login and no Yandex token.
 
 - **Search & charts** — anonymous `yandex-music-api` (Python-only).
 - **Playback** — SoundCloud `api-v2` (public `client_id`, resolves a stream URL
   by title/artist).
 - **Lyrics** — lrclib.net `/api/search` (free, no key, line-synced `.lrc`).
 - **Collection / likes** — stored entirely client-side in the renderer.
   The sidecar is not involved.
 
 Electron's main process ([src/main/index.ts](../src/main/index.ts)) spawns this
 service automatically. In development it runs via `python -m uvicorn main:app`;
 in production it runs a PyInstaller-built `music-server.exe` bundled into the
 app resources, requiring no Python runtime on the target machine.
 
 ## Setup
 
 ```
 cd server
 python -m venv .venv
 .venv\Scripts\activate
 pip install -r requirements.txt
 cp .env.example .env   # then fill in SOUNDCLOUD_CLIENT_ID
 ```
 
 No API keys are committed to source — everything comes from `.env` (loaded via
 `python-dotenv`, gitignored).
 
 ## Production build
 
 ```
 pip install pyinstaller
 python -m PyInstaller --noconfirm --onefile --name music-server --distpath ../build/packed-server main.py
 ```
 
 The output `music-server.exe` is a self-contained binary. It is automatically
 built by `npm run dist:win` and bundled into the Electron installer.
 
 ## SoundCloud
 
 Uses the undocumented `api-v2.soundcloud.com` endpoint with a public
 `client_id`, read from `SOUNDCLOUD_CLIENT_ID` in `.env`. Playback prefers a
 `progressive` (direct mp3) transcoding; otherwise falls back to `hls` (`.m3u8`)
 played via `hls.js`. Resolved streams are cached in-process.
 
 ## YouTube
 
 Via `yt-dlp` — no API key needed.
 
 ## Endpoints
 
 - `GET /api/status` — `{ ok: true }`
 - `GET /api/search?text=` — Yandex track search (charts/trends only)
 - `GET /api/trends` — Yandex global chart
 - `GET /api/search/soundcloud?text=` — SoundCloud track search
 - `GET /api/search/youtube?text=` — YouTube track search (via yt-dlp)
 - `GET /api/stream/resolve?source=&native_id=&title=&artist=` — cascading
   stream resolver (tries the native source first, then falls back across
   SoundCloud/YouTube)
 - `GET /api/sc/resolve?title=&artist=` — resolve a SoundCloud stream URL (cached)
 - `GET /api/lyrics/synced?title=&artist=&duration=` — `{ synced, plain }` from lrclib (cached)
