import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/api/client'
import { I } from '@/components/icons'
import type { AnalyticsSummary } from '@/types'

const CHART_DAYS = [32, 41, 38, 52, 49, 65, 71, 58, 84, 79]
const CHART_LABELS = ['01','04','07','10','13','16','19','22','25','28']
const ORGS = [
  { short: 'Демеу',        color: 'var(--color-primary)', pct: 38 },
  { short: 'KazExport',    color: '#C9A21C', pct: 24 },
  { short: 'АгроКапитал', color: '#0A7A47', pct: 14 },
  { short: 'Astana Cap.',  color: '#8A6A14', pct: 12 },
  { short: 'ИнноФонд',    color: '#0F766E', pct:  8 },
  { short: 'KazGuarantee',color: '#B45309', pct:  4 },
]


function DashboardContent() {
  const { data: summary } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.summary().then((r) => r.data),
  })

  const maxV = Math.max(...CHART_DAYS)
  const stats = [
    { label: 'Всего заявок',           value: summary?.total_applications ?? '—',  delta: '+8.2%', up: true },
    { label: 'На рассмотрении',        value: summary?.pending_applications ?? '—', delta: '+15',   up: true },
    { label: 'Одобрено за месяц',      value: summary?.total_services ?? '—',       delta: '+12.4%',up: true },
    { label: 'Активных пользователей', value: summary?.total_users ?? '—',          delta: '−2.1%', up: false },
  ]

  return (
    <div className="page-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Дашборд</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6, marginBottom: 0 }}>Общая статистика по платформе</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="select" style={{ height: 36, width: 'auto' }}>
            <option>Последние 30 дней</option><option>За квартал</option><option>За год</option>
          </select>
          <button className="btn btn-secondary btn-sm"><I.Download size={14} />Экспорт</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.up ? 'var(--color-success)' : 'var(--color-danger)' }}>{s.delta}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>vs. прошлый месяц</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 4 }}>Заявки за последние 30 дней</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0, marginBottom: 16 }}>Динамика подачи заявок</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
            {CHART_DAYS.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                  <div style={{ width: '100%', height: `${(v / maxV) * 100}%`, background: 'linear-gradient(180deg, var(--color-accent) 0%, var(--color-primary) 100%)', borderRadius: '4px 4px 0 0', minHeight: 6 }} title={`${v} заявок`} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums' }}>{CHART_LABELS[i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 16 }}>По организациям</h3>
          {ORGS.map((o) => (
            <div key={o.short} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: 'var(--color-text-2)' }}>{o.short}</span>
                <span style={{ color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums' }}>{o.pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${o.pct}%`, height: '100%', background: o.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/admin/services/new" className="btn btn-primary"><I.Plus size={15} />Создать услугу</Link>
        <Link to="/admin/applications" className="btn btn-secondary">Все заявки</Link>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  return (
    <div style={{ padding: '32px 40px' }}>
      <DashboardContent />
    </div>
  )
}
