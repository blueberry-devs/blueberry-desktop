import { useState, useEffect, useCallback } from 'react'
import { isAuthenticated, getAuth } from '../store/auth'
import { restorePlaylist, forceDeletePlaylist } from '../store/playlists'
import { useDeletedPlaylists } from '../store/deletedPlaylists'
import { fetchDeletedCloudPlaylists, fetchCloudPlaylists, restoreCloudPlaylist as apiRestoreCloudPlaylist, forceDeleteCloudPlaylist as apiForceDeleteCloudPlaylist, type CloudPlaylistSummary } from '../services/playlists'
import { setCloudPlaylists } from '../store/cloudPlaylists'
import { useTranslation } from '../utils/useTranslation'
import Modal from './Modal'
import './TrashView.css'

interface Props {
  onBack: () => void
}

function TrashView({ onBack }: Props): JSX.Element {
  const { t } = useTranslation()
  const deletedLocal = useDeletedPlaylists()
  const [apiDeletedCloudPls, setApiDeletedCloudPls] = useState<CloudPlaylistSummary[]>([])
  const [hasShown, setHasShown] = useState(false)
  const [forceConfirm, setForceConfirm] = useState<{ name: string; id: string; type: 'local' | 'cloud' } | null>(null)

  const loadDeleted = useCallback(async () => {
    if (!isAuthenticated()) return
    const token = getAuth().accessToken!
    const deleted = await fetchDeletedCloudPlaylists(token)
    if (Array.isArray(deleted)) setApiDeletedCloudPls(deleted)
  }, [])

  useEffect(() => {
    if (!hasShown) {
      loadDeleted()
      setHasShown(true)
    }
  }, [loadDeleted, hasShown])

  // Filter out API items that already have a matching local trash entry (same cloudId)
  const localCloudIds = new Set(deletedLocal.map((d) => d.playlist.cloudId).filter(Boolean))
  const dedupedApiDeleted = apiDeletedCloudPls.filter((pl) => !localCloudIds.has(pl.id))

  const hasItems = deletedLocal.length > 0 || dedupedApiDeleted.length > 0

  return (
    <div className="trash-view view-enter">
      <button className="trash-view__back" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t('collection.back')}
      </button>

      <div className="trash-view__header">
        <div className="trash-view__icon">
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6.5 7v5M9.5 7v5M3.5 4l.8 9.2a1 1 0 0 0 1 .8h5.4a1 1 0 0 0 1-.8l.8-9.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="trash-view__meta">
          <h1 className="trash-view__title">{t('trash.title')}</h1>
          <div className="trash-view__sub">
            {t('trash.totalCount').replace('{n}', String(deletedLocal.length + dedupedApiDeleted.length))}
          </div>
        </div>
      </div>

      {!hasItems && (
        <div className="trash-view__empty">
          <p>{t('trash.empty')}</p>
          <p className="trash-view__empty-hint">{t('trash.emptyHint')}</p>
        </div>
      )}

      <div className="trash-view__list">
        {deletedLocal.map((d) => (
          <div key={d.playlist.id} className="trash-view__item">
            <div className="trash-view__cover" style={d.playlist.cover ? { backgroundImage: `url(${d.playlist.cover})` } : undefined}>
              {!d.playlist.cover && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3 14 9 20 7 16 12 21 14 14 15.5 16 21 10.5 17 6 21 7.5 14.5 2 13 7.5 10 6 4 Z" fill="#ffdb4d" />
                </svg>
              )}
            </div>
            <div className="trash-view__info">
              <div className="trash-view__name">{d.playlist.name}</div>
              <div className="trash-view__count">{t('collection.trackCount').replace('{n}', String(d.playlist.tracks.length))}</div>
            </div>
            <div className="trash-view__actions">
              <button
                className="trash-view__restore"
                onClick={() => restorePlaylist(d.playlist.id)}
                title={t('trash.restore')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M12.5 1.5V5H9M3.5 14.5V11H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('trash.restore')}
              </button>
              <button
                className="trash-view__force"
                onClick={() => setForceConfirm({ name: d.playlist.name, id: d.playlist.id, type: 'local' })}
                title={t('trash.deleteForever')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6.5 7v5M9.5 7v5M3.5 4l.8 9.2a1 1 0 0 0 1 .8h5.4a1 1 0 0 0 1-.8l.8-9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('trash.deleteForeverShort')}
              </button>
            </div>
          </div>
        ))}

        {dedupedApiDeleted.map((pl) => (
          <div key={pl.id} className="trash-view__item">
            <div className="trash-view__cover" style={pl.imageUrl ? { backgroundImage: `url(${pl.imageUrl})` } : undefined}>
              {!pl.imageUrl && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="currentColor" opacity="0.6"/>
                </svg>
              )}
            </div>
            <div className="trash-view__info">
              <div className="trash-view__name">{pl.title}</div>
              <div className="trash-view__count">{t('collection.trackCount').replace('{n}', String(pl.trackCount))}</div>
            </div>
            <div className="trash-view__actions">
              <button
                className="trash-view__restore"
                onClick={async () => {
                  const token = getAuth().accessToken
                  if (!token) return
                  const ok = await apiRestoreCloudPlaylist(token, pl.id)
                  if (ok) {
                    setApiDeletedCloudPls((prev) => prev.filter((p) => p.id !== pl.id))
                    const cloud = await fetchCloudPlaylists(token)
                    setCloudPlaylists(cloud)
                  }
                }}
                title={t('trash.restore')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M12.5 1.5V5H9M3.5 14.5V11H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('trash.restore')}
              </button>
              <button
                className="trash-view__force"
                onClick={() => setForceConfirm({ name: pl.title, id: pl.id, type: 'cloud' })}
                title={t('trash.deleteForever')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6.5 7v5M9.5 7v5M3.5 4l.8 9.2a1 1 0 0 0 1 .8h5.4a1 1 0 0 0 1-.8l.8-9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('trash.deleteForeverShort')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {forceConfirm && (
        <Modal
          open
          title={t('trash.deleteConfirmTitle')}
          message={t('trash.deleteConfirmMessage').replace('{name}', forceConfirm.name)}
          confirmLabel={t('playlist.deleteConfirmBtn')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            if (forceConfirm.type === 'local') {
              forceDeletePlaylist(forceConfirm.id)
            } else {
              const token = getAuth().accessToken
              if (token) {
                apiForceDeleteCloudPlaylist(token, forceConfirm.id).then(() => {
                  setApiDeletedCloudPls((prev) => prev.filter((p) => p.id !== forceConfirm.id))
                })
              }
            }
            setForceConfirm(null)
          }}
          onCancel={() => setForceConfirm(null)}
        />
      )}
    </div>
  )
}

export default TrashView
