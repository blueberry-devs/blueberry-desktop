import { apiFetch, apiFetchJson } from './apiClient'

/* ========== DTOs (v1.yaml spec) ========== */

export interface CommentDto {
  id: string
  userId: string
  userName: string | null
  userAvatarUrl: string | null
  entityType: string
  entityId: string
  rootId: string | null
  parentId: string | null
  replyToUserName: string | null
  text: string
  isDeleted: boolean
  likeCount: number
  replyCount: number
  createdAt: string
  updatedAt: string
  isLikedByMe: boolean
}

export interface CommentsListResult {
  comments: CommentDto[]
  nextCursor: number | null
}

export interface CreateCommentRequest {
  id: string
  entityType: string
  entityId: string
  parentId: string | null
  text: string
}

/* ========== API calls ========== */

/**
 * Fetch root comments with cursor-based pagination.
 * GET /api/comments/{entityType}/{entityId}?cursor=N&limit=N
 */
export async function fetchComments(
  entityId: string,
  entityType = 'track',
  cursor?: number,
  limit = 20,
): Promise<CommentsListResult | null> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor != null) params.set('cursor', String(cursor))
  return await apiFetchJson<CommentsListResult>(
    `/api/comments/${entityType}/${entityId}?${params}`,
  )
}

/**
 * Fetch replies under a root comment (max 5 per page).
 * GET /api/comments/{rootId}/replies?cursor=N&limit=N
 */
export async function fetchReplies(
  rootId: string,
  cursor?: number,
  limit = 5,
): Promise<CommentsListResult | null> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor != null) params.set('cursor', String(cursor))
  return await apiFetchJson<CommentsListResult>(
    `/api/comments/${rootId}/replies?${params}`,
  )
}

/**
 * Create a comment (or reply). Client supplies the UUID for idempotency.
 * POST /api/comments
 */
export async function createComment(
  request: CreateCommentRequest,
): Promise<CommentDto | null> {
  const res = await apiFetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) return null
  return (await res.json()) as CommentDto
}

/**
 * Delete a comment (owner or admin only).
 * DELETE /api/comments/{id}
 */
export async function deleteComment(
  commentId: string,
): Promise<boolean> {
  const res = await apiFetch(`/api/comments/${commentId}`, {
    method: 'DELETE',
  })
  return res.ok
}

/**
 * Like a comment. Idempotent.
 * POST /api/comments/{id}/like
 */
export async function likeComment(
  commentId: string,
): Promise<CommentDto | null> {
  const res = await apiFetch(`/api/comments/${commentId}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) return null
  return (await res.json()) as CommentDto
}

/**
 * Remove a like from a comment. Idempotent.
 * DELETE /api/comments/{id}/like
 */
export async function unlikeComment(
  commentId: string,
): Promise<CommentDto | null> {
  const res = await apiFetch(`/api/comments/${commentId}/like`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) return null
  return (await res.json()) as CommentDto
}
