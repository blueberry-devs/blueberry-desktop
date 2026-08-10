import { spawn } from 'node:child_process'
import process from 'node:process'

const mobile = process.argv.includes('--mobile')
const tauriArgs = process.argv.slice(2).filter((arg) => arg !== '--mobile' && arg !== '--')

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const child = spawn(command, ['exec', 'tauri', 'dev', ...tauriArgs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    ...(mobile ? { VITE_MOBILE: 'true' } : {}),
  },
})

child.on('close', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})

child.on('error', (error) => {
  console.error(`Failed to start Tauri: ${error.message}`)
  process.exitCode = 1
})
