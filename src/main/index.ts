import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron'
import https from 'https'

app.commandLine.appendSwitch('enable-accelerated-video-decode')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { spawn, execSync, ChildProcessWithoutNullStreams } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { updatePresence, clearPresence, destroy as destroyDiscord } from './discord'

let sidecar: ChildProcessWithoutNullStreams | null = null
let tray: Tray | null = null
let trayMenuTemplate: Electron.MenuItemConstructorOptions[] | null = null
let isQuitting = false
let mainWindowRef: BrowserWindow | null = null
const SIDECAR_PORT = 8787

function resolveServerExe(): string {
  // Production: bundled PyInstaller .exe
  const exePath = join(process.resourcesPath, 'server', 'music-server.exe')
  if (!is.dev && existsSync(exePath)) return exePath
  return ''
}

function resolveServerDir(): string {
  // Production: try PyInstaller bundle first, then raw Python
  if (!is.dev) {
    const exePath = resolveServerExe()
    if (exePath) return join(process.resourcesPath, 'server')
    const packagedDir = join(process.resourcesPath, 'server')
    if (existsSync(packagedDir)) return packagedDir
  }
  return join(app.getAppPath(), 'server')
}

function killOrphansOnPort(port: number): void {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
      const pids = new Set(
        out
          .split('\n')
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((pid): pid is string => !!pid && pid !== '0')
      )
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /T /PID ${pid}`)
          console.log(`[sidecar] killed orphaned process tree on port ${port} (pid ${pid})`)
        } catch {
          /* already gone */
        }
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' })
      for (const pid of out.split('\n').map((p) => p.trim()).filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`)
          console.log(`[sidecar] killed orphaned process on port ${port} (pid ${pid})`)
        } catch {
          /* already gone */
        }
      }
    }
  } catch {
    // No process found on the port — nothing to clean up.
  }
}

/** Synchronous sleep without extra deps — used to give the OS a moment to actually free the port. */
function sleepSync(ms: number): void {
  const sab = new SharedArrayBuffer(4)
  Atomics.wait(new Int32Array(sab), 0, 0, ms)
}

function killExistingSidecar(): void {
  killOrphansOnPort(SIDECAR_PORT)
  sleepSync(300)
}

function startSidecar(): void {
  const serverDir = resolveServerDir()
  const exePath = resolveServerExe()
  let command: string
  let args: string[]
  let cwd: string

  if (exePath) {
    command = exePath
    args = []
    cwd = serverDir
    console.log('[sidecar] starting packed exe:', exePath)
  } else {
    const entry = join(serverDir, 'main.py')
    if (!existsSync(entry)) {
      console.warn('[sidecar] server/main.py not found, skipping start:', entry)
      return
    }
    const pythonBin = process.platform === 'win32' ? 'python' : 'python3'
    command = pythonBin
    args = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(SIDECAR_PORT)]
    cwd = serverDir
    console.log('[sidecar] starting via python:', entry)
  }

  killExistingSidecar()

  const env = { ...process.env, SIDECAR_PORT: String(SIDECAR_PORT) }
  sidecar = spawn(command, args, { cwd, env })

  let started = false

  sidecar.stdout.on('data', (data) => {
    const text = data.toString()
    console.log(`[sidecar] ${text}`)
    if (!started && text.includes('Uvicorn running')) {
      started = true
      mainWindowRef?.webContents.send('sidecar:ready')
    }
  })

  sidecar.stderr.on('data', (data) => {
    const text = data.toString()
    console.error(`[sidecar] ${text}`)
    if (!started && text.includes('Uvicorn running')) {
      started = true
      mainWindowRef?.webContents.send('sidecar:ready')
    }
  })

  sidecar.on('error', (err) => {
    console.error('[sidecar] failed to start:', err.message)
  })

  sidecar.on('exit', (code) => {
    console.log(`[sidecar] exited with code ${code}`)
    sidecar = null
  })
}

function stopSidecar(): void {
  if (sidecar) {
    sidecar.kill()
    sidecar = null
  }
  killExistingSidecar()
}

function createWindow(): void {
  const iconName = process.platform === 'win32' ? (is.dev ? 'icon-dev.ico' : 'icon.ico') : (is.dev ? 'icon-dev.png' : 'icon.png')
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    title: 'Яндекс Музыка',
    backgroundColor: '#000000',
    icon: join(__dirname, `../../resources/${iconName}`),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindowRef = mainWindow

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools()
      console.log('[dev] DevTools opened')
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window-close', () => mainWindow.close())

  // F12 toggle DevTools
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools()
      }
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  createTray(mainWindow)
}

