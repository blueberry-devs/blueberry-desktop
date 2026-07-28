import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { useTranslation } from '../utils/useTranslation'
import {
  GenreKey,
  pickCategoryForQuery,
  randomPhraseKey,
  PHRASE_COUNTS,
  phraseKey,
} from '../data/wavePhrases'
import { getTopGenres } from '../store/genreStats'

interface WavePhraseProps {
  className?: string
}

const allCategories: GenreKey[] = Object.keys(PHRASE_COUNTS) as GenreKey[]

function weightedCategory(topCategories: GenreKey[]): GenreKey {
  // 15% chance — random category for surprise
  if (Math.random() < 0.15 || topCategories.length === 0) {
    return allCategories[Math.floor(Math.random() * allCategories.length)]
  }

  // Weighted random from top categories: higher rank = higher weight
  const weights = topCategories.map((_, i) => topCategories.length - i)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < topCategories.length; i++) {
    r -= weights[i]
    if (r <= 0) return topCategories[i]
  }
  return topCategories[0]
}

export default function WavePhrase({ className }: WavePhraseProps): JSX.Element | null {
  const { t } = useTranslation()
  const { activeGenre, currentTrack, isPlaying } = usePlayer()
  const [key, setKey] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const currentCategory = pickCategoryForQuery(activeGenre)

  function pick(): void {
    const top = getTopGenres(12)
    // Map top played queries → genre keys
    const topKeys: GenreKey[] = []
    for (const g of top) {
      const k = pickCategoryForQuery(g.query)
      if (k !== 'main' && !topKeys.includes(k)) topKeys.push(k)
    }

    // Blend current genre + top genres: current gets extra weight
    let pool: GenreKey[]
    if (currentCategory !== 'main') {
      pool = [currentCategory, currentCategory, currentCategory, ...topKeys]
    } else {
      pool = topKeys
    }
    const cat = pool.length > 0
      ? weightedCategory(pool)
      : allCategories[Math.floor(Math.random() * allCategories.length)]

    setKey(randomPhraseKey(cat))
  }

  useEffect(() => {
    pick()
  }, [currentTrack?.id, activeGenre])

  useEffect(() => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (isPlaying) pick()
    }, 45000)
    return () => clearInterval(timerRef.current)
  }, [currentTrack?.id, activeGenre, isPlaying])

  if (!key) return null

  const text = t(key)
  if (text === key) return null

  return (
    <div className={`wave-phrase${className ? ' ' + className : ''}`} key={key}>
      <span className="wave-phrase__text">{text}</span>
    </div>
  )
}
