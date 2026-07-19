import ru from '../locales/ru.json'
import en from '../locales/en.json'
import { useProfile } from '../store/profile'

const dicts: Record<string, Record<string, string>> = { ru, en }

export function useTranslation(): { t: (key: string) => string } {
  const { language } = useProfile()
  const dict = dicts[language] ?? ru
  const t = (key: string): string => dict[key] ?? key
  return { t }
}
