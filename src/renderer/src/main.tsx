import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/styles/global.css'

// No StrictMode: its dev-only double mount/unmount of effects is a known
// source of visible flicker with AnimatePresence exit animations (e.g. the
// fullscreen player briefly reappearing before actually closing) — an
// artifact of development only, invisible in the production build, but
// disruptive enough here that it's not worth keeping for its side-effect
// linting benefit.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />)
