import { useId } from 'react'
import { categoryColor } from '@/lib/categoryColor'

/**
 * Брендовые декоративные «обложки» для карточек услуг.
 *
 * Жёсткие бренд-ограничения (официальный брендбук АО «Байтерек»):
 *  — палитра ТОЛЬКО зелёная семья (categoryColor) + тан/золото #B4975A как
 *    сдержанный акцент + кремовые/белые нейтрали. Никаких чужих hue.
 *  — мотивы: плоская геометрия, тонкие линии, орнамент «кулпытас» (мировое
 *    древо), степной горизонт, дуги. Премиально, не мультяшно.
 *
 * Иллюстрация чисто декоративная: svg помечен aria-hidden. Текст поверх неё
 * не размещаем (золото на кремовом ~3:1 проваливает AA), в карточках обложка
 * идёт отдельной «шапкой» над контентом.
 *
 * Композиция детерминирована по category (ключи — как в CATEGORY_COLORS),
 * поэтому одна и та же услуга всегда получает один и тот же мотив.
 */

const GOLD = '#B4975A'
const CREAM = '#FAF6EC'

/** Корпоративный орнамент кулпытас (мировое древо) — тот же мотив, что в
 *  .ornament-tile (index.css). Используем как полупрозрачный фоновый слой. */
function Kulpytas({ color, opacity, transform }: { color: string; opacity: number; transform: string }) {
  return (
    <g transform={transform} opacity={opacity} fill="none" stroke={color}
       strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M48 24L72 48L48 72L24 48Z" />
      <path d="M48 36C54 36 60 42 60 48C60 54 54 60 48 60C42 60 36 54 36 48C36 42 42 36 48 36Z" />
      <path d="M36 24C36 18 30 12 24 12C18 12 14 16 14 22C14 28 18 32 24 32C28 32 32 28 32 24" />
      <path d="M60 24C60 18 66 12 72 12C78 12 82 16 82 22C82 28 78 32 72 32C68 32 64 28 64 24" />
      <path d="M36 72C36 78 30 84 24 84C18 84 14 80 14 74C14 68 18 64 24 64C28 64 32 68 32 72" />
      <path d="M60 72C60 78 66 84 72 84C78 84 82 80 82 74C82 68 78 64 72 64C68 64 64 68 64 72" />
      <path d="M24 36C18 36 12 30 12 24C12 18 16 14 22 14C28 14 32 18 32 24C32 28 28 32 24 32" />
      <path d="M24 60C18 60 12 66 12 72C12 78 16 82 22 82C28 82 32 78 32 72C32 68 28 64 24 64" />
      <path d="M72 36C78 36 84 30 84 24C84 18 80 14 74 14C68 14 64 18 64 24C64 28 68 32 72 32" />
      <path d="M72 60C78 60 84 66 84 72C84 78 80 82 74 82C68 82 64 78 64 72C64 68 68 64 72 64" />
    </g>
  )
}

/** Основной мотив по категории. Координаты в системе viewBox 0 0 320 120,
 *  вертикально центрируем вокруг y≈60 (при slice-обрезке низ/верх съедаются). */
