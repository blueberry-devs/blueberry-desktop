import { createStore } from '../services/store'

export interface FavoriteArtist {
  name: string
  cover: string | null
  trackTitle: string
}

const store = createStore<FavoriteArtist[]>('favoriteArtists', [])

export function getFavoriteArtists(): FavoriteArtist[] {
  return store.get()
}

export function toggleFavoriteArtist(artist: FavoriteArtist): void {
  store.update((prev) => {
    if (prev.some((item) => item.name.toLowerCase() === artist.name.toLowerCase())) {
      return prev.filter((item) => item.name.toLowerCase() !== artist.name.toLowerCase())
    }
    return [artist, ...prev]
  })
}

export function useFavoriteArtists(): FavoriteArtist[] {
  return store.useValue()
}

export function useIsFavoriteArtist(name: string): boolean {
  const artists = store.useValue()
  return artists.some((artist) => artist.name.toLowerCase() === name.toLowerCase())
}
