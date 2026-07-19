import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from '../utils/useTranslation'
import './ToastNotification.css'

interface Notification {
  type: string
  title: string
  message: string
}

const AUTO_DISMISS_MS = 8000

function ToastNotification(): JSX.Element {
  const [notif, setNotif] = useState<Notification | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const unsub = window.api.onNotification((data) => {
      setNotif(data)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!notif) return
    const ms = notif.type === 'uptodate' ? 3000 : AUTO_DISMISS_MS
    const timer = setTimeout(() => setNotif(null), ms)
    return () => clearTimeout(timer)
  }, [notif])

  const handleClick = useCallback((): void => {
    if (!notif) return
    if (notif.type === 'update') {
      window.api.restartApp()
    }
    setNotif(null)
  }, [notif])

  if (!notif) return <></>

  return (
    <AnimatePresence>
      {notif && (
        <motion.div
          className="toast-notification"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
          onClick={handleClick}
        >
          <div className="toast-notification__icon">
            {notif.type === 'update' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v10M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : notif.type === 'uptodate' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#33cc66" strokeWidth="1.4" />
                <path d="M5 8l2 2 4-4" stroke="#33cc66" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5v4M8 11v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className="toast-notification__text">
            <div className="toast-notification__title">
              {notif.type === 'update' ? t('notification.updateTitle') : notif.type === 'uptodate' ? t('notification.upToDate') : t('notification.vpnTitle')}
            </div>
            <div className="toast-notification__message">
              {notif.type === 'update'
                ? t('notification.updateMessage').replace('{version}', notif.message)
                : ''}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ToastNotification
