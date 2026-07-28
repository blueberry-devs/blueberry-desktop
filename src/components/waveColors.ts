export const lt = (h: number, s: number, l: number): [number, number, number] => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

const ot = (h: number) => ((h % 360) + 360) % 360
const Ot = (h: number) => ((h % 360) + 360) % 360
const ht = (t: number, e: number) => {
  const eN = ((e % 360) + 360) % 360
  return eN >= 280 && eN < 360 ? ((t % 360) + 360) % 360 : t
}
const tt = (min: number, max: number) => Math.floor(Math.random() * (Math.floor(max) - min + 1)) + min

export type WaveColorPresetId =
  | 'random'
  | 'gray'
  | 'silver'
  | 'monochrome-blue'
  | 'neon'
  | 'pastel'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'fire'
  | 'night'
  | 'cyberpunk'
  | 'aurora'
  | 'golden'
  | 'cherry'
  | 'lavender'
  | 'vintage'

export interface WaveColorPreset {
  id: WaveColorPresetId
  label: string
  colors: () => [number, number, number][]
}

export const COLOR_PRESETS: WaveColorPreset[] = [
  {
    id: 'random',
    label: 'Случайные',
    colors: () => {
      const b = ot(10)
      const be = ht(Ot(b + tt(30, 40)), b)
      return [
        lt(b, 1, 0.5),
        lt(300, 1, 0.5),
        lt(50, 1, 0.5),
        lt(be, 1, 0.5),
        lt(320, 1, 0.5),
        lt(50, 1, 0.5),
      ]
    }
  },
  {
    id: 'gray',
    label: 'Серый',
    colors: () => [
      lt(0, 0, 0.6),
      lt(0, 0, 0.4),
      lt(0, 0, 0.7),
      lt(0, 0, 0.5),
      lt(0, 0, 0.3),
      lt(0, 0, 0.75),
    ]
  },
  {
    id: 'silver',
    label: 'Серебро',
    colors: () => [
      lt(210, 0.05, 0.7),
      lt(210, 0.05, 0.5),
      lt(210, 0.08, 0.8),
      lt(210, 0.05, 0.6),
      lt(210, 0.05, 0.45),
      lt(210, 0.08, 0.75),
    ]
  },
  {
    id: 'monochrome-blue',
    label: 'Монохром синий',
    colors: () => [
      lt(220, 0.5, 0.5),
      lt(220, 0.4, 0.35),
      lt(220, 0.5, 0.6),
      lt(220, 0.4, 0.45),
      lt(220, 0.5, 0.3),
      lt(220, 0.4, 0.65),
    ]
  },
  {
    id: 'neon',
    label: 'Неон',
    colors: () => [
      lt(180, 1, 0.5),
      lt(300, 1, 0.5),
      lt(60, 1, 0.5),
      lt(240, 1, 0.5),
      lt(330, 1, 0.5),
      lt(120, 1, 0.5),
    ]
  },
  {
    id: 'pastel',
    label: 'Пастель',
    colors: () => [
      lt(10, 0.4, 0.7),
      lt(200, 0.4, 0.7),
      lt(50, 0.4, 0.7),
      lt(280, 0.4, 0.7),
      lt(140, 0.4, 0.7),
      lt(330, 0.4, 0.7),
    ]
  },
  {
    id: 'ocean',
    label: 'Океан',
    colors: () => [
      lt(195, 0.8, 0.5),
      lt(220, 0.7, 0.35),
      lt(175, 0.9, 0.6),
      lt(210, 0.7, 0.45),
      lt(240, 0.6, 0.3),
      lt(185, 0.8, 0.7),
    ]
  },
  {
    id: 'sunset',
    label: 'Закат',
    colors: () => [
      lt(15, 1, 0.55),
      lt(320, 1, 0.45),
      lt(45, 1, 0.6),
      lt(340, 1, 0.5),
      lt(280, 1, 0.35),
      lt(25, 1, 0.65),
    ]
  },
  {
    id: 'forest',
    label: 'Лес',
    colors: () => [
      lt(120, 0.7, 0.4),
      lt(90, 0.6, 0.3),
      lt(140, 0.8, 0.5),
      lt(110, 0.6, 0.35),
      lt(160, 0.7, 0.25),
      lt(130, 0.7, 0.55),
    ]
  },
  {
    id: 'fire',
    label: 'Огонь',
    colors: () => [
      lt(0, 1, 0.55),
      lt(30, 1, 0.5),
      lt(350, 1, 0.4),
      lt(15, 1, 0.6),
      lt(45, 1, 0.55),
      lt(0, 1, 0.35),
    ]
  },
  {
    id: 'night',
    label: 'Ночь',
    colors: () => [
      lt(250, 0.6, 0.3),
      lt(220, 0.5, 0.2),
      lt(270, 0.7, 0.35),
      lt(240, 0.5, 0.25),
      lt(260, 0.6, 0.15),
      lt(230, 0.5, 0.4),
    ]
  },
  {
    id: 'cyberpunk',
    label: 'Киберпанк',
    colors: () => [
      lt(330, 1, 0.5),
      lt(180, 1, 0.45),
      lt(280, 1, 0.5),
      lt(60, 1, 0.5),
      lt(240, 1, 0.4),
      lt(340, 1, 0.55),
    ]
  },
  {
    id: 'aurora',
    label: 'Аврора',
    colors: () => [
      lt(150, 0.9, 0.45),
      lt(280, 0.8, 0.4),
      lt(120, 0.9, 0.55),
      lt(300, 0.8, 0.5),
      lt(170, 0.9, 0.35),
      lt(270, 0.8, 0.6),
    ]
  },
  {
    id: 'golden',
    label: 'Золото',
    colors: () => [
      lt(45, 1, 0.5),
      lt(30, 1, 0.35),
      lt(55, 1, 0.6),
      lt(40, 1, 0.45),
      lt(50, 1, 0.3),
      lt(35, 1, 0.55),
    ]
  },
  {
    id: 'cherry',
    label: 'Вишня',
    colors: () => [
      lt(350, 0.9, 0.45),
      lt(340, 0.8, 0.3),
      lt(0, 0.9, 0.55),
      lt(355, 0.8, 0.4),
      lt(345, 0.9, 0.25),
      lt(5, 0.8, 0.5),
    ]
  },
  {
    id: 'lavender',
    label: 'Лаванда',
    colors: () => [
      lt(270, 0.5, 0.6),
      lt(280, 0.4, 0.45),
      lt(260, 0.5, 0.7),
      lt(275, 0.4, 0.55),
      lt(290, 0.5, 0.4),
      lt(265, 0.4, 0.65),
    ]
  },
  {
    id: 'vintage',
    label: 'Винтаж',
    colors: () => [
      lt(25, 0.5, 0.45),
      lt(10, 0.4, 0.35),
      lt(35, 0.5, 0.55),
      lt(20, 0.4, 0.4),
      lt(40, 0.5, 0.3),
      lt(15, 0.4, 0.5),
    ]
  },
]
