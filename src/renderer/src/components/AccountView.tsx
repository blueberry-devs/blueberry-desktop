import { useAuth, logout, openAuth } from '../store/auth'
import './AccountView.css'

export default function AccountView(): JSX.Element {
  const auth = useAuth()

  return (
    <div className="account-view view-enter">
      <h1 className="account-view__title">Аккаунт</h1>

      {auth.user ? (
        <div className="account-view__card">
          <div className="account-view__avatar">
            {auth.user.avatarUrl ? (
              <img src={auth.user.avatarUrl} alt="" className="account-view__avatar-img" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 18 18" fill="none">
                <path d="M14 15.5v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            )}
          </div>
          <div className="account-view__info">
            <div className="account-view__email">{auth.user.email}</div>
            {auth.user.username && (
              <div className="account-view__username">{auth.user.username}</div>
            )}
          </div>
          <button className="account-view__logout" onClick={logout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Выйти
          </button>
        </div>
      ) : (
        <div className="account-view__card account-view__card--center">
          <div className="account-view__icon">
            <svg width="48" height="48" viewBox="0 0 18 18" fill="none">
              <path d="M14 15.5v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
          <p className="account-view__prompt">Войдите, чтобы синхронизировать коллекцию и плейлисты</p>
          <button className="account-view__login-btn" onClick={openAuth}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
