import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { I } from '@/components/icons'
import { useIsNarrow } from '@/hooks/useMediaQuery'

// ─── Types & mock data ──────────────────────────────────────────────────────

type OrgName = 'Демеу' | 'KazExport' | 'АгроКапитал' | 'Astana Capital' | 'ИнноФонд' | 'KazGuarantee'
type Status = 'Реализуется' | 'Завершён' | 'Инвестфаза'
type Industry = 'АПК' | 'Обрабатывающая промышленность' | 'Транспорт и логистика' | 'Энергетика' | 'ИТ и связь' | 'Строительство' | 'Туризм'

interface Project {
  id: number
  name: string
  org: OrgName
  region: string
  city: string
  coords: [number, number]
  industry: Industry
  amount: number // млн тенге
  period: string
  status: Status
  description: string
}

const ORG_COLORS: Record<OrgName, string> = {
  'Демеу': '#07663D',
  'KazExport': '#C9A21C',
  'АгроКапитал': '#0A7A47',
  'Astana Capital': '#8A6A14',
  'ИнноФонд': '#0F766E',
  'KazGuarantee': '#B45309',
}

const ORGS: OrgName[] = ['Демеу', 'KazExport', 'АгроКапитал', 'Astana Capital', 'ИнноФонд', 'KazGuarantee']
const INDUSTRIES: Industry[] = ['АПК', 'Обрабатывающая промышленность', 'Транспорт и логистика', 'Энергетика', 'ИТ и связь', 'Строительство', 'Туризм']
const STATUSES: Status[] = ['Реализуется', 'Завершён', 'Инвестфаза']

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

