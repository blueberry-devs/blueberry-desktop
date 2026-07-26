import { getPlaylists, addTracksSilently, addPlaylistFromCloud, setPlaylistCloudId, hasPendingCloudRequest } from './playlists'
import { getPlaylistVersion, setPlaylistVersion } from './playlistVersions'
import { isSynced, markSynced, getUnsyncedGeneration } from './playlistSync'
import { isAuthenticated, getAuth } from './auth'
import {
  resolveTracks,
  syncPlaylists as bulkSyncPlaylists,
  fetchCloudPlaylists,
  fetchCloudPlaylistDetail,
  diffPlaylist,
  syncPlaylist,
} from '../services/playlists'
import type { TrackResult } from '../api/yandexMusic'
import type { TrackUploadDto } from '../services/playlists'

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

async function runSync(): Promise<void> {
  if (isSyncing) return
  isSyncing = true
  const genBefore = getUnsyncedGeneration()
  try {
    const token = getAuth().accessToken
    if (!token) return

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

    // 2. Handle new playlists (no cloudId yet) — bulk upload
    const newPls = localPlaylists.filter((p) => !p.cloudId)
    if (newPls.length > 0) {
      const created = await bulkSyncPlaylists(token, newPls)
      for (const detail of created) {
        // Match back by title
        const local = newPls.find(
          (p) => p.name.toLowerCase().trim() === detail.title.toLowerCase().trim(),
        )
        if (local) {
          linkMatchedPlaylist(local.id, detail.id, detail.version)
        }
      }
    }

    // 3. Handle existing playlists — per-playlist diff+sync
    for (const pl of localPlaylists) {
      if (!pl.cloudId) continue
      if (hasPendingCloudRequest(pl.cloudId)) continue // skip — user action in flight

      const cloudDetail = await fetchCloudPlaylistDetail(token, pl.cloudId)
      if (!cloudDetail) continue

      let storedVersion = getPlaylistVersion(pl.cloudId)
      let effectiveVersion = storedVersion

      // Apply server changes if version advanced
      if (storedVersion > 0 && storedVersion < cloudDetail.version) {
        const diff = await diffPlaylist(token, pl.cloudId, storedVersion)
        if (diff) {
          effectiveVersion = diff.currentVersion
          const newTracks: TrackResult[] = []
          for (const action of diff.actions) {
            if (action.actionType === 'add_track' && action.trackExternalId) {
              newTracks.push({
                id: action.trackExternalId,
                source:
                  action.trackExternalSource === 'YouTubeMusic'
                    ? 'youtube'
                    : action.trackExternalSource === 'SoundCloud'
                    ? 'soundcloud'
                    : 'yandex',
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

      // Build local add actions for tracks server doesn't have
      const serverIds = new Set(cloudDetail.tracks.map((t) => t.externalId))
      const localAdds = pl.tracks
        .filter((t) => !serverIds.has(t.id))
        .map((t) => ({
          actionType: 'add' as const,
          trackId: extToUuid.get(t.id) ?? null,
          position: null as number | null,
        }))

      if (localAdds.length > 0 || storedVersion < cloudDetail.version) {
        const resp = await syncPlaylist(
          token,
          pl.cloudId,
          Math.max(effectiveVersion, 1),
          localAdds,
        )
        if (resp) {
          setPlaylistVersion(pl.cloudId, resp.newVersion)
          // Apply any server-side actions from response
          if (resp.serverActions) {
            const newTracks: TrackResult[] = []
            for (const action of resp.serverActions) {
              if (action.actionType === 'add_track' && action.trackExternalId) {
                newTracks.push({
                  id: action.trackExternalId,
                  source:
                    action.trackExternalSource === 'YouTubeMusic'
                      ? 'youtube'
                      : action.trackExternalSource === 'SoundCloud'
                      ? 'soundcloud'
                      : 'yandex',
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
      } else {
        setPlaylistVersion(pl.cloudId, cloudDetail.version)
      }
    }

    // 4. Check for cloud-only playlists (created on other device or not yet linked)
    const allSummaries = await fetchCloudPlaylists(token)
    const localCloudIds = new Set(
      getPlaylists()
        .filter((p) => p.cloudId)
        .map((p) => p.cloudId),
    )

    // Refresh local playlists reference after potential mutations from steps 2-3
    const updatedLocal = getPlaylists()

    for (const summary of allSummaries) {
      if (localCloudIds.has(summary.id)) continue

      // Fetch detail to compare tracks
      const detail = await fetchCloudPlaylistDetail(token, summary.id)
      if (!detail) continue

      const cloudTrackIds = new Set(detail.tracks.map((t) => t.externalId))

      // Check by name + track content against unlinked local playlists
      const matched = findMatchedLocal(updatedLocal, summary.title, cloudTrackIds)
      if (matched) {
        linkMatchedPlaylist(matched.localId, summary.id, detail.version)
        continue
      }

      // Name match but different tracks — could be the same playlist with
      // server additions. Link and let step 3 handle the diff on next cycle.
      const nameMatch = updatedLocal.find(
        (p) => !p.cloudId && p.name.toLowerCase().trim() === summary.title.toLowerCase().trim(),
      )
      if (nameMatch) {
        linkMatchedPlaylist(nameMatch.id, summary.id, detail.version)
        // Send local-only tracks to server
        const localOnly = nameMatch.tracks.filter((t) => !cloudTrackIds.has(t.id))
        if (localOnly.length > 0 && !hasPendingCloudRequest(summary.id)) {
          const addActions = localOnly
            .map((t) => ({ extId: t.id, uuid: extToUuid.get(t.id) ?? null }))
            .filter((a) => a.uuid)
          if (addActions.length > 0) {
            const resp = await syncPlaylist(token, summary.id, Math.max(detail.version, 1), addActions.map((a) => ({
              actionType: 'add' as const,
              trackId: a.uuid,
              position: null as number | null,
            })))
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
          source:
            t.externalSource === 'YouTubeMusic'
              ? 'youtube' as const
              : t.externalSource === 'SoundCloud'
              ? 'soundcloud' as const
              : 'yandex' as const,
          title: t.title,
          artists: t.artist ? [t.artist] : [],
          cover: t.albumImageUrl,
          duration: t.duration ?? undefined,
        })),
        createdAt: new Date(detail.createdAt).getTime(),
      })
      setPlaylistVersion(detail.id, detail.version)
    }

    // Only mark synced if no real local changes happened during the sync.
    // addTracksSilently does NOT increment the generation, so this only
    // catches actual user mutations that fired markUnsynced.
    if (genBefore === getUnsyncedGeneration()) {
      markSynced()
    }
    // else: user made changes during sync — leave unsynced flag as-is so
    // the next tick picks them up to upload.
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
  // Initial check
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
