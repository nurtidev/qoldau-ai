import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { I } from '@/components/icons'
import { useToast } from '@/components/Toast'
import {
  audienceApi,
  type AudienceFilters,
  type AudienceMatch,
  type AudienceSnapshot,
} from '@/api/client'

// ──────────────────────────────────────────────────────────────────────────────
// Labels & helpers
// ──────────────────────────────────────────────────────────────────────────────

const SECTOR_LABELS: Record<string, string> = {
  agro:         'Сельское хозяйство',
  industry:     'Производство',
  trade:        'Торговля',
  services:     'Услуги',
  construction: 'Строительство',
  tech:         'IT и инновации',
  tourism:      'Туризм',
  other:        'Другое',
}

const MSB_LABELS: Record<string, string> = {
  micro:  'Микро (< 30 млн ₸)',
  small:  'Малый (30 – 300 млн ₸)',
  medium: 'Средний (300 млн – 3 млрд ₸)',
  large:  'Крупный (> 3 млрд ₸)',
}

function pluralEntrepreneurs(n: number): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'предприниматель'
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'предпринимателя'
  return 'предпринимателей'
}

function formatTenge(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' млрд'
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(0) + ' млн'
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + ' тыс'
  return n.toString()
}

const EMPTY_FILTERS: AudienceFilters = {
  sectors: [],
  regions: [],
  msb_categories: [],
  min_business_age_months: null,
  max_business_age_months: null,
  min_revenue: null,
  max_revenue: null,
  min_owner_age: null,
  max_owner_age: null,
  exclude_tax_debt: false,
  exclude_risk_register: false,
}

// ──────────────────────────────────────────────────────────────────────────────
// Drawer
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  serviceId:    string | undefined  // undefined for unsaved services
  serviceTitle: string
  onClose:      () => void
  /** Pre-applied filters — used when the drawer is opened from AnalyticsDrawer's audience_fix CTA. */
  initialFilters?: AudienceFilters
  /** Optional banner text shown at the top — explains where the pre-applied filters came from. */
  banner?: string
}

