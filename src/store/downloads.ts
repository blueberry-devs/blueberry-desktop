import { useSyncExternalStore } from 'react'
import { TrackResult } from '../api/yandexMusic'

export interface DownloadedTrack extends TrackResult {
  localPath: string
}

const STORE_KEY = 'downloads'

let cache: Record<string, DownloadedTrack> = {}
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function persist(): void {
  window.api?.storeSet(STORE_KEY, JSON.stringify(cache)).catch(() => {})
}

// Defer storeGet until window.api is available (set by tauri-bridge)
function initStore(): void {
  window.api?.storeGet(STORE_KEY)
    .then((raw) => {
      if (raw) {
        cache = JSON.parse(raw) as Record<string, DownloadedTrack>
        emit()
      }
    })
    .catch(() => {})
}
if (typeof window !== 'undefined') {
  if (window.api) {
    initStore()
  } else {
    window.addEventListener('DOMContentLoaded', initStore)
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDownloads(): Record<string, DownloadedTrack> {
  return cache
}

export function getDownloadPath(id: string): string | null {
  return cache[id]?.localPath ?? null
}

export async function downloadTrack(track: TrackResult, streamUrl: string): Promise<void> {
  const localPath = await window.api.downloadTrack(track.id, streamUrl)
  cache = { ...cache, [track.id]: { ...track, localPath } }
  emit()
  persist()
}

export async function removeDownload(id: string): Promise<void> {
  const entry = cache[id]
  if (!entry) return
  await window.api.removeDownload(entry.localPath)
  const next = { ...cache }
  delete next[id]
  cache = next
  emit()
  persist()
}

export function useDownloads(): Record<string, DownloadedTrack> {
  return useSyncExternalStore(subscribe, getDownloads)
}
