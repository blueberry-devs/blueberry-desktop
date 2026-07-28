export type GenreKey =
  | 'main'
  | 'algorithmic'
  | 'rock'
  | 'metal'
  | 'pop'
  | 'sadness'
  | 'love'
  | 'energy'
  | 'hiphop'
  | 'electronic'
  | 'jazz'
  | 'classical'
  | 'reggae'
  | 'folk'
  | 'punk'
  | 'soul'
  | 'blues'
  | 'latin'
  | 'kpop'
  | 'ambient'
  | 'trance'
  | 'house'
  | 'disco'
  | 'synthpop'
  | 'country'
  | 'indie'
  | 'rnb'

export function pickCategoryForQuery(query: string | null): GenreKey {
  if (!query) return 'main'
  const map: Record<string, GenreKey> = {
    'rock music': 'rock',
    'pop music': 'pop',
    'jazz music': 'jazz',
    'electronic music': 'electronic',
    'hip hop music': 'hiphop',
    'metal music': 'metal',
    'indie music': 'indie',
    'classical music': 'classical',
    'r&b music': 'rnb',
    'reggae music': 'reggae',
    'country music': 'country',
    'folk music': 'folk',
    'punk rock music': 'punk',
    'soul music': 'soul',
    'blues music': 'blues',
    'latin music': 'latin',
    'k-pop music': 'kpop',
    'ambient music': 'ambient',
    'trance music': 'trance',
    'house music': 'house',
    'disco music': 'disco',
    'synth pop music': 'synthpop',
  }
  return map[query.toLowerCase()] ?? 'main'
}

/** How many phrase keys exist per category (must match counts in locale files). */
export const PHRASE_COUNTS: Record<GenreKey, number> = {
  main: 12,
  algorithmic: 12,
  rock: 12,
  metal: 12,
  pop: 12,
  sadness: 12,
  love: 12,
  energy: 12,
  hiphop: 12,
  electronic: 12,
  jazz: 12,
  classical: 12,
  reggae: 12,
  folk: 12,
  punk: 12,
  soul: 12,
  blues: 12,
  latin: 12,
  kpop: 12,
  ambient: 12,
  trance: 12,
  house: 12,
  disco: 12,
  synthpop: 12,
  country: 12,
  indie: 12,
  rnb: 12,
}

export function phraseKey(category: GenreKey, index: number): string {
  return `wavePhrase.${category}.${index}`
}

export function randomPhraseKey(category: GenreKey): string {
  const count = PHRASE_COUNTS[category]
  if (!count || count === 0) return phraseKey('main', 0)
  const idx = Math.floor(Math.random() * count)
  return phraseKey(category, idx)
}
