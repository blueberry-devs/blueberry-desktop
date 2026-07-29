import { useRef, useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipPos {
  top: number
  left: number
}

interface TooltipProps {
  text: string
  children: ReactNode
}

const ANIM_MS = 120

function Tooltip({ text, children }: TooltipProps) {
  const [pos, setPos] = useState<TooltipPos | null>(null)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  if (!text) return <>{children}</>

  const show = () => {
    clearTimeout(timer.current)
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.top - 8, left: r.left + r.width / 2 })
    setClosing(false)
    setVisible(true)
  }

  const hide = () => {
    setClosing(true)
    timer.current = setTimeout(() => {
      setVisible(false)
      setClosing(false)
    }, ANIM_MS)
  }

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              zIndex: 999999,
              top: pos!.top,
              left: pos!.left,
              transform: 'translate(-50%, -100%)',
              padding: '5px 10px',
              borderRadius: 7,
              background: '#1a1a23',
              color: '#e0e0e0',
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              opacity: closing ? 0 : 1,
              transition: `opacity ${ANIM_MS}ms ease`,
            }}
          >
            {text}
            <span
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                border: '4px solid transparent',
                borderTopColor: '#1a1a23',
                opacity: closing ? 0 : 1,
                transition: `opacity ${ANIM_MS}ms ease`,
              }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}

export default Tooltip
