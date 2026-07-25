import { useEffect, useMemo, useState } from 'react'
import { fetchTrendsMonthly, searchTracksMulti, searchTracksSoundcloud, searchArtistTracks, TrackResult } from '../api/yandexMusic'
import { usePlayer } from '../player/PlayerContext'
import { useLikedTracks } from '../store/likes'
import { useHistory } from '../store/history'
import { useTranslation } from '../utils/useTranslation'
import { useArtistCovers } from '../hooks/useArtistCovers'
import { requestArtistSearch } from '../store/searchQuery'
import TrackRow from './TrackRow'
import './TrendsView.css'

type TopTab = 'foryou' | 'trends'
type MoodFilter = 'mood' | 'activity' | 'genre'

const STYLE_CHIPS: { label: string; query: string }[] = [
  { label: 'Рок', query: 'rock music' },
  { label: 'Хип-хоп', query: 'hip hop music' },
  { label: 'Поп', query: 'pop music' },
  { label: 'Метал', query: 'metal music' },
  { label: 'Инди', query: 'indie music' },
  { label: 'Электроника', query: 'electronic music' }
]

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const EXPLORE_GENRES = [
  { label: 'Альтернативное прошлое', query: 'alternative rock', gradient: 'linear-gradient(135deg,#2c2c34,#4a4a58)' },
  { label: 'Бег по лужам', query: 'indie rock', gradient: 'linear-gradient(135deg,#1e2a3a,#3a5068)' },
  { label: 'Энергия поп-панка', query: 'pop punk', gradient: 'linear-gradient(135deg,#5b2a86,#8a5cf6)' },
  { label: 'Когда вскипает кровь', query: 'metalcore', gradient: 'linear-gradient(135deg,#8a3a1a,#ff7a3d)' },
  { label: 'Альтернативный разбег', query: 'alt rock hits', gradient: 'linear-gradient(135deg,#7a1a3a,#ff2d95)' }
]

