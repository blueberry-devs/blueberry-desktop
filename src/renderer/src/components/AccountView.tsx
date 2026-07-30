import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth, logout, openAuth, refreshProfile, updateAuthUser } from '../store/auth'
import { useTranslation } from '../utils/useTranslation'
import { getVerificationTier, getVerificationTooltip, getBadges, decodeBadges } from '../utils/badges'
import { getProfile } from '../store/profile'
import { updateProfile as apiUpdateProfile, fetchOwnProfile, fetchUserPlaylists } from '../services/profiles'
import type { ProfileDto, PlaylistSummaryDto } from '../services/profiles'
import Tooltip from './Tooltip'
import UserListModal from './UserListModal'
import './AccountView.css'

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/

/* Deterministic pastel gradient from a string (user ID). */
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

export default function AccountView(): JSX.Element {
  const auth = useAuth()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)

  // Full profile from /api/profiles/{username}
  const [fullProfile, setFullProfile] = useState<ProfileDto | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Public playlists
  const [playlists, setPlaylists] = useState<PlaylistSummaryDto[]>([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)

  // User list modal (followers / following)
  const [userListType, setUserListType] = useState<'followers' | 'following' | null>(null)

  useEffect(() => {
    refreshProfile()
  }, [])

  // Fetch own full profile when username is available
  const username = auth.user?.username
  useEffect(() => {
    if (!username) {
      setFullProfile(null)
      return
    }
    setProfileLoading(true)
    fetchOwnProfile(username)
      .then((p) => setFullProfile(p))
      .catch(() => { /* ignore */ })
      .finally(() => setProfileLoading(false))
  }, [username])

  // Fetch public playlists
  useEffect(() => {
    if (!username) {
      setPlaylists([])
      return
    }
    setPlaylistsLoading(true)
    fetchUserPlaylists(username)
      .then((r) => setPlaylists(r?.items ?? []))
      .catch(() => setPlaylists([]))
      .finally(() => setPlaylistsLoading(false))
  }, [username])

  const bannerGradient = useMemo(() => {
    return auth.user ? hashGradient(auth.user.id) : 'linear-gradient(135deg, #1a1a2e, #16213e)'
  }, [auth.user])

  // Reset editing state when user data changes or editing opens
  const startEditing = useCallback(() => {
    setEditUsername(auth.user?.username ?? '')
    setEditAvatar(auth.user?.avatarUrl ?? '')
    setEditBio(auth.user?.bio ?? '')
    setEditError('')
    setEditSuccess(false)
    setEditing(true)
  }, [auth.user])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setEditError('')
    setEditSuccess(false)
  }, [])

  const handleSave = useCallback(async () => {
    setEditError('')
    setEditSuccess(false)

    const username = editUsername.trim()
    const avatarUrl = editAvatar.trim() || null
    const bio = editBio.trim() || null

    // Validate username
    if (username.length > 0 && (username.length < 3 || username.length > 30)) {
      setEditError(t('profile.usernameInvalid'))
      return
    }
    if (username.length > 0 && !USERNAME_RE.test(username)) {
      setEditError(t('profile.usernameInvalid'))
      return
    }

    // Validate avatarUrl
    if (avatarUrl && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
      setEditError(t('profile.saveError'))
      return
    }

    setSaving(true)
    try {
      const result = await apiUpdateProfile({
        username: username || null,
        avatarUrl,
        bio,
      })
      if (result) {
        updateAuthUser(result)
        // Refresh full profile too
        if (username) {
          fetchOwnProfile(username).then((p) => {
            if (p) setFullProfile(p)
          }).catch(() => {})
        }
        setEditSuccess(true)
        setTimeout(() => setEditSuccess(false), 2000)
      } else {
        setEditError(t('profile.saveError'))
      }
    } catch {
      setEditError(t('profile.saveError'))
    } finally {
      setSaving(false)
    }
  }, [editUsername, editAvatar, editBio, t])

  // Avatar initial
  const avatarInitial = useMemo(() => {
    if (auth.user?.avatarUrl) return null
    const name = auth.user?.username || auth.user?.email || '?'
    return name.charAt(0).toUpperCase()
  }, [auth.user])

  // Merge auth data with full profile data for richer display
  const displayData = useMemo(() => {
    return {
      bio: fullProfile?.bio ?? auth.user?.bio ?? null,
      followersCount: fullProfile?.followersCount ?? 0,
      followingCount: fullProfile?.followingCount ?? 0,
      publicPlaylistsCount: fullProfile?.publicPlaylistsCount ?? 0,
      libraryTracksCount: fullProfile?.libraryTracksCount ?? 0,
    }
  }, [fullProfile, auth.user])

  if (!auth.user) {
    return (
      <div className="account-view">
        <div className="account-view__banner">
          <div
            className="account-view__banner-gradient"
            style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}
          />
          <div className="account-view__banner-overlay" />
        </div>
        <div className="account-view__empty">
          <div className="account-view__empty-icon">
            <svg width="36" height="36" viewBox="0 0 18 18" fill="none">
              <path d="M14 15.5v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </div>
          <h2 className="account-view__empty-title">{t('account.loginTitle')}</h2>
          <p className="account-view__empty-text">
            {t('account.loginHint')}
          </p>
          <button className="account-view__login-btn" onClick={openAuth}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {t('account.login')}
          </button>
        </div>
      </div>
    )
  }

  const tier = auth.user.verificationLevel >= 1
    ? getVerificationTier(auth.user.verificationLevel)
    : null

  const badgeIds = fullProfile ? decodeBadges(fullProfile.badgesMask) : decodeBadges(auth.user.badgesMask)
  const badges = getBadges(badgeIds)

  return (
    <div className="account-view view-enter">
      {/* Banner */}
      <div className="account-view__banner">
        <div
          className="account-view__banner-gradient"
          style={{ background: bannerGradient }}
        />
        <div className="account-view__banner-overlay" />
      </div>

      {/* Profile header */}
      <div className="account-view__profile">
        <div className="account-view__avatar">
          {auth.user.avatarUrl ? (
            <img src={auth.user.avatarUrl} alt="" />
          ) : (
            <div className="account-view__avatar-placeholder">
              <span className="account-view__avatar-initial">{avatarInitial}</span>
            </div>
          )}
        </div>

        <div className="account-view__header-info">
          <div className="account-view__header-name-row">
            <span className="account-view__header-email">
              {auth.user.username || auth.user.email}
            </span>
            {tier && (
              <Tooltip text={getVerificationTooltip(auth.user.verificationLevel, getProfile().language)}>
                <span
                  className="account-view__header-badge"
                  style={{ color: tier.color }}
                >
                  <svg width="18" height="18" viewBox="0 0 22 22" fill="currentColor">
                    <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                  </svg>
                </span>
              </Tooltip>
            )}
          </div>
          <div className="account-view__header-username">
            {auth.user.username && (
              <>@{auth.user.username} &middot; </>
            )}
            {auth.user.email}
          </div>
          {badges.length > 0 && (
            <div className="account-view__header-badges">
              {badges.map((badge) => (
                <Tooltip key={badge.id} text={`${badge.label} — ${badge.description}`}>
                  <span className="account-view__badge-icon">{badge.emoji}</span>
                </Tooltip>
              ))}
            </div>
          )}
          {displayData.bio && (
            <p className="account-view__header-bio">{displayData.bio}</p>
          )}
        </div>

        <div className="account-view__header-actions">
          <button
            className="account-view__header-btn"
            onClick={startEditing}
            title={t('profile.editProfile')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 1.5a2.1 2.1 0 0 1 3 3L5 14H2v-3l9.5-9.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="account-view__header-btn account-view__header-btn--danger"
            onClick={logout}
            title={t('account.logout')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="account-view__content">
        {/* Stat cards from full profile */}
        <div className="account-view__cards">
          <div
            className="account-view__card account-view__card--clickable"
            style={{ animationDelay: '0.02s' }}
            onClick={() => setUserListType('followers')}
          >
            <div className="account-view__card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="account-view__card-label">{t('account.followers')}</span>
            <span className="account-view__card-value">
              {profileLoading ? '…' : displayData.followersCount.toLocaleString()}
            </span>
          </div>
          <div
            className="account-view__card account-view__card--clickable"
            style={{ animationDelay: '0.06s' }}
            onClick={() => setUserListType('following')}
          >
            <div className="account-view__card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <span className="account-view__card-label">{t('account.following')}</span>
            <span className="account-view__card-value">
              {profileLoading ? '…' : displayData.followingCount.toLocaleString()}
            </span>
          </div>
          <div className="account-view__card" style={{ animationDelay: '0.10s' }}>
            <div className="account-view__card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </div>
            <span className="account-view__card-label">{t('account.publicPlaylists')}</span>
            <span className="account-view__card-value">
              {profileLoading ? '…' : displayData.publicPlaylistsCount.toLocaleString()}
            </span>
          </div>
          <div className="account-view__card" style={{ animationDelay: '0.14s' }}>
            <div className="account-view__card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <span className="account-view__card-label">{t('account.libraryTracks')}</span>
            <span className="account-view__card-value">
              {profileLoading ? '…' : displayData.libraryTracksCount.toLocaleString()}
            </span>
          </div>
          {tier && (
            <div className="account-view__card" style={{ animationDelay: '0.18s' }}>
              <div className="account-view__card-icon" style={{ color: tier.color, background: `${tier.color}18` }}>
                <svg width="16" height="16" viewBox="0 0 22 22" fill="currentColor">
                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                </svg>
              </div>
              <span className="account-view__card-label">{t('account.verification')}</span>
              <Tooltip text={getVerificationTooltip(auth.user.verificationLevel, getProfile().language)}>
                <span className="account-view__verification" style={{ color: tier.color }}>
                  {tier.label}
                </span>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Inline profile editor */}
        {editing && (
          <div className="account-view__edit">
            <div className="account-view__edit-inner">
              <div className="account-view__edit-header">
                <div className="account-view__edit-header-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1.5a2.1 2.1 0 0 1 3 3L5 14H2v-3l9.5-9.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="account-view__edit-header-text">{t('profile.editProfile')}</span>
              </div>

              <div className="account-view__edit-grid">
                <div className="account-view__edit-avatar-col">
                  <div className={`account-view__edit-avatar-preview${!editAvatar ? ' account-view__edit-avatar-preview--empty' : ''}`}>
                    {editAvatar ? (
                      <img src={editAvatar} alt="" />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
                        <path d="M14 15.5v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                        <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1" />
                      </svg>
                    )}
                  </div>
                  <span className="account-view__edit-avatar-label">{t('profile.avatarUrlLabel')}</span>
                </div>

                <div className="account-view__edit-fields">
                  <div className="account-view__edit-field">
                    <label className="account-view__edit-label">{t('profile.usernameLabel')}</label>
                    <div className="account-view__edit-input-wrap">
                      <input
                        className={`account-view__edit-input${editUsername.length > 0 ? ' account-view__edit-input--has-count' : ''}`}
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder={t('profile.usernameLabel')}
                        maxLength={30}
                        autoFocus
                      />
                      {editUsername.length > 0 && (
                        <span className="account-view__edit-char-count">{editUsername.length}/30</span>
                      )}
                    </div>
                    <p className="account-view__edit-hint">{t('profile.usernameHint')}</p>
                  </div>

                  <div className="account-view__edit-field">
                    <label className="account-view__edit-label">{t('profile.avatarUrlLabel')}</label>
                    <input
                      className="account-view__edit-input"
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      maxLength={2048}
                    />
                  </div>

                  <div className="account-view__edit-field">
                    <label className="account-view__edit-label">{t('account.bio')}</label>
                    <div className="account-view__edit-input-wrap">
                      <input
                        className={`account-view__edit-input${editBio.length > 0 ? ' account-view__edit-input--has-count' : ''}`}
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        placeholder={t('account.bio')}
                        maxLength={160}
                      />
                      {editBio.length > 0 && (
                        <span className="account-view__edit-char-count">{editBio.length}/160</span>
                      )}
                    </div>
                  </div>

                  {editError && (
                    <div className="account-view__edit-message account-view__edit-message--error">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      {editError}
                    </div>
                  )}
                  {editSuccess && (
                    <div className="account-view__edit-message account-view__edit-message--success">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      {t('profile.saveSuccess')}
                    </div>
                  )}
                </div>
              </div>

              <div className="account-view__edit-actions">
                <button className="account-view__edit-cancel" onClick={cancelEditing} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button className="account-view__edit-save" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <span className="account-view__edit-spinner" />
                  ) : (
                    t('common.save')
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Public playlists */}
        <div className="account-view__section">
          <div className="account-view__section-header">
            <span className="account-view__section-title">{t('account.playlistsSection')}</span>
            <span className="account-view__section-line" />
          </div>
          {playlistsLoading ? (
            <div className="account-view__section-loading">
              <div className="account-view__spinner-mini" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="account-view__section-empty">{t('account.noPlaylists')}</div>
          ) : (
            <div className="account-view__playlist-grid">
              {playlists.map((pl) => (
                <div key={pl.id} className="account-view__playlist-card">
                  <div
                    className="account-view__playlist-cover"
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
                  <div className="account-view__playlist-body">
                    <span className="account-view__playlist-title">{pl.title}</span>
                    <span className="account-view__playlist-meta">
                      {pl.trackCount} {t('account.tracksLabel')}
                      {pl.isPublic === false && (
                        <span className="account-view__playlist-visibility">Private</span>
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
      {userListType && (
        <UserListModal
          username={username!}
          type={userListType}
          onClose={() => setUserListType(null)}
        />
      )}
    </div>
  )
}