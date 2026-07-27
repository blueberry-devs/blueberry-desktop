import type { Playlist } from '../store/playlists'
import type { TrackResult } from '../api/yandexMusic'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/* ========== Internal DTOs matching v1.yaml ========== */

export interface TrackUploadDto {
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
  title: string
  description: string | null
  imageUrl: string | null
  isPublic: boolean
  tracks: TrackUploadDto[]
}

interface PlaylistSyncActionDto {
  actionType: string
  trackId: string | null
  position: number | null
}

interface PlaylistSyncRequest {
  clientVersion: number
  localActions: PlaylistSyncActionDto[]
}

/* ========== Source mappers ========== */

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

function stripSourcePrefix(id: string): string {
  return id.replace(/^(youtube|yandex|soundcloud|sc|yt|ym):/, '')
}

function makeExternalUrl(track: TrackResult): string {
  const rawId = stripSourcePrefix(track.id)
  switch (track.source) {
    case 'youtube':
      return `https://music.youtube.com/watch?v=${rawId}`
    case 'soundcloud':
      return `https://soundcloud.com/search?q=${encodeURIComponent(track.title)}`
    case 'yandex':
      return `https://music.yandex.ru/track/${rawId}`
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
    title: p.name,
    description: null,
    imageUrl: p.cover,
    isPublic: false,
    tracks: p.tracks.map(mapTrackToDto),
  }
}

function cloudSourceToLocal(source: string): TrackResult['source'] {
  switch (source) {
    case 'YouTubeMusic':
      return 'youtube'
    case 'SoundCloud':
      return 'soundcloud'
    case 'YandexMusic':
      return 'yandex'
    default:
      return 'yandex'
  }
}

function cloudTrackToLocal(t: CloudTrackDto): TrackResult {
  return {
    id: t.externalId,
    source: cloudSourceToLocal(t.externalSource),
    title: t.title,
    artists: t.artist ? [t.artist] : [],
    cover: t.albumImageUrl,
    duration: t.duration ?? undefined,
  }
}

/* ========== Exported types ========== */

export interface CloudPlaylistSummary {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  trackCount: number
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface CloudTrackDto {
  id: string
  externalId: string
  externalSource: string
  title: string
  artist: string
  artistId: string | null
  album: string | null
  albumImageUrl: string | null
  duration: number | null
  externalUrl: string
}

export interface CloudPlaylistDetail {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublic: boolean
  version: number
  tracks: CloudTrackDto[]
  createdAt: string
  updatedAt: string
}

export interface PlaylistAction {
  version: number
  actionType: string
  trackId: string | null
  trackExternalId: string | null
  trackExternalSource: string | null
  trackTitle: string | null
  trackArtist: string | null
  position: number | null
}

export interface PlaylistDiffResponse {
  currentVersion: number
  actions: PlaylistAction[]
}

export interface PlaylistSyncResponse {
  newVersion: number
  serverActions: PlaylistAction[] | null
}

export interface TrackDto {
  id: string
  externalId: string
  externalSource: string
  title: string
  artist: string
  artistId: string | null
  album: string | null
  albumImageUrl: string | null
  duration: number | null
  externalUrl: string
}

export type SyncChoice = 'merge' | 'upload-new'

export interface SyncResult {
  /** Cloud playlists that don't exist locally — create these locally */
  newFromCloud: Playlist[]
  /** Extra tracks in matched cloud playlists that local doesn't have */
  extraTracks: Array<{ localId: string; tracks: TrackResult[] }>
  /** Map of local playlist ID → cloud playlist UUID */
  cloudIdMap: Record<string, string>
  /** Map of cloud playlist UUID → version number */
  versionMap: Record<string, number>
}

/* ========== API calls ========== */

/**
 * Resolve external track references to server-side TrackDto (with UUIDs).
 */
export async function resolveTracks(
  accessToken: string,
  tracks: TrackUploadDto[],
): Promise<TrackDto[]> {
  if (tracks.length === 0) return []
  try {
    const res = await fetch(`${BASE_URL}/api/tracks/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(tracks),
    })
    if (!res.ok) return []
    return (await res.json()) as TrackDto[]
  } catch {
    return []
  }
}

/**
 * Bulk sync/upload playlists. Server matches by title (creates or updates).
 * Returns full details with current version and tracks.
 */
export async function syncPlaylists(
  accessToken: string,
  playlists: Playlist[],
): Promise<CloudPlaylistDetail[]> {
  if (playlists.length === 0) return []
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
    if (!res.ok) return []
    return (await res.json()) as CloudPlaylistDetail[]
  } catch {
    return []
  }
}

/**
 * Create a single new playlist (no title-based matching).
 */
export async function createCloudPlaylist(
  accessToken: string,
  request: { title: string; description: string | null; imageUrl: string | null; isPublic: boolean },
): Promise<CloudPlaylistDetail | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/playlists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    })
    if (!res.ok) return null
    return (await res.json()) as CloudPlaylistDetail
  } catch {
    return null
  }
}

/**
 * Fetch all cloud playlist summaries.
 */
export async function fetchCloudPlaylists(
  accessToken: string,
): Promise<CloudPlaylistSummary[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/playlists`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return []
    return (await res.json()) as CloudPlaylistSummary[]
  } catch {
    return []
  }
}

/**
 * Fetch a single playlist full detail (with tracks + version).
 */
export async function fetchCloudPlaylistDetail(
  accessToken: string,
  playlistId: string,
): Promise<CloudPlaylistDetail | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return (await res.json()) as CloudPlaylistDetail
  } catch {
    return null
  }
}

