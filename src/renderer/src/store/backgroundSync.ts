import { getPlaylists, addTracksSilently, addPlaylistFromCloud, setPlaylistCloudId, hasPendingCloudRequest, isUuid } from './playlists'
import { getPlaylistVersion, setPlaylistVersion } from './playlistVersions'
import { isSynced, markSynced, getUnsyncedGeneration } from './playlistSync'
import { isAuthenticated, getAuth } from './auth'
import {
  resolveTracks,
  syncPlaylists as bulkSyncPlaylists,
  fetchCloudPlaylists,
  fetchAllCloudPlaylistTracks,
  syncPlaylist,
  fetchUserLikes,
} from '../services/playlists'
import type { TrackResult } from '../api/yandexMusic'
import type { TrackUploadDto } from '../services/playlists'
import { getLikedTracks, toggleLike as toggleLikeLocal } from './likes'

const POLL_INTERVAL_MS = 60_000 // check every 60s

let bgInterval: ReturnType<typeof setInterval> | null = null
let isSyncing = false

/** Collect all unique tracks from playlists into TrackUploadDto[] */
function collectTrackDtos(playlists: { tracks: TrackResult[] }[]): TrackUploadDto[] {
  const seen = new Set<string>()
  const dtos: TrackUploadDto[] = []
  for (const pl of playlists) {
    for (const track of pl.tracks) {
      if (!seen.has(track.id)) {
        seen.add(track.id)
        dtos.push({
          externalId: track.id,
          externalSource:
            track.source === 'yandex'
              ? 'YandexMusic'
              : track.source === 'youtube'
              ? 'YouTubeMusic'
              : 'SoundCloud',
          externalUrl: (() => {
            const rawId = track.id.replace(/^(youtube|yandex|soundcloud|sc|yt|ym):/, '')
            switch (track.source) {
              case 'youtube':
                return `https://music.youtube.com/watch?v=${rawId}`
              case 'soundcloud':
                return `https://soundcloud.com/search?q=${encodeURIComponent(track.title)}`
              case 'yandex':
                return `https://music.yandex.ru/track/${rawId}`
            }
          })(),
          title: track.title,
          artist: track.artists.join(', '),
          artistId: null,
          album: null,
          albumImageUrl: track.cover,
          duration: track.duration ?? null,
        })
      }
    }
  }
  return dtos
}

/** Compare local track IDs with cloud track IDs to see if they match */
function tracksMatch(local: { tracks: TrackResult[] }, cloudTrackIds: Set<string>): boolean {
  if (local.tracks.length === 0 && cloudTrackIds.size === 0) return true
  if (local.tracks.length === 0 || cloudTrackIds.size === 0) return false
  return local.tracks.every((t) => cloudTrackIds.has(t.id))
}

/** Link a local playlist that matched a cloud playlist by name */
function linkMatchedPlaylist(localId: string, cloudId: string, version: number): void {
  const pl = getPlaylists().find((p) => p.id === localId)
  if (pl?.id === cloudId) {
    setPlaylistVersion(cloudId, version)
    return
  }
  setPlaylistCloudId(localId, cloudId)
  setPlaylistVersion(cloudId, version)
}

/** Check if a cloud playlist matches any local playlist by name + track content, skipping already-synced ones */
function findMatchedLocal(
  localPlaylists: ReturnType<typeof getPlaylists>,
  cloudTitle: string,
  cloudTrackIds: Set<string>,
): { localId: string; cloudVersion: number } | null {
  for (const pl of localPlaylists) {
    if (isUuid(pl.id)) continue // already synced (has UUID = has server id)
    if (pl.name.toLowerCase().trim() !== cloudTitle.toLowerCase().trim()) continue
    if (!tracksMatch(pl, cloudTrackIds)) continue
    return { localId: pl.id, cloudVersion: 0 }
  }
  return null
}

/** Assign UUID to playlist that still has an old prefixed id */
function ensureAllUuids(): void {
  for (const pl of getPlaylists()) {
    if (!isUuid(pl.id)) {
      setPlaylistCloudId(pl.id, crypto.randomUUID())
    }
  }
}

/**
 * Download server-side liked tracks from other devices.
 * Individual likes/unlikes are already sent immediately by toggleLike,
 * so this is only needed on app startup / login to pick up cross-device likes.
 * Safe to call manually on critical desync.
 */
