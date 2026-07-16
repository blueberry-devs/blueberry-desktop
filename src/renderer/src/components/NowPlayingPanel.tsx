import { useState, useRef, useEffect, useCallback } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { useWaveFeed } from '../player/useWaveFeed'
import { toggleLike, useIsLiked } from '../store/likes'
import { usePlaylists, addTrackToPlaylist } from '../store/playlists'
import { Volume2Icon, Mic2Icon } from './icons'
import heartIcon from '../assets/heart.png'
import heartSlashIcon from '../assets/heart-slash.png'
import ServiceBadge from './ServiceBadge'
import VolumeSlider from './VolumeSlider'
import './NowPlayingPanel.css'

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function NowPlayingPanel(): JSX.Element {
  const { waveTrack, isGenerating, skip } = useWaveFeed()
  const {
    currentTrack,
    isPlaying,
    isLoading,
    play,
    togglePlay,
    next,
    previous,
    openLyrics,
    volume,
    setVolume,
    currentTime,
    duration,
    seekTo
  } = usePlayer()
  const displayTrack = currentTrack ?? waveTrack
  const liked = useIsLiked(displayTrack?.id)
  const [showVolume, setShowVolume] = useState(false)
  const [hoveringBar, setHoveringBar] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showPlaylists, setShowPlaylists] = useState(false)
  const volRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const hasTrack = !!displayTrack
  const playlists = usePlaylists()

  useEffect(() => {
    if (!showVolume) return
    const handler = (e: MouseEvent): void => {
      if (volRef.current && !volRef.current.contains(e.target as Node)) setShowVolume(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showVolume])

  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setShowPlaylists(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const handlePlayWave = (): void => {
    if (waveTrack) play(waveTrack)
  }

  const [isDragging, setIsDragging] = useState(false)

  const calcSeek = useCallback((clientX: number): void => {
    if (!barRef.current || !duration) return
    const rect = barRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    seekTo(pct * duration)
  }, [duration, seekTo])

  const handleBarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (!barRef.current || !duration) return
    setIsDragging(true)
    calcSeek(e.clientX)
  }, [duration, calcSeek])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent): void => calcSeek(e.clientX)
    const onUp = (): void => setIsDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, calcSeek])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="now-playing">
      <div className="now-playing__inner">
        <h1 className="now-playing__artist">
          {displayTrack?.artists.join(', ') ?? (isGenerating ? 'Загрузка...' : 'Моя волна')}
        </h1>

        {displayTrack && (
          <div className="now-playing__cover" onClick={() => currentTrack && openLyrics()}>
            {displayTrack.cover ? (
              <img src={displayTrack.cover} alt="" />
            ) : (
              <span className="now-playing__cover-placeholder" />
            )}
            <span className="now-playing__cover-badge">
              <ServiceBadge source={displayTrack.source} size={18} />
            </span>
            {!currentTrack && (
              <button className="now-playing__cover-play" onClick={handlePlayWave} aria-label="play">
                <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
                  <path d="M6 4l11 6-11 6Z" fill="#000" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="now-playing__island-row">
        <div className="now-playing__vol-wrap">
          <button
            className="now-playing__side-btn"
            title="Громкость"
            onClick={() => setShowVolume((v) => !v)}
          >
            <Volume2Icon />
          </button>
          {showVolume && (
            <div className="now-playing__vol-popup" ref={volRef}>
              <VolumeSlider volume={volume} onChange={setVolume} />
            </div>
          )}
        </div>

          <button
            className={`now-playing__side-btn${liked ? ' now-playing__side-btn--liked' : ''}`}
            onClick={() => displayTrack && toggleLike(displayTrack)}
            disabled={!hasTrack}
            title={liked ? 'Не нравится' : 'Мне нравится'}
          >
            <img className="now-playing__heart-icon" src={liked ? heartIcon : heartSlashIcon} alt="" />
          </button>

          <div
            className={`now-playing__island${hoveringBar || isDragging ? ' now-playing__island--hover' : ''}${isDragging ? ' now-playing__island--dragging' : ''}`}
            ref={barRef}
            onMouseDown={handleBarMouseDown}
            onMouseEnter={() => setHoveringBar(true)}
            onMouseLeave={() => setHoveringBar(false)}
          >
            <div className="now-playing__island-fill" style={{ width: `${progress}%` }} />
            <div className="now-playing__island-label">
              {hoveringBar ? (
                <span className="now-playing__island-time">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              ) : (
                <span className="now-playing__island-title">{displayTrack?.title ?? '—'}</span>
              )}
            </div>
          </div>

          <div className="now-playing__menu-wrap" ref={menuRef}>
            <button
              className="now-playing__side-btn"
              onClick={() => setShowMenu((v) => !v)}
              disabled={!hasTrack}
              title="Ещё"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="4" cy="9" r="1.5" fill="currentColor" />
                <circle cx="9" cy="9" r="1.5" fill="currentColor" />
                <circle cx="14" cy="9" r="1.5" fill="currentColor" />
              </svg>
            </button>

            {showMenu && (
              <div className="now-playing__dropdown">
                <button
                  className="now-playing__dropdown-item"
                  onClick={() => {
                    setShowMenu(false)
                    skip()
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Моя волна по треку
                </button>
                <button
                  className="now-playing__dropdown-item"
                  onClick={() => {
                    setShowPlaylists((v) => !v)
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Добавить в плейлист
                </button>
                {showPlaylists && displayTrack && (
                  <div className="now-playing__dropdown-sub">
                    {playlists.length === 0 ? (
                      <div className="now-playing__dropdown-empty">Нет плейлистов</div>
                    ) : (
                      playlists.map((p) => (
                        <button
                          key={p.id}
                          className="now-playing__dropdown-subitem"
                          onClick={() => {
                            addTrackToPlaylist(p.id, displayTrack)
                            setShowMenu(false)
                            setShowPlaylists(false)
                          }}
                        >
                          {p.cover && (
                            <span className="now-playing__dropdown-subcover" style={{ backgroundImage: `url(${p.cover})` }} />
                          )}
                          {p.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
                <button
                  className="now-playing__dropdown-item"
                  onClick={() => {
                    setShowMenu(false)
                    openLyrics()
                  }}
                >
                  <Mic2Icon size={16} />
                  Текст песни
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="now-playing__transport">
          <button className="now-playing__transport-btn" onClick={previous} disabled={!currentTrack} title="Назад">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L5 10L13 16V4Z" fill="currentColor" />
              <rect x="3" y="5" width="2" height="10" fill="currentColor" />
            </svg>
          </button>

          <button
            className="now-playing__play-btn"
            onClick={currentTrack ? togglePlay : handlePlayWave}
            disabled={!hasTrack}
            title={isPlaying ? 'Пауза' : 'Играть'}
          >
            {isLoading ? (
              <span className="now-playing__spinner" />
            ) : isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="5" y="4" width="4" height="14" fill="#000" />
                <rect x="13" y="4" width="4" height="14" fill="#000" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M6 3L18 11L6 19V3Z" fill="#000" />
              </svg>
            )}
          </button>

          <button className="now-playing__transport-btn" onClick={next} disabled={!currentTrack} title="Вперёд">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 4L15 10L7 16V4Z" fill="currentColor" />
              <rect x="15" y="5" width="2" height="10" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default NowPlayingPanel
