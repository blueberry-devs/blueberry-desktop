import { getProfile } from '../store/profile'

const BASE_URL = 'http://localhost:8787'
// The Tauri sidecar binds explicitly to IPv4 (127.0.0.1). Using this address
// avoids Windows resolving `localhost` to IPv6 first in the WebView.
const SIDECAR_URL = 'http://127.0.0.1:8787'

export type TrackSource = 'yandex' | 'youtube' | 'soundcloud'

export interface TrackResult {
  id: string
  source: TrackSource
  title: string
  artists: string[]
  cover: string | null
  artistCover?: string | null
  duration?: number
  explicit?: boolean
}

export interface ResolvedStream {
  source: TrackSource
  kind: 'progressive' | 'hls'
  url: string
}

export interface PlaylistResult {
  id: string
  source: TrackSource
  title: string
  owner: string
  cover: string | null
  trackCount: number
  description?: string
}

export interface SyncedLyricsResponse {
  synced: string | null
  plain: string | null
  /** Provider that produced the result: lrclib | netease | kugou | textyl | lyricsovh */
  provider?: string | null
}

export interface PaginatedTracks {
  tracks: TrackResult[]
  total: number
  offset: number
  hasMore: boolean
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`Request failed: ${path}`)
  return res.json()
}

// Single choke point for the "Разрешить контент 18+" setting — applied
// here so every track list (search, wave, charts) respects it automatically
// rather than depending on each call site to remember to filter.
function filterExplicit(tracks: TrackResult[]): TrackResult[] {
  if (getProfile().allowExplicit) return tracks
  return tracks.filter((t) => !t.explicit)
}

async function getTrackList(path: string): Promise<TrackResult[]> {
  const tracks = await getJson<TrackResult[]>(path)
  return filterExplicit(tracks)
}

export function searchTracksYandex(query: string): Promise<TrackResult[]> {
  return getTrackList(`/api/search?text=${encodeURIComponent(query)}`)
}

export function searchArtistTracks(artistName: string): Promise<TrackResult[]> {
  return getTrackList(`/api/artist/tracks?name=${encodeURIComponent(artistName)}`)
}

export function searchTracksSoundcloud(query: string): Promise<TrackResult[]> {
  return getTrackList(`/api/search/soundcloud?text=${encodeURIComponent(query)}`)
}

export function searchTracksYoutube(query: string): Promise<TrackResult[]> {
  return getTrackList(`/api/search/youtube?text=${encodeURIComponent(query)}`)
}

export function searchPlaylists(query: string): Promise<PlaylistResult[]> {
  return getJson(`/api/search/playlists?text=${encodeURIComponent(query)}`)
}

// Searches all selected sources (Yandex → SoundCloud → YouTube), deduped by
// title+artist. Each source handles its own failure gracefully.
// Pass `sources` to restrict which services are queried; defaults to all three.
export async function searchTracksMulti(
  query: string,
  sources?: TrackSource[]
): Promise<TrackResult[]> {
  const active = sources ?? ['yandex', 'soundcloud', 'youtube']
  const results = await Promise.all([
    active.includes('yandex') ? searchTracksYandex(query).catch(() => []) : [],
    active.includes('soundcloud') ? searchTracksSoundcloud(query).catch(() => []) : [],
    active.includes('youtube') ? searchTracksYoutube(query).catch(() => []) : []
  ])
  const seen = new Set<string>()
  const merged: TrackResult[] = []
  for (const t of results.flat()) {
    const sig = `${t.artists[0] ?? ''}::${t.title}`.toLowerCase()
    if (seen.has(sig)) continue
    seen.add(sig)
    merged.push(t)
  }
  return merged
}

export function getPlaylistTracks(playlistId: string, offset = 0, limit = 50): Promise<PaginatedTracks> {
  const params = new URLSearchParams({ playlist_id: playlistId, offset: String(offset), limit: String(limit) })
  return getJson(`/api/playlist/tracks?${params.toString()}`)
}

export function fetchTrends(): Promise<TrackResult[]> {
  return getTrackList('/api/trends')
}

export function fetchTrendsMonthly(): Promise<TrackResult[]> {
  return getTrackList('/api/trends/monthly')
}

function parseNativeId(trackId: string): { source: TrackSource; nativeId: string } {
  const [source, ...rest] = trackId.split(':')
  return { source: source as TrackSource, nativeId: rest.join(':') }
}

export function resolveStream(track: TrackResult, preferSource?: TrackSource): Promise<ResolvedStream> {
  const { source, nativeId } = parseNativeId(track.id)
  const params = new URLSearchParams({
    source,
    native_id: nativeId,
    title: track.title,
    artist: track.artists[0] ?? ''
  })
  if (preferSource) params.set('prefer', preferSource)
  return getJson(`/api/stream/resolve?${params.toString()}`)
}

export async function fetchVideoClip(title: string, artist: string): Promise<string | null> {
  const params = new URLSearchParams({ title, artist })
  const { url } = await getJson<{ url: string | null }>(`/api/video/clip?${params.toString()}`)
  return url
}

export async function fetchSyncedLyrics(
  title: string,
  artist: string,
  duration?: number
): Promise<SyncedLyricsResponse> {
  const params = new URLSearchParams({ title, artist })
  if (duration) params.set('duration', String(Math.round(duration)))
  const url = `${SIDECAR_URL}/api/lyrics/synced?${params.toString()}`
  console.info('[lyrics] request started', { title, artist, duration, url })

  // The sidecar is spawned asynchronously by Tauri. A track can start loading
  // before it has bound its port, so retry only transient connection/server
  // failures. A 404 is a valid, cacheable "not found" result.
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await fetch(url)
      console.info('[lyrics] response received', { attempt: attempt + 1, status: res.status, ok: res.ok })
      if (res.status === 404) {
        console.info('[lyrics] not found')
        return { synced: null, plain: null, provider: null }
      }
      if (res.ok) {
        const data = await res.json() as SyncedLyricsResponse
        console.info('[lyrics] response parsed', {
          provider: data.provider,
          syncedLength: data.synced?.length ?? 0,
          plainLength: data.plain?.length ?? 0
        })
        if (!data.synced?.trim() && !data.plain?.trim()) {
          console.warn('[lyrics] backend returned an empty success response')
          return { synced: null, plain: null, provider: null }
        }
        return data
      }
      if (res.status < 500) throw new Error(`Lyrics request failed: ${res.status}`)
      lastError = new Error(`Lyrics request failed: ${res.status}`)
    } catch (error) {
      lastError = error
      console.warn('[lyrics] request attempt failed', { attempt: attempt + 1, error })
    }
    console.info('[lyrics] retry scheduled', { nextAttempt: attempt + 2 })
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
  }
  console.error('[lyrics] request failed permanently', lastError)
  throw lastError instanceof Error ? lastError : new Error('Lyrics request failed')
}
