import { useCallback, useEffect, useRef, useState } from 'react'
import { searchTracksMulti, searchArtistTracks, TrackResult } from '../api/yandexMusic'
import { getLikedTracks } from '../store/likes'
import { getHistory } from '../store/history'
import { pickCategoryForQuery } from '../data/wavePhrases'
import { usePlayer } from './PlayerContext'

// How close to the end of the queue we top it up with a fresh batch, so
// Next/Previous always have somewhere real to go instead of a queue of one.
const REFILL_THRESHOLD = 3
// Keep the wave to normal song lengths — anything this long or longer is
// almost always a mix/set/podcast rather than a single track, and one of
// those eating the whole queue isn't what "next track" should mean here.
const MAX_DURATION_SECONDS = 600

// Different sources (or reposts within the same source) can hand back the
// same song under different track IDs — dedupe by a normalized title+artist
// signature, not just the raw ID, or it can show up twice in one queue.
function trackSignature(t: TrackResult): string {
  const title = t.title.toLowerCase().trim().replace(/\s+/g, ' ')
  const artist = (t.artists[0] ?? '').toLowerCase().trim()
  return `${artist}::${title}`
}

function isUsable(t: TrackResult): boolean {
  return !t.duration || t.duration < MAX_DURATION_SECONDS
}

// Returns true when the query is an artist name (personalised "В духе X" item)
// rather than a known genre keyword like "rock music" or "electronic music".
// We detect this by checking whether pickCategoryForQuery returns 'main' —
// only artist names fall through to that default.
function isArtistQuery(query: string): boolean {
  return !query || pickCategoryForQuery(query) === 'main'
}

// Module-level, not a ref: MoodList/NowPlayingPanel (and this hook with them)
// unmount every time the user leaves the "Моя волна" tab, while `activeGenre`
// lives in PlayerContext and survives the tab switch. A per-component ref
// would reset to null on remount and misread the untouched activeGenre as
// "just changed", re-seeding and autoplaying a fresh wave over whatever the
// user was actually playing (e.g. a manually picked search result).
let lastSeededGenre: string | null = null

// Rotates through the listener's taste signal instead of re-rolling one random
// artist each refill — otherwise a small liked/history pool tends to keep
// resurfacing the same one or two artists across consecutive batches.
let rotationCursor = 0

// For genre keywords: bias results toward what the listener actually likes
// by mixing "<genre> <artist>" queries from likes/history alongside the
// bare genre.  For artist queries we skip this — mixing "Disturbed" with
// "Disturbed Metallica" would pull in unrelated artists.
function buildQueries(genre: string): string[] {
  if (isArtistQuery(genre)) return [genre]

  const likedArtists = getLikedTracks().map((t) => t.artists[0])
  const historyArtists = getHistory().map((t) => t.artists[0])
  const artists = Array.from(new Set([...likedArtists, ...historyArtists].filter(Boolean)))
  if (artists.length === 0) return [genre]

  const a = artists[rotationCursor % artists.length]
  const b = artists.length > 1 ? artists[(rotationCursor + 1) % artists.length] : null
  rotationCursor++

  const queries = [genre, `${genre} ${a}`]
  if (b) queries.push(historyArtists.includes(b) ? b : `${genre} ${b}`)
  return queries
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

async function fetchCandidates(genre: string): Promise<TrackResult[]> {
  // Artist query → fetch the artist's actual top tracks from Yandex.
  // This is much more reliable than a text search for "Disturbed" which
  // can return tracks from completely unrelated artists.
  if (isArtistQuery(genre)) {
    const results = await searchArtistTracks(genre).catch(() => [] as TrackResult[])
    const usable = results.filter(isUsable)
    if (usable.length > 0) return shuffle(usable)
    // Fallback to multi-source text search if artist endpoint fails
  }

  const queries = buildQueries(genre)
  const batches = await Promise.all(queries.map((q) => searchTracksMulti(q, ['yandex', 'soundcloud', 'youtube']).catch(() => [])))
  const merged: TrackResult[] = []
  const seen = new Set<string>()
  const max = Math.max(...batches.map((b) => b.length))
  for (let i = 0; i < max; i++) {
    for (const batch of batches) {
      const t = batch[i]
      if (!t || !isUsable(t)) continue
      const sig = trackSignature(t)
      if (seen.has(sig)) continue
      seen.add(sig)
      merged.push(t)
    }
  }
  // Search results come back in the same order every time for the same
  // query — without this, picking the same mood twice in a row (or a
  // refill mid-session) hands back the exact same lead track.
  return shuffle(merged)
}

export function useWaveFeed(): {
  waveTrack: TrackResult | null
  isGenerating: boolean
  skip: () => void
} {
  const { queue, queueIndex, activeGenre, playQueue, appendToQueue } = usePlayer()
  const [waveTrack, setWaveTrack] = useState<TrackResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  // Signatures, not raw IDs — see trackSignature above.
  const seenSigsRef = useRef<Set<string>>(new Set())
  const requestTokenRef = useRef(0)
  const refillingRef = useRef(false)

  const seedGenre = useCallback(
    (genre: string, autoplay: boolean) => {
      const token = ++requestTokenRef.current
      setIsGenerating(true)
      seenSigsRef.current = new Set()
      fetchCandidates(genre)
        .then((results) => {
          if (requestTokenRef.current !== token || activeGenre !== genre) return
          if (results.length === 0) return
          results.forEach((t) => seenSigsRef.current.add(trackSignature(t)))
          setWaveTrack(results[0])
          if (autoplay) playQueue(results, 0)
        })
        .catch(() => {})
        .finally(() => {
          if (requestTokenRef.current === token) setIsGenerating(false)
        })
    },
    [activeGenre, playQueue]
  )

  // Seed a fresh batch whenever the selected genre actually changes (not
  // just whenever this hook happens to (re)mount).
  useEffect(() => {
    if (activeGenre && activeGenre !== lastSeededGenre) {
      lastSeededGenre = activeGenre
      seedGenre(activeGenre, true)
    }
  }, [activeGenre, seedGenre])

  // Top up the queue with more of the same genre once we're nearing its end,
  // so Next keeps working instead of running out.
  useEffect(() => {
    if (!activeGenre || refillingRef.current) return
    const remaining = queue.length - 1 - queueIndex
    if (queueIndex < 0 || remaining > REFILL_THRESHOLD) return
    refillingRef.current = true
    fetchCandidates(activeGenre)
      .then((results) => {
        const fresh = results.filter((t) => !seenSigsRef.current.has(trackSignature(t)))
        fresh.forEach((t) => seenSigsRef.current.add(trackSignature(t)))
        if (fresh.length > 0) appendToQueue(fresh)
      })
      .catch(() => {})
      .finally(() => {
        refillingRef.current = false
      })
  }, [activeGenre, queue, queueIndex, appendToQueue])

  const skip = useCallback(() => {
    if (activeGenre) seedGenre(activeGenre, true)
  }, [activeGenre, seedGenre])

  return { waveTrack, isGenerating, skip }
}
