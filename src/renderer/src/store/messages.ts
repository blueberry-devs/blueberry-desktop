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
  avatarUrl?: string | null
  verificationLevel: number
  text: string
  timestamp: number
  parentId?: string
  rootId?: string
  replyCount: number
  likeCount: number
  isLikedByMe: boolean
  isDeleted: boolean
}

/* ========== State ========== */

type CommentsData = Record<string, Comment[]>

interface TrackMeta {
  /** Whether we've ever fetched from server for this track */
  fetchedFromServer: boolean
  /** Cursor for the next page (null = no more pages) */
  nextCursor: number | null
  /** Last server fetch timestamp (ms) — used to throttle re-fetches */
  lastFetchedAt: number
  /** Nonce to trigger re-render */
  _rev: number
}

interface ReplyMeta {
  /** Whether replies have been fetched for this root comment */
  fetched: boolean
  /** Cursor for next page of replies (null = no more) */
  nextCursor: number | null
}

let cache: CommentsData = loadFromDisk()
const trackMeta: Record<string, TrackMeta> = {}
const replyMeta: Record<string, ReplyMeta> = {}
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
        avatarUrl: c.avatarUrl ?? undefined,
        verificationLevel: c.verificationLevel ?? 0,
        text: c.text ?? '',
        timestamp: c.timestamp ?? Date.now(),
        parentId: c.parentId || undefined,
        rootId: c.rootId || undefined,
        replyCount: c.replyCount ?? 0,
        likeCount: c.likeCount ?? (Array.isArray(c.likes) ? c.likes.length : 0),
        isLikedByMe: c.isLikedByMe ?? false,
        isDeleted: c.isDeleted ?? false,
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
      lastFetchedAt: 0,
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
 * Filters out server-deleted comments.
 */
export function getComments(trackId: string): Comment[] {
  return (cache[trackId] ?? []).filter((c) => !c.parentId && !c.isDeleted)
}

/**
 * Get ALL comments for a track, including replies.
 */
