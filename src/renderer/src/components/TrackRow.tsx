import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
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
  const { currentTrack, isPlaying, isLoading, play, playQueue, queue: currentQueue, queueIndex } = usePlayer()
  const liked = useIsLiked(track.id)
  const isCurrent = currentTrack?.id === track.id
  const isRowPlaying = isCurrent && isPlaying
  const isRowLoading = isCurrent && isLoading
  const [showArtistPicker, setShowArtistPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showArtistPicker) return
    const handler = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowArtistPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showArtistPicker])

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!ctxMenu) return
    const close = (): void => setCtxMenu(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [ctxMenu])

  const handleClick = (): void => {
    if (queue && typeof index === 'number') playQueue(queue, index)
    else play(track)
  }

  const handleContextMenu = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const menuWidth = 200
    const menuHeight = 220
    const pad = 8
    let x = e.clientX
    let y = e.clientY
    if (x + menuWidth + pad > window.innerWidth) x = window.innerWidth - menuWidth - pad
    if (y + menuHeight + pad > window.innerHeight) y = window.innerHeight - menuHeight - pad
    setCtxMenu({ x, y })
  }, [])

  const handlePlayNext = useCallback((): void => {
    if (queueIndex >= 0) {
      const insertAt = queueIndex + 1
      currentQueue.splice(insertAt, 0, track)
    } else {
      play(track)
    }
    setCtxMenu(null)
  }, [currentQueue, queueIndex, track, play])

  const handleAddToQueueEnd = useCallback((): void => {
    currentQueue.push(track)
    setCtxMenu(null)
  }, [currentQueue, track])

  const handleArtistsClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!onArtistClick) return
    if (track.artists.length > 1) {
      setShowArtistPicker((v) => !v)
    } else {
      onArtistClick(track.artists[0])
    }
  }

  // Also track artist name for the "Go to artist" context action
  const handleGoToArtist = useCallback((name: string) => {
    onArtistClick?.(name)
    setCtxMenu(null)
  }, [onArtistClick])

  const handleCopyInfo = useCallback((): void => {
    navigator.clipboard.writeText(`${track.artists.join(', ')} — ${track.title}`).catch(() => {})
    setCtxMenu(null)
  }, [track])

  return (
    <>
      <div className={`track-row${isCurrent ? ' track-row--current' : ''}`} onClick={handleClick} onContextMenu={handleContextMenu}>
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

      {ctxMenu && createPortal(
        <motion.div
          ref={ctxRef}
          className="track-row__ctx"
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="track-row__ctx-item" onClick={handlePlayNext}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 12V4l8 4-8 4Z" fill="currentColor" />
              <rect x="12" y="3" width="2" height="10" fill="currentColor" />
            </svg>
            Сыграть следующим
          </button>
          <button className="track-row__ctx-item" onClick={handleAddToQueueEnd}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            В конец очереди
          </button>
          <div className="track-row__ctx-sep" />
          {track.artists.map((name) => onArtistClick && (
            <button key={name} className="track-row__ctx-item" onClick={() => handleGoToArtist(name)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              {name}
            </button>
          ))}
          <div className="track-row__ctx-sep" />
          <button className="track-row__ctx-item" onClick={handleCopyInfo}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="4" y="2" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
              <path d="M12 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.4" fill="none" />
            </svg>
            Копировать
          </button>
        </motion.div>,
        document.body
      )}
    </>
  )
}

export default TrackRow
