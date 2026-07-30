import { apiFetchJson } from './apiClient'
import type { PlaylistSummaryDto } from './playlists'

export type { PlaylistSummaryDto }

export interface ProfileDto {
  id: string
  username: string
  avatarUrl: string | null
  bio: string | null
  verificationLevel: number
  badgesMask: number
  followersCount: number
  followingCount: number
  publicPlaylistsCount: number
  libraryTracksCount: number
  isFollowing: boolean
  isMutual: boolean
}

export interface FollowResult {
  success: boolean
  isFollowing: boolean
}

export interface FollowEntryDto {
  id: string
  username: string
  avatarUrl: string | null
  isFollowing: boolean
  isMutual: boolean
}

export interface PaginatedFollowList {
  items: FollowEntryDto[]
  totalCount: number
  page: number
  pageSize: number
}

export interface PaginatedPlaylistResult {
  items: PlaylistSummaryDto[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

/** Fetch a public profile by username. */
export async function fetchProfile(username: string): Promise<ProfileDto | null> {
  return apiFetchJson<ProfileDto>(`/api/profiles/${encodeURIComponent(username)}`)
}

/** Fetch own profile by username (same endpoint, richer DTO). */
export async function fetchOwnProfile(username: string): Promise<ProfileDto | null> {
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
  bio: string | null
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

/** Fetch public playlists of a user. */
export async function fetchUserPlaylists(
  username: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedPlaylistResult | null> {
  return apiFetchJson<PaginatedPlaylistResult>(
    `/api/profiles/${encodeURIComponent(username)}/playlists?page=${page}&pageSize=${pageSize}`,
  )
}

/** Fetch followers of a user. */
export async function fetchFollowers(
  username: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedFollowList | null> {
  return apiFetchJson<PaginatedFollowList>(
    `/api/profiles/${encodeURIComponent(username)}/followers?page=${page}&pageSize=${pageSize}`,
  )
}

/** Fetch who a user is following. */
export async function fetchFollowing(
  username: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedFollowList | null> {
  return apiFetchJson<PaginatedFollowList>(
    `/api/profiles/${encodeURIComponent(username)}/following?page=${page}&pageSize=${pageSize}`,
  )
}
