import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src')
    }
  },
  plugins: [react()],
  publicDir: 'resources',
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 5174,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM === 'windows'
      ? 'chrome105'
      : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor'
          if (id.includes('motion')) return 'motion'
          if (id.includes('hls.js')) return 'hls'
        }
      }
    }
  },
})