function motif(category: string | null | undefined, c: string): JSX.Element {
  const s = { fill: 'none', stroke: c, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

  switch (category) {
    // Финансирование — концентрические круги (монеты) + стопка монет
    case 'Финансирование':
      return (
        <g {...s}>
          <circle cx={112} cy={60} r={40} />
          <circle cx={112} cy={60} r={27} />
          <circle cx={112} cy={60} r={14} />
          <circle cx={112} cy={60} r={4} fill={GOLD} stroke="none" />
          <g transform="translate(220,0)">
            <ellipse cx={0} cy={74} rx={30} ry={9} />
            <ellipse cx={0} cy={60} rx={30} ry={9} />
            <ellipse cx={0} cy={46} rx={30} ry={9} />
            <line x1={-13} y1={46} x2={13} y2={46} stroke={GOLD} />
          </g>
        </g>
      )

    // Кредит — восходящие ступени (сомкнутая лестница) + золотая стрелка тренда
    case 'Кредит':
      return (
        <g {...s}>
          <rect x={52} y={76} width={44} height={20} rx={2} />
          <rect x={96} y={60} width={44} height={36} rx={2} />
          <rect x={140} y={44} width={44} height={52} rx={2} />
          <rect x={184} y={28} width={44} height={68} rx={2} />
          <path d="M60 72 L104 56 L148 40 L200 24" stroke={GOLD} />
          <path d="M186 24 L200 24 L200 38" stroke={GOLD} />
        </g>
      )

    // Лизинг — силуэт техники с колёсами и дугами
    case 'Лизинг':
      return (
        <g {...s}>
          <path d="M92 80 L92 58 L150 58 L172 44 L214 44 L230 58 L230 80" />
          <circle cx={120} cy={82} r={15} />
          <circle cx={206} cy={82} r={15} />
          <circle cx={120} cy={82} r={4} fill={GOLD} stroke="none" />
          <circle cx={206} cy={82} r={4} fill={GOLD} stroke="none" />
        </g>
      )

    // Гарантии — щит-арка с золотой галочкой + купольная дуга
    case 'Гарантии':
      return (
        <g {...s}>
          <path d="M126 40 A42 42 0 0 1 194 40" opacity={0.5} />
          <path d="M160 28 L194 42 L194 66 C194 84 179 96 160 102 C141 96 126 84 126 66 L126 42 Z" />
          <path d="M146 64 L157 74 L176 50" stroke={GOLD} strokeWidth={2.5} />
        </g>
      )

    // Субсидии — знак процента (два круга + диагональ) + пересекающиеся круги
    case 'Субсидии':
      return (
        <g {...s}>
          <line x1={196} y1={32} x2={124} y2={90} strokeWidth={2} />
          <circle cx={134} cy={46} r={15} />
          <circle cx={186} cy={78} r={15} />
          <circle cx={134} cy={46} r={4} fill={GOLD} stroke="none" />
        </g>
      )

    // Гранты — росток (мировое древо) + золотые лучи-звезда
    case 'Гранты':
      return (
        <g {...s}>
          <path d="M160 102 L160 52" />
          <path d="M160 72 C139 72 127 60 127 44 C148 44 160 56 160 72" />
          <path d="M160 62 C181 62 193 50 193 34 C172 34 160 46 160 62" />
          <g stroke={GOLD}>
            <line x1={160} y1={30} x2={160} y2={12} />
            <line x1={145} y1={22} x2={136} y2={11} />
            <line x1={175} y1={22} x2={184} y2={11} />
          </g>
          <circle cx={160} cy={31} r={4} fill={GOLD} stroke="none" />
        </g>
      )

    // Экспорт — потоки-стрелки за горизонт + степные волны
    case 'Экспорт':
      return (
        <g {...s}>
          <path d="M36 86 C68 78 98 94 128 86 C158 78 190 94 220 86 C250 78 282 94 300 86" opacity={0.55} />
          <path d="M70 92 L112 74 L152 82 L204 56" opacity={0.5} />
          <path d="M70 76 L112 56 L152 64 L204 38" stroke={GOLD} />
          <path d="M190 38 L204 38 L204 52" stroke={GOLD} />
        </g>
      )

    // Инвестиции — растущие столбики + крона мирового древа + золотой тренд
    case 'Инвестиции':
      return (
        <g {...s}>
          <rect x={60} y={74} width={16} height={22} rx={2} />
          <rect x={102} y={60} width={16} height={36} rx={2} />
          <rect x={144} y={46} width={16} height={50} rx={2} />
          <rect x={186} y={30} width={16} height={66} rx={2} />
          <path d="M68 70 L110 56 L152 42 L194 28" stroke={GOLD} />
          <path d="M194 30 L206 18 M194 34 L182 22" />
          <circle cx={194} cy={28} r={4} fill={GOLD} stroke="none" />
        </g>
      )

    // Агросектор — колосья над полем со сходящимися бороздами
    case 'Агросектор':
      return (
        <g {...s}>
          <path d="M44 100 L276 100" opacity={0.45} />
          <path d="M64 100 L150 58" opacity={0.4} />
          <path d="M150 58 L236 100" opacity={0.4} />
          <line x1={160} y1={102} x2={160} y2={40} />
          {[52, 64, 76, 88].map((y, i) => (
            <g key={y} stroke={i === 0 ? GOLD : c}>
              <path d={`M160 ${y} C150 ${y - 4} 146 ${y - 12} 148 ${y - 20} C158 ${y - 18} 162 ${y - 8} 160 ${y}`} />
              <path d={`M160 ${y} C170 ${y - 4} 174 ${y - 12} 172 ${y - 20} C162 ${y - 18} 158 ${y - 8} 160 ${y}`} />
            </g>
          ))}
        </g>
      )

    // fallback (нет/неизвестная категория) — чистый кулпытас-тайл
    default:
      return (
        <g>
          <Kulpytas color={c} opacity={0.5} transform="translate(112,12) scale(1)" />
          <circle cx={160} cy={60} r={4} fill={GOLD} />
        </g>
      )
  }
}

export function CategoryArt({
  category,
  height,
  style,
}: {
  category?: string | null
  height: number
  style?: React.CSSProperties
}) {
  // useId гарантирует уникальность градиента, когда на странице десятки обложек.
  const uid = useId().replace(/:/g, '')
  const gradId = `ca-grad-${uid}`
  const c = categoryColor(category)

  return (
    <svg
      viewBox="0 0 320 120"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height={height}
      aria-hidden="true"
      style={{ display: 'block', ...style }}
    >
      <defs>
        {/* мягкий фон: кремовый → тонированный оттенком категории */}
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity={0} />
          <stop offset="1" stopColor={c} stopOpacity={0.16} />
        </linearGradient>
      </defs>

      <rect width={320} height={120} fill={CREAM} />
      <rect width={320} height={120} fill={`url(#${gradId})`} />

      {/* полупрозрачный орнаментальный слой (кулпытас) по краям */}
      <Kulpytas color={c} opacity={0.06} transform="translate(-26,18) scale(0.82)" />
      <Kulpytas color={c} opacity={0.05} transform="translate(258,22) scale(0.68)" />

      {/* основной мотив категории */}
      {motif(category, c)}
    </svg>
  )
}
