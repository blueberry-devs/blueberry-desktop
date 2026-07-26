import { useSyncExternalStore } from 'react'
import { TrackResult } from '../api/yandexMusic'
import { markUnsynced } from './playlistSync'
import { getAuth } from './auth'
import { setPlaylistVersion } from './playlistVersions'
import { addTrackToCloudPlaylist as apiAddTrackToCloudPlaylist, removeTrackFromCloudPlaylist as apiRemoveTrackFromCloudPlaylist, deleteCloudPlaylist as apiDeleteCloudPlaylist, createCloudPlaylist as apiCreateCloudPlaylist } from '../services/playlists'
import { removeCloudPlaylist } from './cloudPlaylists'

const STORAGE_KEY = 'ym-clone:playlists'

export interface Playlist {
  id: string
  name: string
  cover: string | null
  tracks: TrackResult[]
  createdAt: number
  /** Server-side UUID if this playlist has been synced to the cloud */
  cloudId?: string
}

let cache: Playlist[] = load()
const listeners = new Set<() => void>()

function load(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Playlist[]) : []
  } catch {
    return []
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* storage full / unavailable */
  }
}

function emit(): void {
  persist()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPlaylists(): Playlist[] {
  return cache
}

export function createPlaylist(name: string, cover: string | null = null): Playlist {
  const playlist: Playlist = {
    id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Новый плейлист',
    cover,
    tracks: [],
    createdAt: Date.now()
  }
  cache = [playlist, ...cache]
  markUnsynced()
  emit()

  // Fire-and-forget: create on server immediately if authenticated
  const auth = getAuth()
  if (auth.accessToken) {
    apiCreateCloudPlaylist(auth.accessToken, {
      title: playlist.name,
      description: null,
      imageUrl: playlist.cover,
      isPublic: false,
    }).then((detail) => {
      if (!detail) return
      setPlaylistCloudId(playlist.id, detail.id)
      setPlaylistVersion(detail.id, detail.version)
    })
  }

  return playlist
}

export function deletePlaylist(id: string): void {
  const pl = cache.find((p) => p.id === id)
  cache = cache.filter((p) => p.id !== id)
  markUnsynced()
  emit()

  // Remove from cloud playlists display and delete from API if synced
  if (pl?.cloudId) {
    removeCloudPlaylist(pl.cloudId)
    const auth = getAuth()
    if (auth.accessToken) {
      apiDeleteCloudPlaylist(auth.accessToken, pl.cloudId)
    }
  }
}

export function renamePlaylist(id: string, name: string): void {
  cache = cache.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
  markUnsynced()
  emit()
}

export function setPlaylistCover(id: string, cover: string | null): void {
  cache = cache.map((p) => (p.id === id ? { ...p, cover } : p))
  markUnsynced()
  emit()
}

export function addTrackToPlaylist(id: string, track: TrackResult): void {
  const pl = cache.find((p) => p.id === id)
  if (!pl || pl.tracks.some((t) => t.id === track.id)) return

  cache = cache.map((p) =>
    p.id === id ? { ...p, tracks: [...p.tracks, track] } : p
  )
  markUnsynced()
  emit()

  // Fire-and-forget: push to cloud immediately if playlist has cloudId
  const auth = getAuth()
  if (pl.cloudId && auth.accessToken) {
    apiAddTrackToCloudPlaylist(auth.accessToken, pl.cloudId, track).then((newVersion) => {
      if (newVersion != null) setPlaylistVersion(pl.cloudId!, newVersion)
    })
  }
}

export function removeTrackFromPlaylist(id: string, trackId: string): void {
  const pl = cache.find((p) => p.id === id)
  const track = pl?.tracks.find((t) => t.id === trackId)

  console.log('[playlists] removeTrackFromPlaylist called', { id, trackId, plName: pl?.name, cloudId: pl?.cloudId, trackTitle: track?.title })

  cache = cache.map((p) => (p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p))
  markUnsynced()
  emit()

  // Fire-and-forget: delete from cloud immediately if playlist is synced
  if (track && pl?.cloudId) {
    const auth = getAuth()
    if (auth.accessToken) {
      console.log('[playlists] calling apiRemoveTrackFromCloudPlaylist', { cloudId: pl.cloudId, trackId, trackTitle: track.title })
      apiRemoveTrackFromCloudPlaylist(auth.accessToken, pl.cloudId, track).then((newVersion) => {
        if (newVersion != null) {
          console.log('[playlists] remove from cloud done, newVersion:', newVersion)
          setPlaylistVersion(pl.cloudId!, newVersion)
        } else {
          console.warn('[playlists] remove from cloud returned null — track may not exist on server or resolve failed')
        }
      })
    } else {
      console.warn('[playlists] not authenticated — skipping cloud delete')
    }
  } else {
    console.warn('[playlists] skipping cloud delete —', {
      noTrack: !track,
      noCloudId: !pl?.cloudId,
      playlistExists: !!pl,
    })
  }
}

export function moveTrackInPlaylist(id: string, fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return
  cache = cache.map((p) => {
    if (p.id !== id) return p
    const tracks = [...p.tracks]
    const [moved] = tracks.splice(fromIndex, 1)
    tracks.splice(toIndex, 0, moved)
    return { ...p, tracks }
  })
  markUnsynced()
  emit()
}

/**
 * Add a playlist that came from the cloud (no markUnsynced).
 * Does nothing if a playlist with the same id already exists.
 */
export function addPlaylistFromCloud(playlist: Playlist): void {
  if (cache.some((p) => p.id === playlist.id)) return
  cache = [...cache, playlist]
  emit()
}

/**
 * Set the cloud playlist UUID for a local playlist.
 * Does NOT mark as unsynced (this is set during cloud sync).
 */
export function setPlaylistCloudId(id: string, cloudId: string): void {
  cache = cache.map((p) => (p.id === id ? { ...p, cloudId } : p))
  emit()
}

/**
 * Add multiple tracks at once without marking unsynced.
 * Skips duplicates. Used by background sync.
 */
export function addTracksSilently(id: string, tracks: TrackResult[]): void {
  if (tracks.length === 0) return
  cache = cache.map((p) => {
    if (p.id !== id) return p
    const existing = new Set(p.tracks.map((t) => t.id))
    const newTracks = tracks.filter((t) => !existing.has(t.id))
    if (newTracks.length === 0) return p
    return { ...p, tracks: [...p.tracks, ...newTracks] }
  })
  emit()
}

export function usePlaylists(): Playlist[] {
  return useSyncExternalStore(subscribe, getPlaylists)
}
