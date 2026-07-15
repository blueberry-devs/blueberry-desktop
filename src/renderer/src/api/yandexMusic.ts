const BASE_URL = 'http://localhost:8787'

export type TrackSource = 'yandex' | 'youtube' | 'soundcloud'

export interface TrackResult {
  id: string
  source: TrackSource
  title: string
  artists: string[]
  cover: string | null
  artistCover?: string | null
  duration?: number
}

export interface ResolvedStream {
  source: TrackSource
  kind: 'progressive' | 'hls'
  url: string
}

export interface SyncedLyricsResponse {
  synced: string | null
  plain: string | null
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`Request failed: ${path}`)
  return res.json()
}

// Track search (SearchView, Моя волна, genre topics) goes through SoundCloud
// + YouTube (see searchTracksMulti below); the plain Yandex `/api/search` is
// reserved server-side for charts/trends only, nothing here calls it.
export function searchTracksSoundcloud(query: string): Promise<TrackResult[]> {
  return getJson(`/api/search/soundcloud?text=${encodeURIComponent(query)}`)
}

export function searchTracksYoutube(query: string): Promise<TrackResult[]> {
  return getJson(`/api/search/youtube?text=${encodeURIComponent(query)}`)
}

// Merges SoundCloud + YouTube results, interleaved so neither source
// dominates the top of the list. Either source failing (network hiccup,
// yt-dlp unavailable) just falls back to whatever the other one found.
export async function searchTracksMulti(query: string): Promise<TrackResult[]> {
  const [sc, yt] = await Promise.all([
    searchTracksSoundcloud(query).catch(() => []),
    searchTracksYoutube(query).catch(() => [])
  ])
  const merged: TrackResult[] = []
  const max = Math.max(sc.length, yt.length)
  for (let i = 0; i < max; i++) {
    if (sc[i]) merged.push(sc[i])
    if (yt[i]) merged.push(yt[i])
  }
  return merged
}

export function fetchTrends(): Promise<TrackResult[]> {
  return getJson('/api/trends')
}

function parseNativeId(trackId: string): { source: TrackSource; nativeId: string } {
  const [source, ...rest] = trackId.split(':')
  return { source: source as TrackSource, nativeId: rest.join(':') }
}

export function resolveStream(track: TrackResult): Promise<ResolvedStream> {
  const { source, nativeId } = parseNativeId(track.id)
  const params = new URLSearchParams({
    source,
    native_id: nativeId,
    title: track.title,
    artist: track.artists[0] ?? ''
  })
  return getJson(`/api/stream/resolve?${params.toString()}`)
}

export function fetchSyncedLyrics(title: string, artist: string, duration?: number): Promise<SyncedLyricsResponse> {
  const params = new URLSearchParams({ title, artist })
  if (duration) params.set('duration', String(Math.round(duration)))
  return getJson(`/api/lyrics/synced?${params.toString()}`)
}
