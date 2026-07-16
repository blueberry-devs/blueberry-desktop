import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode
} from 'react'
import Hls from 'hls.js'
import { resolveStream, TrackResult } from '../api/yandexMusic'
import { parseLrc, LrcLine } from '../utils/lrc'
import { getLyrics } from '../services/lyricsCache'
import { pushHistory } from '../store/history'

export type LoopMode = 'off' | 'track' | 'queue'

interface PlayerState {
  currentTrack: TrackResult | null
  playingSource: TrackResult['source'] | null
  isPlaying: boolean
  isLoading: boolean
  loadError: string | null
  currentTime: number
  duration: number
  lyrics: LrcLine[] | null
  lyricsPlain: string[] | null
  lyricsLoading: boolean
  isLyricsOpen: boolean
  queue: TrackResult[]
  queueIndex: number
  loopMode: LoopMode
  volume: number
  activeGenre: string | null
  crossfade: boolean
  setCrossfade: (v: boolean) => void
  play: (track: TrackResult) => void
  playQueue: (tracks: TrackResult[], startIndex: number) => void
  appendToQueue: (tracks: TrackResult[]) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  cycleLoopMode: () => void
  seekTo: (time: number) => void
  setVolume: (v: number) => void
  setActiveGenre: (g: string | null) => void
  openLyrics: () => void
  closeLyrics: () => void
  getFrequencyBands: (bandCount: number) => Float32Array
}

