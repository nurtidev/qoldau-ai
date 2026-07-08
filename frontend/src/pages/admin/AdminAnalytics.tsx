import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { I } from '@/components/icons'
import {
  servicesApi,
  funnelApi,
  audienceApi,
  type FunnelResponse,
  type FunnelStage,
  type AudienceMatch,
  type AudienceSnapshot,
} from '@/api/client'
import type { Service } from '@/types'

// Domain labels for the fixed sector/MSB enums returned by the audience API —
// presentation only, the counts themselves always come from the API.
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
  micro:  'Микро',
  small:  'Малый',
  medium: 'Средний',
  large:  'Крупный',
}

function formatStat(value: unknown): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || Number.isNaN(n)) return String(value ?? '—')
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' млрд ₸'
  if (n >= 1_000_000) return Math.round(n / 1_000_000) + ' млн ₸'
  if (n >= 1_000) return Math.round(n / 1_000) + ' тыс ₸'
  return n.toLocaleString('ru-RU')
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 24, minWidth: 0 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: subtitle ? 4 : 16 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0, marginBottom: 16 }}>{subtitle}</p>}
      {children}
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 13, color: 'var(--color-text-3)', padding: '16px 14px',
      background: 'var(--color-surface-2)', borderRadius: 10, lineHeight: 1.5,
    }}>{text}</div>
  )
}

// ─── Funnel bars ─────────────────────────────────────────────────────────────

