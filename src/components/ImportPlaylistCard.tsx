import { useEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { addTrackToPlaylist, createPlaylist } from '../store/playlists'
import { importPlaylistFromUrl, readSpotifyJson } from '../services/playlistImport'
import { searchTracksMulti } from '../api/yandexMusic'
import './CreatePlaylistCard.css'

function ImportPlaylistModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [closing, setClosing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const close = (): void => {
    if (loading || closing) return
    setClosing(true)
    timer.current = setTimeout(onClose, 150)
  }

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })

  const submit = async (): Promise<void> => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setProgress('Читаю плейлист…')
    try {
      const imported = await importPlaylistFromUrl(url.trim())
      if (imported.tracks.length === 0) throw new Error('Не удалось найти треки в этом плейлисте')
      setProgress(`Добавляю ${imported.tracks.length} треков…`)
      const playlist = createPlaylist(imported.title, imported.cover)
      for (const track of imported.tracks) addTrackToPlaylist(playlist.id, track)
      const suffix = imported.unresolved > 0 ? ` Не найдено: ${imported.unresolved}.` : ''
      setProgress(`Готово: ${imported.tracks.length} треков.${suffix}`)
      setTimeout(onClose, 900)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось импортировать плейлист')
      setProgress('')
      setLoading(false)
    }
  }

  const importJson = async (file: File): Promise<void> => {
    setLoading(true)
    setError(null)
    setProgress('Читаю экспорт Spotify…')
    try {
      const imported = await readSpotifyJson(file)
      const found = []
      for (let index = 0; index < imported.tracks.length; index += 1) {
        const item = imported.tracks[index]
        setProgress(`Ищу трек ${index + 1} из ${imported.tracks.length}…`)
        const matches = await searchTracksMulti(`${item.artist} ${item.title}`)
        if (matches[0]) found.push(matches[0])
      }
      if (found.length === 0) throw new Error('Не удалось найти треки в источниках')
      const playlist = createPlaylist(imported.title, null)
      for (const track of found) addTrackToPlaylist(playlist.id, track)
      setProgress(`Готово: ${found.length} из ${imported.tracks.length} треков.`)
      setTimeout(onClose, 900)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось импортировать JSON')
      setProgress('')
      setLoading(false)
    }
  }

  return createPortal(
    <div className={`cp-modal${closing ? ' cp-modal--closing' : ''}`} onClick={close}>
      <div className="cp-modal__card" onClick={(event) => event.stopPropagation()}>
        <button className="cp-modal__close" onClick={close} aria-label="Закрыть">×</button>
        <h2 className="cp-modal__title">Импорт плейлиста</h2>
        <div className="cp-modal__fields" style={{ marginTop: 20 }}>
          <label className="cp-modal__label">Ссылка на плейлист</label>
          <input
            className="cp-modal__input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void submit()}
            placeholder="Spotify, SoundCloud или YouTube Music"
            autoFocus
            disabled={loading}
          />
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importJson(file)
            event.target.value = ''
          }} />
          <button className="cp-modal__cancel" onClick={() => fileRef.current?.click()} disabled={loading}>
            Выбрать Spotify JSON
          </button>
          <p className="cp-modal__hint">Плейлист должен быть доступен по ссылке. Треки будут найдены в Yandex Music, SoundCloud и YouTube.</p>
          {progress && <p className="cp-modal__hint">{progress}</p>}
          {error && <p className="collection-view__status collection-view__status--error">{error}</p>}
        </div>
        <div className="cp-modal__actions">
          <button className="cp-modal__cancel" onClick={close} disabled={loading}>Отмена</button>
          <button className="cp-modal__confirm" onClick={() => void submit()} disabled={!url.trim() || loading}>
            {loading ? 'Импорт…' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function ImportPlaylistCard(): JSX.Element {
  const [open, setOpen] = useState(false)
  return <>
    <button className="create-playlist-card" onClick={() => setOpen(true)}>
      <span className="create-playlist-card__plus">↓</span>
      <span>Импортировать</span>
    </button>
    {open && <ImportPlaylistModal onClose={() => setOpen(false)} />}
  </>
}
