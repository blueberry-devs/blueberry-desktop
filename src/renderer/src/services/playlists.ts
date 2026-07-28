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

export interface PaginatedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CloudPlaylistDetail {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublic: boolean
  version: number
  totalTracks: number
  currentPage: number
  pageSize: number
  totalPages: number
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
 * Fetch a single playlist full detail (with paginated tracks).
 * Supports If-None-Match conditional requests using playlist version ETag.
 * Page numbers are 1-based; pageSize is capped at 30 by the server.
 * Cache is keyed by playlistId + page + pageSize so 304 works correctly across pages.
 */
const _detailEtags = new Map<string, string>()
const _detailCache = new Map<string, CloudPlaylistDetail>()

function _detailCacheKey(playlistId: string, page: number, pageSize: number): string {
  return `${playlistId}:p${page}:s${pageSize}`
}

export async function fetchCloudPlaylistDetail(
  accessToken: string,
  playlistId: string,
  page = 1,
  pageSize = 30,
): Promise<CloudPlaylistDetail | null> {
  try {
    const key = _detailCacheKey(playlistId, page, pageSize)
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }
    const etag = _detailEtags.get(key)
    if (etag) {
      headers['If-None-Match'] = etag
    }
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const res = await fetch(`${BASE_URL}/api/playlists/${playlistId}?${params}`, { headers })
    if (res.status === 304) {
      return _detailCache.get(key) ?? null
    }
    if (!res.ok) return null

    const newEtag = res.headers.get('ETag')
    if (newEtag) _detailEtags.set(key, newEtag)

    const detail = (await res.json()) as CloudPlaylistDetail
    _detailCache.set(key, detail)
    return detail
  } catch {
    return null
  }
}

/**
 * Fetch ALL tracks from a cloud playlist by iterating pages.
 * Merges tracks from every page into a single CloudPlaylistDetail.
 * Returns null if any page fails.
 */
export async function fetchAllCloudPlaylistTracks(
  accessToken: string,
  playlistId: string,
): Promise<CloudPlaylistDetail | null> {
  try {
    const first = await fetchCloudPlaylistDetail(accessToken, playlistId, 1, 30)
    if (!first) return null

    const allTracks = [...first.tracks]

    for (let p = 2; p <= first.totalPages; p++) {
      const page = await fetchCloudPlaylistDetail(accessToken, playlistId, p, 30)
      if (!page) return null
      allTracks.push(...page.tracks)
    }

    return { ...first, tracks: allTracks }
  } catch {
    return null
  }
}

/**
 * Get diff (server changes) since a given version.
 * Handles 304 (no changes) by returning null (caller treats null as "no diff").
 */
export async function diffPlaylist(
  accessToken: string,
  playlistId: string,
  sinceVersion: number,
): Promise<PlaylistDiffResponse | null> {
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }
    const etag = _detailEtags.get(playlistId)
    if (etag) {
      headers['If-None-Match'] = etag
    }
    const res = await fetch(
      `${BASE_URL}/api/playlists/${playlistId}/diff?sinceVersion=${sinceVersion}`,
      { headers },
    )
    if (res.status === 304) return null
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

export type DeletedPlaylistSortBy = 0 | 1 | 2 // 0 = deletedAt, 1 = name, 2 = trackCount
export type SortDirection = 0 | 1 // 0 = asc, 1 = desc

/**
 * Fetch a page of soft-deleted cloud playlists (trash).
 * Supports If-None-Match conditional requests using LibraryVersion ETag.
 * Returns the paginated result, or null on failure.
 * Cache is keyed by page + pageSize + sort params.
 */
const _deletedEtags = new Map<string, string>()
const _deletedCacheMap = new Map<string, PaginatedResult<CloudPlaylistSummary>>()

function _deletedCacheKey(page: number, pageSize: number, sortBy: DeletedPlaylistSortBy, sortDirection: SortDirection): string {
  return `p${page}:s${pageSize}:b${sortBy}:d${sortDirection}`
}