function FunnelBars({ stages, worstIdx }: { stages: FunnelStage[]; worstIdx: number }) {
  if (stages.length === 0) return <EmptyNote text="Нет данных по воронке этой услуги." />
  const max = Math.max(...stages.map((s) => s.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stages.map((s, i) => {
        const barPct = (s.count / max) * 100
        const isWorst = i === worstIdx && i > 0
        return (
          <div key={s.stage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 5, gap: 8 }}>
              <span style={{
                color: isWorst ? 'var(--color-danger)' : 'var(--color-text-2)',
                fontWeight: isWorst ? 600 : 500,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {s.label}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {i > 0 && s.drop_pct > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: isWorst ? 'var(--color-danger)' : 'var(--color-text-3)' }}>
                    −{s.drop_pct}%
                  </span>
                )}
                <span style={{ color: 'var(--color-text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {s.count.toLocaleString('ru-RU')}
                </span>
              </span>
            </div>
            <div style={{ height: 10, background: 'var(--color-surface-2)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{
                width: `${barPct}%`, height: '100%', borderRadius: 5,
                background: isWorst ? 'var(--color-danger)' : 'var(--color-accent)',
                transition: 'width 200ms',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Breakdown mini bars (region / sector / msb) ────────────────────────────

function BreakdownList({ rows, labels }: { rows: { key: string; count: number }[]; labels?: Record<string, string> }) {
  if (rows.length === 0) return <EmptyNote text="Нет данных." />
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, gap: 8 }}>
            <span style={{ color: 'var(--color-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {labels?.[r.key] ?? r.key}
            </span>
            <span style={{ color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.count}</span>
          </div>
          <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function AdminAnalytics() {
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')

  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['admin-analytics-services'],
    queryFn: () => servicesApi.list().then((r) => r.data ?? []),
  })

  // Default to the leasing/agro control case if present, otherwise the first service.
  useEffect(() => {
    if (selectedServiceId || services.length === 0) return
    const control = services.find((s) => /лизинг|агро/i.test(s.title))
    setSelectedServiceId((control ?? services[0]).id)
  }, [services, selectedServiceId])

  const { data: funnel, isLoading: funnelLoading } = useQuery<FunnelResponse>({
    queryKey: ['admin-funnel', selectedServiceId],
    queryFn: () => funnelApi.get(selectedServiceId).then((r) => r.data),
    enabled: !!selectedServiceId,
  })

  const { data: snapshot } = useQuery<AudienceSnapshot>({
    queryKey: ['admin-audience-snapshot'],
    queryFn: () => audienceApi.snapshot().then((r) => r.data),
  })

  const { data: audience } = useQuery<AudienceMatch>({
    queryKey: ['admin-audience-match', selectedServiceId],
    queryFn: () => audienceApi.match(selectedServiceId, {}).then((r) => r.data),
    enabled: !!selectedServiceId,
  })

  const stages = funnel?.funnel ?? []
  const worstIdx = useMemo(() => {
    let idx = -1
    let worst = 0
    stages.forEach((s, i) => {
      if (i > 0 && s.drop_pct > worst) { worst = s.drop_pct; idx = i }
    })
    return idx
  }, [stages])

  const topFields = funnel?.biggest_drop?.top_fields ?? []
  const byRegion = audience?.by_region ?? []
  const bySector = audience?.by_sector ?? []
  const byMsb = audience?.by_msb ?? []

  return (
    <div className="page-fade" style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>Аналитика</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', margin: 0 }}>
            Воронка подачи и охват аудитории по выбранной услуге
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
          <label style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Услуга
          </label>
          <select
            className="select"
            style={{ height: 40 }}
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            disabled={servicesLoading || services.length === 0}
          >
            {services.length === 0 && <option value="">Нет услуг</option>}
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      </div>

      {services.length === 0 && !servicesLoading ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 14px',
            background: 'var(--color-surface-2)', color: 'var(--color-text-3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I.Funnel size={22} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Пока нет ни одной услуги</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Создайте услугу, чтобы увидеть её аналитику.</div>
        </div>
      ) : (
        <>
          {/* Funnel + drilldown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
            <SectionCard
              title="Воронка"
              subtitle={funnel ? funnel.service_title : (funnelLoading ? 'Загрузка…' : undefined)}
            >
              {funnelLoading ? (
                <div className="skeleton" style={{ height: 220, borderRadius: 8 }} />
              ) : (
                <FunnelBars stages={stages} worstIdx={worstIdx} />
              )}
            </SectionCard>

            <SectionCard title="Разбор просадки" subtitle={funnel?.biggest_drop ? funnel.biggest_drop.stage_label : undefined}>
              {funnelLoading ? (
                <div className="skeleton" style={{ height: 220, borderRadius: 8 }} />
              ) : funnel?.biggest_drop ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: 'var(--color-danger-soft)',
                  }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>
                      Самая большая просадка
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-danger)' }}>
                      {funnel.biggest_drop.abandoned_count.toLocaleString('ru-RU')}{' '}
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-3)' }}>заявок не дошли до следующего шага</span>
                    </div>
                  </div>

                  {topFields.length === 0 ? (
                    <EmptyNote text="Недостаточно данных о полях, на которых заявители остановились." />
                  ) : (
                    topFields.map((f) => (
                      <div key={f.field_id} style={{ padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{f.field_label}</span>
                          <span style={{ fontSize: 12, color: 'var(--color-text-3)', flexShrink: 0 }}>{f.abandoned_pct}%</span>
                        </div>
                        {f.stats && (f.stats.median != null) && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            {f.stats.p25 != null && <StatChip label="p25" value={formatStat(f.stats.p25)} />}
                            {f.stats.median != null && <StatChip label="медиана" value={formatStat(f.stats.median)} highlight />}
                            {f.stats.p75 != null && <StatChip label="p75" value={formatStat(f.stats.p75)} />}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5 }}>{f.insight}</div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <EmptyNote text="Значимых просадок на этапах формы не обнаружено — либо данных ещё недостаточно, либо заявители проходят форму без затруднений." />
              )}
            </SectionCard>
          </div>

          {/* Audience reach */}
          <div className="card" style={{ padding: 24, marginBottom: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <I.Users size={18} style={{ color: 'var(--color-accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Охват аудитории</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0, marginBottom: 18 }}>
              Синтетическая база предпринимателей, доступная для подбора аудитории
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 20 }}>
              <StatChipLarge label="Всего в базе" value={snapshot?.total_audience ?? '—'} />
              <StatChipLarge label="Регионов" value={snapshot?.regions?.length ?? '—'} />
              <StatChipLarge label="Отраслей" value={snapshot?.sectors?.length ?? '—'} />
              <StatChipLarge label="Категорий МСБ" value={snapshot?.msb_categories?.length ?? '—'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>По регионам</div>
                <BreakdownList rows={byRegion} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>По отраслям</div>
                <BreakdownList rows={bySector} labels={SECTOR_LABELS} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>По размеру бизнеса</div>
                <BreakdownList rows={byMsb} labels={MSB_LABELS} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '5px 9px', borderRadius: 6,
      background: highlight ? 'var(--color-accent-soft)' : 'var(--color-surface-2)',
    }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? 'var(--color-accent-text)' : 'var(--color-text)' }}>{value}</div>
    </div>
  )
}

function StatChipLarge({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--color-surface-2)', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
    </div>
  )
}
