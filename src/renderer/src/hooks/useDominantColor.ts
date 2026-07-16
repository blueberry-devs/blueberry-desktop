import { useEffect, useRef, useState } from 'react'

function extractColor(img: HTMLImageElement): [number, number, number] {
  const canvas = document.createElement('canvas')
  const size = 32
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data

  let r = 0, g = 0, b = 0, count = 0
  for (let i = 0; i < data.length; i += 16) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count++
  }
  return [r / count / 255, g / count / 255, b / count / 255]
}

export function useDominantColor(url: string | null | undefined): [number, number, number] {
  const [color, setColor] = useState<[number, number, number]>([0.35, 0.65, 1.0])
  const cacheRef = useRef(new Map<string, [number, number, number]>())

  useEffect(() => {
    if (!url) return

    const cached = cacheRef.current.get(url)
    if (cached) {
      setColor(cached)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = extractColor(img)
      cacheRef.current.set(url, c)
      setColor(c)
    }
    img.src = url
  }, [url])

  return color
}
