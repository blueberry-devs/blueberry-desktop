import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, session } from 'electron'
import https from 'https'

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

if (!is.dev) {
  app.commandLine.appendSwitch('enable-accelerated-video-decode')
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
  app.commandLine.appendSwitch('enable-gpu-rasterization')
}
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { spawn, execSync, ChildProcessWithoutNullStreams } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { updatePresence, clearPresence, destroy as destroyDiscord } from './discord'
import log from 'electron-log'

let sidecar: ChildProcessWithoutNullStreams | null = null
let tray: Tray | null = null
let trayMenuTemplate: Electron.MenuItemConstructorOptions[] | null = null
let isQuitting = false
let mainWindowRef: BrowserWindow | null = null
const SIDECAR_PORT = 8787

// Sidecar auto-restart state
let restartCount = 0
const MAX_RESTART_ATTEMPTS = 10
let restartTimer: ReturnType<typeof setTimeout> | null = null

function resolveServerExe(): string {
  if (is.dev) return ''
  const name = process.platform === 'win32' ? 'music-server.exe' : 'music-server'
  const exePath = join(process.resourcesPath, 'server', name)
  if (existsSync(exePath)) return exePath
  return ''
}

function resolveServerDir(): string {
  if (!is.dev) {
    const exePath = resolveServerExe()
    if (exePath) return join(process.resourcesPath, 'server')
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
          log.info(`[sidecar] killed orphaned process tree on port ${port} (pid ${pid})`)
        } catch (e) {
          log.warn('[sidecar] orphan kill race on pid', pid, e)
        }
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' })
      for (const pid of out.split('\n').map((p) => p.trim()).filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`)
          log.info(`[sidecar] killed orphaned process on port ${port} (pid ${pid})`)
        } catch (e) {
          log.warn('[sidecar] orphan kill race on pid', pid, e)
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

function pollServer(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const poll = (): void => {
      if (Date.now() > deadline) {
        reject(new Error('server did not start within ' + timeoutMs + 'ms'))
        return
      }
      fetch(`http://127.0.0.1:${port}/api/status`)
        .then(() => resolve())
        .catch(() => setTimeout(poll, 200))
    }
    poll()
  })
}

function scheduleRestart(): void {
  if (isQuitting) return
  restartCount++
  if (restartCount > MAX_RESTART_ATTEMPTS) {
    log.error('[sidecar] max restart attempts reached, giving up')
    return
  }
  const delay = Math.min(1000 * restartCount, 10_000)
  log.info(`[sidecar] restarting in ${delay}ms (attempt ${restartCount}/${MAX_RESTART_ATTEMPTS})`)
  restartTimer = setTimeout(() => {
    restartTimer = null
    startSidecar()
  }, delay)
}

function loadEnvFile(dir: string): Record<string, string> {
  const envPath = join(dir, '.env')
  try {
    const raw = readFileSync(envPath, 'utf-8')
    const vars: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
    }
    return vars
  } catch {
    return {}
  }
}

