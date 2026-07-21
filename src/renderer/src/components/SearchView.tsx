import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../utils/useTranslation'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { searchTracksYandex, searchTracksSoundcloud, searchTracksYoutube, searchPlaylists, TrackResult, PlaylistResult } from '../api/yandexMusic'
import { usePlayer } from '../player/PlayerContext'
import { useHistory } from '../store/history'
import { useArtistCovers } from '../hooks/useArtistCovers'
import { consumePendingSearch } from '../store/searchQuery'
import { toggleFavoritePlaylist, useIsFavoritePlaylist } from '../store/favoritePlaylists'
import { sortByPlays } from '../store/playCount'
import TrackRow from './TrackRow'
import ArtistView from './ArtistView'
import ServiceBadge from './ServiceBadge'
import './SearchView.css'

let debounceTimer: ReturnType<typeof setTimeout>

type ResultsTab = 'top' | 'tracks' | 'artists' | 'playlists'
type CardIcon = 'sun' | 'smile' | 'dumbbell' | 'note' | 'clock' | 'sparkle' | 'moon' | 'guitar' | 'mic' | 'megaphone'

const DISABLED_PILLS = ['Альбомы', 'Моя волна', 'Подкасты', 'Аудиокниги', 'Клипы']

const COLLECTIONS: { label: string; query: string; gradient: string; icon: CardIcon }[] = [
  { label: 'Летняя', query: 'summer hits', gradient: 'linear-gradient(160deg,#ffb64d,#ff6b6b)', icon: 'sun' },
  { label: 'Настроения', query: 'feel good', gradient: 'linear-gradient(160deg,#ffdb4d,#ff8bc6)', icon: 'smile' },
  { label: 'Занятия', query: 'workout energy', gradient: 'linear-gradient(160deg,#4dd0ff,#3a5ba0)', icon: 'dumbbell' },
  { label: 'Жанры', query: 'рок', gradient: 'linear-gradient(160deg,#ff9a4d,#c04dff)', icon: 'note' },
  { label: 'Эпохи', query: '2000s hits', gradient: 'linear-gradient(160deg,#c08a4d,#3a2a1a)', icon: 'clock' }
]

const SKIP_CARDS: { label: string; query: string; gradient: string; icon: CardIcon }[] = [
  { label: 'Новинки недели', query: 'new releases', gradient: 'linear-gradient(160deg,#ff8a4d,#c04d4d)', icon: 'sparkle' },
  { label: 'Вечерний плейлист', query: 'chill evening', gradient: 'linear-gradient(160deg,#8a5cf6,#2a1a4d)', icon: 'moon' },
  { label: 'Инди-сборник', query: 'indie mix', gradient: 'linear-gradient(160deg,#4d8aff,#1a2a4d)', icon: 'guitar' },
  { label: 'Рэп сегодня', query: 'rap hits', gradient: 'linear-gradient(160deg,#3aff8a,#1a4d2a)', icon: 'mic' },
  { label: 'Громкие премьеры', query: 'top charts', gradient: 'linear-gradient(160deg,#ff4d8a,#4d1a2a)', icon: 'megaphone' }
]

