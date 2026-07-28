import { useSyncExternalStore } from 'react'
import { getAuth } from './auth'
import type { CommentDto } from '../services/comments'
import {
  fetchComments as apiFetchComments,
  fetchReplies as apiFetchReplies,
  createComment as apiCreateComment,
  deleteComment as apiDeleteComment,
  likeComment as apiLikeComment,
  unlikeComment as apiUnlikeComment,
} from '../services/comments'

const STORAGE_KEY = 'ym-clone:comments-v2'
const PAGE_SIZE = 20

/* ========== Local types ========== */

export interface Comment {
  id: string
  trackId: string
  author: string
  authorId: string
  text: string
  timestamp: number
  parentId?: string
  likeCount: number
  isLikedByMe: boolean
}

/* ========== State ========== */

type CommentsData = Record<string, Comment[]>

interface TrackMeta {
  /** Whether we've ever fetched from server for this track */
  fetchedFromServer: boolean
  /** Cursor for the next page (null = no more pages) */
  nextCursor: number | null
  /** Nonce to trigger re-render */
  _rev: number
}

let cache: CommentsData = loadFromDisk()
const trackMeta: Record<string, TrackMeta> = {}
const listeners = new Set<() => void>()
const pageListeners = new Set<() => void>()

/* ========== Persistence ========== */

function loadFromDisk(): CommentsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    // Migrate from v1 (plain array values with likes/dislikes arrays) to v3
    const migrated: CommentsData = {}
    for (const [trackId, comments] of Object.entries(parsed)) {
      if (!Array.isArray(comments)) continue
      migrated[trackId] = comments.map((c: Partial<Comment & { likes?: string[]; dislikes?: string[] }>) => ({
        id: c.id ?? '',
        trackId: c.trackId ?? trackId,
        author: c.author ?? '',
        authorId: c.authorId ?? '',
        text: c.text ?? '',
        timestamp: c.timestamp ?? Date.now(),
        parentId: c.parentId || undefined,
        likeCount: c.likeCount ?? (Array.isArray(c.likes) ? c.likes.length : 0),
        isLikedByMe: c.isLikedByMe ?? false,
      }))
    }
    return migrated
  } catch {
    return {}
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* storage full — silently degrade */
  }
}

function emit(): void {
  persist()
  listeners.forEach((l) => l())
  pageListeners.forEach((l) => l())
}

/* ========== Helpers ========== */

function getTrackIds(trackId: string): Set<string> {
  return new Set(
    (cache[trackId] ?? []).filter((c) => !c.parentId).map((c) => c.id),
  )
}

function ensureMeta(trackId: string): TrackMeta {
  if (!trackMeta[trackId]) {
    trackMeta[trackId] = {
      fetchedFromServer: false,
      nextCursor: null,
      _rev: 0,
    }
  }
  return trackMeta[trackId]
}

function bumpRev(trackId: string): void {
  const m = ensureMeta(trackId)
  m._rev++
}

/* ========== Public API ========== */

/**
 * Get all top-level comments for a track (no replies).
 */
export function getComments(trackId: string): Comment[] {
  return (cache[trackId] ?? []).filter((c) => !c.parentId)
}

/**
 * Paginated access to comments. Used for lazy loading.
 */
export function getCommentsPage(
  trackId: string,
  page: number,
): { comments: Comment[]; hasMore: boolean } {
  const all = getComments(trackId)
  const end = (page + 1) * PAGE_SIZE
  return {
    comments: all.slice(0, end),
    hasMore: end < all.length,
  }
}

/**
 * Get replies for a specific parent comment.
 */
export function getReplies(trackId: string, parentId: string): Comment[] {
  return (cache[trackId] ?? []).filter((c) => c.parentId === parentId)
}

/**
 * Check if a track has been loaded from the server at least once.
 */
export function hasServerFetched(trackId: string): boolean {
  return trackMeta[trackId]?.fetchedFromServer ?? false
}

/**
 * Check if the server has more pages of comments to load.
 */
export function hasMoreServerPages(trackId: string): boolean {
  return trackMeta[trackId]?.nextCursor != null
}

/**
 * Get total top-level comment count for a track.
 */
export function getCommentCount(trackId: string): number {
  return getComments(trackId).length
}

/* ========== Server sync helpers ========== */

function dtoToLocal(dto: CommentDto): Comment {
  return {
    id: dto.id,
    trackId: dto.entityId,
    author: dto.userName ?? 'Unknown',
    authorId: dto.userId,
    text: dto.text,
    timestamp: new Date(dto.createdAt).getTime(),
    parentId: dto.parentId ?? undefined,
    likeCount: dto.likeCount,
    isLikedByMe: dto.isLikedByMe,
  }
}

function mergeFromServer(
  trackId: string,
  dtos: CommentDto[],
): void {
  const existing = new Map(
    (cache[trackId] ?? []).map((c) => [c.id, c]),
  )
  for (const dto of dtos) {
    const local = dtoToLocal(dto)
    existing.set(local.id, local)
  }
  const merged = [...existing.values()]
  // Sort: newest first for top-level, chronological for replies
  merged.sort((a, b) => b.timestamp - a.timestamp)
  cache = { ...cache, [trackId]: merged }
  bumpRev(trackId)
  emit()
}

/* ========== Actions ========== */

