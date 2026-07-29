import { useEffect } from 'react'
import { useAuth, logout, openAuth, refreshProfile } from '../store/auth'
import { useTranslation } from '../utils/useTranslation'
import { getVerificationTier, getBadges } from '../utils/badges'
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
                    <span
                      className="account-view__verification-badge"
                      style={{ color: getVerificationTier(auth.user.verificationLevel!).color }}
                      title={getVerificationTier(auth.user.verificationLevel!).label}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                      </svg>
                    </span>
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
                    <span className="account-view__detail-badge" style={{ color: getVerificationTier(auth.user.verificationLevel!).color }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                      </svg>
                      {getVerificationTier(auth.user.verificationLevel!).label}
                    </span>
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
