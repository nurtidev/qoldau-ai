import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi } from '@/api/client'
import { I } from '@/components/icons'
import { useIsNarrow } from '@/hooks/useMediaQuery'
import type { Service } from '@/types'

// ---- Static filter data (matches design) ----

const ORGS = [
  { id: 'Демеу',         short: 'Демеу',        color: 'var(--color-primary)', tag: 'D'  },
  { id: 'KazExport',     short: 'KazExport',    color: '#C9A21C', tag: 'KE' },
  { id: 'АгроКапитал',  short: 'АгроКапитал',  color: '#0A7A47', tag: 'AK' },
  { id: 'Astana Cap.',   short: 'Astana Cap.',  color: '#8A6A14', tag: 'AC' },
  { id: 'ИнноФонд',     short: 'ИнноФонд',     color: '#0F766E', tag: 'IF' },
  { id: 'KazGuarantee',  short: 'KazGuarantee', color: '#B45309', tag: 'KG' },
]

const DIRECTION_LABELS = [
  'Финансирование', 'Гарантии', 'Экспорт', 'Инвестиции',
  'Агросектор', 'Гранты', 'Лизинг', 'Субсидии',
]

const STAGE_OPTIONS = [
  { id: 'idea',   label: 'Идея / стартап'    },
  { id: 'early',  label: 'Начинающий бизнес' },
  { id: 'active', label: 'Действующий бизнес'},
  { id: 'mature', label: 'Зрелый бизнес'     },
]

const REGION_OPTIONS = [
  { id: 'astana',  label: 'г. Астана'           },
  { id: 'almaty',  label: 'г. Алматы'           },
  { id: 'shymk',   label: 'г. Шымкент'          },
  { id: 'akmola',  label: 'Акмолинская область' },
  { id: 'almreg',  label: 'Алматинская область' },
]

// ---- OrgBadge ----

function orgColor(name: string): string {
  const found = ORGS.find((o) => name?.includes(o.short) || name?.includes(o.id))
  if (found) return found.color
  const colors = ['var(--color-primary)', '#C9A21C', '#0A7A47', '#8A6A14', '#0F766E', '#B45309']
  let h = 0
  for (let i = 0; i < (name?.length ?? 0); i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff
  return colors[h % colors.length]
}

function orgInitials(name: string): string {
  const found = ORGS.find((o) => name?.includes(o.short) || name?.includes(o.id))
  if (found) return found.tag
  return (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function OrgBadge({ name }: { name: string }) {
  const color = orgColor(name)
  const tag = orgInitials(name)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: color, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.02em', flexShrink: 0,
      }}>{tag}</div>
      <span style={{ fontSize: 13, color: 'var(--color-text-2)', fontWeight: 500 }}>{name}</span>
    </div>
  )
}

// ---- FilterGroup ----

interface FilterOption { id: string; label: string; count?: number }

