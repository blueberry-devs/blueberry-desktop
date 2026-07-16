import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface SplashScreenProps {
  visible: boolean
  onEnded?: () => void
}

export default function SplashScreen({ visible, onEnded }: SplashScreenProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!visible && videoRef.current) {
      videoRef.current.pause()
    }
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <video
            ref={videoRef}
            src="./splash_screen_dark.mp4"
            muted
            autoPlay
            playsInline
            preload="auto"
            className="splash-screen__video"
            onEnded={onEnded}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
