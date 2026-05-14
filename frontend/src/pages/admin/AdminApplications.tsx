import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '@/api/client'
import { useToast } from '@/components/Toast'
import { I } from '@/components/icons'
import type { Application, ApplicationStatus } from '@/types'
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/types'

const FILTERS: { id: string; label: string }[] = [
  { id: 'all',       label: 'Все' },
  { id: 'submitted', label: 'Подана' },
  { id: 'in_review', label: 'На рассмотрении' },
  { id: 'approved',  label: 'Одобрено' },
  { id: 'rejected',  label: 'Отклонено' },
]

export function AdminApplications() {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const { push } = useToast()
  const qc = useQueryClient()

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ['admin-applications'],
    queryFn: () => applicationsApi.list().then((r) => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      applicationsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-applications'] })
      push('Статус обновлён', 'success')
      setSelected([])
    },
  })

  const filtered = filter === 'all' ? applications : applications.filter((a) => a.status === filter)

  return (
    <div className="page-fade" style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          Заявки <span style={{ fontSize: 14, color: 'var(--color-text-3)', fontWeight: 500 }}>· {filtered.length}</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm"><I.Filter size={14} />Фильтры</button>
          <button className="btn btn-secondary btn-sm"><I.Download size={14} />Экспорт</button>
        </div>
      </div>

      {/* Tab filters */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', padding: 3, borderRadius: 8, marginBottom: 16, width: 'fit-content' }}>
        {FILTERS.map((t) => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            padding: '6px 12px', height: 32, border: 'none', borderRadius: 6,
            background: filter === t.id ? '#fff' : 'transparent',
            color: filter === t.id ? 'var(--color-text)' : 'var(--color-text-3)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            boxShadow: filter === t.id ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--color-accent-soft)', borderRadius: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>Выбрано: {selected.length}</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={() => { selected.forEach((id) => updateStatus.mutate({ id, status: 'in_review' })) }}>
            Взять в работу
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Снять выделение</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-2)' }}>
              <th style={{ padding: '10px 16px', width: 40 }}>
                <input type="checkbox"
                  checked={selected.length === filtered.length && filtered.length > 0}
                  onChange={(e) => setSelected(e.target.checked ? filtered.map((a) => a.id) : [])}
                  style={{ accentColor: 'var(--color-accent)' }} />
              </th>
              {['Номер', 'Услуга', 'Дата', 'Статус', 'Действия'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Заявок нет</td></tr>
            ) : filtered.map((a) => {
              const checked = selected.includes(a.id)
              return (
                <tr key={a.id} style={{ borderTop: '1px solid var(--color-border)', background: checked ? 'var(--color-accent-soft)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setSelected((arr) => checked ? arr.filter((x) => x !== a.id) : [...arr, a.id])}
                      style={{ accentColor: 'var(--color-accent)' }} />
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--color-text-2)' }}>
                    {a.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <div style={{ fontWeight: 500 }}>{a.service_title ?? '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>
                    {new Date(a.created_at).toLocaleDateString('ru-KZ')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge badge-dot ${APPLICATION_STATUS_COLORS[a.status].includes('blue') ? 'badge-blue' : APPLICATION_STATUS_COLORS[a.status].includes('green') ? 'badge-green' : APPLICATION_STATUS_COLORS[a.status].includes('red') ? 'badge-red' : APPLICATION_STATUS_COLORS[a.status].includes('yellow') ? 'badge-amber' : 'badge-gray'}`}>
                      {APPLICATION_STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={a.status}
                      onChange={(e) => updateStatus.mutate({ id: a.id, status: e.target.value })}
                      style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                    >
                      {(['submitted', 'in_review', 'approved', 'rejected'] as ApplicationStatus[]).map((s) => (
                        <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
