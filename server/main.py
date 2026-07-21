import logging
import os
import sys
from typing import Optional
from urllib.parse import quote

import certifi

# When frozen by PyInstaller, requests/urllib3 (and anything else reading
# these standard env vars) can fail to locate a CA bundle even though
# certifi's cacert.pem is bundled as data (see --collect-data certifi in
# scripts/build-server.bat) — pin them explicitly so HTTPS calls don't
# silently fail TLS verification in the packaged exe while working fine in
# a normal dev Python install.
if getattr(sys, 'frozen', False):
    os.environ.setdefault('SSL_CERT_FILE', certifi.where())
    os.environ.setdefault('REQUESTS_CA_BUNDLE', certifi.where())

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import yt_dlp
from cachetools import TTLCache

# Shared session with automatic retry on 429 Rate Limited responses.
# Exponential backoff: 1s, 2s, 4s between retries, max 3 attempts total.
_session = requests.Session()
_session.mount('https://', HTTPAdapter(max_retries=Retry(total=3, status_forcelist=[429], backoff_factor=1, raise_on_status=False)))
_session.mount('http://', HTTPAdapter(max_retries=Retry(total=3, status_forcelist=[429], backoff_factor=1, raise_on_status=False)))

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from yandex_music import Client
from yandex_music.exceptions import YandexMusicError
from yandex_music.utils.request import Request as YandexRequest

load_dotenv()

logging.basicConfig(level=logging.INFO, format='[%(name)s] %(message)s')
logger = logging.getLogger('sidecar')

app = FastAPI(title='Music sidecar (anonymous)')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

# No authorization at all — anonymous Yandex client for search/charts only.
#
# Yandex geo-restricts its catalog: anonymous requests from outside Russia
# get a hard 451 "Unavailable For Legal Reasons" on every call, chart()
# included — enforced server-side by Yandex, no client-side header/cert fix
# works around it. If you're hitting that, set YANDEX_PROXY_URL (see
# .env.example) to an HTTP/SOCKS proxy with a Russian exit IP; the
# yandex-music library routes through one natively.
_YANDEX_PROXY_URL = os.environ.get('YANDEX_PROXY_URL') or None
try:
    _client = Client(request=YandexRequest(proxy_url=_YANDEX_PROXY_URL)).init()
except Exception:
    _client = None

# Read from .env (see .env.example) — no keys baked into source so this repo
# can be published as open source safely.
SOUNDCLOUD_CLIENT_ID = os.environ.get('SOUNDCLOUD_CLIENT_ID', '')
SOUNDCLOUD_API = 'https://api-v2.soundcloud.com'

# Simple in-process caches to make repeated lookups instant. Bounded (TTLCache)
# so a long-running sidecar process doesn't grow these dicts unboundedly —
# resolved stream URLs also expire upstream, so a TTL keeps entries fresh.
_sc_cache: dict = TTLCache(maxsize=1000, ttl=3600)
_lyrics_cache: dict = TTLCache(maxsize=2000, ttl=6 * 3600)
_stream_cache: dict = TTLCache(maxsize=1000, ttl=1800)
_yt_search_cache: dict = TTLCache(maxsize=1000, ttl=3600)
_yt_playlist_search_cache: dict = TTLCache(maxsize=500, ttl=3600)


def cover_url(uri: Optional[str]) -> Optional[str]:
    return f'https://{uri.replace("%%", "400x400")}' if uri else None


def sc_upsize(url: Optional[str]) -> Optional[str]:
    """SoundCloud artwork/avatar URLs default to a ~100px '-large' variant;
    swap in the 500px one so covers aren't blurry in the fullscreen lyrics
    view and elsewhere."""
    if not url:
        return None
    return url.replace('-large.jpg', '-t500x500.jpg')


def serialize_playlist(pid: str, source: str, title: str, owner: str,
                       cover: Optional[str], track_count: int,
                       description: str = '') -> dict:
    return {
        'id': f'{source}:{pid}',
        'source': source,
        'title': title,
        'owner': owner,
        'cover': cover,
        'trackCount': track_count,
        'description': description,
    }


def track_id(t) -> str:
    return f'yandex:{t.id}:{t.albums[0].id}' if t.albums else f'yandex:{t.id}'


