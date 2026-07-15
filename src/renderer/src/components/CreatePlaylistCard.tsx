import { useRef, useState } from 'react'
import { createPlaylist } from '../store/playlists'
import './CreatePlaylistCard.css'

function readFileAsDataUrl(file: File, onDone: (url: string) => void): void {
  const reader = new FileReader()
  reader.onload = () => onDone(reader.result as string)
  reader.readAsDataURL(file)
}

function CreatePlaylistModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [name, setName] = useState('')
  const [cover, setCover] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = (): void => {
    if (!name.trim()) return
    createPlaylist(name, cover)
    onClose()
  }

  return (
    <div className="cp-modal" onClick={onClose}>
      <div className="cp-modal__card view-enter" onClick={(e) => e.stopPropagation()}>
        <button className="cp-modal__close" onClick={onClose} aria-label="Закрыть">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="cp-modal__title">Новый плейлист</h2>

        <div className="cp-modal__body">
          <button
            className={`cp-modal__cover${dragging ? ' cp-modal__cover--dragging' : ''}`}
            onClick={() => fileRef.current?.click()}
            style={cover ? { backgroundImage: `url(${cover})` } : undefined}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files?.[0]
              if (file) readFileAsDataUrl(file, setCover)
            }}
          >
            {!cover && (
              <span className="cp-modal__cover-placeholder">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="8.5" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.1 0L4 19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span>Выберите обложку</span>
              </span>
            )}
            <span className="cp-modal__cover-hover">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.5" stroke="#fff" strokeWidth="1.5" />
              </svg>
              Изменить
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) readFileAsDataUrl(file, setCover)
            }}
          />

          <div className="cp-modal__fields">
            <label className="cp-modal__label">Название</label>
            <input
              className="cp-modal__input"
              placeholder="Например, «Вечерний плейлист»"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
              maxLength={60}
            />
            <p className="cp-modal__hint">Плейлист будет виден только вам — всё хранится локально.</p>
          </div>
        </div>

        <div className="cp-modal__actions">
          <button className="cp-modal__cancel" onClick={onClose}>
            Отмена
          </button>
          <button className="cp-modal__confirm" onClick={submit} disabled={!name.trim()}>
            Создать плейлист
          </button>
        </div>
      </div>
    </div>
  )
}

function CreatePlaylistCard(): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="create-playlist-card" onClick={() => setOpen(true)}>
        <span className="create-playlist-card__plus">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 3v16M3 11h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
        <span>Создать плейлист</span>
      </button>
      {open && <CreatePlaylistModal onClose={() => setOpen(false)} />}
    </>
  )
}

export default CreatePlaylistCard
