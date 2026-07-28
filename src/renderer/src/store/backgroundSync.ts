import { getPlaylists, addTracksSilently, addPlaylistFromCloud, setPlaylistCloudId, hasPendingCloudRequest } from './playlists'
import { getPlaylistVersion, setPlaylistVersion } from './playlistVersions'
import { isSynced, markSynced, getUnsyncedGeneration } from './playlistSync'
import { isAuthenticated, getAuth } from './auth'
import {
  resolveTracks,
  syncPlaylists as bulkSyncPlaylists,
  fetchCloudPlaylists,
  fetchAllCloudPlaylistTracks,
  diffPlaylist,
  syncPlaylist,
  fetchUserLikes,
} from '../services/playlists'
import type { TrackResult } from '../api/yandexMusic'
import type { TrackUploadDto } from '../services/playlists'
import { getLikedTracks, toggleLike as toggleLikeLocal } from './likes'

const POLL_INTERVAL_MS = 60_000 // check every 60s
const FAST_INTERVAL_MS = 15_000 // when unsynced, check more often

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
  // Check that every local track exists on the server (server may have more = ok)
  return local.tracks.every((t) => cloudTrackIds.has(t.id))
}

/** Link a local playlist that matched a cloud playlist by content */
function linkMatchedPlaylist(localId: string, cloudId: string, version: number): void {
  const pl = getPlaylists().find((p) => p.id === localId)
  if (pl?.cloudId === cloudId) {
    setPlaylistVersion(cloudId, version)
    return
  }
  setPlaylistCloudId(localId, cloudId)
  setPlaylistVersion(cloudId, version)
}

