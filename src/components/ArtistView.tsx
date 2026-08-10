import { useEffect, useState } from 'react'
import { searchTracksSoundcloud, TrackResult } from '../api/yandexMusic'
import { usePlayer } from '../player/PlayerContext'
import { useTranslation } from '../utils/useTranslation'
import { toggleFavoriteArtist, useIsFavoriteArtist } from '../store/favoriteArtists'
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
  const isFavorite = useIsFavoriteArtist(name)

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
        {t('artist.back')}
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
          <div className="artist-view__name-row">
            <h1 className="artist-view__name">{name}</h1>
            <button
              className={`artist-view__favorite${isFavorite ? ' artist-view__favorite--active' : ''}`}
              onClick={() => toggleFavoriteArtist({ name, cover, trackTitle: tracks[0]?.title ?? '' })}
              aria-label={isFavorite ? 'Убрать артиста из избранного' : 'Добавить артиста в избранное'}
              title={isFavorite ? 'Убрать из любимых артистов' : 'Добавить в любимые артисты'}
            >
              <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                <path d="M9 15.5S2 11.2 2 6.8C2 4.4 3.9 2.8 6 2.8c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.1 0 4 1.6 4 4 0 4.4-7 8.7-7 8.7Z" fill="currentColor" />
              </svg>
            </button>
          </div>
          <div className="artist-view__actions">
            {tracks.length > 0 && (
              <button className="artist-view__play" onClick={() => playQueue(tracks, 0)}>
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <path d="M5.5 3.5l9 5.5-9 5.5Z" fill="#000" />
                </svg>
                {t('artist.listenBtn')}
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="artist-view__section">
        <h2 className="artist-view__section-title">{t('artist.popular')}</h2>
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
