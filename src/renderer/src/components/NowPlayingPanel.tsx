import { useState, useRef, useEffect, useCallback } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { useWaveFeed } from '../player/useWaveFeed'
import { toggleLike, useIsLiked } from '../store/likes'
import { usePlaylists, addTrackToPlaylist } from '../store/playlists'
import { useTranslation } from '../utils/useTranslation'
import { useProfile, setWaveColorPreset } from '../store/profile'
import { COLOR_PRESETS } from './PlasmaWave'
import { Volume2Icon, Mic2Icon, Maximize2Icon } from './icons'
import heartIcon from '../assets/heart.png'
import heartSlashIcon from '../assets/heart-slash.png'
import ServiceBadge from './ServiceBadge'
import VolumeSlider from './VolumeSlider'
import './NowPlayingPanel.css'

const ARTIST_SPLASHES: Record<string, string> = {
  'skillet': '/api/artist-image/skillet',
  'linkin park': '/api/artist-image/linkin-park',
  'limp bizkit': '/api/artist-image/limp-bizkit',
  'disturbed': '/api/artist-image/disturbed',
}

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatSubmenuPos(
  subRef: React.RefObject<HTMLDivElement | null>,
  parentRef: React.RefObject<HTMLButtonElement | null>,
  flipH: boolean
): { cls: string; maxHeight: number } {
  const el = subRef.current
  const parent = parentRef.current
  if (!el || !parent) return { cls: '', maxHeight: 0 }
  const pr = parent.getBoundingClientRect()
  const sr = el.getBoundingClientRect()
  const gap = 8
  let cls = ''
  let maxHeight = 0

  // Vertical: prefer opening downward
  const spaceBelow = window.innerHeight - pr.bottom - gap
  const spaceAbove = pr.top - gap
  if (sr.height > spaceBelow && spaceAbove > spaceBelow) {
    cls += ' now-playing__dropdown-sub--up'
    maxHeight = spaceAbove
  } else {
    maxHeight = spaceBelow
  }

  if (flipH && pr.right + sr.width > window.innerWidth) {
    cls += ' now-playing__dropdown-sub--left'
  }

  return { cls, maxHeight }
}

