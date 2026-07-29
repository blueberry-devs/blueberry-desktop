import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { VList, type VListHandle } from 'virtua'
import { usePlayer } from '../player/PlayerContext'
import { useTranslation } from '../utils/useTranslation'
import { isAuthenticated, openAuth, getAuth } from '../store/auth'
import Modal from './Modal'
import Tooltip from './Tooltip'
import {
  getComments,
  getAllComments,
  addComment,
  deleteComment,
  toggleLike,
  getCommentCount,
  loadCommentsFromServer,
  loadMoreCommentsFromServer,
  loadRepliesFromServer,
  loadMoreRepliesFromServer,
  areRepliesLoaded,
  hasMoreReplyPages,
  hasServerFetched,
  hasMoreServerPages,
  useCommentsRev,
  type Comment,
} from '../store/messages'
import { getVerificationTier, getVerificationTooltip } from '../utils/badges'
import { getProfile } from '../store/profile'
import './CommentsFullscreen.css'

/* ========== Helpers ========== */

const _avatarColors = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#f97316', '#ef4444', '#14b8a6', '#a855f7',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return _avatarColors[Math.abs(hash) % _avatarColors.length]
}

function avatarLetter(name: string): string {
  return name.charAt(0).toUpperCase()
}

function formatTime(ts: number, t: (k: string) => string): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('comments.justNow')
  if (mins < 60) return t('comments.minutesAgo').replace('{n}', String(mins))
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('comments.hoursAgo').replace('{n}', String(hours))
  const days = Math.floor(hours / 24)
  if (days < 7) return t('comments.daysAgo').replace('{n}', String(days))
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(ts)
}

/* ========== Component ========== */