function startSidecar(): void {
  // Prevent old sidecar's exit from triggering restart while we intentionally replace it
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  if (sidecar) {
    sidecar = null
  }

  const serverDir = resolveServerDir()
  const exePath = resolveServerExe()

  let entry: string | null = null

  if (exePath) {
    entry = exePath
  } else {
    const devPaths = [
      join(serverDir, 'music-server.exe'),
      join(serverDir, 'target', 'release', 'music-server.exe'),
      join(serverDir, 'target', 'debug', 'music-server.exe'),
      join(serverDir, 'target', 'x86_64-pc-windows-gnu', 'release', 'music-server.exe'),
    ]
    entry = devPaths.find((p) => existsSync(p)) ?? null
  }

  if (!entry) {
    log.warn('[sidecar] music-server.exe not found in', serverDir)
    return
  }

  restartCount++

  killExistingSidecar()

  const env = {
    ...process.env,
    SIDECAR_PORT: String(SIDECAR_PORT),
    YANDEX_TOKEN: process.env.YANDEX_TOKEN || '',
    YANDEX_PROXY_URL: process.env.YANDEX_PROXY_URL || '',
    SOUNDCLOUD_CLIENT_ID: process.env.SOUNDCLOUD_CLIENT_ID || '',
    ...loadEnvFile(serverDir),
  }
  const child = spawn(entry, [], {
    cwd: serverDir,
    env: { ...env, RUST_LOG: 'info,tower_http=info' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  sidecar = child

  child.stdout.on('data', (data) => {
    for (const line of data.toString().trim().split('\n')) {
      log.info(`[server] ${line}`)
    }
  })

  child.on('error', (err) => log.error('[sidecar] spawn failed:', err.message))

  child.on('exit', (code, signal) => {
    log.info(`[sidecar] exited code=${code} signal=${signal}`)
    if (sidecar === child) {
      sidecar = null
      scheduleRestart()
    }
  })

  if (is.dev) {
    // Dev mode: stderr → log.warn, poll /api/status for readiness
    child.stderr.on('data', (data) => {
      for (const line of data.toString().trim().split('\n')) {
        log.warn(`[server] ${line}`)
      }
    })

    let ready = false
    const readyTimeout = setTimeout(() => {
      if (!ready) log.warn('[sidecar] server not ready after 30s')
    }, 30_000)

    const poll = (): void => {
      if (ready) return
      fetch(`http://127.0.0.1:${SIDECAR_PORT}/api/status`)
        .then(() => {
          ready = true
          clearTimeout(readyTimeout)
          restartCount = 0
          mainWindowRef?.webContents.send('sidecar:ready')
          log.info('[sidecar] ready')
        })
        .catch(() => setTimeout(poll, 200))
    }
    poll()
  } else {
    // Production mode: detect readiness from stderr (tracing: "sidecar starting on http")
    let started = false
    child.stderr.on('data', (data) => {
      for (const line of data.toString().trim().split('\n')) {
        log.info(`[server] ${line}`)
        if (!started && line.includes('sidecar starting on http')) {
          started = true
          restartCount = 0
          mainWindowRef?.webContents.send('sidecar:ready')
        }
      }
    })
  }
}

function stopSidecar(): void {
  isQuitting = true
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
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
  })

  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  )

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
    log.info(`[updater] ${Math.round(info.percent)}% downloaded`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[updater] Update downloaded. Restart the app to install.')
    mainWindowRef?.webContents.send('notification:show', {
      type: 'update',
      title: 'update',
      message: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    log.error('[updater] error:', err.message)
  })
}

function checkForUpdates(manual: boolean): void {
  if (!app.isPackaged || updateCheckInFlight) return
  updateCheckInFlight = true

  log.info('[updater] checking for updates, current version:', app.getVersion())

  if (manual) {
    const onNotAvailable = (): void => {
      dialog.showMessageBox({ type: 'info', title: 'Обновления', message: 'У вас уже последняя версия.' })
    }
    autoUpdater.once('update-not-available', onNotAvailable)
    autoUpdater.once('update-available', () => autoUpdater.removeListener('update-not-available', onNotAvailable))
  }

  autoUpdater
    .checkForUpdates()
    .catch((err) => log.error('[updater] check failed:', err.message))
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
      isPlaying: data.isPlaying,
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
      } catch (e) {
        log.warn('[vpn-check] geo parse failed:', e)
      }
    })
  }).on('error', (err) => {
    log.warn('[vpn-check] ip-api network error:', err.message)
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
  log.info('[updater] dev check, current version:', currentVersion)

  const repo = 'blueberry-devs/blueberry-desktop'
  https.get(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { 'User-Agent': 'blueberry-desktop' } }, (res) => {
    let data = ''
    res.on('data', (chunk) => (data += chunk))
    res.on('end', () => {
      try {
        const release = JSON.parse(data)
        const latestVersion = release.tag_name || release.name || ''
        if (compareVersions(currentVersion, latestVersion) < 0) {
          if (app.isPackaged) {
            log.info(`[updater] Update available: ${latestVersion}. electron-updater will handle the download.`)
            return
          }
          log.info('[updater] Run git pull && npm run build to update.')
          mainWindowRef?.webContents.send('notification:show', {
            type: 'update',
            title: 'update',
            message: latestVersion
          })
        } else {
          log.info('[updater] up to date')
          mainWindowRef?.webContents.send('notification:show', {
            type: 'uptodate',
            title: 'uptodate',
            message: ''
          })
        }
      } catch (e) {
        log.warn('[updater] dev check parse error:', e)
      }
    })
  }).on('error', (err) => {
    log.warn('[updater] dev check network error:', err.message)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.blueberry.desktop')
  app.name = 'Яндекс Музыка'

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  log.initialize()
  startSidecar()
  createWindow()
  setupAutoUpdater()
  // Give the window a moment to actually show before nagging about updates.
  setTimeout(() => checkForUpdates(false), 5000)
  setTimeout(() => checkDevUpdate(), 3000)
  if (!is.dev) {
    setTimeout(() => checkRussianIp(), 8000)
    clearPresence().catch(() => {})
  }

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

process.on('exit', stopSidecar)
