import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '../utils/useTranslation'
import { useLikedTracks, setLikedTracks } from '../store/likes'
import { usePlaylists, deletePlaylist, renamePlaylist, createPlaylist, addTrackToPlaylist } from '../store/playlists'
import { useDeletedPlaylists } from '../store/deletedPlaylists'
import { useFavoritePlaylists } from '../store/favoritePlaylists'
import { useDownloads } from '../store/downloads'
import { isAuthenticated } from '../store/auth'
import { fetchCloudPlaylists, fetchAllCloudPlaylistTracks, fetchUserLikes, deleteCloudPlaylist, type CloudPlaylistSummary } from '../services/playlists'
import { setCloudPlaylists, removeCloudPlaylist, useCloudPlaylists } from '../store/cloudPlaylists'
import type { TrackSource, PlaylistResult } from '../api/yandexMusic'
import type { Playlist } from '../store/playlists'
import TrackRow from './TrackRow'
import ServiceBadge from './ServiceBadge'
import CreatePlaylistCard from './CreatePlaylistCard'
import PlaylistDetailView from './PlaylistDetailView'
import RemotePlaylistDetailView from './RemotePlaylistDetailView'
import TrashView from './TrashView'
import { requestArtistSearch } from '../store/searchQuery'
import { useArtistCovers } from '../hooks/useArtistCovers'
import Modal from './Modal'
import './CollectionView.css'

