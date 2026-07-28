import { useSyncExternalStore } from 'react'

// In-memory only (not persisted): lets any view (Collection, Trends,
// Playlists, Search itself) trigger "go search this artist" without every
// TrackRow consumer needing to know about tab navigation.
let pending: string | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function requestArtistSearch(name: string): void {
  pending = name
  emit()
}

export function getPendingSearch(): string | null {
  return pending
}

export function consumePendingSearch(): string | null {
  const value = pending
  pending = null
  return value
}

export function usePendingSearch(): string | null {
  return useSyncExternalStore(subscribe, getPendingSearch)
}
