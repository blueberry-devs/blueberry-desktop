import { useEffect, useState } from 'react'

// Single source of truth is package.json's "version" — Electron's
// app.getVersion() reads it directly, so there's nothing to keep in sync
// by hand across the titlebar badge and the settings "About" row.
export function useAppVersion(): string {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.getAppVersion().then(setVersion).catch(() => {})
  }, [])

  return version
}
