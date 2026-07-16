import { useProfile, setAllowExplicit, setVideoBackground } from '../store/profile'
import { usePlayer } from '../player/PlayerContext'
import { useAppVersion } from '../hooks/useAppVersion'
import { ShieldIcon, InfoIcon, PlayIcon } from './icons'
import './SettingsView.css'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      className={`settings-toggle${checked ? ' settings-toggle--on' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle__knob" />
    </button>
  )
}

function SettingsView(): JSX.Element {
  const profile = useProfile()
  const { crossfade, setCrossfade } = usePlayer()
  const version = useAppVersion()

  return (
    <div className="settings-view view-enter">
      <h1 className="settings-view__title">Настройки</h1>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title">
          <span className="settings-view__section-icon"><PlayIcon size={14} /></span>
          Плеер
        </h2>
        <div className="settings-view__row">
          <div className="settings-view__row-text">
            <div className="settings-view__row-label">Видео-фон в полноэкранном режиме</div>
            <div className="settings-view__row-hint">
              Ищет клип трека на YouTube и проигрывает его вместо размытой обложки на фоне. Выключите, если не хотите
              лишних сетевых запросов или предпочитаете обложку.
            </div>
          </div>
          <Toggle checked={profile.videoBackground} onChange={setVideoBackground} />
        </div>
        <div className="settings-view__row">
          <div className="settings-view__row-text">
            <div className="settings-view__row-label">Плавный переход между треками</div>
            <div className="settings-view__row-hint">Кроссфейд в конце трека вместо резкой смены.</div>
          </div>
          <Toggle checked={crossfade} onChange={setCrossfade} />
        </div>
      </section>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title">
          <span className="settings-view__section-icon"><ShieldIcon size={14} /></span>
          Контент
        </h2>
        <div className="settings-view__row">
          <div className="settings-view__row-text">
            <div className="settings-view__row-label">
              Показывать контент 18+
              <span className="settings-view__explicit-badge">!</span>
            </div>
            <div className="settings-view__row-hint">
              Треки с ненормативной лексикой и другим взрослым контентом помечены значком «!». Выключите, чтобы они
              не попадали в поиск, «Мою волну» и чарты.
            </div>
          </div>
          <Toggle checked={profile.allowExplicit} onChange={setAllowExplicit} />
        </div>
      </section>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title">
          <span className="settings-view__section-icon"><InfoIcon size={14} /></span>
          О приложении
        </h2>
        <div className="settings-view__about">
          <div className="settings-view__about-row">
            <span>Версия</span>
            <span className="settings-view__about-value">{version}</span>
          </div>
          <div className="settings-view__about-row">
            <span>Сборка</span>
            <span className="settings-view__about-value">Blueberry Wave</span>
          </div>
        </div>
      </section>
    </div>
  )
}

export default SettingsView
