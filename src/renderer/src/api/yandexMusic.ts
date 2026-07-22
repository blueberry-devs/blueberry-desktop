import { getProfile } from '../store/profile'

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

// Searches all sources (Yandex → SoundCloud → YouTube), deduped by
// title+artist. Each source handles its own failure gracefully.
export async function searchTracksMulti(query: string): Promise<TrackResult[]> {
  const [yandex, sc, yt] = await Promise.all([
    searchTracksYandex(query).catch(() => []),
    searchTracksSoundcloud(query).catch(() => []),
    searchTracksYoutube(query).catch(() => [])
  ])
  const seen = new Set<string>()
  const merged: TrackResult[] = []
  for (const t of [...yandex, ...sc, ...yt]) {
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

export function fetchSyncedLyrics(title: string, artist: string, duration?: number): Promise<SyncedLyricsResponse> {
  const params = new URLSearchParams({ title, artist })
  if (duration) params.set('duration', String(Math.round(duration)))
  return getJson(`/api/lyrics/synced?${params.toString()}`)
}
