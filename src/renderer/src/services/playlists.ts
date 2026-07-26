import type { Playlist } from '../store/playlists'
import type { TrackResult } from '../api/yandexMusic'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/* ---------- API DTOs matching v1.yaml schemas ---------- */

interface TrackUploadDto {
  externalId: string
  externalSource: string
  externalUrl: string
  title: string
  artist: string
  artistId: string | null
  album: string | null
  albumImageUrl: string | null
  duration: number | null
}

interface SyncPlaylistRequest {
  externalId: string
  externalSource: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublic: boolean
  tracks: TrackUploadDto[]
}

/* ---------- mappers ---------- */

function mapSource(source: TrackResult['source']): string {
  switch (source) {
    case 'yandex':
      return 'YandexMusic'
    case 'youtube':
      return 'YouTubeMusic'
    case 'soundcloud':
      return 'SoundCloud'
  }
}

function makeExternalUrl(track: TrackResult): string {
  switch (track.source) {
    case 'youtube':
      return `https://music.youtube.com/watch?v=${track.id}`
    case 'soundcloud':
      return `https://soundcloud.com/search?q=${encodeURIComponent(track.title)}`
    case 'yandex':
      return `https://music.yandex.ru/track/${track.id}`
  }
}

function mapTrackToDto(track: TrackResult): TrackUploadDto {
  return {
    externalId: track.id,
    externalSource: mapSource(track.source),
    externalUrl: makeExternalUrl(track),
    title: track.title,
    artist: track.artists.join(', '),
    artistId: null,
    album: null,
    albumImageUrl: track.cover,
    duration: track.duration ?? null,
  }
}

function mapPlaylistToSync(p: Playlist): SyncPlaylistRequest {
  return {
    externalId: p.id,
    externalSource: 'BlueberryDesktop',
    title: p.name,
    description: null,
    imageUrl: p.cover,
    isPublic: false,
    tracks: p.tracks.map(mapTrackToDto),
  }
}

/* ---------- API call ---------- */

/**
 * Sync local playlists to the cloud.
 * Sends all local playlists to POST /api/playlists/sync.
 * The server is expected to deduplicate by externalId + externalSource.
 */
export async function syncPlaylists(
  accessToken: string,
  playlists: Playlist[],
): Promise<boolean> {
  if (playlists.length === 0) return true

  try {
    const body = playlists.map(mapPlaylistToSync)
    const res = await fetch(`${BASE_URL}/api/playlists/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}
