import { useEffect, useMemo, useRef } from 'react'
import AnimatedList, { AnimatedListItem } from './AnimatedList'
import { usePlayer } from '../player/PlayerContext'
import { useLikedTracks } from '../store/likes'
import { useHistory } from '../store/history'
import { TrackResult } from '../api/yandexMusic'
import { useProfile } from '../store/profile'
import { useTranslation } from '../utils/useTranslation'
import { CATEGORIES, CategoryId, getMoodPhrases } from '../data/moodPhrases'
import log from 'electron-log/renderer'
import './MoodList.css'

const GENRE_KEYWORDS: Record<CategoryId, string[]> = {
  pop: ['pop', 'поп', 'britney', 'taylor', 'swift', 'bieber', 'gaga', 'katy', 'perry', 'rihanna', 'bruno', 'mars', 'ariana', 'grande', 'billie', 'eilish', 'dua', 'lipa', 'weeknd', 'pink', 'shakira', 'мадонна', 'малина'],
  rock: ['rock', 'рок', 'nirvana', 'pearl jam', 'foo fighters', 'guns n roses', 'ac/dc', 'led zeppelin', 'pink floyd', 'queen', 'rolling stones', 'green day', 'linkin park', 'imagine dragons', 'radiohead', 'кактус'],
  metal: ['metal', 'метал', 'металлика', 'metallica', 'slipknot', 'iron maiden', 'megadeth', 'pantera', 'system of a down', 'rammstein', 'disturbed', 'korn', 'avenged sevenfold', 'judas priest', 'black sabbath', 'motorhead', 'слот'],
  hiphop: ['hip hop', 'hip-hop', 'хип хоп', 'хип-хоп', 'eminem', 'kanye', 'kendrick', 'lamar', 'drake', 'j. cole', 'travis scott', 'lil', 'cardi b', 'nicki minaj', 'baby', 'future', '21 savage', 'баста', 'тимати', 'oxy'],
  edm: ['edm', 'электро', 'электроника', 'david guetta', 'avicii', 'martin garrix', 'kygo', 'calvin harris', 'swedish house', 'tiesto', 'dj', 'skrillex', 'deadmau5', 'hardwell', 'alok', 'zhu'],
  chill: ['chill', 'чилл', 'lo-fi', 'lofi', 'low fi', 'ambient', 'эмбиент', 'relax', 'релакс', 'chillstep', 'sleep', 'meditation', 'медитация', 'cafe', 'coffee', 'rain'],
  jazz: ['jazz', 'джаз', 'soul', 'соул', 'rnb', 'r&b', 'blues', 'блюз', 'funk', 'фанк', 'miles davis', 'louis armstrong', 'ella fitzgerald', 'john coltrane', 'thelonious', 'macy gray'],
  classical: ['classical', 'классика', 'классическая', 'beethoven', 'bach', 'моцарт', 'mozart', 'chopin', 'шопен', 'vivaldi', 'чайковский', 'tchaikovsky', 'debussy', 'rachmaninoff', 'orchestra', 'симфония', 'symphony', 'piano', 'пианино'],
  indie: ['indie', 'инди', 'arcade fire', 'arctic monkeys', 'tame impala', 'mac demarco', 'vampire weekend', 'the strokes', 'modest mouse', 'pixies', 'sufjan stevens', 'bon iver', 'alt-j', 'glass animals', 'the neighbourhood'],
  folk: ['folk', 'фолк', 'акустика', 'acoustic', 'country', 'кантри', 'king of leon', 'mumford', 'sons', 'lumineers', 'hozier', 'ed sheeran', 'vance joy', 'iron & wine', 'james taylor', 'simon garfunkel'],
  workout: ['workout', 'тренировка', 'exercise', 'rocky', 'eye of tiger', 'survivor', 'eminem lose yourself', 'dmx', 'rage machine', 'hard rock', 'heavy', 'мощный'],
  mix: ['mix', 'микс', 'разное', 'random', 'chill', 'electronic', 'электро', 'альтернатива', 'modern', 'современный', 'новинка', 'popular', 'популярный'],
}

function detectGenres(liked: TrackResult[]): CategoryId[] {
  if (liked.length === 0) return []
  const scores = new Map<CategoryId, number>()
  for (const cat of CATEGORIES) scores.set(cat, 0)
  for (const track of liked) {
    const text = (track.title + ' ' + track.artists.join(' ')).toLowerCase()
    for (const cat of CATEGORIES) {
      for (const kw of GENRE_KEYWORDS[cat]) {
        if (text.includes(kw)) {
          scores.set(cat, (scores.get(cat) ?? 0) + 1)
          break
        }
      }
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, s]) => s > 0)
    .slice(0, 3)
    .map(([cat]) => cat)
}

const WHEEL_RADIUS = 480
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

function topArtists(liked: TrackResult[], history: TrackResult[], count: number): { artist: string; cover: string | null }[] {
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

function MoodList() {
  const { t } = useTranslation()
  const { language } = useProfile()
  const { setActiveGenre } = usePlayer()
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const liked = useLikedTracks()
  const history = useHistory()
  const phrases = getMoodPhrases(language)

  const personalItems = useMemo(() => {
    const artists = topArtists(liked, history, 4)
    if (artists.length === 0) return [] as { key: string; label: string; query: string; icon: string }[]
    const items: { key: string; label: string; query: string; icon: string }[] = []
    items.push({
      key: 'personal-fav',
      label: t('mood.inSpiritOf'),
      query: artists[0].artist,
      icon: artists[0].cover ?? '/moods/mood_01.png'
    })
    for (const { artist, cover } of artists.slice(1)) {
      items.push({
        key: `personal-${artist}`,
        label: t('mood.inSpiritOfArtist').replace('{artist}', artist),
        query: artist,
        icon: cover ?? '/moods/mood_01.png'
      })
    }
    return items
  }, [liked, history, t])

  const moodItems = useMemo(() => {
    const detected = detectGenres(liked)
    log.info(`[Mood] liked tracks: ${liked.length}, detected genres: ${detected.length > 0 ? detected.join(', ') : 'none (random fallback)'}`)
    const active = detected.length > 0 ? detected : CATEGORIES
    const pool: { key: string; label: string; query: string }[] = []
    for (const cat of active) {
      const catPhrases = phrases[cat]
      if (!catPhrases) continue
      catPhrases.forEach((phrase, i) => {
        pool.push({ key: `${cat}-${i}`, label: phrase, query: phrase })
      })
    }
    const shuffled = pool.sort(() => Math.random() - 0.5)
    const count = 5 + Math.floor(Math.random() * 6)
    const picked = shuffled.slice(0, count)
    // Shuffle all 48 icon indices, take one per item without replacement
    const icons = Array.from({ length: 48 }, (_, i) => i + 1).sort(() => Math.random() - 0.5)
    const result = picked.map((item, i) => ({
      ...item,
      icon: `/moods/mood_${String(icons[i]).padStart(2, '0')}.png`
    }))
    log.info(`[Mood] showing ${count} items from ${active.length} categories, unique icons`)
    return result
  }, [phrases, liked])

  const allItems = useMemo(() => [...personalItems, ...moodItems], [personalItems, moodItems])

  const items: AnimatedListItem[] = allItems.map((item, index) => ({
    key: item.key,
    content: (
      <div className="mood-list__row" data-wave-index={index}>
        <span className="mood-list__icon">
          <img src={item.icon} alt="" />
        </span>
        <span className="mood-list__label">{item.label}</span>
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
    const item = allItems[index]
    if (item) setActiveGenre(item.query)
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