function FilterGroup({
  title, options, selected, onToggle, defaultOpen = true,
}: {
  title: string
  options: FilterOption[]
  selected: string[]
  onToggle: (id: string) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', padding: '16px 0' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
      }}>
        {title}
        <I.ChevronDown size={16} style={{
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 160ms', color: 'var(--color-text-3)',
        }} />
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
          {options.map((o) => {
            const active = selected.includes(o.id)
            return (
              <label key={o.id} onClick={() => onToggle(o.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '6px 8px', borderRadius: 6,
                background: active ? 'var(--color-accent-soft)' : 'transparent',
                transition: 'background 120ms',
              }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
                  background: active ? 'var(--color-accent)' : '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && <I.Check size={11} style={{ color: '#fff' }} strokeWidth={3} />}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-2)', flex: 1 }}>{o.label}</span>
                {o.count !== undefined && (
                  <span style={{ fontSize: 12, color: 'var(--color-text-4)' }}>{o.count}</span>
                )}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- ServiceCard ----

function ServiceCard({ service }: { service: Service }) {
  const [bookmarked, setBookmarked] = useState(false)

  return (
    <Link to={`/services/${service.id}`}
      className="card"
      style={{
        padding: 22, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 14,
        transition: 'border-color 140ms, box-shadow 140ms',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--color-accent)'
        el.style.boxShadow = 'var(--sh-md)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--color-border)'
        el.style.boxShadow = 'var(--sh-xs)'
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {service.org_name
          ? <OrgBadge name={service.org_name} />
          : <span className="badge badge-blue">{service.category ?? 'Общее'}</span>
        }
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBookmarked(!bookmarked) }}
          style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: bookmarked ? 'var(--color-accent)' : 'var(--color-text-4)',
            borderRadius: 4, transition: 'color 120ms',
          }}
        >
          <I.Star size={18} />
        </button>
      </div>

      {/* Title + description */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35, marginBottom: 6, color: 'var(--color-text)' }}>
          {service.title}
        </div>
        {service.description && (
          <div style={{
            fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.55,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {service.description}
          </div>
        )}
      </div>

      {/* Tags */}
      {service.category && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="badge badge-gray">{service.category}</span>
          <span className="badge badge-blue">МСБ</span>
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid var(--color-border)', paddingTop: 14, marginTop: 'auto',
      }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
          {new Date(service.created_at).toLocaleDateString('ru-KZ', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <span className="btn btn-accent btn-sm" style={{ pointerEvents: 'none' }}>
          Подать заявку <I.ArrowRight size={14} />
        </span>
      </div>
    </Link>
  )
}

// ---- ServiceCard list-view variant ----

function ServiceRow({ service }: { service: Service }) {
  return (
    <Link to={`/services/${service.id}`}
      className="card"
      style={{
        padding: '16px 20px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 20,
        transition: 'border-color 140ms, box-shadow 140ms',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--color-accent)'
        el.style.boxShadow = 'var(--sh-md)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--color-border)'
        el.style.boxShadow = 'var(--sh-xs)'
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{service.title}</span>
          {service.category && <span className="badge badge-gray">{service.category}</span>}
        </div>
        {service.description && (
          <div style={{ fontSize: 13, color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {service.description}
          </div>
        )}
      </div>
      {service.org_name && (
        <div style={{ flexShrink: 0 }}>
          <OrgBadge name={service.org_name} />
        </div>
      )}
      <span style={{ fontSize: 13, color: 'var(--color-accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        Подробнее <I.ChevronRight size={14} />
      </span>
    </Link>
  )
}

// ---- Main page ----

type ChipKind = 'org' | 'dir' | 'stage' | 'region'
interface Chip { kind: ChipKind; id: string; label: string }

const ITEMS_PER_PAGE = 10

export function ServicesPage() {
  const [searchParams] = useSearchParams()
  const isNarrow = useIsNarrow()

  const [search, setSearch]           = useState(searchParams.get('q') ?? '')
  const [page, setPage]               = useState(1)
  const [orgFilter, setOrgFilter]     = useState<string[]>(
    searchParams.get('org_name') ? [searchParams.get('org_name')!] : []
  )
  const [dirFilter, setDirFilter]     = useState<string[]>(
    searchParams.get('category') ? [searchParams.get('category')!] : []
  )
  const [stageFilter, setStageFilter] = useState<string[]>([])
  const [regionFilter, setRegionFilter] = useState<string[]>([])
  const [sort, setSort]               = useState<'popular' | 'new'>('popular')
  const [view, setView]               = useState<'grid' | 'list'>('grid')

  // All services (unfiltered) — for computing category counts
  const { data: allServices = [] } = useQuery<Service[]>({
    queryKey: ['services-all'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  })

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {}
    allServices.forEach(s => { if (s.category) m[s.category] = (m[s.category] || 0) + 1 })
    return m
  }, [allServices])

  const DIRECTIONS = useMemo(
    () => DIRECTION_LABELS.map(label => ({ id: label, label, count: categoryCounts[label] ?? 0 })),
    [categoryCounts]
  )

  // Backend supports filtering by category + org_name (one value each)
  // We send the first active filter; UI shows multi-select for future extension
  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ['services', dirFilter[0], orgFilter[0]],
    queryFn: () => servicesApi.list({
      category: dirFilter[0],
      org_name: orgFilter[0],
    }).then((r) => r.data),
  })

  const filtered = services.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.title.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return 0
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paged = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) => {
    setter((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
    setPage(1)
  }

  const orgOptions = ORGS.map((o) => ({ id: o.id, label: o.short }))
  const dirOptions = DIRECTIONS

  const chips: Chip[] = [
    ...orgFilter.map((id) => ({ kind: 'org' as ChipKind, id, label: ORGS.find((o) => o.id === id)?.short ?? id })),
    ...dirFilter.map((id) => ({ kind: 'dir' as ChipKind, id, label: DIRECTIONS.find((d) => d.id === id)?.label ?? id })),
    ...stageFilter.map((id) => ({ kind: 'stage' as ChipKind, id, label: STAGE_OPTIONS.find((o) => o.id === id)?.label ?? id })),
    ...regionFilter.map((id) => ({ kind: 'region' as ChipKind, id, label: REGION_OPTIONS.find((o) => o.id === id)?.label ?? id })),
  ]

  const removeChip = (c: Chip) => {
    if (c.kind === 'org')    setOrgFilter((arr) => arr.filter((x) => x !== c.id))
    if (c.kind === 'dir')    setDirFilter((arr) => arr.filter((x) => x !== c.id))
    if (c.kind === 'stage')  setStageFilter((arr) => arr.filter((x) => x !== c.id))
    if (c.kind === 'region') setRegionFilter((arr) => arr.filter((x) => x !== c.id))
  }

  const resetAll = () => {
    setOrgFilter([]); setDirFilter([]); setStageFilter([]); setRegionFilter([]); setSearch(''); setPage(1)
  }

  const filterGroups = (
    <>
      <FilterGroup
        title="Организация"
        options={orgOptions}
        selected={orgFilter}
        onToggle={toggle(setOrgFilter)}
      />
      <FilterGroup
        title="Направление"
        options={dirOptions}
        selected={dirFilter}
        onToggle={toggle(setDirFilter)}
      />
      <FilterGroup
        title="Этап бизнеса"
        options={STAGE_OPTIONS}
        selected={stageFilter}
        onToggle={toggle(setStageFilter)}
        defaultOpen={false}
      />
      <FilterGroup
        title="Регион"
        options={REGION_OPTIONS}
        selected={regionFilter}
        onToggle={toggle(setRegionFilter)}
        defaultOpen={false}
      />
    </>
  )

  return (
    <div className="page-fade container" style={{ paddingTop: 32, paddingBottom: 56 }}>

      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 12 }}>
        <Link to="/" style={{ color: 'var(--color-text-3)' }}>Главная</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--color-text-2)' }}>Услуги</span>
      </nav>

      {/* Title + search */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--color-text)' }}>
            Каталог услуг
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6, marginBottom: 0 }}>
            {isLoading
              ? 'Загружаем меры поддержки…'
              : <>Найдено <strong style={{ color: 'var(--color-text-2)' }}>{sorted.length}</strong> мер поддержки</>
            }
          </p>
        </div>
        <div style={{ position: 'relative', width: 380 }}>
          <I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            placeholder="Поиск по названию или описанию"
            style={{ paddingLeft: 38, height: 40 }}
          />
        </div>
      </div>

      <div className="two-col-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '264px 1fr', gap: 32 }}>

        {/* Sidebar */}
        <aside>
          {isNarrow ? (
            <details className="card" style={{ padding: '4px 20px', marginBottom: 4 }}>
              <summary style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 0', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <I.Sliders size={16} /> Фильтры{chips.length > 0 ? ` · ${chips.length}` : ''}
                </span>
              </summary>
              <div style={{ paddingBottom: 8 }}>
                {chips.length > 0 && (
                  <button onClick={resetAll} className="btn btn-ghost btn-sm" style={{ marginBottom: 4, padding: '0 8px', fontSize: 12, color: 'var(--color-accent-text)' }}>
                    Сбросить
                  </button>
                )}
                {filterGroups}
              </div>
            </details>
          ) : (
            <div className="card" style={{ padding: '4px 20px', position: 'sticky', top: 80 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                  <I.Sliders size={16} /> Фильтры
                </div>
                {chips.length > 0 && (
                  <button onClick={resetAll} className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 12, color: 'var(--color-accent-text)' }}>
                    Сбросить
                  </button>
                )}
              </div>
              {filterGroups}
            </div>
          )}
        </aside>

        {/* Results */}
        <main>
          {/* Toolbar: chips + sort + view */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {chips.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Без фильтров</span>
              ) : chips.map((c, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 4px 4px 10px', borderRadius: 999,
                  background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
                  fontSize: 12, fontWeight: 500,
                }}>
                  {c.label}
                  <button onClick={() => removeChip(c)} style={{
                    width: 18, height: 18, borderRadius: '50%', border: 'none',
                    background: 'rgba(7,102,61,0.1)', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-primary)', padding: 0,
                  }}>
                    <I.X size={11} />
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Сортировка:</span>
                <select
                  className="select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'popular' | 'new')}
                  style={{ height: 36, width: 'auto', paddingRight: 30 }}
                >
                  <option value="popular">По популярности</option>
                  <option value="new">Сначала новые</option>
                </select>
              </div>
              <div style={{ display: 'inline-flex', background: 'var(--color-surface-2)', borderRadius: 6, padding: 2 }}>
                {(['grid', 'list'] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} style={{
                    width: 32, height: 32, border: 'none', borderRadius: 5, cursor: 'pointer',
                    background: view === v ? '#fff' : 'transparent',
                    color: view === v ? 'var(--color-text)' : 'var(--color-text-3)',
                    boxShadow: view === v ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 120ms',
                  }}>
                    {v === 'grid' ? <I.Grid size={15} /> : <I.List size={15} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 220 }} />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--color-surface-2)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, color: 'var(--color-text-3)', margin: '0 auto 16px',
              }}>
                <I.Search size={24} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Ничего не найдено</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-3)', margin: '0 0 20px' }}>
                Попробуйте изменить параметры поиска или сбросить фильтры
              </p>
              <button className="btn btn-primary" onClick={resetAll}>
                Сбросить фильтры
              </button>
            </div>
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {paged.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {paged.map((s) => <ServiceRow key={s.id} service={s} />)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <I.ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={p === currentPage ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  style={{ minWidth: 32, padding: 0 }}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                <I.ChevronRight size={14} />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