def serialize_track(t):
    return {
        'id': track_id(t),
        'source': 'yandex',
        'title': t.title,
        'artists': [a.name for a in t.artists],
        'cover': cover_url(t.cover_uri),
        'duration': round((t.duration_ms or 0) / 1000),
        'explicit': bool(getattr(t, 'explicit', False)),
    }


@app.get('/api/status')
def status():
    return {'ok': True}


@app.get('/api/search')
def search(text: str):
    cache_key = text.lower()
    cached = _yandex_search_cache.get(cache_key)
    if cached is not None:
        return cached
    if _client is None:
        raise HTTPException(status_code=503, detail='Yandex Music client unavailable (no network?)')
    try:
        result = _client.search(text, type_='track')
    except YandexMusicError as exc:
        # Most commonly a 451 geo-block (see _client comment above) — surface
        # empty results instead of a raw 500 so the UI can just show nothing
        # found rather than an error screen.
        logger.warning('yandex search failed: %s', exc)
        return []
    tracks = result.tracks.results if result.tracks else []
    out = [serialize_track(t) for t in tracks[:30]]
    _yandex_search_cache[cache_key] = out
    return out


@app.get('/api/trends')
def trends():
    cached = _trends_cache.get('default')
    if cached is not None:
        return cached
    if _client is None:
        raise HTTPException(status_code=503, detail='Yandex Music client unavailable (no network?)')
    try:
        chart = _client.chart()
    except YandexMusicError as exc:
        logger.warning('yandex chart failed: %s', exc)
        return []
    tracks = chart.chart.tracks if chart and chart.chart else []
    out = [serialize_track(ct.track) for ct in tracks[:30]]
    _trends_cache['default'] = out
    return out


@app.get('/api/search/youtube')
def search_youtube(text: str):
    return yt_search(text, limit=20)


_sc_search_cache: dict = TTLCache(maxsize=1000, ttl=3600)
_pl_tracks_cache: dict = TTLCache(maxsize=500, ttl=600)
_yandex_search_cache: dict = TTLCache(maxsize=1000, ttl=3600)
_trends_cache: dict = TTLCache(maxsize=50, ttl=600)
_pl_search_cache: dict = TTLCache(maxsize=500, ttl=3600)


@app.get('/api/playlist/tracks')
def playlist_tracks(playlist_id: str, offset: int = 0, limit: int = 50):
    """Fetch paginated tracks for a Yandex Music playlist."""
    if not playlist_id.startswith('yandex:'):
        raise HTTPException(status_code=400, detail='Only Yandex playlists supported')
    parts = playlist_id.split(':', 2)
    if len(parts) < 3:
        raise HTTPException(status_code=400, detail='Invalid playlist ID, expected yandex:{uid}:{kind}')
    uid, kind = parts[1], parts[2]
    if _client is None:
        raise HTTPException(status_code=503, detail='Yandex Music client unavailable')
    cache_key = playlist_id
    all_tracks = _pl_tracks_cache.get(cache_key)
    if all_tracks is None:
        try:
            playlist = _client.users_playlists(kind=int(kind), user_id=uid)
        except YandexMusicError as exc:
            logger.warning('failed to fetch playlist tracks: %s', exc)
            raise HTTPException(status_code=404, detail='Playlist not found')
        if not playlist:
            raise HTTPException(status_code=404, detail='Playlist not found')
        try:
            short_tracks = playlist.fetch_tracks()
        except YandexMusicError as exc:
            logger.warning('failed to fetch playlist track details: %s', exc)
            raise HTTPException(status_code=502, detail='Failed to fetch track details')
        all_tracks = []
        for st in short_tracks:
            if st and st.track:
                try:
                    all_tracks.append(serialize_track(st.track))
                except Exception as exc:
                    logger.warning('skipping unparseable playlist track: %s', exc)
        _pl_tracks_cache[cache_key] = all_tracks
    total = len(all_tracks)
    page = all_tracks[offset:offset + limit]
    return {
        'tracks': page,
        'total': total,
        'offset': offset,
        'hasMore': (offset + limit) < total,
    }


