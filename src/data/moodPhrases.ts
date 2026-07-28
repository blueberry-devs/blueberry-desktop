export const CATEGORIES = ['pop', 'rock', 'metal', 'hiphop', 'edm', 'chill', 'jazz', 'classical', 'indie', 'folk', 'workout', 'mix'] as const
export type CategoryId = (typeof CATEGORIES)[number]

const RU: Record<CategoryId, string[]> = {
  pop: ['Позитивная поп-музыка', 'Современная поп-музыка', 'Поп-музыка для настроения', 'Заряд поп-энергии', 'Хиты поп-музыки', 'Мейнстрим', 'Весёлые ритмы', 'Поп-хиты', 'Танцевальная поп-музыка', 'Лёгкая поп-музыка', 'О чём поют все', 'Заводной поп'],
  rock: ['Энергичный рок', 'Рок-классика', 'Современный рок', 'Тяжёлые гитары', 'Альтернативный рок', 'Рок-баллады', 'Гранж', 'Панк-рок', 'Хард-рок', 'Инди-рок', 'Русский рок', 'Британский рок'],
  metal: ['Тяжёлый метал', 'Эпичный метал', 'Метал для зарядки', 'Классика метала', 'Современный метал', 'Дэт-метал', 'Блэк-метал', 'Пауэр-метал', 'Дум-метал', 'Прогрессивный метал', 'Металкор', 'Симфоник-метал'],
  hiphop: ['Хочу басса', 'Новый хип-хоп', 'Рэп на повторе', 'Свежий флоу', 'Тяжёлый бит', 'Уличный вайб', 'Рэп без фильтров', 'Современный рэп', 'Классика хип-хопа', 'Рэп для дороги', 'Бас в наушниках', 'Ночной хип-хоп'],
  edm: ['Ночной EDM', 'Клубный режим', 'Танцевальный вайб', 'Больше синтов', 'Электроника без слов', 'Глубокий бас', 'Футуристичный звук', 'Атмосферная электроника', 'Энергичный хаус', 'Лучший техно-сет', 'Музыка будущего', 'Бит до утра'],
  chill: ['Просто расслабиться', 'Лоуфай вечер', 'Спокойный вайб', 'Музыка для отдыха', 'Тихая атмосфера', 'Для учёбы и работы', 'Ночной чилл', 'Мягкие мелодии', 'Спокойные мысли', 'Фоновая музыка', 'Уютный звук', 'Медленный вечер'],
  jazz: ['Душевный R&B', 'Ночной джаз', 'Больше соула', 'Тёплый вокал', 'Гладкий R&B', 'Классический джаз', 'Романтичный соул', 'Музыка с душой', 'Вечерний джаз', 'Спокойный вокал', 'Атмосферный R&B', 'Старый добрый соул'],
  classical: ['Большая симфония', 'Музыка как в кино', 'Эпические оркестры', 'Спокойная классика', 'Классика для работы', 'Красивые мелодии', 'Величественный звук', 'Оркестр и эмоции', 'Классические шедевры', 'Музыка для размышлений', 'Глубокая классика', 'Вечная музыка'],
  indie: ['Найди новое', 'Инди-настроение', 'Музыка не как у всех', 'Неизвестные жемчужины', 'Новые имена', 'Альтернативный вайб', 'Странно, но красиво', 'Артисты будущего', 'Свежая сцена', 'Необычный звук', 'Инди для вечера', 'За пределами хитов'],
  folk: ['Тёплая акустика', 'Музыка у костра', 'Акустические истории', 'Спокойная гитара', 'Голос и мелодия', 'Душевный фолк', 'Дорога и музыка', 'Живой звук', 'Простые песни', 'Атмосфера природы', 'Кантри настроение', 'Музыка с историей'],
  workout: ['Зарядись музыкой', 'Музыка для тренировки', 'Максимальная энергия', 'Мотивационный режим', 'Больше драйва', 'Включи мощность', 'Бит для победы', 'Не останавливаться', 'Быстрый ритм', 'Музыка для движения', 'Поднять настроение', 'Сделай громче'],
  mix: ['Музыка для ночи', 'Саундтрек дня', 'Главный герой', 'Треки с мурашками', 'Атмосфера момента', 'Музыка под дождь', 'Для долгой дороги', 'Когда хочется подумать', 'Когда хочется танцевать', 'Просто хороший звук', 'Открой что-то новое', 'Моя новая музыка']
}

