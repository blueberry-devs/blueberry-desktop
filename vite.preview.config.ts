import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const resourcesDir = resolve(__dirname, 'resources')

export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [
    react(),
    {
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
              ico: 'image/x-icon', jpg: 'image/jpeg',
            }
            res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream')
            res.end(fs.readFileSync(filePath))
          } catch { next() }
        })
      }
    }
  ],
  server: { port: 5183 }
})
