import { useEffect, useState } from 'react'
import { searchTracksSoundcloud } from '../api/yandexMusic'

// Module-level cache: an artist's photo doesn't change within a session, and
// multiple views (CollectionView, TrendsView) look up the same names.
const cache = new Map<string, string | null>()
const inFlight = new Set<string>()

/**
 * Resolves a real artist photo for names that don't already have one — e.g.
 * artists first seen via a Yandex-sourced chart track, which carries no
 * artist image at all. Falls back to SoundCloud's search (broad artist
 * coverage) so "favorite artists" always shows a real photo, not the track
 * cover, regardless of where the track was originally found.
 */
const base = window.location.origin.includes('localhost') || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : ''

async function fetchArtistPhoto(name: string): Promise<string | null> {
  try {
    const r = await fetch(`${base}/api/artist-photo?name=${encodeURIComponent(name)}`)
    const data = await r.json()
    return data.url ?? null
  } catch {
    return null
  }
}

export function useArtistCovers(missing: { name: string; trackTitle: string }[]): Map<string, string | null> {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const toFetch = missing.filter((m) => !cache.has(m.name) && !inFlight.has(m.name))
    if (toFetch.length === 0) return
    toFetch.forEach((m) => inFlight.add(m.name))
    Promise.all(
      toFetch.map((m) =>
        searchTracksSoundcloud(m.name)
          .then((results) => {
            const match = results.find((r) => r.artistCover) ?? null
            if (match?.artistCover) {
              cache.set(m.name, match.artistCover)
              return
            }
            return fetchArtistPhoto(m.name).then((url) => cache.set(m.name, url))
          })
          .catch(() => fetchArtistPhoto(m.name).then((url) => cache.set(m.name, url)))
          .finally(() => inFlight.delete(m.name))
      )
    ).then(() => forceRender((n) => n + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing.map((m) => m.name).join('|')])

  return cache
}
