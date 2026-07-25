import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const resourcesDir = resolve(__dirname, 'resources')

function serveResourcesPlugin(): import('vite').Plugin {
  return {
    name: 'serve-resources',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const filePath = resolve(resourcesDir, '.' + url)
        if (!filePath.startsWith(resourcesDir)) { next(); return }
        try {
          if (!fs.statSync(filePath).isFile()) { next(); return }
          const ext = url.split('.').pop() ?? ''
          const mime: Record<string, string> = {
            ttf: 'font/ttf', png: 'image/png', avif: 'image/avif',
            mp4: 'video/mp4', webm: 'video/webm', svg: 'image/svg+xml',
            ico: 'image/x-icon', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            gif: 'image/gif',
          }
          res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream')
          res.end(fs.readFileSync(filePath))
        } catch { next() }
      })
    },
    closeBundle() {
      const out = resolve(__dirname, 'out', 'renderer')
      if (!fs.existsSync(out)) return
      const copyDir = (src: string, dst: string): void => {
        if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true })
        for (const e of fs.readdirSync(src)) {
          const s = resolve(src, e), d = resolve(dst, e)
          if (fs.statSync(s).isDirectory()) copyDir(s, d)
          else fs.copyFileSync(s, d)
        }
      }
      copyDir(resourcesDir, out)
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.YANDEX_TOKEN': JSON.stringify(process.env.YANDEX_TOKEN || ''),
      'process.env.YANDEX_PROXY_URL': JSON.stringify(process.env.YANDEX_PROXY_URL || ''),
      'process.env.SOUNDCLOUD_CLIENT_ID': JSON.stringify(process.env.SOUNDCLOUD_CLIENT_ID || '')
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), serveResourcesPlugin()],
    base: './',
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
        output: {
          manualChunks(id: string) {
            if (id.includes('react-dom') || id.includes('react/')) return 'vendor'
            if (id.includes('motion')) return 'motion'
            if (id.includes('hls.js')) return 'hls'
          }
        }
      }
    }
  }
})
