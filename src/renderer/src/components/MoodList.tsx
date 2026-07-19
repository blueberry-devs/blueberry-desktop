import { useEffect, useMemo, useRef } from 'react'
import AnimatedList, { AnimatedListItem } from './AnimatedList'
import { usePlayer } from '../player/PlayerContext'
import { useLikedTracks } from '../store/likes'
import { useHistory } from '../store/history'
import { TrackResult } from '../api/yandexMusic'
import { useTranslation } from '../utils/useTranslation'
import './MoodList.css'

type MoodColor = 'red' | 'blue' | 'purple'

interface GenreItem {
  label: string
  // What actually gets searched — SoundCloud/YouTube search is a plain
  // keyword match, not genre-aware, so searching the raw Cyrillic label
  // (e.g. "Рок") mostly matches tracks whose title/tags happen to contain
  // that substring, not tracks that are actually rock. English genre terms
  // (plus a "music"/"mix" qualifier) match real genre tags instead.
  query: string
  color: MoodColor
  shape: 'burst' | 'flag' | 'arrow' | 'chevron'
  // Set only for the personalized "В духе <artist>" entries — an actual
  // artist photo/cover pulled from a liked or recently played track, shown
  // instead of the generic shape icon.
  cover?: string | null
}

const genres: GenreItem[] = [
  { label: 'Рок', query: 'rock music', color: 'red', shape: 'burst' },
  { label: 'Поп', query: 'pop music', color: 'blue', shape: 'flag' },
  { label: 'Джаз', query: 'jazz music', color: 'purple', shape: 'burst' },
  { label: 'Электроника', query: 'electronic music', color: 'blue', shape: 'arrow' },
  { label: 'Хип-хоп', query: 'hip hop music', color: 'red', shape: 'burst' },
  { label: 'Метал', query: 'metal music', color: 'red', shape: 'burst' },
  { label: 'Инди', query: 'indie music', color: 'purple', shape: 'chevron' },
  { label: 'Классика', query: 'classical music', color: 'purple', shape: 'chevron' },
  { label: 'R&B', query: 'r&b music', color: 'blue', shape: 'flag' },
  { label: 'Регги', query: 'reggae music', color: 'blue', shape: 'burst' },
  { label: 'Кантри', query: 'country music', color: 'red', shape: 'arrow' },
  { label: 'Фолк', query: 'folk music', color: 'purple', shape: 'burst' },
  { label: 'Панк', query: 'punk rock music', color: 'red', shape: 'chevron' },
  { label: 'Соул', query: 'soul music', color: 'blue', shape: 'flag' },
  { label: 'Блюз', query: 'blues music', color: 'purple', shape: 'arrow' },
  { label: 'Латино', query: 'latin music', color: 'red', shape: 'burst' },
  { label: 'К-поп', query: 'k-pop music', color: 'blue', shape: 'flag' },
  { label: 'Эмбиент', query: 'ambient music', color: 'purple', shape: 'chevron' },
  { label: 'Транс', query: 'trance music', color: 'blue', shape: 'burst' },
  { label: 'Хаус', query: 'house music', color: 'red', shape: 'arrow' },
  { label: 'Диско', query: 'disco music', color: 'blue', shape: 'flag' },
  { label: 'Синти-поп', query: 'synth pop music', color: 'purple', shape: 'burst' }
]

const shapePaths: Record<GenreItem['shape'], string> = {
  burst:
    'M24 2 L28 16 L40 12 L30 22 L44 26 L28 28 L32 44 L22 32 L14 44 L14 30 L2 34 L12 22 L2 10 L18 14 Z',
  flag: 'M8 4 L36 4 L20 20 L36 22 L8 44 L14 26 L4 24 Z',
  arrow: 'M6 30 L24 4 L26 20 L44 14 L24 34 L22 20 Z',
  chevron: 'M4 24 L24 4 L44 24 L30 22 L24 44 L18 22 Z'
}

function GenreIcon({ color, shape, cover }: { color: MoodColor; shape: GenreItem['shape']; cover?: string | null }): JSX.Element {
  if (cover) {
    return (
      <span className="mood-icon mood-icon--cover">
        <img src={cover} alt="" />
      </span>
    )
  }
  return (
    <span className={`mood-icon mood-icon--${color}`}>
      <svg width="52" height="52" viewBox="0 0 46 46">
        <path d={shapePaths[shape]} fill="currentColor" />
      </svg>
    </span>
  )
}

// Wheel layout: rows sit on the rim of a large circle whose center is off
// to the right, so the list reads as the LEFT-facing arc of that wheel
// rather than a flat column. The row nearest the WINDOW's vertical center
// (not the list's own box) sits closest to the viewer (no recession); rows
// above and below curl away to the right and shrink/fade, same as a picker
// wheel viewed edge-on.
const WHEEL_RADIUS = 480
// Past this angle a row is basically edge-on to the wheel — clamp instead
// of letting cos() run past the point where the curve would double back.
// Caps recession at ~163px (must stay under MoodList.css's horizontal
// clipping buffer).
const MAX_ANGLE = 0.85

