const STORAGE_KEY = 'ym-clone:playlists-synced'

let cache: boolean = load()
const listeners = new Set<() => void>()

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function persist(): void {
  try {
    if (cache) {
      localStorage.setItem(STORAGE_KEY, 'true')
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

function emit(): void {
  persist()
  listeners.forEach((l) => l())
}

export function isSynced(): boolean {
  return cache
}

export function markSynced(): void {
  if (!cache) {
    cache = true
    emit()
  }
}

export function markUnsynced(): void {
  if (cache) {
    cache = false
    emit()
  }
}
