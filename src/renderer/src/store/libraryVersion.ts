import { createStore } from '../services/store'

const store = createStore<number>('libraryVersion', 0)

/**
 * Current known library version.
 * 0 means "never synced" — client must do a full offline→online sync.
 */
export function getLibraryVersion(): number {
  return store.get()
}

export function setLibraryVersion(version: number): void {
  if (version > store.get()) {
    store.set(version)
  }
}

export function useLibraryVersion(): number {
  return store.useValue()
}
