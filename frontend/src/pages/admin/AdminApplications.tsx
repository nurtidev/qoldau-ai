import { Fragment, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '@/api/client'
import { useToast } from '@/components/Toast'
import { I } from '@/components/icons'
import { PrescoreCard, type PrescoreCardResult } from '@/components/PrescoreCard'
import { SlaBadge } from '@/components/SlaBadge'
import type { Application, ApplicationStatus } from '@/types'
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/types'

const FILTERS: { id: string; label: string }[] = [
  { id: 'all',            label: 'Все' },
  { id: 'submitted',      label: 'Подана' },
  { id: 'in_review',      label: 'На рассмотрении' },
  { id: 'docs_requested', label: 'Требуются данные' },
  { id: 'approved',       label: 'Одобрено' },
  { id: 'rejected',       label: 'Отклонено' },
]

export function AdminApplications() {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  // Раскрытая строка с предварительной оценкой заявителя.
  const [expanded, setExpanded] = useState<string | null>(null)
  // Row id awaiting a "request additional data" message, plus the message draft.
  const [docsModal, setDocsModal] = useState<string | null>(null)
  const [docsMessage, setDocsMessage] = useState('')
  const { push } = useToast()
  const qc = useQueryClient()

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ['admin-applications'],
    queryFn: () => applicationsApi.list().then((r) => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status, message }: { id: string; status: string; message?: string }) =>
      applicationsApi.updateStatus(id, status, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-applications'] })
      push('Статус обновлён', 'success')
      setSelected([])
    },
  })

  const filtered = filter === 'all' ? applications : applications.filter((a) => a.status === filter)

  return (
    <div className="page-fade" style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          Заявки <span style={{ fontSize: 14, color: 'var(--color-text-3)', fontWeight: 500 }}>· {filtered.length}</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm"><I.Filter size={14} />Фильтры</button>
          <button className="btn btn-secondary btn-sm"><I.Download size={14} />Экспорт</button>
        </div>
      </div>

      {/* Tab filters */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', padding: 3, borderRadius: 8, marginBottom: 16, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
        {FILTERS.map((t) => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            padding: '6px 12px', height: 32, border: 'none', borderRadius: 6,
            background: filter === t.id ? '#fff' : 'transparent',
            color: filter === t.id ? 'var(--color-text)' : 'var(--color-text-3)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
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
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse' }}>
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
              const prescore = a.form_data?._prescore as PrescoreCardResult | undefined
              const isOpen = expanded === a.id
              return (
                <Fragment key={a.id}>
                <tr style={{ borderTop: '1px solid var(--color-border)', background: checked ? 'var(--color-accent-soft)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setSelected((arr) => checked ? arr.filter((x) => x !== a.id) : [...arr, a.id])}
                      style={{ accentColor: 'var(--color-accent)' }} />
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--color-text-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {prescore ? (
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : a.id)}
                          title="Предварительная оценка заявителя"
                          aria-label="Показать предварительную оценку"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, padding: 0, borderRadius: 6, cursor: 'pointer',
                            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                            color: 'var(--color-text-3)',
                          }}
                        >
                          {isOpen ? <I.ChevronUp size={13} /> : <I.ChevronDown size={13} />}
                        </button>
                      ) : (
                        <span style={{ width: 22, display: 'inline-block' }} />
                      )}
                      {a.id.slice(0, 8).toUpperCase()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <div style={{ fontWeight: 500 }}>{a.service_title ?? '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>
                    {new Date(a.created_at).toLocaleDateString('ru-KZ')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`badge badge-dot ${APPLICATION_STATUS_COLORS[a.status].includes('blue') ? 'badge-blue' : APPLICATION_STATUS_COLORS[a.status].includes('green') ? 'badge-green' : APPLICATION_STATUS_COLORS[a.status].includes('red') ? 'badge-red' : APPLICATION_STATUS_COLORS[a.status].includes('yellow') ? 'badge-amber' : 'badge-gray'}`}>
                        {APPLICATION_STATUS_LABELS[a.status]}
                      </span>
                      <SlaBadge app={a} inline />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={a.status}
                      onChange={(e) => {
                        const next = e.target.value
                        if (next === 'docs_requested') {
                          // Ask the admin what to request before changing status.
                          setDocsMessage('')
                          setDocsModal(a.id)
                        } else {
                          updateStatus.mutate({ id: a.id, status: next })
                        }
                      }}
                      style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-surface)', cursor: 'pointer' }}
                    >
                      {(['submitted', 'in_review', 'docs_requested', 'approved', 'rejected'] as ApplicationStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {s === 'docs_requested' ? 'Запросить доп. данные' : APPLICATION_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                {isOpen && prescore && (
                  <tr style={{ background: 'var(--color-surface-2)' }}>
                    <td colSpan={6} style={{ padding: '12px 16px 18px 46px' }}>
                      <div style={{ maxWidth: 640 }}>
                        <PrescoreCard result={prescore} compact />
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* "Request additional data" modal */}
      {docsModal && (
        <div className="modal-backdrop" onClick={() => setDocsModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Запросить дополнительные данные</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDocsModal(null)} style={{ width: 32, padding: 0 }}>
                <I.X size={16} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <label className="field-label">Что нужно дозапросить у заявителя?</label>
              <textarea
                className="textarea"
                autoFocus
                value={docsMessage}
                onChange={(e) => setDocsMessage(e.target.value)}
                placeholder="Например: приложите справку об отсутствии налоговой задолженности и финансовую отчётность за последний год."
                style={{ minHeight: 110 }}
              />
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 8, lineHeight: 1.5 }}>
                Заявитель получит уведомление и сможет заполнить этап 2 в личном кабинете.
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setDocsModal(null)}>Отмена</button>
              <button
                className="btn btn-primary"
                disabled={!docsMessage.trim() || updateStatus.isPending}
                onClick={() => {
                  updateStatus.mutate({ id: docsModal, status: 'docs_requested', message: docsMessage.trim() })
                  setDocsModal(null)
                }}
              >
                <I.Upload size={14} /> Отправить запрос
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
