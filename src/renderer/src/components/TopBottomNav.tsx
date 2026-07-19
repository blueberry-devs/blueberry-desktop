import { AnimatePresence, motion } from 'motion/react'
import { navItems, NavIcon } from './Sidebar'
import { useTranslation } from '../utils/useTranslation'
import type { Tab } from '../App'
import './TopBottomNav.css'

interface Props {
  activeTab: Tab
  onSelectTab: (tab: Tab) => void
  position: 'top' | 'bottom'
}

// Ported from the "expandable tabs" pattern: the button's own gap/padding
// animates open alongside the label mounting in, instead of the label just
// popping into existence — matches the reference component's buttonVariants.
const buttonVariants = {
  initial: { gap: 0, paddingLeft: 14, paddingRight: 14 },
  animate: (active: boolean) => ({
    gap: active ? 8 : 0,
    paddingLeft: active ? 16 : 14,
    paddingRight: active ? 16 : 14
  })
}

const labelVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: 'auto', opacity: 1 },
  exit: { width: 0, opacity: 0 }
}

const transition = { type: 'spring' as const, bounce: 0, duration: 0.4 }

// Same idea as an "expandable tabs" bar: icon-only pills that only grow to
// show their label for the active tab, with a shared-layout highlight that
// slides between them (matches the Sidebar's own active-pill animation).
function TopBottomNav({ activeTab, onSelectTab, position }: Props): JSX.Element {
  const { t } = useTranslation()
  const navLabel: Record<string, string> = {
    'Поиск': t('sidebar.search'),
    'Моя волна': t('sidebar.wave'),
    'Для вас и Тренды': t('sidebar.trends'),
    'Коллекция': t('sidebar.collection'),
    'История': t('sidebar.history'),
    'Настройки': t('sidebar.settings'),
  }
  const items = [...navItems, { icon: 'settings', label: 'Настройки', tab: 'settings' as Tab }]

  return (
    <nav className={`top-bottom-nav top-bottom-nav--${position}`}>
      {items.map((item) => {
        const active = activeTab === item.tab
        return (
          <motion.button
            key={item.label}
            onClick={() => onSelectTab(item.tab)}
            className={`top-bottom-nav__item${active ? ' top-bottom-nav__item--active' : ''}`}
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={active}
            transition={transition}
          >
            {active && (
              <motion.span
                layoutId="top-bottom-nav-pill"
                className="top-bottom-nav__pill"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="top-bottom-nav__icon">
              <NavIcon type={item.icon} />
            </span>
            <AnimatePresence initial={false}>
              {active && (
                <motion.span
                  variants={labelVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="top-bottom-nav__label"
                >
{navLabel[item.label] ?? item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )
      })}
    </nav>
  )
}

export default TopBottomNav