function createTray(mainWindow: BrowserWindow): void {
  const iconName = process.platform === 'win32' ? (is.dev ? 'icon-dev.ico' : 'icon.ico') : (is.dev ? 'icon-dev.png' : 'icon.png')
  const iconPath = join(__dirname, `../../resources/${iconName}`)
  tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('Яндекс Музыка')

  trayMenuTemplate = [
    { id: 'play-pause', label: 'Play', click: () => mainWindow.webContents.send('tray-command', 'togglePlay') },
    { type: 'separator' },
    { label: 'Next', click: () => mainWindow.webContents.send('tray-command', 'next') },
    { label: 'Previous', click: () => mainWindow.webContents.send('tray-command', 'prev') },
    { type: 'separator' },
    {
      label: 'Show',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    { label: 'Check for Updates', click: () => checkForUpdates(true) },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        tray?.destroy()
        tray = null
        app.quit()
      }
    }
  ]
  tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate))

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  ipcMain.on('tray-update', (_event, data: { isPlaying: boolean; track: string; artist: string }) => {
    if (!tray || !trayMenuTemplate) return
    const ppIndex = trayMenuTemplate.findIndex((item) => 'id' in item && item.id === 'play-pause')
    if (ppIndex !== -1) {
      trayMenuTemplate[ppIndex] = {
        ...trayMenuTemplate[ppIndex],
        label: data.isPlaying ? 'Pause' : 'Play'
      }
    }
    tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate))
    tray.setToolTip(`${data.artist} — ${data.track}`)
  })
}

