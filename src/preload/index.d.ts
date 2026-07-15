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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WindowApi
  }
}
