import { useSyncExternalStore } from 'react'
import { getAuth } from './auth'
import type { CommentDto } from '../services/comments'
import {
  fetchComments as apiFetchComments,
  fetchReplies as apiFetchReplies,
  createComment as apiCreateComment,
  deleteComment as apiDeleteComment,
  toggleCommentLike as apiToggleLike,
  toggleCommentDislike as apiToggleDislike,
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
  likes: string[]
  dislikes: string[]
}

/* ========== State ========== */

type CommentsData = Record<string, Comment[]>

interface TrackMeta {
  /** Whether we've ever fetched from server for this track */
  fetchedFromServer: boolean
  /** Current page loaded from server */
  serverPage: number
  /** Whether server has more pages */
  hasMoreOnServer: boolean
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
    // Migrate from v1 (plain array values) to v2 format if needed
    const migrated: CommentsData = {}
    for (const [trackId, comments] of Object.entries(parsed)) {
      if (!Array.isArray(comments)) continue
      migrated[trackId] = comments.map((c: Partial<Comment>) => ({
        id: c.id ?? '',
        trackId: c.trackId ?? trackId,
        author: c.author ?? '',
        authorId: c.authorId ?? '',
        text: c.text ?? '',
        timestamp: c.timestamp ?? Date.now(),
        parentId: c.parentId || undefined,
        likes: Array.isArray(c.likes) ? c.likes : [],
        dislikes: Array.isArray(c.dislikes) ? c.dislikes : [],
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
      serverPage: 0,
      hasMoreOnServer: false,
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
  return trackMeta[trackId]?.hasMoreOnServer ?? false
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
    trackId: dto.trackId,
    author: dto.authorName,
    authorId: dto.authorId,
    text: dto.text,
    timestamp: new Date(dto.createdAt).getTime(),
    parentId: dto.parentId ?? undefined,
    // The local ClientComment stores likes/dislikes as arrays of usernames.
    // Server DTO returns counts + boolean flags — we reconstruct a minimal
    // representation for the local cache so the UI can highlight correctly.
    likes: dto.likedByMe ? [dto.authorName] : [],
    dislikes: dto.dislikedByMe ? [dto.authorName] : [],
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
 * Fetch comments from server. Falls back to local cache when offline.
 * Call this when opening comments for a track.
 */
export async function loadCommentsFromServer(
  trackId: string,
): Promise<void> {
  const auth = getAuth()
  if (!auth.accessToken) return

  const meta = ensureMeta(trackId)
  if (meta.fetchedFromServer) return // already loaded

  const result = await apiFetchComments(auth.accessToken, trackId, 1, PAGE_SIZE)
  if (!result) {
    // Server unavailable — keep local cache as-is
    return
  }

  meta.fetchedFromServer = true
  meta.serverPage = 1
  meta.hasMoreOnServer = result.page < result.totalPages

  mergeFromServer(trackId, result.items)
}

/**
 * Load next page from server (pagination).
 */
export async function loadMoreCommentsFromServer(
  trackId: string,
): Promise<boolean> {
  const auth = getAuth()
  if (!auth.accessToken) return false

  const meta = ensureMeta(trackId)
  if (!meta.hasMoreOnServer) return false

  const nextPage = meta.serverPage + 1
  const result = await apiFetchComments(
    auth.accessToken,
    trackId,
    nextPage,
    PAGE_SIZE,
  )
  if (!result) return false

  meta.serverPage = nextPage
  meta.hasMoreOnServer = result.page < result.totalPages
  mergeFromServer(trackId, result.items)
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
  const comment: Comment = {
    id: crypto.randomUUID(),
    trackId,
    author,
    authorId: auth.user?.id ?? '',
    text,
    timestamp: Date.now(),
    parentId,
    likes: [],
    dislikes: [],
  }

  // Try server first
  if (auth.accessToken) {
    const created = await apiCreateComment(auth.accessToken, {
      trackId,
      text,
      parentId,
    })
    if (created) {
      comment.id = created.id
      comment.timestamp = new Date(created.createdAt).getTime()
      comment.authorId = created.authorId
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
 * Delete a comment and its replies. Tries server, always removes locally.
 */
export async function deleteComment(
  trackId: string,
  commentId: string,
): Promise<void> {
  const auth = getAuth()
  if (auth.accessToken) {
    await apiDeleteComment(auth.accessToken, commentId)
  }
  // Always remove locally regardless of server result
  const all = cache[trackId] ?? []
  cache = {
    ...cache,
    [trackId]: all.filter((c) => c.id !== commentId && c.parentId !== commentId),
  }
  bumpRev(trackId)
  emit()
}

/**
 * Toggle like. Tries server, falls back to local toggle.
 */
export async function toggleLike(
  trackId: string,
  commentId: string,
  username: string,
): Promise<void> {
  const auth = getAuth()
  if (auth.accessToken) {
    await apiToggleLike(auth.accessToken, commentId)
  }
  // Optimistic local update
  const all = cache[trackId] ?? []
  cache = {
    ...cache,
    [trackId]: all.map((c) => {
      if (c.id !== commentId) return c
      const likes = c.likes.includes(username)
        ? c.likes.filter((u) => u !== username)
        : [...c.likes, username]
      const dislikes = c.dislikes.filter((u) => u !== username)
      return { ...c, likes, dislikes }
    }),
  }
  emit()
}

/**
 * Toggle dislike. Tries server, falls back to local toggle.
 */
export async function toggleDislike(
  trackId: string,
  commentId: string,
  username: string,
): Promise<void> {
  const auth = getAuth()
  if (auth.accessToken) {
    await apiToggleDislike(auth.accessToken, commentId)
  }
  // Optimistic local update
  const all = cache[trackId] ?? []
  cache = {
    ...cache,
    [trackId]: all.map((c) => {
      if (c.id !== commentId) return c
      const dislikes = c.dislikes.includes(username)
        ? c.dislikes.filter((u) => u !== username)
        : [...c.dislikes, username]
      const likes = c.likes.filter((u) => u !== username)
      return { ...c, likes, dislikes }
    }),
  }
  emit()
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
 * Subscribe to page changes for a track (used for pagination trigger).
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