/** Check if a cloud playlist matches any local playlist by name + track content */
function findMatchedLocal(
  localPlaylists: ReturnType<typeof getPlaylists>,
  cloudTitle: string,
  cloudTrackIds: Set<string>,
): { localId: string; cloudVersion: number } | null {
  for (const pl of localPlaylists) {
    if (pl.cloudId) continue // already linked
    if (pl.name.toLowerCase().trim() !== cloudTitle.toLowerCase().trim()) continue
    if (!tracksMatch(pl, cloudTrackIds)) continue
    return { localId: pl.id, cloudVersion: 0 }
  }
  return null
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

    // ===== Playlist sync =====
    const localPlaylists = getPlaylists()
    if (localPlaylists.length === 0) {
      markSynced()
    } else {
      // 1. Resolve all unique tracks
      const allDtos = collectTrackDtos(localPlaylists)
      const resolved = allDtos.length > 0 ? await resolveTracks(token, allDtos) : []
      const extToUuid = new Map<string, string>()
      for (const rt of resolved) {
        extToUuid.set(rt.externalId, rt.id)
      }

      // 2. Fetch all server playlists FIRST to match by name — prevents duplicates
      const allSummaries = await fetchCloudPlaylists(token)
      const localByName = new Map<string, typeof localPlaylists[0]>()
      for (const pl of localPlaylists) {
        if (!pl.cloudId) {
          const key = pl.name.toLowerCase().trim()
          if (!localByName.has(key)) localByName.set(key, pl)
        }
      }

      const serverTitleSet = new Set<string>()
      for (const s of allSummaries) {
        const key = s.title.toLowerCase().trim()
        serverTitleSet.add(key)
        const local = localByName.get(key)
        if (local && !getPlaylists().find((p) => p.cloudId === s.id)) {
          linkMatchedPlaylist(local.id, s.id, 0)
        }
      }

      // 3. Only upload playlists that have no cloudId AND no name match on server
      const updatedLocal = getPlaylists()
      const newPls = updatedLocal.filter((p) => !p.cloudId && !serverTitleSet.has(p.name.toLowerCase().trim()))
      if (newPls.length > 0) {
        const created = await bulkSyncPlaylists(token, newPls)
        for (const detail of created) {
          const local = newPls.find(
            (p) => p.name.toLowerCase().trim() === detail.title.toLowerCase().trim(),
          )
          if (local) {
            linkMatchedPlaylist(local.id, detail.id, detail.version)
          }
        }
      }

      // 4. Handle existing (linked) playlists — per-playlist diff+sync
      const syncedLocal = getPlaylists()
      for (const pl of syncedLocal) {
        if (!pl.cloudId) continue
        if (hasPendingCloudRequest(pl.cloudId)) continue

        const cloudDetail = await fetchAllCloudPlaylistTracks(token, pl.cloudId)
        if (!cloudDetail) continue

        let storedVersion = getPlaylistVersion(pl.cloudId)
        let effectiveVersion = storedVersion

        if (storedVersion > 0 && storedVersion < cloudDetail.version) {
          const diff = await diffPlaylist(token, pl.cloudId, storedVersion)
          if (diff) {
            effectiveVersion = diff.currentVersion
            const newTracks: TrackResult[] = []
            for (const action of diff.actions) {
              if (action.actionType === 'add_track' && action.trackExternalId) {
                newTracks.push({
                  id: action.trackExternalId,
                  source: action.trackExternalSource === 'YouTubeMusic' ? 'youtube'
                    : action.trackExternalSource === 'SoundCloud' ? 'soundcloud' : 'yandex',
                  title: action.trackTitle ?? '',
                  artists: action.trackArtist ? [action.trackArtist] : [],
                  cover: null,
                  duration: undefined,
                })
              }
            }
            addTracksSilently(pl.id, newTracks)
          }
        }

        const serverIds = new Set(cloudDetail.tracks.map((t) => t.externalId))
        const localAdds = pl.tracks
          .filter((t) => !serverIds.has(t.id))
          .map((t) => ({
            actionType: 'add' as const,
            trackId: extToUuid.get(t.id) ?? null,
            position: null as number | null,
          }))

        if (localAdds.length > 0 || storedVersion < cloudDetail.version) {
          const resp = await syncPlaylist(token, pl.cloudId, Math.max(effectiveVersion, 1), localAdds)
          if (resp) {
            setPlaylistVersion(pl.cloudId, resp.newVersion)
            if (resp.serverActions) {
              const serverAdds: TrackResult[] = []
              for (const action of resp.serverActions) {
                if (action.actionType === 'add_track' && action.trackExternalId) {
                  serverAdds.push({
                    id: action.trackExternalId,
                    source: action.trackExternalSource === 'YouTubeMusic' ? 'youtube'
                      : action.trackExternalSource === 'SoundCloud' ? 'soundcloud' : 'yandex',
                    title: action.trackTitle ?? '',
                    artists: action.trackArtist ? [action.trackArtist] : [],
                    cover: null,
                    duration: undefined,
                  })
                }
              }
              addTracksSilently(pl.id, serverAdds)
            }
          }
        } else {
          setPlaylistVersion(pl.cloudId, cloudDetail.version)
        }
      }

      // 5. Check for cloud-only playlists (created on other device, not yet linked)
      const localCloudIds = new Set(
        getPlaylists().filter((p) => p.cloudId).map((p) => p.cloudId),
      )
      const finalLocal = getPlaylists()

      for (const summary of allSummaries) {
        if (localCloudIds.has(summary.id)) continue

        const detail = await fetchAllCloudPlaylistTracks(token, summary.id)
        if (!detail) continue

        const cloudTrackIds = new Set(detail.tracks.map((t) => t.externalId))

        const matched = findMatchedLocal(finalLocal, summary.title, cloudTrackIds)
        if (matched) {
          linkMatchedPlaylist(matched.localId, summary.id, detail.version)
          continue
        }

        const nameMatch = finalLocal.find(
          (p) => !p.cloudId && p.name.toLowerCase().trim() === summary.title.toLowerCase().trim(),
        )
        if (nameMatch) {
          linkMatchedPlaylist(nameMatch.id, summary.id, detail.version)
          const localOnly = nameMatch.tracks.filter((t) => !cloudTrackIds.has(t.id))
          if (localOnly.length > 0 && !hasPendingCloudRequest(summary.id)) {
            const actions = localOnly
              .map((t) => ({ uuid: extToUuid.get(t.id) ?? null }))
              .filter((a) => a.uuid)
            if (actions.length > 0) {
              const resp = await syncPlaylist(token, summary.id, Math.max(detail.version, 1),
                actions.map((a) => ({ actionType: 'add' as const, trackId: a.uuid, position: null as number | null })))
              if (resp) setPlaylistVersion(summary.id, resp.newVersion)
            }
          }
          continue
        }

        // Genuinely new cloud-only playlist → create locally
        addPlaylistFromCloud({
          id: `cloud_${detail.id}`,
          name: detail.title,
          cover: detail.imageUrl,
          tracks: detail.tracks.map((t) => ({
            id: t.externalId,
            source: t.externalSource === 'YouTubeMusic' ? 'youtube' as const
              : t.externalSource === 'SoundCloud' ? 'soundcloud' as const : 'yandex' as const,
            title: t.title,
            artists: t.artist ? [t.artist] : [],
            cover: t.albumImageUrl,
            duration: t.duration ?? undefined,
          })),
          createdAt: new Date(detail.createdAt).getTime(),
        })
        setPlaylistVersion(detail.id, detail.version)
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