@app.get('/api/search/playlists')
def search_playlists(text: str):
    """Search playlists across Yandex Music, SoundCloud, and YouTube."""
    cache_key = text.lower()
    cached = _pl_search_cache.get(cache_key)
    if cached is not None:
        return cached
    results = []
    # Yandex Music playlist search
    if _client is not None:
        try:
            yandex_result = _client.search(text, type_='playlist')
            if yandex_result and yandex_result.playlists:
                for pl in yandex_result.playlists.results[:10]:
                    cover = None
                    if hasattr(pl, 'cover') and pl.cover:
                        cover = cover_url(getattr(pl.cover, 'uri', None))
                    owner_name = pl.owner.name if pl.owner else 'Яндекс'
                    results.append(serialize_playlist(
                        pid=str(pl.owner.uid) + ':' + str(pl.kind) if pl.owner else str(pl.kind),
                        source='yandex',
                        title=pl.title,
                        owner=owner_name,
                        cover=cover,
                        track_count=pl.track_count,
                    ))
        except YandexMusicError as exc:
            logger.warning('yandex playlist search failed: %s', exc)
    # SoundCloud playlist search
    try:
        data = sc_get(f'{SOUNDCLOUD_API}/search/playlists', {'q': text, 'limit': 10})
        for pl in (data.get('collection') or []):
            if pl.get('kind') != 'playlist' or pl.get('policy') == 'BLOCK':
                continue
            user = pl.get('user') or {}
            results.append(serialize_playlist(
                pid=str(pl['id']),
                source='soundcloud',
                title=pl.get('title') or 'Unknown',
                owner=user.get('username') or 'SoundCloud',
                cover=sc_upsize(pl.get('artwork_url')),
                track_count=pl.get('track_count', 0),
                description=pl.get('description') or '',
            ))
    except requests.RequestException as exc:
        logger.warning('soundcloud playlist search failed: %s', exc)
    # YouTube playlist search
    try:
        results.extend(yt_search_playlists(text, limit=5))
    except Exception as exc:
        logger.warning('youtube playlist search failed: %s', exc)
    _pl_search_cache[cache_key] = results
    return results


@app.get('/api/search/soundcloud')
def search_soundcloud(text: str):
    cache_key = text.lower()
    if cache_key in _sc_search_cache:
        return _sc_search_cache[cache_key]
    try:
        data = sc_get(f'{SOUNDCLOUD_API}/search/tracks', {'q': text, 'limit': 30})
    except requests.RequestException:
        return []
    results = []
    for t in data.get('collection') or []:
        if t.get('kind') != 'track' or t.get('policy') == 'BLOCK':
            continue
        user = t.get('user') or {}
        results.append(
            {
                'id': f'soundcloud:{t["id"]}',
                'source': 'soundcloud',
                'title': t.get('title') or 'Unknown',
                'artists': [user.get('username') or 'SoundCloud'],
                'cover': sc_upsize(t.get('artwork_url')),
                'artistCover': sc_upsize(user.get('avatar_url')),
                'duration': round((t.get('duration') or 0) / 1000) if t.get('duration') else None,
                'explicit': bool((t.get('publisher_metadata') or {}).get('explicit')),
            }
        )
    _sc_search_cache[cache_key] = results
    return results


# --- YouTube (via pytubefix + yt-dlp fallback) ---------------------------

try:
    from pytubefix import YouTube, Search as PytubeSearch
    _has_pytubefix = True
except ImportError:
    _has_pytubefix = False
    print('[yt] pytubefix not installed, falling back to yt-dlp', flush=True)

YTDLP_SEARCH_OPTS = {
    'quiet': True,
    'no_warnings': True,
    'extract_flat': 'in_playlist',
    'skip_download': True,
    'default_search': 'ytsearch',
}

YTDLP_STREAM_OPTS = {
    'quiet': True,
    'no_warnings': True,
    'skip_download': True,
    'format': 'bestaudio/best',
    'noplaylist': True,
}


def _yt_serialize(
    video_id: str,
    title: str,
    channel: str,
    thumbnail: Optional[str],
    duration: Optional[float],
    explicit: bool = False,
) -> dict:
    return {
        'id': f'youtube:{video_id}',
        'source': 'youtube',
        'title': title or 'Unknown',
        'artists': [channel or 'YouTube'],
        'cover': thumbnail,
        'duration': round(duration) if duration else None,
        'explicit': explicit,
    }


