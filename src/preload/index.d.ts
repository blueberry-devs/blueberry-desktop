import { ElectronAPI } from '@electron-toolkit/preload'

type TrayCommand = 'togglePlay' | 'next' | 'prev'

interface CacheEntry {
  s: string | null
  p: string | null
  t: number
}

interface WindowApi {
  minimize: () => void
  maximize: () => void
  close: () => void
  onTrayCommand: (cb: (cmd: TrayCommand) => void) => () => void
  updateTray: (data: { isPlaying: boolean; track: string; artist: string }) => void
  cacheGetLyrics: (trackId: string) => Promise<CacheEntry | null>
  cacheSetLyrics: (trackId: string, entry: CacheEntry) => Promise<void>
  storeGet: (key: string) => Promise<string | null>
  storeSet: (key: string, data: string) => Promise<void>
  downloadTrack: (trackId: string, url: string) => Promise<string>
  removeDownload: (filePath: string) => Promise<void>
  onSidecarReady: (cb: () => void) => () => void
  getAppVersion: () => Promise<string>
  discordUpdatePresence: (data: {
    trackName: string
    artist: string
    currentTime: number
    duration: number
    artworkUrl: string
    isPlaying: boolean
  }) => Promise<void>
  discordClearPresence: () => Promise<void>
  onNotification: (cb: (data: { type: string; title: string; message: string }) => void) => () => void
  restartApp: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WindowApi
  }
}
