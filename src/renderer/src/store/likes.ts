import { TrackResult } from '../api/yandexMusic'
import { createStore } from '../services/store'
import { getAuth } from './auth'
import { resolveTracks, likeEntity, unlikeEntity } from '../services/playlists'
import type { TrackUploadDto } from '../services/playlists'

const store = createStore<TrackResult[]>('likes', [])

/* ========== Public API ========== */

export function subscribe(listener: () => void): () => void {
  return store.subscribe(listener)
}

export function getLikedTracks(): TrackResult[] {
  return store.get()
}

export function isLiked(id: string): boolean {
  return store.get().some((t) => t.id === id)
}

/**
 * Toggle a track like — updates local store optimistically and fires
 * the server API in the background (fire-and-forget).
 */
export function toggleLike(track: TrackResult): void {
  const token = getAuth().accessToken

  store.update((prev) => {
    const wasLiked = prev.some((t) => t.id === track.id)

    if (wasLiked) {
      // Unlike: remove from local store, fire DELETE in background
      const next = prev.filter((t) => t.id !== track.id)

      if (token) {
        unlikeTrackOnServer(token, track)
      }

      return next
    } else {
      // Like: add to local store, fire POST in background
      if (token) {
        likeTrackOnServer(token, track)
      }

      return [track, ...prev]
    }
  })
}

export function useLikedTracks(): TrackResult[] {
  return store.useValue()
}

export function useIsLiked(id: string | undefined): boolean {
  const tracks = store.useValue()
  return id ? tracks.some((t) => t.id === id) : false
}

/** Clear all liked tracks (call on logout). */
export function clearLikedTracks(): void {
  store.set([])
}

/* ========== Internal API helpers ========== */

function trackToDto(track: TrackResult): TrackUploadDto {
  return {
    externalId: track.id,
    externalSource:
      track.source === 'yandex' ? 'YandexMusic'
        : track.source === 'youtube' ? 'YouTubeMusic'
        : 'SoundCloud',
    externalUrl: (() => {
      const rawId = track.id.replace(/^(youtube|yandex|soundcloud|sc|yt|ym):/, '')
      switch (track.source) {
        case 'youtube':
          return `https://music.youtube.com/watch?v=${rawId}`
        case 'soundcloud':
          return `https://soundcloud.com/search?q=${encodeURIComponent(track.title)}`
        case 'yandex':
          return `https://music.yandex.ru/track/${rawId}`
      }
    })(),
    title: track.title,
    artist: track.artists.join(', '),
    artistId: null,
    album: null,
    albumImageUrl: track.cover,
    duration: track.duration ?? null,
  }
}

async function likeTrackOnServer(token: string, track: TrackResult): Promise<void> {
  try {
    const dto = trackToDto(track)
    const resolved = await resolveTracks(token, [dto])
    if (!resolved.length || !resolved[0].id) return

    await likeEntity(token, 'track', resolved[0].id)
  } catch {
    // Non-critical — next background sync will reconcile
  }
}

async function unlikeTrackOnServer(token: string, track: TrackResult): Promise<void> {
  try {
    const dto = trackToDto(track)
    const resolved = await resolveTracks(token, [dto])
    if (!resolved.length || !resolved[0].id) return

    await unlikeEntity(token, 'track', resolved[0].id)
  } catch {
    // Non-critical — next background sync will reconcile
  }
}
