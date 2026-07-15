import { useEffect, useRef, useState } from 'react'
import { TrackResult } from '../api/yandexMusic'
import { addTrackToPlaylist, createPlaylist, usePlaylists } from '../store/playlists'
import './AddToPlaylistMenu.css'

function AddToPlaylistMenu({ track }: { track: TrackResult }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const playlists = usePlaylists()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const handleAdd = (playlistId: string): void => {
    addTrackToPlaylist(playlistId, track)
    setAdded(playlistId)
    setTimeout(() => setAdded(null), 900)
  }

  const handleCreate = (): void => {
    if (!name.trim()) return
    const playlist = createPlaylist(name)
    addTrackToPlaylist(playlist.id, track)
    setName('')
    setCreating(false)
    setOpen(false)
  }

  return (
    <div className="add-to-playlist" ref={ref}>
      <button
        className="add-to-playlist__trigger"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        title="Добавить в плейлист"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="add-to-playlist__menu" onClick={(e) => e.stopPropagation()}>
          {playlists.length === 0 && !creating && (
            <div className="add-to-playlist__empty">Плейлистов пока нет</div>
          )}
          {playlists.map((p) => (
            <button key={p.id} className="add-to-playlist__item" onClick={() => handleAdd(p.id)}>
              <span className="add-to-playlist__item-cover" style={p.cover ? { backgroundImage: `url(${p.cover})` } : undefined} />
              <span className="add-to-playlist__item-name">{p.name}</span>
              {added === p.id && <span className="add-to-playlist__check">✓</span>}
            </button>
          ))}

          {creating ? (
            <div className="add-to-playlist__create-row">
              <input
                autoFocus
                className="add-to-playlist__input"
                placeholder="Название плейлиста"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button className="add-to-playlist__create-confirm" onClick={handleCreate}>
                OK
              </button>
            </div>
          ) : (
            <button className="add-to-playlist__new" onClick={() => setCreating(true)}>
              + Создать плейлист
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AddToPlaylistMenu
