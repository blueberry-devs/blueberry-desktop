import { useState, useCallback, useEffect, useRef } from 'react'
import { login, register, tryRestoreSession } from '../store/auth'
import './AuthView.css'

interface IconProps { size: number; className?: string }
function MailIcon({ size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 4L12 13 2 4" />
    </svg>
  )
}
function LockIcon({ size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}
function EyeIcon({ size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function EyeOffIcon({ size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
function UserPlusIcon({ size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  )
}
function LogInIcon({ size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}
function XIcon({ size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function ChevronLeftIcon({ size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

type Mode = 'login' | 'register'

interface AuthViewProps {
  closing: boolean
  onClose: () => void
}

export default function AuthView({ closing, onClose }: AuthViewProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    tryRestoreSession().then((restored) => {
      setCheckingSession(false)
      if (restored) onClose()
    })
  }, [onClose])

  useEffect(() => {
    emailRef.current?.focus()
  }, [mode])

  const switchMode = useCallback(() => {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setError('')
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')

      if (!email.trim()) {
        setError('Введите email')
        return
      }
      if (!password) {
        setError('Введите пароль')
        return
      }
      if (mode === 'register' && password !== confirmPassword) {
        setError('Пароли не совпадают')
        return
      }
      if (mode === 'register' && password.length < 6) {
        setError('Пароль должен быть не менее 6 символов')
        return
      }

      setLoading(true)

      if (mode === 'login') {
        const err = await login(email.trim(), password)
        setLoading(false)
        if (err) setError(err)
        else onClose()
      } else {
        const result = await register(email.trim(), password)
        setLoading(false)
        if (result.error) {
          setError(result.error)
        } else if (result.emailConfirmationRequired) {
          setRegisteredEmail(email.trim())
        } else {
          onClose()
        }
      }
    },
    [email, password, confirmPassword, mode, onClose],
  )

  if (checkingSession) {
    return (
      <div className="auth-view">
        <div className="auth-view__bg" />
        <div className="auth-view__overlay" />
        <div className="auth-view__loader">
          <div className="auth-view__spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className={`auth-view${closing ? ' auth-view--closing' : ''}`}>
      <div className="auth-view__bg" />
      <div className={`auth-view__overlay${closing ? ' auth-view__overlay--closing' : ''}`} />

      <button className="auth-view__skip" onClick={onClose} type="button">
        Пропустить
      </button>

      <div className={`auth-card${closing ? ' auth-card--closing' : ''}`}>
        <button className="auth-card__close" onClick={onClose} type="button" aria-label="Закрыть">
          <XIcon size={20} />
        </button>

        {registeredEmail ? (
          <>
            <div className="auth-card__header">
              <h1 className="auth-card__title">Подтвердите почту</h1>
              <p className="auth-card__subtitle">
                Мы отправили письмо на <strong>{registeredEmail}</strong>
              </p>
            </div>

            <div className="auth-confirm">
              <p className="auth-confirm__text">
                Перейдите по ссылке в письме, чтобы подтвердить email, затем войдите в аккаунт.
              </p>
              <p className="auth-confirm__hint">
                Не пришло? Проверьте папку «Спам» или повторите регистрацию.
              </p>
              <button
                type="button"
                className="auth-form__submit"
                onClick={() => setRegisteredEmail('')}
              >
                <LogInIcon size={16} /> Войти
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="auth-card__header">
              <h1 className="auth-card__title">
                {mode === 'login' ? 'Войти' : 'Регистрация'}
              </h1>
              <p className="auth-card__subtitle">
                {mode === 'login'
                  ? 'Войдите в свой аккаунт'
                  : 'Создайте новый аккаунт'}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
            <label className="auth-form__label">Email</label>
            <div className="auth-form__input-wrap">
              <MailIcon size={16} className="auth-form__icon" />
              <input
                ref={emailRef}
                type="email"
                className="auth-form__input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-form__field">
            <label className="auth-form__label">Пароль</label>
            <div className="auth-form__input-wrap">
              <LockIcon size={16} className="auth-form__icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-form__input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-form__toggle-vis"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="auth-form__field">
              <label className="auth-form__label">Подтвердите пароль</label>
              <div className="auth-form__input-wrap">
                <LockIcon size={16} className="auth-form__icon" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="auth-form__input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-form__toggle-vis"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showConfirm ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>
          )}

          {error && <div className="auth-form__error">{error}</div>}

          <button
            type="submit"
            className="auth-form__submit"
            disabled={loading}
          >
            {loading ? (
              <div className="auth-form__spinner-sm" />
            ) : mode === 'login' ? (
              <><LogInIcon size={16} /> Войти</>
            ) : (
              <><UserPlusIcon size={16} /> Зарегистрироваться</>
            )}
          </button>
        </form>

          <div className="auth-card__footer">
            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  className="auth-card__link"
                  onClick={() => setError('Функция восстановления пароля скоро появится')}
                >
                  Забыли пароль?
                </button>
                <div className="auth-card__switch">
                  Нет аккаунта?{' '}
                  <button type="button" className="auth-card__link" onClick={switchMode}>
                    Зарегистрироваться
                  </button>
                </div>
              </>
            ) : (
              <div className="auth-card__switch">
                Уже есть аккаунт?{' '}
                <button type="button" className="auth-card__link" onClick={switchMode}>
                  <ChevronLeftIcon size={14} /> Войти
                </button>
              </div>
            )}
          </div>
          </>

        )}

      </div>
    </div>
  )
}