export interface LrcLine {
  time: number
  text: string
}

const LINE_RE = /^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/

export function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = []
  for (const rawLine of raw.split('\n')) {
    const match = LINE_RE.exec(rawLine.trim())
    if (!match) continue
    const minutes = Number(match[1])
    const seconds = Number(match[2])
    const text = match[3].trim()
    if (!text) continue
    lines.push({ time: minutes * 60 + seconds, text })
  }
  return lines.sort((a, b) => a.time - b.time)
}

export function activeLineIndex(lines: LrcLine[], currentTime: number): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) idx = i
    else break
  }
  return idx
}
