import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '../utils/useTranslation'
import {
  fetchFollowers,
  fetchFollowing,
  followUser,
  unfollowUser,
  type FollowEntryDto,
  type PaginatedFollowList,
} from '../services/profiles'
import { openProfile } from '../store/profiles'
import { useAuth } from '../store/auth'
import './UserListModal.css'

interface UserListModalProps {
  username: string
  type: 'followers' | 'following'
  onClose: () => void
}

export default function UserListModal({ username, type, onClose }: UserListModalProps): JSX.Element {
  const { t } = useTranslation()
  const auth = useAuth()
  const [data, setData] = useState<PaginatedFollowList | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [allItems, setAllItems] = useState<FollowEntryDto[]>([])
  const [pendingFollows, setPendingFollows] = useState<Set<string>>(new Set())

  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true)
    const fetchFn = type === 'followers' ? fetchFollowers : fetchFollowing
    const result = await fetchFn(username, pageNum, 30)
    if (result) {
      setData(result)
      if (pageNum === 1) {
        setAllItems(result.items)
      } else {
        setAllItems((prev) => [...prev, ...result.items])
      }
    }
    setLoading(false)
  }, [username, type])

  useEffect(() => {
    fetchPage(1)
  }, [fetchPage])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const totalPages = data?.totalPages ?? 1
  const hasMore = page < totalPages

  const handleLoadMore = (): void => {
    const next = page + 1
    setPage(next)
    fetchPage(next)
  }

  const handleFollowToggle = async (entry: FollowEntryDto): Promise<void> => {
    if (pendingFollows.has(entry.username)) return

    setPendingFollows((prev) => new Set(prev).add(entry.username))
    setAllItems((prev) =>
      prev.map((e) =>
        e.username === entry.username ? { ...e, isFollowing: !e.isFollowing } : e,
      ),
    )

    if (entry.isFollowing) {
      await unfollowUser(entry.username)
    } else {
      await followUser(entry.username)
    }

    setPendingFollows((prev) => {
      const next = new Set(prev)
      next.delete(entry.username)
      return next
    })
  }

  const handleUserClick = (entry: FollowEntryDto): void => {
    const currentUsername = auth.user?.username
    if (currentUsername && entry.username === currentUsername) {
      onClose()
      return
    }
    openProfile(entry.username)
    onClose()
  }

  const title = type === 'followers' ? t('account.followersList') : t('account.followingList')

  return (
    <div className="user-list-modal__backdrop" onClick={onClose}>
      <div className="user-list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="user-list-modal__header">
          <span className="user-list-modal__title">{title}</span>
          <span className="user-list-modal__count">
            {data ? data.totalCount.toLocaleString() : '…'}
          </span>
          <button className="user-list-modal__close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="user-list-modal__body">
          {allItems.length === 0 && !loading && (
            <div className="user-list-modal__empty">
              {t('account.userListEmpty')}
            </div>
          )}

          {allItems.map((entry) => (
            <div key={entry.id} className="user-list-modal__row">
              <button
                className="user-list-modal__user"
                onClick={() => handleUserClick(entry)}
              >
                <div className="user-list-modal__avatar">
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt="" />
                  ) : (
                    <span className="user-list-modal__avatar-letter">
                      {entry.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="user-list-modal__info">
                  <span className="user-list-modal__username">@{entry.username}</span>
                  {entry.isMutual && (
                    <span className="user-list-modal__mutual">{t('account.mutual')}</span>
                  )}
                </div>
              </button>

              {auth.accessToken && auth.user?.username !== entry.username && (
                <button
                  className={`user-list-modal__follow-btn${entry.isFollowing ? ' user-list-modal__follow-btn--following' : ''}`}
                  onClick={() => handleFollowToggle(entry)}
                  disabled={pendingFollows.has(entry.username)}
                >
                  {entry.isFollowing ? t('profile.following') : t('profile.follow')}
                </button>
              )}
            </div>
          ))}

          {loading && (
            <div className="user-list-modal__loading">
              <div className="user-list-modal__spinner" />
            </div>
          )}
        </div>

        {hasMore && !loading && (
          <div className="user-list-modal__footer">
            <button className="user-list-modal__load-more" onClick={handleLoadMore}>
              {t('common.more')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
