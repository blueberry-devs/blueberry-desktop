import type { TrackResult } from '../api/yandexMusic'

const BASE_URL = 'http://localhost:8787'

export interface ImportedPlaylist {
  title: string
  cover: string | null
  source: string
  tracks: TrackResult[]
  unresolved: number
}

export interface SpotifyJsonImport {
  title: string
  tracks: Array<{ title: string; artist: string }>
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function collectSpotifyTracks(value: unknown, result: Array<{ title: string; artist: string }>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSpotifyTracks(item, result))
    return
  }
  if (!value || typeof value !== 'object') return
  const object = value as Record<string, unknown>
  const title = text(object.trackName) ?? text(object.track_name) ?? text(object.title)
    ?? (object.track && typeof object.track === 'object' ? text((object.track as Record<string, unknown>).name) : null)
  const artist = text(object.artistName) ?? text(object.artist_name) ?? text(object.artist)
    ?? (object.track && typeof object.track === 'object'
      ? text((object.track as Record<string, unknown>).artistName)
      : null)
  if (title && artist) result.push({ title, artist })
  Object.values(object).forEach((child) => collectSpotifyTracks(child, result))
}

export async function readSpotifyJson(file: File): Promise<SpotifyJsonImport> {
  const value: unknown = JSON.parse(await file.text())
  const tracks: Array<{ title: string; artist: string }> = []
  collectSpotifyTracks(value, tracks)
  const unique = Array.from(new Map(tracks.map((track) => [`${track.artist}\n${track.title}`.toLowerCase(), track])).values())
  if (unique.length === 0) throw new Error('В JSON не найден список треков Spotify')
  const root = Array.isArray(value) ? value[0] : value
  const rootObject = root && typeof root === 'object' ? root as Record<string, unknown> : {}
  const title = text(rootObject.playlistName) ?? text(rootObject.name) ?? file.name.replace(/\.json$/i, '')
  return { title, tracks: unique }
}

export async function importPlaylistFromUrl(url: string): Promise<ImportedPlaylist> {
  const response = await fetch(`${BASE_URL}/api/import/playlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const text = await response.text()
  let parsed: unknown = null
  try { parsed = JSON.parse(text) as unknown } catch { /* plain-text error */ }
  if (!response.ok) {
    const message = parsed && typeof parsed === 'object' && 'title' in parsed
      ? String((parsed as { title?: string }).title)
      : text
    throw new Error(message || 'Не удалось импортировать плейлист')
  }
  const body = parsed as ImportedPlaylist | null
  if (!body) throw new Error('Сервер вернул пустой результат')
  return body
}
