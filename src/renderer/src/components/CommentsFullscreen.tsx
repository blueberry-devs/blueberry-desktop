import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { usePlayer } from '../player/PlayerContext'
import { useTranslation } from '../utils/useTranslation'
import { isAuthenticated, openAuth } from '../store/auth'
import { getAuth } from '../store/auth'
import {
  getCommentsPage,
  getReplies,
  addComment,
  deleteComment,
  toggleLike,
  toggleDislike,
  type Comment,
} from '../store/messages'
import './CommentsFullscreen.css'

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
  return t('comments.daysAgo').replace('{n}', String(days))
}

function CommentsFullscreen(): JSX.Element | null {
  const { commentsTrack, closeComments } = usePlayer()
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [comments, setComments] = useState<Comment[]>([])
  const [repliesMap, setRepliesMap] = useState<Record<string, Comment[]>>({})
  const [hasMore, setHasMore] = useState(false)
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<{ parentId: string; author: string } | null>(null)
  const [translated, setTranslated] = useState<Record<string, boolean>>({})
  const sentinelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const trackId = commentsTrack?.id
  const authed = isAuthenticated()
  const currentUser = getAuth().user?.username ?? getAuth().user?.email ?? ''

  useEffect(() => {
    if (!trackId) return
    setPage(0)
    const res = getCommentsPage(trackId, 0)
    setComments(res.comments)
    setHasMore(res.hasMore)
    setTranslated({})
    setReplyTo(null)
    setInput('')
  }, [trackId])

  useEffect(() => {
    if (!trackId || page === 0) return
    const res = getCommentsPage(trackId, page)
    setComments((prev) => [...prev, ...res.comments])
    setHasMore(res.hasMore)
  }, [page, trackId])

  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPage((p) => p + 1)
      },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore])

  useEffect(() => {
    if (!trackId) return
    const map: Record<string, Comment[]> = {}
    for (const c of comments) {
      map[c.id] = getReplies(trackId, c.id)
    }
    setRepliesMap(map)
  }, [comments, trackId])

  const refreshComments = (): void => {
    if (!trackId) return
    setPage(0)
    const res = getCommentsPage(trackId, 0)
    setComments(res.comments)
    setHasMore(res.hasMore)
  }

  const handleSend = (): void => {
    const text = input.trim()
    if (!text || !trackId) return
    addComment(trackId, currentUser || 'Anonymous', text, replyTo?.parentId)
    setInput('')
    setReplyTo(null)
    refreshComments()
    inputRef.current?.focus()
  }

  const handleReply = (commentId: string, author: string): void => {
    setInput(`@${author} `)
    setReplyTo({ parentId: commentId, author })
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape' && replyTo) {
      setReplyTo(null)
      setInput('')
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDelete = (commentId: string): void => {
    if (!trackId) return
    deleteComment(trackId, commentId)
    refreshComments()
  }

  const handleLike = (commentId: string): void => {
    if (!trackId || !currentUser) return
    toggleLike(trackId, commentId, currentUser)
    refreshComments()
  }

  const handleDislike = (commentId: string): void => {
    if (!trackId || !currentUser) return
    toggleDislike(trackId, commentId, currentUser)
    refreshComments()
  }

  const handleTranslate = (commentId: string): void => {
    setTranslated((prev) => ({ ...prev, [commentId]: !prev[commentId] }))
  }

  if (!commentsTrack) return null

  return (
    <motion.div
      className="comments-fullscreen"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {commentsTrack.cover && (
        <div className="comments-fullscreen__bg" style={{ backgroundImage: `url(${commentsTrack.cover})` }} />
      )}
      <div className="comments-fullscreen__scrim" />

      <button className="comments-fullscreen__close" onClick={closeComments}>
        <svg width="18" height="18" viewBox="0 0 8 18" fill="none">
          <path d="M7 1l-6 8 6 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="comments-fullscreen__body">
        <div className="comments-fullscreen__left">
          <div className="comments-fullscreen__left-top">
            <div className="comments-fullscreen__cover">
              {commentsTrack.cover ? (
                <img src={commentsTrack.cover} alt="" />
              ) : (
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              )}
            </div>
            <div className="comments-fullscreen__title">{commentsTrack.title}</div>
            <div className="comments-fullscreen__artist">{commentsTrack.artists.join(', ')}</div>
          </div>

          {authed ? (
            <div className="comments-fullscreen__form-wrap">
              {replyTo && (
                <div className="comments-fullscreen__replying">
                  {t('comments.reply')} — @{replyTo.author}
                  <button onClick={() => { setReplyTo(null); setInput('') }}>
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
                  placeholder={replyTo ? `${t('comments.reply')}...` : t('comments.placeholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className="comments-fullscreen__send-btn"
                  disabled={!input.trim()}
                  onClick={handleSend}
                  title={t('comments.send')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="comments-fullscreen__login-msg">
              <button onClick={openAuth}>{t('comments.loginRequired')}</button>
            </div>
          )}
        </div>

        <div className="comments-fullscreen__right">
          {comments.length === 0 ? (
            <div className="comments-fullscreen__status">{t('comments.empty')}</div>
          ) : (
            comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                replies={repliesMap[comment.id] ?? []}
                trackId={trackId!}
                authed={authed}
                currentUser={currentUser}
                translated={translated}
                onTranslate={handleTranslate}
                onReply={handleReply}
                onDelete={handleDelete}
                onLike={handleLike}
                onDislike={handleDislike}
                t={t}
              />
            ))
          )}
          {hasMore && <div ref={sentinelRef} className="comments-fullscreen__sentinel" />}
        </div>
      </div>
    </motion.div>
  )
}

function CommentRow({
  comment,
  replies,
  trackId,
  authed,
  currentUser,
  translated,
  onTranslate,
  onReply,
  onDelete,
  onLike,
  onDislike,
  t,
}: {
  comment: Comment
  replies: Comment[]
  trackId: string
  authed: boolean
  currentUser: string
  translated: Record<string, boolean>
  onTranslate: (id: string) => void
  onReply: (commentId: string, author: string) => void
  onDelete: (id: string) => void
  onLike: (id: string) => void
  onDislike: (id: string) => void
  t: (k: string) => string
}): JSX.Element {
  const isOwner = authed && (currentUser === comment.author)
  const liked = authed && comment.likes.includes(currentUser)
  const disliked = authed && comment.dislikes.includes(currentUser)

  return (
    <>
      <div className="comments-fullscreen__comment">
        <div className="comments-fullscreen__avatar" style={{ background: avatarColor(comment.author) }}>
          {avatarLetter(comment.author)}
        </div>
        <div className="comments-fullscreen__comment-body">
          <div className="comments-fullscreen__comment-header">
            <span className="comments-fullscreen__comment-author">{comment.author}</span>
            <span className="comments-fullscreen__comment-time">{formatTime(comment.timestamp, t)}</span>
          </div>
          <div className="comments-fullscreen__comment-text">{comment.text}</div>
          <div className="comments-fullscreen__comment-actions">
            <button
              className={`comments-fullscreen__comment-action${liked ? ' comments-fullscreen__comment-action--liked' : ''}`}
              onClick={() => onLike(comment.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14Z" />
              </svg>
              {comment.likes.length > 0 && <span>{comment.likes.length}</span>}
            </button>
            <button
              className={`comments-fullscreen__comment-action${disliked ? ' comments-fullscreen__comment-action--disliked' : ''}`}
              onClick={() => onDislike(comment.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={disliked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10Z" />
              </svg>
              {comment.dislikes.length > 0 && <span>{comment.dislikes.length}</span>}
            </button>
            {authed && (
              <button className="comments-fullscreen__comment-action" onClick={() => onReply(comment.id, comment.author)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 9 9 15 15 21" />
                </svg>
                {t('comments.reply')}
              </button>
            )}
            {isOwner && (
              <button className="comments-fullscreen__comment-action comments-fullscreen__comment-action--danger" onClick={() => onDelete(comment.id)}>
                {t('comments.delete')}
              </button>
            )}
          </div>
        </div>
      </div>
      {replies.length > 0 && (
        <div className="comments-fullscreen__replies">
          {replies.map((reply) => (
            <ReplyRow
              key={reply.id}
              comment={reply}
              authed={authed}
              currentUser={currentUser}
              onDelete={onDelete}
              onLike={onLike}
              onDislike={onDislike}
              t={t}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ReplyRow({
  comment,
  authed,
  currentUser,
  onDelete,
  onLike,
  onDislike,
  t,
}: {
  comment: Comment
  authed: boolean
  currentUser: string
  onDelete: (id: string) => void
  onLike: (id: string) => void
  onDislike: (id: string) => void
  t: (k: string) => string
}): JSX.Element {
  const isOwner = authed && (currentUser === comment.author)
  const liked = authed && comment.likes.includes(currentUser)
  const disliked = authed && comment.dislikes.includes(currentUser)

  return (
    <div className="comments-fullscreen__comment comments-fullscreen__comment--reply">
      <div className="comments-fullscreen__avatar" style={{ background: avatarColor(comment.author), width: 28, height: 28, fontSize: 11 }}>
        {avatarLetter(comment.author)}
      </div>
      <div className="comments-fullscreen__comment-body">
        <div className="comments-fullscreen__comment-header">
          <span className="comments-fullscreen__comment-author">{comment.author}</span>
          <span className="comments-fullscreen__comment-time">{formatTime(comment.timestamp, t)}</span>
        </div>
        <div className="comments-fullscreen__comment-text">{comment.text}</div>
        <div className="comments-fullscreen__comment-actions">
          <button
            className={`comments-fullscreen__comment-action${liked ? ' comments-fullscreen__comment-action--liked' : ''}`}
            onClick={() => onLike(comment.id)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14Z" />
            </svg>
            {comment.likes.length > 0 && <span>{comment.likes.length}</span>}
          </button>
          <button
            className={`comments-fullscreen__comment-action${disliked ? ' comments-fullscreen__comment-action--disliked' : ''}`}
            onClick={() => onDislike(comment.id)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={disliked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10Z" />
            </svg>
            {comment.dislikes.length > 0 && <span>{comment.dislikes.length}</span>}
          </button>
          {isOwner && (
            <button className="comments-fullscreen__comment-action comments-fullscreen__comment-action--danger" onClick={() => onDelete(comment.id)}>
              {t('comments.delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommentsFullscreen