import { useSyncExternalStore } from 'react'
import { TrackResult } from '../api/yandexMusic'

const STORAGE_KEY = 'ym-clone:play-history'
const MAX_ENTRIES = 30

let cache: TrackResult[] = load()
const listeners = new Set<() => void>()

function load(): TrackResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TrackResult[]) : []
  } catch {
    return []
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* storage full / unavailable — keep in-memory only */
  }
}

function emit(): void {
  persist()
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getHistory(): TrackResult[] {
  return cache
}

export function pushHistory(track: TrackResult): void {
  cache = [track, ...cache.filter((t) => t.id !== track.id)].slice(0, MAX_ENTRIES)
  emit()
}

export function clearHistory(): void {
  cache = []
  emit()
}

export function useHistory(): TrackResult[] {
  return useSyncExternalStore(subscribe, getHistory)
}
