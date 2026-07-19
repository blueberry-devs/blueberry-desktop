import { useMemo, useState } from 'react'
import { useTranslation } from '../utils/useTranslation'
import { useLikedTracks } from '../store/likes'
import { usePlaylists } from '../store/playlists'
import { useFavoritePlaylists } from '../store/favoritePlaylists'
import { useDownloads } from '../store/downloads'
import TrackRow from './TrackRow'
import ServiceBadge from './ServiceBadge'
import { requestArtistSearch } from '../store/searchQuery'
import CreatePlaylistCard from './CreatePlaylistCard'
import PlaylistDetailView from './PlaylistDetailView'
import RemotePlaylistDetailView from './RemotePlaylistDetailView'
import { usePlayer } from '../player/PlayerContext'
import { PlaylistResult } from '../api/yandexMusic'
import { useArtistCovers } from '../hooks/useArtistCovers'
import './CollectionView.css'

function CollectionView(): JSX.Element {
  const { t } = useTranslation()
  const liked = useLikedTracks()
  const playlists = usePlaylists()
  const downloads = useDownloads()
  const downloadedTracks = useMemo(() => Object.values(downloads), [downloads])
  const favoritePlaylists = useFavoritePlaylists()
  const { playQueue } = usePlayer()
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null)
  const [openRemotePlaylist, setOpenRemotePlaylist] = useState<PlaylistResult | null>(null)

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
  if (openPlaylist) {
    return <PlaylistDetailView playlist={openPlaylist} onBack={() => setOpenPlaylistId(null)} />
  }
  if (openRemotePlaylist) {
    return <RemotePlaylistDetailView playlist={openRemotePlaylist} onBack={() => setOpenRemotePlaylist(null)} />
  }

  return (
    <div className="collection-view view-enter">
      <h1 className="collection-view__title">{t('collection.title')}</h1>
      <p className="collection-view__subtitle">
        У вашей музыки есть <span className="collection-view__accent">цвет</span>
      </p>

      <div className="collection-view__hero-card hero-card--animated" onClick={() => liked.length > 0 && playQueue(liked, 0)}>
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
