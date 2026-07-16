import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { spawn, execSync, ChildProcessWithoutNullStreams } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let sidecar: ChildProcessWithoutNullStreams | null = null
let tray: Tray | null = null
let trayMenuTemplate: Electron.MenuItemConstructorOptions[] | null = null
let isQuitting = false
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
    }
  })

  sidecar.stderr.on('data', (data) => {
    const text = data.toString()
    console.error(`[sidecar] ${text}`)
    if (!started && text.includes('Uvicorn running')) {
      started = true
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
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: '#000000',
    // .ico carries multiple embedded resolutions — crisper taskbar/alt-tab
    // icon on Windows than a single PNG.
    icon: join(__dirname, process.platform === 'win32' ? '../../resources/icon.ico' : '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  createTray(mainWindow)
}

function createTray(mainWindow: BrowserWindow): void {
  const iconPath = join(
    __dirname,
    process.platform === 'win32' ? '../../resources/icon.ico' : '../../resources/icon.png'
  )
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.yandex.music.clone')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  startSidecar()
  createWindow()

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
})