function applyWave(scrollEl: HTMLElement): void {
  const centerY = window.innerHeight / 2

  const rows = scrollEl.querySelectorAll<HTMLElement>('[data-wave-index]')
  rows.forEach((row) => {
    const rowRect = row.getBoundingClientRect()
    const rowCenter = rowRect.top + rowRect.height / 2
    const dist = rowCenter - centerY
    const angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, dist / WHEEL_RADIUS))
    const recede = WHEEL_RADIUS * (1 - Math.cos(angle))
    const scale = 0.82 + 0.18 * Math.cos(angle)
    const opacity = 0.55 + 0.45 * Math.cos(angle)
    row.style.transform = `translateX(${recede}px) scale(${scale})`
    row.style.opacity = String(opacity)
  })
}

// Top artists from what's actually been liked/played, most-listened first —
// likes count double since an explicit like is a stronger signal than one play.
// Carries along a cover image from whichever track it was first seen on, so
// the mood row can show the artist's actual art instead of a shape icon.
function topArtists(
  liked: TrackResult[],
  history: TrackResult[],
  count: number
): { artist: string; cover: string | null }[] {
  const freq = new Map<string, number>()
  const cover = new Map<string, string | null>()
  for (const t of [...liked, ...history]) {
    const a = t.artists[0]
    if (!a) continue
    if (!cover.has(a)) cover.set(a, t.artistCover ?? t.cover ?? null)
  }
  for (const t of liked) {
    const a = t.artists[0]
    if (a) freq.set(a, (freq.get(a) ?? 0) + 2)
  }
  for (const t of history) {
    const a = t.artists[0]
    if (a) freq.set(a, (freq.get(a) ?? 0) + 1)
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([artist]) => ({ artist, cover: cover.get(artist) ?? null }))
}

function MoodList(): JSX.Element {
  const { t } = useTranslation()
  const { setActiveGenre } = usePlayer()
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const liked = useLikedTracks()
  const history = useHistory()

  const genreLabel: Record<string, string> = {
    'Рок': t('mood.genre.рок'),
    'Поп': t('mood.genre.поп'),
    'Джаз': t('mood.genre.джаз'),
    'Электроника': t('mood.genre.электроника'),
    'Хип-хоп': t('mood.genre.хип-хоп'),
    'Метал': t('mood.genre.метал'),
    'Инди': t('mood.genre.инди'),
    'Классика': t('mood.genre.классика'),
    'R&B': t('mood.genre.рэб'),
    'Регги': t('mood.genre.регги'),
    'Кантри': t('mood.genre.кантри'),
    'Фолк': t('mood.genre.фолк'),
    'Панк': t('mood.genre.панк'),
    'Соул': t('mood.genre.соул'),
    'Блюз': t('mood.genre.блюз'),
    'Латино': t('mood.genre.латино'),
    'К-поп': t('mood.genre.к-поп'),
    'Эмбиент': t('mood.genre.эмбиент'),
    'Транс': t('mood.genre.транс'),
    'Хаус': t('mood.genre.хаус'),
    'Диско': t('mood.genre.диско'),
    'Синти-поп': t('mood.genre.синти-поп'),
  }

  const personalItems: GenreItem[] = useMemo(() => {
    const artists = topArtists(liked, history, 4)
    if (artists.length === 0) return []
    const shapes: GenreItem['shape'][] = ['burst', 'flag', 'arrow', 'chevron']
    const colors: MoodColor[] = ['red', 'blue', 'purple']
    const favorite: GenreItem = {
      label: t('mood.inSpiritOf'),
      query: artists[0].artist,
      color: colors[0],
      shape: shapes[0],
      cover: artists[0].cover
    }
    const rest: GenreItem[] = artists.slice(1).map(({ artist, cover: artistCover }, i) => ({
      label: t('mood.inSpiritOfArtist').replace('{artist}', artist),
      query: artist,
      color: colors[(i + 1) % colors.length],
      shape: shapes[(i + 1) % shapes.length],
      cover: artistCover
    }))
    return [favorite, ...rest]
  }, [liked, history, t])

  const allItems = useMemo(() => [...personalItems, ...genres], [personalItems])

  const items: AnimatedListItem[] = allItems.map((genre, index) => ({
    key: `${genre.label}-${index}`,
    content: (
      <div className="mood-list__row" data-wave-index={index}>
        <GenreIcon color={genre.color} shape={genre.shape} cover={genre.cover} />
        <span className="mood-list__label">{genreLabel[genre.label] ?? genre.label}</span>
      </div>
    )
  }))

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const maybeScrollEl = root.querySelector<HTMLElement>('.animated-list')
    if (!maybeScrollEl) return
    const scrollEl: HTMLElement = maybeScrollEl

    applyWave(scrollEl)

    function schedule(): void {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => applyWave(scrollEl))
    }

    scrollEl.addEventListener('scroll', schedule, { passive: true })
    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(scrollEl)
    window.addEventListener('resize', schedule)

    return () => {
      cancelAnimationFrame(rafRef.current)
      scrollEl.removeEventListener('scroll', schedule)
      resizeObserver.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [])

  const handleSelect = (_item: AnimatedListItem, index: number): void => {
    const genre = allItems[index]
    if (genre) setActiveGenre(genre.query)
  }

  return (
    <div className="mood-list" ref={containerRef}>
      <AnimatedList
        items={items}
        onItemSelect={handleSelect}
        showGradients={false}
        enableArrowNavigation
        displayScrollbar={false}
        itemClassName="mood-list__item"
      />
    </div>
  )
}

export default MoodList
