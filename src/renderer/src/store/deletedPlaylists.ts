import { useSyncExternalStore } from 'react'
import type { Playlist } from './playlists'

const STORAGE_KEY = 'ym-clone:deleted-playlists'

export interface DeletedPlaylistEntry {
  playlist: Playlist
  deletedAt: number
}

let cache: DeletedPlaylistEntry[] = load()
const listeners = new Set<() => void>()

function load(): DeletedPlaylistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DeletedPlaylistEntry[]) : []
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

export function getDeletedPlaylists(): DeletedPlaylistEntry[] {
  return cache
}

export function addDeletedPlaylist(playlist: Playlist): void {
  if (cache.some((d) => d.playlist.id === playlist.id)) return
  cache = [{ playlist, deletedAt: Date.now() }, ...cache]
  emit()
}

export function removeDeletedPlaylist(id: string): void {
  cache = cache.filter((d) => d.playlist.id !== id)
  emit()
}

export function useDeletedPlaylists(): DeletedPlaylistEntry[] {
  return useSyncExternalStore(subscribe, getDeletedPlaylists)
}
