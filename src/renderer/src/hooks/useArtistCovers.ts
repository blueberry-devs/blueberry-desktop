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
            cache.set(m.name, match?.artistCover ?? null)
          })
          .catch(() => cache.set(m.name, null))
          .finally(() => inFlight.delete(m.name))
      )
    ).then(() => forceRender((n) => n + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing.map((m) => m.name).join('|')])

  return cache
}
