import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'ym-clone:sidebar-collapsed'

let cache: boolean = load()
const listeners = new Set<() => void>()

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, cache ? '1' : '0')
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

export function getSidebarCollapsed(): boolean {
  return cache
}

export function toggleSidebarCollapsed(): void {
  cache = !cache
  emit()
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSidebarCollapsed)
}
