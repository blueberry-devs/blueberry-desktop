import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import DynamicIsland from './components/DynamicIsland'
import { PlayerProvider, usePlayer } from './player/PlayerContext'
import { usePendingSearch } from './store/searchQuery'
import { useDominantColor } from './hooks/useDominantColor'
import './App.css'

const MoodList = lazy(() => import('./components/MoodList'))
const NowPlayingPanel = lazy(() => import('./components/NowPlayingPanel'))
const NowPlayingFullscreen = lazy(() => import('./components/NowPlayingFullscreen'))
const PlasmaWave = lazy(() => import('./components/PlasmaWave'))
const SearchView = lazy(() => import('./components/SearchView'))
const TrendsView = lazy(() => import('./components/TrendsView'))
const CollectionView = lazy(() => import('./components/CollectionView'))

export type Tab = 'wave' | 'search' | 'trends' | 'collection'

function AppInner(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('wave')
  const { isPlaying, isLyricsOpen, currentTrack, getFrequencyBands, togglePlay, next, previous } = usePlayer()
  const pendingSearch = usePendingSearch()
  const coverColor = useDominantColor(currentTrack?.cover)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
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

  const showMiniPlayer = activeTab !== 'wave'

  return (
    <div className="app">
      <Suspense fallback={null}>
        <div className="app__glow-layer">
          <PlasmaWave playing={isPlaying} getFrequencyBands={getFrequencyBands} coverColor={coverColor} />
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
        </div>
      </div>

      {showMiniPlayer && currentTrack && <DynamicIsland onExpand={() => setActiveTab('wave')} />}
      <AnimatePresence>
        {isLyricsOpen && <Suspense fallback={null}><NowPlayingFullscreen /></Suspense>}
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
