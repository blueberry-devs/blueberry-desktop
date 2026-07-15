import soundcloudIcon from '../assets/soundcloud.png'
import youtubeIcon from '../assets/youtube.png'
import yandexIcon from '../assets/yandex.png'
import type { TrackSource } from '../api/yandexMusic'
import './ServiceBadge.css'

const ICONS: Record<TrackSource, string> = {
  soundcloud: soundcloudIcon,
  youtube: youtubeIcon,
  yandex: yandexIcon
}

// The three source PNGs are each square but their glyphs fill very
// different fractions of that square (yandex's star touches every edge,
// soundcloud's mark fills ~90%, youtube's circle only ~81%) — rendered at
// the same pixel size they visibly don't match. Scale each toward a common
// apparent size instead.
const SCALE: Record<TrackSource, number> = {
  yandex: 0.85,
  soundcloud: 0.94,
  youtube: 1.05
}

interface Props {
  source: TrackSource
  size?: number
}

function ServiceBadge({ source, size = 16 }: Props): JSX.Element {
  const rendered = Math.round(size * SCALE[source])
  return (
    <span className="service-badge" style={{ width: size, height: size }}>
      <img src={ICONS[source]} alt={source} title={source} width={rendered} height={rendered} />
    </span>
  )
}

export default ServiceBadge
