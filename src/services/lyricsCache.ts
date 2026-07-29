import { fetchSyncedLyrics, TrackResult } from '../api/yandexMusic'

export interface LyricsPayload {
  synced: string | null
  plain: string | null
  provider?: string | null
}

export async function getCachedLyrics(trackId: string): Promise<LyricsPayload | null> {
  try {
    const entry = await window.api.cacheGetLyrics(trackId)
    if (!entry) {
      console.info('[lyrics] cache miss', { trackId })
      return null
    }
    console.info('[lyrics] cache entry', {
      trackId,
      syncedLength: entry.s?.length ?? 0,
      plainLength: entry.p?.length ?? 0
    })
    return { synced: entry.s, plain: entry.p }
  } catch (error) {
    console.warn('[lyrics] cache read failed', { trackId, error })
    return null
  }
}

export async function setCachedLyrics(trackId: string, data: LyricsPayload): Promise<void> {
  try {
    await window.api.cacheSetLyrics(trackId, {
      s: data.synced,
      p: data.plain,
      t: Date.now()
    })
    console.info('[lyrics] cache written', { trackId })
  } catch (error) {
    console.warn('[lyrics] cache write failed', { trackId, error })
  }
}

export async function getLyrics(
  track: TrackResult,
  onResult: (data: LyricsPayload) => void
): Promise<void> {
  // Check cache first
  const cached = await getCachedLyrics(track.id)
  if (cached && (cached.synced || cached.plain)) {
    console.info('[lyrics] using cached result', { trackId: track.id })
    onResult(cached)
    return
  }

  console.info('[lyrics] fetching remote result', { trackId: track.id })
  const res = await fetchSyncedLyrics(track.title, track.artists[0] ?? '', track.duration)

  // Cache misses too — a track with no lyrics anywhere should not re-query
  // all five providers every time it plays.
  setCachedLyrics(track.id, res).catch(() => {})
  console.info('[lyrics] result delivered', {
    trackId: track.id,
    syncedLength: res.synced?.length ?? 0,
    plainLength: res.plain?.length ?? 0
  })
  onResult(res)
}
