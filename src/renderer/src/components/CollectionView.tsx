import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from '../utils/useTranslation'
import { useLikedTracks } from '../store/likes'
import { usePlaylists } from '../store/playlists'
import { useFavoritePlaylists } from '../store/favoritePlaylists'
import { useDownloads } from '../store/downloads'
import { isAuthenticated, getAuth } from '../store/auth'
import { fetchCloudPlaylists, fetchCloudPlaylistDetail, deleteCloudPlaylist, type CloudPlaylistSummary } from '../services/playlists'
import { setCloudPlaylists, removeCloudPlaylist, useCloudPlaylists } from '../store/cloudPlaylists'
import type { TrackSource, PlaylistResult } from '../api/yandexMusic'
import type { Playlist } from '../store/playlists'
import TrackRow from './TrackRow'
import ServiceBadge from './ServiceBadge'
import CreatePlaylistCard from './CreatePlaylistCard'
import PlaylistDetailView from './PlaylistDetailView'
import RemotePlaylistDetailView from './RemotePlaylistDetailView'
import { requestArtistSearch } from '../store/searchQuery'
import { useArtistCovers } from '../hooks/useArtistCovers'
import './CollectionView.css'

function CollectionView(): JSX.Element {
  const { t } = useTranslation()
  const liked = useLikedTracks()
  const playlists = usePlaylists()
  const downloads = useDownloads()
  const downloadedTracks = useMemo(() => Object.values(downloads), [downloads])
  const favoritePlaylists = useFavoritePlaylists()
  const cloudPlaylists = useCloudPlaylists()
  const localCloudIds = useMemo(() => new Set(playlists.filter((p) => p.cloudId).map((p) => p.cloudId)), [playlists])
  const cloudOnlyPlaylists = useMemo(() => cloudPlaylists.filter((pl) => {
    if (localCloudIds.has(pl.id)) return false
    // Also filter out if a cloud_ local copy exists (from auth sync newFromCloud)
    if (playlists.some((p) => p.id === `cloud_${pl.id}`)) return false
    return true
  }), [cloudPlaylists, localCloudIds, playlists])
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null)
  const [openRemotePlaylist, setOpenRemotePlaylist] = useState<PlaylistResult | null>(null)
  const [openCloudPlaylist, setOpenCloudPlaylist] = useState<Playlist | null>(null)
  const [openCloudPlaylistServerId, setOpenCloudPlaylistServerId] = useState<string | null>(null)
  const [showLiked, setShowLiked] = useState(false)
  const [cloudLoading, setCloudLoading] = useState<string | null>(null)

  // Refresh cloud playlists display on mount (sync happens during auth)
  useEffect(() => {
    if (!isAuthenticated()) return
    const token = getAuth().accessToken!
    ;(async () => {
      const cloud = await fetchCloudPlaylists(token)
      setCloudPlaylists(cloud)
    })()
  }, [])

  async function handleOpenCloudPlaylist(pl: CloudPlaylistSummary): Promise<void> {
    const token = getAuth().accessToken
    if (!token) return
    setCloudLoading(pl.id)
    const detail = await fetchCloudPlaylistDetail(token, pl.id)
    setCloudLoading(null)
    if (!detail) return

    const syntheticPlaylist: Playlist = {
      id: `cloud_${detail.id}`,
      name: detail.title,
      cover: detail.imageUrl,
      tracks: detail.tracks.map((t) => ({
        id: t.externalId,
        source: t.externalSource === 'YouTubeMusic' ? 'youtube' as TrackSource
          : t.externalSource === 'SoundCloud' ? 'soundcloud' as TrackSource
          : 'yandex' as TrackSource,
        title: t.title,
        artists: t.artist ? [t.artist] : [],
        cover: t.albumImageUrl,
        duration: t.duration ?? undefined,
      })),
      createdAt: new Date(detail.createdAt).getTime(),
    }
    setOpenCloudPlaylist(syntheticPlaylist)
    setOpenCloudPlaylistServerId(detail.id)
  }

  const artistTracks = useMemo(() => {
    const map = new Map<string, { name: string; cover: string | null; trackTitle: string }>()
    for (const t of liked) {
      const name = t.artists[0]
      if (name && !map.has(name)) map.set(name, { name, cover: t.artistCover ?? null, trackTitle: t.title })
    }
    return Array.from(map.values()).slice(0, 12)
  }, [liked])

  const resolvedCovers = useArtistCovers(
    artistTracks.filter((a) => !a.cover).map((a) => ({ name: a.name, trackTitle: a.trackTitle }))
  )

  // Not memoized: resolvedCovers is a mutable module-level cache (same
  // reference across the async lookup completing), so this needs to
  // recompute on every render to pick up newly-resolved photos.
  const artists = artistTracks.map((a) => ({ name: a.name, cover: a.cover ?? resolvedCovers.get(a.name) ?? null }))

  // Keep each track's real index into `liked` (not its position within the
  // half-column) so clicking it seeds a proper queue — otherwise Next/
  // Previous have nothing to move to and just do nothing.
  const indexed = liked.map((t, i) => ({ track: t, index: i }))
  const left = indexed.filter((_, i) => i % 2 === 0)
  const right = indexed.filter((_, i) => i % 2 === 1)

  const openPlaylist = playlists.find((p) => p.id === openPlaylistId)
  if (showLiked) {
    const likedPlaylist: Playlist = {
      id: '__liked__',
      name: 'Мне нравится',
      cover: null,
      tracks: liked,
      createdAt: Date.now(),
    }
    return <PlaylistDetailView playlist={likedPlaylist} onBack={() => setShowLiked(false)} />
  }
  if (openPlaylist) {
    return <PlaylistDetailView playlist={openPlaylist} onBack={() => setOpenPlaylistId(null)} />
  }
  if (openRemotePlaylist) {
    return <RemotePlaylistDetailView playlist={openRemotePlaylist} onBack={() => setOpenRemotePlaylist(null)} />
  }
  if (openCloudPlaylist) {
    return (
      <PlaylistDetailView
        playlist={openCloudPlaylist}
        onBack={() => { setOpenCloudPlaylist(null); setOpenCloudPlaylistServerId(null) }}
        onDelete={async () => {
          const token = getAuth().accessToken
          if (!token || !openCloudPlaylistServerId) return
          await deleteCloudPlaylist(token, openCloudPlaylistServerId)
          removeCloudPlaylist(openCloudPlaylistServerId)
          setOpenCloudPlaylist(null)
          setOpenCloudPlaylistServerId(null)
        }}
      />
    )
  }

  return (
    <div className="collection-view view-enter">
      <h1 className="collection-view__title">{t('collection.title')}</h1>
      <p className="collection-view__subtitle">
        У вашей музыки есть <span className="collection-view__accent">цвет</span>
      </p>

      <div className="collection-view__hero-card hero-card--animated" onClick={() => liked.length > 0 && setShowLiked(true)}>
        <div className="collection-view__hero-icon">
          <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 15.5S2 11.2 2 6.8C2 4.4 3.9 2.8 6 2.8c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.1 0 4 1.6 4 4 0 4.4-7 8.7-7 8.7Z"
              fill="#fff"
            />
          </svg>
        </div>
        <div className="collection-view__hero-meta">
          <div className="collection-view__hero-title">
            Мне нравится
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="collection-view__hero-sub">{liked.length} треков</div>
        </div>
      </div>

      <section className="collection-view__section">
        <h2 className="collection-view__artists-title">{t('collection.playlists')}</h2>
        <div className="collection-view__playlist-grid">
          <CreatePlaylistCard />
          {playlists.map((p) => (
            <button key={p.id} className="collection-view__playlist-card" onClick={() => setOpenPlaylistId(p.id)}>
              <div
                className="collection-view__playlist-cover"
                style={p.cover ? { backgroundImage: `url(${p.cover})` } : undefined}
              >
                {!p.cover && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3 14 9 20 7 16 12 21 14 14 15.5 16 21 10.5 17 6 21 7.5 14.5 2 13 7.5 10 6 4 Z" fill="#ffdb4d" />
                  </svg>
                )}
              </div>
              <div className="collection-view__playlist-name">{p.name}</div>
              <div className="collection-view__playlist-count">{p.tracks.length} треков</div>
            </button>
          ))}
          {cloudOnlyPlaylists.map((pl) => (
            <button
              key={`cloud_${pl.id}`}
              className="collection-view__playlist-card"
              onClick={() => handleOpenCloudPlaylist(pl)}
              disabled={cloudLoading === pl.id}
            >
              <div
                className="collection-view__playlist-cover"
                style={pl.imageUrl ? { backgroundImage: `url(${pl.imageUrl})` } : undefined}
              >
                {!pl.imageUrl && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="currentColor" opacity="0.6"/>
                  </svg>
                )}
              </div>
              <div className="collection-view__playlist-name">{pl.title}</div>
              <div className="collection-view__playlist-count">{pl.trackCount} треков</div>
            </button>
          ))}
          </div>
        </section>

      {favoritePlaylists.length > 0 && (
        <section className="collection-view__section">
          <h2 className="collection-view__artists-title">{t('collection.favorites')}</h2>
          <div className="collection-view__playlist-grid">
            {favoritePlaylists.map((pl) => (
              <button key={pl.id} className="collection-view__playlist-card" onClick={() => setOpenRemotePlaylist(pl)}>
                <div
                  className="collection-view__playlist-cover"
                  style={pl.cover ? { backgroundImage: `url(${pl.cover})` } : undefined}
                >
                  {!pl.cover && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3 14 9 20 7 16 12 21 14 14 15.5 16 21 10.5 17 6 21 7.5 14.5 2 13 7.5 10 6 4 Z" fill="#ffdb4d" />
                    </svg>
                  )}
                </div>
                <div className="collection-view__playlist-name">{pl.title}</div>
                <div className="collection-view__playlist-count">
                  <ServiceBadge source={pl.source} size={12} />
                  <span style={{ marginLeft: 4 }}>{pl.owner} · {pl.trackCount} треков</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {downloadedTracks.length > 0 && (
        <section className="collection-view__section">
          <h2 className="collection-view__artists-title">{t('collection.downloads')}</h2>
          <div className="collection-view__columns">
            <div className="collection-view__column">
              {downloadedTracks.map((track, index) => (
                <TrackRow key={track.id} track={track} queue={downloadedTracks} index={index} onArtistClick={requestArtistSearch} />
              ))}
            </div>
          </div>
        </section>
      )}

      {liked.length === 0 ? (
        <div className="collection-view__empty">
          {t('collection.empty')}
        </div>
      ) : (
        <>
          <div className="collection-view__columns">
            <div className="collection-view__column">
              {left.map(({ track, index }) => (
                <TrackRow key={track.id} track={track} queue={liked} index={index} onArtistClick={requestArtistSearch} />
              ))}
            </div>
            <div className="collection-view__column">
              {right.map(({ track, index }) => (
                <TrackRow key={track.id} track={track} queue={liked} index={index} onArtistClick={requestArtistSearch} />
              ))}
            </div>
          </div>

          {artists.length > 0 && (
            <section className="collection-view__artists">
              <h2 className="collection-view__artists-title">
                {t('collection.artists')}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </h2>
              <div className="collection-view__artists-row">
                {artists.map((a) => (
                  <button
                    key={a.name}
                    className="collection-view__artist"
                    onClick={() => requestArtistSearch(a.name)}
                  >
                    <div className="collection-view__artist-avatar">
                      {a.cover ? (
                        <img src={a.cover} alt="" />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      )}
                    </div>
                    <div className="collection-view__artist-name">{a.name}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default CollectionView
