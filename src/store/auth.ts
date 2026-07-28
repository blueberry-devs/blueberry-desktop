import { useSyncExternalStore } from 'react'
import { login as apiLogin, register as apiRegister, refresh as apiRefresh, getMe, type AuthUser } from '../services/auth'
import { startBackgroundSync, stopBackgroundSync } from './backgroundSync'
import { clearPlaylistCache } from '../services/playlists'
import { clearLikedTracks } from './likes'

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
    const data = JSON.stringify(cache)
    localStorage.setItem(STORAGE_KEY, data)
  } catch (e) {
    console.error('[auth] persist failed:', e)
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
  if (state.accessToken) {
    startTokenRefresh()
    startProfileRefresh()
    startBackgroundSync()
  }
}

export function clearAuth(): void {
  cache = { accessToken: null, refreshToken: null, user: null }
  clearPlaylistCache()
  clearLikedTracks()
  emit()
}

/** Update just the user field in the auth cache (e.g. after profile edit). */
export function updateAuthUser(user: AuthUser): void {
  cache = { ...cache, user }
  emit()
}

export async function login(
  email: string,
  password: string,
): Promise<string | null> {
  const result = await apiLogin(email, password)
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

export interface RegisterResult {
  error: string | null
  emailConfirmationRequired: boolean
}

export async function register(
  email: string,
  password: string,
): Promise<RegisterResult> {
  const result = await apiRegister(email, password)
  if (result.success) {
    if (result.emailConfirmationRequired) {
      return { error: null, emailConfirmationRequired: true }
    }
    if (result.accessToken) {
      setAuth({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      })
    }
    return { error: null, emailConfirmationRequired: false }
  }
  return { error: result.error ?? 'Registration failed', emailConfirmationRequired: false }
}

export async function tryRestoreSession(): Promise<boolean> {
  const state = getAuth()
  if (!state.accessToken || !state.refreshToken) return false

  const { user, httpStatus } = await getMe(state.accessToken)
  if (user) {
    cache = { ...cache, user }
    emit()
    return true
  }

  // Server error (5xx) or network error — don't invalidate saved tokens
  if (httpStatus !== 401 && httpStatus !== 0) {
    return true
  }

  // Token expired — use shared doRefresh (joins in-flight refresh if any)
  const refreshed = await doRefresh()
  if (!refreshed) return false

  // Retry /me with new token
  const { user: me, httpStatus: meStatus } = await getMe(cache.accessToken!)
  if (me && meStatus !== 401) {
    cache = { ...cache, user: me }
    emit()
    return true
  }

  return false
}

// ---------- Auth dialog trigger (open from anywhere) ----------
let authDialogOpen = false
const dialogListeners = new Set<(open: boolean) => void>()

export function openAuth(): void {
  authDialogOpen = true
  dialogListeners.forEach((l) => l(true))
}

export function closeAuthDialog(): void {
  authDialogOpen = false
  dialogListeners.forEach((l) => l(false))
}

export function subscribeAuthDialog(cb: (open: boolean) => void): () => void {
  dialogListeners.add(cb)
  return () => dialogListeners.delete(cb)
}

export function useAuthDialog(): boolean {
  return useSyncExternalStore(
    (cb) => {
      dialogListeners.add(cb as unknown as (open: boolean) => void)
      return () => dialogListeners.delete(cb as unknown as (open: boolean) => void)
    },
    () => authDialogOpen,
  )
}

// ---------- Profile refresh with cache ----------
const PROFILE_CACHE_TTL = 5 * 60 * 1000 // 5 min
let lastProfileFetch = 0

export async function refreshProfile(): Promise<void> {
  const now = Date.now()
  if (now - lastProfileFetch < PROFILE_CACHE_TTL) return
  const state = getAuth()
  if (!state.accessToken) return

  // Try fetching profile with current access token
  let result = await getMe(state.accessToken)
  if (result.user) {
    cache = { ...cache, user: result.user }
    lastProfileFetch = now
    emit()
    return
  }

  // Server error (5xx/network) — skip refresh, keep cached profile
  if (result.httpStatus !== 401 && result.httpStatus !== 0) return

  // Token might be expired — try refresh (uses shared lock, no race)
  const refreshed = await doRefresh()
  if (!refreshed) return

  // Retry profile fetch with new token
  result = await getMe(cache.accessToken!)
  if (result.user) {
    cache = { ...cache, user: result.user }
    lastProfileFetch = now
    emit()
  }
}

export function logout(): void {
  clearAuth()
}

// ---------- Periodic token refresh ----------
let refreshInterval: ReturnType<typeof setInterval> | null = null
const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // refresh 10 min before 1-hour expiry
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

// ---------- Periodic profile refresh (/me) ----------
let profileRefreshInterval: ReturnType<typeof setInterval> | null = null
const PROFILE_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // every 5 minutes

export async function doRefresh(): Promise<boolean> {
  // If a refresh is already in-flight, join it instead of returning false
  if (isRefreshing && refreshPromise) return refreshPromise
  isRefreshing = true

  const p = (async (): Promise<boolean> => {
    try {
      const state = getAuth()
      if (!state.refreshToken) return false
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
      // Refresh failed — only clear auth on definitive auth error (401).
      // Server errors (502/5xx) or network errors are temporary; keep tokens.
      if (result.httpStatus === 401) {
        clearAuth()
      }
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  refreshPromise = p
  return p
}

function stopTokenRefresh(): void {
  if (refreshInterval !== null) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

function startTokenRefresh(): void {
  stopTokenRefresh()
  refreshInterval = setInterval(() => {
    doRefresh()
  }, REFRESH_INTERVAL_MS)
}

function stopProfileRefresh(): void {
  if (profileRefreshInterval !== null) {
    clearInterval(profileRefreshInterval)
    profileRefreshInterval = null
  }
}

function startProfileRefresh(): void {
  stopProfileRefresh()
  // First call after a short delay so we don't race with initial auth
  setTimeout(() => refreshProfile(), 10_000)
  profileRefreshInterval = setInterval(() => {
    refreshProfile()
  }, PROFILE_REFRESH_INTERVAL_MS)
}

// Patch clearAuth to stop refresh, profile refresh, and background sync on logout
const origClearAuth = clearAuth
clearAuth = (): void => {
  stopTokenRefresh()
  stopProfileRefresh()
  stopBackgroundSync()
  origClearAuth()
}

// Start refresh on init if already logged in
if (cache.accessToken) {
  startTokenRefresh()
  startProfileRefresh()
  startBackgroundSync()
  // Fetch /me immediately on startup (not after the 10s delay from startProfileRefresh)
  refreshProfile()
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getAuth)
}
