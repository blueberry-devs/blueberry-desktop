import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'ym-clone:profile'

export type Theme = 'light' | 'black'

export interface Profile {
  nickname: string
  theme: Theme
  // Explicit (18+) tracks are always badged; this controls whether they're
  // filtered out of search/wave/charts results entirely. On by default —
  // matches how it behaved before this setting existed, and only actually
  // does anything once the user turns it off.
  allowExplicit: boolean
  // Fullscreen player tries to find a matching YouTube video clip and use it
  // as the background instead of the blurred cover — off switches back to
  // the blurred cover unconditionally (no search request made at all).
  videoBackground: boolean
}

const DEFAULT_PROFILE: Profile = { nickname: '', theme: 'black', allowExplicit: true, videoBackground: true }

let cache: Profile = load()
const listeners = new Set<() => void>()

function load(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) } : DEFAULT_PROFILE
  } catch {
    return DEFAULT_PROFILE
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

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getProfile(): Profile {
  return cache
}

export function setNickname(nickname: string): void {
  cache = { ...cache, nickname: nickname.trim() }
  emit()
}

export function setTheme(theme: Theme): void {
  cache = { ...cache, theme }
  emit()
}

export function setAllowExplicit(allowExplicit: boolean): void {
  cache = { ...cache, allowExplicit }
  emit()
}

export function setVideoBackground(videoBackground: boolean): void {
  cache = { ...cache, videoBackground }
  emit()
}

// Client-only app, no real accounts — "logging out" just clears the local
// nickname, which sends the user back through onboarding.
export function logout(): void {
  cache = { ...DEFAULT_PROFILE, theme: cache.theme }
  emit()
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, getProfile)
}
