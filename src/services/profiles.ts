import { apiFetchJson } from './apiClient'

export interface ProfileDto {
  id: string
  username: string
  avatarUrl: string | null
  verificationLevel: number
  badgesMask: number
  followersCount: number
  followingCount: number
  isFollowing: boolean
}

export interface FollowResult {
  success: boolean
  isFollowing: boolean
}

/** Fetch a public profile by username. */
export async function fetchProfile(username: string): Promise<ProfileDto | null> {
  return apiFetchJson<ProfileDto>(`/api/profiles/${encodeURIComponent(username)}`)
}

/** Follow a user by username. */
export async function followUser(username: string): Promise<FollowResult | null> {
  return apiFetchJson<FollowResult>(`/api/profiles/${encodeURIComponent(username)}/follow`, {
    method: 'POST',
  })
}

/** Unfollow a user by username. */
export async function unfollowUser(username: string): Promise<FollowResult | null> {
  return apiFetchJson<FollowResult>(`/api/profiles/${encodeURIComponent(username)}/follow`, {
    method: 'DELETE',
  })
}

export interface UpdateProfileRequest {
  username: string | null
  avatarUrl: string | null
}

import type { AuthUser } from './auth'

/** Update own profile (username and/or avatarUrl). */
export async function updateProfile(data: UpdateProfileRequest): Promise<AuthUser | null> {
  return apiFetchJson<AuthUser>('/api/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
