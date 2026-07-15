import { useCallback, useEffect, useRef, useState } from 'react'
import { searchTracksMulti, TrackResult } from '../api/yandexMusic'
import { getLikedTracks } from '../store/likes'
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

// Biases results toward what the listener actually likes: alongside the
// plain genre search, also search "<genre> <a liked artist>" so the feed
// leans on real listening history instead of just the genre keyword alone.
function buildQueries(genre: string): string[] {
  const liked = getLikedTracks()
  if (liked.length === 0) return [genre]
  const artists = Array.from(new Set(liked.map((t) => t.artists[0]).filter(Boolean)))
  const sample = artists[Math.floor(Math.random() * artists.length)]
  return sample ? [genre, `${genre} ${sample}`] : [genre]
}

async function fetchCandidates(genre: string): Promise<TrackResult[]> {
  const queries = buildQueries(genre)
  const batches = await Promise.all(queries.map((q) => searchTracksMulti(q).catch(() => [])))
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
  return merged
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
  const lastGenreRef = useRef<string | null>(null)
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

  // Seed a fresh batch whenever the selected genre changes.
  useEffect(() => {
    if (activeGenre && activeGenre !== lastGenreRef.current) {
      lastGenreRef.current = activeGenre
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
