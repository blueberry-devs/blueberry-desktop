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
 python -m PyInstaller --noconfirm --onefile --name music-server --distpath ../build/packed-server ^
   --collect-data certifi --collect-all yandex_music --collect-all yt_dlp --collect-all pytubefix main.py
 ```
 
 (See [scripts/build-server.bat](../scripts/build-server.bat) for the exact
 command — the `--collect-*` flags matter: without them the frozen exe is
 missing certifi's CA bundle and fails TLS verification on every HTTPS call,
 even though the same code works fine via `python -m uvicorn`.)
 
 The output `music-server.exe` is a self-contained binary. It is automatically
 built by `npm run dist:win` and bundled into the Electron installer.
 
 ## Yandex geo-block (451)
 
 Yandex's catalog (search/charts) is only served to Russian IPs — anonymous
 requests from elsewhere get a hard `451 Unavailable For Legal Reasons` on
 every call, `chart()` included. This is enforced by Yandex itself; there's no
 header or client-side fix for it. `/api/search` and `/api/trends` catch this
 and return an empty list rather than a 500, so it degrades instead of
 crashing the UI — but if you actually need charts to work from outside
 Russia, set `YANDEX_PROXY_URL` in `.env` to an HTTP/SOCKS proxy with a
 Russian exit IP; the `yandex-music` client routes through it natively.
 
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
