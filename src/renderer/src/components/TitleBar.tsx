import { useAppVersion } from '../hooks/useAppVersion'
import './TitleBar.css'

function handleMinimize(): void {
  window.api?.minimize()
}
function handleMaximize(): void {
  window.api?.maximize()
}
function handleClose(): void {
  window.api?.close()
}

function TitleBar(): JSX.Element {
  const version = useAppVersion()
  return (
    <div className="titlebar">
      <div className="titlebar__drag" />
      <div className="titlebar__version">{version}</div>
      <div className="titlebar__controls">
        <button className="titlebar__btn" onClick={handleMinimize} aria-label="minimize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button className="titlebar__btn" onClick={handleMaximize} aria-label="maximize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        </button>
        <button className="titlebar__btn titlebar__btn--close" onClick={handleClose} aria-label="close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar
