import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import type { Map as LeafletMap, CircleMarker as LeafletCircleMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useQuery } from '@tanstack/react-query'
import { I } from '@/components/icons'
import { useIsNarrow } from '@/hooks/useMediaQuery'
import { contentApi, type MapProjectItem } from '@/api/client'

// ─── Presentation config ─────────────────────────────────────────────────────

interface Project extends MapProjectItem {
  coords: [number, number]
}

const ORG_COLORS: Record<string, string> = {
  'БРК': '#0A4D33',
  'ФРП': '#2E6B4F',
  'Даму': '#085E2C',
  'ЭКА KazakhExport': '#176D62',
  'Аграрная кредитная корпорация': '#1F6B3B',
  'КазАгроФинанс': '#257E43',
  'Kazakh Invest': '#387557',
  'Astana Hub': '#6E4A24',
  'QazIndustry': '#705C33',
}
const DEFAULT_ORG_COLOR = '#5E7468'
const orgColor = (o?: string) => (o && ORG_COLORS[o]) || DEFAULT_ORG_COLOR

// Реальные координаты областных центров/городов РК (с небольшим разбросом на проект)
const REGION_COORDS: Record<string, [number, number]> = {
  'Акмолинская':   [53.2833, 69.3833],
  'Алматинская':   [45.0167, 78.3667],
  'Атырауская':    [47.1167, 51.9000],
  'ВКО':           [49.9483, 82.6275],
  'Жамбылская':    [42.9000, 71.3667],
  'ЗКО':           [51.2333, 51.3667],
  'Карагандинская':[49.8047, 73.1094],
  'Костанайская':  [53.2144, 63.6246],
  'Кызылординская':[44.8479, 65.5093],
  'Мангистауская': [43.6481, 51.1801],
  'Павлодарская':  [52.2873, 76.9674],
  'СКО':           [54.8667, 69.1500],
  'Туркестанская': [43.2970, 68.2529],
  'Абай':          [50.4111, 80.2275],
  'Жетісу':        [44.8300, 78.7500],
  'Улытау':        [47.7833, 67.7000],
  'Астана':        [51.1694, 71.4491],
  'Алматы':        [43.2389, 76.8897],
  'Шымкент':       [42.3417, 69.5901],
}

function jitter([lat, lng]: [number, number], seed: number): [number, number] {
  const dx = ((seed * 37) % 100 - 50) / 100 * 0.6
  const dy = ((seed * 53) % 100 - 50) / 100 * 0.6
  return [lat + dx, lng + dy]
}

const MIN_AMOUNT = 145
const MAX_AMOUNT = 8500

function radiusFor(amount: number) {
  const t = Math.max(0, Math.min(1, (amount - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)))
  return 6 + t * (18 - 6)
}

function formatAmount(v: number) {
  return v.toLocaleString('ru-RU')
}

// От млн к млрд: суммы портфеля большие, в млрд читаются человечнее.
function formatBig(v: number) {
  return v >= 1000
    ? `${(v / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млрд ₸`
    : `${formatAmount(v)} млн ₸`
}

const STATUS_BADGE: Record<string, string> = {
  'Реализуется': 'badge-green',
  'Завершён': 'badge-blue',
  'Инвестфаза': 'badge-amber',
}
const statusBadge = (s?: string) => (s && STATUS_BADGE[s]) || 'badge-gray'

const NATIONAL_VIEW: [number, number] = [48.0, 67.0]
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ─── Page ───────────────────────────────────────────────────────────────────

export function ProjectsMapPage() {
  const [org, setOrg] = useState('')
  const [region, setRegion] = useState('')
  const [industry, setIndustry] = useState('')
  const [status, setStatus] = useState('')
  const [period, setPeriod] = useState('')

  const isNarrow = useIsNarrow()
  const mapRef = useRef<LeafletMap | null>(null)
  const mapWrapRef = useRef<HTMLDivElement | null>(null)
  // Реестр маркеров по id проекта — чтобы открыть попап нужного круга при клике
  // по карточке во флагманской ленте (id из API — строка).
  const markerRefs = useRef(new Map<string, LeafletCircleMarker>())

  const { data: raw = [], isLoading } = useQuery<MapProjectItem[]>({
    queryKey: ['map-projects'],
    queryFn: () => contentApi.mapProjects().then((r) => r.data ?? []),
  })

  // Проекты с координатами: явные lat/lng либо центр региона с детерминированным
  // разбросом по sort_order (сохраняет прежнее поведение при пустых lat/lng).
  const projects = useMemo<Project[]>(
    () => raw.map((p) => {
      const base: [number, number] = (p.region ? REGION_COORDS[p.region] : undefined) ?? NATIONAL_VIEW
      const coords: [number, number] =
        p.lat != null && p.lng != null ? [p.lat, p.lng] : jitter(base, p.sort_order)
      return { ...p, coords }
    }),
    [raw],
  )

  // На узких экранах карта/сайдбар переключаются с 2-колоночной сетки в 1-колоночную —
  // после смены раскладки контейнер карты меняет размеры, и Leaflet должен пересчитать
  // сетку тайлов, иначе останутся серые/обрезанные тайлы.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const raf = requestAnimationFrame(() => map.invalidateSize())
    return () => cancelAnimationFrame(raf)
  }, [isNarrow])

  const orgs = useMemo(() => Array.from(new Set(projects.map((p) => p.org).filter(Boolean) as string[])).sort(), [projects])
  const regions = useMemo(() => Array.from(new Set(projects.map((p) => p.region).filter(Boolean) as string[])).sort(), [projects])
  const industries = useMemo(() => Array.from(new Set(projects.map((p) => p.industry).filter(Boolean) as string[])).sort(), [projects])
  const statuses = useMemo(() => Array.from(new Set(projects.map((p) => p.status).filter(Boolean) as string[])).sort(), [projects])
  const periods = useMemo(() => Array.from(new Set(projects.map((p) => p.period).filter(Boolean) as string[])).sort(), [projects])

  const filtered = useMemo(() => {
    return projects.filter((p) =>
      (!org || p.org === org) &&
      (!region || p.region === region) &&
      (!industry || p.industry === industry) &&
      (!status || p.status === status) &&
      (!period || p.period === period)
    )
  }, [projects, org, region, industry, status, period])

  // Цифры hero — по ВСЕМ проектам (общий масштаб портфеля, не по фильтрам).
  const allStats = useMemo(() => {
    const totalAmount = projects.reduce((s, p) => s + (p.amount || 0), 0)
    const regionsCovered = new Set(projects.map((p) => p.region).filter(Boolean)).size
    const orgsCovered = new Set(projects.map((p) => p.org).filter(Boolean)).size
    return { count: projects.length, totalAmount, regionsCovered, orgsCovered }
  }, [projects])

  const filteredTotalAmount = useMemo(() => filtered.reduce((s, p) => s + (p.amount || 0), 0), [filtered])

  const regionDistribution = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>()
    filtered.forEach((p) => {
      const key = p.region ?? '—'
      const cur = map.get(key) ?? { count: 0, amount: 0 }
      cur.count += 1
      cur.amount += p.amount || 0
      map.set(key, cur)
    })
    const arr = Array.from(map.entries()).map(([r, v]) => ({ region: r, ...v }))
    arr.sort((a, b) => b.amount - a.amount)
    return arr.slice(0, 8)
  }, [filtered])

  const maxRegionAmount = regionDistribution.length ? regionDistribution[0].amount : 1

  // Топ-6 проектов выборки по сумме — для флагманской ленты.
  const topProjects = useMemo(
    () => [...filtered].sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 6),
    [filtered],
  )

  const hasFilters = !!(org || region || industry || status || period)
  const resetFilters = () => { setOrg(''); setRegion(''); setIndustry(''); setStatus(''); setPeriod('') }

  const heroTiles = [
    { v: String(allStats.count), l: 'проектов на карте' },
    { v: formatBig(allStats.totalAmount), l: 'общий объём финансирования' },
    { v: String(allStats.regionsCovered), l: 'регионов Казахстана' },
    { v: String(allStats.orgsCovered), l: 'организаций группы и партнёров' },
  ]

  // Клик по строке региона в сайдбаре: повторный клик по активному — сброс и
  // возврат к обзору страны; иначе — фильтр + перелёт к центру региона.
  const focusRegion = (r: string) => {
    const m = mapRef.current
    const reduce = prefersReducedMotion()
    if (region === r) {
      setRegion('')
      if (reduce) m?.setView(NATIONAL_VIEW, 5)
      else m?.flyTo(NATIONAL_VIEW, 5, { duration: 0.8 })
    } else {
      setRegion(r)
      const c = REGION_COORDS[r] ?? NATIONAL_VIEW
      if (reduce) m?.setView(c, 7)
      else m?.flyTo(c, 7, { duration: 0.8 })
    }
  }

  // Клик по карточке флагмана: подвести карту в вид, перелететь к проекту и
  // открыть его попап (после завершения перелёта). С уважением к reduce-motion.
  const focusProject = (p: Project) => {
    const reduce = prefersReducedMotion()
    mapWrapRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    const m = mapRef.current
    if (!m) return
    const openPopup = () => markerRefs.current.get(p.id)?.openPopup()
    if (reduce) {
      m.setView(p.coords, 9)
      openPopup()
    } else {
      m.once('moveend', openPopup)
      m.flyTo(p.coords, 9, { duration: 0.9 })
    }
  }

  return (
    <div className="page-fade">
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="hero-gradient-bg" style={{ paddingTop: 48, paddingBottom: 56, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(7,102,61,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(180deg, transparent, black 20%, black 80%, transparent)',
          pointerEvents: 'none',
        }} />
        <div className="ornament-tile ornament-fade ornament-hero" aria-hidden="true" />
        <div className="container" style={{ position: 'relative' }}>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--color-text)', lineHeight: 1.12 }}>
            География проектов «Байтерека»
          </h1>
          <p style={{ fontSize: 16, color: 'var(--color-text-2)', maxWidth: 640, lineHeight: 1.55, marginTop: 14, marginBottom: 0 }}>
            Каждый круг на карте — проект, поддержанный организациями группы «Байтерек» и партнёрами: от тепличных
            комплексов в Туркестанской области до IT-кампусов Астаны. Выбирайте организацию, регион или
            отрасль — карта и цифры пересчитаются мгновенно.
          </p>

          {/* Stats — тёмно-зелёная committed-поверхность (как скринер на главной):
              белые цифры и приглушённо-светлые подписи читаются на зелёном. */}
          <div className="screener-panel" style={{ marginTop: 30, maxWidth: 760, padding: 'clamp(18px, 2.4vw, 26px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 12 }}>
              {heroTiles.map((s, i) => (
                <div key={i} style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
                }}>
                  <div style={{ fontSize: 25, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1 }}>{isLoading ? '…' : s.v}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 3, lineHeight: 1.35 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER TOOLBAR ──────────────────────────────────────────────── */}
      <div className="container" style={{ marginTop: 28 }}>
        {/* Чипы организаций — они же легенда карты (цвет точки = цвет маркера) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            aria-pressed={org === ''}
            onClick={() => setOrg('')}
            style={chipStyle(org === '', 'var(--color-primary)')}
          >
            Все организации
          </button>
          {orgs.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={org === o}
              onClick={() => setOrg(org === o ? '' : o)}
              style={chipStyle(org === o, orgColor(o))}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: orgColor(o), flexShrink: 0 }} />
              {o}
            </button>
          ))}
        </div>

        {/* Точечные фильтры + счётчик */}
        <div className="card" style={{ padding: '12px 16px', marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <I.Filter size={16} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
          <select className="select" value={region} onChange={(e) => setRegion(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Все регионы</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Все отрасли</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">Все статусы</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">Все периоды</option>
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              <I.X size={14} /> Сбросить
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-3)' }}>
            Показано {filtered.length} из {projects.length}
          </div>
        </div>
      </div>

      {/* ── MAP + SIDEBAR ───────────────────────────────────────────────── */}
      <div className="container" style={{ marginTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '2fr 1fr', gap: 20, alignItems: 'start' }}>
          <div>
            <div ref={mapWrapRef} className="card" style={{ overflow: 'hidden', height: isNarrow ? 380 : 560, minHeight: isNarrow ? 380 : 560, width: '100%' }}>
              <MapContainer ref={mapRef} center={NATIONAL_VIEW} zoom={5} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filtered.map((p) => (
                  <CircleMarker
                    key={p.id}
                    ref={(m) => { if (m) markerRefs.current.set(p.id, m); else markerRefs.current.delete(p.id) }}
                    center={p.coords}
                    radius={radiusFor(p.amount || 0)}
                    pathOptions={{
                      color: orgColor(p.org),
                      fillColor: orgColor(p.org),
                      fillOpacity: 0.6,
                      weight: 1.5,
                    }}
                  >
                    <Popup minWidth={260} maxWidth={300}>
                      <ProjectPopupCard project={p} />
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            {/* Как читать карту */}
            <div style={{ marginTop: 10, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--color-text-3)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', opacity: 0.45 }} />
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-primary)', opacity: 0.75 }} />
                Размер круга — сумма финансирования
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ORG_COLORS['Даму'] }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ORG_COLORS['Astana Hub'] }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ORG_COLORS['ЭКА KazakhExport'] }} />
                </span>
                Цвет — организация группы
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-text-3)' }} />
                Клик по кругу — карточка проекта
              </span>
            </div>
          </div>

          {/* Sidebar: region distribution + итого */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Распределение по регионам</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 16 }}>
              Топ регионов по сумме финансирования (с учётом фильтров)
            </div>
            {regionDistribution.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-3)', padding: '20px 0', textAlign: 'center' }}>
                {isLoading ? 'Загрузка…' : 'Нет проектов по заданным фильтрам'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {regionDistribution.map((r) => {
                  const active = region === r.region
                  return (
                    <button
                      key={r.region}
                      type="button"
                      onClick={() => focusRegion(r.region)}
                      style={{
                        display: 'block', width: 'calc(100% + 20px)', textAlign: 'left', background: active ? 'var(--color-primary-tint)' : 'transparent',
                        border: 'none', padding: '8px 10px', margin: '-2px -10px', borderRadius: 8, cursor: 'pointer',
                        transition: 'background 140ms var(--ease-out)',
                      }}
                      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
                      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, color: 'var(--color-text)', minWidth: 0, wordBreak: 'break-word' }}>{r.region}</span>
                        <span style={{ color: 'var(--color-text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{r.count} · {formatAmount(r.amount)} млн ₸</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.max(4, (r.amount / maxRegionAmount) * 100)}%`,
                          background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-600))',
                          borderRadius: 999,
                        }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="h-divider" style={{ margin: '18px 0' }} />

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Итого по выбору</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Проектов</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{filtered.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Объём финансирования</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatBig(filteredTotalAmount)}</span>
              </div>
            </div>
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ marginTop: 12 }}>
                <I.X size={14} /> Сбросить фильтры
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ФЛАГМАНЫ ПОРТФЕЛЯ ───────────────────────────────────────────── */}
      {(isLoading || topProjects.length > 0) && (
        <section className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="section-eyebrow" style={{ marginBottom: 6 }}>Флагманы портфеля</div>
              <h2 className="section-title">Крупнейшие проекты</h2>
            </div>
            {topProjects.length > 2 && (
              <span style={{ fontSize: 13, color: 'var(--color-text-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                листайте <I.ArrowRight size={15} />
              </span>
            )}
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ minWidth: 300, height: 180 }} />
              ))}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, alignItems: 'stretch',
                  scrollSnapType: 'x mandatory',
                  // затухание справа — намёк, что лента продолжается за краем
                  WebkitMaskImage: topProjects.length > 2 ? 'linear-gradient(90deg, #000 0%, #000 90%, transparent 100%)' : undefined,
                  maskImage: topProjects.length > 2 ? 'linear-gradient(90deg, #000 0%, #000 90%, transparent 100%)' : undefined,
                }}
              >
                {topProjects.map((p) => (
                  <FlagshipCard key={p.id} project={p} onClick={() => focusProject(p)} />
                ))}
                {/* спейсер, чтобы последняя карточка не «съедалась» маской в конце скролла */}
                <div aria-hidden style={{ flex: '0 0 1px' }} />
              </div>
            </div>
          )}
        </section>
      )}

      {!isLoading && topProjects.length === 0 && <div style={{ paddingBottom: 80 }} />}
    </div>
  )
}

// Чип-фильтр организации: активный — в цвете организации, неактивный — нейтральный.
function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    borderRadius: 999, padding: '7px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8,
    border: `1px solid ${active ? color : 'var(--color-border)'}`,
    background: active ? `${color}14` : 'var(--color-surface)',
    color: active ? 'var(--color-text)' : 'var(--color-text-2)',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer', transition: 'border-color 140ms var(--ease-out), background 140ms var(--ease-out)',
  }
}

function FlagshipCard({ project: p, onClick }: { project: Project; onClick: () => void }) {
  const accent = orgColor(p.org)
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        width: 300, minWidth: 300, padding: 20, scrollSnapAlign: 'start', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 160ms var(--ease-out), border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
      }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accent; el.style.boxShadow = 'var(--sh-md)'; el.style.transform = 'translateY(-3px)' }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border)'; el.style.boxShadow = 'var(--sh-xs)'; el.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {p.org && <span className="badge" style={{ background: `${accent}1A`, color: accent }}>{p.org}</span>}
        {p.status && <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 600, lineHeight: 1.35, marginTop: 10, color: 'var(--color-text)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      } as React.CSSProperties}>
        {p.name}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginTop: 6 }}>
        {p.region}{p.city ? `, ${p.city}` : ''} · {p.industry}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-primary)' }}>{formatAmount(p.amount || 0)} млн ₸</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{p.period}</span>
      </div>
    </div>
  )
}

function ProjectPopupCard({ project: p }: { project: Project }) {
  return (
    <div style={{ fontFamily: 'var(--ff)', minWidth: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {p.org && <span className="badge" style={{ background: `${orgColor(p.org)}1A`, color: orgColor(p.org) }}>{p.org}</span>}
        {p.status && <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 6, color: 'var(--color-text)' }}>{p.name}</div>
      {p.description && <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8, lineHeight: 1.45 }}>{p.description}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 4, alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Регион</span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text)' }}>{p.region}{p.city ? `, ${p.city}` : ''}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Отрасль</span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text)' }}>{p.industry}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Период</span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text)' }}>{p.period}</span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', marginTop: 8 }}>
        {formatAmount(p.amount || 0)} млн ₸
      </div>
    </div>
  )
}
