import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi, applicationsApi } from '@/api/client'
import { I } from '@/components/icons'
import type { Application, ApplicationStatus, AnalyticsSummary } from '@/types'
import { APPLICATION_STATUS_LABELS } from '@/types'

// Brand-token colors per status — only the 2 official brand colors (green +
// tan) plus the existing semantic tokens (success/warning/danger/info), no
// invented hex values.
const STATUS_COLOR: Record<ApplicationStatus, string> = {
  draft:          'var(--color-text-3)',
  submitted:      'var(--color-info)',
  in_review:      'var(--color-warning)',
  docs_requested: 'var(--color-accent-text)',
  approved:       'var(--color-success)',
  rejected:       'var(--color-danger)',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' })
}

function StatTile({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="card-elevated" style={{ padding: 20, borderRadius: 'var(--r-card)', border: '1px solid var(--color-border)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: accent ?? 'var(--color-primary-soft)', color: accent ? '#fff' : 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{value}</div>
    </div>
  )
}

function DashboardContent() {
  const navigate = useNavigate()
  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.summary().then((r) => r.data),
  })

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ['admin-applications-dashboard'],
    queryFn: () => applicationsApi.list().then((r) => r.data ?? []),
  })

  const byStatus = summary?.by_status ?? []
  const totalApplications = summary?.total_applications ?? 0
  const approvedCount = byStatus.find((s) => s.status === 'approved')?.count ?? 0
  const conversionPct = totalApplications > 0 ? Math.round((approvedCount / totalApplications) * 100) : null

  // Top services by application count — derived client-side from the real
  // applications list (the summary endpoint doesn't expose this breakdown).
  const topServices = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of applications) {
      const key = a.service_title || 'Без названия'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [applications])

  // Applications already arrive sorted by created_at DESC from the backend.
  const recentApplications = applications.slice(0, 6)

  const statusMax = Math.max(...byStatus.map((s) => s.count), 1)
  const topServiceMax = Math.max(...topServices.map(([, c]) => c), 1)

  return (
    <div className="page-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Дашборд</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6, marginBottom: 0 }}>
            Операционная сводка по платформе — данные в реальном времени
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/admin/services/new" className="btn btn-primary btn-sm"><I.Plus size={14} />Создать услугу</Link>
          <Link to="/admin/applications" className="btn btn-secondary btn-sm">Все заявки</Link>
        </div>
      </div>

      {/* KPI tiles */}
      {summaryLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 'var(--r-card)' }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatTile label="Всего заявок" value={totalApplications} icon={<I.Document size={16} />} />
          <StatTile label="На рассмотрении" value={summary?.pending_applications ?? '—'} icon={<I.Clock size={16} />} accent="var(--color-warning)" />
          <StatTile label="Одобрено" value={approvedCount} icon={<I.CheckCircle size={16} />} accent="var(--color-success)" />
          <StatTile label="Конверсия в одобрение" value={conversionPct != null ? `${conversionPct}%` : '—'} icon={<I.Target size={16} />} accent="var(--color-primary)" />
          <StatTile label="Услуг в каталоге" value={summary?.total_services ?? '—'} icon={<I.Grid size={16} />} />
          <StatTile label="Пользователей" value={summary?.total_users ?? '—'} icon={<I.Users size={16} />} />
        </div>
      )}

      {/* Status breakdown + top services */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 24, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 4 }}>Заявки по статусам</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0, marginBottom: 18 }}>
            Распределение всех {totalApplications.toLocaleString('ru-RU')} заявок в системе
          </p>
          {byStatus.length === 0 ? (
            <EmptyNote text="Заявок пока нет." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {byStatus.map((s) => {
                const pct = totalApplications > 0 ? Math.round((s.count / totalApplications) * 100) : 0
                const barPct = (s.count / statusMax) * 100
                return (
                  <div key={s.status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, gap: 8 }}>
                      <span style={{ color: 'var(--color-text-2)', fontWeight: 500 }}>{APPLICATION_STATUS_LABELS[s.status] ?? s.status}</span>
                      <span style={{ color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{s.count} · {pct}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--color-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: STATUS_COLOR[s.status] ?? 'var(--color-text-3)', borderRadius: 4, transition: 'width 200ms' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 4 }}>Топ услуг по заявкам</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0, marginBottom: 18 }}>Из {applications.length.toLocaleString('ru-RU')} заявок</p>
          {topServices.length === 0 ? (
            <EmptyNote text="Пока нет заявок ни по одной услуге." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topServices.map(([title, count]) => (
                <div key={title}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, gap: 8 }}>
                    <span style={{ color: 'var(--color-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                    <span style={{ color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / topServiceMax) * 100}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent applications */}
      <div className="card" style={{ padding: 24, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Недавние заявки</h3>
          <Link to="/admin/applications" className="btn btn-ghost btn-sm">Смотреть все<I.ArrowRight size={14} /></Link>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0, marginBottom: 16 }}>Последние поступления по всем услугам</p>
        {recentApplications.length === 0 ? (
          <EmptyNote text="Заявок пока нет." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentApplications.map((a) => (
              <div
                key={a.id}
                onClick={() => navigate('/admin/applications')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/admin/applications') } }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '12px 8px', margin: '0 -8px', borderRadius: 8, cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: STATUS_COLOR[a.status] ?? 'var(--color-text-3)',
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.service_title ?? 'Без названия'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span className="badge" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-2)' }}>
                    {APPLICATION_STATUS_LABELS[a.status] ?? a.status}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {formatDate(a.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: 'var(--color-text-3)', padding: '12px 0' }}>{text}</div>
}

export function AdminDashboard() {
  return (
    <div className="admin-page">
      <DashboardContent />
    </div>
  )
}