def _yt_search_pytube(query: str, limit: int = 8) -> list:
    try:
        results = PytubeSearch(query).results
    except Exception as exc:
        logger.warning('pytubefix search failed for %r: %s', query, exc)
        return []
    out = []
    for v in results[:limit]:
        try:
            video_id = v.video_id
            thumbnail = v.thumbnail_url
            # pytubefix Search results may not have duration
            duration = getattr(v, 'length', None)
            # pytubefix doesn't expose an explicit/age-restriction flag on
            # search results — best effort only, not a reliable signal.
            explicit = bool(getattr(v, 'age_restricted', False))
            out.append(_yt_serialize(video_id, v.title, v.author, thumbnail, duration, explicit))
        except Exception as exc:
            logger.warning('pytubefix search result skipped: %s', exc)
            continue
    return out


def _yt_search_ytdlp(query: str, limit: int = 8) -> list:
    cache_key = f'{query.lower()}\x00{limit}'
    if cache_key in _yt_search_cache:
        return _yt_search_cache[cache_key]
    try:
        with yt_dlp.YoutubeDL(YTDLP_SEARCH_OPTS) as ydl:
            info = ydl.extract_info(f'ytsearch{limit}:{query}', download=False)
    except Exception as exc:
        logger.warning('yt-dlp search failed for %r: %s', query, exc)
        return []
    entries = (info or {}).get('entries') or []
    # yt-dlp's flat search entries only carry age_limit when set — 18 is
    # yt-dlp's own convention for age-restricted content, the closest
    # available signal to "explicit" for YouTube.
    results = [_yt_serialize(
        e['id'],
        e.get('title'),
        e.get('uploader') or e.get('channel'),
        (e.get('thumbnails') or [{}])[-1].get('url') if e.get('thumbnails') else e.get('thumbnail'),
        e.get('duration'),
        (e.get('age_limit') or 0) >= 18,
    ) for e in entries if e and e.get('id')]
    _yt_search_cache[cache_key] = results
    return results


def yt_search(query: str, limit: int = 8) -> list:
    # "Моя волна" reuses the same handful of genre/artist queries constantly
    # (genre picks, refills, rotating through liked artists) — caching here
    # means only the first hit for a given query pays pytube/yt-dlp's
    # network latency, everything after is instant.
    cache_key = f'{query.lower()}\x00{limit}'
    if cache_key in _yt_search_cache:
        return _yt_search_cache[cache_key]
    # yt-dlp first (fast, ~3-10s), pytubefix fallback (can be 30s+)
    results = _yt_search_ytdlp(query, limit)
    if not results and _has_pytubefix:
        results = _yt_search_pytube(query, limit)
    _yt_search_cache[cache_key] = results
    return results


def yt_search_playlists(query: str, limit: int = 10) -> list:
    """Search YouTube for playlists via yt-dlp on the playlist-filtered search page."""
    cache_key = f'{query.lower()}\x00{limit}'
    if cache_key in _yt_playlist_search_cache:
        return _yt_playlist_search_cache[cache_key]
    try:
        with yt_dlp.YoutubeDL({**YTDLP_SEARCH_OPTS, 'extract_flat': 'in_playlist'}) as ydl:
            url = f'https://www.youtube.com/results?search_query={quote(query)}&sp=EgIQAw%3D%3D'
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        logger.warning('yt playlist search failed for %r: %s', query, exc)
        return []
    entries = (info or {}).get('entries') or []
    results = []
    for e in entries[:limit]:
        if not e or not e.get('id') or not e.get('title'):
            continue
        eid = e['id']
        # Playlist IDs start with PL and are longer than video IDs (11 chars).
        if len(eid) == 11:
            continue
        results.append(serialize_playlist(
            pid=eid,
            source='youtube',
            title=e.get('title') or 'Unknown',
            owner=e.get('uploader') or e.get('channel') or 'YouTube',
            cover=(e.get('thumbnails') or [{}])[-1].get('url') if e.get('thumbnails') else e.get('thumbnail'),
            track_count=e.get('playlist_count') or e.get('n_entries') or 0,
            description=e.get('description') or '',
        ))
    _yt_playlist_search_cache[cache_key] = results
    return results


def _yt_resolve_stream_pytube(video_id: str) -> Optional[str]:
    try:
        yt = YouTube(f'https://www.youtube.com/watch?v={video_id}')
        stream = yt.streams.get_audio_only()
        if stream:
            return stream.url
    except Exception as exc:
        logger.warning('pytubefix stream resolve failed for %s: %s', video_id, exc)
        return None
    return None


