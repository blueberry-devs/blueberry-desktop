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

// ---------------------------------------------------------------------------
// Mood tags for vector-based filtering
// Maps mood phrase → tags that describe the desired sound characteristics.
// Used by /api/recommend to filter candidates by mood before similarity scoring.
// ---------------------------------------------------------------------------

export interface MoodTags {
  genres: string[]
  energy: number    // 0-1, low=calm, high=aggressive
  valence: number   // 0-1, low=sad/dark, happy=upbeat
  danceability: number // 0-1
  tags: string[]    // freeform descriptors
}

const MOOD_TAGS: Record<string, MoodTags> = {
  // Rock
  'энергичный рок': { genres: ['rock'], energy: 0.8, valence: 0.7, danceability: 0.5, tags: ['guitar', 'driving'] },
  'рок-классика': { genres: ['rock'], energy: 0.6, valence: 0.6, danceability: 0.4, tags: ['classic', 'guitar'] },
  'современный рок': { genres: ['rock'], energy: 0.7, valence: 0.6, danceability: 0.5, tags: ['modern', 'guitar'] },
  'тяжёлые гитары': { genres: ['rock', 'metal'], energy: 0.9, valence: 0.5, danceability: 0.4, tags: ['guitar', 'heavy'] },
  'альтернативный рок': { genres: ['rock', 'indie'], energy: 0.6, valence: 0.5, danceability: 0.5, tags: ['alternative', 'guitar'] },
  'рок-баллады': { genres: ['rock'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['ballad', 'emotional'] },
  'гранж': { genres: ['rock'], energy: 0.7, valence: 0.3, danceability: 0.4, tags: ['grunge', 'raw'] },
  'панк-рок': { genres: ['rock'], energy: 0.9, valence: 0.6, danceability: 0.6, tags: ['punk', 'fast'] },
  'хард-рок': { genres: ['rock'], energy: 0.85, valence: 0.6, danceability: 0.5, tags: ['hard', 'guitar'] },
  'инди-рок': { genres: ['rock', 'indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['indie', 'guitar'] },
  'русский рок': { genres: ['rock'], energy: 0.6, valence: 0.5, danceability: 0.4, tags: ['russian', 'guitar'] },
  'британский рок': { genres: ['rock'], energy: 0.6, valence: 0.6, danceability: 0.5, tags: ['british', 'guitar'] },

  // Metal
  'тяжёлый метал': { genres: ['metal'], energy: 0.95, valence: 0.5, danceability: 0.4, tags: ['heavy', 'aggressive'] },
  'эпичный метал': { genres: ['metal'], energy: 0.85, valence: 0.7, danceability: 0.4, tags: ['epic', 'symphonic'] },
  'метал для зарядки': { genres: ['metal'], energy: 0.9, valence: 0.6, danceability: 0.5, tags: ['energetic', 'driving'] },
  'классика метала': { genres: ['metal'], energy: 0.8, valence: 0.5, danceability: 0.4, tags: ['classic', 'guitar'] },
  'современный метал': { genres: ['metal'], energy: 0.85, valence: 0.5, danceability: 0.5, tags: ['modern', 'heavy'] },
  'дэт-метал': { genres: ['metal'], energy: 1.0, valence: 0.2, danceability: 0.3, tags: ['death', 'aggressive'] },
  'блэк-метал': { genres: ['metal'], energy: 0.95, valence: 0.1, danceability: 0.2, tags: ['black', 'dark'] },
  'пауэр-метал': { genres: ['metal'], energy: 0.9, valence: 0.8, danceability: 0.5, tags: ['power', 'epic'] },
  'дум-метал': { genres: ['metal'], energy: 0.4, valence: 0.2, danceability: 0.2, tags: ['doom', 'slow', 'dark'] },
  'прогрессивный метал': { genres: ['metal'], energy: 0.7, valence: 0.5, danceability: 0.4, tags: ['progressive', 'complex'] },
  'металкор': { genres: ['metal', 'rock'], energy: 0.9, valence: 0.5, danceability: 0.5, tags: ['metalcore', 'aggressive'] },
  'симфоник-метал': { genres: ['metal'], energy: 0.8, valence: 0.6, danceability: 0.4, tags: ['symphonic', 'epic'] },

  // Hip-hop
  'хочу басса': { genres: ['hiphop'], energy: 0.8, valence: 0.6, danceability: 0.8, tags: ['bass', 'heavy'] },
  'новый хип-хоп': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['modern', 'fresh'] },
  'рэп на повторе': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['catchy', 'repetitive'] },
  'свежий флоу': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['fresh', 'flow'] },
  'тяжёлый бит': { genres: ['hiphop'], energy: 0.85, valence: 0.5, danceability: 0.8, tags: ['beat', 'heavy'] },
  'уличный вайб': { genres: ['hiphop'], energy: 0.7, valence: 0.5, danceability: 0.7, tags: ['street', 'urban'] },
  'рэп без фильтров': { genres: ['hiphop'], energy: 0.8, valence: 0.5, danceability: 0.7, tags: ['raw', 'uncensored'] },
  'современный рэп': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['modern', 'trap'] },
  'классика хип-хопа': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['classic', 'old-school'] },
  'рэп для дороги': { genres: ['hiphop'], energy: 0.75, valence: 0.6, danceability: 0.7, tags: ['driving', 'cruising'] },
  'бас в наушниках': { genres: ['hiphop', 'edm'], energy: 0.8, valence: 0.6, danceability: 0.8, tags: ['bass', 'headphones'] },
  'ночной хип-хоп': { genres: ['hiphop'], energy: 0.6, valence: 0.4, danceability: 0.7, tags: ['night', 'moody'] },

  // EDM
  'ночной edm': { genres: ['edm'], energy: 0.8, valence: 0.5, danceability: 0.9, tags: ['night', 'club'] },
  'клубный режим': { genres: ['edm'], energy: 0.85, valence: 0.7, danceability: 0.95, tags: ['club', 'dance'] },
  'танцевальный вайб': { genres: ['edm'], energy: 0.8, valence: 0.7, danceability: 0.95, tags: ['dance', 'upbeat'] },
  'больше синтов': { genres: ['edm'], energy: 0.7, valence: 0.6, danceability: 0.8, tags: ['synth', 'electronic'] },
  'электроника без слов': { genres: ['edm'], energy: 0.6, valence: 0.5, danceability: 0.7, tags: ['instrumental', 'electronic'] },
  'глубокий бас': { genres: ['edm'], energy: 0.75, valence: 0.5, danceability: 0.8, tags: ['bass', 'deep'] },
  'футуристичный звук': { genres: ['edm'], energy: 0.7, valence: 0.6, danceability: 0.8, tags: ['futuristic', 'electronic'] },
  'атмосферная электроника': { genres: ['edm'], energy: 0.5, valence: 0.5, danceability: 0.6, tags: ['atmospheric', 'electronic'] },
  'энергичный хаус': { genres: ['edm'], energy: 0.85, valence: 0.7, danceability: 0.95, tags: ['house', 'energetic'] },
  'лучший техно-сет': { genres: ['edm'], energy: 0.8, valence: 0.5, danceability: 0.9, tags: ['techno', 'set'] },
  'музыка будущего': { genres: ['edm'], energy: 0.7, valence: 0.6, danceability: 0.8, tags: ['future', 'electronic'] },
  'бит до утра': { genres: ['edm'], energy: 0.8, valence: 0.6, danceability: 0.9, tags: ['all-night', 'dance'] },

  // Chill
  'просто расслабиться': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.3, tags: ['relax', 'calm'] },
  'лоуфай вечер': { genres: ['chill'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['lofi', 'study'] },
  'спокойный вайб': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.3, tags: ['calm', 'peaceful'] },
  'музыка для отдыха': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.3, tags: ['rest', 'relax'] },
  'тихая атмосфера': { genres: ['chill'], energy: 0.15, valence: 0.4, danceability: 0.2, tags: ['quiet', 'ambient'] },
  'для учёбы и работы': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.2, tags: ['focus', 'study'] },
  'ночной чилл': { genres: ['chill'], energy: 0.2, valence: 0.4, danceability: 0.3, tags: ['night', 'calm'] },
  'мягкие мелодии': { genres: ['chill'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['soft', 'melodic'] },
  'спокойные мысли': { genres: ['chill'], energy: 0.15, valence: 0.4, danceability: 0.2, tags: ['introspective', 'calm'] },
  'фоновая музыка': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.2, tags: ['background', 'ambient'] },
  'уютный звук': { genres: ['chill'], energy: 0.25, valence: 0.6, danceability: 0.3, tags: ['cozy', 'warm'] },
  'медленный вечер': { genres: ['chill'], energy: 0.2, valence: 0.4, danceability: 0.3, tags: ['slow', 'evening'] },

  // Jazz
  'душевный r&b': { genres: ['jazz'], energy: 0.4, valence: 0.6, danceability: 0.5, tags: ['soul', 'rnb'] },
  'ночной джаз': { genres: ['jazz'], energy: 0.3, valence: 0.4, danceability: 0.4, tags: ['jazz', 'night'] },
  'больше соула': { genres: ['jazz'], energy: 0.4, valence: 0.6, danceability: 0.5, tags: ['soul', 'vocal'] },
  'тёплый вокал': { genres: ['jazz'], energy: 0.3, valence: 0.5, danceability: 0.4, tags: ['vocal', 'warm'] },
  'гладкий r&b': { genres: ['jazz'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['smooth', 'rnb'] },
  'классический джаз': { genres: ['jazz'], energy: 0.3, valence: 0.5, danceability: 0.4, tags: ['classic', 'jazz'] },
  'романтичный соул': { genres: ['jazz'], energy: 0.3, valence: 0.6, danceability: 0.4, tags: ['romantic', 'soul'] },
  'музыка с душой': { genres: ['jazz'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['soul', 'emotional'] },
  'вечерний джаз': { genres: ['jazz'], energy: 0.3, valence: 0.5, danceability: 0.4, tags: ['evening', 'jazz'] },
  'спокойный вокал': { genres: ['jazz'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['calm', 'vocal'] },
  'атмосферный r&b': { genres: ['jazz'], energy: 0.35, valence: 0.5, danceability: 0.5, tags: ['atmospheric', 'rnb'] },
  'старый добрый соул': { genres: ['jazz'], energy: 0.35, valence: 0.6, danceability: 0.5, tags: ['classic', 'soul'] },

  // Classical
  'большая симфония': { genres: ['classical'], energy: 0.6, valence: 0.6, danceability: 0.1, tags: ['symphony', 'orchestra'] },
  'музыка как в кино': { genres: ['classical'], energy: 0.5, valence: 0.5, danceability: 0.1, tags: ['cinematic', 'soundtrack'] },
  'эпические оркестры': { genres: ['classical'], energy: 0.7, valence: 0.6, danceability: 0.1, tags: ['epic', 'orchestra'] },
  'спокойная классика': { genres: ['classical'], energy: 0.2, valence: 0.5, danceability: 0.1, tags: ['calm', 'classical'] },
  'классика для работы': { genres: ['classical'], energy: 0.3, valence: 0.5, danceability: 0.1, tags: ['focus', 'classical'] },
  'красивые мелодии': { genres: ['classical'], energy: 0.3, valence: 0.6, danceability: 0.1, tags: ['melodic', 'beautiful'] },
  'величественный звук': { genres: ['classical'], energy: 0.6, valence: 0.6, danceability: 0.1, tags: ['majestic', 'orchestra'] },
  'оркестр и эмоции': { genres: ['classical'], energy: 0.5, valence: 0.5, danceability: 0.1, tags: ['emotional', 'orchestra'] },
  'классические шедевры': { genres: ['classical'], energy: 0.4, valence: 0.5, danceability: 0.1, tags: ['masterpiece', 'classical'] },
  'музыка для размышлений': { genres: ['classical'], energy: 0.2, valence: 0.4, danceability: 0.1, tags: ['introspective', 'calm'] },
  'глубокая классика': { genres: ['classical'], energy: 0.3, valence: 0.4, danceability: 0.1, tags: ['deep', 'classical'] },
  'вечная музыка': { genres: ['classical'], energy: 0.3, valence: 0.5, danceability: 0.1, tags: ['timeless', 'classical'] },

  // Indie
  'найди новое': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['discovery', 'new'] },
  'инди-настроение': { genres: ['indie'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['indie', 'moody'] },
  'музыка не как у всех': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['unique', 'indie'] },
  'неизвестные жемчужины': { genres: ['indie'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['hidden', 'gem'] },
  'новые имена': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['new', 'artist'] },
  'альтернативный вайб': { genres: ['indie', 'rock'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['alternative', 'indie'] },
  'странно, но красиво': { genres: ['indie'], energy: 0.4, valence: 0.5, danceability: 0.4, tags: ['quirky', 'beautiful'] },
  'артисты будущего': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['emerging', 'new'] },
  'свежая сцена': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['fresh', 'scene'] },
  'необычный звук': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['unusual', 'experimental'] },
  'инди для вечера': { genres: ['indie'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['indie', 'evening'] },
  'за пределами хитов': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['deep-cut', 'indie'] },

  // Folk
  'тёплая акустика': { genres: ['folk'], energy: 0.3, valence: 0.6, danceability: 0.3, tags: ['acoustic', 'warm'] },
  'музыка у костра': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['campfire', 'acoustic'] },
  'акустические истории': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['acoustic', 'storytelling'] },
  'спокойная гитара': { genres: ['folk'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['guitar', 'calm'] },
  'голос и мелодия': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['vocal', 'melodic'] },
  'душевный фолк': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['folk', 'soulful'] },
  'дорога и музыка': { genres: ['folk'], energy: 0.35, valence: 0.5, danceability: 0.3, tags: ['road', 'travel'] },
  'живой звук': { genres: ['folk'], energy: 0.4, valence: 0.5, danceability: 0.4, tags: ['live', 'organic'] },
  'простые песни': { genres: ['folk'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['simple', 'folk'] },
  'атмосфера природы': { genres: ['folk'], energy: 0.2, valence: 0.5, danceability: 0.2, tags: ['nature', 'ambient'] },
  'кантри настроение': { genres: ['folk'], energy: 0.35, valence: 0.6, danceability: 0.4, tags: ['country', 'folk'] },
  'музыка с историей': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['storytelling', 'folk'] },

  // Workout
  'зарядись музыкой': { genres: ['workout'], energy: 0.9, valence: 0.7, danceability: 0.8, tags: ['energetic', 'motivation'] },
  'музыка для тренировки': { genres: ['workout'], energy: 0.9, valence: 0.7, danceability: 0.8, tags: ['workout', 'driving'] },
  'максимальная энергия': { genres: ['workout'], energy: 1.0, valence: 0.7, danceability: 0.8, tags: ['maximum', 'energy'] },
  'мотивационный режим': { genres: ['workout'], energy: 0.85, valence: 0.7, danceability: 0.7, tags: ['motivation', 'upbeat'] },
  'больше драйва': { genres: ['workout'], energy: 0.9, valence: 0.7, danceability: 0.8, tags: ['drive', 'energetic'] },
  'включи мощность': { genres: ['workout'], energy: 0.95, valence: 0.6, danceability: 0.7, tags: ['power', 'heavy'] },
  'бит для победы': { genres: ['workout'], energy: 0.9, valence: 0.7, danceability: 0.8, tags: ['victory', 'anthem'] },
  'не останавливаться': { genres: ['workout'], energy: 0.9, valence: 0.6, danceability: 0.8, tags: ['nonstop', 'driving'] },
  'быстрый ритм': { genres: ['workout'], energy: 0.9, valence: 0.6, danceability: 0.8, tags: ['fast', 'tempo'] },
  'музыка для движения': { genres: ['workout'], energy: 0.85, valence: 0.7, danceability: 0.8, tags: ['movement', 'dance'] },
  'поднять настроение': { genres: ['workout'], energy: 0.7, valence: 0.8, danceability: 0.7, tags: ['upbeat', 'happy'] },
  'сделай громче': { genres: ['workout'], energy: 0.9, valence: 0.6, danceability: 0.7, tags: ['loud', 'powerful'] },

  // Mix (contextual — these map to acoustic properties, not genres)
  'музыка для ночи': { genres: [], energy: 0.5, valence: 0.4, danceability: 0.6, tags: ['night', 'atmospheric'] },
  'саундтрек дня': { genres: [], energy: 0.5, valence: 0.6, danceability: 0.5, tags: ['soundtrack', 'cinematic'] },
  'главный герой': { genres: [], energy: 0.7, valence: 0.7, danceability: 0.6, tags: ['anthem', 'empowering'] },
  'треки с мурашками': { genres: [], energy: 0.5, valence: 0.6, danceability: 0.5, tags: ['goosebumps', 'emotional'] },
  'атмосфера момента': { genres: [], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['atmospheric', 'mood'] },
  'музыка под дождь': { genres: [], energy: 0.25, valence: 0.3, danceability: 0.2, tags: ['rain', 'melancholy'] },
  'для долгой дороги': { genres: [], energy: 0.6, valence: 0.6, danceability: 0.5, tags: ['road', 'driving'] },
  'когда хочется подумать': { genres: [], energy: 0.2, valence: 0.4, danceability: 0.2, tags: ['introspective', 'ambient', 'calm'] },
  'когда хочется танцевать': { genres: [], energy: 0.8, valence: 0.7, danceability: 0.95, tags: ['dance', 'party'] },
  'просто хороший звук': { genres: [], energy: 0.5, valence: 0.6, danceability: 0.5, tags: ['good', 'quality'] },
  'открой что-то новое': { genres: [], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['discovery', 'new'] },
  'моя новая музыка': { genres: [], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['new', 'discovery'] },

  // English versions
  'energetic rock': { genres: ['rock'], energy: 0.8, valence: 0.7, danceability: 0.5, tags: ['guitar', 'driving'] },
  'rock classics': { genres: ['rock'], energy: 0.6, valence: 0.6, danceability: 0.4, tags: ['classic', 'guitar'] },
  'modern rock': { genres: ['rock'], energy: 0.7, valence: 0.6, danceability: 0.5, tags: ['modern', 'guitar'] },
  'heavy guitars': { genres: ['rock', 'metal'], energy: 0.9, valence: 0.5, danceability: 0.4, tags: ['guitar', 'heavy'] },
  'alternative rock': { genres: ['rock', 'indie'], energy: 0.6, valence: 0.5, danceability: 0.5, tags: ['alternative', 'guitar'] },
  'rock ballads': { genres: ['rock'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['ballad', 'emotional'] },
  'grunge': { genres: ['rock'], energy: 0.7, valence: 0.3, danceability: 0.4, tags: ['grunge', 'raw'] },
  'punk rock': { genres: ['rock'], energy: 0.9, valence: 0.6, danceability: 0.6, tags: ['punk', 'fast'] },
  'hard rock': { genres: ['rock'], energy: 0.85, valence: 0.6, danceability: 0.5, tags: ['hard', 'guitar'] },
  'indie rock': { genres: ['rock', 'indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['indie', 'guitar'] },
  'russian rock': { genres: ['rock'], energy: 0.6, valence: 0.5, danceability: 0.4, tags: ['russian', 'guitar'] },
  'british rock': { genres: ['rock'], energy: 0.6, valence: 0.6, danceability: 0.5, tags: ['british', 'guitar'] },

  'heavy metal': { genres: ['metal'], energy: 0.95, valence: 0.5, danceability: 0.4, tags: ['heavy', 'aggressive'] },
  'epic metal': { genres: ['metal'], energy: 0.85, valence: 0.7, danceability: 0.4, tags: ['epic', 'symphonic'] },
  'metal for charging': { genres: ['metal'], energy: 0.9, valence: 0.6, danceability: 0.5, tags: ['energetic', 'driving'] },
  'metal classics': { genres: ['metal'], energy: 0.8, valence: 0.5, danceability: 0.4, tags: ['classic', 'guitar'] },
  'modern metal': { genres: ['metal'], energy: 0.85, valence: 0.5, danceability: 0.5, tags: ['modern', 'heavy'] },
  'death metal': { genres: ['metal'], energy: 1.0, valence: 0.2, danceability: 0.3, tags: ['death', 'aggressive'] },
  'black metal': { genres: ['metal'], energy: 0.95, valence: 0.1, danceability: 0.2, tags: ['black', 'dark'] },
  'power metal': { genres: ['metal'], energy: 0.9, valence: 0.8, danceability: 0.5, tags: ['power', 'epic'] },
  'doom metal': { genres: ['metal'], energy: 0.4, valence: 0.2, danceability: 0.2, tags: ['doom', 'slow', 'dark'] },
  'progressive metal': { genres: ['metal'], energy: 0.7, valence: 0.5, danceability: 0.4, tags: ['progressive', 'complex'] },
  'metalcore': { genres: ['metal', 'rock'], energy: 0.9, valence: 0.5, danceability: 0.5, tags: ['metalcore', 'aggressive'] },
  'symphonic metal': { genres: ['metal'], energy: 0.8, valence: 0.6, danceability: 0.4, tags: ['symphonic', 'epic'] },

  'i want bass': { genres: ['hiphop'], energy: 0.8, valence: 0.6, danceability: 0.8, tags: ['bass', 'heavy'] },
  'new hip-hop': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['modern', 'fresh'] },
  'rap on repeat': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['catchy', 'repetitive'] },
  'fresh flow': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['fresh', 'flow'] },
  'heavy beat': { genres: ['hiphop'], energy: 0.85, valence: 0.5, danceability: 0.8, tags: ['beat', 'heavy'] },
  'street vibe': { genres: ['hiphop'], energy: 0.7, valence: 0.5, danceability: 0.7, tags: ['street', 'urban'] },
  'rap unfiltered': { genres: ['hiphop'], energy: 0.8, valence: 0.5, danceability: 0.7, tags: ['raw', 'uncensored'] },
  'modern rap': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['modern', 'trap'] },
  'hip-hop classics': { genres: ['hiphop'], energy: 0.7, valence: 0.6, danceability: 0.7, tags: ['classic', 'old-school'] },
  'rap for the road': { genres: ['hiphop'], energy: 0.75, valence: 0.6, danceability: 0.7, tags: ['driving', 'cruising'] },
  'bass in headphones': { genres: ['hiphop', 'edm'], energy: 0.8, valence: 0.6, danceability: 0.8, tags: ['bass', 'headphones'] },
  'night hip-hop': { genres: ['hiphop'], energy: 0.6, valence: 0.4, danceability: 0.7, tags: ['night', 'moody'] },

  'night edm': { genres: ['edm'], energy: 0.8, valence: 0.5, danceability: 0.9, tags: ['night', 'club'] },
  'club mode': { genres: ['edm'], energy: 0.85, valence: 0.7, danceability: 0.95, tags: ['club', 'dance'] },
  'dance vibe': { genres: ['edm'], energy: 0.8, valence: 0.7, danceability: 0.95, tags: ['dance', 'upbeat'] },
  'more synths': { genres: ['edm'], energy: 0.7, valence: 0.6, danceability: 0.8, tags: ['synth', 'electronic'] },
  'electronic without words': { genres: ['edm'], energy: 0.6, valence: 0.5, danceability: 0.7, tags: ['instrumental', 'electronic'] },
  'deep bass': { genres: ['edm'], energy: 0.75, valence: 0.5, danceability: 0.8, tags: ['bass', 'deep'] },
  'futuristic sound': { genres: ['edm'], energy: 0.7, valence: 0.6, danceability: 0.8, tags: ['futuristic', 'electronic'] },
  'atmospheric electronic': { genres: ['edm'], energy: 0.5, valence: 0.5, danceability: 0.6, tags: ['atmospheric', 'electronic'] },
  'energetic house': { genres: ['edm'], energy: 0.85, valence: 0.7, danceability: 0.95, tags: ['house', 'energetic'] },
  'best techno set': { genres: ['edm'], energy: 0.8, valence: 0.5, danceability: 0.9, tags: ['techno', 'set'] },
  'music of the future': { genres: ['edm'], energy: 0.7, valence: 0.6, danceability: 0.8, tags: ['future', 'electronic'] },
  'beat till morning': { genres: ['edm'], energy: 0.8, valence: 0.6, danceability: 0.9, tags: ['all-night', 'dance'] },

  'just relax': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.3, tags: ['relax', 'calm'] },
  'lo-fi evening': { genres: ['chill'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['lofi', 'study'] },
  'chill vibe': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.3, tags: ['calm', 'peaceful'] },
  'music for rest': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.3, tags: ['rest', 'relax'] },
  'quiet atmosphere': { genres: ['chill'], energy: 0.15, valence: 0.4, danceability: 0.2, tags: ['quiet', 'ambient'] },
  'for study and work': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.2, tags: ['focus', 'study'] },
  'night chill': { genres: ['chill'], energy: 0.2, valence: 0.4, danceability: 0.3, tags: ['night', 'calm'] },
  'soft melodies': { genres: ['chill'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['soft', 'melodic'] },
  'peaceful thoughts': { genres: ['chill'], energy: 0.15, valence: 0.4, danceability: 0.2, tags: ['introspective', 'calm'] },
  'background music': { genres: ['chill'], energy: 0.2, valence: 0.5, danceability: 0.2, tags: ['background', 'ambient'] },
  'cozy sound': { genres: ['chill'], energy: 0.25, valence: 0.6, danceability: 0.3, tags: ['cozy', 'warm'] },
  'slow evening': { genres: ['chill'], energy: 0.2, valence: 0.4, danceability: 0.3, tags: ['slow', 'evening'] },

  'soulful r&b': { genres: ['jazz'], energy: 0.4, valence: 0.6, danceability: 0.5, tags: ['soul', 'rnb'] },
  'night jazz': { genres: ['jazz'], energy: 0.3, valence: 0.4, danceability: 0.4, tags: ['jazz', 'night'] },
  'more soul': { genres: ['jazz'], energy: 0.4, valence: 0.6, danceability: 0.5, tags: ['soul', 'vocal'] },
  'warm vocals': { genres: ['jazz'], energy: 0.3, valence: 0.5, danceability: 0.4, tags: ['vocal', 'warm'] },
  'smooth r&b': { genres: ['jazz'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['smooth', 'rnb'] },
  'classic jazz': { genres: ['jazz'], energy: 0.3, valence: 0.5, danceability: 0.4, tags: ['classic', 'jazz'] },
  'romantic soul': { genres: ['jazz'], energy: 0.3, valence: 0.6, danceability: 0.4, tags: ['romantic', 'soul'] },
  'music with soul': { genres: ['jazz'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['soul', 'emotional'] },
  'evening jazz': { genres: ['jazz'], energy: 0.3, valence: 0.5, danceability: 0.4, tags: ['evening', 'jazz'] },
  'calm vocals': { genres: ['jazz'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['calm', 'vocal'] },
  'atmospheric r&b': { genres: ['jazz'], energy: 0.35, valence: 0.5, danceability: 0.5, tags: ['atmospheric', 'rnb'] },
  'good old soul': { genres: ['jazz'], energy: 0.35, valence: 0.6, danceability: 0.5, tags: ['classic', 'soul'] },

  'grand symphony': { genres: ['classical'], energy: 0.6, valence: 0.6, danceability: 0.1, tags: ['symphony', 'orchestra'] },
  'music like in movies': { genres: ['classical'], energy: 0.5, valence: 0.5, danceability: 0.1, tags: ['cinematic', 'soundtrack'] },
  'epic orchestras': { genres: ['classical'], energy: 0.7, valence: 0.6, danceability: 0.1, tags: ['epic', 'orchestra'] },
  'peaceful classical': { genres: ['classical'], energy: 0.2, valence: 0.5, danceability: 0.1, tags: ['calm', 'classical'] },
  'classical for work': { genres: ['classical'], energy: 0.3, valence: 0.5, danceability: 0.1, tags: ['focus', 'classical'] },
  'beautiful melodies': { genres: ['classical'], energy: 0.3, valence: 0.6, danceability: 0.1, tags: ['melodic', 'beautiful'] },
  'majestic sound': { genres: ['classical'], energy: 0.6, valence: 0.6, danceability: 0.1, tags: ['majestic', 'orchestra'] },
  'orchestra and emotions': { genres: ['classical'], energy: 0.5, valence: 0.5, danceability: 0.1, tags: ['emotional', 'orchestra'] },
  'classical masterpieces': { genres: ['classical'], energy: 0.4, valence: 0.5, danceability: 0.1, tags: ['masterpiece', 'classical'] },
  'music for reflection': { genres: ['classical'], energy: 0.2, valence: 0.4, danceability: 0.1, tags: ['introspective', 'calm'] },
  'deep classical': { genres: ['classical'], energy: 0.3, valence: 0.4, danceability: 0.1, tags: ['deep', 'classical'] },
  'timeless music': { genres: ['classical'], energy: 0.3, valence: 0.5, danceability: 0.1, tags: ['timeless', 'classical'] },

  'find something new': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['discovery', 'new'] },
  'indie mood': { genres: ['indie'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['indie', 'moody'] },
  'music unlike others': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['unique', 'indie'] },
  'hidden gems': { genres: ['indie'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['hidden', 'gem'] },
  'new names': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['new', 'artist'] },
  'alternative vibe': { genres: ['indie', 'rock'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['alternative', 'indie'] },
  'weird but beautiful': { genres: ['indie'], energy: 0.4, valence: 0.5, danceability: 0.4, tags: ['quirky', 'beautiful'] },
  'artists of tomorrow': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['emerging', 'new'] },
  'fresh scene': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['fresh', 'scene'] },
  'unusual sound': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['unusual', 'experimental'] },
  'indie for evening': { genres: ['indie'], energy: 0.4, valence: 0.5, danceability: 0.5, tags: ['indie', 'evening'] },
  'beyond the hits': { genres: ['indie'], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['deep-cut', 'indie'] },

  'warm acoustic': { genres: ['folk'], energy: 0.3, valence: 0.6, danceability: 0.3, tags: ['acoustic', 'warm'] },
  'music by the campfire': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['campfire', 'acoustic'] },
  'acoustic stories': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['acoustic', 'storytelling'] },
  'calm guitar': { genres: ['folk'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['guitar', 'calm'] },
  'voice and melody': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['vocal', 'melodic'] },
  'heartfelt folk': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['folk', 'soulful'] },
  'road and music': { genres: ['folk'], energy: 0.35, valence: 0.5, danceability: 0.3, tags: ['road', 'travel'] },
  'live sound': { genres: ['folk'], energy: 0.4, valence: 0.5, danceability: 0.4, tags: ['live', 'organic'] },
  'simple songs': { genres: ['folk'], energy: 0.25, valence: 0.5, danceability: 0.3, tags: ['simple', 'folk'] },
  'nature atmosphere': { genres: ['folk'], energy: 0.2, valence: 0.5, danceability: 0.2, tags: ['nature', 'ambient'] },
  'country mood': { genres: ['folk'], energy: 0.35, valence: 0.6, danceability: 0.4, tags: ['country', 'folk'] },
  'music with history': { genres: ['folk'], energy: 0.3, valence: 0.5, danceability: 0.3, tags: ['storytelling', 'folk'] },

  'charge with music': { genres: ['workout'], energy: 0.9, valence: 0.7, danceability: 0.8, tags: ['energetic', 'motivation'] },
  'music for workout': { genres: ['workout'], energy: 0.9, valence: 0.7, danceability: 0.8, tags: ['workout', 'driving'] },
  'maximum energy': { genres: ['workout'], energy: 1.0, valence: 0.7, danceability: 0.8, tags: ['maximum', 'energy'] },
  'motivation mode': { genres: ['workout'], energy: 0.85, valence: 0.7, danceability: 0.7, tags: ['motivation', 'upbeat'] },
  'more drive': { genres: ['workout'], energy: 0.9, valence: 0.7, danceability: 0.8, tags: ['drive', 'energetic'] },
  'turn up the power': { genres: ['workout'], energy: 0.95, valence: 0.6, danceability: 0.7, tags: ['power', 'heavy'] },
  'beat for victory': { genres: ['workout'], energy: 0.9, valence: 0.7, danceability: 0.8, tags: ['victory', 'anthem'] },
  'don\'t stop': { genres: ['workout'], energy: 0.9, valence: 0.6, danceability: 0.8, tags: ['nonstop', 'driving'] },
  'fast rhythm': { genres: ['workout'], energy: 0.9, valence: 0.6, danceability: 0.8, tags: ['fast', 'tempo'] },
  'music for movement': { genres: ['workout'], energy: 0.85, valence: 0.7, danceability: 0.8, tags: ['movement', 'dance'] },
  'boost your mood': { genres: ['workout'], energy: 0.7, valence: 0.8, danceability: 0.7, tags: ['upbeat', 'happy'] },
  'turn it louder': { genres: ['workout'], energy: 0.9, valence: 0.6, danceability: 0.7, tags: ['loud', 'powerful'] },

  'music for night': { genres: [], energy: 0.5, valence: 0.4, danceability: 0.6, tags: ['night', 'atmospheric'] },
  'daily soundtrack': { genres: [], energy: 0.5, valence: 0.6, danceability: 0.5, tags: ['soundtrack', 'cinematic'] },
  'main character': { genres: [], energy: 0.7, valence: 0.7, danceability: 0.6, tags: ['anthem', 'empowering'] },
  'tracks with chills': { genres: [], energy: 0.5, valence: 0.6, danceability: 0.5, tags: ['goosebumps', 'emotional'] },
  'atmosphere of the moment': { genres: [], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['atmospheric', 'mood'] },
  'music in the rain': { genres: [], energy: 0.25, valence: 0.3, danceability: 0.2, tags: ['rain', 'melancholy'] },
  'for the long road': { genres: [], energy: 0.6, valence: 0.6, danceability: 0.5, tags: ['road', 'driving'] },
  'when you want to think': { genres: [], energy: 0.2, valence: 0.4, danceability: 0.2, tags: ['introspective', 'ambient', 'calm'] },
  'when you want to dance': { genres: [], energy: 0.8, valence: 0.7, danceability: 0.95, tags: ['dance', 'party'] },
  'just good sound': { genres: [], energy: 0.5, valence: 0.6, danceability: 0.5, tags: ['good', 'quality'] },
  'discover something new': { genres: [], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['discovery', 'new'] },
  'my new music': { genres: [], energy: 0.5, valence: 0.5, danceability: 0.5, tags: ['new', 'discovery'] },
}

/**
 * Get mood tags for a given phrase.
 * Returns acoustic property hints for the vector similarity scoring.
 */
export function phraseToMoodTags(phrase: string): MoodTags | null {
  return MOOD_TAGS[phrase.toLowerCase().trim()] ?? null
}

/**
 * Get the category ID for a mood phrase (for genre-based filtering).
 */
export function phraseToCategory(phrase: string): CategoryId | null {
  for (const cat of CATEGORIES) {
    if (RU[cat]?.some(p => p.toLowerCase() === phrase.toLowerCase().trim())) return cat
    if (EN[cat]?.some(p => p.toLowerCase() === phrase.toLowerCase().trim())) return cat
  }
  return null
}