function TrendsView(): JSX.Element {
  const [topTab, setTopTab] = useState<TopTab>('foryou')
  const [moodFilter, setMoodFilter] = useState<MoodFilter>('mood')
  const [monthlyTrends, setMonthlyTrends] = useState<TrackResult[]>([])
  const [styleChip, setStyleChip] = useState(STYLE_CHIPS[0].label)
  const [styleTracks, setStyleTracks] = useState<TrackResult[]>([])
  const [recommended, setRecommended] = useState<TrackResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { play, playQueue } = usePlayer()
  const liked = useLikedTracks()
  const history = useHistory()
  const { t } = useTranslation()

  // Mood-based preset cards
  const moodCards: Record<MoodFilter, { kicker: string; label: string; query: string }[]> = {
    mood: [
      { kicker: 'Настроение', label: 'Энергичное', query: 'energetic hype' },
      { kicker: 'Настроение', label: 'Спокойное', query: 'chill instrumental' },
      { kicker: 'Настроение', label: 'Вдохновляющее', query: 'inspirational epic' }
    ],
    activity: [
      { kicker: 'Активность', label: 'Бег', query: 'running workout' },
      { kicker: 'Активность', label: 'Работа', query: 'focus instrumental' },
      { kicker: 'Активность', label: 'Вечеринка', query: 'party hits' }
    ],
    genre: [
      { kicker: 'Жанр', label: 'Рок', query: 'рок' },
      { kicker: 'Жанр', label: 'Хип-хоп', query: 'хип-хоп' },
      { kicker: 'Жанр', label: 'Электроника', query: 'электроника' }
    ]
  }

  // Fetch monthly chart
  useEffect(() => {
    fetchTrendsMonthly()
      .then(setMonthlyTrends)
      .catch(() => setError(t('trends.error')))
      .finally(() => setLoading(false))
  }, [])

  // Fetch style chips
  useEffect(() => {
    const query = STYLE_CHIPS.find((c) => c.label === styleChip)?.query ?? styleChip
    searchTracksMulti(query, ['yandex', 'soundcloud', 'youtube'])
      .then((res) => setStyleTracks(shuffle(res).slice(0, 10)))
      .catch(() => setStyleTracks([]))
  }, [styleChip])

  // Build recommended section from liked tracks
  useEffect(() => {
    if (liked.length === 0) return
    const artistCount = new Map<string, number>()
    for (const t of liked) {
      const name = t.artists[0]
      if (name) artistCount.set(name, (artistCount.get(name) ?? 0) + 1)
    }
    const topArtists = Array.from(artistCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
    if (topArtists.length === 0) return

    Promise.all(
      topArtists.map((name) =>
        searchArtistTracks(name)
          .catch(() => searchTracksSoundcloud(name))
          .catch(() => [] as TrackResult[])
      )
    ).then((results) => {
      const seen = new Set<string>()
      const merged: TrackResult[] = []
      for (const tracks of results) {
        for (const t of tracks) {
          const sig = `${t.artists[0] ?? ''}::${t.title}`.toLowerCase()
          if (seen.has(sig)) continue
          seen.add(sig)
          merged.push(t)
        }
      }
      setRecommended(shuffle(merged).slice(0, 20))
    })
  }, [liked])

  const metArtistTracks = useMemo(() => {
    const map = new Map<string, { name: string; cover: string | null; trackTitle: string }>()
    for (const t of liked) {
      const name = t.artists[0]
      if (name && !map.has(name)) map.set(name, { name, cover: t.artistCover ?? null, trackTitle: t.title })
    }
    return Array.from(map.values()).slice(0, 8)
  }, [liked])

  const resolvedArtistCovers = useArtistCovers(
    metArtistTracks.filter((a) => !a.cover).map((a) => ({ name: a.name, trackTitle: a.trackTitle }))
  )

  const metArtists = metArtistTracks.map((a) => ({
    name: a.name,
    cover: a.cover ?? resolvedArtistCovers.get(a.name) ?? null
  }))

  const playMood = (query: string): void => {
    searchTracksMulti(query, ['yandex', 'soundcloud', 'youtube'])
      .then((res) => {
        const shuffled = shuffle(res)
        if (shuffled.length > 0) playQueue(shuffled, 0)
      })
      .catch(() => {})
  }

  return (
    <div className="trends-view view-enter">
      <h1 className="trends-view__title">{t('trends.title')}</h1>

      <div className="trends-view__toptabs">
        <button
          className={`trends-view__toptab${topTab === 'foryou' ? ' trends-view__toptab--active' : ''}`}
          onClick={() => setTopTab('foryou')}
        >
          {t('trends.foryou')}
        </button>
        <button
          className={`trends-view__toptab${topTab === 'trends' ? ' trends-view__toptab--active' : ''}`}
          onClick={() => setTopTab('trends')}
        >
          {t('trends.trends')}
        </button>
      </div>

      {loading && (
        <>
          <div className="trends-view__release-row" style={{ marginBottom: 32 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton-release">
                <div className="skeleton skeleton-release__avatar" />
                <div className="skeleton skeleton-release__name" />
                <div className="skeleton-release__track">
                  <div className="skeleton skeleton-release__thumb" />
                  <div className="skeleton skeleton-release__title" />
                </div>
              </div>
            ))}
          </div>
          <div className="trends-view__style-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton-style">
                <div className="skeleton skeleton-style__cover" />
                <div className="skeleton skeleton-style__title" />
                <div className="skeleton skeleton-style__artist" />
              </div>
            ))}
          </div>
        </>
      )}
      {error && <div className="trends-view__status trends-view__status--error">{error}</div>}

      {topTab === 'foryou' && (
        <>
          <div className="trends-view__quick-row">
            <button
              className="trends-view__quick-card trends-view__quick-card--liked"
              onClick={() => liked.length > 0 && playQueue(liked, 0)}
            >
              <span className="trends-view__quick-icon">
                <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 15.5S2 11.2 2 6.8C2 4.4 3.9 2.8 6 2.8c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.1 0 4 1.6 4 4 0 4.4-7 8.7-7 8.7Z"
                    fill="#fff"
                  />
                </svg>
              </span>
              <span className="trends-view__quick-meta">
                <span className="trends-view__quick-title">{t('trends.liked')}</span>
                <span className="trends-view__quick-sub">{t('trends.likedCount').replace('{n}', String(liked.length))}</span>
              </span>
            </button>

            <button
              className="trends-view__quick-card trends-view__quick-card--history"
              onClick={() => history.length > 0 && playQueue(history, 0)}
            >
              <span className="trends-view__quick-icon trends-view__quick-icon--muted">
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M9 5v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
              <span className="trends-view__quick-meta">
                <span className="trends-view__quick-title">{t('trends.history')}</span>
                <span className="trends-view__quick-sub">
                  {history.length > 0
                    ? Array.from(new Set(history.map((t) => t.artists[0]))).slice(0, 3).join(', ')
                    : t('trends.historyEmpty')}
                </span>
              </span>
            </button>
          </div>

          {recommended.length > 0 && (
            <section className="trends-view__section">
              <h2 className="trends-view__section-title">Рекомендовано для вас</h2>
              <div className="trends-view__style-grid">
                {recommended.slice(0, 10).map((t) => (
                  <button key={t.id} className="trends-view__style-card" onClick={() => play(t)}>
                    <span className="trends-view__style-cover">
                      {t.cover ? <img src={t.cover} alt="" /> : null}
                    </span>
                    <span className="trends-view__style-title">{t.title}</span>
                    <span className="trends-view__style-artist">{t.artists.join(', ')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {recommended.length === 0 && liked.length === 0 && (
            <section className="trends-view__section">
              <h2 className="trends-view__section-title">Попробуйте нажать сердечко</h2>
              <p className="trends-view__hint">
                Добавляйте треки в любимые, чтобы мы могли подбирать рекомендации на основе вашего вкуса
              </p>
            </section>
          )}

          <section className="trends-view__section">
            <h2 className="trends-view__section-title">Настроение и активность</h2>
            <div className="trends-view__pills">
              {(['mood', 'activity', 'genre'] as MoodFilter[]).map((id) => (
                <button
                  key={id}
                  className={`trends-view__pill${moodFilter === id ? ' trends-view__pill--active' : ''}`}
                  onClick={() => setMoodFilter(id)}
                >
                  {id === 'mood' ? 'Настроение' : id === 'activity' ? 'Активность' : 'Жанр'}
                </button>
              ))}
            </div>
            <div className="trends-view__ai-cards">
              {moodCards[moodFilter].map((card) => (
                <button key={card.label} className="trends-view__ai-card" onClick={() => playMood(card.query)}>
                  <span className="trends-view__ai-kicker">{card.kicker}</span>
                  <span className="trends-view__ai-label">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 2l6 4-6 4Z" fill="currentColor" />
                    </svg>
                    {card.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="trends-view__section">
            <h2 className="trends-view__section-title">{t('trends.style')}</h2>
            <div className="trends-view__chips">
              {STYLE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  className={`trends-view__chip${styleChip === chip.label ? ' trends-view__chip--active' : ''}`}
                  onClick={() => setStyleChip(chip.label)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="trends-view__style-grid">
              {styleTracks.map((t) => (
                <button key={t.id} className="trends-view__style-card" onClick={() => play(t)}>
                  <span className="trends-view__style-cover">
                    {t.cover ? <img src={t.cover} alt="" /> : null}
                  </span>
                  <span className="trends-view__style-title">{t.title}</span>
                  <span className="trends-view__style-artist">{t.artists.join(', ')}</span>
                </button>
              ))}
            </div>
          </section>

          {metArtists.length > 0 && (
            <section className="trends-view__section">
              <h2 className="trends-view__section-title">{t('trends.metInWave')}</h2>
              <div className="trends-view__artist-row">
                {metArtists.map((a) => (
                  <button key={a.name} className="trends-view__artist" onClick={() => requestArtistSearch(a.name)}>
                    <span className="trends-view__artist-avatar">
                      {a.cover ? (
                        <img src={a.cover} alt="" />
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      )}
                    </span>
                    <span className="trends-view__artist-name">{a.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {topTab === 'trends' && monthlyTrends.length > 0 && (
        <section className="trends-view__section">
          <h2 className="trends-view__section-title">Чарт за месяц</h2>
          <div className="trends-view__release-row">
            {monthlyTrends.slice(0, 6).map((t) => (
              <div key={t.id} className="trends-view__release-card">
                <span className="trends-view__release-avatar">
                  {t.cover ? <img src={t.cover} alt="" /> : null}
                </span>
                <button
                  className="trends-view__release-name trends-view__release-name--link"
                  onClick={() => requestArtistSearch(t.artists[0])}
                >
                  {t.artists[0]}
                </button>
                <button className="trends-view__release-track" onClick={() => play(t)}>
                  <span className="trends-view__release-cover">
                    {t.cover && <img src={t.cover} alt="" />}
                  </span>
                  <span className="trends-view__release-meta">
                    <span className="trends-view__release-title">{t.title}</span>
                  </span>
                  <span className="trends-view__release-play">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 2.5l7 4.5-7 4.5Z" fill="#000" />
                    </svg>
                  </span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {topTab === 'trends' && monthlyTrends.length > 8 && (
        <section className="trends-view__section">
          <h2 className="trends-view__section-title">Премьера</h2>
          <div className="trends-view__premiere-grid">
            {monthlyTrends.slice(6, 14).map((t, i) => (
              <TrackRow key={t.id} track={t} queue={monthlyTrends.slice(6, 14)} index={i} onArtistClick={requestArtistSearch} />
            ))}
          </div>
        </section>
      )}

      {topTab === 'trends' && (
        <section className="trends-view__section">
          <h2 className="trends-view__section-title">{t('trends.explore')}</h2>
          <div className="trends-view__explore-row">
            {EXPLORE_GENRES.map((g) => (
              <button
                key={g.label}
                className="trends-view__explore-card"
                style={{ background: g.gradient }}
                onClick={() => playMood(g.query)}
              >
                <span className="trends-view__explore-label">{g.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default TrendsView