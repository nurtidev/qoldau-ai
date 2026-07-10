import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { I } from '@/components/icons'
import { Portal } from '@/components/Portal'
import { contentApi, type AnalyticsMaterial } from '@/api/client'
import { BAITEREK_GROUP, PARTNER_ORGS } from '@/lib/orgs'

// ─── Presentation config ─────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  'Интерактивный отчёт': '#0F766E',
  'Финансовая отчётность': '#07663D',
  'Исследование': '#8A6A14',
  'Дашборд': '#6D28D9',
  'Годовой отчёт': '#334155',
}
const DEFAULT_TYPE_COLOR = '#334155'
const typeColor = (t?: string) => (t && TYPE_COLORS[t]) || DEFAULT_TYPE_COLOR
const GOLD = '#B4975A'

const FORMAT_LABEL: Record<string, string> = { web: 'Web', pdf: 'PDF', embed: 'Embed' }
const formatLabel = (f: string) => FORMAT_LABEL[f] ?? f
const FormatIcon = ({ format, size = 13 }: { format: string; size?: number }) =>
  format === 'pdf' ? <I.Document size={size} /> : format === 'embed' ? <I.Eye size={size} /> : <I.ExternalLink size={size} />

// ─── Org identity ────────────────────────────────────────────────────────────

interface ResolvedOrg { short: string; color: string; tag: string; logo?: string }
// «Холдинг «Байтерек»» отсутствует в ORGS (это не дочка, а сам холдинг) —
// используем официальный логотип шапки; иначе — тёмно-зелёная плашка «БТ».
const BAITEREK_HOLDING: ResolvedOrg = { short: 'Холдинг «Байтерек»', color: '#07663D', tag: 'БТ', logo: '/img/baiterek.png' }

function resolveOrg(orgName?: string): ResolvedOrg {
  if (!orgName) return { short: '—', color: DEFAULT_TYPE_COLOR, tag: '—' }
  if (orgName.includes('Байтерек')) return BAITEREK_HOLDING
  const hit = [...BAITEREK_GROUP, ...PARTNER_ORGS].find(
    (o) => (o.dbMatch && orgName.includes(o.dbMatch)) || o.short === orgName,
  )
  if (hit) return { short: hit.short, color: hit.color, tag: hit.tag, logo: hit.logo }
  return { short: orgName, color: DEFAULT_TYPE_COLOR, tag: orgName.slice(0, 2).toUpperCase() }
}

/** Компактная инлайн-плашка организации в мета-строке: логотип 18px или
 *  буквенный тег (onError-фолбэк — паттерн OrgTile на HomePage). Габариты
 *  img заданы жёстко: у SVG без intrinsic size `width:auto` может раздуть
 *  картинку на всю карточку, поэтому max-width обязателен. */
function OrgPill({ org }: { org: ResolvedOrg }) {
  const [logoOk, setLogoOk] = useState(!!org.logo)
  const showLogo = !!org.logo && logoOk
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        height: 26, minWidth: 26, padding: showLogo ? '0 5px' : 0,
        background: showLogo ? '#fff' : org.color,
        border: showLogo ? '1px solid var(--color-border)' : 'none',
        borderRadius: 7, overflow: 'hidden',
      }}
    >
      {showLogo ? (
        <img
          src={org.logo}
          alt={org.short}
          onError={() => setLogoOk(false)}
          style={{ height: 18, width: 'auto', maxWidth: 72, objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', lineHeight: 1 }}>
          {org.tag}
        </span>
      )}
    </span>
  )
}

// ─── Deterministic data-viz cover art ────────────────────────────────────────