export async function syncLikes(token: string): Promise<void> {
  try {
    const currentLikes = getLikedTracks()
    const localIds = new Set(currentLikes.map((t) => t.id))
    const serverLikes = await fetchUserLikes(token, 'track')
    const newTracks: TrackResult[] = []

    for (const like of serverLikes) {
      if (!like.track?.externalId) continue
      const extId = like.track.externalId
      if (localIds.has(extId)) continue

      newTracks.push({
        id: extId,
        source:
          like.track.externalSource === 'YouTubeMusic'
            ? 'youtube'
            : like.track.externalSource === 'SoundCloud'
            ? 'soundcloud'
            : 'yandex',
        title: like.track.title,
        artists: like.track.artist ? [like.track.artist] : [],
        cover: like.track.albumImageUrl,
        duration: like.track.duration ?? undefined,
      })
    }

    for (const track of newTracks) {
      toggleLikeLocal(track)
    }
  } catch {
    // Next cycle will retry
  }
}

async function runSync(): Promise<void> {
  if (isSyncing) return
  isSyncing = true
  const genBefore = getUnsyncedGeneration()
  try {
    const token = getAuth().accessToken
    if (!token) return

    // Ensure all playlists have UUID as id BEFORE we fetch server data
    // (so old pl_ prefixed playlists get a UUID and become syncable)
    ensureAllUuids()

    // ===== Playlist sync =====
    const localPlaylists = getPlaylists()
    if (localPlaylists.length === 0) {
      markSynced()
      return
    }

    // 1. Resolve all unique tracks
    const allDtos = collectTrackDtos(localPlaylists)
    const resolved = allDtos.length > 0 ? await resolveTracks(token, allDtos) : []
    const extToUuid = new Map<string, string>()
    for (const rt of resolved) {
      extToUuid.set(rt.externalId, rt.id)
    }

    // 2. Fetch all server playlists
    const allSummaries = await fetchCloudPlaylists(token)
    const serverIds = new Set(allSummaries.map((s) => s.id))

    // 3. Match local UUIDs to server UUIDs
    //    For playlists with UUID that exist on server → linked
    //    For playlists with UUID not on server → must upload
    //    (All playlists now have UUID from ensureAllUuids)
    const linkedLocal = localPlaylists.filter((p) => serverIds.has(p.id))
    const newLocal = localPlaylists.filter(
      (p) => !serverIds.has(p.id) && !hasPendingCloudRequest(p.id),
    )

    // 4. Upload truly new playlists (UUID exists locally but not on server)
    if (newLocal.length > 0) {
      const created = await bulkSyncPlaylists(token, newLocal)
      for (const detail of created) {
        const local = newLocal.find(
          (p) => p.name.toLowerCase().trim() === detail.title.toLowerCase().trim(),
        )
        if (local) {
          setPlaylistVersion(local.id, detail.version)
        }
      }
    }

    // 5. Sync linked playlists + handle cloud-only playlists
    //    Fetch ALL relevant server details in parallel (linked + cloud-only)
    const unlinkedSummaries = allSummaries.filter(
      (s) => !linkedLocal.some((pl) => pl.id === s.id),
    )

    const detailTargets = [
      ...linkedLocal.map((pl) => ({ id: pl.id, isLinked: true as const })),
      ...unlinkedSummaries.map((s) => ({ id: s.id, isLinked: false as const })),
    ]
    const details = await Promise.all(
      detailTargets.map((t) =>
        fetchAllCloudPlaylistTracks(token, t.id).then((d) => ({ ...t, detail: d })),
      ),
    )

    for (const { id, isLinked, detail: cloudDetail } of details) {
      if (!cloudDetail) continue

      if (isLinked) {
        // Existing linked playlist — check for server-side changes
        const pl = getPlaylists().find((p) => p.id === id)
        if (!pl) continue
        if (hasPendingCloudRequest(id)) continue

        const storedVersion = getPlaylistVersion(id)

        // Server has newer tracks → add them locally
        if (storedVersion > 0 && storedVersion < cloudDetail.version) {
          const serverAdds = cloudDetail.tracks
            .filter((t) => t.externalId && !pl.tracks.some((lt) => lt.id === t.externalId))
            .map((t) => ({
              id: t.externalId,
              source: (t.externalSource === 'YouTubeMusic' ? 'youtube'
                : t.externalSource === 'SoundCloud' ? 'soundcloud' : 'yandex') as TrackResult['source'],
              title: t.title,
              artists: t.artist ? [t.artist] : [],
              cover: t.albumImageUrl,
              duration: t.duration ?? undefined,
            }))
          if (serverAdds.length > 0) {
            addTracksSilently(pl.id, serverAdds)
          }
        }

        // Local has tracks server doesn't → push them
        const serverTrackIds = new Set(cloudDetail.tracks.map((t) => t.externalId))
        const localAdds = pl.tracks
          .filter((t) => !serverTrackIds.has(t.id))
          .map((t) => ({
            actionType: 'add' as const,
            trackId: extToUuid.get(t.id) ?? null,
            position: null as number | null,
          }))

        if (localAdds.length > 0) {
          const resp = await syncPlaylist(token, id, Math.max(getPlaylistVersion(id), 1), localAdds)
          if (resp) {
            setPlaylistVersion(id, resp.newVersion)
          }
        } else {
          setPlaylistVersion(id, cloudDetail.version)
        }
      } else {
        // Cloud-only (not yet linked to any local playlist)
        const cloudTrackIds = new Set(cloudDetail.tracks.map((t) => t.externalId))

        // Try matching by name + content with non-UUID (unsynced) playlists
        const matched = findMatchedLocal(getPlaylists(), cloudDetail.title, cloudTrackIds)
        if (matched) {
          linkMatchedPlaylist(matched.localId, id, cloudDetail.version)
          continue
        }

        // Check if any local playlist already has this name → link or skip (server-side duplicate)
        const localWithName = getPlaylists().find(
          (p) => p.name.toLowerCase().trim() === cloudDetail.title.toLowerCase().trim(),
        )
        if (localWithName) {
          if (!isUuid(localWithName.id)) {
            linkMatchedPlaylist(localWithName.id, id, cloudDetail.version)
            const localOnly = localWithName.tracks.filter((t) => !cloudTrackIds.has(t.id))
            if (localOnly.length > 0 && !hasPendingCloudRequest(id)) {
              const actions = localOnly
                .map((t) => ({ uuid: extToUuid.get(t.id) ?? null }))
                .filter((a) => a.uuid)
              if (actions.length > 0) {
                const resp = await syncPlaylist(token, id, Math.max(cloudDetail.version, 1),
                  actions.map((a) => ({ actionType: 'add' as const, trackId: a.uuid, position: null as number | null })))
                if (resp) setPlaylistVersion(id, resp.newVersion)
              }
            }
          }
          // Either way — don't create local duplicate
          continue
        }

        // Genuinely new cloud-only playlist → create locally
        addPlaylistFromCloud({
          id: cloudDetail.id,
          name: cloudDetail.title,
          cover: cloudDetail.imageUrl,
          tracks: cloudDetail.tracks.map((t) => ({
            id: t.externalId,
            source: (t.externalSource === 'YouTubeMusic' ? 'youtube'
              : t.externalSource === 'SoundCloud' ? 'soundcloud' : 'yandex') as TrackResult['source'],
            title: t.title,
            artists: t.artist ? [t.artist] : [],
            cover: t.albumImageUrl,
            duration: t.duration ?? undefined,
          })),
          createdAt: new Date(cloudDetail.createdAt).getTime(),
        })
        setPlaylistVersion(cloudDetail.id, cloudDetail.version)
      }
    }

    if (genBefore === getUnsyncedGeneration()) {
      markSynced()
    }
  } catch {
    // leave unsynced — next tick retries
  } finally {
    isSyncing = false
  }
}

function tick(): void {
  if (!isAuthenticated()) return
  if (!isSynced()) {
    runSync()
  }
}

/** Start background sync polling. Safe to call multiple times. */
export function startBackgroundSync(): void {
  stopBackgroundSync()

  // Initial playlist check
  tick()
  bgInterval = setInterval(tick, POLL_INTERVAL_MS)
}

/** Stop background sync polling. */
export function stopBackgroundSync(): void {
  if (bgInterval !== null) {
    clearInterval(bgInterval)
    bgInterval = null
  }
}
