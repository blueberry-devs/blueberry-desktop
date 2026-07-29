export interface LrcLine {
  time: number
  text: string
}

/**
 * One timestamp: [mm:ss], [mm:ss.xx], [mm:ss.xxx] or [hh:mm:ss.xx].
 * A single line may carry several of them (repeated chorus lines).
 */
const STAMP_RE = /\[(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?[.:]?(\d{1,3})?\]/g

/** Metadata tags we must not mistake for timestamps: [ar:], [ti:], [by:], ... */
const META_RE = /^\[[a-z]{2,}:/i

/** Word-level timing used by enhanced LRC: `<00:12.34>` inside the text. */
const WORD_STAMP_RE = /<\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?>/g

function stampToSeconds(m: RegExpExecArray): number {
  const a = Number(m[1])
  const b = Number(m[2])
  const c = m[3] !== undefined ? Number(m[3]) : null
  const fracRaw = m[4]

  // Fraction digits are position-dependent: ".5" = 500ms, ".05" = 50ms, ".005" = 5ms
  const frac = fracRaw ? Number(fracRaw) / Math.pow(10, fracRaw.length) : 0

  // Three groups means hh:mm:ss, two means mm:ss
  return c !== null ? a * 3600 + b * 60 + c + frac : a * 60 + b + frac
}

/**
 * Parse an LRC file into sorted, de-duplicated lines.
 *
 * Handles: multiple timestamps per line, enhanced (word-level) LRC, metadata
 * tags, `[offset:±ms]`, CRLF, and blank/instrumental filler lines.
 */
export function parseLrc(raw: string): LrcLine[] {
  if (!raw) return []

  const lines: LrcLine[] = []
  let offset = 0

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    // [offset:+250] shifts every timestamp; LRC stores it in milliseconds
    const offsetMatch = /^\[offset:\s*([+-]?\d+)\s*\]$/i.exec(line)
    if (offsetMatch) {
      offset = Number(offsetMatch[1]) / 1000
      continue
    }

    // Collect every timestamp on this line
    STAMP_RE.lastIndex = 0
    const times: number[] = []
    let lastStampEnd = 0
    let m: RegExpExecArray | null
    while ((m = STAMP_RE.exec(line)) !== null) {
      // Only leading timestamps count — a stamp after text is not a cue
      if (m.index !== lastStampEnd) break
      times.push(stampToSeconds(m))
      lastStampEnd = m.index + m[0].length
    }

    if (times.length === 0) {
      // No timestamps: skip metadata, keep nothing else (plain text is handled
      // separately by the caller via the `plain` field)
      continue
    }

    // Strip word-level stamps so the display text stays clean
    const text = line
      .slice(lastStampEnd)
      .replace(WORD_STAMP_RE, '')
      .replace(/\s+/g, ' ')
      .trim()

    for (const time of times) {
      lines.push({ time: Math.max(0, time + offset), text })
    }
  }

  lines.sort((a, b) => a.time - b.time)

  // Drop consecutive duplicates at the same timestamp (providers often repeat)
  const result: LrcLine[] = []
  for (const line of lines) {
    const prev = result[result.length - 1]
    if (prev && prev.text === line.text && Math.abs(prev.time - line.time) < 0.05) continue
    result.push(line)
  }

  // An LRC of only empty texts carries no information — treat as unsynced
  if (!result.some((l) => l.text.length > 0)) return []

  return result
}

/**
 * Parse plain (untimed) lyrics into display lines.
 * Strips provider headers and collapses runs of blank lines to a single break.
 */
export function parsePlain(raw: string): string[] {
  if (!raw) return []

  const out: string[] = []
  for (const rawLine of raw.split(/\r?\n/)) {
    // A stray LRC timestamp can appear in "plain" payloads — strip it
    const line = rawLine.replace(STAMP_RE, '').replace(WORD_STAMP_RE, '').trim()
    if (META_RE.test(line)) continue
    if (!line) {
      // Keep at most one blank line as a stanza break
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      continue
    }
    out.push(line)
  }

  // Trim leading/trailing blanks
  while (out.length && out[0] === '') out.shift()
  while (out.length && out[out.length - 1] === '') out.pop()

  return out
}

export function activeLineIndex(lines: LrcLine[], currentTime: number): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) idx = i
    else break
  }
  return idx
}
