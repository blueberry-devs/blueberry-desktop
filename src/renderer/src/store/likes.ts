import { TrackResult } from '../api/yandexMusic'
import { createStore } from '../services/store'

const store = createStore<TrackResult[]>('likes', [])

export function subscribe(listener: () => void): () => void {
  return store.subscribe(listener)
}

export function getLikedTracks(): TrackResult[] {
  return store.get()
}

export function isLiked(id: string): boolean {
  return store.get().some((t) => t.id === id)
}

export function toggleLike(track: TrackResult): void {
  store.update((prev) => {
    if (prev.some((t) => t.id === track.id)) {
      return prev.filter((t) => t.id !== track.id)
    }
    return [track, ...prev]
  })
}

export function useLikedTracks(): TrackResult[] {
  return store.useValue()
}

export function useIsLiked(id: string | undefined): boolean {
  const tracks = store.useValue()
  return id ? tracks.some((t) => t.id === id) : false
}
