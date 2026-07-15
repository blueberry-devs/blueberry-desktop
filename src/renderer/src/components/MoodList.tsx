import { useEffect, useRef } from 'react'
import AnimatedList, { AnimatedListItem } from './AnimatedList'
import { usePlayer } from '../player/PlayerContext'
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

function GenreIcon({ color, shape }: { color: MoodColor; shape: GenreItem['shape'] }): JSX.Element {
  return (
    <span className={`mood-icon mood-icon--${color}`}>
      <svg width="42" height="42" viewBox="0 0 46 46">
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

function MoodList(): JSX.Element {
  const { setActiveGenre } = usePlayer()
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const items: AnimatedListItem[] = genres.map((genre, index) => ({
    key: genre.label,
    content: (
      <div className="mood-list__row" data-wave-index={index}>
        <GenreIcon color={genre.color} shape={genre.shape} />
        <span className="mood-list__label">{genre.label}</span>
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
    const genre = genres[index]
    setActiveGenre(genre.query)
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