const RAW_PROJECTS: Array<Omit<Project, 'coords'> & { region: string }> = [
  { id: 1,  name: 'Модернизация молочной фермы на 1200 голов',       org: 'АгроКапитал',   region: 'Акмолинская',    city: 'Кокшетау',    industry: 'АПК',                          amount: 2100, period: '2024–2026', status: 'Реализуется', description: 'Строительство современного молочного комплекса с роботизированным доением.' },
  { id: 2,  name: 'Приобретение 40 полувагонов',                     org: 'Демеу',         region: 'Карагандинская', city: 'Караганда',   industry: 'Транспорт и логистика',        amount: 3200, period: '2025–2027', status: 'Инвестфаза',  description: 'Обновление парка подвижного состава для перевозки угля и металлопродукции.' },
  { id: 3,  name: 'Тепличный комплекс 12 га',                        org: 'АгроКапитал',   region: 'Туркестанская',  city: 'Туркестан',   industry: 'АПК',                          amount: 5400, period: '2023–2026', status: 'Реализуется', description: 'Круглогодичное выращивание овощей закрытого грунта с системой досветки.' },
  { id: 4,  name: 'Цех переработки полимеров',                       org: 'ИнноФонд',      region: 'Атырауская',     city: 'Атырау',      industry: 'Обрабатывающая промышленность', amount: 1850, period: '2024–2025', status: 'Завершён',    description: 'Выпуск полимерной упаковки и труб для нужд нефтегазового сектора.' },
  { id: 5,  name: 'Экспорт муки в страны Центральной Азии',          org: 'KazExport',     region: 'Костанайская',   city: 'Костанай',    industry: 'АПК',                          amount: 780,  period: '2025',      status: 'Реализуется', description: 'Финансирование оборотного капитала мукомольного комбината-экспортёра.' },
  { id: 6,  name: 'Ветропарк мощностью 100 МВт',                     org: 'Astana Capital',region: 'Жамбылская',     city: 'Тараз',       industry: 'Энергетика',                   amount: 8500, period: '2024–2028', status: 'Инвестфаза',  description: 'Строительство ветроэлектростанции с последующей продажей на рынок КОРЭМ.' },
  { id: 7,  name: 'Гарантия по кредиту на цех металлоконструкций',   org: 'KazGuarantee',  region: 'ВКО',            city: 'Усть-Каменогорск', industry: 'Обрабатывающая промышленность', amount: 640, period: '2024–2025', status: 'Реализуется', description: 'Обеспечение доступа к банковскому финансированию для производства ЛСТК.' },
  { id: 8,  name: 'IT-парк для аутсорс-разработки',                 org: 'ИнноФонд',      region: 'Астана',         city: 'Астана',      industry: 'ИТ и связь',                   amount: 2300, period: '2025–2027', status: 'Инвестфаза',  description: 'Создание коворкинг-пространства и хаба для продуктовых IT-команд.' },
  { id: 9,  name: 'Развитие эко-турбазы на Бурабае',                org: 'Astana Capital',region: 'Акмолинская',    city: 'Бурабай',     industry: 'Туризм',                       amount: 460,  period: '2024–2026', status: 'Реализуется', description: 'Строительство глэмпинга и туристических маршрутов вокруг курортной зоны.' },
  { id: 10, name: 'Приобретение зерноуборочных комбайнов',           org: 'АгроКапитал',   region: 'СКО',            city: 'Петропавловск', industry: 'АПК',                        amount: 1340, period: '2025',      status: 'Реализуется', description: 'Лизинг 25 единиц комбайнов для парка сельхозкооператива.' },
  { id: 11, name: 'Завод по производству рыбных консервов',          org: 'ИнноФонд',      region: 'Кызылординская', city: 'Кызылорда',   industry: 'Обрабатывающая промышленность', amount: 990, period: '2023–2025', status: 'Завершён',    description: 'Переработка аральского сазана и судака в консервную продукцию.' },
  { id: 12, name: 'Логистический хаб на границе с КНР',              org: 'Демеу',         region: 'Алматинская',    city: 'Жаркент',     industry: 'Транспорт и логистика',        amount: 6200, period: '2024–2027', status: 'Инвестфаза',  description: 'Терминал перевалки контейнерных грузов на маршруте Западная Европа — Западный Китай.' },
  { id: 13, name: 'Экспорт хлопкового волокна в Турцию',             org: 'KazExport',     region: 'Туркестанская',  city: 'Шымкент',     industry: 'АПК',                          amount: 520,  period: '2025',      status: 'Реализуется', description: 'Кредитование текстильного кластера для наращивания экспортных поставок.' },
  { id: 14, name: 'Солнечная электростанция 60 МВт',                org: 'Astana Capital',region: 'Кызылординская', city: 'Кызылорда',   industry: 'Энергетика',                   amount: 4700, period: '2024–2026', status: 'Реализуется', description: 'Строительство фотоэлектрической станции с подключением к региональным сетям.' },
  { id: 15, name: 'Гарантия по кредиту на швейное производство',      org: 'KazGuarantee',  region: 'Жамбылская',     city: 'Тараз',       industry: 'Обрабатывающая промышленность', amount: 210, period: '2024–2025', status: 'Завершён',    description: 'Расширение фабрики по пошиву спецодежды и школьной формы.' },
  { id: 16, name: 'Приобретение 15 полувагонов-цистерн',             org: 'Демеу',         region: 'Мангистауская',  city: 'Актау',       industry: 'Транспорт и логистика',        amount: 2650, period: '2025–2026', status: 'Инвестфаза',  description: 'Обновление парка цистерн для перевозки нефтепродуктов.' },
  { id: 17, name: 'Агрегационный центр по хранению овощей',           org: 'АгроКапитал',   region: 'Алматинская',    city: 'Талдыкорган', industry: 'АПК',                          amount: 1580, period: '2024–2025', status: 'Реализуется', description: 'Строительство овощехранилища на 20 000 тонн с регулируемой атмосферой.' },
  { id: 18, name: 'Стартап-акселератор для финтех-компаний',          org: 'ИнноФонд',      region: 'Алматы',         city: 'Алматы',      industry: 'ИТ и связь',                   amount: 350,  period: '2025',      status: 'Реализуется', description: 'Грантовая поддержка ранних финтех-проектов и менторская программа.' },
  { id: 19, name: 'Реконструкция гостиничного комплекса',             org: 'Astana Capital',region: 'Алматы',         city: 'Алматы',      industry: 'Туризм',                       amount: 3100, period: '2024–2026', status: 'Реализуется', description: 'Модернизация номерного фонда и конференц-зон отеля 4*.' },
  { id: 20, name: 'Экспорт подсолнечного масла в страны Персидского залива', org: 'KazExport', region: 'Костанайская', city: 'Костанай',   industry: 'АПК',                          amount: 1120, period: '2025',      status: 'Реализуется', description: 'Финансирование поставок бутилированного масла на новые рынки сбыта.' },
  { id: 21, name: 'Цех по производству стройматериалов из ЗШО',       org: 'ИнноФонд',      region: 'Павлодарская',   city: 'Павлодар',    industry: 'Строительство',                amount: 890,  period: '2024–2025', status: 'Завершён',    description: 'Переработка золошлаковых отходов ТЭЦ в товарный строительный материал.' },
  { id: 22, name: 'Гарантия по кредиту на цех упаковки',              org: 'KazGuarantee',  region: 'Улытау',         city: 'Жезказган',   industry: 'Обрабатывающая промышленность', amount: 175, period: '2025',      status: 'Инвестфаза',  description: 'Организация производства гофротары для медной промышленности региона.' },
  { id: 23, name: 'Приобретение 60 контейнеровозов',                  org: 'Демеу',         region: 'ЗКО',            city: 'Уральск',     industry: 'Транспорт и логистика',        amount: 4100, period: '2025–2027', status: 'Инвестфаза',  description: 'Расширение парка автотехники для контейнерных перевозок.' },
  { id: 24, name: 'Тепличный комплекс для выращивания клубники',      org: 'АгроКапитал',   region: 'Жетісу',         city: 'Талдыкорган', industry: 'АПК',                          amount: 970,  period: '2024–2026', status: 'Реализуется', description: 'Круглогодичное производство ягод с использованием капельного орошения.' },
  { id: 25, name: 'Реставрация историко-туристского маршрута',        org: 'Astana Capital',region: 'Туркестанская',  city: 'Туркестан',   industry: 'Туризм',                       amount: 610,  period: '2024–2025', status: 'Завершён',    description: 'Развитие инфраструктуры вокруг мавзолея Ходжи Ахмеда Ясави.' },
  { id: 26, name: 'Ветеринарная лаборатория и убойный цех',           org: 'АгроКапитал',   region: 'Абай',           city: 'Семей',       industry: 'АПК',                          amount: 730,  period: '2025',      status: 'Реализуется', description: 'Строительство сертифицированного убойного цеха для экспорта мяса.' },
  { id: 27, name: 'Дата-центр уровня Tier III',                       org: 'ИнноФонд',      region: 'Астана',         city: 'Астана',      industry: 'ИТ и связь',                   amount: 3900, period: '2024–2027', status: 'Инвестфаза',  description: 'Строительство коммерческого ЦОД для размещения гос. и корпоративных систем.' },
  { id: 28, name: 'Гарантия по кредиту на автосервисную сеть',         org: 'KazGuarantee',  region: 'Шымкент',        city: 'Шымкент',     industry: 'Строительство',                amount: 145,  period: '2025',      status: 'Реализуется', description: 'Развитие сети сервисных центров для коммерческого автотранспорта.' },
]

