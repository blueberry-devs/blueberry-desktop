import { useSyncExternalStore } from 'react'

type Listener = () => void

export function createStore<T>(key: string, fallback: T) {
  const lsKey = `ym-clone:${key}`
  // Synchronously init from localStorage so the first render never flashes empty
  let cache: T = (() => {
    try {
      const raw = localStorage.getItem(lsKey)
      if (raw) return JSON.parse(raw) as T
    } catch { /* corrupt */ }
    return fallback
  })()
  const listeners = new Set<Listener>()
  let version = 0

  async function load(): Promise<void> {
    const v = ++version
    try {
      const raw = await window.api.storeGet(key)
      if (v !== version) return
      if (raw) {
        cache = JSON.parse(raw) as T
        try { localStorage.setItem(lsKey, raw) } catch { /* quota */ }
        emit()
        return
      }
    } catch {
      /* IPC unavailable — already have localStorage */
    }
  }

  let loadPromise: Promise<void> | null = null

  function emit(): void {
    listeners.forEach((l) => l())
  }

  function get(): T {
    return cache
  }

  function subscribe(listener: Listener): () => void {
    if (!loadPromise) loadPromise = load()
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  async function persist(value: T): Promise<void> {
    const json = JSON.stringify(value)
    // localStorage is instant — guarantees in-session survival
    try { localStorage.setItem(lsKey, json) } catch { /* quota */ }
    // IPC file — survives restart even if localStorage is wiped
    try { await window.api.storeSet(key, json) } catch (e) { console.error('store persist failed:', e) }
  }

  function set(value: T): void {
    version++
    cache = value
    persist(value)
    emit()
  }

  function update(fn: (prev: T) => T): void {
    set(fn(cache))
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, get)
  }

  return { get, subscribe, set, update, useValue }
}