/**
 * Get diff (server changes) since a given version.
 */
export async function diffPlaylist(
  accessToken: string,
  playlistId: string,
  sinceVersion: number,
): Promise<PlaylistDiffResponse | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/playlists/${playlistId}/diff?sinceVersion=${sinceVersion}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) return null
    return (await res.json()) as PlaylistDiffResponse
  } catch {
    return null
  }
}

/**
 * Send local actions for a single playlist. Returns new version + server actions.
 * Handles 409 (version conflict) by reading the body — the server sends the
 * current state even when versions clash.
 */
export async function syncPlaylist(
  accessToken: string,
  playlistId: string,
  clientVersion: number,
  localActions: PlaylistSyncActionDto[],
): Promise<PlaylistSyncResponse | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/playlists/${playlistId}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ clientVersion, localActions } satisfies PlaylistSyncRequest),
    })
    // 409 still has a valid body with newVersion + serverActions
    const body = (await res.json()) as PlaylistSyncResponse
    if (body && typeof body.newVersion === 'number') return body
    if (res.ok) return body
    return null
  } catch {
    return null
  }
}

/**
 * Add a single track to a cloud playlist.
 * Returns the new playlist version, or null on failure.
 */
export async function addTrackToCloudPlaylist(
  accessToken: string,
  playlistId: string,
  track: TrackResult,
): Promise<number | null> {
  try {
    const dto = mapTrackToDto(track)
    const res = await fetch(`${BASE_URL}/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(dto),
    })
    if (!res.ok) return null
    const detail = (await res.json()) as CloudPlaylistDetail
    return detail.version ?? null
  } catch {
    return null
  }
}

/**
 * Remove a single track from a cloud playlist.
 * Resolves the external track to a server-side UUID first, then calls DELETE.
 * Returns the new playlist version (may be null if the response has no body).
 */
export async function removeTrackFromCloudPlaylist(
  accessToken: string,
  playlistId: string,
  track: TrackResult,
): Promise<number | null> {
  try {
    console.log('[removeTrack] resolving external track:', track.id, track.title)
    const dto = mapTrackToDto(track)
    const resolved = await resolveTracks(accessToken, [dto])
    if (resolved.length === 0 || !resolved[0].id) {
      console.warn('[removeTrack] failed to resolve track to server UUID', track.id)
      return null
    }
    console.log('[removeTrack] resolved to server UUID:', resolved[0].id)

    const url = `${BASE_URL}/api/playlists/${playlistId}/tracks/${resolved[0].id}`
    console.log('[removeTrack] DELETE', url)
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    console.log('[removeTrack] response status:', res.status)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[removeTrack] server returned', res.status, text)
      return null
    }

    try {
      const body = await res.json() as { version?: number }
      console.log('[removeTrack] success, new version:', body.version)
      return body.version ?? null
    } catch {
      console.log('[removeTrack] success, no body returned')
      return null
    }
  } catch (e) {
    console.error('[removeTrack] unexpected error:', e)
    return null
  }
}

/**
 * Delete a cloud playlist entirely.
 * Returns true if the server accepted the deletion.
 */
export async function deleteCloudPlaylist(
  accessToken: string,
  playlistId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/playlists/${playlistId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Fetch list of soft-deleted cloud playlists (trash).
 */
export async function fetchDeletedCloudPlaylists(
  accessToken: string,
): Promise<CloudPlaylistSummary[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/playlists/deleted`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return []
    return (await res.json()) as CloudPlaylistSummary[]
  } catch {
    return []
  }
}

/**
 * Restore a soft-deleted cloud playlist from trash.
 */
export async function restoreCloudPlaylist(
  accessToken: string,
  playlistId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/playlists/${playlistId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Permanently delete a cloud playlist (force delete, bypasses trash).
 */
export async function forceDeleteCloudPlaylist(
  accessToken: string,
  playlistId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/playlists/${playlistId}/force`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok
  } catch {
    return false
  }
}

/* ========== Orchestration ========== */

/**
 * Full sync after login/register.
 *
 * 1. Resolves all unique local tracks to server UUIDs.
 * 2. Based on choice:
 *    - 'merge': bulk-upload playlists (server matches by title),
 *      then returns extra tracks from cloud + unmatched cloud playlists.
 *    - 'upload-new': creates each playlist individually with `POST /api/playlists`,
 *      then uploads tracks via per-playlist sync.
 */
export async function syncAfterLogin(
  accessToken: string,
  localPlaylists: Playlist[],
  choice: SyncChoice,
): Promise<SyncResult> {
  const result: SyncResult = {
    newFromCloud: [],
    extraTracks: [],
    cloudIdMap: {},
    versionMap: {},
  }

  if (localPlaylists.length === 0) return result

  // 1. Collect all unique tracks and resolve them
  const seen = new Set<string>()
  const allDtos: TrackUploadDto[] = []
  for (const pl of localPlaylists) {
    for (const track of pl.tracks) {
      if (!seen.has(track.id)) {
        seen.add(track.id)
        allDtos.push(mapTrackToDto(track))
      }
    }
  }

  let resolved: TrackDto[] = []
  if (allDtos.length > 0) {
    resolved = await resolveTracks(accessToken, allDtos)
  }

  // Map externalId → server UUID
  const extToUuid = new Map<string, string>()
  for (const rt of resolved) {
    extToUuid.set(rt.externalId, rt.id)
  }

  if (choice === 'merge') {
    await syncMerge(accessToken, localPlaylists, extToUuid, result)
  } else {
    await syncUploadNew(accessToken, localPlaylists, extToUuid, result)
  }

  return result
}

async function syncMerge(
  accessToken: string,
  localPlaylists: Playlist[],
  extToUuid: Map<string, string>,
  result: SyncResult,
): Promise<void> {
  // Bulk upload — server matches by title, returns full current state
  const cloudDetails = await syncPlaylists(accessToken, localPlaylists)
  if (!cloudDetails.length) return

  const localByName = new Map(
    localPlaylists.map((p) => [p.name.toLowerCase().trim(), p]),
  )
  const handledCloud = new Set<string>()

  for (const detail of cloudDetails) {
    const local = localByName.get(detail.title.toLowerCase().trim())
    if (local) {
      // Matched by title
      result.cloudIdMap[local.id] = detail.id
      result.versionMap[detail.id] = detail.version

      // Check for extra tracks in cloud that local doesn't have
      const localIds = new Set(local.tracks.map((t) => t.id))
      const extras = detail.tracks
        .filter((t) => !localIds.has(t.externalId))
        .map(cloudTrackToLocal)
      if (extras.length > 0) {
        result.extraTracks.push({ localId: local.id, tracks: extras })
      }
      handledCloud.add(detail.id)
    }
  }

  // Cloud-only playlists (no local match) → create locally
  for (const detail of cloudDetails) {
    if (handledCloud.has(detail.id)) continue

    const cloudTrackIds = new Set(detail.tracks.map((t) => t.externalId))
    const alreadyMatchedLocals = new Set(Object.keys(result.cloudIdMap))

    // Try to find a local playlist with the same name AND same tracks (already synced but cloudId lost after re-login)
    const contentMatch = localPlaylists.find(
      (p) =>
        !alreadyMatchedLocals.has(p.id) &&
        p.name.toLowerCase().trim() === detail.title.toLowerCase().trim() &&
        p.tracks.length > 0 &&
        p.tracks.every((t) => cloudTrackIds.has(t.id)),
    )
    if (contentMatch) {
      result.cloudIdMap[contentMatch.id] = detail.id
      result.versionMap[detail.id] = detail.version
      continue
    }

    result.newFromCloud.push({
      id: `cloud_${detail.id}`,
      name: detail.title,
      cover: detail.imageUrl,
      tracks: detail.tracks.map(cloudTrackToLocal),
      createdAt: new Date(detail.createdAt).getTime(),
    })
    result.versionMap[detail.id] = detail.version
  }
}

async function syncUploadNew(
  accessToken: string,
  localPlaylists: Playlist[],
  extToUuid: Map<string, string>,
  result: SyncResult,
): Promise<void> {
  for (const pl of localPlaylists) {
    // Create new playlist on server
    const created = await createCloudPlaylist(accessToken, {
      title: pl.name,
      description: null,
      imageUrl: pl.cover,
      isPublic: false,
    })
    if (!created) continue

    // Upload all tracks via per-playlist sync with server UUIDs
    const actions: PlaylistSyncActionDto[] = pl.tracks.map((t) => ({
      actionType: 'add',
      trackId: extToUuid.get(t.id) ?? null,
      position: null,
    }))

    const syncResp =
      actions.length > 0
        ? await syncPlaylist(accessToken, created.id, 1, actions)
        : null

    result.cloudIdMap[pl.id] = created.id
    result.versionMap[created.id] = syncResp?.newVersion ?? created.version
  }
}
