import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type TrayCommand = 'togglePlay' | 'next' | 'prev'

interface CacheEntry {
  s: string | null
  p: string | null
  t: number
}

interface NotificationData {
  type: string
  title: string
  message: string
}

export const api = {
  minimize: () => getCurrentWindow().minimize(),
  maximize: async () => {
    const win = getCurrentWindow()
    if (await win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  },
  close: () => getCurrentWindow().hide(),

  onTrayCommand: (cb: (cmd: TrayCommand) => void): (() => void) => {
    let unlisten: UnlistenFn | null = null
    listen<string>('tray-command', (event) => {
      cb(event.payload as TrayCommand)
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  },

  updateTray: (data: { isPlaying: boolean; track: string; artist: string }) =>
    invoke('tray_update', { data }),

  cacheGetLyrics: (trackId: string): Promise<CacheEntry | null> =>
    invoke('cache_get_lyrics', { trackId }),

  cacheSetLyrics: (trackId: string, entry: CacheEntry): Promise<void> =>
    invoke('cache_set_lyrics', { trackId, entry }),

  storeGet: (key: string): Promise<string | null> =>
    invoke('store_get', { key }),

  storeSet: (key: string, data: string): Promise<void> =>
    invoke('store_set', { key, data }),

  downloadTrack: (trackId: string, url: string): Promise<string> =>
    invoke('download_track', { trackId, url }),

  removeDownload: (filePath: string): Promise<void> =>
    invoke('remove_download', { filePath }),

  onSidecarReady: (cb: () => void): (() => void) => {
    let unlisten: UnlistenFn | null = null
    listen('sidecar:ready', () => cb()).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  },

  getAppVersion: (): Promise<string> =>
    invoke('get_app_version'),

  discordUpdatePresence: (data: {
    trackName: string
    artist: string
    currentTime: number
    duration: number
    artworkUrl: string
    isPlaying: boolean
  }): Promise<void> =>
    invoke('discord_update_presence', { data }),

  discordClearPresence: (): Promise<void> =>
    invoke('discord_clear_presence'),

  onNotification: (cb: (data: NotificationData) => void): (() => void) => {
    let unlisten: UnlistenFn | null = null
    listen<NotificationData>('notification:show', (event) => {
      cb(event.payload)
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  },

  restartApp: () => invoke('restart_app'),

  startDragging: () => getCurrentWindow().startDragging(),
}

// Expose on window for backward compatibility with code that uses window.api
declare global {
  interface Window {
    api: typeof api
  }
}

window.api = api
