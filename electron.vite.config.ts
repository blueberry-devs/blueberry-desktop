import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

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
    plugins: [react()],
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
