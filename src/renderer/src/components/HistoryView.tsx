import { useHistory, clearHistory } from '../store/history'
import { usePlayer } from '../player/PlayerContext'
import { requestArtistSearch } from '../store/searchQuery'
import TrackRow from './TrackRow'
import './HistoryView.css'

function HistoryView(): JSX.Element {
  const history = useHistory()
  const { playQueue } = usePlayer()

  return (
    <div className="history-view view-enter">
      <div className="history-view__header">
        <h1 className="history-view__title">История</h1>
        {history.length > 0 && (
          <button className="history-view__clear" onClick={clearHistory}>
            Очистить
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="history-view__empty">
          Здесь появятся треки, которые вы недавно слушали.
        </div>
      ) : (
        <>
          <div className="history-view__hero-card" onClick={() => playQueue(history, 0)}>
            <div className="history-view__hero-icon">
              <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="#fff" strokeWidth="1.4" />
                <path d="M9 5v4l3 2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="history-view__hero-meta">
              <div className="history-view__hero-title">Слушать всё подряд</div>
              <div className="history-view__hero-sub">{history.length} треков</div>
            </div>
          </div>

          <div className="history-view__list">
            {history.map((track, index) => (
              <TrackRow key={track.id} track={track} queue={history} index={index} onArtistClick={requestArtistSearch} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default HistoryView
