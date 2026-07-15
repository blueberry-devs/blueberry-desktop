import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { TrackResult } from '../api/yandexMusic'
import { toggleLike, useIsLiked } from '../store/likes'
import AddToPlaylistMenu from './AddToPlaylistMenu'
import ServiceBadge from './ServiceBadge'
import './TrackRow.css'

function formatTime(sec?: number): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  track: TrackResult
  queue?: TrackResult[]
  index?: number
  onArtistClick?: (name: string) => void
}

function TrackRow({ track, queue, index, onArtistClick }: Props): JSX.Element {
  const { currentTrack, isPlaying, isLoading, play, playQueue } = usePlayer()
  const liked = useIsLiked(track.id)
  const isCurrent = currentTrack?.id === track.id
  const isRowPlaying = isCurrent && isPlaying
  const isRowLoading = isCurrent && isLoading
  const [showArtistPicker, setShowArtistPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showArtistPicker) return
    const handler = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowArtistPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showArtistPicker])

  const handleClick = (): void => {
    if (queue && typeof index === 'number') playQueue(queue, index)
    else play(track)
  }

  const handleArtistsClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!onArtistClick) return
    if (track.artists.length > 1) {
      setShowArtistPicker((v) => !v)
    } else {
      onArtistClick(track.artists[0])
    }
  }

  return (
    <div className={`track-row${isCurrent ? ' track-row--current' : ''}`} onClick={handleClick}>
      <div className="track-row__cover">
        {track.cover ? (
          <img src={track.cover} alt="" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        )}
        <div className="track-row__badge">
          <ServiceBadge source={track.source} size={16} />
        </div>
        <div className="track-row__play-overlay">
          {isRowLoading ? (
            <span className="track-row__spinner" />
          ) : isRowPlaying ? (
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <rect x="4.5" y="3.5" width="3" height="11" fill="#fff" />
              <rect x="10.5" y="3.5" width="3" height="11" fill="#fff" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M5.5 3.5l9 5.5-9 5.5Z" fill="#fff" />
            </svg>
          )}
        </div>
      </div>
      <div className="track-row__meta">
        <div className="track-row__title">{track.title}</div>
        <div className="track-row__artists-wrap" ref={pickerRef}>
          <span
            className={`track-row__artists${onArtistClick ? ' track-row__artists--link' : ''}`}
            onClick={handleArtistsClick}
          >
            {track.artists.join(', ')}
          </span>
          {showArtistPicker && (
            <div className="track-row__artist-picker" onClick={(e) => e.stopPropagation()}>
              {track.artists.map((name) => (
                <button
                  key={name}
                  className="track-row__artist-picker-item"
                  onClick={() => {
                    setShowArtistPicker(false)
                    onArtistClick?.(name)
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <button
        className={`track-row__like-btn${liked ? ' track-row__like-btn--active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          toggleLike(track)
        }}
        title={liked ? 'Не нравится' : 'Мне нравится'}
      >
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 15.5S2 11.2 2 6.8C2 4.4 3.9 2.8 6 2.8c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.1 0 4 1.6 4 4 0 4.4-7 8.7-7 8.7Z"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      </button>
      {track.duration ? <div className="track-row__duration">{formatTime(track.duration)}</div> : null}
      <div onClick={(e) => e.stopPropagation()}>
        <AddToPlaylistMenu track={track} />
      </div>
    </div>
  )
}

export default TrackRow
