const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/* ========== DTOs ========== */

export interface CommentDto {
  id: string
  trackId: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  text: string
  parentId: string | null
  createdAt: string
  likesCount: number
  dislikesCount: number
  likedByMe: boolean
  dislikedByMe: boolean
  repliesCount: number
}

export interface CommentsPageDto {
  items: CommentDto[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateCommentRequest {
  trackId: string
  text: string
  parentId?: string
}

/* ========== API calls ========== */

/**
 * Fetch a page of comments for a track.
 * Returns null on error — caller should handle gracefully.
 */
export async function fetchComments(
  accessToken: string,
  trackId: string,
  page = 1,
  pageSize = 20,
): Promise<CommentsPageDto | null> {
  try {
    const params = new URLSearchParams({
      trackId,
      page: String(page),
      pageSize: String(pageSize),
    })
    const res = await fetch(`${BASE_URL}/api/comments?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return (await res.json()) as CommentsPageDto
  } catch {
    return null
  }
}

/**
 * Fetch replies for a specific parent comment.
 */
export async function fetchReplies(
  accessToken: string,
  commentId: string,
  page = 1,
  pageSize = 10,
): Promise<CommentsPageDto | null> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    const res = await fetch(
      `${BASE_URL}/api/comments/${commentId}/replies?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) return null
    return (await res.json()) as CommentsPageDto
  } catch {
    return null
  }
}

/**
 * Create a new comment.
 * Returns the created comment DTO, or null on failure.
 */
export async function createComment(
  accessToken: string,
  request: CreateCommentRequest,
): Promise<CommentDto | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    })
    if (!res.ok) return null
    return (await res.json()) as CommentDto
  } catch {
    return null
  }
}

/**
 * Delete a comment (owner or admin only).
 * Returns true if deleted.
 */
export async function deleteComment(
  accessToken: string,
  commentId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Toggle like on a comment.
 * Returns the updated DTO or null on failure.
 */
export async function toggleCommentLike(
  accessToken: string,
  commentId: string,
): Promise<CommentDto | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!res.ok) return null
    return (await res.json()) as CommentDto
  } catch {
    return null
  }
}

/**
 * Toggle dislike on a comment.
 * Returns the updated DTO or null on failure.
 */
export async function toggleCommentDislike(
  accessToken: string,
  commentId: string,
): Promise<CommentDto | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/comments/${commentId}/dislike`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!res.ok) return null
    return (await res.json()) as CommentDto
  } catch {
    return null
  }
}
