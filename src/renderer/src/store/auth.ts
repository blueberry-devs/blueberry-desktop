import { useSyncExternalStore } from 'react'
import { login as apiLogin, register as apiRegister, refresh as apiRefresh, getMe, type AuthUser } from '../services/auth'

const STORAGE_KEY = 'ym-clone:auth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
}

let cache: AuthState = load()
const listeners = new Set<() => void>()

function load(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw
      ? (JSON.parse(raw) as AuthState)
      : { accessToken: null, refreshToken: null, user: null }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
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

export function getAuth(): AuthState {
  return cache
}

export function isAuthenticated(): boolean {
  return !!cache.accessToken
}

export function setAuth(state: AuthState): void {
  cache = state
  emit()
}

export function clearAuth(): void {
  cache = { accessToken: null, refreshToken: null, user: null }
  emit()
}

export async function login(
  email: string,
  password: string,
  turnstileToken: string | null,
): Promise<string | null> {
  const result = await apiLogin(email, password, turnstileToken)
  if (result.success && result.accessToken) {
    setAuth({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    })
    return null
  }
  return result.error ?? 'Login failed'
}

export async function register(
  email: string,
  password: string,
  turnstileToken: string | null,
): Promise<string | null> {
  const result = await apiRegister(email, password, turnstileToken)
  if (result.success && result.accessToken) {
    setAuth({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    })
    return null
  }
  return result.error ?? 'Registration failed'
}

export async function tryRestoreSession(): Promise<boolean> {
  const state = getAuth()
  if (!state.accessToken || !state.refreshToken) return false

  const user = await getMe(state.accessToken)
  if (user) {
    cache = { ...cache, user }
    emit()
    return true
  }

  const result = await apiRefresh(state.refreshToken)
  if (result.success && result.accessToken) {
    cache = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? state.refreshToken,
      user: state.user,
    }
    emit()
    return true
  }

  clearAuth()
  return false
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getAuth)
}
