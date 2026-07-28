const STORAGE_KEY = 'ym-clone:tracks-synced'

let synced: Record<string, boolean> = load()
const listeners = new Set<() => void>()

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(synced))
  } catch {
    /* storage full / unavailable — keep in-memory only */
  }
}

function emit(): void {
  persist()
  listeners.forEach((l) => l())
}

/** Whether a track has already been uploaded to the backend library. */
export function isTrackSynced(id: string): boolean {
  return synced[id] === true
}

/** Mark a single track as uploaded. */
export function markTrackSynced(id: string): void {
  if (synced[id]) return
  synced = { ...synced, [id]: true }
  emit()
}

/** Mark several tracks as uploaded in one persistence pass. */
export function markTracksSynced(ids: string[]): void {
  const next = { ...synced }
  let changed = false
  for (const id of ids) {
    if (!next[id]) {
      next[id] = true
      changed = true
    }
  }
  if (!changed) return
  synced = next
  emit()
}

/** Clear all upload marks (call on logout). */
export function clearTrackSync(): void {
  synced = {}
  emit()
}
