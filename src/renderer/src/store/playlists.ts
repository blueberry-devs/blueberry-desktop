import { useSyncExternalStore } from 'react'
import { TrackResult } from '../api/yandexMusic'
import { markUnsynced } from './playlistSync'
import { getAuth } from './auth'
import { setPlaylistVersion } from './playlistVersions'
import { addTrackToCloudPlaylist as apiAddTrackToCloudPlaylist, removeTrackFromCloudPlaylist as apiRemoveTrackFromCloudPlaylist, deleteCloudPlaylist as apiDeleteCloudPlaylist, createCloudPlaylist as apiCreateCloudPlaylist, restoreCloudPlaylist as apiRestoreCloudPlaylist, forceDeleteCloudPlaylist as apiForceDeleteCloudPlaylist, fetchCloudPlaylists } from '../services/playlists'
import { removeCloudPlaylist, setCloudPlaylists } from './cloudPlaylists'
import { addDeletedPlaylist, removeDeletedPlaylist, getDeletedPlaylists } from './deletedPlaylists'

const STORAGE_KEY = 'ym-clone:playlists'

export interface Playlist {
  id: string
  name: string
  cover: string | null
  tracks: TrackResult[]
  createdAt: number
}

/** Rough UUID check — id is a UUID if it matches standard format */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(id: string): boolean {
  return UUID_RE.test(id)
}

let cache: Playlist[] = load()
const listeners = new Set<() => void>()

/** Tracks in-flight API requests per playlist ID to prevent races */
const pendingCloudRequests = new Set<string>()

/** Check if a playlist has an in-flight API request */
export function hasPendingCloudRequest(playlistId: string): boolean {
  return pendingCloudRequests.has(playlistId)
}

/** Run a fire-and-forget cloud API call, but skip if one is already in-flight for this playlist */
function cloudRequest(id: string, fn: () => Promise<unknown>): void {
  if (pendingCloudRequests.has(id)) {
    console.log('[playlists] skipping duplicate cloud request for', id)
    return
  }
  pendingCloudRequests.add(id)
  fn().finally(() => pendingCloudRequests.delete(id))
}

function load(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Playlist & { cloudId?: string }>
    // Migrate: old playlists had cloudId separate from id
    return parsed.map((p) => {
      if (p.cloudId) {
        // Old format: id was pl_*, cloudId was UUID
        return { id: p.cloudId, name: p.name, cover: p.cover, tracks: p.tracks, createdAt: p.createdAt }
      }
      return { id: p.id, name: p.name, cover: p.cover, tracks: p.tracks, createdAt: p.createdAt }
    })
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
  const uuid = crypto.randomUUID()
  const playlist: Playlist = {
    id: uuid,
    name: name.trim() || 'Новый плейлист',
    cover,
    tracks: [],
    createdAt: Date.now(),
  }
  cache = [playlist, ...cache]
  markUnsynced()
  emit()

  // Fire-and-forget: create on server immediately if authenticated
  // Server accepts our UUID — idempotent, creates with the same UUID
  const auth = getAuth()
  if (auth.accessToken) {
    cloudRequest(uuid, async () => {
      const detail = await apiCreateCloudPlaylist(auth.accessToken, {
        id: uuid,
        title: playlist.name,
        description: null,
        imageUrl: playlist.cover,
        isPublic: false,
      })
      if (!detail) return
      // detail.id === uuid (server created with our id), so no id change needed
      setPlaylistVersion(uuid, detail.version)
    })
  }

  return playlist
}

export function deletePlaylist(id: string): void {
  const pl = cache.find((p) => p.id === id)
  if (!pl) return

  // Move to trash instead of permanent removal
  addDeletedPlaylist(pl)
  cache = cache.filter((p) => p.id !== id)
  markUnsynced()
  emit()

  // Soft delete on API if synced (moves to server-side trash)
  if (isUuid(id)) {
    removeCloudPlaylist(id)
    const auth = getAuth()
    if (auth.accessToken) {
      cloudRequest(id, () => apiDeleteCloudPlaylist(auth.accessToken, id))
    }
  }
}

/**
 * Restore a playlist from trash back to active playlists.
 */
export function restorePlaylist(id: string): void {
  const cacheDeleted = getDeletedPlaylists().find((d) => d.playlist.id === id)
  if (!cacheDeleted) {
    console.warn('[playlists] restorePlaylist: not found in trash', id)
    return
  }

  removeDeletedPlaylist(id)
  cache = [cacheDeleted.playlist, ...cache]
  markUnsynced()
  emit()

  // Restore on server if it was synced
  if (isUuid(id)) {
    const auth = getAuth()
    if (auth.accessToken) {
      cloudRequest(id, async () => {
        await apiRestoreCloudPlaylist(auth.accessToken, id)
        const cloudPls = await fetchCloudPlaylists(auth.accessToken)
        setCloudPlaylists(cloudPls)
      })
    }
  }
}

/**
 * Permanently delete a playlist from trash (force delete).
 * Calls force delete on API if synced.
 */
export function forceDeletePlaylist(id: string): void {
  const deleted = getDeletedPlaylists().find((d) => d.playlist.id === id)
  removeDeletedPlaylist(id)

  if (deleted && isUuid(id)) {
    const auth = getAuth()
    if (auth.accessToken) {
      cloudRequest(id, () => apiForceDeleteCloudPlaylist(auth.accessToken, id))
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

  // Fire-and-forget: push to cloud immediately if playlist has UUID (is synced)
  const auth = getAuth()
  if (isUuid(id) && auth.accessToken) {
    cloudRequest(id, async () => {
      const newVersion = await apiAddTrackToCloudPlaylist(auth.accessToken, id, track)
      if (newVersion != null) setPlaylistVersion(id, newVersion)
    })
  }
}

export function removeTrackFromPlaylist(id: string, trackId: string): void {
  const pl = cache.find((p) => p.id === id)
  const track = pl?.tracks.find((t) => t.id === trackId)

  cache = cache.map((p) => (p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p))
  markUnsynced()
  emit()

  // Fire-and-forget: delete from cloud immediately if playlist is synced
  if (track && isUuid(id)) {
    const auth = getAuth()
    if (auth.accessToken) {
      cloudRequest(id, async () => {
        const newVersion = await apiRemoveTrackFromCloudPlaylist(auth.accessToken, id, track)
        if (newVersion != null) {
          setPlaylistVersion(id, newVersion)
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
      noUuid: !isUuid(id),
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
 * For old playlists with prefixed id (pl_), changes the id to UUID.
 * For new playlists that already have UUID as id, this is a no-op.
 * Does NOT mark as unsynced (this is set during cloud sync).
 */
export function setPlaylistCloudId(oldId: string, newId: string): void {
  if (oldId === newId) return
  cache = cache.map((p) => (p.id === oldId ? { ...p, id: newId } : p))
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
