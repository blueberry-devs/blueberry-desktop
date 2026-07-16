import { useSyncExternalStore } from 'react'
import { TrackResult } from '../api/yandexMusic'

const STORAGE_KEY = 'ym-clone:playlists'

export interface Playlist {
  id: string
  name: string
  cover: string | null
  tracks: TrackResult[]
  createdAt: number
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
  emit()
  return playlist
}

export function deletePlaylist(id: string): void {
  cache = cache.filter((p) => p.id !== id)
  emit()
}

export function renamePlaylist(id: string, name: string): void {
  cache = cache.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
  emit()
}

export function setPlaylistCover(id: string, cover: string | null): void {
  cache = cache.map((p) => (p.id === id ? { ...p, cover } : p))
  emit()
}

export function addTrackToPlaylist(id: string, track: TrackResult): void {
  cache = cache.map((p) =>
    p.id === id && !p.tracks.some((t) => t.id === track.id) ? { ...p, tracks: [...p.tracks, track] } : p
  )
  emit()
}

export function removeTrackFromPlaylist(id: string, trackId: string): void {
  cache = cache.map((p) => (p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p))
  emit()
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
  emit()
}

export function usePlaylists(): Playlist[] {
  return useSyncExternalStore(subscribe, getPlaylists)
}
