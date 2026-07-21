import { useCallback, useEffect, useRef, useState } from 'react'
import { getPlaylistTracks, PlaylistResult, TrackResult } from '../api/yandexMusic'
import { usePlayer } from '../player/PlayerContext'
import { toggleFavoritePlaylist, useIsFavoritePlaylist } from '../store/favoritePlaylists'
import { requestArtistSearch } from '../store/searchQuery'
import TrackRow from './TrackRow'
import ServiceBadge from './ServiceBadge'
import './PlaylistDetailView.css'

interface Props {
  playlist: PlaylistResult
  onBack: () => void
}

const PAGE_SIZE = 50

function RemotePlaylistDetailView({ playlist, onBack }: Props): JSX.Element {
  const { playQueue } = usePlayer()
  const isFavorite = useIsFavoritePlaylist(playlist.id)
  const [tracks, setTracks] = useState<TrackResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const totalRef = useRef(0)
  const loaderRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async (offset: number) => {
    try {
      const data = await getPlaylistTracks(playlist.id, offset, PAGE_SIZE)
      totalRef.current = data.total
      setTracks((prev) => (offset === 0 ? data.tracks : [...prev, ...data.tracks]))
      setHasMore(data.hasMore)
    } catch {
      if (offset === 0) setError('Не удалось загрузить треки плейлиста')
    }
  }, [playlist.id])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setTracks([])
    setHasMore(true)
    fetchPage(0).finally(() => setLoading(false))
  }, [fetchPage])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore || loadingMore || loading) return
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true)
          fetchPage(tracks.length).finally(() => setLoadingMore(false))
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, tracks.length, fetchPage])

  return (
    <div className="playlist-detail view-enter">
      <button className="playlist-detail__back" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Коллекция
      </button>

      <div className="playlist-detail__header">
        <div className="playlist-detail__cover" style={playlist.cover ? { backgroundImage: `url(${playlist.cover})` } : undefined}>
          {!playlist.cover && (
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M20 6 L23 15 L32 12 L26 20 L34 24 L23 26 L26 34 L18 27 L11 34 L13 25 L4 22 L13 18 L11 10 Z" fill="#ffdb4d" />
            </svg>
          )}
        </div>
        <div className="playlist-detail__meta">
          <div className="playlist-detail__label">
            <ServiceBadge source={playlist.source} size={14} />
            <span style={{ marginLeft: 6 }}>Плейлист</span>
          </div>
          <h1 className="playlist-detail__title">{playlist.title}</h1>
          <div className="playlist-detail__sub">{playlist.owner} · {totalRef.current || playlist.trackCount} треков</div>
          <div className="playlist-detail__actions">
            <button className="playlist-detail__play" onClick={() => tracks.length > 0 && playQueue(tracks, 0)} disabled={tracks.length === 0}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M5.5 3.5l9 5.5-9 5.5Z" fill="#000" />
              </svg>
              Слушать
            </button>
            <button
              className={`playlist-detail__fav${isFavorite ? ' playlist-detail__fav--active' : ''}`}
              onClick={() => toggleFavoritePlaylist(playlist)}
              title={isFavorite ? 'Убрать из избранного' : 'В избранное'}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M9 15.5S2 11.2 2 6.8C2 4.4 3.9 2.8 6 2.8c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.1 0 4 1.6 4 4 0 4.4-7 8.7-7 8.7Z"
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="playlist-detail__tracks">
        {loading && (
          <div style={{ maxWidth: 640 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton skeleton-row__cover" />
                <div className="skeleton-row__lines">
                  <div className="skeleton skeleton-row__line" />
                  <div className="skeleton skeleton-row__line skeleton-row__line--short" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="playlist-detail__empty">{error}</div>
        )}
        {!loading && !error && tracks.length === 0 && (
          <div className="playlist-detail__empty">Треки не найдены</div>
        )}
        {!loading && tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} queue={tracks} index={i} onArtistClick={requestArtistSearch} />
        ))}
        <div ref={loaderRef} style={{ height: 1 }} />
        {loadingMore && (
          <div className="skeleton-row" style={{ opacity: 0.5 }}>
            <div className="skeleton skeleton-row__cover" />
            <div className="skeleton-row__lines">
              <div className="skeleton skeleton-row__line" />
              <div className="skeleton skeleton-row__line skeleton-row__line--short" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RemotePlaylistDetailView