/** FNV-1a → seed (детерминированно по id материала, без Math.random). */
function seededHash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
/** mulberry32 PRNG — стабильная последовательность из seed. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom → cubic bezier: гладкая линия по точкам. */
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]}`
  }
  return d
}

// viewBox 0 0 320 140 (16:7). Мотив по material_type, вариация — из rng.
function motif(type: string | undefined, c: string, rng: () => number): JSX.Element {
  const rand = (min: number, max: number) => min + rng() * (max - min)

  switch (type) {
    // Дашборд → группа столбцов (5–7) + 2 KPI-точки
    case 'Дашборд': {
      const n = 6
      const heights = Array.from({ length: n }, () => rand(30, 96))
      const maxI = heights.indexOf(Math.max(...heights))
      const slot = 252 / n
      const barW = slot - 12
      return (
        <g>
          {heights.map((h, i) => {
            const x = 40 + i * slot
            return (
              <rect key={i} x={x} y={120 - h} width={barW} height={h} rx={3}
                fill={c} fillOpacity={i === maxI ? 0.34 : 0.17} />
            )
          })}
          <circle cx={250} cy={30} r={5} fill={c} fillOpacity={0.75} />
          <circle cx={272} cy={30} r={5} fill={GOLD} fillOpacity={0.85} />
        </g>
      )
    }

    // Интерактивный отчёт → сглаженная линия с мягкой заливкой области
    case 'Интерактивный отчёт': {
      const n = 6
      const pts: Array<[number, number]> = Array.from({ length: n }, (_, i) => [
        34 + (i * 252) / (n - 1),
        Math.round(rand(42, 104)),
      ])
      const maxI = pts.reduce((best, p, i) => (p[1] < pts[best][1] ? i : best), 0)
      const line = smoothPath(pts)
      const area = `${line} L ${pts[n - 1][0]} 122 L ${pts[0][0]} 122 Z`
      return (
        <g>
          <path d={area} fill={c} fillOpacity={0.1} />
          <path d={line} fill="none" stroke={c} strokeOpacity={0.8} strokeWidth={2.5} strokeLinecap="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={i === maxI ? 4 : 3}
              fill={i === maxI ? GOLD : c} fillOpacity={i === maxI ? 1 : 0.85} />
          ))}
        </g>
      )
    }

    // Финансовая отчётность → строки таблицы с выделенным столбцом
    case 'Финансовая отчётность': {
      const rows = 5
      return (
        <g>
          <rect x={214} y={30} width={62} height={96} rx={4} fill={c} fillOpacity={0.1} />
          {Array.from({ length: rows }).map((_, i) => {
            const y = 42 + i * 20
            const head = i === 0
            return (
              <g key={i}>
                <rect x={34} y={y} width={rand(52, 84)} height={7} rx={3.5} fill={c} fillOpacity={head ? 0.55 : 0.26} />
                <rect x={140} y={y} width={rand(30, 52)} height={7} rx={3.5} fill={c} fillOpacity={head ? 0.5 : 0.24} />
                <rect x={224} y={y} width={rand(26, 42)} height={7} rx={3.5} fill={c} fillOpacity={head ? 0.62 : 0.42} />
              </g>
            )
          })}
        </g>
      )
    }

    // Годовой отчёт → обложка-буклет (задняя страница + текстовые строки + золотой корешок)
    case 'Годовой отчёт': {
      return (
        <g>
          <rect x={126} y={32} width={82} height={86} rx={5} fill={c} fillOpacity={0.1} />
          <rect x={112} y={26} width={84} height={92} rx={5} fill={c} fillOpacity={0.14} stroke={c} strokeOpacity={0.34} strokeWidth={1.5} />
          <line x1={112} y1={26} x2={112} y2={118} stroke={c} strokeOpacity={0.3} strokeWidth={1.5} />
          <rect x={124} y={40} width={rand(44, 62)} height={8} rx={2} fill={GOLD} fillOpacity={0.85} />
          {[62, 74, 86, 98].map((y, i) => (
            <rect key={y} x={124} y={y} width={rand(36, 62)} height={5} rx={2.5} fill={c} fillOpacity={0.28 - i * 0.02} />
          ))}
        </g>
      )
    }

    // Исследование → диаграмма рассеяния + линия тренда (по осям)
    case 'Исследование': {
      const dots = Array.from({ length: 11 }, () => [rand(48, 286), rand(38, 112)] as [number, number])
      return (
        <g>
          <path d="M40 30 L40 118 L288 118" fill="none" stroke={c} strokeOpacity={0.28} strokeWidth={1.5} strokeLinecap="round" />
          <path d="M52 112 L120 92 L184 66 L272 40" fill="none" stroke={c} strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round" strokeDasharray="1 6" />
          {dots.map((d, i) => (
            <circle key={i} cx={d[0]} cy={d[1]} r={i % 5 === 0 ? 4 : 3.2}
              fill={i % 5 === 0 ? GOLD : c} fillOpacity={i % 5 === 0 ? 0.9 : 0.5} />
          ))}
        </g>
      )
    }

    // fallback — мягкая сетка
    default:
      return (
        <g stroke={c} strokeOpacity={0.22} strokeWidth={1.5}>
          <line x1={40} y1={118} x2={288} y2={118} />
          <line x1={40} y1={30} x2={40} y2={118} />
          <circle cx={160} cy={74} r={5} fill={GOLD} stroke="none" />
        </g>
      )
  }
}

/** Обложка карточки: мягкий тон типа + детерминированный мотив данных.
 *  `zoom` укрупняет мотив вокруг центра viewBox (панель героя). */
function MaterialArt({ type, seed, zoom = 1, style }: { type?: string; seed: string; zoom?: number; style?: React.CSSProperties }) {
  const c = typeColor(type)
  const rng = useMemo(() => makeRng(seededHash(seed + (type ?? ''))), [seed, type])
  const gradId = useMemo(() => `art-${seededHash(seed).toString(36)}`, [seed])
  return (
    <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%', ...style }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity={0.04} />
          <stop offset="1" stopColor={c} stopOpacity={0.13} />
        </linearGradient>
      </defs>
      <rect width={320} height={140} fill="#fff" />
      <rect width={320} height={140} fill={`url(#${gradId})`} />
      {zoom !== 1
        ? <g transform={`translate(160 72) scale(${zoom}) translate(-160 -72)`}>{motif(type, c, rng)}</g>
        : motif(type, c, rng)}
    </svg>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

const isFeatured = (m: AnalyticsMaterial) =>
  m.material_type === 'Годовой отчёт' && !!m.org?.includes('Байтерек')

export function AnalyticsCatalogPage() {
  const [activeType, setActiveType] = useState('')
  const [org, setOrg] = useState('')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<AnalyticsMaterial | null>(null)

  const { data: materials = [], isLoading } = useQuery<AnalyticsMaterial[]>({
    queryKey: ['materials'],
    queryFn: () => contentApi.materials().then((r) => r.data ?? []),
  })

  const hasFilters = activeType !== '' || org !== '' || query.trim() !== ''
  const resetFilters = () => { setActiveType(''); setOrg(''); setQuery('') }

  const types = useMemo(
    () => Array.from(new Set(materials.map((m) => m.material_type).filter(Boolean) as string[])),
    [materials],
  )
  const typeCounts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const m of materials) if (m.material_type) acc[m.material_type] = (acc[m.material_type] ?? 0) + 1
    return acc
  }, [materials])
  const orgs = useMemo(
    () => Array.from(new Set(materials.map((m) => m.org).filter(Boolean) as string[])).sort(),
    [materials],
  )

  // Герой показываем только на «чистом» каталоге; тогда исключаем его из сетки.
  const featured = useMemo(
    () => (!hasFilters ? materials.find(isFeatured) ?? null : null),
    [materials, hasFilters],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return materials.filter((m) =>
      (!featured || m.id !== featured.id) &&
      (!activeType || m.material_type === activeType) &&
      (!org || m.org === org) &&
      (!q || m.title.toLowerCase().includes(q)),
    )
  }, [materials, featured, activeType, org, query])

  return (
    <div className="page-fade container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ marginBottom: 20 }}>
        <div className="section-eyebrow" style={{ marginBottom: 8 }}>Прозрачность</div>
        <h1 className="section-title" style={{ fontSize: 32 }}>Аналитическая отчётность</h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-2)', marginTop: 8, maxWidth: 720 }}>
          Единый каталог готовых аналитических материалов дочерних организаций Холдинга «Байтерек».
        </p>
      </div>

      {/* Positioning line (jury: подключение через ссылки/embedding, без дублирования BI) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, marginBottom: 24,
        fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.5,
      }}>
        <I.Info size={16} style={{ color: 'var(--color-info)', flexShrink: 0 }} />
        <span>Материалы подключаются дочерними организациями через ссылки или embedding — без дублирования BI-систем.</span>
      </div>

      {/* Featured hero */}
      {!isLoading && featured && (
        <FeaturedCard material={featured} onPreview={() => setPreview(featured)} />
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip active={activeType === ''} onClick={() => setActiveType('')}>Все типы</Chip>
          {types.map((t) => (
            <Chip key={t} active={activeType === t} color={typeColor(t)} onClick={() => setActiveType(t)}>
              {t} · {typeCounts[t] ?? 0}
            </Chip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 340 }}>
            <I.Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)' }} />
            <input
              className="input"
              placeholder="Поиск по названию…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select className="select" value={org} onChange={(e) => setOrg(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">Все организации</option>
            {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--color-text-3)' }}>
            Показано {filtered.length} из {materials.length}
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            {filtered.map((m) => (
              <MaterialCard key={m.id} material={m} onPreview={() => setPreview(m)} />
            ))}
            {filtered.length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', padding: '48px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)' }}>Материалы не найдены</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 6 }}>
                  Попробуйте изменить условия поиска или тип материала.
                </div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={resetFilters}>
                  <I.X size={14} /> Сбросить фильтры
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {preview && <PreviewModal material={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const c = typeColor(type)
  return (
    <span className="badge" style={{
      background: 'rgba(255,255,255,0.92)', color: c, border: `1px solid ${c}33`,
      fontWeight: 600, backdropFilter: 'saturate(1.1)',
    }}>{type}</span>
  )
}

function FormatBadge({ format }: { format: string }) {
  return (
    <span className="badge" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(255,255,255,0.92)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)',
    }}>
      <FormatIcon format={format} size={12} /> {formatLabel(format)}
    </span>
  )
}

