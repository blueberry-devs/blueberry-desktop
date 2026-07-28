/* ============================================================
   Badges & Verification — shared config
   ============================================================ */

/* ---------- Verification levels ---------- */

export interface VerificationTier {
  level: number
  label: string
  color: string
  descRu: string
  descEn: string
}

export const VERIFICATION_TIERS: VerificationTier[] = [
  { level: 0, label: 'No Status', color: 'transparent', descRu: '', descEn: '' },
  { level: 1, label: 'Verified Artist', color: '#3b82f6', descRu: 'Подтверждённый музыкант', descEn: 'Confirmed artist' },
  { level: 2, label: 'Trusted Curator', color: '#10b981', descRu: 'Мастер плейлистов', descEn: 'Playlist expert' },
  { level: 3, label: 'Brand/Official', color: '#f59e0b', descRu: 'Лейбл или студия', descEn: 'Label or studio' },
  { level: 4, label: 'Staff', color: '#7a00b8', descRu: 'Команда Blueberry', descEn: 'Blueberry team' },
]

export function getVerificationTier(level: number): VerificationTier {
  return VERIFICATION_TIERS[level] ?? VERIFICATION_TIERS[0]
}

export function getVerificationTooltip(level: number, lang: string): string {
  const tier = getVerificationTier(level)
  if (level === 0) return ''
  const desc = lang === 'ru' ? tier.descRu : tier.descEn
  return `${tier.label} — ${desc}`
}

/* ---------- Badges bitmask ---------- */

export interface BadgeDef {
  id: number      // bit flag value (1 << n)
  flag: string    // C# enum name
  emoji: string
  label: string
  description: string
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 1 << 0, flag: 'EarlyAdopter', emoji: '🛡️', label: 'Early Adopter', description: 'Регистрация в первый месяц' },
  { id: 1 << 1, flag: 'BugHunter',    emoji: '🐛', label: 'Bug Hunter',    description: 'Нашёл подтверждённый баг' },
  { id: 1 << 2, flag: 'Supporter',    emoji: '⭐', label: 'Supporter',     description: 'Ручная выдача' },
  { id: 1 << 3, flag: 'Meloman',      emoji: '🎧', label: 'Meloman',      description: 'Топ-1% слушателей' },
]

/**
 * Decode a badges bitmask into an array of badge flag IDs.
 */
export function decodeBadges(mask: number): number[] {
  return BADGE_DEFS.filter((b) => (mask & b.id) !== 0).map((b) => b.id)
}

/**
 * Get badge definitions for a set of badge IDs.
 */
export function getBadges(ids: number[]): BadgeDef[] {
  return BADGE_DEFS.filter((b) => ids.includes(b.id))
}