const PROJECTS: Project[] = RAW_PROJECTS.map((p) => ({
  ...p,
  coords: jitter(REGION_COORDS[p.region] ?? [48.0, 67.0], p.id),
}))

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

  // На узких экранах карта/сайдбар переключаются с 2-колоночной сетки в 1-колоночную —
  // после смены раскладки контейнер карты меняет размеры, и Leaflet должен пересчитать
  // сетку тайлов, иначе останутся серые/обрезанные тайлы.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const raf = requestAnimationFrame(() => map.invalidateSize())
    return () => cancelAnimationFrame(raf)
  }, [isNarrow])

  const regions = useMemo(() => Array.from(new Set(PROJECTS.map((p) => p.region))).sort(), [])

  const filtered = useMemo(() => {
    return PROJECTS.filter((p) =>
      (!org || p.org === org) &&
      (!region || p.region === region) &&
      (!industry || p.industry === industry) &&
      (!status || p.status === status)
    )
  }, [org, region, industry, status])

  const stats = useMemo(() => {
    const totalAmount = filtered.reduce((s, p) => s + p.amount, 0)
    const regionsCovered = new Set(filtered.map((p) => p.region)).size
    const orgsCovered = new Set(filtered.map((p) => p.org)).size
    return { count: filtered.length, totalAmount, regionsCovered, orgsCovered }
  }, [filtered])

  const regionDistribution = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>()
    filtered.forEach((p) => {
      const cur = map.get(p.region) ?? { count: 0, amount: 0 }
      cur.count += 1
      cur.amount += p.amount
      map.set(p.region, cur)
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
        <StatTile icon="Grid" label="Всего проектов" value={stats.count.toString()} />
        <StatTile icon="Coins" label="Общая сумма финансирования" value={`${formatAmount(stats.totalAmount)} млн ₸`} />
        <StatTile icon="MapPin" label="Регионов охвачено" value={stats.regionsCovered.toString()} />
        <StatTile icon="Building" label="Организаций" value={stats.orgsCovered.toString()} />
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <I.Filter size={16} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
        <select className="select" value={org} onChange={(e) => setOrg(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Все организации</option>
          {ORGS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="select" value={region} onChange={(e) => setRegion(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Все регионы</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Все отрасли</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Все статусы</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setOrg(''); setRegion(''); setIndustry(''); setStatus('') }}>
            <I.X size={14} /> Сбросить
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-3)' }}>
          Показано {filtered.length} из {PROJECTS.length}
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
                radius={radiusFor(p.amount)}
                pathOptions={{
                  color: ORG_COLORS[p.org],
                  fillColor: ORG_COLORS[p.org],
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
              Нет проектов по заданным фильтрам
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
            {ORGS.map((o) => (
              <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text-2)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: ORG_COLORS[o], flexShrink: 0 }} />
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

const STATUS_BADGE: Record<Status, string> = {
  'Реализуется': 'badge-green',
  'Завершён': 'badge-blue',
  'Инвестфаза': 'badge-amber',
}

function ProjectPopupCard({ project: p }: { project: Project }) {
  return (
    <div style={{ fontFamily: 'var(--ff)', minWidth: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className="badge" style={{ background: `${ORG_COLORS[p.org]}1A`, color: ORG_COLORS[p.org] }}>{p.org}</span>
        <span className={`badge ${STATUS_BADGE[p.status]}`}>{p.status}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 6, color: 'var(--color-text)' }}>{p.name}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8 }}>{p.description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--color-text-2)', marginBottom: 10 }}>
        <div><strong>Регион:</strong> {p.region}, {p.city}</div>
        <div><strong>Отрасль:</strong> {p.industry}</div>
        <div><strong>Сумма:</strong> {formatAmount(p.amount)} млн ₸</div>
        <div><strong>Период:</strong> {p.period}</div>
      </div>
      <a href="#" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
        Подробнее
      </a>
    </div>
  )
}
