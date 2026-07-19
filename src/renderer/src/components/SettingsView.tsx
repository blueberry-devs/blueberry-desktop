import { useTranslation } from '../utils/useTranslation'
import { useProfile, setAllowExplicit, setVideoBackground, setNavbarPosition, setLanguage, type NavbarPosition } from '../store/profile'
import { usePlayer } from '../player/PlayerContext'
import { useAppVersion } from '../hooks/useAppVersion'
import { ShieldIcon, InfoIcon, PlayIcon, Maximize2Icon } from './icons'
import './SettingsView.css'

const NAVBAR_OPTIONS: { value: NavbarPosition; label: string }[] = [
  { value: 'left', label: 'Слева' },
  { value: 'top', label: 'Сверху' },
  { value: 'bottom', label: 'Снизу' }
]

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
  const { t } = useTranslation()

  return (
    <div className="settings-view view-enter">
      <h1 className="settings-view__title">{t('settings.title')}</h1>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title">
          <span className="settings-view__section-icon"><Maximize2Icon size={14} /></span>
          {t('settings.general')}
        </h2>
        <div className="settings-view__row">
          <div className="settings-view__row-text">
            <div className="settings-view__row-label">{t('settings.navPosition')}</div>
            <div className="settings-view__row-hint">{t('settings.navHint')}</div>
          </div>
          <div className="settings-view__segmented">
            {NAVBAR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings-view__segmented-item${profile.navbarPosition === opt.value ? ' settings-view__segmented-item--active' : ''}`}
                onClick={() => setNavbarPosition(opt.value)}
              >
                {t('settings.nav' + opt.value.charAt(0).toUpperCase() + opt.value.slice(1))}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title">
          <span className="settings-view__section-icon"><PlayIcon size={14} /></span>
          Плеер
        </h2>
        <div className="settings-view__row">
          <div className="settings-view__row-text">
            <div className="settings-view__row-label">{t('settings.videoBg')}</div>
            <div className="settings-view__row-hint">{t('settings.videoBgHint')}</div>
          </div>
          <Toggle checked={profile.videoBackground} onChange={setVideoBackground} />
        </div>
        <div className="settings-view__row">
          <div className="settings-view__row-text">
            <div className="settings-view__row-label">{t('settings.crossfade')}</div>
            <div className="settings-view__row-hint">{t('settings.crossfadeHint')}</div>
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
              {t('settings.explicitTitle')}
              <span className="settings-view__explicit-badge">!</span>
            </div>
            <div className="settings-view__row-hint">{t('settings.explicitHint')}</div>
          </div>
          <Toggle checked={profile.allowExplicit} onChange={setAllowExplicit} />
        </div>
      </section>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title">{t('settings.language')}</h2>
        <div className="settings-view__row">
          <div className="settings-view__row-text">
            <div className="settings-view__row-label">{t('settings.languageLabel')}</div>
          </div>
          <select
            className="settings-view__select"
            value={profile.language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="ru">{t('settings.langRu')}</option>
            <option value="en">{t('settings.langEn')}</option>
          </select>
        </div>
      </section>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title">
          <span className="settings-view__section-icon"><InfoIcon size={14} /></span>
          {t('settings.hotkeysTitle')}
        </h2>
        <div className="settings-view__about">
          <div className="settings-view__about-row">
            <span>{t('settings.hotkeyPlay')}</span>
            <span className="settings-view__about-value">Пробел</span>
          </div>
          <div className="settings-view__about-row">
            <span>{t('settings.hotkeySearch')}</span>
            <span className="settings-view__about-value">Ctrl+K</span>
          </div>
          <div className="settings-view__about-row">
            <span>{t('settings.hotkeyNextPrev')}</span>
            <span className="settings-view__about-value">Ctrl+→ / Ctrl+←</span>
          </div>
          <div className="settings-view__about-row">
            <span>{t('settings.hotkeyLike')}</span>
            <span className="settings-view__about-value">Ctrl+L</span>
          </div>
          <div className="settings-view__about-row">
            <span>{t('settings.hotkeyCloseFullscreen')}</span>
            <span className="settings-view__about-value">Esc</span>
          </div>
        </div>
      </section>

      <section className="settings-view__section">
        <h2 className="settings-view__section-title">
          <span className="settings-view__section-icon"><InfoIcon size={14} /></span>
          {t('settings.about')}
        </h2>
        <div className="settings-view__about">
          <div className="settings-view__about-row">
            <span>{t('about.version')}</span>
            <span className="settings-view__about-value">{version}</span>
          </div>
          <div className="settings-view__about-row">
            <span>Сборка</span>
            <span className="settings-view__about-value">{t('about.buildName')}</span>
          </div>
        </div>
      </section>
    </div>
  )
}

export default SettingsView
