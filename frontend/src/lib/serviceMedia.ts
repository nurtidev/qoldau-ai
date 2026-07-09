/**
 * Резолвер медиа-обложек услуг (фото + hover-видео) — инфраструктура «как в
 * akk-portal», но с фолбэками: файлов ещё может не быть, тогда обложка остаётся
 * прежним SVG (CategoryArt), а этот модуль лишь строит пути по конвенции.
 *
 * Конвенция путей:
 *   frontend/public/media/services/<key>.jpg  — статичное фото (базовый слой)
 *   frontend/public/media/services/<key>.mp4  — hover-видео (необязательно)
 *
 * Почему по подстроке title, а не по id/uuid: id услуг генерятся uuid_generate_v4
 * и различаются между окружениями (dev / прод / fresh-migrate), поэтому матч по
 * id дал бы 0 совпадений на проде. Стабильный якорь — человекочитаемый title
 * (и, вторым уровнем, category). Существование файла НЕ проверяется — за фолбэк
 * отвечает onError в MediaCover.
 */

export interface ServiceMedia {
  /** Ключ медиа (без расширения), напр. 'orleu'. undefined — обложки нет. */
  key?: string
  /** Абсолютный путь к фото, напр. '/media/services/orleu.jpg'. */
  image?: string
  /** Абсолютный путь к видео, напр. '/media/services/orleu.mp4'. */
  video?: string
  /** CSS object-position для кропа фото/видео в низкой полосе обложки. */
  focus?: string
}

/**
 * Уровень 1 — точечный матч по подстроке title (в нижнем регистре).
 * Порядок важен: первое совпадение выигрывает (более специфичные — выше).
 * Ключи выверены по реальным услугам (миграции 013): Өрлеу, Кең дала 2,
 * Іскер аймақ, лизинг сельхозтехники, авиатранспорт/вагоны, гарантии Даму,
 * микрокредитование, экспорт. greenhouse/садоводство — на будущее (сейчас нет).
 */
const TITLE_RULES: ReadonlyArray<readonly [needle: string, key: string]> = [
  ['вагон', 'wagons'],                 // Приобретение авиатранспорта и вагонов в лизинг
  ['авиатранспорт', 'wagons'],
  ['животновод', 'agro-livestock'],    // Агробизнес — развитие животноводства
  ['кең дала', 'ken-dala'],            // Кең дала 2 — весенне-полевые работы
  ['өрлеу', 'orleu'],                  // Өрлеу — льготное кредитование МСБ
  ['іскер', 'isker'],                  // Іскер аймақ — субсидирование ставки
  ['лизинг сельхоз', 'leasing-agro'],  // Льготный лизинг сельхозтехники
  ['лизинг сельскохоз', 'leasing-agro'],
  ['гарант', 'damu-guarantee'],        // Гарантирование / гарантия по кредиту
  ['микрокредит', 'microcredit'],      // Микрокредитование для начинающих
  ['экспорт', 'export'],               // Страхование / финансирование экспорта
  ['теплиц', 'greenhouse'],            // (на будущее — теплицы/садоводство)
  ['садов', 'greenhouse'],
]

/**
 * Уровень 2 — обобщённая обложка по направлению (category), если по title
 * точечного матча не нашлось. Категории — как в CATEGORY_COLORS / DB.
 */
const CATEGORY_RULES: Readonly<Record<string, string>> = {
  'Финансирование': 'finance-generic',
  'Кредит': 'credit-generic',
  'Лизинг': 'leasing-generic',
  'Гарантии': 'guarantee-generic',
  'Субсидии': 'subsidy-generic',
  'Гранты': 'grant-generic',
  'Экспорт': 'export-generic',
  'Инвестиции': 'invest-generic',
  'Агросектор': 'agro-generic',
}

/**
 * Фокус кадра (CSS object-position) по ключу. Обложка карточки — широкая
 * низкая полоса; object-fit:cover по умолчанию берёт вертикальный центр
 * 16:9-кадра и режет смысловой центр (у wagons состав уходил за верхний срез,
 * у ken-dala комбайн — над центром). Y подобран по реальным сгенерированным
 * jpg: где в кадре смысловой центр (состав ~20% высоты, комбайн ~33%,
 * стадо с фермой ~55%).
 */
const FOCUS: Readonly<Record<string, string>> = {
  'wagons': 'center 12%',         // состав и рельсы — верхняя треть кадра
  'ken-dala': 'center 30%',       // комбайн чуть выше центра
  'agro-livestock': 'center 55%', // стадо и ферма ниже центра
}

/** Дефолт для ключей без записи в FOCUS: чуть выше центра — у пейзажных
 *  кадров смысл обычно у горизонта, а не в нижней половине. */
export const DEFAULT_FOCUS = 'center 40%'

const BASE = '/media/services'

/** Ключ медиа для услуги (title → category), либо undefined. */
export function resolveServiceMediaKey(
  title?: string | null,
  category?: string | null,
): string | undefined {
  const t = (title ?? '').toLowerCase()
  for (const [needle, key] of TITLE_RULES) {
    if (t.includes(needle)) return key
  }
  if (category && category in CATEGORY_RULES) return CATEGORY_RULES[category]
  return undefined
}

/**
 * Пути к медиа услуги по конвенции. Существование файлов не проверяет —
 * компонент MediaCover сам скрывает слой по onError. Если ключ не резолвится
 * (нет ни title-, ни category-матча) — вернётся пустой объект (только SVG).
 */
export function resolveServiceMedia(
  title?: string | null,
  category?: string | null,
): ServiceMedia {
  const key = resolveServiceMediaKey(title, category)
  if (!key) return {}
  return {
    key,
    image: `${BASE}/${key}.jpg`,
    video: `${BASE}/${key}.mp4`,
    focus: FOCUS[key] ?? DEFAULT_FOCUS,
  }
}
