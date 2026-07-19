import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'ym-clone:profile'

export type Theme = 'light' | 'black'

export interface Profile {
  nickname: string
  theme: Theme
  allowExplicit: boolean
  videoBackground: boolean
  navbarPosition: NavbarPosition
  language: string
}

export type NavbarPosition = 'left' | 'top' | 'bottom'

const DEFAULT_PROFILE: Profile = {
  nickname: '',
  theme: 'black',
  allowExplicit: true,
  videoBackground: true,
  navbarPosition: 'left',
  language: 'ru'
}

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

export function setNavbarPosition(navbarPosition: NavbarPosition): void {
  cache = { ...cache, navbarPosition }
  emit()
}

export function setLanguage(language: string): void {
  cache = { ...cache, language }
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
