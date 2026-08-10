import { spawn } from 'node:child_process'
import fs from 'node:fs'
import process from 'node:process'

const candidates = [
  process.env.JAVA_HOME,
  'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.11.10-hotspot',
  'C:\\Program Files\\Java\\jdk-21',
].filter(Boolean)

const javaHome = candidates.find((candidate) => fs.existsSync(`${candidate}\\bin\\java.exe`))
if (!javaHome) {
  console.error('JDK 21 was not found. Set JAVA_HOME to a JDK 21 installation.')
  process.exit(1)
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const env = { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}\\bin${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` }

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Command exited with code ${code}`)))
  })
}

try {
  await run(['run', 'build:server:android'])
  // The server sidecar is currently produced for the primary Android ABI.
  // Restrict the APK to arm64 instead of asking Tauri for four sidecars.
  await run(['exec', 'tauri', 'android', 'build', '--apk', '--target', 'aarch64'])
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