function CardBadge({ icon }: { icon: CardIcon }): JSX.Element {
  const paths: Record<CardIcon, JSX.Element> = {
    sun: (
      <>
        <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 1.5v2M9 14.5v2M16.5 9h-2M3.5 9h-2M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4M14.3 14.3l-1.4-1.4M5.1 5.1 3.7 3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
    smile: (
      <>
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="6.3" cy="7.3" r="0.9" fill="currentColor" />
        <circle cx="11.7" cy="7.3" r="0.9" fill="currentColor" />
        <path d="M5.5 11c1 1.3 2.3 2 3.5 2s2.5-.7 3.5-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
    dumbbell: <path d="M2 9h14M2 6.5v5M5 5v8M13 5v8M16 6.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
    note: (
      <>
        <circle cx="5" cy="14" r="2.3" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="12.5" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7.3 14V4l7.5-1.5v9.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </>
    ),
    clock: (
      <>
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 5v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
    sparkle: <path d="M9 1l1.6 6.4L17 9l-6.4 1.6L9 17l-1.6-6.4L1 9l6.4-1.6Z" fill="currentColor" />,
    moon: <path d="M14.5 10.8A6.5 6.5 0 0 1 7.2 3.5a6.5 6.5 0 1 0 7.3 7.3Z" fill="currentColor" />,
    guitar: (
      <>
        <circle cx="6" cy="12.5" r="4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8.5 10 15 2.5M15 2.5l-2 .3M15 2.5l-.4 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    mic: (
      <>
        <rect x="6.5" y="1.5" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3.5 8.5a5.5 5.5 0 0 0 11 0M9 14v2.5M6.5 16.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
    megaphone: (
      <path d="M2 7v4h2.5L11 15V3L4.5 7H2Zm11-1.5c1.3.8 1.3 4.2 0 5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" fill="none" />
    )
  }
  return (
    <span className="search-view__collection-badge">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        {paths[icon]}
      </svg>
    </span>
  )
}

interface ArtistGroup {
  name: string
  cover: string | null
  trackCount: number
}

function PlaylistCard({ playlist }: { playlist: PlaylistResult }): JSX.Element {
  const { t } = useTranslation()
  const isFavorite = useIsFavoritePlaylist(playlist.id)
  const { t } = useTranslation()
  return (
    <div className="search-view__playlist-card">
      <div className="search-view__playlist-cover" style={playlist.cover ? { backgroundImage: `url(${playlist.cover})` } : undefined}>
        {!playlist.cover && (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 3 14 9 20 7 16 12 21 14 14 15.5 16 21 10.5 17 6 21 7.5 14.5 2 13 7.5 10 6 4 Z" fill="#ffdb4d" />
          </svg>
        )}
      </div>
      <div className="search-view__playlist-info">
        <div className="search-view__playlist-name">{playlist.title}</div>
        <div className="search-view__playlist-meta">
          <ServiceBadge source={playlist.source} size={12} />
          <span>{playlist.owner} · {playlist.trackCount} {t('search.tracks').toLowerCase()}</span>
        </div>
      </div>
      <button
        className={`search-view__playlist-fav${isFavorite ? ' search-view__playlist-fav--active' : ''}`}
        onClick={(e) => { e.stopPropagation(); toggleFavoritePlaylist(playlist) }}
        title={isFavorite ? t('playlist.unfavorite') : t('playlist.addTo')}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 15.5S2 11.2 2 6.8C2 4.4 3.9 2.8 6 2.8c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.1 0 4 1.6 4 4 0 4.4-7 8.7-7 8.7Z"
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      </button>
    </div>
  )
}

const PAGE_SIZE = 15

function SearchView(): JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TrackResult[]>([])
  const [playlistResults, setPlaylistResults] = useState<PlaylistResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emptyTab, setEmptyTab] = useState<'popular' | 'history'>('popular')
  const [resultsTab, setResultsTab] = useState<ResultsTab>('top')
  const [viewingArtist, setViewingArtist] = useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { playQueue } = usePlayer()
  const history = useHistory()
  const { t } = useTranslation()

  useEffect(() => {
    const pending = consumePendingSearch()
    if (pending) setViewingArtist(pending)
  }, [])

  useEffect(() => {
    clearTimeout(debounceTimer)
    if (!query.trim()) {
      setResults([])
      setPlaylistResults([])
      setError(null)
      return
    }
    debounceTimer = setTimeout(() => {
      setLoading(true)
      setError(null)
      setResultsTab('top')
      setDisplayLimit(PAGE_SIZE)

      const seen = new Set<string>()

      const mergeBatch = (batch: TrackResult[]) => {
        setResults(prev => {
          const next = [...prev]
          for (const t of batch) {
            const sig = `${t.artists[0] ?? ''}::${t.title}`.toLowerCase()
            if (seen.has(sig)) continue
            seen.add(sig)
            next.push(t)
          }
          return next
        })
      }

      searchPlaylists(query)
        .then(pl => setPlaylistResults(pl))
        .catch(() => {})

      let settled = 0
      const sourceDone = () => {
        settled++
        if (settled >= 2) setLoading(false)
      }

      searchTracksYandex(query)
        .then(mergeBatch)
        .catch(() => {})
        .finally(sourceDone)

      searchTracksSoundcloud(query)
        .then(mergeBatch)
        .catch(() => {})
        .finally(sourceDone)

      searchTracksYoutube(query)
        .then(mergeBatch)
        .catch(() => {})
        .finally(sourceDone)
    }, 600)
    return () => clearTimeout(debounceTimer)
  }, [query])

  const topResults = useMemo(() => sortByPlays(results), [results])

  const artistGroups = useMemo(() => {
    const map = new Map<string, ArtistGroup>()
    for (const t of results) {
      const name = t.artists[0]
      if (!name) continue
      const existing = map.get(name)
      if (existing) existing.trackCount += 1
      else map.set(name, { name, cover: t.artistCover ?? null, trackCount: 1 })
    }
    return Array.from(map.values())
  }, [results])

  const resolvedArtistCovers = useArtistCovers(
    artistGroups.filter((a) => !a.cover).map((a) => ({ name: a.name, trackTitle: '' }))
  )
  const artists = artistGroups.map((a) => ({ ...a, cover: a.cover ?? resolvedArtistCovers.get(a.name) ?? null }))

  const topArtist = artists[0]
  const topTrack = topResults[0]
  const restTracks = topResults.slice(1)

  const totalVisible = resultsTab === 'playlists' ? playlistResults.length : topResults.length
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || loading || displayLimit >= totalVisible) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setDisplayLimit((p) => p + PAGE_SIZE)
      },
      { rootMargin: '400px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, displayLimit, totalVisible])

  const searchFor = (q: string): void => setQuery(q)

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; track: TrackResult } | null>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const close = (): void => setCtxMenu(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [ctxMenu])

  const handleCtxMenu = useCallback((e: React.MouseEvent, track: TrackResult): void => {
    e.preventDefault()
    e.stopPropagation()
    const menuWidth = 200
    const menuHeight = 220
    const pad = 8
    let x = e.clientX
    let y = e.clientY
    if (x + menuWidth + pad > window.innerWidth) x = window.innerWidth - menuWidth - pad
    if (y + menuHeight + pad > window.innerHeight) y = window.innerHeight - menuHeight - pad
    setCtxMenu({ x, y, track })
  }, [])

  if (viewingArtist) {
    return <ArtistView name={viewingArtist} onBack={() => setViewingArtist(null)} />
  }

  return (
    <>
    <div className="search-view view-enter">
      <div className="search-view__input-wrap">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="search-view__icon">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
          <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <input
          className="search-view__input"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button className="search-view__clear" onClick={() => setQuery('')} aria-label="Очистить">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {!query && (
        <>
          <div className="search-view__toptabs">
            <button
              className={`search-view__toptab${emptyTab === 'popular' ? ' search-view__toptab--active' : ''}`}
              onClick={() => setEmptyTab('popular')}
            >
              {t('search.top')}
            </button>
            <button
              className={`search-view__toptab${emptyTab === 'history' ? ' search-view__toptab--active' : ''}`}
              onClick={() => setEmptyTab('history')}
            >
              {t('trends.history')}
            </button>
          </div>

          {emptyTab === 'popular' && (
            <>
              <section className="search-view__section">
                <h2 className="search-view__section-title">Подборки музыки</h2>
                <div className="search-view__scroller">
                  {COLLECTIONS.map((c) => (
                    <button
                      key={c.label}
                      className="search-view__collection-card"
                      style={{ background: c.gradient }}
                      onClick={() => searchFor(c.query)}
                    >
                      <CardBadge icon={c.icon} />
                      <span className="search-view__collection-label">{c.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="search-view__section">
                <h2 className="search-view__section-title">Вы могли пропустить</h2>
                <div className="search-view__scroller">
                  {SKIP_CARDS.map((c) => (
                    <button
                      key={c.label}
                      className="search-view__collection-card"
                      style={{ background: c.gradient }}
                      onClick={() => searchFor(c.query)}
                    >
                      <CardBadge icon={c.icon} />
                      <span className="search-view__collection-label">{c.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {emptyTab === 'history' && (
            <div className="search-view__results">
              {history.length === 0 ? (
                <div className="search-view__status">{t('trends.historyEmpty')}</div>
              ) : (
                history.map((t, i) => <TrackRow key={t.id} track={t} queue={history} index={i} onArtistClick={setViewingArtist} />)
              )}
            </div>
          )}
        </>
      )}

      {query && (
        <>
          <div className="search-view__pills">
            <button
              className={`search-view__pill${resultsTab === 'top' ? ' search-view__pill--active' : ''}`}
              onClick={() => setResultsTab('top')}
            >
              {t('search.top')}
            </button>
            <button
              className={`search-view__pill${resultsTab === 'tracks' ? ' search-view__pill--active' : ''}`}
              onClick={() => setResultsTab('tracks')}
            >
              {t('search.tracks')}
            </button>
            <button
              className={`search-view__pill${resultsTab === 'artists' ? ' search-view__pill--active' : ''}`}
              onClick={() => setResultsTab('artists')}
            >
              {t('search.artists')}
            </button>
            <button
              className={`search-view__pill${resultsTab === 'playlists' ? ' search-view__pill--active' : ''}`}
              onClick={() => setResultsTab('playlists')}
            >
              {t('search.playlists')}
            </button>
            {DISABLED_PILLS.map((label) => (
              <button key={label} className="search-view__pill search-view__pill--disabled" disabled>
                {label}
              </button>
            ))}
          </div>



          {loading && (
            <>
              <div className="search-view__hero-row">
                <div className="skeleton-hero">
                  <div className="skeleton skeleton-hero__cover" />
                  <div className="skeleton-hero__lines">
                    <div className="skeleton skeleton-hero__line" />
                    <div className="skeleton skeleton-hero__line skeleton-hero__line--sub" />
                  </div>
                </div>
                <div className="skeleton-hero">
                  <div className="skeleton skeleton-hero__cover skeleton-hero__cover--round" />
                  <div className="skeleton-hero__lines">
                    <div className="skeleton skeleton-hero__line" />
                    <div className="skeleton skeleton-hero__line skeleton-hero__line--sub" />
                  </div>
                </div>
              </div>
              <div className="search-view__results">
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
            </>
          )}
          {error && <div className="search-view__status search-view__status--error">{error}</div>}
          {!loading && !error && resultsTab !== 'playlists' && results.length === 0 && (
            <div className="search-view__status">{t('search.noResults')}</div>
          )}
          {!loading && !error && resultsTab === 'playlists' && playlistResults.length === 0 && (
            <div className="search-view__status">{t('search.noResults')}</div>
          )}

          {!loading && resultsTab === 'playlists' && playlistResults.length > 0 && (
            <div className="search-view__playlists">
              {playlistResults.slice(0, displayLimit).map((pl) => (
                <PlaylistCard key={pl.id} playlist={pl} />
              ))}
              {playlistResults.length > displayLimit && <div ref={sentinelRef} style={{ height: 1 }} />}
            </div>
          )}

          {!loading && topResults.length > 0 && resultsTab === 'top' && (
            <>
              <div className="search-view__hero-row">
                {topTrack && (
                  <button
                    className="search-view__hero-track"
                    onClick={() => playQueue(topResults, 0)}
                    onContextMenu={(e) => handleCtxMenu(e, topTrack)}
                  >
                    <span className="search-view__hero-cover">
                      {topTrack.cover ? <img src={topTrack.cover} alt="" /> : null}
                    </span>
                    <span className="search-view__hero-meta">
                      <span className="search-view__hero-title">{topTrack.title}</span>
                      <span className="search-view__hero-sub">{topTrack.artists.join(', ')}</span>
                    </span>
                  </button>
                )}
                {topArtist && (
                  <button className="search-view__hero-artist" onClick={() => setViewingArtist(topArtist.name)}>
                    <span className="search-view__hero-artist-avatar">
                      {topArtist.cover ? (
                        <img src={topArtist.cover} alt="" />
                      ) : (
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      )}
                    </span>
                    <span className="search-view__hero-meta">
                      <span className="search-view__hero-title">{topArtist.name}</span>
                      <span className="search-view__hero-sub">
                        {topArtist.trackCount} {t('search.tracks').toLowerCase()}
                      </span>
                    </span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="search-view__hero-chevron">
                      <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="search-view__results">
                {restTracks.slice(0, displayLimit - 1).map((t, i) => (
                  <TrackRow key={t.id} track={t} queue={topResults} index={i + 1} onArtistClick={setViewingArtist} />
                ))}
              </div>

              {artists.length > 1 && (
                <section className="search-view__section">
                  <h2 className="search-view__section-title">{t('search.artists')}</h2>
                  <div className="search-view__artist-row">
                    {artists.map((a) => (
                      <button key={a.name} className="search-view__artist" onClick={() => setViewingArtist(a.name)}>
                        <span className="search-view__artist-avatar">
                          {a.cover ? (
                            <img src={a.cover} alt="" />
                          ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
                              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.4" />
                            </svg>
                          )}
                        </span>
                        <span className="search-view__artist-name">{a.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {topResults.length > displayLimit && <div ref={sentinelRef} style={{ height: 1 }} />}
            </>
          )}

          {!loading && results.length > 0 && resultsTab === 'tracks' && (
            <div className="search-view__results">
              {results.slice(0, displayLimit).map((t, i) => (
                <TrackRow key={t.id} track={t} queue={results} index={i} onArtistClick={setViewingArtist} />
              ))}
              {results.length > displayLimit && <div ref={sentinelRef} style={{ height: 1 }} />}
            </div>
          )}

          {!loading && results.length > 0 && resultsTab === 'artists' && (
            <div className="search-view__artist-grid">
              {artists.map((a) => (
                <button key={a.name} className="search-view__artist search-view__artist--grid" onClick={() => setViewingArtist(a.name)}>
                  <span className="search-view__artist-avatar search-view__artist-avatar--large">
                    {a.cover ? (
                      <img src={a.cover} alt="" />
                    ) : (
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.4" />
                      </svg>
                    )}
                  </span>
                  <span className="search-view__artist-name">{a.name}</span>
                  <span className="search-view__artist-count">
                    {a.trackCount} {t('search.tracks').toLowerCase()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>

    {ctxMenu && createPortal(
      <motion.div
        className="track-row__ctx"
        style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="track-row__ctx-item" onClick={() => {
          const t = ctxMenu.track
          if (results.length > 0) {
            const idx = results.indexOf(t)
            if (idx >= 0) playQueue(results, idx)
          }
          setCtxMenu(null)
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 12V4l8 4-8 4Z" fill="currentColor" />
            <rect x="12" y="3" width="2" height="10" fill="currentColor" />
          </svg>
          Воспроизвести
        </button>
        <div className="track-row__ctx-sep" />
        <button className="track-row__ctx-item" onClick={() => {
          const t = ctxMenu.track
          navigator.clipboard.writeText(`${t.artists.join(', ')} — ${t.title}`).catch(() => {})
          setCtxMenu(null)
        }}>
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

export default SearchView