function PlaylistSubmenu({
  show,
  displayTrack,
  playlists,
  addTrackToPlaylist,
  setShowMenu,
  setShowPlaylists,
}: {
  show: boolean
  displayTrack: any
  playlists: any[]
  addTrackToPlaylist: (id: string, track: any) => void
  setShowMenu: (v: boolean) => void
  setShowPlaylists: React.Dispatch<React.SetStateAction<boolean>>
}): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const [posData, setPosData] = useState({ cls: '', maxHeight: 0 })

  useEffect(() => {
    if (!show) { setPosData({ cls: '', maxHeight: 0 }); return }
    requestAnimationFrame(() => requestAnimationFrame(() =>
      setPosData(formatSubmenuPos(subRef, btnRef, true))
    ))
  }, [show])

  const scrollCls = posData.maxHeight > 0 ? ' now-playing__dropdown-sub--scroll' : ''

  return (
    <div className="now-playing__dropdown-item-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        className="now-playing__dropdown-item"
        onClick={() => setShowPlaylists((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="now-playing__dropdown-item-label">В плейлист</span>
        <svg className="now-playing__dropdown-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {show && displayTrack && (
        <div ref={subRef} className={`now-playing__dropdown-sub${posData.cls}${scrollCls}`} style={posData.maxHeight > 0 ? { maxHeight: posData.maxHeight } : undefined}>
          {playlists.length === 0 ? (
            <div className="now-playing__dropdown-empty">{'Нет плейлистов'}</div>
          ) : (
            playlists.map((p: any) => (
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
    </div>
  )
}

function ColorPresetSubmenu({
  show,
  profile,
  setShowMenu,
  setShowColorPresets,
}: {
  show: boolean
  profile: { waveColorPreset: string }
  setShowMenu: (v: boolean) => void
  setShowColorPresets: React.Dispatch<React.SetStateAction<boolean>>
}): JSX.Element {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const [posData, setPosData] = useState({ cls: '', maxHeight: 0 })

  useEffect(() => {
    if (!show) { setPosData({ cls: '', maxHeight: 0 }); return }
    requestAnimationFrame(() => requestAnimationFrame(() =>
      setPosData(formatSubmenuPos(subRef, btnRef, true))
    ))
  }, [show])

  const scrollCls = posData.maxHeight > 0 ? ' now-playing__dropdown-sub--scroll' : ''
  const currentLabel = COLOR_PRESETS.find(p => p.id === profile.waveColorPreset)?.id
  const currentLabelKey = currentLabel ? `wave.preset.${currentLabel}` : ''

  return (
    <div className="now-playing__dropdown-item-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        className="now-playing__dropdown-item"
        onClick={() => setShowColorPresets((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="3" cy="3" r="2" fill="currentColor" opacity="0.3" />
          <circle cx="13" cy="3" r="2" fill="currentColor" opacity="0.5" />
          <circle cx="8" cy="6" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="3" cy="11" r="2" fill="currentColor" opacity="0.9" />
          <circle cx="13" cy="11" r="2" fill="currentColor" />
          <circle cx="8" cy="14" r="2" fill="currentColor" opacity="0.5" />
        </svg>
        <span className="now-playing__dropdown-item-label">{currentLabelKey ? t(currentLabelKey) : 'Цвета волны'}</span>
        <svg className="now-playing__dropdown-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {show && (
        <div ref={subRef} className={`now-playing__dropdown-sub${posData.cls}${scrollCls}`} style={posData.maxHeight > 0 ? { maxHeight: posData.maxHeight } : undefined}>
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`now-playing__dropdown-subitem${preset.id === profile.waveColorPreset ? ' now-playing__dropdown-subitem--active' : ''}`}
              onClick={() => {
                setWaveColorPreset(preset.id)
                setShowColorPresets(false)
                setShowMenu(false)
              }}
            >
              {t(`wave.preset.${preset.id}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NowPlayingPanel(): JSX.Element {
  const { t } = useTranslation()
  const { waveTrack, isGenerating, skip } = useWaveFeed()
  const {
    currentTrack,
    isPlaying,
    isLoading,
    play,
    playWithSource,
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
  const [showColorPresets, setShowColorPresets] = useState(false)
  const [menuPosCls, setMenuPosCls] = useState('')
  const menuDropRef = useRef<HTMLDivElement>(null)
  const volRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const hasTrack = !!displayTrack
  const playlists = usePlaylists()
  const profile = useProfile()

  useEffect(() => {
    if (!showVolume) return
    const handler = (e: MouseEvent): void => {
      if (volRef.current && !volRef.current.contains(e.target as Node)) setShowVolume(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showVolume])

  useEffect(() => {
    if (!showMenu) { setMenuPosCls(''); return }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const d = menuDropRef.current
      if (!d) return
      const r = d.getBoundingClientRect()
      setMenuPosCls(r.bottom > window.innerHeight ? ' now-playing__dropdown--up' : '')
    }))
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setShowPlaylists(false)
        setShowColorPresets(false)
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

  let coverEl: JSX.Element | null = null
  if (displayTrack) {
    const artistName = displayTrack.artists[0]?.toLowerCase() ?? ''
    const splash = ARTIST_SPLASHES[artistName]
    if (splash) {
      const base = 'http://localhost:8787'
      coverEl = (
        <div className="now-playing__splash">
          <img className="now-playing__splash-img" src={`${base}${splash}`} alt="" />
        </div>
      )
    } else {
      coverEl = (
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
      )
    }
  }

  return (
    <div className="now-playing">
      <div className="now-playing__inner">
        <h1 className={`now-playing__artist${ARTIST_SPLASHES[displayTrack?.artists[0]?.toLowerCase() ?? ''] ? ' now-playing__artist--splash' : ''}`}>
          {displayTrack?.artists.join(', ') ?? (isGenerating ? t('player.generating') : t('sidebar.wave'))}
        </h1>

        {coverEl}

        <div className="now-playing__island-row">
        <div className="now-playing__vol-wrap">
          <button
            className="now-playing__side-btn"
            title={t('player.volume')}
            onClick={() => setShowVolume((v) => !v)}
          >
            <Volume2Icon size={22} />
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
            title={liked ? t('player.unlike') : t('player.like')}
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

          <button
            className="now-playing__side-btn"
            onClick={() => currentTrack && openLyrics()}
            disabled={!currentTrack}
            title={t('common.expand')}
          >
            <Maximize2Icon size={21} />
          </button>

          <div className="now-playing__menu-wrap" ref={menuRef}>
            <button
              className="now-playing__side-btn"
              onClick={() => setShowMenu((v) => !v)}
              disabled={!hasTrack}
              title={t('common.more')}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="4" cy="9" r="1.5" fill="currentColor" />
                <circle cx="9" cy="9" r="1.5" fill="currentColor" />
                <circle cx="14" cy="9" r="1.5" fill="currentColor" />
              </svg>
            </button>

            {showMenu && (
              <div ref={menuDropRef} className={`now-playing__dropdown${menuPosCls}`}>
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
                  {t('wave.byTrack')}
                </button>
                <PlaylistSubmenu
                  show={showPlaylists}
                  displayTrack={displayTrack}
                  playlists={playlists}
                  addTrackToPlaylist={addTrackToPlaylist}
                  setShowMenu={setShowMenu}
                  setShowPlaylists={setShowPlaylists}
                />
                <ColorPresetSubmenu
                  show={showColorPresets}
                  profile={profile}
                  setShowMenu={setShowMenu}
                  setShowColorPresets={setShowColorPresets}
                />
                
                <button
                  className="now-playing__dropdown-item"
                  onClick={() => {
                    setShowMenu(false)
                    openLyrics('lyrics')
                  }}
                >
                  <Mic2Icon size={16} />
                  {t('player.lyrics')}
                </button>
                {currentTrack && (
                  <>
                    <button
                      className="now-playing__dropdown-item"
                      onClick={() => {
                        setShowMenu(false)
                        playWithSource('soundcloud')
                      }}
                    >
                      <ServiceBadge source="soundcloud" size={16} />
                      {t('wave.listenVia').replace('{source}', 'SoundCloud')}
                    </button>
                    <button
                      className="now-playing__dropdown-item"
                      onClick={() => {
                        setShowMenu(false)
                        playWithSource('youtube')
                      }}
                    >
                      <ServiceBadge source="youtube" size={16} />
                      {t('wave.listenVia').replace('{source}', 'YouTube')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="now-playing__transport">
          <button className="now-playing__transport-btn" onClick={previous} disabled={!currentTrack} title={t('player.prev')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L5 10L13 16V4Z" fill="currentColor" />
              <rect x="3" y="5" width="2" height="10" fill="currentColor" />
            </svg>
          </button>

          <button
            className="now-playing__play-btn"
            onClick={currentTrack ? togglePlay : handlePlayWave}
            disabled={!hasTrack}
            title={isPlaying ? t('player.pause') : t('player.play')}
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

          <button className="now-playing__transport-btn" onClick={next} disabled={!currentTrack} title={t('player.next')}>
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
