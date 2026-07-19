import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export type TrayCommand = 'togglePlay' | 'next' | 'prev'

interface CacheEntry {
  s: string | null
  p: string | null
  t: number
}

const api = {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onTrayCommand: (cb: (cmd: TrayCommand) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, cmd: TrayCommand): void => cb(cmd)
    ipcRenderer.on('tray-command', handler)
    return () => ipcRenderer.removeListener('tray-command', handler)
  },
  updateTray: (data: { isPlaying: boolean; track: string; artist: string }) =>
    ipcRenderer.send('tray-update', data),
  cacheGetLyrics: (trackId: string) => ipcRenderer.invoke('cache-get-lyrics', trackId),
  cacheSetLyrics: (trackId: string, entry: CacheEntry) => ipcRenderer.invoke('cache-set-lyrics', trackId, entry),
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, data: string) => ipcRenderer.invoke('store-set', key, data),
  downloadTrack: (trackId: string, url: string): Promise<string> => ipcRenderer.invoke('download-track', trackId, url),
  removeDownload: (filePath: string): Promise<void> => ipcRenderer.invoke('download-remove', filePath),
  onSidecarReady: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('sidecar:ready', handler)
    return () => ipcRenderer.removeListener('sidecar:ready', handler)
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  discordUpdatePresence: (data: {
    trackName: string
    artist: string
    currentTime: number
    duration: number
    artworkUrl: string
    isPlaying: boolean
  }) => ipcRenderer.invoke('discord-update-presence', data),
  discordClearPresence: () => ipcRenderer.invoke('discord-clear-presence'),
  onNotification: (cb: (data: { type: string; title: string; message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { type: string; title: string; message: string }): void => cb(data)
    ipcRenderer.on('notification:show', handler)
    return () => ipcRenderer.removeListener('notification:show', handler)
  },
  restartApp: () => ipcRenderer.send('notification:action:restart')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
