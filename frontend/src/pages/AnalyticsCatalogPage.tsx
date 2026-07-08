import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { I } from '@/components/icons'
import { contentApi, type AnalyticsMaterial } from '@/api/client'

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

const FORMAT_LABEL: Record<string, string> = { web: 'Web', pdf: 'PDF', embed: 'Embed' }
const formatLabel = (f: string) => FORMAT_LABEL[f] ?? f

// ─── Page ───────────────────────────────────────────────────────────────────

export function AnalyticsCatalogPage() {
  const [activeType, setActiveType] = useState('')
  const [org, setOrg] = useState('')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<AnalyticsMaterial | null>(null)

  const { data: materials = [], isLoading } = useQuery<AnalyticsMaterial[]>({
    queryKey: ['materials'],
    queryFn: () => contentApi.materials().then((r) => r.data ?? []),
  })

  const types = useMemo(
    () => Array.from(new Set(materials.map((m) => m.material_type).filter(Boolean) as string[])),
    [materials],
  )
  const orgs = useMemo(
    () => Array.from(new Set(materials.map((m) => m.org).filter(Boolean) as string[])).sort(),
    [materials],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return materials.filter((m) =>
      (!activeType || m.material_type === activeType) &&
      (!org || m.org === org) &&
      (!q || m.title.toLowerCase().includes(q))
    )
  }, [materials, activeType, org, query])

  return (
    <div className="page-fade container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="section-eyebrow" style={{ marginBottom: 8 }}>Прозрачность</div>
        <h1 className="section-title" style={{ fontSize: 32 }}>Аналитическая отчётность</h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-3)', marginTop: 8, maxWidth: 720 }}>
          Единый каталог готовых аналитических материалов дочерних организаций Холдинга «Байтерек».
        </p>
      </div>

      {/* Positioning banner */}
      <div className="card" style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px',
        marginBottom: 24, background: 'var(--color-info-soft)', borderColor: 'rgba(15,118,110,0.25)',
      }}>
        <I.Info size={20} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.55 }}>
          Материалы размещаются дочерними организациями Холдинга и подключаются через ссылки или embedding —
          без дублирования BI-систем.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip active={activeType === ''} onClick={() => setActiveType('')}>Все типы</Chip>
          {types.map((t) => (
            <Chip key={t} active={activeType === t} color={typeColor(t)} onClick={() => setActiveType(t)}>{t}</Chip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="skeleton" style={{ height: 20, width: 120 }} />
              <div className="skeleton" style={{ height: 40 }} />
              <div className="skeleton" style={{ height: 14, width: '80%' }} />
              <div className="skeleton" style={{ height: 14, width: '60%' }} />
              <div className="skeleton" style={{ height: 34, marginTop: 6 }} />
            </div>
          ))
        ) : (
          <>
            {filtered.map((m) => (
              <div key={m.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {m.material_type && (
                    <span className="badge" style={{ background: `${typeColor(m.material_type)}1A`, color: typeColor(m.material_type) }}>{m.material_type}</span>
                  )}
                  <span className="badge badge-gray">{formatLabel(m.format)}</span>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.4, minHeight: 44 }}>{m.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--color-text-3)' }}>
                  <div><strong style={{ color: 'var(--color-text-2)' }}>{m.org}</strong>{m.period ? ` · актуально на ${m.period}` : ''}</div>
                  {m.source && <div>Источник: {m.source}</div>}
                  {m.updated_date && <div>Обновлено: {m.updated_date}</div>}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 6 }}>
                  {m.format === 'embed' ? (
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setPreview(m)}>
                      <I.Eye size={14} /> Предпросмотр
                    </button>
                  ) : (
                    <a href={m.url || '#'} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                      <I.ExternalLink size={14} /> Открыть
                    </a>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--color-text-3)', fontSize: 14 }}>
                Материалы не найдены. Попробуйте изменить фильтры.
              </div>
            )}
          </>
        )}
      </div>

      {preview && <PreviewModal material={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

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

function PreviewModal({ material, onClose }: { material: AnalyticsMaterial; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', gap: 12 }}>
          <div>
            {material.material_type && (
              <span className="badge" style={{ background: `${typeColor(material.material_type)}1A`, color: typeColor(material.material_type), marginBottom: 8 }}>{material.material_type}</span>
            )}
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>{material.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginTop: 4 }}>{material.org}{material.source ? ` · ${material.source}` : ''}</div>
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
            background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12.5, color: 'var(--color-text-3)',
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
  )
}
