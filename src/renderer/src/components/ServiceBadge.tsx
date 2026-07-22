import soundcloudIcon from '../assets/soundcloud.png'
import youtubeIcon from '../assets/youtube.png'
import yandexIcon from '../assets/yandex.png'
import type { TrackSource } from '../api/yandexMusic'
import './ServiceBadge.css'

const ICONS: Record<TrackSource, (rendered: number) => JSX.Element> = {
  soundcloud: (r: number) => <img src={soundcloudIcon} alt="soundcloud" title="soundcloud" width={r} height={r} />,
  youtube: (r: number) => <img src={youtubeIcon} alt="youtube" title="youtube" width={r} height={r} />,
  yandex: (r: number) => <img src={yandexIcon} alt="yandex" title="yandex" width={r} height={r} />,
}

const SCALE: Record<TrackSource, number> = {
  yandex: 0.85,
  soundcloud: 0.94,
  youtube: 1.05,
}

interface Props {
  source: TrackSource
  size?: number
}

function ServiceBadge({ source, size = 16 }: Props): JSX.Element {
  const rendered = Math.round(size * SCALE[source])
  return (
    <span className="service-badge" style={{ width: size, height: size }}>
      {ICONS[source](rendered)}
    </span>
  )
}

export default ServiceBadge
