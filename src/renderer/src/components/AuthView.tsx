import { useState, useCallback, useEffect, useRef } from 'react'
import { Mail, Lock, Eye, EyeOff, UserPlus, LogIn, X, ChevronLeft } from 'lucide-react'
import { login, register, tryRestoreSession } from '../store/auth'
import './AuthView.css'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, opts: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
      }) => string
      execute: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

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
  const [turnstileReady, setTurnstileReady] = useState(!TURNSTILE_SITE_KEY)
  const turnstileWidgetId = useRef<string | undefined>(undefined)
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

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return

    const check = (): void => {
      if (window.turnstile) {
        setTurnstileReady(true)
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  }, [])

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

      let token: string | null = null
      if (TURNSTILE_SITE_KEY && window.turnstile) {
        try {
          token = await new Promise<string>((resolve) => {
            const container = document.createElement('div')
            container.style.cssText = 'position:absolute;width:0;height:0'
            document.body.appendChild(container)
            const id = window.turnstile!.render(container, {
              sitekey: TURNSTILE_SITE_KEY,
              callback: (t: string) => {
                container.remove()
                resolve(t)
              },
            })
            turnstileWidgetId.current = id
            window.turnstile!.execute(id)
          })
        } catch {
          setError('Ошибка проверки безопасности')
          setLoading(false)
          return
        }
      }

      const err =
        mode === 'login'
          ? await login(email.trim(), password, token)
          : await register(email.trim(), password, token)
      setLoading(false)

      if (err) {
        setError(err)
      } else {
        onClose()
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
          <X size={20} />
        </button>

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
              <Mail size={16} className="auth-form__icon" />
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
              <Lock size={16} className="auth-form__icon" />
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
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="auth-form__field">
              <label className="auth-form__label">Подтвердите пароль</label>
              <div className="auth-form__input-wrap">
                <Lock size={16} className="auth-form__icon" />
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
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {error && <div className="auth-form__error">{error}</div>}

          <button
            type="submit"
            className="auth-form__submit"
            disabled={loading || !turnstileReady}
          >
            {loading ? (
              <div className="auth-form__spinner-sm" />
            ) : mode === 'login' ? (
              <><LogIn size={16} /> Войти</>
            ) : (
              <><UserPlus size={16} /> Зарегистрироваться</>
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
                <ChevronLeft size={14} /> Войти
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
