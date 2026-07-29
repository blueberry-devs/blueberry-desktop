import { useEffect } from 'react'
import { useAuth, logout, openAuth, refreshProfile } from '../store/auth'
import { useTranslation } from '../utils/useTranslation'
import { getVerificationTier, getVerificationTooltip, getBadges } from '../utils/badges'
import { getProfile } from '../store/profile'
import Tooltip from './Tooltip'
import './AccountView.css'

export default function AccountView(): JSX.Element {
  const auth = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    refreshProfile()
  }, [])

  return (
    <div className="account-view view-enter">
      <h1 className="account-view__title">{t('account.title')}</h1>

      {auth.user ? (
        <>
          <div className="account-view__profile-card">
            <div className="account-view__avatar-wrap">
              {auth.user.avatarUrl ? (
                <img src={auth.user.avatarUrl} alt="" className="account-view__avatar-img" />
              ) : (
                <div className="account-view__avatar-placeholder">
                  <svg width="36" height="36" viewBox="0 0 18 18" fill="none">
                    <path d="M14 15.5v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </div>
              )}
            </div>
            <div className="account-view__profile-info">
              <div className="account-view__profile-email">{auth.user.email}</div>
              {auth.user.username && (
                <div className="account-view__profile-username">
                  @{auth.user.username}
                  {(auth.user.verificationLevel ?? 0) >= 1 && (
                    <Tooltip text={getVerificationTooltip(auth.user.verificationLevel!, getProfile().language)}>
                    <span className="account-view__verification-badge" style={{ color: getVerificationTier(auth.user.verificationLevel!).color }}>
                      <svg width="14" height="14" viewBox="0 0 22 22" fill="currentColor">
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                      </svg>
                    </span>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
            <button className="account-view__logout" onClick={logout} title={t('account.logout')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>

          <div className="account-view__section">
            <h2 className="account-view__section-title">{t('account.profileData')}</h2>
            <div className="account-view__details">
              <div className="account-view__detail-row">
                <span className="account-view__detail-label">{t('account.email')}</span>
                <span className="account-view__detail-value">{auth.user.email || '—'}</span>
              </div>
              <div className="account-view__detail-row">
                <span className="account-view__detail-label">{t('account.username')}</span>
                <span className="account-view__detail-value">{auth.user.username || '—'}</span>
              </div>
              <div className="account-view__detail-row">
                <span className="account-view__detail-label">{t('account.id')}</span>
                <span className="account-view__detail-value account-view__detail-value--mono">{auth.user.id}</span>
              </div>
              {(auth.user.verificationLevel ?? 0) >= 1 && (
                <div className="account-view__detail-row">
                  <span className="account-view__detail-label">{t('account.verification')}</span>
                  <span className="account-view__detail-value">
                    <Tooltip text={getVerificationTooltip(auth.user.verificationLevel!, getProfile().language)}>
                    <span className="account-view__detail-badge" style={{ color: getVerificationTier(auth.user.verificationLevel!).color }}>
                      <svg width="12" height="12" viewBox="0 0 22 22" fill="currentColor">
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                      </svg>
                      {getVerificationTier(auth.user.verificationLevel!).label}
                    </span>
                    </Tooltip>
                  </span>
                </div>
              )}
            </div>
          </div>

          {auth.user.badges && auth.user.badges.length > 0 && (
            <div className="account-view__section">
              <h2 className="account-view__section-title">{t('account.badges')}</h2>
              <div className="account-view__badges">
                {getBadges(auth.user.badges).map((badge) => (
                  <div key={badge.id} className="account-view__badge" title={badge.description}>
                    <span className="account-view__badge-emoji">{badge.emoji}</span>
                    <span className="account-view__badge-label">{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="account-view__empty">
          <div className="account-view__empty-icon">
            <svg width="64" height="64" viewBox="0 0 18 18" fill="none">
              <path d="M14 15.5v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1" />
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
      )}
    </div>
  )
}
