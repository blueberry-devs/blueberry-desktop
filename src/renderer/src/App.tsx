import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import DynamicIsland from './components/DynamicIsland'
import SplashScreen from './components/SplashScreen'
// Not lazy: this mounts/unmounts on every open/close through AnimatePresence,
// and pairing that with Suspense's own mount/fallback cycle raced with the
// exit animation — closing it would flash back to fullscreen for a frame
// before actually disappearing.
import NowPlayingFullscreen from './components/NowPlayingFullscreen'
import { PlayerProvider, usePlayer } from './player/PlayerContext'
import { usePendingSearch } from './store/searchQuery'
import { useDominantColor } from './hooks/useDominantColor'
import { useProfile } from './store/profile'
import { toggleLike } from './store/likes'
import './App.css'

const MoodList = lazy(() => import('./components/MoodList'))
const NowPlayingPanel = lazy(() => import('./components/NowPlayingPanel'))
const PlasmaWave = lazy(() => import('./components/PlasmaWave'))
const SearchView = lazy(() => import('./components/SearchView'))
const TrendsView = lazy(() => import('./components/TrendsView'))
const CollectionView = lazy(() => import('./components/CollectionView'))
const SettingsView = lazy(() => import('./components/SettingsView'))
const HistoryView = lazy(() => import('./components/HistoryView'))

export type Tab = 'wave' | 'search' | 'trends' | 'collection' | 'history' | 'settings'

function rgbToHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return -1
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h / 6) * 360
}

function AppInner(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('wave')
  const [appReady, setAppReady] = useState(false)
  const { isPlaying, isLyricsOpen, currentTrack, getFrequencyBands, togglePlay, next, previous, closeLyrics } = usePlayer()
  const pendingSearch = usePendingSearch()
  const coverColor = useDominantColor(currentTrack?.cover)
  const trackHue = coverColor ? rgbToHue(coverColor[0], coverColor[1], coverColor[2]) : -1
  const profile = useProfile()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', profile.theme)
  }, [profile.theme])

  useEffect(() => {
    const off = window.api.onSidecarReady(() => setAppReady(true))
    const timeout = setTimeout(() => setAppReady(true), 5000)
    return () => {
      off()
      clearTimeout(timeout)
    }
  }, [])

  // Listen for tray commands (play/pause, next, prev)
  useEffect(() => {
    const cleanup = window.api.onTrayCommand((cmd) => {
      if (cmd === 'togglePlay') togglePlay()
      else if (cmd === 'next') next()
      else if (cmd === 'prev') previous()
    })
    return cleanup
  }, [togglePlay, next, previous])

  // Send track info to tray
  useEffect(() => {
    window.api.updateTray({
      isPlaying,
      track: currentTrack?.title ?? 'Яндекс Музыка',
      artist: currentTrack?.artists?.join(', ') ?? ''
    })
  }, [isPlaying, currentTrack])

  // Clicking an artist anywhere (Collection, Trends, Playlists, Search
  // itself) requests a search — jump to the Search tab so SearchView can
  // pick it up and run it.
  useEffect(() => {
    if (pendingSearch) setActiveTab('search')
  }, [pendingSearch])

  const selectTab = (tab: Tab): void => {
    setActiveTab(tab)
  }

  // Global playback/navigation hotkeys. Ignored while typing in a text
  // field so Space/K/L etc. still work normally in search boxes and forms.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isLyricsOpen) {
        closeLyrics()
        return
      }

      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isTyping) return

      const mod = e.ctrlKey || e.metaKey

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setActiveTab('search')
      } else if (mod && e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (mod && e.key === 'ArrowLeft') {
        e.preventDefault()
        previous()
      } else if (mod && e.key.toLowerCase() === 'l') {
        if (currentTrack) {
          e.preventDefault()
          toggleLike(currentTrack)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLyricsOpen, closeLyrics, togglePlay, next, previous, currentTrack])

  const showMiniPlayer = activeTab !== 'wave'

  return (
    <div className="app">
      <SplashScreen visible={!appReady} onEnded={() => setAppReady(true)} />

      <Suspense fallback={null}>
        <div className="app__glow-layer">
          <PlasmaWave playing={isPlaying} getFrequencyBands={getFrequencyBands} trackHue={trackHue} coverColor={coverColor?.join(',')} />
        </div>
      </Suspense>

      <TitleBar />
      <div className="app__body">
        <Sidebar activeTab={activeTab} onSelectTab={selectTab} />

        <div className={`app__content${showMiniPlayer && currentTrack ? ' app__content--with-player' : ''}`}>
          {activeTab === 'wave' && (
            <Suspense fallback={null}>
              <MoodList />
              <NowPlayingPanel />
            </Suspense>
          )}
          {activeTab === 'search' && <Suspense fallback={null}><SearchView /></Suspense>}
          {activeTab === 'trends' && <Suspense fallback={null}><TrendsView /></Suspense>}
          {activeTab === 'collection' && <Suspense fallback={null}><CollectionView /></Suspense>}
          {activeTab === 'history' && <Suspense fallback={null}><HistoryView /></Suspense>}
          {activeTab === 'settings' && <Suspense fallback={null}><SettingsView /></Suspense>}
        </div>
      </div>

      {showMiniPlayer && currentTrack && <DynamicIsland onExpand={() => setActiveTab('wave')} />}
      <AnimatePresence>
        {isLyricsOpen && <NowPlayingFullscreen />}
      </AnimatePresence>
    </div>
  )
}

function App(): JSX.Element {
  return (
    <PlayerProvider>
      <AppInner />
    </PlayerProvider>
  )
}

export default App
