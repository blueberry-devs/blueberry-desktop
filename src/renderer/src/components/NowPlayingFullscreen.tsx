import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePlayer, usePlayerTime } from '../player/PlayerContext'
import { useTranslation } from '../utils/useTranslation'
import { activeLineIndex } from '../utils/lrc'
import { toggleLike, useIsLiked } from '../store/likes'
import { usePlaylists, addTrackToPlaylist } from '../store/playlists'
import { useProfile } from '../store/profile'
import { fetchVideoClip } from '../api/yandexMusic'
import log from 'electron-log/renderer'
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ShuffleIcon,
  RepeatIcon,
  ListIcon,
  MoreHorizontalIcon,
  Mic2Icon,
  HeartIcon
} from './icons'
import './NowPlayingFullscreen.css'

const _clipCache = new Map<string, string | null>()

function NowPlayingFullscreen(): JSX.Element | null {
  const { currentTime, duration } = usePlayerTime()
  const {
    currentTrack,
    closeLyrics,
    lyricsOpenMode,
    lyrics,
    lyricsPlain,
    lyricsLoading,
    isPlaying,
    isLoading,
    togglePlay,
    next,
    previous,
    shuffleQueue,
    loopMode,
    cycleLoopMode,
    seekTo,
    queue,
    queueIndex,
    playQueue
  } = usePlayer()
  const activeLineRef = useRef<HTMLParagraphElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  // Cover-focused view (matches the reference screens) is the default —
  // lyrics are an opt-in secondary mode via the text-toggle button, not the
  // other way around.
  const [showLyrics, setShowLyrics] = useState(lyricsOpenMode === 'lyrics')
  const [hoveringCover, setHoveringCover] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const liked = useIsLiked(currentTrack?.id)
  const queueRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [clipUrl, setClipUrl] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showPlaylists, setShowPlaylists] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const playlists = usePlaylists()
  const profile = useProfile()
  const { t } = useTranslation()

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

  useEffect(() => {
    setClipUrl(null)
    if (!currentTrack || !profile.videoBackground) return
    const trackId = currentTrack.id
    const cached = _clipCache.get(trackId)
    if (cached !== undefined) {
      if (cached) log.debug('[cache] Video background: %s', cached.slice(0, 60))
      setClipUrl(cached)
      return
    }
    let cancelled = false
    log.debug('[0%] Fetching video background for %s - %s', currentTrack.title, currentTrack.artists[0])
    fetchVideoClip(currentTrack.title, currentTrack.artists[0] ?? '')
      .then((url) => {
        if (cancelled) return
        _clipCache.set(trackId, url)
        if (url) {
          log.debug('[100%] Video background ready: %s', url.slice(0, 60))
        } else {
          log.debug('[100%] No video background found')
        }
        setClipUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [currentTrack?.id, profile.videoBackground])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !clipUrl) return
    if (isPlaying) {
      if (video.paused) video.play().catch(() => {})
    } else {
      if (!video.paused) video.pause()
    }
  }, [isPlaying, clipUrl])

  const progress = duration > 0 ? currentTime / duration : 0
  const activeIndex = isPlaying && lyrics ? activeLineIndex(lyrics, currentTime) : -1

  const justOpenedLyricsRef = useRef(false)
  useEffect(() => {
    if (showLyrics) justOpenedLyricsRef.current = true
  }, [showLyrics])

  useEffect(() => {
    // Also re-fires on showLyrics: the active line's ref doesn't exist while
    // the panel is unmounted, so opening it mid-song (activeIndex unchanged
    // from before it was hidden) would otherwise never scroll to where the
    // song actually is — it only ever reacted to the index itself changing.
    // Snap instantly right after opening (a long animated scroll across the
    // whole panel on open looks broken); smooth-scroll for genuine
    // line-to-line advances while already open.
    const instant = justOpenedLyricsRef.current
    justOpenedLyricsRef.current = false
    activeLineRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'center' })
  }, [activeIndex, showLyrics])

  useEffect(() => {
    if (!showQueue) return
    const handler = (e: MouseEvent): void => {
      if (queueRef.current && !queueRef.current.contains(e.target as Node)) setShowQueue(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showQueue])

  const calcSeek = (clientX: number): void => {
    if (!barRef.current || !duration) return
    const rect = barRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    seekTo(pct * duration)
  }

  if (!currentTrack) return null

  const upcoming = queue.slice(queueIndex + 1)

  return (
    <motion.div
      className="np-fullscreen"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {clipUrl ? (
        <div className="np-fullscreen__video-wrap">
          <video
            ref={videoRef}
            key={clipUrl}
            className="np-fullscreen__bg-video"
            src={clipUrl}
            autoPlay
            muted
            playsInline
            loop
            onLoadedMetadata={() => {
              const video = videoRef.current
              if (video) {
                video.currentTime = Math.min(currentTime, video.duration || 0)
              }
            }}
          />
        </div>
      ) : (
        currentTrack.cover && (
          <div className="np-fullscreen__bg" style={{ backgroundImage: `url(${currentTrack.cover})` }} />
        )
      )}
      <div className="np-fullscreen__scrim" />

      <button className="np-fullscreen__close" onClick={closeLyrics}>
        <svg width="18" height="18" viewBox="0 0 8 18" fill="none">
          <path d="M7 1l-6 8 6 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={`np-fullscreen__body${showLyrics ? '' : ' np-fullscreen__body--centered'}`}>
        <div className="np-fullscreen__left">
          <div
            className="np-fullscreen__cover"
            onMouseEnter={() => setHoveringCover(true)}
            onMouseLeave={() => setHoveringCover(false)}
          >
            {currentTrack.cover ? (
              <img src={currentTrack.cover} alt="" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}

            <div className={`np-fullscreen__overlay${hoveringCover ? ' np-fullscreen__overlay--visible' : ''}`}>
              <div className="np-fullscreen__queue-wrap" ref={queueRef}>
                <button
                  className="np-fullscreen__icon-btn np-fullscreen__queue-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowQueue((v) => !v)
                  }}
                  title={t('player.queue')}
                >
                  <ListIcon size={16} />
                </button>
                {showQueue && (
                  <div className="np-fullscreen__queue-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="np-fullscreen__queue-title">Далее</div>
                    {upcoming.length === 0 ? (
                      <div className="np-fullscreen__queue-empty">Очередь пуста</div>
                    ) : (
                      upcoming.slice(0, 8).map((t, i) => (
                        <button
                          key={t.id}
                          className="np-fullscreen__queue-item"
                          onClick={() => playQueue(queue, queueIndex + 1 + i)}
                        >
                          {t.cover && (
                            <span className="np-fullscreen__queue-item-cover" style={{ backgroundImage: `url(${t.cover})` }} />
                          )}
                          <span className="np-fullscreen__queue-item-meta">
                            <span className="np-fullscreen__queue-item-title">{t.title}</span>
                            <span className="np-fullscreen__queue-item-artist">{t.artists.join(', ')}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="np-fullscreen__transport">
                <button
                  className="np-fullscreen__icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    shuffleQueue()
                  }}
                  title={t('player.shuffle')}
                >
                  <ShuffleIcon size={17} />
                </button>
                <button
                  className="np-fullscreen__icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    previous()
                  }}
                  title={t('player.prev')}
                >
                  <SkipBackIcon size={18} />
                </button>
                <button
                  className="np-fullscreen__play-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePlay()
                  }}
                  disabled={isLoading}
                  title={t(isPlaying ? 'player.pause' : 'player.play')}
                >
                  {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={18} />}
                </button>
                <button
                  className="np-fullscreen__icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    next()
                  }}
                  title={t('player.next')}
                >
                  <SkipForwardIcon size={18} />
                </button>
                <button
                  className={`np-fullscreen__icon-btn${loopMode !== 'off' ? ' np-fullscreen__icon-btn--active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    cycleLoopMode()
                  }}
                  title={t('player.loop')}
                >
                  <RepeatIcon size={17} />
                  {loopMode === 'track' && <span className="np-fullscreen__loop-badge">1</span>}
                </button>
              </div>

              <div className="np-fullscreen__utils">
                <div className="np-fullscreen__menu-wrap" ref={menuRef}>
                  <button
                    className="np-fullscreen__icon-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu((v) => !v)
                    }}
                    title={t('common.more')}
                  >
                    <MoreHorizontalIcon size={17} />
                  </button>
                  {showMenu && (
                    <div className="np-fullscreen__queue-popup" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="np-fullscreen__queue-item np-fullscreen__queue-item--action"
                        onClick={() => setShowPlaylists((v) => !v)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        {t('wave.addToPlaylist')}
                      </button>
                      {showPlaylists && (
                        <div className="np-fullscreen__queue-sub">
                          {playlists.length === 0 ? (
                            <div className="np-fullscreen__queue-empty">{t('wave.noPlaylists')}</div>
                          ) : (
                            playlists.map((p) => (
                              <button
                                key={p.id}
                                className="np-fullscreen__queue-item"
                                onClick={() => {
                                  addTrackToPlaylist(p.id, currentTrack)
                                  setShowMenu(false)
                                  setShowPlaylists(false)
                                }}
                              >
                                {p.cover && (
                                  <span className="np-fullscreen__queue-item-cover" style={{ backgroundImage: `url(${p.cover})` }} />
                                )}
                                <span className="np-fullscreen__queue-item-title">{p.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className={`np-fullscreen__icon-btn${showLyrics ? ' np-fullscreen__icon-btn--active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowLyrics((v) => !v)
                  }}
                  title={t('player.lyrics')}
                >
                  <Mic2Icon size={16} />
                </button>
                <button
                  className={`np-fullscreen__icon-btn${liked ? ' np-fullscreen__icon-btn--liked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLike(currentTrack)
                  }}
                  title={t(liked ? 'player.unlike' : 'player.like')}
                >
                  <HeartIcon size={16} fill={liked ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          </div>
          <div className="np-fullscreen__title">
            {currentTrack.title}
            {currentTrack.explicit && (
              <span className="np-fullscreen__explicit-badge" title={t('explicit.badge')}>
                !
              </span>
            )}
          </div>
          <div className="np-fullscreen__artist">{currentTrack.artists.join(', ')}</div>
          <div className="np-fullscreen__progress" ref={barRef} onClick={(e) => calcSeek(e.clientX)}>
            <div className="np-fullscreen__progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {showLyrics && (
          <motion.div
            className="np-fullscreen__lyrics"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {lyricsLoading && <div className="np-fullscreen__status">Загружаем текст…</div>}

            {!lyricsLoading && lyrics && lyrics.length > 0 && (
              <>
                {lyrics.map((line, i) => (
                  <p
                    key={i}
                    ref={i === activeIndex ? activeLineRef : null}
                    className={`np-fullscreen__line${i === activeIndex ? ' np-fullscreen__line--active' : ''}`}
                  >
                    {line.text}
                  </p>
                ))}
              </>
            )}

            {!lyricsLoading && (!lyrics || lyrics.length === 0) && lyricsPlain && lyricsPlain.length > 0 && (
              <>
                {lyricsPlain.map((line, i) => (
                  <p key={i} className="np-fullscreen__line np-fullscreen__line--plain">
                    {line}
                  </p>
                ))}
              </>
            )}

            {!lyricsLoading &&
              (!lyrics || lyrics.length === 0) &&
              (!lyricsPlain || lyricsPlain.length === 0) && (
                <div className="np-fullscreen__status">Текст песни не найден</div>
              )}
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default NowPlayingFullscreen
