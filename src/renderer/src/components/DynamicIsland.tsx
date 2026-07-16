import { useState } from 'react'
import { motion } from 'motion/react'
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, HeartIcon, Mic2Icon } from './icons'
import { usePlayer } from '../player/PlayerContext'
import { toggleLike, useIsLiked } from '../store/likes'
import ServiceBadge from './ServiceBadge'
import './DynamicIsland.css'

function formatTime(sec?: number): string {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function DynamicIsland({ className = '', onExpand }: { className?: string; onExpand?: () => void }): JSX.Element | null {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    togglePlay,
    next,
    previous,
    openLyrics,
    seekTo
  } = usePlayer()
  const liked = useIsLiked(currentTrack?.id)
  const [isHovered, setIsHovered] = useState(false)

  if (!currentTrack) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    seekTo(((e.clientX - rect.left) / rect.width) * duration)
  }

  const handlePillClick = (): void => {
    if (!isHovered) return
    onExpand?.()
  }

  return (
    <div
      className={`dyn-island ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="dyn-island__pill"
        animate={{ width: isHovered ? 320 : 260 }}
        transition={{ type: 'spring', bounce: 0.3, duration: 0.35 }}
        onClick={handlePillClick}
      >
        {isHovered && (
          <div className="dyn-island__progress" onClick={(e) => e.stopPropagation()}>
            <div className="dyn-island__time">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="dyn-island__progress-track" onClick={handleProgressClick}>
              <div className="dyn-island__progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="dyn-island__row">
          <div className="dyn-island__cover" onClick={(e) => e.stopPropagation()}>
            {currentTrack.cover ? (
              <img src={currentTrack.cover} alt="" />
            ) : (
              <div className="dyn-island__cover-placeholder" />
            )}
            <span className="dyn-island__cover-badge">
              <ServiceBadge source={currentTrack.source} size={14} />
            </span>
          </div>

          <div className="dyn-island__meta">
            <div className="dyn-island__title">{currentTrack.title}</div>
            <div className="dyn-island__artist">
              {isLoading ? 'Загрузка…' : currentTrack.artists.join(', ')}
            </div>
          </div>

          <div className="dyn-island__controls" onClick={(e) => e.stopPropagation()}>
            <button className="dyn-island__ctrl-btn" onClick={previous} aria-label="prev">
              <SkipBackIcon />
            </button>
            <button
              className="dyn-island__ctrl-btn dyn-island__ctrl-btn--play"
              onClick={togglePlay}
              disabled={isLoading}
              aria-label={isPlaying ? 'pause' : 'play'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button className="dyn-island__ctrl-btn" onClick={next} aria-label="next">
              <SkipForwardIcon />
            </button>
          </div>

          {isHovered && (
            <div className="dyn-island__extras" onClick={(e) => e.stopPropagation()}>
              <button
                className="dyn-island__icon-btn"
                onClick={openLyrics}
                aria-label="lyrics"
                title="Текст песни"
              >
                <Mic2Icon />
              </button>

              <button
                className={`dyn-island__icon-btn${liked ? ' dyn-island__icon-btn--active' : ''}`}
                onClick={() => toggleLike(currentTrack)}
                aria-label="like"
                title="Мне нравится"
              >
                <HeartIcon fill={liked ? 'currentColor' : 'none'} />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default DynamicIsland