export async function fetchDeletedCloudPlaylists(
  accessToken: string,
  page = 1,
  pageSize = 20,
  sortBy: DeletedPlaylistSortBy = 0,
  sortDirection: SortDirection = 1,
): Promise<PaginatedResult<CloudPlaylistSummary> | null> {
  try {
    const key = _deletedCacheKey(page, pageSize, sortBy, sortDirection)
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }
    const etag = _deletedEtags.get(key)
    if (etag) {
      headers['If-None-Match'] = etag
    }
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy: String(sortBy),
      sortDirection: String(sortDirection),
    })
    const res = await fetch(`${BASE_URL}/api/playlists/deleted?${params}`, { headers })
    if (res.status === 304) {
      // Not modified — return cached data
      return _deletedCacheMap.get(key) ?? null
    }
    if (!res.ok) return null

    // Update ETag from response
    const responseEtag = res.headers.get('ETag')
    if (responseEtag) _deletedEtags.set(key, responseEtag)

    const body = await res.json()
    // Handle both array (old) and PaginatedResult (new) response shapes
    let result: PaginatedResult<CloudPlaylistSummary>
    if (Array.isArray(body)) {
      result = {
        items: body as CloudPlaylistSummary[],
        totalCount: body.length,
        page: 1,
        pageSize: body.length,
        totalPages: 1,
      }
    } else if (body && Array.isArray(body.items)) {
      result = body as PaginatedResult<CloudPlaylistSummary>
    } else {
      result = { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }
    }

    // Cache for 304 handling
    _deletedCacheMap.set(key, result)
    return result
  } catch {
    return null
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

/** Clear all conditional-request ETag caches (call on logout). */
export function clearPlaylistCache(): void {
  _deletedEtags.clear()
  _deletedCacheMap.clear()
  _detailEtags.clear()
  _detailCache.clear()
}

/* ========== Likes API ========== */

export interface UserLikeDto {
  id: string
  entityType: string
  entityId: string
  createdAt: string
  track: TrackDto | null
  playlist: PlaylistSummaryDto | null
}

export interface BatchLikeRequest {
  clientVersion: number | null
  actions: ToggleLikeRequest[]
}

export interface ToggleLikeRequest {
  entityType: string
  entityId: string
}

export interface BatchLikeResult {
  accepted: boolean
  newVersion: number
  results: UserLikeDto[] | null
  conflictDiff: LibraryDiffResponse | null
}

/**
 * Fetch just the set of liked track UUIDs.
 * Used by the frontend to highlight ❤️ in track-list views.
 */
export async function fetchLikedTrackIds(
  accessToken: string,
): Promise<string[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/likes/track-ids`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return []
    return (await res.json()) as string[]
  } catch {
    return []
  }
}

/**
 * Fetch a single page of liked entities, optionally filtered by type.
 * Returns the paginated result or null on failure.
 * Max pageSize is 30 (enforced by server).
 */
export async function fetchUserLikesPage(
  accessToken: string,
  page = 1,
  pageSize = 30,
  entityType?: string,
): Promise<PaginatedResult<UserLikeDto> | null> {
  try {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (entityType) params.set('entityType', entityType)
    const res = await fetch(`${BASE_URL}/api/likes?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return (await res.json()) as PaginatedResult<UserLikeDto>
  } catch {
    return null
  }
}

/**
 * Fetch ALL liked entities, optionally filtered by type.
 * Iterates over all pages and merges results into a flat array.
 */
export async function fetchUserLikes(
  accessToken: string,
  entityType?: string,
): Promise<UserLikeDto[]> {
  try {
    const first = await fetchUserLikesPage(accessToken, 1, 30, entityType)
    if (!first) return []

    const allItems = [...first.items]

    for (let p = 2; p <= first.totalPages; p++) {
      const page = await fetchUserLikesPage(accessToken, p, 30, entityType)
      if (!page) break
      allItems.push(...page.items)
    }

    return allItems
  } catch {
    return []
  }
}

/**
 * Batch-like multiple tracks/playlists in one request (offline-to-online sync).
 * Idempotent — already-liked items are silently skipped.
 *
 * If clientVersion doesn't match the server version, returns a result with
 * accepted: false and a conflictDiff so the client can catch up before retrying.
 */
export async function batchSyncLikes(
  accessToken: string,
  request: BatchLikeRequest,
): Promise<BatchLikeResult | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/likes/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    })
    const body = (await res.json()) as BatchLikeResult
    if (!body || typeof body.accepted !== 'boolean') return null
    return body
  } catch {
    return null
  }
}

/**
 * Like a track or playlist. Returns the UserLikeDto on success.
 */
export async function likeEntity(
  accessToken: string,
  entityType: string,
  entityId: string,
): Promise<UserLikeDto | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/likes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ entityType, entityId } satisfies ToggleLikeRequest),
    })
    if (!res.ok) return null
    return (await res.json()) as UserLikeDto
  } catch {
    return null
  }
}

/**
 * Remove a like from a track or playlist.
 */
export async function unlikeEntity(
  accessToken: string,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/likes/${entityType}/${entityId}`, {
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