const PlayerContext = createContext<PlayerState | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const playTokenRef = useRef(0)
  const loopModeRef = useRef<LoopMode>('off')
  const queueRef = useRef<TrackResult[]>([])
  const queueIndexRef = useRef(-1)
  // Silent shadow element, entirely separate from the real playback element,
  // used only to feed a Web Audio analyser for the metaballs visualizer.
  // Never touches the audio that actually plays — routing the real element
  // through Web Audio previously went silent (cross-origin CDN streams
  // without CORS get muted once captured by createMediaElementSource).
  const shadowAudioRef = useRef<HTMLAudioElement | null>(null)
  const shadowHlsRef = useRef<Hls | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqDataRef = useRef<Uint8Array | null>(null)
  const bandsCacheRef = useRef<Float32Array>(new Float32Array(0))

  const [currentTrack, setCurrentTrack] = useState<TrackResult | null>(null)
  const [playingSource, setPlayingSource] = useState<TrackResult['source'] | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [lyrics, setLyrics] = useState<LrcLine[] | null>(null)
  const [lyricsPlain, setLyricsPlain] = useState<string[] | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [isLyricsOpen, setIsLyricsOpen] = useState(false)
  const [queue, setQueue] = useState<TrackResult[]>([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const [loopMode, setLoopMode] = useState<LoopMode>('off')
  const [volume, setVolumeState] = useState(0.7)
  const volumeRef = useRef(0.7)
  const [activeGenre, setActiveGenreState] = useState<string | null>(null)
  const [crossfade, setCrossfadeState] = useState(false)
  const crossfadeRef = useRef(false)

  const setCrossfade = useCallback((v: boolean) => {
    crossfadeRef.current = v
    setCrossfadeState(v)
  }, [])

  const loadLyrics = useCallback((track: TrackResult, token: number) => {
    setLyricsLoading(true)
    getLyrics(track, (res) => {
      if (playTokenRef.current !== token) return
      if (res.synced) {
        setLyrics(parseLrc(res.synced))
      } else if (res.plain) {
        setLyricsPlain(res.plain.split('\n').filter((l) => l.trim().length > 0))
      } else {
        setLyricsPlain([])
      }
    })
      .catch(() => {
        if (playTokenRef.current === token) setLyricsPlain([])
      })
      .finally(() => {
        if (playTokenRef.current === token) setLyricsLoading(false)
      })
  }, [])

  const attachSource = useCallback((kind: 'progressive' | 'hls', url: string) => {
    const audio = audioRef.current
    if (!audio) return

    hlsRef.current?.destroy()
    hlsRef.current = null
    shadowHlsRef.current?.destroy()
    shadowHlsRef.current = null

    if (kind === 'hls' && Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(url)
      hls.attachMedia(audio)
      hls.on(Hls.Events.MANIFEST_PARSED, () => audio.play().catch(() => {}))
      hlsRef.current = hls
    } else {
      audio.src = url
      audio.play().catch(() => {})
    }

    // Mirror the same stream into the silent shadow element for the
    // analyser — most SoundCloud tracks are HLS-only these days, so this
    // has to be mirrored too, not just progressive, or the analyser almost
    // never gets real data.
    const shadow = shadowAudioRef.current
    if (shadow) {
      if (kind === 'hls' && Hls.isSupported()) {
        const shadowHls = new Hls()
        shadowHls.loadSource(url)
        shadowHls.attachMedia(shadow)
        shadowHls.on(Hls.Events.MANIFEST_PARSED, () => shadow.play().catch(() => {}))
        shadowHlsRef.current = shadowHls
      } else {
        shadow.src = url
        shadow.play().catch(() => {})
      }
    }
  }, [])

  const advanceQueue = useCallback((direction: 1 | -1) => {
    const q = queueRef.current
    if (q.length === 0) return

    let nextIndex = queueIndexRef.current + direction
    if (nextIndex < 0) {
      nextIndex = loopModeRef.current === 'queue' ? q.length - 1 : -1
    } else if (nextIndex >= q.length) {
      nextIndex = loopModeRef.current === 'queue' ? 0 : -1
    }
    if (nextIndex === -1) {
      setIsPlaying(false)
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    playAt(nextIndex)
  }, [])

  const playInternal = useCallback(
    (track: TrackResult) => {
      const audio = audioRef.current
      if (!audio) return

      if (currentTrack?.id === track.id) {
        if (audio.paused) audio.play().catch(() => {})
        else audio.pause()
        return
      }

      const token = ++playTokenRef.current
      pushHistory(track)
      setCurrentTrack(track)
      setPlayingSource(null)
      setLyrics(null)
      setLyricsPlain(null)
      setLoadError(null)
      setIsLoading(true)
      hlsRef.current?.destroy()
      hlsRef.current = null
      audio.pause()
      audio.removeAttribute('src')

      resolveStream(track)
        .then((stream) => {
          if (playTokenRef.current !== token) return
          setPlayingSource(stream.source)
          attachSource(stream.kind, stream.url)
        })
        .catch(() => {
          if (playTokenRef.current !== token) return
          setLoadError('Не удалось воспроизвести ни через Яндекс, ни через YouTube, ни через SoundCloud')
        })
        .finally(() => {
          if (playTokenRef.current === token) setIsLoading(false)
        })

      // Prefetch lyrics in parallel so the panel is ready instantly.
      loadLyrics(track, token)
    },
    [currentTrack, attachSource, loadLyrics]
  )

  const playAt = useCallback(
    (index: number) => {
      const q = queueRef.current
      const track = q[index]
      if (!track) return
      queueIndexRef.current = index
      setQueueIndex(index)
      playInternal(track)
    },
    [playInternal]
  )

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    // Shadow element: silent (muted + zero volume), never inserted in the
    // DOM, only ever used to feed the analyser below. Setting up its own
    // Web Audio graph can't affect the real element's playback.
    const shadow = new Audio()
    shadow.muted = true
    shadow.volume = 0
    shadow.crossOrigin = 'anonymous'
    shadowAudioRef.current = shadow

    const setupAnalyser = (): void => {
      if (analyserRef.current) return
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()
        const source = ctx.createMediaElementSource(shadow)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.5
        const silentGain = ctx.createGain()
        silentGain.gain.value = 0
        // Routed all the way to destination (not just left dangling) so the
        // graph actually gets pulled/processed — the zero-gain node is what
        // guarantees no audible output, not just relying on element muting.
        source.connect(analyser)
        analyser.connect(silentGain)
        silentGain.connect(ctx.destination)
        analyserRef.current = analyser
        freqDataRef.current = new Uint8Array(analyser.frequencyBinCount)
        ctx.resume().catch(() => {})
      } catch {
        // Web Audio unavailable/blocked — metaballs just won't react to audio.
      }
    }
    shadow.addEventListener('play', setupAnalyser)

    const onTime = (): void => setCurrentTime(audio.currentTime)
    const onDuration = (): void => setDuration(audio.duration || 0)
    const onPlay = (): void => {
      setIsPlaying(true)
      if (!shadow.paused) return
      shadow.currentTime = audio.currentTime
      shadow.play().catch(() => {})
    }
    const onPause = (): void => {
      setIsPlaying(false)
      shadow.pause()
    }
    const onEnded = (): void => {
      if (loopModeRef.current === 'track') {
        audio.currentTime = 0
        audio.play().catch(() => {})
        return
      }
      setIsPlaying(false)
      advanceQueue(1)
    }
    audio.volume = volumeRef.current
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      shadow.removeEventListener('play', setupAnalyser)
      audio.pause()
      shadow.pause()
      hlsRef.current?.destroy()
      shadowHlsRef.current?.destroy()
    }
  }, [advanceQueue])

  const play = useCallback(
    (track: TrackResult) => {
      queueRef.current = [track]
      queueIndexRef.current = 0
      setQueue([track])
      setQueueIndex(0)
      playInternal(track)
    },
    [playInternal]
  )

  const playQueueFn = useCallback(
    (tracks: TrackResult[], startIndex: number) => {
      queueRef.current = tracks
      queueIndexRef.current = startIndex
      setQueue(tracks)
      setQueueIndex(startIndex)
      const track = tracks[startIndex]
      if (track) playInternal(track)
    },
    [playInternal]
  )

  const appendToQueue = useCallback((tracks: TrackResult[]) => {
    const existingIds = new Set(queueRef.current.map((t) => t.id))
    const fresh = tracks.filter((t) => !existingIds.has(t.id))
    if (fresh.length === 0) return
    const merged = [...queueRef.current, ...fresh]
    queueRef.current = merged
    setQueue(merged)
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [currentTrack])

  const next = useCallback(() => advanceQueue(1), [advanceQueue])
  const previous = useCallback(() => advanceQueue(-1), [advanceQueue])

  const cycleLoopMode = useCallback(() => {
    setLoopMode((prev) => {
      const order: LoopMode[] = ['off', 'queue', 'track']
      const next = order[(order.indexOf(prev) + 1) % order.length]
      loopModeRef.current = next
      return next
    })
  }, [])

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
    const shadow = shadowAudioRef.current
    if (shadow && shadow.src) shadow.currentTime = time
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    volumeRef.current = clamped
    setVolumeState(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
  }, [])

  const setActiveGenre = useCallback((g: string | null) => {
    setActiveGenreState(g)
  }, [])

  const openLyrics = useCallback(() => {
    setIsLyricsOpen(true)
    if (!currentTrack || lyrics || lyricsPlain || lyricsLoading) return
    loadLyrics(currentTrack, playTokenRef.current)
  }, [currentTrack, lyrics, lyricsPlain, lyricsLoading, loadLyrics])

  const closeLyrics = useCallback(() => setIsLyricsOpen(false), [])

  // cava-style log-spaced spectrum, read live (not through React state —
  // called from a rAF loop at 60fps, far too hot for re-renders). Low bands
  // get few bins (fine bass resolution), high bands get many bins averaged
  // together (treble is perceptually coarser).
  const getFrequencyBands = useCallback((bandCount: number): Float32Array => {
    if (bandsCacheRef.current.length !== bandCount) {
      bandsCacheRef.current = new Float32Array(bandCount)
    }
    const bands = bandsCacheRef.current
    const analyser = analyserRef.current
    const data = freqDataRef.current
    if (!analyser || !data) {
      bands.fill(0)
      return bands
    }
    analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>)
    const n = data.length
    for (let b = 0; b < bandCount; b++) {
      const start = Math.floor(Math.pow(n, b / bandCount))
      const end = Math.max(start + 1, Math.floor(Math.pow(n, (b + 1) / bandCount)))
      let sum = 0
      let count = 0
      for (let i = start; i < end && i < n; i++) {
        sum += data[i]
        count++
      }
      bands[b] = count > 0 ? sum / count / 255 : 0
    }
    return bands
  }, [])

  // Media Session API: expose playback to OS media controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artists.join(', '),
        album: '',
        artwork: currentTrack.cover
          ? [{ src: currentTrack.cover, sizes: '512x512', type: 'image/jpeg' }]
          : []
      })
    } else {
      navigator.mediaSession.metadata = null
    }
    navigator.mediaSession.setActionHandler('play', () => {
      const audio = audioRef.current
      if (audio) audio.play().catch(() => {})
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      const audio = audioRef.current
      if (audio) audio.pause()
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => advanceQueue(-1))
    navigator.mediaSession.setActionHandler('nexttrack', () => advanceQueue(1))
    navigator.mediaSession.setActionHandler('seekforward', () => {
      const audio = audioRef.current
      if (audio) audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || 0)
    })
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      const audio = audioRef.current
      if (audio) audio.currentTime = Math.max(audio.currentTime - 10, 0)
    })
  }, [currentTrack, advanceQueue])

  const value = useMemo<PlayerState>(
    () => ({
      currentTrack,
      playingSource,
      isPlaying,
      isLoading,
      loadError,
      currentTime,
      duration,
      lyrics,
      lyricsPlain,
      lyricsLoading,
      isLyricsOpen,
      queue,
      queueIndex,
      loopMode,
      volume,
      activeGenre,
      crossfade,
      setCrossfade,
      play,
      playQueue: playQueueFn,
      appendToQueue,
      togglePlay,
      next,
      previous,
      cycleLoopMode,
      seekTo,
      setVolume,
      setActiveGenre,
      openLyrics,
      closeLyrics,
      getFrequencyBands
    }),
    [
      currentTrack,
      playingSource,
      isPlaying,
      isLoading,
      loadError,
      currentTime,
      duration,
      lyrics,
      lyricsPlain,
      lyricsLoading,
      isLyricsOpen,
      queue,
      queueIndex,
      loopMode,
      volume,
      activeGenre,
      crossfade,
      setCrossfade,
      play,
      playQueueFn,
      appendToQueue,
      togglePlay,
      next,
      previous,
      cycleLoopMode,
      seekTo,
      setVolume,
      openLyrics,
      closeLyrics,
      getFrequencyBands
    ]
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
