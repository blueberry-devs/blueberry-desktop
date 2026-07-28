import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { VList, type VListHandle } from 'virtua'
import { usePlayer } from '../player/PlayerContext'
import { useTranslation } from '../utils/useTranslation'
import { isAuthenticated, openAuth, getAuth } from '../store/auth'
import Modal from './Modal'
import {
  getComments,
  getReplies,
  addComment,
  deleteComment,
  toggleLike,
  getCommentCount,
  loadCommentsFromServer,
  loadMoreCommentsFromServer,
  hasServerFetched,
  hasMoreServerPages,
  useCommentsRev,
  type Comment,
} from '../store/messages'
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
      closeComments()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closeComments, replyTo])

  const trackId = commentsTrack?.id
  const authed = isAuthenticated()
  const currentUser = getAuth().user?.username ?? getAuth().user?.email ?? ''

  // All top-level comments (VList handles virtualisation)
  const allComments: Comment[] = trackId ? getComments(trackId) : []
  const totalComments = trackId ? getCommentCount(trackId) : 0

  // Reactively update from store
  useCommentsRev(trackId ?? '')

  // Build replies map
  const repliesMap = useMemo<Record<string, Comment[]>>(() => {
    if (!trackId) return {}
    const map: Record<string, Comment[]> = {}
    for (const c of allComments) {
      map[c.id] = getReplies(trackId, c.id)
    }
    return map
  }, [allComments, trackId])

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
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {commentsTrack.cover && (
        <div
          className="comments-fullscreen__bg"
          style={{ backgroundImage: `url(${commentsTrack.cover})` }}
        />
      )}
      <div className="comments-fullscreen__scrim" />

      <button className="comments-fullscreen__close" onClick={closeComments}>
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
                    replies={repliesMap[comment.id] ?? []}
                    trackId={trackId!}
                    authed={authed}
                    currentUser={currentUser}
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
  replies,
  trackId,
  authed,
  currentUser,
  onReply,
  onDelete,
  onLike,
  deletingIds,
  syncingIds,
  t,
}: {
  comment: Comment
  replies: Comment[]
  trackId: string
  authed: boolean
  currentUser: string
  onReply: (commentId: string, author: string) => void
  onDelete: (id: string) => void
  onLike: (id: string) => void
  deletingIds: Set<string>
  syncingIds: Set<string>
  t: (k: string) => string
}): JSX.Element {
  const isOwner = authed && (currentUser === comment.author)
  const liked = authed && comment.isLikedByMe
  const [showReplies, setShowReplies] = useState(false)
  const hasReplies = replies.length > 0
  const deleting = deletingIds.has(comment.id)
  const syncing = syncingIds.has(comment.id)
  const deletingOrSyncing = deleting || syncing

  return (
    <div className="comments-fullscreen__comment-wrap">
      <div
        className={`comments-fullscreen__comment${deleting ? ' comments-fullscreen__comment--deleting' : ''}${syncing ? ' comments-fullscreen__comment--syncing' : ''}`}
      >
        {deleting && <div className="comments-fullscreen__comment-overlay"><span className="comments-fullscreen__sending-spinner" /></div>}
        <div className="comments-fullscreen__avatar" style={{ background: avatarColor(comment.author) }}>
          {avatarLetter(comment.author)}
        </div>
        <div className="comments-fullscreen__comment-body">
          <div className="comments-fullscreen__comment-header">
            <span className="comments-fullscreen__comment-author">{comment.author}</span>
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

      {hasReplies && (
        <div className="comments-fullscreen__replies-toggle">
          <button className="comments-fullscreen__replies-btn" onClick={() => setShowReplies(!showReplies)}>
            <span className="comments-fullscreen__replies-line" />
            {showReplies
              ? t('comments.hideReplies')
              : t('comments.showReplies').replace('{n}', String(replies.length))}
          </button>
        </div>
      )}

      {hasReplies && showReplies && (
        <div className="comments-fullscreen__replies">
          {replies.slice(0, 5).map((reply) => (
            <ReplyRow
              key={reply.id}
              comment={reply}
              authed={authed}
              currentUser={currentUser}
              onDelete={onDelete}
              onLike={onLike}
              syncingIds={syncingIds}
              deletingIds={deletingIds}
              t={t}
            />
          ))}
          {replies.length > 5 && (
            <div className="comments-fullscreen__replies-more">
              {t('comments.moreReplies').replace('{n}', String(replies.length - 5))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ========== Reply Row ========== */

function ReplyRow({
  comment,
  authed,
  currentUser,
  onDelete,
  onLike,
  deletingIds,
  syncingIds,
  t,
}: {
  comment: Comment
  authed: boolean
  currentUser: string
  onDelete: (id: string) => void
  onLike: (id: string) => void
  deletingIds: Set<string>
  syncingIds: Set<string>
  t: (k: string) => string
}): JSX.Element {
  const isOwner = authed && (currentUser === comment.author)
  const liked = authed && comment.isLikedByMe
  const deleting = deletingIds.has(comment.id)
  const syncing = syncingIds.has(comment.id)
  const deletingOrSyncing = deleting || syncing

  return (
    <div
      className={`comments-fullscreen__comment comments-fullscreen__comment--reply${deleting ? ' comments-fullscreen__comment--deleting' : ''}${syncing ? ' comments-fullscreen__comment--syncing' : ''}`}
    >
      {deleting && <div className="comments-fullscreen__comment-overlay"><span className="comments-fullscreen__sending-spinner" /></div>}
      <div
        className="comments-fullscreen__avatar"
        style={{
          background: avatarColor(comment.author),
          width: 28,
          height: 28,
          fontSize: 11,
        }}
      >
        {avatarLetter(comment.author)}
      </div>
      <div className="comments-fullscreen__comment-body">
        <div className="comments-fullscreen__comment-header">
          <span className="comments-fullscreen__comment-author">{comment.author}</span>
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