function CommentsFullscreen(): JSX.Element | null {
  const { commentsTrack, closeComments } = usePlayer()
  const { t } = useTranslation()

  const [closing, setClosing] = useState(false)
  const [replyTo, setReplyTo] = useState<{ parentId: string; author: string } | null>(null)
  const [input, setInput] = useState('')
  const [serverLoading, setServerLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const vlistRef = useRef<VListHandle>(null)
  const loadingMoreRef = useRef(false)

  const handleClose = useCallback((): void => {
    if (closing) return
    setClosing(true)
    setTimeout(() => closeComments(), 250)
  }, [closing, closeComments])

  // Capture-phase Escape interception
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        if (replyTo) {
          setReplyTo(null)
          setInput('')
          return
        }
        return
      }
      e.stopImmediatePropagation()
      handleClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closeComments, replyTo, handleClose])

  const trackId = commentsTrack?.id
  const authed = isAuthenticated()
  const currentUserId = getAuth().user?.id ?? ''
  const currentUser = getAuth().user?.username ?? getAuth().user?.email ?? ''

  // All top-level comments (VList handles virtualisation)
  const allComments: Comment[] = trackId ? getComments(trackId) : []
  const totalComments = trackId ? getCommentCount(trackId) : 0

  // Reactively update from store
  useCommentsRev(trackId ?? '')

  // Build reply tree for each root comment
  const allTrackComments = trackId ? getAllComments(trackId) : []

  function buildReplyTree(
    rootId: string,
    allComments: Comment[],
    commentsMap: Map<string, Comment>,
    depth: number = 1,
  ): ReplyNode[] {
    return allComments
      .filter((c) => c.parentId === rootId)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((c) => ({
        comment: c,
        children: buildReplyTree(c.id, allComments, commentsMap, depth + 1),
        indentLevel: Math.min(depth, 2) - 1,
      }))
  }

  const replyTreeMap = useMemo(() => {
    const map = new Map<string, ReplyNode[]>()
    if (!trackId) return map
    const commentsMap = new Map(allTrackComments.map((c) => [c.id, c]))
    for (const c of allTrackComments) {
      if (c.parentId) continue
      map.set(c.id, buildReplyTree(c.id, allTrackComments, commentsMap))
    }
    return map
  }, [allTrackComments, trackId])

  // Initial load: show local then fetch server
  useEffect(() => {
    if (!trackId) return
    setReplyTo(null)
    setInput('')
    setServerLoading(true)

    if (!hasServerFetched(trackId)) {
      loadCommentsFromServer(trackId)
        .catch(() => {})
        .finally(() => {
          setServerLoading(false)
        })
    } else {
      setServerLoading(false)
    }
  }, [trackId])

  const hasMoreServer = trackId ? hasMoreServerPages(trackId) : false

  // VList scroll handler: load more when near bottom
  const handleScroll = useCallback((_offset: number): void => {
    if (!hasMoreServer || loadingMoreRef.current || !vlistRef.current) return
    const vs = vlistRef.current.viewportSize
    const ss = vlistRef.current.scrollSize
    const off = vlistRef.current.scrollOffset
    if (off + vs >= ss - 500) {
      loadingMoreRef.current = true
      loadMoreCommentsFromServer(trackId ?? '').finally(() => {
        loadingMoreRef.current = false
      })
    }
  }, [hasMoreServer, trackId])

  const handleSend = useCallback(async (): Promise<void> => {
    const text = input.trim()
    if (!text || !trackId || sending) return
    const localId = crypto.randomUUID()
    setSyncingIds((prev) => new Set(prev).add(localId))
    setSending(true)
    try {
      const comment = await addComment(trackId, currentUser || 'Anonymous', text, replyTo?.parentId, localId)
      setInput('')
      setReplyTo(null)
      // Scroll to top to see new comment
      vlistRef.current?.scrollTo(0)
    } finally {
      setSending(false)
      setSyncingIds((prev) => {
        const next = new Set(prev)
        next.delete(localId)
        return next
      })
      inputRef.current?.focus()
    }
  }, [input, trackId, sending, currentUser, replyTo])

  const handleReply = useCallback((commentId: string, author: string): void => {
    setReplyTo({ parentId: commentId, author })
    inputRef.current?.focus()
  }, [])

  const cancelReply = useCallback((): void => {
    setReplyTo(null)
    setInput('')
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Escape' && replyTo) {
      cancelReply()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend, replyTo, cancelReply])

  const handleDelete = useCallback((commentId: string): void => {
    setConfirmDelete(commentId)
  }, [])

  const handleConfirmDelete = useCallback(async (): Promise<void> => {
    if (!trackId || !confirmDelete) return
    const id = confirmDelete
    setConfirmDelete(null) // close modal
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await deleteComment(trackId, id)
      // Comment removed from cache by store — component re-renders without it
    } catch {
      // Server failed — remove deleting state, comment stays visible
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [trackId, confirmDelete])

  const handleCancelDelete = useCallback((): void => {
    setConfirmDelete(null)
  }, [])

  const handleLike = useCallback(async (commentId: string): Promise<void> => {
    if (!trackId) return
    await toggleLike(trackId, commentId)
  }, [trackId])

  if (!commentsTrack) return null

  return (
    <motion.div
      className="comments-fullscreen"
      initial={{ opacity: 0, y: 40 }}
      animate={closing ? { opacity: 0, y: 60 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {commentsTrack.cover && (
        <div
          className="comments-fullscreen__bg"
          style={{ backgroundImage: `url(${commentsTrack.cover})` }}
        />
      )}
      <div className="comments-fullscreen__scrim" />

      <button className="comments-fullscreen__close" onClick={handleClose}>
        <svg width="18" height="18" viewBox="0 0 8 18" fill="none">
          <path d="M7 1l-6 8 6 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="comments-fullscreen__layout">
        {/* ===== Left sidebar ===== */}
        <div className="comments-fullscreen__sidebar">
          <div className="comments-fullscreen__cover">
            {commentsTrack.cover ? (
              <img src={commentsTrack.cover} alt="" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}
          </div>
          <div className="comments-fullscreen__track-title">{commentsTrack.title}</div>
          <div className="comments-fullscreen__track-artist">{commentsTrack.artists.join(', ')}</div>
          <div className="comments-fullscreen__track-meta">
            {totalComments} {totalComments === 1 ? t('comments.commentOne') : t('comments.commentMany')}
          </div>
        </div>

        {/* ===== Right panel ===== */}
        <div className="comments-fullscreen__main">
          {/* Header */}
          <div className="comments-fullscreen__header">
            <span className="comments-fullscreen__header-title">{t('comments.title')}</span>
            {totalComments > 0 && (
              <span className="comments-fullscreen__header-count">{totalComments}</span>
            )}
          </div>

          {/* Comments list with virtual scroll */}
          <div className="comments-fullscreen__list">
            {serverLoading && allComments.length === 0 ? (
              <div className="comments-fullscreen__loading">
                <div className="comments-fullscreen__skeleton" />
                <div className="comments-fullscreen__skeleton" />
                <div className="comments-fullscreen__skeleton" />
              </div>
            ) : allComments.length === 0 ? (
              <div className="comments-fullscreen__empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="comments-fullscreen__empty-icon">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>{t('comments.empty')}</span>
              </div>
            ) : (
              <VList
                ref={vlistRef}
                data={allComments}
                onScroll={handleScroll}
                style={{ height: '100%' }}
              >
                {(comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    replyNodes={replyTreeMap.get(comment.id) ?? []}
                    trackId={trackId!}
                    authed={authed}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onDelete={handleDelete}
                    onLike={handleLike}
                    deletingIds={deletingIds}
                    syncingIds={syncingIds}
                    t={t}
                  />
                )}
              </VList>
            )}
            {hasMoreServer && loadingMoreRef.current && (
              <div className="comments-fullscreen__loading-more" />
            )}
          </div>

          {/* Input at bottom */}
          {authed ? (
            <div className="comments-fullscreen__input-area">
              {replyTo && (
                <div className="comments-fullscreen__replying">
                  <span className="comments-fullscreen__replying-text">
                    {t('comments.replyingTo')} <strong>@{replyTo.author}</strong>
                  </span>
                  <button className="comments-fullscreen__replying-cancel" onClick={cancelReply}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="comments-fullscreen__form">
                <textarea
                  ref={inputRef}
                  className="comments-fullscreen__input"
                  placeholder={replyTo ? `${t('comments.reply')} @${replyTo.author}` : t('comments.placeholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={sending}
                />
                <button
                  className="comments-fullscreen__send-btn"
                  disabled={!input.trim() || sending}
                  onClick={handleSend}
                  title={t('comments.send')}
                >
                  {sending ? (
                    <span className="comments-fullscreen__sending-spinner" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2 11 13" />
                      <path d="M22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="comments-fullscreen__login-msg">
              <button onClick={openAuth}>{t('comments.loginRequired')}</button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={confirmDelete !== null}
        title={t('comments.deleteTitle')}
        message={t('comments.deleteMessage')}
        confirmLabel={t('comments.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </motion.div>
  )
}

/* ========== Comment Row ========== */

function CommentRow({
  comment,
  replyNodes,
  trackId,
  authed,
  currentUserId,
  onReply,
  onDelete,
  onLike,
  deletingIds,
  syncingIds,
  t,
}: {
  comment: Comment
  replyNodes: ReplyNode[]
  trackId: string
  authed: boolean
  currentUserId: string
  onReply: (commentId: string, author: string) => void
  onDelete: (id: string) => void
  onLike: (id: string) => void
  deletingIds: Set<string>
  syncingIds: Set<string>
  t: (k: string) => string
}): JSX.Element {
  const isOwner = authed && currentUserId && (currentUserId === comment.authorId)
  const liked = authed && comment.isLikedByMe
  const [showReplies, setShowReplies] = useState(false)
  const [repliesLoading, setRepliesLoading] = useState(false)
  const repliesLoaded = areRepliesLoaded(comment.id)
  const hasMoreReplies = hasMoreReplyPages(comment.id)
  const deleting = deletingIds.has(comment.id)
  const syncing = syncingIds.has(comment.id)
  const deletingOrSyncing = deleting || syncing
  const hasReplies = replyNodes.length > 0

  // Total reply count including all descendants
  function countNodes(nodes: ReplyNode[]): number {
    let n = 0
    for (const node of nodes) n += 1 + countNodes(node.children)
    return n
  }
  const totalReplies = hasReplies ? countNodes(replyNodes) : 0

  const handleToggleReplies = useCallback(() => {
    if (!showReplies && !repliesLoaded && trackId) {
      setRepliesLoading(true)
      loadRepliesFromServer(trackId, comment.id)
        .catch(() => {})
        .finally(() => setRepliesLoading(false))
    }
    setShowReplies((s) => !s)
  }, [showReplies, repliesLoaded, trackId, comment.id])

  const handleLoadMoreReplies = useCallback(() => {
    if (!trackId) return
    setRepliesLoading(true)
    loadMoreRepliesFromServer(trackId, comment.id)
      .catch(() => {})
      .finally(() => setRepliesLoading(false))
  }, [trackId, comment.id])

  return (
    <div className="comments-fullscreen__comment-wrap">
      <div
        className={`comments-fullscreen__comment${deleting ? ' comments-fullscreen__comment--deleting' : ''}${syncing ? ' comments-fullscreen__comment--syncing' : ''}`}
      >
        {deleting && <div className="comments-fullscreen__comment-overlay"><span className="comments-fullscreen__sending-spinner" /></div>}
        <div
          className="comments-fullscreen__avatar"
          style={{
            background: comment.avatarUrl ? 'transparent' : avatarColor(comment.author),
          }}
        >
          {comment.avatarUrl ? (
            <img className="comments-fullscreen__avatar-img" src={comment.avatarUrl} alt="" />
          ) : (
            avatarLetter(comment.author)
          )}
        </div>
        <div className="comments-fullscreen__comment-body">
          <div className="comments-fullscreen__comment-header">
            <span className="comments-fullscreen__comment-author">
              {comment.author}
              {comment.verificationLevel >= 1 && (
                <Tooltip text={getVerificationTooltip(comment.verificationLevel, getProfile().language)}>
                <span className="comments-fullscreen__verification-badge">
                  <svg width="12" height="12" viewBox="0 0 22 22" fill={getVerificationTier(comment.verificationLevel).color}>
                    <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                  </svg>
                </span>
                </Tooltip>
              )}
            </span>
            <span className="comments-fullscreen__comment-time">
              {syncing ? (
                <span className="comments-fullscreen__syncing-badge">
                  <span className="comments-fullscreen__sending-spinner" />
                  {t('comments.sending')}
                </span>
              ) : (
                formatTime(comment.timestamp, t)
              )}
            </span>
          </div>
          <div className="comments-fullscreen__comment-text">{comment.text}</div>
          {!deletingOrSyncing && (
            <div className="comments-fullscreen__comment-actions">
              <button
                className={`comments-fullscreen__action${liked ? ' comments-fullscreen__action--liked' : ''}`}
                onClick={() => onLike(comment.id)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14Z" />
                </svg>
                {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
              </button>
              {authed && (
                <button className="comments-fullscreen__action" onClick={() => onReply(comment.id, comment.author)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 9 9 15 15 21" />
                  </svg>
                  {t('comments.reply')}
                </button>
              )}
              {isOwner && (
                <button className="comments-fullscreen__action comments-fullscreen__action--danger" onClick={() => onDelete(comment.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  {t('comments.delete')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply toggle — show count from server replyCount */}
      {(hasReplies || comment.replyCount > 0) && (
        <div className="comments-fullscreen__replies-toggle">
          <button className="comments-fullscreen__replies-btn" onClick={handleToggleReplies} disabled={repliesLoading}>
            <span className="comments-fullscreen__replies-line" />
            {repliesLoading ? (
              <span className="comments-fullscreen__sending-spinner" style={{ width: 12, height: 12 }} />
            ) : showReplies ? (
              t('comments.hideReplies')
            ) : (
              t('comments.showReplies').replace('{n}', String(totalReplies || comment.replyCount || 0))
            )}
          </button>
        </div>
      )}

      {showReplies && (replyNodes.length > 0 || repliesLoading) && (
        <div className="comments-fullscreen__replies">
          {replyNodes.length > 0 && (
            <ReplyTree
              nodes={replyNodes}
              authed={authed}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
              onLike={onLike}
              deletingIds={deletingIds}
              syncingIds={syncingIds}
              t={t}
            />
          )}
          {hasMoreReplies && !repliesLoading && (
            <button className="comments-fullscreen__load-more" onClick={handleLoadMoreReplies}>
              {t('comments.showReplies').replace('{n}', '')}
            </button>
          )}
          {repliesLoading && (
            <div className="comments-fullscreen__replies-loading">
              <span className="comments-fullscreen__sending-spinner" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ========== Reply Tree (recursive threaded replies) ========== */

interface ReplyNode {
  comment: Comment
  children: ReplyNode[]
  indentLevel: number
}

function ReplyTree({
  nodes,
  authed,
  currentUserId,
  onReply,
  onDelete,
  onLike,
  deletingIds,
  syncingIds,
  t,
}: {
  nodes: ReplyNode[]
  authed: boolean
  currentUserId: string
  onReply: (commentId: string, author: string) => void
  onDelete: (id: string) => void
  onLike: (id: string) => void
  deletingIds: Set<string>
  syncingIds: Set<string>
  t: (k: string) => string
}): JSX.Element {
  const flatTree = useMemo(() => {
    const result: ReplyNode[] = []
    function walk(list: ReplyNode[]) {
      for (const n of list) {
        result.push(n)
        walk(n.children)
      }
    }
    walk(nodes)
    return result
  }, [nodes])

  return (
    <div className="comments-fullscreen__reply-tree">
      {flatTree.map((node) => (
        <TreeRow
          key={node.comment.id}
          node={node}
          authed={authed}
          currentUserId={currentUserId}
          onReply={onReply}
          onDelete={onDelete}
          onLike={onLike}
          deletingIds={deletingIds}
          syncingIds={syncingIds}
          t={t}
        />
      ))}
    </div>
  )
}

function TreeRow({
  node,
  authed,
  currentUserId,
  onReply,
  onDelete,
  onLike,
  deletingIds,
  syncingIds,
  t,
}: {
  node: ReplyNode
  authed: boolean
  currentUserId: string
  onReply: (commentId: string, author: string) => void
  onDelete: (id: string) => void
  onLike: (id: string) => void
  deletingIds: Set<string>
  syncingIds: Set<string>
  t: (k: string) => string
}): JSX.Element {
  const { comment, indentLevel } = node
  const isOwner = authed && currentUserId && (currentUserId === comment.authorId)
  const liked = authed && comment.isLikedByMe
  const deleting = deletingIds.has(comment.id)
  const syncing = syncingIds.has(comment.id)
  const deletingOrSyncing = deleting || syncing

  return (
    <div
      className={`comments-fullscreen__tree-row comments-fullscreen__tree-row--depth-${indentLevel}${deleting ? ' comments-fullscreen__comment--deleting' : ''}${syncing ? ' comments-fullscreen__comment--syncing' : ''}`}
    >
      {deleting && <div className="comments-fullscreen__comment-overlay"><span className="comments-fullscreen__sending-spinner" /></div>}
      {indentLevel >= 1 && <div className="comments-fullscreen__tree-line" />}
      <div
        className="comments-fullscreen__avatar comments-fullscreen__avatar--small"
        style={{ background: comment.avatarUrl ? 'transparent' : avatarColor(comment.author) }}
      >
        {comment.avatarUrl ? (
          <img className="comments-fullscreen__avatar-img" src={comment.avatarUrl} alt="" />
        ) : (
          avatarLetter(comment.author)
        )}
      </div>
      <div className="comments-fullscreen__comment-body">
        <div className="comments-fullscreen__comment-header">
          <span className="comments-fullscreen__comment-author">
            {comment.author}
            {comment.verificationLevel >= 1 && (
              <Tooltip text={getVerificationTooltip(comment.verificationLevel, getProfile().language)}>
              <span className="comments-fullscreen__verification-badge">
                <svg width="10" height="10" viewBox="0 0 22 22" fill={getVerificationTier(comment.verificationLevel).color}>
                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                </svg>
              </span>
              </Tooltip>
            )}
          </span>
          <span className="comments-fullscreen__comment-time">
            {syncing ? (
              <span className="comments-fullscreen__syncing-badge">
                <span className="comments-fullscreen__sending-spinner" />
                {t('comments.sending')}
              </span>
            ) : (
              formatTime(comment.timestamp, t)
            )}
          </span>
        </div>
        <div className="comments-fullscreen__comment-text">
          {comment.text}
        </div>
        {!deletingOrSyncing && (
          <div className="comments-fullscreen__comment-actions">
            <button
              className={`comments-fullscreen__action${liked ? ' comments-fullscreen__action--liked' : ''}`}
              onClick={() => onLike(comment.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14Z" />
              </svg>
              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
            </button>
            {authed && (
              <button className="comments-fullscreen__action" onClick={() => onReply(comment.id, comment.author)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 9 9 15 15 21" />
                </svg>
                {t('comments.reply')}
              </button>
            )}
            {isOwner && (
              <button className="comments-fullscreen__action comments-fullscreen__action--danger" onClick={() => onDelete(comment.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t('comments.delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CommentsFullscreen
