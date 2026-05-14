import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { aiApi, mockApi, type KGDData } from '@/api/client'
import { I } from '@/components/icons'
import type { RecommendationItem, RecommendationResponse } from '@/types'

interface Props {
  iin: string
  /** Не предлагать эту услугу (например, ту, по которой только что отказали). */
  excludeServiceId?: string
  rejectionReason?: string
  /** Заголовок панели — отличается для разных контекстов. */
  title?: string
  subtitle?: string
  /** Автозапуск при монтировании. Если false — показываем кнопку «Подобрать». */
  autoRun?: boolean
}

export function AlternativeRecommendations({
  iin, excludeServiceId, rejectionReason,
  title = 'Что подойдёт вам по данным КГД',
  subtitle = 'AI подобрал программы на основе вашего профиля и налоговой истории',
  autoRun = true,
}: Props) {
  const [loading, setLoading] = useState(autoRun)
  const [data, setData] = useState<RecommendationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [triggered, setTriggered] = useState(autoRun)

  useEffect(() => {
    if (!triggered) return
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      mockApi.egov(iin).then(r => r.data as Record<string, unknown>).catch(() => null),
      mockApi.kgd(iin).then(r => r.data as KGDData).catch(() => null),
    ]).then(([egov, kgd]) => {
      if (cancelled) return
      return aiApi.recommend({
        egov: egov ?? undefined,
        kgd:  kgd  ?? undefined,
        exclude_service_id: excludeServiceId,
        rejection_reason:   rejectionReason,
      })
    }).then(res => {
      if (cancelled || !res) return
      setData(res.data as RecommendationResponse)
    }).catch(() => {
      if (!cancelled) setError('Не удалось получить рекомендации. Попробуйте позже.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [triggered, iin, excludeServiceId, rejectionReason])

  if (!triggered) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I.Sparkle size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.5 }}>{subtitle}</div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => setTriggered(true)}
            >
              <I.Sparkle size={14} /> Подобрать программы
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <I.Sparkle size={18} style={{ color: 'var(--color-primary)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>

      {loading && <LoadingState />}

      {error && (
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.note && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 12,
              background: 'var(--color-info-soft)', border: '1px solid #BAE6FD',
              color: '#075985', fontSize: 13, lineHeight: 1.5,
            }}>
              {data.note}
            </div>
          )}
          {data.recommendations.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
              Подходящих альтернатив не нашлось.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.recommendations.map(r => <RecommendationCard key={r.service_id} item={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RecommendationCard({ item }: { item: RecommendationItem }) {
  return (
    <Link
      to={`/services/${item.service_id}`}
      style={{
        textDecoration: 'none',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        padding: '12px 14px', borderRadius: 8,
        border: '1.5px solid var(--color-border)',
        background: '#fff', transition: 'all 140ms',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--color-accent)'
        el.style.boxShadow = 'var(--sh-sm)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--color-border)'
        el.style.boxShadow = 'none'
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <I.Sparkle size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
            {item.title}
          </span>
          {item.org_name && (
            <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>· {item.org_name}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4, lineHeight: 1.5 }}>
          {item.reason}
        </div>
      </div>
      <I.ArrowRight size={14} style={{ color: 'var(--color-text-3)', flexShrink: 0, marginTop: 8 }} />
    </Link>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', gap: 12 }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 12, width: '95%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
