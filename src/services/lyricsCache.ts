import { fetchSyncedLyrics, TrackResult } from '../api/yandexMusic'

export async function getCachedLyrics(trackId: string): Promise<{ synced: string | null; plain: string | null } | null> {
  try {
    const entry = await window.api.cacheGetLyrics(trackId)
    if (!entry) return null
    return { synced: entry.s, plain: entry.p }
  } catch {
    return null
  }
}

export async function setCachedLyrics(
  trackId: string,
  data: { synced: string | null; plain: string | null }
): Promise<void> {
  try {
    await window.api.cacheSetLyrics(trackId, {
      s: data.synced,
      p: data.plain,
      t: Date.now()
    })
  } catch {
    // silent
  }
}

export async function getLyrics(
  track: TrackResult,
  onResult: (data: { synced: string | null; plain: string | null }) => void
): Promise<void> {
  // Check cache first
  const cached = await getCachedLyrics(track.id)
  if (cached && (cached.synced || cached.plain)) {
    onResult(cached)
    return
  }

  // Fetch from API
  try {
    const res = await fetchSyncedLyrics(track.title, track.artists[0] ?? '', track.duration)
    if (res.synced || res.plain) {
      setCachedLyrics(track.id, res).catch(() => {})
    }
    onResult(res)
  } catch (err) {
    throw err
  }
}
