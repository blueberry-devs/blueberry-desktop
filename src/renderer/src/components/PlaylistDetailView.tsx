import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../utils/useTranslation'
import { usePlayer } from '../player/PlayerContext'
import { Playlist, moveTrackInPlaylist, deletePlaylist, removeTrackFromPlaylist, renamePlaylist, setPlaylistCover } from '../store/playlists'
import { requestArtistSearch } from '../store/searchQuery'
import TrackRow from './TrackRow'
import Modal from './Modal'
import './PlaylistDetailView.css'

function readFileAsDataUrl(file: File, onDone: (url: string) => void): void {
  const reader = new FileReader()
  reader.onload = () => onDone(reader.result as string)
  reader.readAsDataURL(file)
}

const ANIM_MS = 150

function EditPlaylistModal({ playlist, onClose }: { playlist: Playlist; onClose: () => void }): JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(playlist.name)
  const [cover, setCover] = useState<string | null>(playlist.cover)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    timer.current = setTimeout(onClose, ANIM_MS)
  }, [closing, onClose])

  const submit = (): void => {
    if (!name.trim()) return
    renamePlaylist(playlist.id, name)
    if (cover !== playlist.cover) {
      setPlaylistCover(playlist.id, cover)
    }
    close()
  }

  useEffect(() => {
    const el = document.querySelector('.playlist-detail') || document.querySelector('.app__content')
    if (el) (el as HTMLElement).style.overflow = 'hidden'
    return () => {
      if (el) (el as HTMLElement).style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault()
    document.addEventListener('wheel', preventScroll, { passive: false })
    document.addEventListener('touchmove', preventScroll, { passive: false })
    return () => {
      document.removeEventListener('wheel', preventScroll)
      document.removeEventListener('touchmove', preventScroll)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close])

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  return createPortal(
    <div className={`cp-modal${closing ? ' cp-modal--closing' : ''}`} onClick={close}>
      <div className="cp-modal__card" onClick={(e) => e.stopPropagation()}>
        <button className="cp-modal__close" onClick={close} aria-label={t('playlist.closeLabel')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="cp-modal__title">Редактировать плейлист</h2>

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
                <span>{t('playlist.chooseCover')}</span>
              </span>
            )}
            {cover && (
              <span className="cp-modal__cover-hover">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.5" stroke="#fff" strokeWidth="1.5" />
                </svg>
                {t('playlist.changeCover')}
              </span>
            )}
          </button>
          {cover && (
            <button
              className="cp-modal__cover-remove"
              onClick={() => setCover(null)}
              title="Удалить обложку"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Удалить обложку
            </button>
          )}
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
            <label className="cp-modal__label">{t('playlist.nameLabel')}</label>
            <input
              className="cp-modal__input"
              placeholder={t('playlist.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
              maxLength={60}
            />
          </div>
        </div>

        <div className="cp-modal__actions">
          <button className="cp-modal__cancel" onClick={close}>
            {t('common.cancel')}
          </button>
          <button className="cp-modal__confirm" onClick={submit} disabled={!name.trim()}>
            Сохранить
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface Props {
  playlist: Playlist
  onBack: () => void
  onDelete?: () => Promise<void> | void
  readonly?: boolean
}

function PlaylistDetailView({ playlist, onBack, onDelete, readonly = false }: Props): JSX.Element {
  const { playQueue } = usePlayer()
  const { t } = useTranslation()
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const handleDeleteConfirmed = async (): Promise<void> => {
    setShowDeleteConfirm(false)
    if (onDelete) {
      await onDelete()
    } else {
      deletePlaylist(playlist.id)
    }
    onBack()
  }

  const handleDragStart = (i: number) => (): void => {
    dragIndexRef.current = i
  }

  const handleDragOver = (i: number) => (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOverIndex(i)
  }

  const handleDragLeave = (): void => {
    setDragOverIndex(null)
  }

  const handleDrop = (toIndex: number) => (): void => {
    const fromIndex = dragIndexRef.current
    dragIndexRef.current = null
    setDragOverIndex(null)
    if (fromIndex === null || fromIndex === toIndex) return
    moveTrackInPlaylist(playlist.id, fromIndex, toIndex)
  }

  const handleDragEnd = (): void => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  return (
    <div className="playlist-detail view-enter">
      <button className="playlist-detail__back" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t('collection.back')}
      </button>

      <div className="playlist-detail__header">
        <div className="playlist-detail__cover" style={playlist.cover ? { backgroundImage: `url(${playlist.cover})` } : undefined}>
          {!playlist.cover && playlist.id === '__liked__' ? (
            <svg width="40" height="40" viewBox="0 0 18 18" fill="none">
              <path d="M9 15.5S2 11.2 2 6.8C2 4.4 3.9 2.8 6 2.8c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.1 0 4 1.6 4 4 0 4.4-7 8.7-7 8.7Z" fill="#ff4d6d" />
            </svg>
          ) : !playlist.cover && (
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M20 6 L23 15 L32 12 L26 20 L34 24 L23 26 L26 34 L18 27 L11 34 L13 25 L4 22 L13 18 L11 10 Z" fill="#ffdb4d" />
            </svg>
          )}
        </div>
        <div className="playlist-detail__meta">
          <div className="playlist-detail__label">{playlist.id === '__liked__' ? t('playlist.likedLabel') : t('playlist.label')}</div>
          <h1 className="playlist-detail__title">{playlist.name}</h1>
          <div className="playlist-detail__sub">{t('collection.trackCount').replace('{n}', String(playlist.tracks.length))}</div>
          <div className="playlist-detail__actions">
            {playlist.tracks.length > 0 && (
              <button className="playlist-detail__play" onClick={() => playQueue(playlist.tracks, 0)}>
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <path d="M5.5 3.5l9 5.5-9 5.5Z" fill="#000" />
                </svg>
                {t('common.listen')}
              </button>
            )}
            {!readonly && (
              <button className="playlist-detail__edit" onClick={() => setShowEdit(true)} title="Редактировать">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M11.5 1.5a2.1 2.1 0 0 1 3 3L5 14H2v-3l9.5-9.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            {(!readonly || onDelete) && (
              <button className="playlist-detail__delete" onClick={() => setShowDeleteConfirm(true)} title={t('playlist.deleteTitle')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6.5 7v5M9.5 7v5M3.5 4l.8 9.2a1 1 0 0 0 1 .8h5.4a1 1 0 0 0 1-.8l.8-9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            )}
          </div>
        </div>
      </div>

      <div className="playlist-detail__tracks">
        {playlist.tracks.length === 0 ? (
          <div className="playlist-detail__empty">
            {t('playlist.addTracksHint')}
          </div>
        ) : (
          playlist.tracks.map((t, i) => (
            <div
              key={t.id}
              draggable
              onDragStart={handleDragStart(i)}
              onDragOver={handleDragOver(i)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(i)}
              onDragEnd={handleDragEnd}
              style={{ opacity: dragOverIndex === i ? 0.5 : 1, transition: 'opacity 0.15s' }}
            >
              <TrackRow track={t} queue={playlist.tracks} index={i} onArtistClick={requestArtistSearch} onRemoveFromPlaylist={readonly ? undefined : () => removeTrackFromPlaylist(playlist.id, t.id)} />
            </div>
          ))
        )}
      </div>

      <Modal
        open={showDeleteConfirm}
        title={playlist.id === '__liked__' ? 'Мне нравится' : 'Удалить плейлист'}
        message={playlist.id === '__liked__' ? 'Удалить все треки из «Мне нравится»?' : `Переместить плейлист «${playlist.name}» в корзину?`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {showEdit && <EditPlaylistModal playlist={playlist} onClose={() => setShowEdit(false)} />}
    </div>
  )
}

export default PlaylistDetailView
