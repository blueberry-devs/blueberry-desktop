import { useEffect, useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../utils/useTranslation'
import './Modal.css'

interface ModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

const ANIM_MS = 150

function Modal({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, children }: ModalProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(open)
  const [closing, setClosing] = useState(false)
  const prevOpen = useRef(open)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open && !prevOpen.current) {
      setClosing(false)
      setVisible(true)
    } else if (!open && prevOpen.current) {
      setClosing(true)
      timer.current = setTimeout(() => {
        setClosing(false)
        setVisible(false)
      }, ANIM_MS)
    }
    prevOpen.current = open

    return () => clearTimeout(timer.current)
  }, [open])

  const close = useCallback(
    (action: () => void) => {
      if (closing) return
      setClosing(true)
      timer.current = setTimeout(() => {
        setClosing(false)
        setVisible(false)
        action()
      }, ANIM_MS)
    },
    [closing],
  )

  // Block body scroll when modal is visible
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(onCancel)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible, close, onCancel])

  if (!visible) return null

  return createPortal(
    <div
      className={`modal-overlay${closing ? ' modal-overlay--closing' : ''}`}
      onClick={() => close(onCancel)}
    >
      <div
        className={`modal-dialog${closing ? ' modal-dialog--closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>
        {children}
        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={() => close(onCancel)}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button className="modal-btn modal-btn--confirm" onClick={() => close(onConfirm)}>
            {confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default Modal
