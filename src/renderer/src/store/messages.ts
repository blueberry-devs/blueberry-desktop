import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'ym-clone:comments'
const PAGE_SIZE = 20

export interface Comment {
  id: string
  trackId: string
  author: string
  text: string
  timestamp: number
  parentId?: string
  likes: string[]
  dislikes: string[]
}

type CommentsData = Record<string, Comment[]>

let cache: CommentsData = load()
const listeners = new Set<() => void>()

function migrate(comment: Partial<Comment>): Comment {
  return {
    id: comment.id ?? '',
    trackId: comment.trackId ?? '',
    author: comment.author ?? '',
    text: comment.text ?? '',
    timestamp: comment.timestamp ?? 0,
    parentId: comment.parentId,
    likes: comment.likes ?? [],
    dislikes: comment.dislikes ?? [],
  }
}

function load(): CommentsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<Comment>[]>
    const migrated: CommentsData = {}
    for (const [trackId, comments] of Object.entries(parsed)) {
      migrated[trackId] = (comments ?? []).map(migrate)
    }
    return migrated
  } catch {
    return {}
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch { }
}

function emit(): void {
  persist()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): CommentsData {
  return cache
}

function mutateTrack(trackId: string, fn: (comments: Comment[]) => Comment[]): void {
  const all = cache[trackId] ?? []
  cache = { ...cache, [trackId]: fn(all) }
  emit()
}

function safeComment(c: Partial<Comment>): Comment {
  return {
    id: c.id ?? '',
    trackId: c.trackId ?? '',
    author: c.author ?? '',
    text: c.text ?? '',
    timestamp: c.timestamp ?? 0,
    parentId: c.parentId,
    likes: c.likes ?? [],
    dislikes: c.dislikes ?? [],
  }
}

function getTrack(trackId: string): Comment[] {
  return (cache[trackId] ?? []).map(safeComment)
}

export function getComments(trackId: string): Comment[] {
  return getTrack(trackId)
}

export function getCommentsPage(trackId: string, page: number): { comments: Comment[]; hasMore: boolean } {
  const all = getTrack(trackId).filter((c) => !c.parentId)
  const end = (page + 1) * PAGE_SIZE
  return {
    comments: all.slice(0, end),
    hasMore: end < all.length,
  }
}

export function getReplies(trackId: string, parentId: string): Comment[] {
  return getTrack(trackId).filter((c) => c.parentId === parentId)
}

export function addComment(trackId: string, author: string, text: string, parentId?: string): Comment {
  const comment: Comment = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    trackId,
    author,
    text,
    timestamp: Date.now(),
    parentId,
    likes: [],
    dislikes: [],
  }
  const all = cache[trackId] ?? []
  all.push(comment)
  cache = { ...cache, [trackId]: all }
  emit()
  return comment
}

export function deleteComment(trackId: string, commentId: string): void {
  mutateTrack(trackId, (all) => all.filter((c) => c.id !== commentId && c.parentId !== commentId))
}

export function toggleLike(trackId: string, commentId: string, username: string): void {
  mutateTrack(trackId, (all) =>
    all.map((c) => {
      if (c.id !== commentId) return c
      const likes = c.likes.includes(username)
        ? c.likes.filter((u) => u !== username)
        : [...c.likes, username]
      const dislikes = c.dislikes.filter((u) => u !== username)
      return { ...c, likes, dislikes }
    }),
  )
}

export function toggleDislike(trackId: string, commentId: string, username: string): void {
  mutateTrack(trackId, (all) =>
    all.map((c) => {
      if (c.id !== commentId) return c
      const dislikes = c.dislikes.includes(username)
        ? c.dislikes.filter((u) => u !== username)
        : [...c.dislikes, username]
      const likes = c.likes.filter((u) => u !== username)
      return { ...c, likes, dislikes }
    }),
  )
}

export function useComments(trackId: string): Comment[] {
  return useSyncExternalStore(
    subscribe,
    () => (cache[trackId] ?? []).filter((c) => !c.parentId),
  )
}