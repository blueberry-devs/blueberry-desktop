import { PlaylistResult } from '../api/yandexMusic'
import { createStore } from '../services/store'

const store = createStore<PlaylistResult[]>('favoritePlaylists', [])

export function subscribe(listener: () => void): () => void {
  return store.subscribe(listener)
}

export function getFavoritePlaylists(): PlaylistResult[] {
  return store.get()
}

export function isFavoritePlaylist(id: string): boolean {
  return store.get().some((p) => p.id === id)
}

export function toggleFavoritePlaylist(playlist: PlaylistResult): void {
  store.update((prev) => {
    if (prev.some((p) => p.id === playlist.id)) {
      return prev.filter((p) => p.id !== playlist.id)
    }
    return [playlist, ...prev]
  })
}

export function useFavoritePlaylists(): PlaylistResult[] {
  return store.useValue()
}

export function useIsFavoritePlaylist(id: string | undefined): boolean {
  const playlists = store.useValue()
  return id ? playlists.some((p) => p.id === id) : false
}
