/**
 * Тактичный цветокод категорий услуг (design wave 2 — глубина каталога).
 *
 * Каталог услуг раньше был «серой массой» одинаковых бежево-белых карточек.
 * Даём сдержанный цветовой акцент по направлению (category), не заливку:
 * левый кант карточки + мягкий бейдж. Палитра — глубокие, приглушённые,
 * брендо-родственные тона (зелёный/тил/охра/золото), НЕ неон и НЕ радуга,
 * зеркалит значения из index.css :root (--cat-*), но хранится тут как hex,
 * т.к. JS считает alpha-подмешивание для мягкого фона бейджа.
 */

const CATEGORY_COLORS: Record<string, string> = {
  'Финансирование': '#07663D', // primary green
  'Кредит':         '#0F766E', // teal
  'Лизинг':         '#0F766E', // teal
  'Гарантии':       '#A16207', // deep ochre
  'Субсидии':       '#4D7C0F', // olive
  'Гранты':         '#8A6A14', // gold-text
  'Экспорт':        '#0E7490', // blue-teal
  'Инвестиции':     '#166534', // forest
  'Агросектор':     '#15803D', // green
}

const DEFAULT_COLOR = '#07663D' // == var(--color-primary)

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Глубокий приглушённый цвет категории. Используй как акцент (кант, точка), не заливку. */
export function categoryColor(category?: string | null): string {
  if (!category) return DEFAULT_COLOR
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR
}

/**
 * Мягкий тонированный фон под бейдж/иконку — цвет категории поверх белого на
 * заданной прозрачности. Дефолт 0.06 подобран так, чтобы текст цвета
 * categoryColor() поверх этого фона держал контраст ≥4.5:1 (WCAG AA) для
 * всей палитры категорий, включая самую светлую («Гарантии», ratio ~4.56).
 */
export function categorySoftBg(category?: string | null, alpha = 0.06): string {
  const [r, g, b] = hexToRgb(categoryColor(category))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