// ===================== AUTO UPDATE =====================
// GitHub Releases via electron-builder's `publish` config (see package.json)
// — `npm run release:win` builds and uploads with GH_TOKEN set. Silent by
// default (checkForUpdates below only): a manual check from the tray menu
// is the one case that should tell the user "you're already up to date"
// instead of doing nothing.
let updateCheckInFlight = false

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('download-progress', (info) => {
    console.log(`[ ${Math.round(info.percent)}% ] Downloading update...`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded. Restart the app to install.')
    mainWindowRef?.webContents.send('notification:show', {
      type: 'update',
      title: 'update',
      message: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
  })
}

function checkForUpdates(manual: boolean): void {
  if (!app.isPackaged || updateCheckInFlight) return
  updateCheckInFlight = true

  console.log('')
  console.log('Checking for updates')
  console.log('')
  console.log(`Current version: ${app.getVersion()}`)

  if (manual) {
    const onNotAvailable = (): void => {
      dialog.showMessageBox({ type: 'info', title: 'Обновления', message: 'У вас уже последняя версия.' })
    }
    autoUpdater.once('update-not-available', onNotAvailable)
    autoUpdater.once('update-available', () => autoUpdater.removeListener('update-not-available', onNotAvailable))
  }

  autoUpdater
    .checkForUpdates()
    .catch((err) => console.error('[updater] check failed:', err.message))
    .finally(() => {
      updateCheckInFlight = false
    })
}

// ===================== LYRIC CACHE =====================
const CACHE_FILE = 'lyrics-cache.json'
const MAX_CACHE_SIZE = 2_000_000 // ~2MB

function cacheDir(): string {
  const dir = join(app.getPath('userData'), '.cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function cachePath(): string {
  return join(cacheDir(), CACHE_FILE)
}

interface CacheEntry {
  s: string | null
  p: string | null
  t: number
}

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = readFileSync(cachePath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeCache(data: Record<string, CacheEntry>): void {
  const json = JSON.stringify(data)
  if (Buffer.byteLength(json, 'utf-8') > MAX_CACHE_SIZE) {
    // Evict oldest entries
    const entries = Object.entries(data).sort((a, b) => a[1].t - b[1].t)
    const evict = Math.ceil(entries.length * 0.3)
    for (let i = 0; i < evict; i++) delete data[entries[i][0]]
    writeFileSync(cachePath(), JSON.stringify(data), 'utf-8')
  } else {
    writeFileSync(cachePath(), json, 'utf-8')
  }
}

ipcMain.handle('cache-get-lyrics', (_event, trackId: string): Promise<CacheEntry | null> => {
  const cache = readCache()
  return Promise.resolve(cache[trackId] ?? null)
})

ipcMain.handle('cache-set-lyrics', (_event, trackId: string, entry: CacheEntry): Promise<void> => {
  const cache = readCache()
  cache[trackId] = entry
  writeCache(cache)
  return Promise.resolve()
})

// ===================== PERSISTENT STORE =====================
const STORE_DIR = 'store'

function storeDir(): string {
  const dir = join(app.getPath('userData'), STORE_DIR)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function storePath(key: string): string {
  return join(storeDir(), `${key}.json`)
}

ipcMain.handle('store-get', (_event, key: string): Promise<string | null> => {
  try {
    const raw = readFileSync(storePath(key), 'utf-8')
    return Promise.resolve(raw)
  } catch {
    return Promise.resolve(null)
  }
})

ipcMain.handle('store-set', (_event, key: string, data: string): Promise<void> => {
  writeFileSync(storePath(key), data, 'utf-8')
  return Promise.resolve()
})

// ===================== OFFLINE DOWNLOADS =====================
// Only handles direct/progressive stream URLs — HLS (.m3u8) manifests would
// need segment fetching + concatenation, which the renderer skips over by
// only ever calling this for stream.kind === 'progressive' results from
// /api/stream/resolve.
const DOWNLOADS_DIR = 'downloads'

function downloadsDir(): string {
  const dir = join(app.getPath('userData'), DOWNLOADS_DIR)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function sanitizeTrackId(id: string): string {
  return id.replace(/[^a-z0-9_-]/gi, '_')
}

ipcMain.handle('download-track', async (_event, trackId: string, url: string): Promise<string> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
  const contentType = res.headers.get('content-type') || ''
  const ext = contentType.includes('mp4') || contentType.includes('m4a') ? 'm4a' : 'mp3'
  const filePath = join(downloadsDir(), `${sanitizeTrackId(trackId)}.${ext}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  writeFileSync(filePath, buffer)
  return filePath
})

ipcMain.handle('download-remove', (_event, filePath: string): Promise<void> => {
  try {
    unlinkSync(filePath)
  } catch {
    /* already gone */
  }
  return Promise.resolve()
})

ipcMain.handle('get-app-version', (): string => app.getVersion())

// ===================== DISCORD RPC =====================
ipcMain.handle(
  'discord-update-presence',
  (
    _event,
    data: {
      trackName: string
      artist: string
      currentTime: number
      duration: number
      artworkUrl: string
      isPlaying: boolean
    }
  ): void => {
    updatePresence({
      trackName: data.trackName,
      artist: data.artist,
      currentTime: data.currentTime,
      duration: data.duration,
      artworkUrl: data.artworkUrl || undefined,
    })
  }
)

ipcMain.handle('discord-clear-presence', (): void => {
  clearPresence()
})

ipcMain.on('notification:action:restart', (): void => {
  autoUpdater.quitAndInstall()
})

function checkRussianIp(): void {
  https.get('https://ip-api.com/json/', (res) => {
    let data = ''
    res.on('data', (chunk) => (data += chunk))
    res.on('end', () => {
      try {
        const geo = JSON.parse(data)
        if (geo.countryCode === 'RU') {
          mainWindowRef?.webContents.send('notification:show', {
            type: 'vpn',
            title: 'vpn',
            message: ''
          })
        }
      } catch {
        /* ignore */
      }
    })
  }).on('error', () => {
    /* ignore */
  })
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace('v', '').split('.').map(Number)
  const pb = b.replace('v', '').split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

function checkDevUpdate(): void {
  const currentVersion = app.getVersion()
  console.log('')
  console.log('Checking for updates')
  console.log('')
  console.log(`Current version: ${currentVersion}`)

  const repo = 'blueberry-devs/blueberry-desktop'
  https.get(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { 'User-Agent': 'blueberry-desktop' } }, (res) => {
    let data = ''
    res.on('data', (chunk) => (data += chunk))
    res.on('end', () => {
      try {
        const release = JSON.parse(data)
        const latestVersion = release.tag_name || release.name || ''
        console.log(`Latest version: ${latestVersion}`)

        if (compareVersions(currentVersion, latestVersion) < 0) {
          console.log(`Update available: ${latestVersion}`)
          if (!app.isPackaged) {
            console.log('Run git pull && npm run build to update.')
          }
          mainWindowRef?.webContents.send('notification:show', {
            type: 'update',
            title: 'update',
            message: latestVersion
          })
        } else {
          console.log('Your version is up to date')
          mainWindowRef?.webContents.send('notification:show', {
            type: 'uptodate',
            title: 'uptodate',
            message: ''
          })
        }
      } catch {
        /* ignore */
      }
    })
  }).on('error', () => {
    /* ignore */
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.blueberry.desktop')
  app.name = 'Яндекс Музыка'

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  startSidecar()
  createWindow()
  setupAutoUpdater()
  // Give the window a moment to actually show before nagging about updates.
  setTimeout(() => checkForUpdates(false), 5000)
  setTimeout(() => checkDevUpdate(), 3000)
  setTimeout(() => checkRussianIp(), 8000)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Don't quit — app stays in tray. Quit only via tray menu.
})

app.on('before-quit', () => {
  isQuitting = true
  stopSidecar()
  destroyDiscord()
})
