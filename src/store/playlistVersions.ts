const STORAGE_KEY = 'ym-clone:playlist-versions'

let cache: Record<string, number> = load()
const listeners = new Set<() => void>()

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

function emit(): void {
  persist()
  listeners.forEach((l) => l())
}

/** Get the last known version for a cloud playlist (0 if unknown). */
export function getPlaylistVersion(cloudId: string): number {
  return cache[cloudId] ?? 0
}

/** Store version after a successful sync. */
export function setPlaylistVersion(cloudId: string, version: number): void {
  cache = { ...cache, [cloudId]: version }
  emit()
}

/** Clear all stored versions (e.g. on logout). */
export function clearPlaylistVersions(): void {
  cache = {}
  emit()
}
