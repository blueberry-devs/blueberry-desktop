const STORAGE_KEY = 'ym-clone:genre-stats'
const MAX_GENRES = 30

interface GenreStats {
  plays: Record<string, number>
}

function load(): GenreStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as GenreStats
  } catch { /* ignore */ }
  return { plays: {} }
}

function save(data: GenreStats): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function recordGenrePlay(genreQuery: string): void {
  const data = load()
  const key = genreQuery.toLowerCase()
  data.plays[key] = (data.plays[key] ?? 0) + 1
  // Keep only the top N genres
  const sorted = Object.entries(data.plays).sort((a, b) => b[1] - a[1])
  const trimmed: Record<string, number> = {}
  for (const [k, v] of sorted.slice(0, MAX_GENRES)) {
    trimmed[k] = v
  }
  data.plays = trimmed
  save(data)
}

export function getTopGenres(limit = 8): { query: string; plays: number }[] {
  const data = load()
  return Object.entries(data.plays)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, plays]) => ({ query, plays }))
}

export function getGenrePlays(query: string): number {
  return load().plays[query.toLowerCase()] ?? 0
}

export function clearGenreStats(): void {
  localStorage.removeItem(STORAGE_KEY)
}
