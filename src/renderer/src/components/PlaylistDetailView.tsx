import { useState, useRef } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { Playlist, moveTrackInPlaylist } from '../store/playlists'
import { requestArtistSearch } from '../store/searchQuery'
import TrackRow from './TrackRow'
import './PlaylistDetailView.css'

interface Props {
  playlist: Playlist
  onBack: () => void
}

function PlaylistDetailView({ playlist, onBack }: Props): JSX.Element {
  const { playQueue } = usePlayer()
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)

  const handleDragStart = (i: number) => (): void => {
    dragIndexRef.current = i
  }

  const handleDragOver = (i: number) => (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOverIndex(i)
  }

  const handleDragLeave = (): void => {
    setDragOverIndex(null)
  }

  const handleDrop = (toIndex: number) => (): void => {
    const fromIndex = dragIndexRef.current
    dragIndexRef.current = null
    setDragOverIndex(null)
    if (fromIndex === null || fromIndex === toIndex) return
    moveTrackInPlaylist(playlist.id, fromIndex, toIndex)
  }

  const handleDragEnd = (): void => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

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
          <div className="playlist-detail__label">Плейлист</div>
          <h1 className="playlist-detail__title">{playlist.name}</h1>
          <div className="playlist-detail__sub">{playlist.tracks.length} треков</div>
          {playlist.tracks.length > 0 && (
            <button className="playlist-detail__play" onClick={() => playQueue(playlist.tracks, 0)}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M5.5 3.5l9 5.5-9 5.5Z" fill="#000" />
              </svg>
              Слушать
            </button>
          )}
        </div>
      </div>

      <div className="playlist-detail__tracks">
        {playlist.tracks.length === 0 ? (
          <div className="playlist-detail__empty">
            Добавляйте треки через кнопку «+» на любом треке в поиске, чартах или коллекции.
          </div>
        ) : (
          playlist.tracks.map((t, i) => (
            <div
              key={t.id}
              draggable
              onDragStart={handleDragStart(i)}
              onDragOver={handleDragOver(i)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(i)}
              onDragEnd={handleDragEnd}
              style={{ opacity: dragOverIndex === i ? 0.5 : 1, transition: 'opacity 0.15s' }}
            >
              <TrackRow track={t} queue={playlist.tracks} index={i} onArtistClick={requestArtistSearch} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default PlaylistDetailView
