import { TrackResult } from '../api/yandexMusic'
import { createStore } from '../services/store'
import { isTrackSynced, markTracksSynced } from './trackSync'

/**
 * Local registry of every track the user has played, liked, or fetched from
 * the backend. Kept in memory and persisted (localStorage + IPC file) so a
 * full track list survives restarts and can be uploaded to the backend later.
 */
const store = createStore<Record<string, TrackResult>>('tracks', {})

/** All locally-known tracks (memory + local persistence). */
export function getTracks(): TrackResult[] {
  return Object.values(store.get())
}

export function getTrack(id: string): TrackResult | undefined {
  return store.get()[id]
}

/** Locally-known tracks that haven't been uploaded to the backend yet. */
export function getUnsyncedTracks(): TrackResult[] {
  return Object.values(store.get()).filter((t) => !isTrackSynced(t.id))
}

// Keep the richer copy when the same track is seen twice (e.g. a search hit
// without a cover vs. the liked-tracks copy that has one).
function mergeTrack(prev: TrackResult, next: TrackResult): TrackResult {
  return {
    ...next,
    artists: next.artists.length > 0 ? next.artists : prev.artists,
    cover: next.cover ?? prev.cover,
    duration: next.duration ?? prev.duration,
  }
}

/** Upsert tracks into the local registry (memory + local persistence). */
export function addTracks(tracks: TrackResult[]): void {
  if (tracks.length === 0) return
  store.update((prev) => {
    const next = { ...prev }
    for (const t of tracks) {
      const existing = next[t.id]
      next[t.id] = existing ? mergeTrack(existing, t) : t
    }
    return next
  })
}

export function addTrack(track: TrackResult): void {
  addTracks([track])
}

/**
 * Save tracks that already exist on the backend (e.g. fetched likes) and mark
 * them as uploaded so the background sync doesn't re-upload them.
 */
export function addServerTracks(tracks: TrackResult[]): void {
  addTracks(tracks)
  markTracksSynced(tracks.map((t) => t.id))
}

export function useTracks(): TrackResult[] {
  return Object.values(store.useValue())
}

export function useTrack(id: string): TrackResult | undefined {
  return store.useValue()[id]
}

/** Clear the track registry (call on logout). */
export function clearTracks(): void {
  store.set({})
}