const EN: Record<CategoryId, string[]> = {
  pop: ['Upbeat pop music', 'Modern pop music', 'Pop for the mood', 'Pop energy boost', 'Pop hits', 'Mainstream', 'Cheerful rhythms', 'Pop chart-toppers', 'Dance pop', 'Easy pop', 'What everyone is singing', 'Lively pop'],
  rock: ['Energetic rock', 'Rock classics', 'Modern rock', 'Heavy guitars', 'Alternative rock', 'Rock ballads', 'Grunge', 'Punk rock', 'Hard rock', 'Indie rock', 'Russian rock', 'British rock'],
  metal: ['Heavy metal', 'Epic metal', 'Metal for charging', 'Metal classics', 'Modern metal', 'Death metal', 'Black metal', 'Power metal', 'Doom metal', 'Progressive metal', 'Metalcore', 'Symphonic metal'],
  hiphop: ['I want bass', 'New hip-hop', 'Rap on repeat', 'Fresh flow', 'Heavy beat', 'Street vibe', 'Rap unfiltered', 'Modern rap', 'Hip-hop classics', 'Rap for the road', 'Bass in headphones', 'Night hip-hop'],
  edm: ['Night EDM', 'Club mode', 'Dance vibe', 'More synths', 'Electronic without words', 'Deep bass', 'Futuristic sound', 'Atmospheric electronic', 'Energetic house', 'Best techno set', 'Music of the future', 'Beat till morning'],
  chill: ['Just relax', 'Lo-fi evening', 'Chill vibe', 'Music for rest', 'Quiet atmosphere', 'For study and work', 'Night chill', 'Soft melodies', 'Peaceful thoughts', 'Background music', 'Cozy sound', 'Slow evening'],
  jazz: ['Soulful R&B', 'Night jazz', 'More soul', 'Warm vocals', 'Smooth R&B', 'Classic jazz', 'Romantic soul', 'Music with soul', 'Evening jazz', 'Calm vocals', 'Atmospheric R&B', 'Good old soul'],
  classical: ['Grand symphony', 'Music like in movies', 'Epic orchestras', 'Peaceful classical', 'Classical for work', 'Beautiful melodies', 'Majestic sound', 'Orchestra and emotions', 'Classical masterpieces', 'Music for reflection', 'Deep classical', 'Timeless music'],
  indie: ['Find something new', 'Indie mood', 'Music unlike others', 'Hidden gems', 'New names', 'Alternative vibe', 'Weird but beautiful', 'Artists of tomorrow', 'Fresh scene', 'Unusual sound', 'Indie for evening', 'Beyond the hits'],
  folk: ['Warm acoustic', 'Music by the campfire', 'Acoustic stories', 'Calm guitar', 'Voice and melody', 'Heartfelt folk', 'Road and music', 'Live sound', 'Simple songs', 'Nature atmosphere', 'Country mood', 'Music with history'],
  workout: ['Charge with music', 'Music for workout', 'Maximum energy', 'Motivation mode', 'More drive', 'Turn up the power', 'Beat for victory', 'Don\'t stop', 'Fast rhythm', 'Music for movement', 'Boost your mood', 'Turn it louder'],
  mix: ['Music for night', 'Daily soundtrack', 'Main character', 'Tracks with chills', 'Atmosphere of the moment', 'Music in the rain', 'For the long road', 'When you want to think', 'When you want to dance', 'Just good sound', 'Discover something new', 'My new music']
}

const CATEGORY_TO_KEYWORD: Record<CategoryId, string> = {
  pop: 'pop music',
  rock: 'rock music',
  metal: 'metal music',
  hiphop: 'hip hop music',
  edm: 'electronic dance music',
  chill: 'chill music',
  jazz: 'jazz music',
  classical: 'classical music',
  indie: 'indie music',
  folk: 'folk music',
  workout: 'energetic workout music',
  mix: 'popular music',
}

let phraseToKeywordCache: Record<string, string> | null = null

function buildPhraseToKeywordCache(): Record<string, string> {
  const cache: Record<string, string> = {}
  for (const cat of CATEGORIES) {
    const kw = CATEGORY_TO_KEYWORD[cat]
    if (!kw) continue
    for (const p of RU[cat]) cache[p.toLowerCase()] = kw
    for (const p of EN[cat]) cache[p.toLowerCase()] = kw
  }
  return cache
}

export function phraseToKeyword(phrase: string): string | null {
  if (!phraseToKeywordCache) phraseToKeywordCache = buildPhraseToKeywordCache()
  return phraseToKeywordCache[phrase.toLowerCase().trim()] ?? null
}

export function getMoodPhrases(language: string): Record<CategoryId, string[]> {
  return language === 'en' ? EN : RU
}