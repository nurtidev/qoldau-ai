import { useCallback, useEffect, useState } from 'react'
import { aiApi, type ServiceInsightsResult, type ServiceInsight } from '@/api/client'
import { I } from '@/components/icons'
import { useToast } from '@/components/Toast'

interface Props {
  serviceId: string | undefined
  serviceTitle: string
  onClose: () => void
}

// ServiceInsights — выезжающая панель с AI-рекомендациями автору услуги.
// AI анализирует воронку, отказы, дозапросы, брошенные шаги и prescore —
// и говорит, что конкретно поправить в конструкторе.
export function ServiceInsights({ serviceId, serviceTitle, onClose }: Props) {
  const toast = useToast()
  const [data, setData] = useState<ServiceInsightsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async (refresh: boolean) => {
    if (!serviceId) return
    setLoading(true)
    setError(false)
    try {
      const r = await aiApi.serviceInsights(serviceId, refresh)
      setData(r.data)
    } catch {
      setError(true)
      toast.push('Не удалось получить AI-инсайты. Попробуйте ещё раз.', 'error')
    } finally {
      setLoading(false)
    }
  }, [serviceId, toast])

  useEffect(() => { load(false) }, [load])

  const hasData = !!data && (data.health_score !== null || data.insights.length > 0)
  const noData = !!data && data.health_score === null && data.insights.length === 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)' }} />

      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(720px, 100%)',
        background: 'var(--color-bg)', boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <header style={{
          padding: '14px 24px', background: '#fff',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <I.Sparkle size={18} style={{ color: 'var(--color-accent)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              AI-инсайты · рекомендации по улучшению
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {serviceTitle || 'Без названия'}
            </div>
          </div>
          {hasData && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => load(true)}
              disabled={loading}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <I.Sparkle size={13} /> Обновить анализ
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ width: 32, padding: 0 }}>
            <I.X size={15} />
          </button>
        </header>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {!serviceId && (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: 'var(--color-info-soft)', color: 'var(--color-info)',
              fontSize: 13, lineHeight: 1.5,
            }}>
              Сохраните черновик услуги, чтобы получить AI-инсайты по накопленным данным.
            </div>
          )}

          {loading && !data && <LoadingState />}

          {error && !data && (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 14 }}>
                Не удалось получить AI-инсайты.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => load(true)}>
                Повторить
              </button>
            </div>
          )}

          {noData && !loading && (
            <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Пока недостаточно данных</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5, maxWidth: 380, margin: '0 auto' }}>
                {data?.summary || 'Инсайты появятся, когда по услуге накопятся просмотры и заявки.'}
              </div>
            </div>
          )}

          {hasData && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <HealthCard score={data!.health_score} summary={data!.summary} />
              {data!.insights.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600 }}>
                    Рекомендации ({data!.insights.length})
                  </div>
                  {data!.insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
                </div>
              )}
            </div>
          )}

          {loading && data && (
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-text-3)', textAlign: 'center' }}>
              AI обновляет анализ…
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{
          padding: '12px 24px', background: '#fff',
          borderTop: '1px solid var(--color-border)',
          fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.5,
        }}>
          AI анализирует воронку, отказы, дозапросы документов, брошенные шаги и распределение
          предварительных грейдов. Рекомендации можно применить прямо в конструкторе.
        </footer>
      </aside>
    </div>
  )
}

// ── Health score ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--color-success)'
  if (score >= 40) return 'var(--color-accent)'
  return 'var(--color-danger)'
}

function HealthCard({ score, summary }: { score: number | null; summary: string }) {
  const color = score != null ? scoreColor(score) : 'var(--color-text-3)'
  return (
    <div className="card" style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
      <div style={{
        flexShrink: 0, width: 92, height: 92, borderRadius: '50%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `3px solid ${color}`, background: 'var(--color-surface-2)',
      }}>
        <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
          {score != null ? score : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 2 }}>из 100</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 6 }}>
          Здоровье услуги
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>
          {summary}
        </div>
      </div>
    </div>
  )
}

// ── Insight card ────────────────────────────────────────────────────────────────

const SEVERITY_META: Record<ServiceInsight['severity'], { label: string; color: string; bg: string; icon: keyof typeof I }> = {
  critical: { label: 'Критично', color: 'var(--color-danger)',  bg: 'var(--color-danger-soft, #FEE2E2)', icon: 'Alert' },
  warning:  { label: 'Внимание', color: 'var(--color-accent)',  bg: 'var(--color-accent-soft)',          icon: 'Alert' },
  info:     { label: 'Инфо',     color: 'var(--color-info)',     bg: 'var(--color-info-soft)',            icon: 'Info' },
}

function InsightCard({ insight }: { insight: ServiceInsight }) {
  const meta = SEVERITY_META[insight.severity] ?? SEVERITY_META.info
  const Icon = I[meta.icon]
  return (
    <div className="card" style={{ padding: 16, borderLeft: `3px solid ${meta.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 600, color: meta.color,
          background: meta.bg, padding: '3px 9px', borderRadius: 999,
        }}>
          <Icon size={12} /> {meta.label}
        </span>
        {insight.target && (
          <code style={{
            fontSize: 11, fontFamily: 'ui-monospace, monospace',
            background: 'var(--color-surface-2)', color: 'var(--color-text-2)',
            padding: '2px 7px', borderRadius: 5,
          }}>
            {insight.target}
          </code>
        )}
      </div>

      <div style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.55, marginBottom: 10 }}>
        {insight.finding}
      </div>

      <div style={{
        display: 'flex', gap: 8,
        padding: '10px 12px', borderRadius: 8,
        background: 'var(--color-success-soft)',
      }}>
        <I.Wand size={15} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Что сделать: </span>
          {insight.recommendation}
        </div>
      </div>
    </div>
  )
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        fontSize: 13, color: 'var(--color-text-2)',
      }}>
        <I.Sparkle size={16} style={{ color: 'var(--color-accent)' }} />
        AI анализирует данные услуги…
      </div>
      <div className="skeleton" style={{ height: 128, borderRadius: 12, marginBottom: 16 }} />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12, marginBottom: 12 }} />
      ))}
    </div>
  )
}