export function getAllComments(trackId: string): Comment[] {
  return cache[trackId] ?? []
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
 * Filters out server-deleted comments.
 */
export function getReplies(trackId: string, parentId: string): Comment[] {
  return (cache[trackId] ?? []).filter((c) => c.parentId === parentId && !c.isDeleted)
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

/**
 * Check if replies have been loaded for a specific root comment.
 */
export function areRepliesLoaded(rootId: string): boolean {
  return replyMeta[rootId]?.fetched ?? false
}

/**
 * Check if the root comment has more reply pages available.
 */
export function hasMoreReplyPages(rootId: string): boolean {
  return replyMeta[rootId]?.nextCursor != null
}

/* ========== Server sync helpers ========== */

function dtoToLocal(dto: CommentDto): Comment {
  return {
    id: dto.id,
    trackId: dto.entityId,
    author: dto.userName ?? 'Unknown',
    authorId: dto.userId,
    avatarUrl: dto.userAvatarUrl ?? undefined,
    verificationLevel: dto.verificationLevel,
    text: dto.text,
    timestamp: new Date(dto.createdAt).getTime(),
    parentId: dto.parentId ?? undefined,
    rootId: dto.rootId ?? undefined,
    replyCount: dto.replyCount,
    likeCount: dto.likeCount,
    isLikedByMe: dto.isLikedByMe,
    isDeleted: dto.isDeleted,
  }
}

/**
 * Merge/replace server comments into local cache.
 * Server-deleted comments (isDeleted: true) are skipped entirely.
 *
 * @param replace - When true, replaces the entire cache for this track
 *   with server data. When false (pagination), merges server data into
 *   existing cache.
 * @param replaceRootId - When set, replaces only replies belonging to this
 *   root comment ID. Top-level comments and replies of other roots are
 *   preserved. Takes precedence over `replace` when both are set.
 */
function mergeFromServer(
  trackId: string,
  dtos: CommentDto[],
  replace?: boolean,
  replaceRootId?: string,
): void {
  const existing = new Map(
    replace
      ? []
      : (cache[trackId] ?? []).map((c) => [c.id, c] as const),
  )

  // When replacing replies for a specific root, keep everything except
  // old replies for that root, then add server data.
  if (replaceRootId) {
    for (const c of cache[trackId] ?? []) {
      if (c.rootId !== replaceRootId) {
        existing.set(c.id, c)
      }
    }
  }

  for (const dto of dtos) {
    // Skip server-deleted comments — don't add them to local cache
    if (dto.isDeleted) continue
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

  // Always fetch from server — without it, deleted comments stay in cache
  // forever. The replace:true in mergeFromServer below purges stale data.
  // Throttle: only re-fetch if the last fetch was more than 60s ago.
  if (meta.fetchedFromServer && Date.now() - meta.lastFetchedAt < 60_000) return

  const result = await apiFetchComments(trackId, 'track', undefined, PAGE_SIZE)
  if (!result) {
    // Server unavailable — keep local cache as-is
    return
  }

  meta.fetchedFromServer = true
  meta.nextCursor = result.nextCursor
  meta.lastFetchedAt = Date.now()

  mergeFromServer(trackId, result.comments, true) // replace on initial load

  // Clear reply meta for affected root comments so replies re-fetch
  for (const root of result.comments) {
    if (replyMeta[root.id]) {
      delete replyMeta[root.id]
    }
  }

  // Auto-load first page of replies for root comments with replies
  for (const root of result.comments) {
    if (root.replyCount > 0 && !replyMeta[root.id]?.fetched) {
      loadRepliesFromServer(trackId, root.id).catch(() => {})
    }
  }
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

  // Auto-load first page of replies for newly loaded root comments
  for (const root of result.comments) {
    if (root.replyCount > 0 && !replyMeta[root.id]?.fetched) {
      loadRepliesFromServer(trackId, root.id).catch(() => {})
    }
  }

  return true
}

/**
 * Load replies for a root comment from the server.
 * Uses reply-specific cursor if there's a next page.
 */
export async function loadRepliesFromServer(
  trackId: string,
  rootId: string,
): Promise<void> {
  const auth = getAuth()
  if (!auth.accessToken) return

  const meta = replyMeta[rootId]
  if (meta && meta.fetched && meta.nextCursor == null) return // all loaded

  const result = await apiFetchReplies(rootId, meta?.nextCursor ?? undefined)
  if (!result) return

  if (!replyMeta[rootId]) {
    replyMeta[rootId] = { fetched: false, nextCursor: null }
  }
  replyMeta[rootId].fetched = true
  replyMeta[rootId].nextCursor = result.nextCursor

  // Replace only replies for this root — stale deleted replies are purged
  mergeFromServer(trackId, result.comments, false, rootId)
}

/**
 * Load next page of replies for a root comment.
 */
export async function loadMoreRepliesFromServer(
  trackId: string,
  rootId: string,
): Promise<boolean> {
  const auth = getAuth()
  if (!auth.accessToken) return false

  const meta = replyMeta[rootId]
  if (!meta?.fetched || meta.nextCursor == null) return false

  const result = await apiFetchReplies(rootId, meta.nextCursor)
  if (!result) return false

  meta.nextCursor = result.nextCursor
  mergeFromServer(trackId, result.comments)
  return true
}

/**
 * Add a comment. Optimistic local save, updates with server data on success.
 * Returns the created comment.
 */
export async function addComment(
  trackId: string,
  author: string,
  text: string,
  parentId?: string,
  commentId?: string,
): Promise<Comment> {
  const auth = getAuth()
  const id = commentId ?? crypto.randomUUID()
  const comment: Comment = {
    id,
    trackId,
    author,
    authorId: auth.user?.id ?? '',
    avatarUrl: undefined,
    verificationLevel: 0,
    text,
    timestamp: Date.now(),
    parentId,
    replyCount: 0,
    likeCount: 0,
    isLikedByMe: false,
    isDeleted: false,
  }

  // Optimistic local save — show immediately
  const all = cache[trackId] ?? []
  all.push(comment)
  cache = { ...cache, [trackId]: all }
  bumpRev(trackId)
  emit()

  // Try server with client-supplied UUID for idempotency
  if (auth.accessToken) {
    const created = await apiCreateComment({
      id,
      entityType: 'track',
      entityId: trackId,
      parentId: parentId ?? null,
      text,
    })

    if (created) {
      // Update with server data
      cache = {
        ...cache,
        [trackId]: (cache[trackId] ?? []).map((c) =>
          c.id === id
            ? {
                ...c,
                id: created.id,
                timestamp: new Date(created.createdAt).getTime(),
                authorId: created.userId,
                author: created.userName ?? author,
                avatarUrl: created.userAvatarUrl ?? undefined,
                verificationLevel: created.verificationLevel,
                rootId: created.rootId ?? undefined,
                replyCount: created.replyCount,
                parentId: created.parentId ?? undefined,
                likeCount: created.likeCount,
                isLikedByMe: created.isLikedByMe,
              }
            : c,
        ),
      }
      bumpRev(trackId)
      emit()
    } else {
      // Server rejected — remove optimistic comment from cache
      cache = {
        ...cache,
        [trackId]: (cache[trackId] ?? []).filter((c) => c.id !== id),
      }
      bumpRev(trackId)
      emit()
      throw new Error('Failed to send comment — server unavailable')
    }
  }

  return comment
}

/**
 * Delete a comment and its replies. Server-first — removes locally
 * only after server confirms. Throws on server failure so the UI
 * can show visual feedback.
 */
export async function deleteComment(
  trackId: string,
  commentId: string,
): Promise<void> {
  const auth = getAuth()
  if (auth.accessToken) {
    const ok = await apiDeleteComment(commentId)
    if (!ok) throw new Error('Failed to delete comment on server')
  }
  // Remove locally after server success
  const all = cache[trackId] ?? []
  cache = {
    ...cache,
    [trackId]: all.filter((c) => c.id !== commentId && c.parentId !== commentId),
  }
  bumpRev(trackId)
  emit()
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
  bumpRev(trackId)
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
      bumpRev(trackId)
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
    () => (cache[trackId] ?? []).filter((c) => !c.parentId && !c.isDeleted),
  )
  return (cache[trackId] ?? []).filter((c) => !c.parentId && !c.isDeleted)
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
