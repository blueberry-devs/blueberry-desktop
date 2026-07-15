import { useCallback, useEffect, useRef } from 'react'
import './VolumeSlider.css'

interface Props {
  volume: number
  onChange: (v: number) => void
}

function VolumeSlider({ volume, onChange }: Props): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const setFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const ratio = 1 - (clientY - rect.top) / rect.height
      onChange(Math.max(0, Math.min(1, ratio)))
    },
    [onChange]
  )

  useEffect(() => {
    const handleMove = (e: MouseEvent): void => {
      if (draggingRef.current) setFromClientY(e.clientY)
    }
    const handleUp = (): void => {
      draggingRef.current = false
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [setFromClientY])

  return (
    <div
      className="volume-slider"
      ref={trackRef}
      onMouseDown={(e) => {
        draggingRef.current = true
        setFromClientY(e.clientY)
      }}
    >
      <div className="volume-slider__fill" style={{ height: `${volume * 100}%` }} />
      <div className="volume-slider__knob" style={{ bottom: `calc(${volume * 100}% - 9px)` }} />
      <span className="volume-slider__icon">
        {volume === 0 ? (
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M2 7v4h3l4 3V4L5 7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M12.5 7.5l4 4M16.5 7.5l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M2 7v4h3l4 3V4L5 7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M11 6.5c1 .8 1 4.2 0 5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        )}
      </span>
    </div>
  )
}

export default VolumeSlider