function CollectionView(): JSX.Element {
  const { t } = useTranslation()
  const liked = useLikedTracks()
  const playlists = usePlaylists()
  const downloads = useDownloads()
  const downloadedTracks = useMemo(() => Object.values(downloads), [downloads])
  const favoritePlaylists = useFavoritePlaylists()
  const cloudPlaylists = useCloudPlaylists()
  const localCloudIds = useMemo(() => new Set(playlists.filter((p) => /^[0-9a-f-]{36}$/i.test(p.id)).map((p) => p.id)), [playlists])
  const cloudOnlyPlaylists = useMemo(() => cloudPlaylists.filter((pl) => {
    return !localCloudIds.has(pl.id)
  }), [cloudPlaylists, localCloudIds])
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null)
  const [openRemotePlaylist, setOpenRemotePlaylist] = useState<PlaylistResult | null>(null)
  const [openCloudPlaylist, setOpenCloudPlaylist] = useState<Playlist | null>(null)
  const [openCloudPlaylistServerId, setOpenCloudPlaylistServerId] = useState<string | null>(null)
  const [showLiked, setShowLiked] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [cloudLoading, setCloudLoading] = useState<string | null>(null)
  const deletedLocal = useDeletedPlaylists()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; playlist: Playlist } | null>(null)
  const [ctxClosing, setCtxClosing] = useState(false)
  const ctxTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [renameTarget, setRenameTarget] = useState<Playlist | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameClosing, setRenameClosing] = useState(false)
  const renameTimer = useRef<ReturnType<typeof setTimeout>>(void 0)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null)

  const closeRename = useCallback(() => {
    if (renameClosing) return
    setRenameClosing(true)
    renameTimer.current = setTimeout(() => {
      setRenameTarget(null)
      setRenameClosing(false)
    }, 150)
  }, [renameClosing])

  const submitRename = useCallback(() => {
    if (!renameValue.trim() || !renameTarget) return
    renamePlaylist(renameTarget.id, renameValue)
    closeRename()
  }, [renameValue, renameTarget, closeRename])

  useEffect(() => {
    if (!renameTarget) return
    const el = document.querySelector('.collection-view') || document.querySelector('.app__content')
    if (el) (el as HTMLElement).style.overflow = 'hidden'
    return () => {
      if (el) (el as HTMLElement).style.overflow = ''
    }
  }, [renameTarget])

  useEffect(() => {
    if (!renameTarget) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRename()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [renameTarget, closeRename])

  // Refresh cloud playlists display on mount
  useEffect(() => {
    if (!isAuthenticated()) return
    ;(async () => {
      const cloud = await fetchCloudPlaylists()
      setCloudPlaylists(cloud)
    })()
  }, [])

  // Fetch likes from server when opening the likes page
  useEffect(() => {
    if (!showLiked) return
    if (!isAuthenticated()) return
    ;(async () => {
      const serverLikes = await fetchUserLikes('track')
      const tracks = serverLikes
        .filter((l) => l.track?.externalId)
        .map((l) => ({
          id: l.track!.externalId,
          source: (l.track!.externalSource === 'YouTubeMusic'
            ? 'youtube' : l.track!.externalSource === 'SoundCloud'
            ? 'soundcloud' : 'yandex') as 'youtube' | 'soundcloud' | 'yandex',
          title: l.track!.title,
          artists: l.track!.artist ? [l.track!.artist] : [],
          cover: l.track!.albumImageUrl,
          duration: l.track!.duration ?? undefined,
        }))
      setLikedTracks(tracks)
    })()
  }, [showLiked])

  async function handleOpenCloudPlaylist(pl: CloudPlaylistSummary): Promise<void> {
    setCloudLoading(pl.id)
    const detail = await fetchAllCloudPlaylistTracks(pl.id)
    setCloudLoading(null)
    if (!detail) return

    const syntheticPlaylist: Playlist = {
      id: detail.id,
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

  const artists = artistTracks.map((a) => ({ name: a.name, cover: a.cover ?? resolvedCovers.get(a.name) ?? null }))

  const indexed = liked.map((t, i) => ({ track: t, index: i }))
  const left = indexed.filter((_, i) => i % 2 === 0)
  const right = indexed.filter((_, i) => i % 2 === 1)

  const openPlaylist = playlists.find((p) => p.id === openPlaylistId)

  const handleContextMenu = useCallback((e: React.MouseEvent, pl: Playlist) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxClosing(false)
    setContextMenu({ x: e.clientX, y: e.clientY, playlist: pl })
  }, [])

  const closeCtx = useCallback(() => {
    if (ctxClosing || !contextMenu) return
    setCtxClosing(true)
    ctxTimerRef.current = setTimeout(() => {
      setCtxClosing(false)
      setContextMenu(null)
    }, 120)
  }, [ctxClosing, contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => closeCtx()
    window.addEventListener('click', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [contextMenu, closeCtx])

  // Escape closes context menu
  useEffect(() => {
    if (!contextMenu) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeCtx()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contextMenu, closeCtx])

  // Clean up animation timer
  useEffect(() => {
    return () => { if (ctxTimerRef.current) clearTimeout(ctxTimerRef.current) }
  }, [])

  useEffect(() => {
    if (renameTarget) {
      setRenameValue(renameTarget.name)
      setTimeout(() => renameInputRef.current?.focus(), 50)
    }
  }, [renameTarget])

  if (showTrash) {
    return <TrashView onBack={() => setShowTrash(false)} />
  }
  if (showLiked) {
    const likedPlaylist: Playlist = {
      id: '__liked__',
      name: t('collection.likedTitle'),
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
          if (!openCloudPlaylistServerId) return
          await deleteCloudPlaylist(openCloudPlaylistServerId)
          removeCloudPlaylist(openCloudPlaylistServerId)
          setOpenCloudPlaylist(null)
          setOpenCloudPlaylistServerId(null)
        }}
      />
    )
  }

  return (
    <><div className="collection-view view-enter">
      <h1 className="collection-view__title">{t('collection.title')}</h1>
      <p className="collection-view__subtitle">
        {t('collection.subtitle')}<span className="collection-view__accent">{t('collection.subtitleAccent')}</span>
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
            {t('collection.likedTitle')}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="collection-view__hero-sub">{t('collection.trackCount').replace('{n}', String(liked.length))}</div>
        </div>
      </div>

      <section className="collection-view__section">
        <h2 className="collection-view__artists-title">
          {t('collection.playlists')}
          <button className="collection-view__trash-link" onClick={() => setShowTrash(true)} title={t('collection.trash')}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6.5 7v5M9.5 7v5M3.5 4l.8 9.2a1 1 0 0 0 1 .8h5.4a1 1 0 0 0 1-.8l.8-9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('collection.trash')}
            {deletedLocal.length > 0 && (
              <span className="collection-view__trash-badge">{deletedLocal.length}</span>
            )}
          </button>
        </h2>
        <div className="collection-view__playlist-grid">
          <CreatePlaylistCard />
          {playlists.map((p) => (
            <button
              key={p.id}
              className="collection-view__playlist-card"
              onClick={() => setOpenPlaylistId(p.id)}
              onContextMenu={(e) => handleContextMenu(e, p)}
            >
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
              <div className="collection-view__playlist-count">{t('collection.trackCount').replace('{n}', String(p.tracks.length))}</div>
            </button>
          ))}
          {cloudOnlyPlaylists.map((pl) => (
            <button
              key={pl.id}
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
              <div className="collection-view__playlist-count">{t('collection.trackCount').replace('{n}', String(pl.trackCount))}</div>
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
                  <span style={{ marginLeft: 4 }}>{pl.owner} · {t('collection.trackCount').replace('{n}', String(pl.trackCount))}</span>
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

      {contextMenu && (
        <div
          className={`playlist-context-menu${ctxClosing ? ' playlist-context-menu--closing' : ''}`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="playlist-context-menu__item"
            onClick={() => {
              setRenameTarget(contextMenu.playlist)
              closeCtx()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 1.5a2.1 2.1 0 0 1 3 3L5 14H2v-3l9.5-9.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Переименовать
          </button>
          <button
            className="playlist-context-menu__item"
            onClick={() => {
              const dup = createPlaylist(contextMenu.playlist.name + ' (копия)', contextMenu.playlist.cover)
              for (const t of contextMenu.playlist.tracks) {
                addTrackToPlaylist(dup.id, t)
              }
              closeCtx()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Дублировать
          </button>
          <div className="playlist-context-menu__sep" />
          <button
            className="playlist-context-menu__item playlist-context-menu__item--danger"
            onClick={() => {
              setDeleteTarget(contextMenu.playlist)
              closeCtx()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6.5 7v5M9.5 7v5M3.5 4l.8 9.2a1 1 0 0 0 1 .8h5.4a1 1 0 0 0 1-.8l.8-9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Удалить
          </button>
        </div>
      )}

      {deleteTarget && (
        <Modal
          open
          title="Удалить плейлист"
          message={`Переместить плейлист «${deleteTarget.name}» в корзину?`}
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          onConfirm={() => {
            deletePlaylist(deleteTarget.id)
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {renameTarget && (
        <div className={`cp-modal${renameClosing ? ' cp-modal--closing' : ''}`} onClick={closeRename}>
          <div className="cp-modal__card" onClick={(e) => e.stopPropagation()}>
            <button className="cp-modal__close" onClick={closeRename}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <h2 className="cp-modal__title">Переименовать плейлист</h2>
            <div className="cp-modal__body" style={{ flexDirection: 'column', gap: 12, marginTop: 20 }}>
              <label className="cp-modal__label">Название</label>
              <input
                ref={renameInputRef}
                className="cp-modal__input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameValue.trim()) {
                    submitRename()
                  }
                  if (e.key === 'Escape') closeRename()
                }}
                maxLength={60}
              />
            </div>
            <div className="cp-modal__actions">
              <button className="cp-modal__cancel" onClick={closeRename}>Отмена</button>
              <button
                className="cp-modal__confirm"
                onClick={submitRename}
                disabled={!renameValue.trim()}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CollectionView
