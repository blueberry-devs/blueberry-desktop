import { useEffect } from 'react'
import { useAuth, logout, openAuth, refreshProfile } from '../store/auth'
import './AccountView.css'

export default function AccountView(): JSX.Element {
  const auth = useAuth()

  useEffect(() => {
    refreshProfile()
  }, [])

  return (
    <div className="account-view view-enter">
      <h1 className="account-view__title">Аккаунт</h1>

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
                <div className="account-view__profile-username">@{auth.user.username}</div>
              )}
            </div>
            <button className="account-view__logout" onClick={logout} title="Выйти">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>

          <div className="account-view__section">
            <h2 className="account-view__section-title">Данные профиля</h2>
            <div className="account-view__details">
              <div className="account-view__detail-row">
                <span className="account-view__detail-label">Email</span>
                <span className="account-view__detail-value">{auth.user.email || '—'}</span>
              </div>
              <div className="account-view__detail-row">
                <span className="account-view__detail-label">Имя пользователя</span>
                <span className="account-view__detail-value">{auth.user.username || '—'}</span>
              </div>
              <div className="account-view__detail-row">
                <span className="account-view__detail-label">ID</span>
                <span className="account-view__detail-value account-view__detail-value--mono">{auth.user.id}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="account-view__empty">
          <div className="account-view__empty-icon">
            <svg width="64" height="64" viewBox="0 0 18 18" fill="none">
              <path d="M14 15.5v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
          <h2 className="account-view__empty-title">Войдите в аккаунт</h2>
          <p className="account-view__empty-text">
            Чтобы синхронизировать коллекцию, плейлисты и историю между устройствами
          </p>
          <button className="account-view__login-btn" onClick={openAuth}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Войти
          </button>
        </div>
      )}
    </div>
  )
}