/**
 * Fetch comments from server with cursor-based pagination.
 * Call this when opening comments for a track.
 */
export async function loadCommentsFromServer(
  trackId: string,
): Promise<void> {
  const auth = getAuth()
  if (!auth.accessToken) return

  const meta = ensureMeta(trackId)
  if (meta.fetchedFromServer) return // already loaded

  // apiFetchJson inside apiFetchComments already handles 401 → auto-refresh
  const result = await apiFetchComments(trackId, 'track', undefined, PAGE_SIZE)
  if (!result) {
    // Server unavailable — keep local cache as-is
    return
  }

  meta.fetchedFromServer = true
  meta.nextCursor = result.nextCursor

  mergeFromServer(trackId, result.comments)
}

/**
 * Load next page from server (cursor-based pagination).
 */
export async function loadMoreCommentsFromServer(
  trackId: string,
): Promise<boolean> {
  const auth = getAuth()
  if (!auth.accessToken) return false

  const meta = ensureMeta(trackId)
  if (meta.nextCursor == null) return false

  const result = await apiFetchComments(
    trackId,
    'track',
    meta.nextCursor,
    PAGE_SIZE,
  )
  if (!result) return false

  meta.nextCursor = result.nextCursor
  mergeFromServer(trackId, result.comments)
  return true
}

/**
 * Add a comment. Tries server first, falls back to local-only on failure.
 * Returns the created comment.
 */
export async function addComment(
  trackId: string,
  author: string,
  text: string,
  parentId?: string,
): Promise<Comment> {
  const auth = getAuth()
  const commentId = crypto.randomUUID()
  const comment: Comment = {
    id: commentId,
    trackId,
    author,
    authorId: auth.user?.id ?? '',
    text,
    timestamp: Date.now(),
    parentId,
    likeCount: 0,
    isLikedByMe: false,
  }

  // Try server first with client-supplied UUID for idempotency
  if (auth.accessToken) {
    const created = await apiCreateComment({
      id: commentId,
      entityType: 'track',
      entityId: trackId,
      parentId: parentId ?? null,
      text,
    })
    if (created) {
      comment.id = created.id
      comment.timestamp = new Date(created.createdAt).getTime()
      comment.authorId = created.userId
      comment.author = created.userName ?? author
      comment.likeCount = created.likeCount
      comment.isLikedByMe = created.isLikedByMe
    }
    // If server failed, we keep the local ID and save locally
  }

  // Save locally
  const all = cache[trackId] ?? []
  all.push(comment)
  cache = { ...cache, [trackId]: all }
  bumpRev(trackId)
  emit()
  return comment
}

/**
 * Delete a comment and its replies. Optimistic local remove,
 * rolls back on server failure.
 */
export async function deleteComment(
  trackId: string,
  commentId: string,
): Promise<void> {
  const auth = getAuth()

  // Snapshot for rollback
  const prev = cache[trackId]

  // Optimistic local remove
  const all = cache[trackId] ?? []
  cache = {
    ...cache,
    [trackId]: all.filter((c) => c.id !== commentId && c.parentId !== commentId),
  }
  bumpRev(trackId)
  emit()

  // Try server
  if (auth.accessToken) {
    try {
      await apiDeleteComment(commentId)
    } catch {
      // Rollback on failure
      cache = { ...cache, [trackId]: prev ?? [] }
      bumpRev(trackId)
      emit()
    }
  }
}

/**
 * Toggle like on a comment. Sends POST to like or DELETE to unlike
 * depending on current state. Falls back to local toggle on failure.
 */
export async function toggleLike(
  trackId: string,
  commentId: string,
): Promise<void> {
  const auth = getAuth()

  // Read current state before mutating
  const all = cache[trackId] ?? []
  const target = all.find((c) => c.id === commentId)
  if (!target) return

  const wasLiked = target.isLikedByMe

  // Optimistic local update
  cache = {
    ...cache,
    [trackId]: all.map((c) => {
      if (c.id !== commentId) return c
      return {
        ...c,
        isLikedByMe: !wasLiked,
        likeCount: wasLiked ? Math.max(0, c.likeCount - 1) : c.likeCount + 1,
      }
    }),
  }
  emit()

  // Try server
  if (auth.accessToken) {
    const dto = wasLiked
      ? await apiUnlikeComment(commentId)
      : await apiLikeComment(commentId)
    if (dto) {
      // Apply server state
      cache = {
        ...cache,
        [trackId]: (cache[trackId] ?? []).map((c) => {
          if (c.id !== commentId) return c
          return {
            ...c,
            isLikedByMe: dto.isLikedByMe,
            likeCount: dto.likeCount,
          }
        }),
      }
      emit()
      return
    }
    // Server failed — keep optimistic update
  }
}

/* ========== React hooks ========== */

export function useComments(trackId: string): Comment[] {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (cache[trackId] ?? []).filter((c) => !c.parentId),
  )
  return (cache[trackId] ?? []).filter((c) => !c.parentId)
}

/**
 * Subscribe to rev changes for a track (used for reactivity).
 */
export function useCommentsRev(trackId: string): number {
  useSyncExternalStore(
    (cb) => {
      pageListeners.add(cb)
      return () => pageListeners.delete(cb)
    },
    () => trackMeta[trackId]?._rev ?? 0,
  )
  return trackMeta[trackId]?._rev ?? 0
}
