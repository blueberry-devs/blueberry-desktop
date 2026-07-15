import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { usePlayer } from '../player/PlayerContext'
import { activeLineIndex } from '../utils/lrc'
import './NowPlayingFullscreen.css'

function NowPlayingFullscreen(): JSX.Element | null {
  const { currentTrack, closeLyrics, lyrics, lyricsPlain, lyricsLoading, currentTime, duration, isPlaying } = usePlayer()
  const activeLineRef = useRef<HTMLParagraphElement>(null)

  const progress = duration > 0 ? currentTime / duration : 0
  const activeIndex = isPlaying && lyrics ? activeLineIndex(lyrics, currentTime) : -1

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIndex])

  if (!currentTrack) return null

  return (
    <motion.div
      className="np-fullscreen"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {currentTrack.cover && (
        <div className="np-fullscreen__bg" style={{ backgroundImage: `url(${currentTrack.cover})` }} />
      )}
      <div className="np-fullscreen__scrim" />

      <button className="np-fullscreen__close" onClick={closeLyrics}>
        <svg width="18" height="18" viewBox="0 0 8 18" fill="none">
          <path d="M7 1l-6 8 6 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="np-fullscreen__body">
        <div className="np-fullscreen__left">
          <div className="np-fullscreen__cover">
            {currentTrack.cover ? (
              <img src={currentTrack.cover} alt="" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}
          </div>
          <div className="np-fullscreen__title">
            {currentTrack.title}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="np-fullscreen__info">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <line x1="7" y1="6.2" x2="7" y2="10" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="7" cy="4.2" r="0.7" fill="currentColor" />
            </svg>
          </div>
          <div className="np-fullscreen__artist">{currentTrack.artists.join(', ')}</div>
          <div className="np-fullscreen__progress">
            <div className="np-fullscreen__progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        <div className="np-fullscreen__lyrics">
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
        </div>
      </div>
    </motion.div>
  )
}

export default NowPlayingFullscreen
