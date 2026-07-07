import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { I } from '@/components/icons'
import {
  funnelApi,
  type FunnelResponse,
  type FunnelStage,
  type DrilldownField,
  type AudienceFilters,
} from '@/api/client'

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatTenge(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' млрд ₸'
  if (n >= 1_000_000)     return Math.round(n / 1_000_000) + ' млн ₸'
  if (n >= 1_000)         return Math.round(n / 1_000) + ' тыс ₸'
  return n.toString() + ' ₸'
}

function formatStat(value: unknown): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || isNaN(n)) return String(value ?? '—')
  if (n >= 1_000_000) return formatTenge(n)
  return n.toLocaleString('ru-RU')
}

// ──────────────────────────────────────────────────────────────────────────────
// Drawer
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  serviceId:    string | undefined
  serviceTitle: string
  onClose:      () => void
  /** Called when admin clicks "Перенастроить аудиторию" with proposed filters. */
  onApplyAudienceFix?: (filters: AudienceFilters) => void
}

export function AnalyticsDrawer({ serviceId, serviceTitle, onClose, onApplyAudienceFix }: Props) {
  const { data, isLoading } = useQuery<FunnelResponse>({
    queryKey: ['funnel', serviceId],
    queryFn:  () => funnelApi.get(serviceId!).then(r => r.data),
    enabled:  !!serviceId,
  })

  // Stage selected for drilldown. Defaults to biggest_drop stage when data loads.
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  useEffect(() => {
    if (data?.biggest_drop && !selectedStage) {
      setSelectedStage(data.biggest_drop.stage)
    }
  }, [data, selectedStage])

  const drilldown = useMemo<DrilldownField[] | null>(() => {
    if (!data?.biggest_drop) return null
    if (selectedStage === data.biggest_drop.stage) return data.biggest_drop.top_fields
    // For non-biggest stages we don't have field-level drilldown in MVP
    return null
  }, [data, selectedStage])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 75 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)' }} />

      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 820,
        background: 'var(--color-bg)', boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <header style={{
          padding: '14px 24px', background: '#fff',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <I.Funnel size={18} style={{ color: 'var(--color-accent)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Воронка программы · аналитика после запуска
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
            Сохраните черновик услуги, чтобы увидеть аналитику воронки.
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {isLoading && !data && (
            <div className="skeleton" style={{ height: 400 }} />
          )}

          {data && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 20 }}>
              {/* LEFT: funnel chart */}
              <section>
                <SectionLabel>Воронка</SectionLabel>
                <FunnelChart
                  stages={data.funnel}
                  selected={selectedStage}
                  biggestStage={data.biggest_drop?.stage ?? null}
                  onSelect={setSelectedStage}
                />
              </section>

              {/* RIGHT: drilldown */}
              <section>
                <SectionLabel>Разбор просадки</SectionLabel>
                {data.biggest_drop && selectedStage === data.biggest_drop.stage ? (
                  <DrilldownPanel
                    stageLabel={data.biggest_drop.stage_label}
                    abandonedCount={data.biggest_drop.abandoned_count}
                    fields={drilldown}
                    onApplyAudienceFix={onApplyAudienceFix}
                    onClose={onClose}
                  />
                ) : (
                  <EmptyDrilldown />
                )}
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{
          padding: '12px 24px', background: '#fff',
          borderTop: '1px solid var(--color-border)',
          fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.5,
        }}>
          Данные основаны на просмотрах карточки, событиях шагов формы и статусах заявок за последние 60 дней.
        </footer>
      </aside>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// FunnelChart — horizontal bars with drop percentages
// ──────────────────────────────────────────────────────────────────────────────

function FunnelChart({ stages, selected, biggestStage, onSelect }: {
  stages:       FunnelStage[]
  selected:     string | null
  biggestStage: string | null
  onSelect:     (stage: string) => void
}) {
  if (stages.length === 0) return null
  const max = Math.max(...stages.map(s => s.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stages.map((s, i) => {
        const pct = (s.count / max) * 100
        const isSelected = selected === s.stage
        const isBiggest  = biggestStage === s.stage
        const canSelect  = s.stage.endsWith('_completed') || s.stage === 'submitted' || s.stage === 'approved'

        return (
          <div key={s.stage} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              onClick={() => canSelect && onSelect(s.stage)}
              disabled={!canSelect}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 70px 50px',
                gap: 10, alignItems: 'center',
                padding: '8px 10px',
                border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'transparent'}`,
                background: isSelected ? 'var(--color-accent-soft)' : 'transparent',
                borderRadius: 8,
                cursor: canSelect ? 'pointer' : 'default',
                textAlign: 'left',
                transition: 'all 120ms',
              }}
            >
              <div style={{ position: 'relative', minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: isBiggest ? 'var(--color-danger)' : 'var(--color-text-2)',
                  fontWeight: isBiggest ? 600 : 500,
                  marginBottom: 4, lineHeight: 1.3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{s.label}</div>
                <div style={{ height: 8, background: 'var(--color-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: isBiggest ? 'var(--color-danger)' : 'var(--color-accent)',
                    transition: 'width 200ms',
                  }} />
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                {s.count.toLocaleString('ru-RU')}
              </div>
              <div style={{ textAlign: 'right' }}>
                {i > 0 && s.drop_pct > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: isBiggest ? 'var(--color-danger)' : 'var(--color-text-3)',
                  }}>
                    −{s.drop_pct}%
                  </span>
                )}
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// DrilldownPanel
// ──────────────────────────────────────────────────────────────────────────────

function DrilldownPanel({
  stageLabel,
  abandonedCount,
  fields,
  onApplyAudienceFix,
  onClose,
}: {
  stageLabel:          string
  abandonedCount:      number
  fields:              DrilldownField[] | null
  onApplyAudienceFix?: (filters: AudienceFilters) => void
  onClose:             () => void
}) {
  const top = fields?.[0]
  const audienceFix = top?.audience_fix

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Headline */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>
          Где отвалились
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
          {stageLabel}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-danger)', letterSpacing: '-0.01em' }}>
          {abandonedCount.toLocaleString('ru-RU')}{' '}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-3)' }}>заявок не дошли</span>
        </div>
      </div>

      {/* Top field */}
      {top ? (
        <>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 6 }}>
              Главная причина отказов
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
              {top.field_label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 12 }}>
              {top.abandoned_count.toLocaleString('ru-RU')} человек ({top.abandoned_pct}% от всех бросивших на этом шаге)
            </div>

            {/* Stats grid */}
            {top.stats && Object.keys(top.stats).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                {top.stats.p25 != null && (
                  <StatTile label="p25" value={formatStat(top.stats.p25)} />
                )}
                {top.stats.median != null && (
                  <StatTile label="Медиана" value={formatStat(top.stats.median)} highlight />
                )}
                {top.stats.p75 != null && (
                  <StatTile label="p75" value={formatStat(top.stats.p75)} />
                )}
              </div>
            )}

            {/* Insight */}
            <div style={{
              padding: 12, borderRadius: 8,
              background: 'var(--color-info-soft)',
              fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.5,
            }}>
              {top.insight}
            </div>
          </div>

          {/* Audience fix CTA */}
          {audienceFix && onApplyAudienceFix && (
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                onApplyAudienceFix({
                  min_revenue: audienceFix.min_revenue ?? null,
                  max_revenue: audienceFix.max_revenue ?? null,
                })
                onClose()
              }}
              style={{ padding: '12px 16px', fontSize: 14, justifyContent: 'flex-start', display: 'flex', gap: 10, alignItems: 'center' }}
            >
              <I.Target size={16} />
              <span style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Перенастроить аудиторию под эту потребность</div>
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 400, marginTop: 2 }}>
                  Откроется калькулятор охвата с подобранными фильтрами
                </div>
              </span>
              <I.ArrowRight size={14} />
            </button>
          )}
        </>
      ) : (
        <div className="card" style={{ padding: 18, fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          На этом шаге недостаточно данных для разбора причин (нужны события с указанием поля, на котором заявитель остановился).
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 6,
      background: highlight ? 'var(--color-accent-soft)' : 'var(--color-surface-2)',
    }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: highlight ? 'var(--color-primary)' : 'var(--color-text)' }}>{value}</div>
    </div>
  )
}

function EmptyDrilldown() {
  return (
    <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-3)', fontSize: 13, lineHeight: 1.5 }}>
      Кликните на бар в воронке слева, чтобы увидеть, на каком поле заявители отвалились и почему.
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 10 }}>
      {children}
    </div>
  )
}
