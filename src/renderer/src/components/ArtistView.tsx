import { useEffect, useState } from 'react'
import { searchTracksSoundcloud, TrackResult } from '../api/yandexMusic'
import { usePlayer } from '../player/PlayerContext'
import { useTranslation } from '../utils/useTranslation'
import TrackRow from './TrackRow'
import './ArtistView.css'

interface Props {
  name: string
  onBack: () => void
}

function ArtistView({ name, onBack }: Props): JSX.Element {
  const [tracks, setTracks] = useState<TrackResult[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()
  const { playQueue } = usePlayer()

  useEffect(() => {
    setLoading(true)
    setTracks([])
    searchTracksSoundcloud(name)
      .then((results) => {
        // SoundCloud's search is a text match, not a strict artist filter —
        // prefer tracks actually credited to this artist, but fall back to
        // the raw results if that leaves too little to show.
        const byArtist = results.filter((t) => t.artists[0]?.toLowerCase() === name.toLowerCase())
        setTracks(byArtist.length >= 3 ? byArtist : results)
      })
      .catch(() => setTracks([]))
      .finally(() => setLoading(false))
  }, [name])

  const cover = tracks.find((t) => t.artistCover)?.artistCover ?? null

  return (
    <div className="artist-view view-enter">
      <button className="artist-view__back" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Поиск
      </button>

      <div className="artist-view__header">
        <div className="artist-view__avatar">
          {cover ? (
            <img src={cover} alt="" />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )}
        </div>
        <div className="artist-view__meta">
          <div className="artist-view__label">{t('artist.label')}</div>
          <h1 className="artist-view__name">{name}</h1>
          {tracks.length > 0 && (
            <button className="artist-view__play" onClick={() => playQueue(tracks, 0)}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M5.5 3.5l9 5.5-9 5.5Z" fill="#000" />
              </svg>
              Слушать
            </button>
          )}
        </div>
      </div>

      <section className="artist-view__section">
        <h2 className="artist-view__section-title">{t('artist.popular')}</h2>
        {loading && <div className="artist-view__status">{t('artist.loading')}</div>}
        {!loading && tracks.length === 0 && (
          <div className="artist-view__status">{t('artist.notFound')}</div>
        )}
        {!loading && tracks.length > 0 && (
          <div className="artist-view__tracks">
            {tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} queue={tracks} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default ArtistView
