import './Sidebar.css'
import type { Tab } from '../App'
import logo from '../assets/icon.png'
import logoText1 from '../assets/text1.png'
import logoText2 from '../assets/text2.png'
import waveIcon from '../assets/mywave.png'
import gridIcon from '../assets/grid.png'
import { useSidebarCollapsed, toggleSidebarCollapsed } from '../store/sidebar'

const navItems: { icon: string; label: string; tab: Tab }[] = [
  { icon: 'search', label: 'Поиск', tab: 'search' },
  { icon: 'wave', label: 'Моя волна', tab: 'wave' },
  { icon: 'note', label: 'Для вас и Тренды', tab: 'trends' },
  { icon: 'heart', label: 'Коллекция', tab: 'collection' },
  { icon: 'history', label: 'История', tab: 'history' }
]

function NavIcon({ type }: { type: string }): JSX.Element {
  switch (type) {
    case 'search':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2.6" />
          <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      )
    case 'wave':
      // mywave.png is already a transparent-background spark — masked so it
      // picks up currentColor like the other icons (gray when inactive,
      // white on the active tab) instead of staying baked-in white.
      return (
        <span
          className="sidebar__nav-icon-spark"
          style={{ maskImage: `url(${waveIcon})`, WebkitMaskImage: `url(${waveIcon})` }}
        />
      )
    case 'note':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="5" cy="14" r="2.8" fill="currentColor" />
          <circle cx="13" cy="12" r="2.8" fill="currentColor" />
          <path d="M7.4 14V4l8-1.6v9.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </svg>
      )
    case 'heart':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 15.5S2 11.2 2 6.8C2 4.4 3.9 2.8 6 2.8c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.1 0 4 1.6 4 4 0 4.4-7 8.7-7 8.7Z"
            fill="currentColor"
          />
        </svg>
      )
    case 'history':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9 5v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case 'settings':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M7.6 2.6h2.8l.4 1.9c.5.15.95.36 1.37.63l1.83-.7 1.98 2.42-1.16 1.6c.1.5.1 1 0 1.5l1.16 1.6-1.98 2.42-1.83-.7c-.42.27-.87.48-1.37.63l-.4 1.9H7.6l-.4-1.9a5.3 5.3 0 0 1-1.37-.63l-1.83.7-1.98-2.42 1.16-1.6a4.9 4.9 0 0 1 0-1.5L1.02 6.85 3 4.43l1.83.7c.42-.27.87-.48 1.37-.63l.4-1.9Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )
    default:
      return <span />
  }
}

interface Props {
  activeTab: Tab
  onSelectTab: (tab: Tab) => void
}

function Sidebar({ activeTab, onSelectTab }: Props): JSX.Element {
  const collapsed = useSidebarCollapsed()

  return (
    <div className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__logo">
        <img src={logo} alt="" className="sidebar__spark" />
        <div className="sidebar__logo-text">
          <img src={logoText1} alt="Яндекс" className="sidebar__logo-text1" />
          <img src={logoText2} alt="Музыка" className="sidebar__logo-text2" />
        </div>
      </div>

      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onSelectTab(item.tab)}
            className={`sidebar__nav-item${activeTab === item.tab ? ' sidebar__nav-item--active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar__nav-icon">
              <NavIcon type={item.icon} />
            </span>
            <span className="sidebar__nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <button
        onClick={() => onSelectTab('settings')}
        className={`sidebar__nav-item sidebar__nav-item--settings${activeTab === 'settings' ? ' sidebar__nav-item--active' : ''}`}
        title={collapsed ? 'Настройки' : undefined}
      >
        <span className="sidebar__nav-icon">
          <NavIcon type="settings" />
        </span>
        <span className="sidebar__nav-label">Настройки</span>
      </button>

      <button
        className="sidebar__collapse-btn"
        onClick={toggleSidebarCollapsed}
        title={collapsed ? 'Развернуть' : 'Свернуть'}
      >
        <span
          className="sidebar__collapse-icon"
          style={{ maskImage: `url(${gridIcon})`, WebkitMaskImage: `url(${gridIcon})` }}
        />
        <span className="sidebar__collapse-label">Свернуть</span>
      </button>
    </div>
  )
}

export default Sidebar