def _yt_resolve_stream_ytdlp(video_id: str) -> Optional[str]:
    try:
        with yt_dlp.YoutubeDL(YTDLP_STREAM_OPTS) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
        return (info or {}).get('url')
    except Exception as exc:
        logger.warning('yt-dlp stream resolve failed for %s: %s', video_id, exc)
        return None


def yt_resolve_stream(video_id: str) -> Optional[str]:
    # pytubefix first (faster direct URL), yt-dlp fallback if it fails
    if _has_pytubefix:
        url = _yt_resolve_stream_pytube(video_id)
        if url:
            return url
    return _yt_resolve_stream_ytdlp(video_id)


# --- Background video clip (fullscreen player) --------------------------
_YT_BASE_OPTS = {
    'quiet': True,
    'no_warnings': True,
    'skip_download': True,
    'noplaylist': True,
    'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
}


def _yt_extract(url: str, **extra_opts):
    """Try yt-dlp extract; fall back to cookiesfrombrowser on bot detection."""
    for attempt in range(3):
        opts = dict(_YT_BASE_OPTS, **extra_opts)
        if attempt >= 1:
            for browser in ('chrome', 'edge', 'brave', 'opera', 'firefox'):
                try:
                    opts['cookiesfrombrowser'] = (browser,)
                    with yt_dlp.YoutubeDL(opts) as ydl:
                        return ydl.extract_info(url, download=False)
                except Exception:
                    continue
            raise RuntimeError('All browser cookie extraction attempts failed')
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                return ydl.extract_info(url, download=False)
        except Exception as exc:
            msg = str(exc)
            if 'Sign in to confirm' in msg or 'bot' in msg.lower():
                logger.info('[yt-dlp] Bot detection, retrying with cookies (%d)', attempt + 1)
                continue
            raise
    raise RuntimeError('yt-dlp extraction failed after retries')

_clip_cache: dict = TTLCache(maxsize=1000, ttl=6 * 3600)


@app.get('/api/video/clip')
def video_clip(title: str, artist: str = '', request: Request = None):
    cache_key = f'{artist.lower()}\x00{title.lower()}'
    if cache_key in _clip_cache:
        return {'url': _clip_cache[cache_key]}

    # Dev test: local numb.mp4 for Linkin Park - Numb
    _is_numb_test = (
        'linkin park' in artist.lower() and 'numb' in title.lower()
    )
    if _is_numb_test:
        _probe = os.path.join(os.getcwd(), os.pardir, 'resources', 'numb.mp4')
        _probe = os.path.abspath(_probe)
        if os.path.exists(_probe):
            import pathlib
            url = pathlib.Path(_probe).as_uri()
            logger.info('[100%%] Using local test video: %s', url)
            _clip_cache[cache_key] = url
            return {'url': url}

    queries = [f'ytsearch5:{artist} {title}'.strip()]
    if artist:
        queries.append(f'ytsearch5:{artist} {title} official video'.strip())
    queries.append(f'ytsearch5:{title}'.strip())

    video_id = None
    for query in queries:
        logger.info('[25%%] Searching YouTube for clip: %s', query)
        try:
            search_info = _yt_extract(query, extract_flat=True)
            entries = (search_info or {}).get('entries') or []
            logger.info('[50%%] Found %d results', len(entries))
            video_id = entries[0]['id'] if entries else None
            if video_id:
                logger.info('[100%%] Found video ID: %s', video_id)
                break
        except Exception as exc:
            logger.warning('clip query %r failed: %s', query, exc)
            continue

    if not video_id:
        logger.info('[100%%] No video found for %s - %s', artist, title)
        _clip_cache[cache_key] = None
        return {'url': None}

    base = str(request.base_url).rstrip('/') if request else 'http://localhost:8787'
    proxy_url = f'{base}/api/video/stream/{video_id}'
    _clip_cache[cache_key] = proxy_url
    logger.info('[100%%] Proxy URL: %s', proxy_url)
    return {'url': proxy_url}


