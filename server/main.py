import os
from typing import Optional

import requests
import yt_dlp
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from yandex_music import Client

load_dotenv()

app = FastAPI(title='Music sidecar (anonymous)')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

# No authorization at all — anonymous Yandex client for search/charts only.
try:
    _client = Client().init()
except Exception:
    _client = None

# Read from .env (see .env.example) — no keys baked into source so this repo
# can be published as open source safely.
SOUNDCLOUD_CLIENT_ID = os.environ.get('SOUNDCLOUD_CLIENT_ID', '')
SOUNDCLOUD_API = 'https://api-v2.soundcloud.com'

# Simple in-process caches to make repeated lookups instant.
_sc_cache: dict = {}
_lyrics_cache: dict = {}
_stream_cache: dict = {}
_yt_search_cache: dict = {}


def cover_url(uri: Optional[str]) -> Optional[str]:
    return f'https://{uri.replace("%%", "400x400")}' if uri else None


def sc_upsize(url: Optional[str]) -> Optional[str]:
    """SoundCloud artwork/avatar URLs default to a ~100px '-large' variant;
    swap in the 500px one so covers aren't blurry in the fullscreen lyrics
    view and elsewhere."""
    if not url:
        return None
    return url.replace('-large.jpg', '-t500x500.jpg')


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
    }


@app.get('/api/status')
def status():
    return {'ok': True}


@app.get('/api/search')
def search(text: str):
    if _client is None:
        raise HTTPException(status_code=503, detail='Yandex Music client unavailable (no network?)')
    result = _client.search(text, type_='track')
    tracks = result.tracks.results if result.tracks else []
    return [serialize_track(t) for t in tracks[:30]]


@app.get('/api/trends')
def trends():
    if _client is None:
        raise HTTPException(status_code=503, detail='Yandex Music client unavailable (no network?)')
    chart = _client.chart()
    tracks = chart.chart.tracks if chart and chart.chart else []
    return [serialize_track(ct.track) for ct in tracks[:30]]


@app.get('/api/search/youtube')
def search_youtube(text: str):
    return yt_search(text, limit=20)


@app.get('/api/search/soundcloud')
def search_soundcloud(text: str):
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
            }
        )
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


def _yt_serialize(video_id: str, title: str, channel: str, thumbnail: Optional[str], duration: Optional[float]) -> dict:
    return {
        'id': f'youtube:{video_id}',
        'source': 'youtube',
        'title': title or 'Unknown',
        'artists': [channel or 'YouTube'],
        'cover': thumbnail,
        'duration': round(duration) if duration else None,
    }


def _yt_search_pytube(query: str, limit: int = 8) -> list:
    try:
        results = PytubeSearch(query).results
    except Exception:
        return []
    out = []
    for v in results[:limit]:
        try:
            video_id = v.video_id
            thumbnail = v.thumbnail_url
            # pytubefix Search results may not have duration
            duration = getattr(v, 'length', None)
            out.append(_yt_serialize(video_id, v.title, v.author, thumbnail, duration))
        except Exception:
            continue
    return out


def _yt_search_ytdlp(query: str, limit: int = 8) -> list:
    cache_key = f'{query.lower()}\x00{limit}'
    if cache_key in _yt_search_cache:
        return _yt_search_cache[cache_key]
    try:
        with yt_dlp.YoutubeDL(YTDLP_SEARCH_OPTS) as ydl:
            info = ydl.extract_info(f'ytsearch{limit}:{query}', download=False)
    except Exception:
        return []
    entries = (info or {}).get('entries') or []
    results = [_yt_serialize(
        e['id'],
        e.get('title'),
        e.get('uploader') or e.get('channel'),
        (e.get('thumbnails') or [{}])[-1].get('url') if e.get('thumbnails') else e.get('thumbnail'),
        e.get('duration'),
    ) for e in entries if e and e.get('id')]
    _yt_search_cache[cache_key] = results
    return results


def yt_search(query: str, limit: int = 8) -> list:
    if _has_pytubefix:
        results = _yt_search_pytube(query, limit)
        if results:
            return results
    return _yt_search_ytdlp(query, limit)


def _yt_resolve_stream_pytube(video_id: str) -> Optional[str]:
    try:
        yt = YouTube(f'https://www.youtube.com/watch?v={video_id}')
        stream = yt.streams.get_audio_only()
        if stream:
            return stream.url
    except Exception:
        return None
    return None


def _yt_resolve_stream_ytdlp(video_id: str) -> Optional[str]:
    try:
        with yt_dlp.YoutubeDL(YTDLP_STREAM_OPTS) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
        return (info or {}).get('url')
    except Exception:
        return None


def yt_resolve_stream(video_id: str) -> Optional[str]:
    if _has_pytubefix:
        url = _yt_resolve_stream_pytube(video_id)
        if url:
            return url
    return _yt_resolve_stream_ytdlp(video_id)


# --- SoundCloud playback -----------------------------------------------

SC_HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}


def sc_get(url: str, params: Optional[dict] = None) -> dict:
    p = dict(params or {})
    p['client_id'] = SOUNDCLOUD_CLIENT_ID
    r = requests.get(url, params=p, headers=SC_HEADERS, timeout=15)
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
def stream_resolve(source: str, native_id: str = '', title: str = '', artist: str = ''):
    """Cascading resolver: try the track's own source first, then fall back
    across the other two services. Always returns which source actually
    ended up playing, or a 404 if none of the three worked."""
    # Only successful resolutions are cached (see below) — a failure is often
    # transient (rate limit, blip), so every play attempt gets a real retry
    # instead of an instant repeat 404 for the rest of the sidecar's life.
    cache_key = f'{source}\x00{native_id}\x00{title}\x00{artist}'.lower()
    if cache_key in _stream_cache:
        return _stream_cache[cache_key]

    attempts = []
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
        except Exception:
            result = None
        if result and result.get('url'):
            payload = {'source': src, 'kind': result['kind'], 'url': result['url']}
            _stream_cache[cache_key] = payload
            return payload

    raise HTTPException(status_code=404, detail='Track not playable on any service (Yandex/YouTube/SoundCloud)')


# --- Synced lyrics via lrclib.net (free, no API key) --------------------

LRCLIB_HEADERS = {'User-Agent': 'yandex-music-clone (https://github.com/local/ymclone)'}


def _lrclib_search(params: dict) -> list:
    r = requests.get('https://lrclib.net/api/search', params=params, headers=LRCLIB_HEADERS, timeout=15)
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
