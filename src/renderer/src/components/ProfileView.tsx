import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from '../utils/useTranslation'
import {
  useProfileState,
  fetchProfile as fetchProfileStore,
  followProfile,
  unfollowProfile,
  closeProfile,
  isFollowingPending,
} from '../store/profiles'
import { useAuth } from '../store/auth'
import { getVerificationTier, getVerificationTooltip, decodeBadges, getBadges } from '../utils/badges'
import { fetchUserPlaylists } from '../services/profiles'
import type { PlaylistSummaryDto } from '../services/profiles'
import { getProfile } from '../store/profile'
import Tooltip from './Tooltip'
import UserListModal from './UserListModal'
import './ProfileView.css'

/* Deterministic pastel gradient from a string. */
function hashGradient(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i)
    h |= 0
  }
  const h1 = ((h % 360) + 360) % 360
  const h2 = (h1 + 40 + ((h >> 8) % 60)) % 360
  return `linear-gradient(135deg, hsl(${h1}, 55%, 35%), hsl(${h2}, 50%, 25%))`
}

function ProfileView(): JSX.Element {
  const { t } = useTranslation()
  const { viewing, cache } = useProfileState()
  const auth = useAuth()
  const [loading, setLoading] = useState(false)

  // Public playlists
  const [playlists, setPlaylists] = useState<PlaylistSummaryDto[]>([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)

  // User list modal (followers / following)
  const [userListType, setUserListType] = useState<'followers' | 'following' | null>(null)

  const profile = viewing ? cache[viewing] : null
  const isOwnProfile = auth.user && viewing === auth.user.username

  // Fire profile fetch immediately — never blocks rendering
  useEffect(() => {
    if (!viewing) return
    if (cache[viewing]) return
    setLoading(true)
    fetchProfileStore(viewing).finally(() => setLoading(false))
  }, [viewing])

  // Fetch public playlists when profile is available
  useEffect(() => {
    if (!profile) {
      setPlaylists([])
      return
    }
    setPlaylistsLoading(true)
    fetchUserPlaylists(profile.username)
      .then((r) => setPlaylists(r?.items ?? []))
      .catch(() => setPlaylists([]))
      .finally(() => setPlaylistsLoading(false))
  }, [profile])

  const bannerGradient = useMemo(() => {
    return profile
      ? hashGradient(profile.id)
      : 'linear-gradient(135deg, #1a1a2e, #16213e)'
  }, [profile])

  const avatarInitial = useMemo(() => {
    if (profile?.avatarUrl) return null
    const name = profile?.username || viewing || '?'
    return name.charAt(0).toUpperCase()
  }, [profile, viewing])

  if (!viewing) {
    return (
      <div className="profile-view view-enter">
        <div className="profile-view__error">{t('profile.notFound')}</div>
      </div>
    )
  }

  const tier = profile && profile.verificationLevel >= 1
    ? getVerificationTier(profile.verificationLevel)
    : null

  const followingPending = isFollowingPending(viewing)
  const badgeIds = profile ? decodeBadges(profile.badgesMask) : []
  const badges = getBadges(badgeIds)

  return (
    <div className="profile-view view-enter">
      {/* Banner — always visible */}
      <div className="profile-view__banner">
        <div
          className="profile-view__banner-gradient"
          style={{ background: bannerGradient }}
        />
        <div className="profile-view__banner-overlay" />
        <button className="profile-view__back" onClick={closeProfile}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('common.back')}
        </button>
      </div>

      {/* Profile header */}
      <div className="profile-view__profile">
        <div className="profile-view__avatar">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" />
          ) : (
            <div className="profile-view__avatar-placeholder">
              <span className="profile-view__avatar-initial">{avatarInitial}</span>
            </div>
          )}
        </div>

        <div className="profile-view__header-info">
          <div className="profile-view__header-name-row">
            <span className="profile-view__header-username">
              @{profile?.username ?? viewing ?? '…'}
            </span>
            {tier && profile && (
              <Tooltip text={getVerificationTooltip(profile.verificationLevel, getProfile().language)}>
                <span className="profile-view__header-badge" style={{ color: tier.color }}>
                  <svg width="18" height="18" viewBox="0 0 22 22" fill="currentColor">
                    <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                  </svg>
                </span>
              </Tooltip>
            )}
          </div>
          <div className="profile-view__header-id">{profile?.id ?? '…'}</div>
          {profile?.bio && (
            <p className="profile-view__header-bio">{profile.bio}</p>
          )}
        </div>
      </div>

      <div className="profile-view__content">
        {/* Stats cards */}
        <div className="profile-view__cards">
          <div
            className="profile-view__card profile-view__card--clickable"
            style={{ animationDelay: '0.02s' }}
            onClick={() => setUserListType('followers')}
          >
            <div className="profile-view__card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="profile-view__card-label">{t('profile.followers')}</span>
            <span className="profile-view__card-value profile-view__card-value--mutual">
              {profile ? profile.followersCount.toLocaleString() : '…'}
              {profile?.isMutual && (
                <>
                  <span className="profile-view__mutual-dot" />
                  <span className="profile-view__mutual-label">Mutual</span>
                </>
              )}
            </span>
          </div>
          <div
            className="profile-view__card profile-view__card--clickable"
            style={{ animationDelay: '0.06s' }}
            onClick={() => setUserListType('following')}
          >
            <div className="profile-view__card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <span className="profile-view__card-label">{t('profile.following')}</span>
            <span className="profile-view__card-value">{profile ? profile.followingCount.toLocaleString() : '…'}</span>
          </div>
          <div className="profile-view__card" style={{ animationDelay: '0.10s' }}>
            <div className="profile-view__card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </div>
            <span className="profile-view__card-label">{t('profile.playlists')}</span>
            <span className="profile-view__card-value">{profile ? profile.publicPlaylistsCount.toLocaleString() : '…'}</span>
          </div>
          <div className="profile-view__card" style={{ animationDelay: '0.14s' }}>
            <div className="profile-view__card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <span className="profile-view__card-label">{t('profile.tracks')}</span>
            <span className="profile-view__card-value">{profile ? profile.libraryTracksCount.toLocaleString() : '…'}</span>
          </div>
          {tier && profile && (
            <div className="profile-view__card" style={{ animationDelay: '0.18s' }}>
              <div className="profile-view__card-icon" style={{ color: tier.color, background: `${tier.color}18` }}>
                <svg width="16" height="16" viewBox="0 0 22 22" fill="currentColor">
                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                </svg>
              </div>
              <span className="profile-view__card-label">{t('profile.verification')}</span>
              <Tooltip text={getVerificationTooltip(profile.verificationLevel, getProfile().language)}>
                <span className="profile-view__card-value" style={{ color: tier.color }}>
                  {tier.label}
                </span>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Follow button */}
        {!isOwnProfile && auth.accessToken && profile && (
          <div className="profile-view__actions">
            <button
              className={`profile-view__follow-btn${profile.isFollowing ? ' profile-view__follow-btn--following' : ' profile-view__follow-btn--follow'}${followingPending ? ' profile-view__follow-btn--loading' : ''}`}
              onClick={() => {
                if (profile.isFollowing) unfollowProfile(viewing)
                else followProfile(viewing)
              }}
              disabled={followingPending}
            >
              {followingPending ? (
                <div className="profile-view__spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              ) : profile.isFollowing ? (
                <>
                  <span className="profile-view__follow-label">{t('profile.following')}</span>
                  <span className="profile-view__unfollow-label">{t('profile.unfollow')}</span>
                </>
              ) : (
                <>{t('profile.follow')}</>
              )}
            </button>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="profile-view__section">
            <div className="profile-view__section-header">
              <span className="profile-view__section-title">{t('profile.badges')}</span>
              <span className="profile-view__section-line" />
            </div>
            <div className="profile-view__badges">
              {badges.map((b) => (
                <div key={b.id} className="profile-view__badge" title={b.description}>
                  <span className="profile-view__badge-emoji">{b.emoji}</span>
                  <div className="profile-view__badge-body">
                    <span className="profile-view__badge-label">{b.label}</span>
                    <span className="profile-view__badge-desc">{b.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public playlists */}
        <div className="profile-view__section">
          <div className="profile-view__section-header">
            <span className="profile-view__section-title">{t('account.playlistsSection')}</span>
            <span className="profile-view__section-line" />
          </div>
          {playlistsLoading ? (
            <div className="profile-view__section-loading">
              <div className="profile-view__spinner-mini" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="profile-view__section-empty">{t('account.noPlaylists')}</div>
          ) : (
            <div className="profile-view__playlist-grid">
              {playlists.map((pl) => (
                <div key={pl.id} className="profile-view__playlist-card">
                  <div
                    className="profile-view__playlist-cover"
                    style={pl.imageUrl ? { backgroundImage: `url(${pl.imageUrl})` } : undefined}
                  >
                    {!pl.imageUrl && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    )}
                  </div>
                  <div className="profile-view__playlist-body">
                    <span className="profile-view__playlist-title">{pl.title}</span>
                    <span className="profile-view__playlist-meta">
                      {pl.trackCount} {t('account.tracksLabel')}
                      {pl.isPublic === false && (
                        <span className="profile-view__playlist-visibility">Private</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User list modal */}
      {userListType && profile && (
        <UserListModal
          username={profile.username}
          type={userListType}
          onClose={() => setUserListType(null)}
        />
      )}
    </div>
  )
}

export default ProfileView