@app.get('/api/video/stream/{video_id}')
def video_stream(video_id: str, request: Request):
    if not video_id:
        raise HTTPException(400, 'video_id required')

    logger.info('[video_stream] Resolving stream for %s', video_id)
    stream_url = None
    yt_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
    }

    # pytubefix first — direct URL, no extraction overhead
    if _has_pytubefix:
        try:
            yt = YouTube(f'https://www.youtube.com/watch?v={video_id}')
            stream = yt.streams.filter(adaptive=True, file_extension='mp4').order_by('resolution').desc().first()
            if stream and stream.url:
                stream_url = stream.url
                logger.info('[video_stream] resolved via pytubefix')
        except Exception as exc:
            logger.warning('pytubefix stream resolve failed for %s: %s', video_id, exc)

    # yt-dlp fallback if pytubefix didn't work
    if not stream_url:
        try:
            info = _yt_extract(
                f'https://www.youtube.com/watch?v={video_id}',
                format='best[height<=720][acodec=none]/best[height<=720][ext=mp4]/best[height<=720]/best',
            )
            stream_url = (info or {}).get('url')
        except Exception as exc:
            logger.warning('yt-dlp stream resolve failed for %s: %s', video_id, exc)
            raise HTTPException(502, f'Stream resolution failed: {exc}')

    if not stream_url:
        raise HTTPException(502, 'Failed to resolve stream URL')

    range_header = request.headers.get('range')
    if range_header:
        yt_headers['Range'] = range_header

    try:
        r = requests.get(stream_url, headers=yt_headers, stream=True, timeout=30)
        r.raise_for_status()

        resp_headers = {}
        for key in ('content-type', 'content-length', 'content-range', 'accept-ranges'):
            val = r.headers.get(key)
            if val:
                resp_headers[key] = val

        return StreamingResponse(
            r.iter_content(chunk_size=65536),
            status_code=r.status_code,
            headers=resp_headers,
        )
    except requests.RequestException as exc:
        logger.warning('stream proxy failed for %s: %s', video_id, exc)
        raise HTTPException(502, f'Stream proxy failed: {exc}')


# --- Artist splash images ----------------------------------------------

def _find_artist_images_dir():
    _cwd = os.getcwd()
    candidates = [
        os.path.join(_cwd, os.pardir, 'artists'),               # prod: resources/server/ -> artists/
        os.path.join(_cwd, os.pardir, 'resources', 'artists'),  # dev:  server/ -> resources/artists/
        os.path.join(_cwd, 'artists'),                          # artists/ next to cwd
    ]
    for p in candidates:
        absp = os.path.abspath(p)
        if os.path.isdir(absp):
            return absp
    return os.path.abspath(candidates[0])

_ARTIST_IMAGES_DIR = _find_artist_images_dir()


@app.get('/api/artist-image/{name}')
def artist_image(name: str):
    safe = name.lower().replace(' ', '-')
    path = os.path.join(_ARTIST_IMAGES_DIR, f'{safe}.png')
    path = os.path.abspath(path)
    if not os.path.exists(path):
        raise HTTPException(404)
    return FileResponse(path, media_type='image/png')


# --- Artist photo via Deezer public API --------------------------------

_artist_photo_cache: dict = TTLCache(maxsize=500, ttl=86400)


@app.get('/api/artist-photo')
def artist_photo(name: str):
    cached = _artist_photo_cache.get(name.lower())
    if cached:
        return {'url': cached}

    try:
        r = _session.get(
            'https://api.deezer.com/search/artist',
            params={'q': name, 'limit': 1, 'index': 0},
            timeout=10,
        )
        data = r.json()
        artists = data.get('data') or []
        if artists:
            url = artists[0].get('picture_xl') or artists[0].get('picture_big') or artists[0].get('picture_medium')
            if url:
                _artist_photo_cache[name.lower()] = url
                return {'url': url}
    except Exception as exc:
        logger.warning('artist photo lookup failed for %r: %s', name, exc)

    _artist_photo_cache[name.lower()] = None
    return {'url': None}


# --- SoundCloud playback -----------------------------------------------

SC_HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}


