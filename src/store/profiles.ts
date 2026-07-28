import { useSyncExternalStore } from 'react'
import {
  fetchProfile as apiFetchProfile,
  followUser as apiFollowUser,
  unfollowUser as apiUnfollowUser,
  type ProfileDto,
} from '../services/profiles'

/* ========== Store state ========== */

interface ProfileState {
  /** Currently viewed profile username (null = no profile open) */
  viewing: string | null
  /** Cached profiles by username */
  cache: Record<string, ProfileDto>
  /** Set of usernames being followed (for optimistic UI) */
  pendingFollows: string[]
}

let state: ProfileState = {
  viewing: null,
  cache: {},
  pendingFollows: [],
}

const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ProfileState {
  return state
}

/* ========== React hook ========== */

export function useProfileState(): ProfileState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Get cached profile for a username (or null if not fetched yet). */
export function getCachedProfile(username: string): ProfileDto | null {
  return state.cache[username] ?? null
}

export function isFollowingPending(username: string): boolean {
  return state.pendingFollows.includes(username)
}

/* ========== Navigation ========== */

export function openProfile(username: string): void {
  state = { ...state, viewing: username }
  emit()
  // Fetch profile if not cached
  if (!state.cache[username]) {
    fetchProfile(username)
  }
}

export function closeProfile(): void {
  state = { ...state, viewing: null }
  emit()
}

/* ========== Data fetching ========== */

export async function fetchProfile(username: string): Promise<void> {
  const profile = await apiFetchProfile(username)
  if (profile) {
    state = { ...state, cache: { ...state.cache, [profile.username]: profile } }
    emit()
  }
}

/* ========== Follow / Unfollow ========== */

export async function followProfile(username: string): Promise<void> {
  const cached = state.cache[username]
  if (!cached) return

  const prev = state

  // Optimistic update
  state = {
    ...state,
    pendingFollows: [...state.pendingFollows, username],
    cache: {
      ...state.cache,
      [username]: { ...cached, isFollowing: true, followersCount: cached.followersCount + 1 },
    },
  }
  emit()

  const result = await apiFollowUser(username)
  if (!result || !result.success) {
    // Revert on failure
    state = prev
    emit()
  } else {
    state = { ...state, pendingFollows: state.pendingFollows.filter((u) => u !== username) }
    emit()
  }
}

export async function unfollowProfile(username: string): Promise<void> {
  const cached = state.cache[username]
  if (!cached) return

  const prev = state

  // Optimistic update
  state = {
    ...state,
    pendingFollows: [...state.pendingFollows, username],
    cache: {
      ...state.cache,
      [username]: {
        ...cached,
        isFollowing: false,
        followersCount: Math.max(0, cached.followersCount - 1),
      },
    },
  }
  emit()

  const result = await apiUnfollowUser(username)
  if (!result || !result.success) {
    // Revert on failure
    state = prev
    emit()
  } else {
    state = { ...state, pendingFollows: state.pendingFollows.filter((u) => u !== username) }
    emit()
  }
}