function MetaBlock({ material, org }: { material: AnalyticsMaterial; org: ResolvedOrg }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.75, color: 'var(--color-text-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <OrgPill org={org} />
        <div style={{ fontWeight: 600, lineHeight: 1.35 }}>
          {material.org}
          {material.period && <span style={{ fontWeight: 400, color: 'var(--color-text-3)' }}> · актуально на {material.period}</span>}
        </div>
      </div>
      {material.source && <div style={{ color: 'var(--color-text-3)' }}>Источник: <span style={{ color: 'var(--color-text-2)' }}>{material.source}</span></div>}
      {material.updated_date && <div style={{ color: 'var(--color-text-3)' }}>Обновлено: <span style={{ color: 'var(--color-text-2)' }}>{material.updated_date}</span></div>}
    </div>
  )
}

function MaterialCard({ material, onPreview }: { material: AnalyticsMaterial; onPreview: () => void }) {
  const org = resolveOrg(material.org)
  return (
    <article className="card hover-lift" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 7' }}>
        <MaterialArt type={material.material_type} seed={material.id} />
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          {material.material_type && <TypeBadge type={material.material_type} />}
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <FormatBadge format={material.format} />
        </div>
      </div>
      <div style={{ padding: '15px 18px 18px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 650, lineHeight: 1.38, color: 'var(--color-text)' }}>{material.title}</div>
        <MetaBlock material={material} org={org} />
        <div style={{ marginTop: 'auto', paddingTop: 4 }}>
          {material.format === 'embed' ? (
            <button className="btn btn-secondary btn-sm btn-block" onClick={onPreview}>
              <I.Eye size={14} /> Предпросмотр
            </button>
          ) : (
            <a href={material.url || '#'} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm btn-block">
              <FormatIcon format={material.format} size={14} /> Открыть
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

function FeaturedCard({ material, onPreview }: { material: AnalyticsMaterial; onPreview: () => void }) {
  const org = resolveOrg(material.org)
  return (
    <article className="card analytics-hero hover-lift" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
      <div style={{ padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {material.material_type && <TypeBadge type={material.material_type} />}
          <FormatBadge format={material.format} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em', color: 'var(--color-text)', margin: 0 }}>
          {material.title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <OrgPill org={org} />
          <div style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
            {material.org}
            {material.period && <span style={{ color: 'var(--color-text-3)' }}> · актуально на {material.period}</span>}
          </div>
        </div>
        {material.source && (
          <div style={{ fontSize: 12.75, color: 'var(--color-text-3)' }}>Источник: <span style={{ color: 'var(--color-text-2)' }}>{material.source}</span></div>
        )}
        <div style={{ marginTop: 4 }}>
          {material.format === 'embed' ? (
            <button className="btn btn-primary btn-sm" onClick={onPreview} style={{ paddingInline: 18 }}>
              <I.Eye size={15} /> Предпросмотр
            </button>
          ) : (
            <a href={material.url || '#'} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ paddingInline: 18 }}>
              <FormatIcon format={material.format} size={15} /> Открыть материал
            </a>
          )}
        </div>
      </div>
      <div className="analytics-hero-art" style={{ position: 'relative', minHeight: 180 }}>
        <MaterialArt type={material.material_type} seed={material.id} zoom={1.5}
          style={{ position: 'absolute', inset: 0, height: '100%' }} />
      </div>
    </article>
  )
}

function CardSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="skeleton" style={{ aspectRatio: '16 / 7', borderRadius: 0 }} />
      <div style={{ padding: '15px 18px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="skeleton" style={{ height: 18, width: '92%' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="skeleton" style={{ height: 26, width: 26, borderRadius: 7 }} />
          <div className="skeleton" style={{ height: 14, width: '60%' }} />
        </div>
        <div className="skeleton" style={{ height: 14, width: '55%' }} />
        <div className="skeleton" style={{ height: 32, marginTop: 6 }} />
      </div>
    </div>
  )
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function Chip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  const c = color ?? 'var(--color-primary)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="badge"
      style={{
        height: 32, padding: '0 14px', cursor: 'pointer', border: '1px solid',
        borderColor: active ? c : 'var(--color-border)',
        background: active ? `${color ? color : '#07663D'}1A` : 'var(--color-surface)',
        color: active ? c : 'var(--color-text-2)',
        fontWeight: 500, fontSize: 13,
      }}
    >
      {children}
    </button>
  )
}

// ─── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({ material, onClose }: { material: AnalyticsMaterial; onClose: () => void }) {
  return (
    <Portal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, overflow: 'hidden' }}>
        {/* SVG-мотив шапкой — как на карточках */}
        <div style={{ height: 96 }}>
          <MaterialArt type={material.material_type} seed={material.id} />
        </div>

        <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', gap: 12 }}>
          <div>
            {material.material_type && (
              <div style={{ marginBottom: 8 }}><TypeBadge type={material.material_type} /></div>
            )}
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, color: 'var(--color-text)' }}>{material.title}</div>
            <div style={{ fontSize: 12.75, color: 'var(--color-text-2)', marginTop: 4 }}>{material.org}{material.source ? ` · ${material.source}` : ''}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0, flexShrink: 0 }}>
            <I.X size={16} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div className="skeleton" style={{ flex: 1, height: 160 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ height: 34 }} />
              <div className="skeleton" style={{ height: 34 }} />
              <div className="skeleton" style={{ height: 34 }} />
              <div className="skeleton" style={{ height: 34, width: '70%' }} />
            </div>
          </div>
          <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '75%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '82%' }} />

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, padding: '12px 14px',
            background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12.5, color: 'var(--color-text-2)',
          }}>
            <I.Info size={15} style={{ flexShrink: 0 }} />
            Материал встраивается из внешней системы через embedding
          </div>

          <a
            href={material.url || '#'}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary btn-block"
            style={{ marginTop: 16, height: 44 }}
          >
            Перейти к источнику <I.ExternalLink size={15} />
          </a>
        </div>
      </div>
    </div>
    </Portal>
  )
}
