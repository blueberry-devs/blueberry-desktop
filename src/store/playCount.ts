import { useSyncExternalStore } from 'react'
import { TrackResult } from '../api/yandexMusic'

const STORAGE_KEY = 'ym-clone:play-count'
const MAX_TOP = 50

let counts: Record<string, number> = load()
const listeners = new Set<() => void>()

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  } catch {
    /* storage full */
  }
}

function emit(): void {
  persist()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getCounts(): Record<string, number> {
  return counts
}

export function recordPlay(trackId: string): void {
  counts = { ...counts, [trackId]: (counts[trackId] ?? 0) + 1 }
  emit()
}

export function getPlayCount(trackId: string): number {
  return counts[trackId] ?? 0
}

export function getTopPlayedIds(limit = MAX_TOP): string[] {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id)
}

export function sortByPlays(tracks: TrackResult[]): TrackResult[] {
  return [...tracks].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
}

export function usePlayCount(trackId: string): number {
  const all = useSyncExternalStore(subscribe, getCounts)
  return all[trackId] ?? 0
}
