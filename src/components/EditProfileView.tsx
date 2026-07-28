import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../utils/useTranslation'
import { useAuth, updateAuthUser } from '../store/auth'
import { updateProfile as apiUpdateProfile } from '../services/profiles'
import './EditProfileView.css'

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

interface Props {
  onClose: () => void
  /** Fired after a successful save so the parent can refresh its data. */
  onSaved?: () => void
}

function EditProfileView({ onClose, onSaved }: Props): JSX.Element {
  const auth = useAuth()
  const { t } = useTranslation()

  const [displayName, setDisplayName] = useState(auth.user?.displayName ?? '')
  const [username, setUsername] = useState(auth.user?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(auth.user?.avatarUrl ?? '')
  const [bio, setBio] = useState(auth.user?.bio ?? '')
  const [avatarError, setAvatarError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const bannerGradient = useMemo(() => {
    return auth.user ? hashGradient(auth.user.id) : 'linear-gradient(135deg, #1a1a2e, #16213e)'
  }, [auth.user])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const handleSave = useCallback(async (): Promise<void> => {
    setError('')
    setSaved(false)

    const name = username.trim()
    const avatar = avatarUrl.trim() || null
    const about = bio.trim() || null
    const display = displayName.trim() || null

    if (name.length > 0 && (name.length < 3 || name.length > 30 || !USERNAME_RE.test(name))) {
      setError(t('profile.usernameInvalid'))
      return
    }
    if (avatar && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
      setError(t('profile.saveError'))
      return
    }

    setSaving(true)
    try {
      const result = await apiUpdateProfile({
        username: name || null,
        avatarUrl: avatar,
        bio: about,
        displayName: display,
      })
      if (result) {
        updateAuthUser(result)
        onSaved?.()
        setSaved(true)
        setTimeout(() => onClose(), 650)
      } else {
        setError(t('profile.saveError'))
      }
    } catch {
      setError(t('profile.saveError'))
    } finally {
      setSaving(false)
    }
  }, [username, avatarUrl, bio, displayName, onClose, onSaved, t])

  const avatarInitial = useMemo(() => {
    if (avatarUrl) return null
    const name = displayName.trim() || username.trim() || auth.user?.username || auth.user?.email || '?'
    return name.charAt(0).toUpperCase()
  }, [avatarUrl, displayName, username, auth.user])

  return (
    <div className="edit-profile-view view-enter">
      {/* Banner */}
      <div className="edit-profile-view__banner">
        <div className="edit-profile-view__banner-gradient" style={{ background: bannerGradient }} />
        <div className="edit-profile-view__banner-overlay" />
        <button className="edit-profile-view__back" onClick={onClose} disabled={saving}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('common.back')}
        </button>
        <div className="edit-profile-view__banner-title">
          <span className="edit-profile-view__banner-eyebrow">{t('account.title')}</span>
          <h1 className="edit-profile-view__banner-heading">{t('profile.editProfile')}</h1>
        </div>
      </div>

      {/* Form body */}
      <div className="edit-profile-view__body">
        <div className="edit-profile-view__card">
          <div className="edit-profile-view__avatar-side">
            <div className={`edit-profile-view__avatar${!avatarUrl ? ' edit-profile-view__avatar--empty' : ''}`}>
              {avatarUrl && !avatarError ? (
                <img src={avatarUrl} alt="" onError={() => setAvatarError(true)} onLoad={() => setAvatarError(false)} />
              ) : (
                <span className="edit-profile-view__avatar-initial">{avatarInitial}</span>
              )}
            </div>
            <span className="edit-profile-view__avatar-caption">{t('profile.avatarUrlLabel')}</span>
          </div>

          <div className="edit-profile-view__fields">
            <div className="edit-profile-view__field">
              <label className="edit-profile-view__label">{t('profile.displayNameLabel')}</label>
              <div className="edit-profile-view__input-wrap">
                <input
                  className={`edit-profile-view__input${displayName.length > 0 ? ' edit-profile-view__input--has-count' : ''}`}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('profile.displayNamePlaceholder')}
                  maxLength={40}
                  autoFocus
                />
                {displayName.length > 0 && (
                  <span className="edit-profile-view__char-count">{displayName.length}/40</span>
                )}
              </div>
              <p className="edit-profile-view__hint">{t('profile.displayNameHint')}</p>
            </div>

            <div className="edit-profile-view__field">
              <label className="edit-profile-view__label">{t('profile.usernameLabel')}</label>
              <div className="edit-profile-view__input-wrap">
                <input
                  className={`edit-profile-view__input${username.length > 0 ? ' edit-profile-view__input--has-count' : ''}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('profile.usernameLabel')}
                  maxLength={30}
                />
                {username.length > 0 && (
                  <span className="edit-profile-view__char-count">{username.length}/30</span>
                )}
              </div>
              <p className="edit-profile-view__hint">{t('profile.usernameHint')}</p>
            </div>

            <div className="edit-profile-view__field">
              <label className="edit-profile-view__label">{t('profile.avatarUrlLabel')}</label>
              <div className="edit-profile-view__input-wrap">
                <input
                  className="edit-profile-view__input"
                  value={avatarUrl}
                  onChange={(e) => { setAvatarUrl(e.target.value); setAvatarError(false) }}
                  placeholder="https://example.com/avatar.jpg"
                  maxLength={2048}
                />
              </div>
            </div>

            <div className="edit-profile-view__field">
              <label className="edit-profile-view__label">{t('account.bio')}</label>
              <div className="edit-profile-view__input-wrap">
                <textarea
                  className={`edit-profile-view__textarea${bio.length > 0 ? ' edit-profile-view__input--has-count' : ''}`}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('account.bio')}
                  maxLength={160}
                  rows={3}
                />
                {bio.length > 0 && (
                  <span className="edit-profile-view__char-count">{bio.length}/160</span>
                )}
              </div>
            </div>

            {error && (
              <div className="edit-profile-view__message edit-profile-view__message--error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}
            {saved && (
              <div className="edit-profile-view__message edit-profile-view__message--success">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {t('profile.saveSuccess')}
              </div>
            )}
          </div>

          <div className="edit-profile-view__actions">
            <button className="edit-profile-view__cancel" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button className="edit-profile-view__save" onClick={handleSave} disabled={saving}>
              {saving ? (
                <span className="edit-profile-view__spinner" />
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditProfileView
