import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
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

const MIN_AMOUNT = 45
const MAX_AMOUNT = 8500

function radiusFor(amount: number) {
  const t = Math.max(0, Math.min(1, (amount - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)))
  return 6 + t * (18 - 6)
}

function formatAmount(v: number) {
  return v.toLocaleString('ru-RU')
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function ProjectsMapPage() {
  const [org, setOrg] = useState('')
  const [region, setRegion] = useState('')
  const [industry, setIndustry] = useState('')
  const [status, setStatus] = useState('')

  const isNarrow = useIsNarrow()
  const mapRef = useRef<LeafletMap | null>(null)

  const { data: raw = [], isLoading } = useQuery<MapProjectItem[]>({
    queryKey: ['map-projects'],
    queryFn: () => contentApi.mapProjects().then((r) => r.data ?? []),
  })

  // Проекты с координатами: явные lat/lng либо центр региона с детерминированным
  // разбросом по sort_order (сохраняет прежнее поведение при пустых lat/lng).
  const projects = useMemo<Project[]>(
    () => raw.map((p) => {
      const base: [number, number] = (p.region ? REGION_COORDS[p.region] : undefined) ?? [48.0, 67.0]
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

  const filtered = useMemo(() => {
    return projects.filter((p) =>
      (!org || p.org === org) &&
      (!region || p.region === region) &&
      (!industry || p.industry === industry) &&
      (!status || p.status === status)
    )
  }, [projects, org, region, industry, status])

  const stats = useMemo(() => {
    const totalAmount = filtered.reduce((s, p) => s + (p.amount || 0), 0)
    const regionsCovered = new Set(filtered.map((p) => p.region)).size
    const orgsCovered = new Set(filtered.map((p) => p.org)).size
    return { count: filtered.length, totalAmount, regionsCovered, orgsCovered }
  }, [filtered])

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

  const hasFilters = !!(org || region || industry || status)

  return (
    <div className="page-fade container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="section-eyebrow" style={{ marginBottom: 8 }}>Прозрачность</div>
        <h1 className="section-title" style={{ fontSize: 32 }}>Карта проектов</h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-3)', marginTop: 8, maxWidth: 720 }}>
          Проекты, профинансированные организациями группы Холдинга «Байтерек», на карте Казахстана.
          Фильтруйте по организации, региону, отрасли и статусу реализации.
        </p>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <StatTile icon="Grid" label="Всего проектов" value={isLoading ? '…' : stats.count.toString()} />
        <StatTile icon="Coins" label="Общая сумма финансирования" value={isLoading ? '…' : `${formatAmount(stats.totalAmount)} млн ₸`} />
        <StatTile icon="MapPin" label="Регионов охвачено" value={isLoading ? '…' : stats.regionsCovered.toString()} />
        <StatTile icon="Building" label="Организаций" value={isLoading ? '…' : stats.orgsCovered.toString()} />
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <I.Filter size={16} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
        <select className="select" value={org} onChange={(e) => setOrg(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Все организации</option>
          {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
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
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setOrg(''); setRegion(''); setIndustry(''); setStatus('') }}>
            <I.X size={14} /> Сбросить
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-3)' }}>
          Показано {filtered.length} из {projects.length}
        </div>
      </div>

      {/* Map + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ overflow: 'hidden', height: isNarrow ? 380 : 560, minHeight: isNarrow ? 380 : 560, width: '100%' }}>
          <MapContainer ref={mapRef} center={[48.0, 67.0]} zoom={5} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map((p) => (
              <CircleMarker
                key={p.id}
                center={p.coords}
                radius={radiusFor(p.amount || 0)}
                pathOptions={{
                  color: orgColor(p.org),
                  fillColor: orgColor(p.org),
                  fillOpacity: 0.55,
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

        {/* Sidebar: region distribution */}
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
              {regionDistribution.map((r) => (
                <div key={r.region}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{r.region}</span>
                    <span style={{ color: 'var(--color-text-3)' }}>{r.count} · {formatAmount(r.amount)} млн ₸</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(4, (r.amount / maxRegionAmount) * 100)}%`,
                      background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-600))',
                      borderRadius: 999,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="h-divider" style={{ margin: '18px 0' }} />

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Легенда организаций</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orgs.map((o) => (
              <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text-2)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: orgColor(o), flexShrink: 0 }} />
                {o}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatTile({ icon, label, value }: { icon: keyof typeof I; label: string; value: string }) {
  const Icon = I[icon]
  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-tint)',
        color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={19} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{label}</div>
      </div>
    </div>
  )
}

const STATUS_BADGE: Record<string, string> = {
  'Реализуется': 'badge-green',
  'Завершён': 'badge-blue',
  'Инвестфаза': 'badge-amber',
}
const statusBadge = (s?: string) => (s && STATUS_BADGE[s]) || 'badge-gray'

function ProjectPopupCard({ project: p }: { project: Project }) {
  return (
    <div style={{ fontFamily: 'var(--ff)', minWidth: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {p.org && <span className="badge" style={{ background: `${orgColor(p.org)}1A`, color: orgColor(p.org) }}>{p.org}</span>}
        {p.status && <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 6, color: 'var(--color-text)' }}>{p.name}</div>
      {p.description && <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8 }}>{p.description}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--color-text-2)', marginBottom: 10 }}>
        <div><strong>Регион:</strong> {p.region}{p.city ? `, ${p.city}` : ''}</div>
        <div><strong>Отрасль:</strong> {p.industry}</div>
        <div><strong>Сумма:</strong> {formatAmount(p.amount || 0)} млн ₸</div>
        <div><strong>Период:</strong> {p.period}</div>
      </div>
      <a href="#" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
        Подробнее
      </a>
    </div>
  )
}
