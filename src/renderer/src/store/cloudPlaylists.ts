import { useSyncExternalStore } from 'react'
import type { CloudPlaylistSummary } from '../services/playlists'

let cache: CloudPlaylistSummary[] = []
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

export function getCloudPlaylists(): CloudPlaylistSummary[] {
  return cache
}

export function setCloudPlaylists(playlists: CloudPlaylistSummary[]): void {
  cache = playlists
  emit()
}

export function useCloudPlaylists(): CloudPlaylistSummary[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getCloudPlaylists,
  )
}