export function AudienceDrawer({ serviceId, serviceTitle, onClose, initialFilters, banner }: Props) {
  const [filters, setFilters] = useState<AudienceFilters>(initialFilters
    ? { ...EMPTY_FILTERS, ...initialFilters }
    : EMPTY_FILTERS)
  const [match, setMatch] = useState<AudienceMatch | null>(null)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const toast = useToast()

  const { data: snapshot } = useQuery<AudienceSnapshot>({
    queryKey: ['audience-snapshot'],
    queryFn: () => audienceApi.snapshot().then(r => r.data),
  })

  // Debounced re-fetch on filter change (300ms).
  const debounceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!serviceId) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await audienceApi.match(serviceId, filters)
        setMatch(res.data)
      } catch {
        // soft-fail — UI shows last value
      }
    }, 300)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [serviceId, filters])

  const total       = match?.total ?? 0
  const totalShare  = snapshot && snapshot.total_audience > 0
    ? Math.round((total / snapshot.total_audience) * 100)
    : 0
  const filterCount = useMemo(() => countActive(filters), [filters])

  const update = <K extends keyof AudienceFilters>(key: K, value: AudienceFilters[K]) => {
    setFilters(f => ({ ...f, [key]: value }))
  }
  const toggleInList = (key: 'sectors' | 'regions' | 'msb_categories', value: string) => {
    setFilters(f => {
      const cur = f[key] || []
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
      return { ...f, [key]: next }
    })
  }
  const reset = () => setFilters(EMPTY_FILTERS)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 75 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)' }} />

      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 720,
        background: 'var(--color-bg)', boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <header style={{
          padding: '14px 24px', background: '#fff',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <I.Users size={18} style={{ color: 'var(--color-accent)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Калькулятор охвата · {snapshot ? snapshot.total_audience.toLocaleString('ru-RU') : '—'} предпринимателей в базе
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{serviceTitle || 'Без названия'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ width: 32, padding: 0 }}>
            <I.X size={15} />
          </button>
        </header>

        {!serviceId && (
          <div style={{
            margin: 20, padding: '14px 16px', borderRadius: 10,
            background: 'var(--color-info-soft)', color: 'var(--color-info)',
            fontSize: 13, lineHeight: 1.5,
          }}>
            Сохраните черновик услуги, чтобы рассчитать охват и отправить рассылку.
          </div>
        )}

        {banner && serviceId && (
          <div style={{
            margin: '12px 24px 0', padding: '12px 14px', borderRadius: 10,
            background: 'var(--color-accent-soft)', color: 'var(--color-text-2)',
            fontSize: 13, lineHeight: 1.5,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <I.Funnel size={14} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 2 }} />
            <span>{banner}</span>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* LEFT: filters */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FilterGroup title="Отрасль" count={filters.sectors?.length}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(snapshot?.sectors || []).map(s => (
                  <Chip
                    key={s}
                    label={SECTOR_LABELS[s] || s}
                    active={(filters.sectors || []).includes(s)}
                    onClick={() => toggleInList('sectors', s)}
                  />
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Размер бизнеса" count={filters.msb_categories?.length}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(snapshot?.msb_categories || []).map(c => (
                  <Chip
                    key={c}
                    label={MSB_LABELS[c] || c}
                    active={(filters.msb_categories || []).includes(c)}
                    onClick={() => toggleInList('msb_categories', c)}
                  />
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Регион" count={filters.regions?.length}>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(snapshot?.regions || []).map(r => (
                  <Chip
                    key={r}
                    label={r}
                    active={(filters.regions || []).includes(r)}
                    onClick={() => toggleInList('regions', r)}
                  />
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Возраст бизнеса (месяцев)">
              <RangeInputs
                min={filters.min_business_age_months}
                max={filters.max_business_age_months}
                onMin={v => update('min_business_age_months', v)}
                onMax={v => update('max_business_age_months', v)}
                step={6}
                placeholderMin="от 0"
                placeholderMax="до 240"
              />
            </FilterGroup>

            <FilterGroup title="Годовая выручка, ₸">
              <RangeInputs
                min={filters.min_revenue ?? null}
                max={filters.max_revenue ?? null}
                onMin={v => update('min_revenue', v)}
                onMax={v => update('max_revenue', v)}
                step={1_000_000}
                placeholderMin="от 0"
                placeholderMax="до ∞"
                format={formatTenge}
              />
            </FilterGroup>

            <FilterGroup title="Возраст владельца">
              <RangeInputs
                min={filters.min_owner_age}
                max={filters.max_owner_age}
                onMin={v => update('min_owner_age', v)}
                onMax={v => update('max_owner_age', v)}
                step={1}
                placeholderMin="18"
                placeholderMax="65"
              />
            </FilterGroup>

            <FilterGroup title="Исключить из охвата">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={!!filters.exclude_tax_debt}
                  onChange={e => update('exclude_tax_debt', e.target.checked)}
                />
                С налоговой задолженностью (КГД)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={!!filters.exclude_risk_register}
                  onChange={e => update('exclude_risk_register', e.target.checked)}
                />
                В реестре риска КГД
              </label>
            </FilterGroup>

            {filterCount > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={reset}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              >
                <I.X size={13} /> Сбросить фильтры ({filterCount})
              </button>
            )}
          </section>

          {/* RIGHT: live result */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 20, textAlign: 'center', background: '#fff' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600 }}>
                Подпадают под фильтры
              </div>
              <div style={{
                fontSize: 56, fontWeight: 700, lineHeight: 1.1,
                color: total > 0 ? 'var(--color-text)' : 'var(--color-text-3)',
                margin: '6px 0',
                letterSpacing: '-0.02em',
                transition: 'color 200ms',
              }}>
                {total.toLocaleString('ru-RU')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-text-2)' }}>
                {pluralEntrepreneurs(total)} {snapshot && totalShare > 0 && (
                  <span style={{ color: 'var(--color-text-3)' }}>· {totalShare}% базы</span>
                )}
              </div>
            </div>

            <Breakdown title="По регионам (топ-5)"  rows={match?.by_region || []}                              total={total} />
            <Breakdown title="По отраслям"          rows={(match?.by_sector || []).map(r => ({ ...r, key: SECTOR_LABELS[r.key] || r.key }))} total={total} />
            <Breakdown title="По размеру бизнеса"   rows={(match?.by_msb    || []).map(r => ({ ...r, key: MSB_LABELS[r.key]    || r.key }))} total={total} />

            {match?.sample && match.sample.length > 0 && (
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 8 }}>
                  Пример аудитории
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {match.sample.slice(0, 4).map((u, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.4 }}>
                      <strong style={{ color: 'var(--color-text)' }}>{u.org_name || u.full_name}</strong>
                      {u.region    && <span style={{ color: 'var(--color-text-3)' }}> · {u.region}</span>}
                      {u.sector    && <span style={{ color: 'var(--color-text-3)' }}> · {SECTOR_LABELS[u.sector] || u.sector}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer style={{
          padding: '14px 24px', background: '#fff',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.4 }}>
            Данные: синтетическая аудитория {snapshot ? snapshot.total_audience.toLocaleString('ru-RU') : '—'} записей<br/>
            В продакшне источник — eGov + КГД + ИС МСБ через ЕИШ
          </div>
          <button
            className="btn btn-primary"
            disabled={!serviceId || total === 0}
            onClick={() => setShowBroadcast(true)}
          >
            <I.Send size={14} /> Отправить уведомление · {total.toLocaleString('ru-RU')}
          </button>
        </footer>

        {showBroadcast && serviceId && (
          <BroadcastModal
            serviceId={serviceId}
            serviceTitle={serviceTitle}
            filters={filters}
            audienceSize={total}
            sampleName={match?.sample?.[0]?.full_name}
            sampleOrg={match?.sample?.[0]?.org_name}
            onClose={() => setShowBroadcast(false)}
            onSent={(n) => {
              setShowBroadcast(false)
              toast.push(`Отправлено ${n} ${pluralEntrepreneurs(n)}`, 'success')
            }}
          />
        )}
      </aside>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function FilterGroup({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {title}
        {count != null && count > 0 && (
          <span style={{
            padding: '1px 7px', borderRadius: 999, fontSize: 10,
            background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
          }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', transition: 'all 120ms',
        background: active ? 'var(--color-accent)' : '#fff',
        color: active ? '#1A1206' : 'var(--color-text-2)',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}
    >
      {label}
    </button>
  )
}

function RangeInputs({ min, max, onMin, onMax, step, placeholderMin, placeholderMax, format }: {
  min: number | null | undefined
  max: number | null | undefined
  onMin: (v: number | null) => void
  onMax: (v: number | null) => void
  step: number
  placeholderMin: string
  placeholderMax: string
  format?: (n: number) => string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="number"
        className="input"
        step={step}
        placeholder={placeholderMin}
        value={min ?? ''}
        onChange={e => onMin(e.target.value === '' ? null : Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ color: 'var(--color-text-3)', fontSize: 12 }}>—</span>
      <input
        type="number"
        className="input"
        step={step}
        placeholder={placeholderMax}
        value={max ?? ''}
        onChange={e => onMax(e.target.value === '' ? null : Number(e.target.value))}
        style={{ flex: 1 }}
      />
      {format && (min != null || max != null) && (
        <span style={{ fontSize: 11, color: 'var(--color-text-3)', minWidth: 60, textAlign: 'right' }}>
          {min != null && format(min)}{min != null && max != null && '–'}{max != null && format(max)}
        </span>
      )}
    </div>
  )
}

function Breakdown({ title, rows, total }: {
  title: string
  rows: { key: string; count: number }[]
  total: number
}) {
  if (rows.length === 0) return null
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0
          return (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: 'var(--color-text-2)', marginBottom: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.key}</div>
                <div style={{ height: 4, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 200ms' }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>
                {r.count.toLocaleString('ru-RU')} <span style={{ color: 'var(--color-text-3)' }}>· {pct}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// BroadcastModal
// ──────────────────────────────────────────────────────────────────────────────

function BroadcastModal({ serviceId, serviceTitle, filters, audienceSize, sampleName, sampleOrg, onClose, onSent }: {
  serviceId:     string
  serviceTitle:  string
  filters:       AudienceFilters
  audienceSize:  number
  sampleName?:   string
  sampleOrg?:    string
  onClose:       () => void
  onSent:        (count: number) => void
}) {
  const [title, setTitle] = useState(`Подходящая программа: ${serviceTitle}`)
  const [message, setMessage] = useState(
    `Здравствуйте, {{full_name}}!\n\n` +
    `Для {{org_name}} доступна программа «${serviceTitle}». ` +
    `По вашему профилю вы подходите под условия. ` +
    `Откройте каталог услуг, чтобы подать заявку.`,
  )
  const toast = useToast()

  const preview = useMemo(() =>
    message
      .replace(/\{\{full_name\}\}/g, sampleName || 'Айдар Бекжанов')
      .replace(/\{\{org_name\}\}/g,  sampleOrg  || 'ТОО «Бекжанов»'),
  [message, sampleName, sampleOrg])

  const send = useMutation({
    mutationFn: () => audienceApi.broadcast(serviceId, { filters, title, message }).then(r => r.data),
    onSuccess: (data) => onSent(data.sent_to),
    onError: () => toast.push('Ошибка отправки', 'error'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)' }} />
      <div className="card" style={{ position: 'relative', width: 560, maxWidth: '90vw', padding: 24, background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <I.Send size={18} style={{ color: 'var(--color-accent)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600 }}>Рассылка</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{audienceSize.toLocaleString('ru-RU')} {pluralEntrepreneurs(audienceSize)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ width: 32, padding: 0 }}><I.X size={15} /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="field-label">Заголовок уведомления</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="field-label">Текст</label>
          <textarea
            className="textarea"
            value={message}
            onChange={e => setMessage(e.target.value)}
            style={{ minHeight: 110, fontFamily: 'inherit' }}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
            Доступные подстановки: <code>{'{{full_name}}'}</code>, <code>{'{{org_name}}'}</code>
          </div>
        </div>

        <div style={{ padding: 12, background: 'var(--color-surface-2)', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 6 }}>
            Превью для получателя
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{preview}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={send.isPending}>Отмена</button>
          <button
            className="btn btn-primary"
            disabled={send.isPending || audienceSize === 0 || !message.trim()}
            onClick={() => send.mutate()}
          >
            {send.isPending
              ? 'Отправка…'
              : <>Отправить {audienceSize.toLocaleString('ru-RU')} <I.ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

function countActive(f: AudienceFilters): number {
  let n = 0
  n += (f.sectors        || []).length
  n += (f.regions        || []).length
  n += (f.msb_categories || []).length
  if (f.min_business_age_months != null) n++
  if (f.max_business_age_months != null) n++
  if (f.min_revenue             != null) n++
  if (f.max_revenue             != null) n++
  if (f.min_owner_age           != null) n++
  if (f.max_owner_age           != null) n++
  if (f.exclude_tax_debt)                n++
  if (f.exclude_risk_register)           n++
  return n
}