def sc_get(url: str, params: Optional[dict] = None) -> dict:
    p = dict(params or {})
    p['client_id'] = SOUNDCLOUD_CLIENT_ID
    r = _session.get(url, params=p, headers=SC_HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()


def sc_resolve_transcoding(track: dict) -> Optional[dict]:
    """Return {kind, url} for the first playable transcoding of a track, or None."""
    if track.get('policy') == 'BLOCK':
        return None
    transcodings = (track.get('media') or {}).get('transcodings') or []
    progressive = next(
        (t for t in transcodings if (t.get('format') or {}).get('protocol') == 'progressive'), None
    )
    hls = next((t for t in transcodings if (t.get('format') or {}).get('protocol') == 'hls'), None)
    chosen = progressive or hls
    if not chosen:
        return None
    try:
        stream_meta = sc_get(chosen['url'])
    except requests.RequestException:
        return None
    url = stream_meta.get('url')
    if not url:
        return None
    return {'kind': 'progressive' if chosen is progressive else 'hls', 'url': url}


@app.get('/api/sc/resolve')
def sc_resolve(title: str, artist: str):
    cache_key = f'{artist}\x00{title}'.lower()
    if cache_key in _sc_cache:
        return _sc_cache[cache_key]

    queries = [q for q in (f'{artist} {title}'.strip(), title.strip(), artist.strip()) if q]
    seen = set()
    tracks: list = []
    for query in queries:
        if query in seen:
            continue
        seen.add(query)
        try:
            data = sc_get(f'{SOUNDCLOUD_API}/search/tracks', {'q': query, 'limit': 15})
        except requests.RequestException as exc:
            raise HTTPException(status_code=502, detail=f'SoundCloud search failed: {exc}')
        found = [t for t in (data.get('collection') or []) if t.get('kind') == 'track']
        tracks.extend(found)
        if found:
            break

    if not tracks:
        raise HTTPException(status_code=404, detail='No SoundCloud match found')

    for track in tracks:
        resolved = sc_resolve_transcoding(track)
        if resolved:
            payload = {
                'kind': resolved['kind'],
                'url': resolved['url'],
                'title': track.get('title'),
                'artist': (track.get('user') or {}).get('username'),
                'artwork': sc_upsize(track.get('artwork_url')),
                'permalink': track.get('permalink_url'),
            }
            _sc_cache[cache_key] = payload
            return payload

    raise HTTPException(status_code=404, detail='No playable SoundCloud stream found')


def sc_resolve_by_id(sc_id: str) -> Optional[dict]:
    try:
        track = sc_get(f'{SOUNDCLOUD_API}/tracks/{sc_id}')
    except requests.RequestException:
        return None
    resolved = sc_resolve_transcoding(track)
    if not resolved:
        return None
    return {'kind': resolved['kind'], 'url': resolved['url']}


def sc_resolve_by_query(title: str, artist: str) -> Optional[dict]:
    queries = [q for q in (f'{artist} {title}'.strip(), title.strip()) if q]
    for query in queries:
        try:
            data = sc_get(f'{SOUNDCLOUD_API}/search/tracks', {'q': query, 'limit': 10})
        except requests.RequestException:
            continue
        for t in data.get('collection') or []:
            if t.get('kind') != 'track':
                continue
            resolved = sc_resolve_transcoding(t)
            if resolved:
                return {'kind': resolved['kind'], 'url': resolved['url']}
    return None


def yt_resolve_by_query(title: str, artist: str) -> Optional[str]:
    query = f'{artist} {title}'.strip()
    candidates = yt_search(query, limit=3)
    for c in candidates:
        video_id = c['id'].split(':', 1)[1]
        url = yt_resolve_stream(video_id)
        if url:
            return url
    return None


@app.get('/api/stream/resolve')
def stream_resolve(source: str, native_id: str = '', title: str = '', artist: str = '', prefer: str = ''):
    """Cascading resolver: try the track's own source first, then fall back
    across the other two services. Always returns which source actually
    ended up playing, or a 404 if none of the three worked.

    `prefer` lets the caller force a specific service to be tried first
    (manual source override from the UI) — the rest of the cascade still
    runs as a fallback if the preferred one has no match."""
    cache_key = f'{source}\x00{native_id}\x00{title}\x00{artist}\x00{prefer}'.lower()
    # Only successful resolutions are cached (see below) — a failure is often
    # transient (rate limit, blip), so every play attempt gets a real retry
    # instead of an instant repeat 404 for the rest of the sidecar's life.
    if cache_key in _stream_cache:
        return _stream_cache[cache_key]

    attempts = []
    if prefer == 'soundcloud':
        attempts.append(('soundcloud', lambda: sc_resolve_by_query(title, artist)))
    elif prefer == 'youtube':
        attempts.append(('youtube', lambda: ({'kind': 'progressive', 'url': u} if (u := yt_resolve_by_query(title, artist)) else None)))
    if source == 'soundcloud' and native_id:
        attempts.append(('soundcloud', lambda: sc_resolve_by_id(native_id)))
    if source == 'youtube' and native_id:
        attempts.append(('youtube', lambda: ({'kind': 'progressive', 'url': u} if (u := yt_resolve_stream(native_id)) else None)))
    # Fallback chain regardless of native source.
    attempts.append(('soundcloud', lambda: sc_resolve_by_query(title, artist)))
    attempts.append(('youtube', lambda: ({'kind': 'progressive', 'url': u} if (u := yt_resolve_by_query(title, artist)) else None)))

    seen_sources = set()
    for src, fn in attempts:
        if src in seen_sources:
            continue
        seen_sources.add(src)
        try:
            result = fn()
        except Exception as exc:
            logger.warning('stream resolve attempt via %s failed for %r/%r: %s', src, title, artist, exc)
            result = None
        if result and result.get('url'):
            payload = {'source': src, 'kind': result['kind'], 'url': result['url']}
            _stream_cache[cache_key] = payload
            return payload

    raise HTTPException(status_code=404, detail='Track not playable on any service (Yandex/YouTube/SoundCloud)')


# --- Synced lyrics via lrclib.net (free, no API key) --------------------

LRCLIB_HEADERS = {'User-Agent': 'yandex-music-clone (https://github.com/local/ymclone)'}


def _lrclib_search(params: dict) -> list:
    r = _session.get('https://lrclib.net/api/search', params=params, headers=LRCLIB_HEADERS, timeout=15)
    if r.status_code == 404:
        return []
    r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else []


def _synced_line_count(entry: dict) -> int:
    synced = entry.get('syncedLyrics') or ''
    return sum(1 for line in synced.splitlines() if line.strip().startswith('['))


def _synced_first_ts(entry: dict) -> float:
    """Timestamp (seconds) of the first synced line; large number if none."""
    for line in (entry.get('syncedLyrics') or '').splitlines():
        line = line.strip()
        if line.startswith('[') and ']' in line:
            stamp = line[1:line.index(']')]
            try:
                mm, ss = stamp.split(':')
                return int(mm) * 60 + float(ss)
            except ValueError:
                continue
    return 10_000.0


def _pick_best(results: list, duration: Optional[float]) -> Optional[dict]:
    if not results:
        return None
    synced = [d for d in results if d.get('syncedLyrics')]
    if synced:
        # Prefer the most complete transcription (most lines), then the one that
        # starts earliest (so we don't get a version missing the first verse),
        # then the closest duration.
        def key(d):
            dur_gap = abs((d.get('duration') or 0) - duration) if duration else 0
            return (-_synced_line_count(d), _synced_first_ts(d), dur_gap)

        return sorted(synced, key=key)[0]

    # No synced lyrics at all — fall back to the closest plain-lyrics entry.
    pool = [d for d in results if d.get('plainLyrics')] or results
    if duration:
        pool = sorted(pool, key=lambda d: abs((d.get('duration') or 0) - duration))
    return pool[0]


@app.get('/api/lyrics/synced')
def lyrics_synced(title: str, artist: str, duration: Optional[float] = None):
    cache_key = f'{artist}\x00{title}'.lower()
    if cache_key in _lyrics_cache:
        return _lyrics_cache[cache_key]

    try:
        results = _lrclib_search({'track_name': title, 'artist_name': artist})
        if not results:
            results = _lrclib_search({'q': f'{artist} {title}'.strip()})
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f'lrclib request failed: {exc}')

    best = _pick_best(results, duration)
    if best is None:
        raise HTTPException(status_code=404, detail='Lyrics not found')

    payload = {'synced': best.get('syncedLyrics'), 'plain': best.get('plainLyrics')}
    _lyrics_cache[cache_key] = payload
    return payload

if __name__ == '__main__':
    import uvicorn
    import sys
    port = int(os.environ.get('SIDECAR_PORT', '8787'))
    print(f'[sidecar] starting on http://127.0.0.1:{port}', flush=True)
    uvicorn.run(app, host='127.0.0.1', port=port, log_level='info')
