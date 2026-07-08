import { Fragment, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi, usersApi } from '@/api/client'
import { useToast } from '@/components/Toast'
import { I } from '@/components/icons'
import { PrescoreCard, type PrescoreCardResult } from '@/components/PrescoreCard'
import { SlaBadge } from '@/components/SlaBadge'
import { getSlaInfo } from '@/lib/sla'
import type { Application, ApplicationStatus } from '@/types'
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/types'

// Основные статусные табы. "Все" сознательно исключает черновики — заявка,
// которую заявитель ещё не подал, сотруднику обычно не нужна в очереди.
// Черновики доступны отдельным табом правее (см. DRAFT_FILTER).
const FILTERS: { id: string; label: string }[] = [
  { id: 'all',            label: 'Все' },
  { id: 'submitted',      label: 'Новые' },
  { id: 'in_review',      label: 'На рассмотрении' },
  { id: 'docs_requested', label: 'Требуются данные' },
  { id: 'approved',       label: 'Одобрено' },
  { id: 'rejected',       label: 'Отклонено' },
]

const DRAFT_FILTER = { id: 'draft', label: 'Черновики' }

type SortKey = 'date_desc' | 'date_asc' | 'sla'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'date_desc', label: 'Сначала новые' },
  { id: 'date_asc',  label: 'Сначала старые' },
  { id: 'sla',       label: 'SLA: горящие сначала' },
]

const PAGE_SIZE = 25

/** SLA-срочность заявки: отрицательное число = дней просрочки, чем меньше — тем горячее.
 *  Заявки без SLA (черновики/решённые) уходят в конец сортировки. */
function slaUrgency(a: Application): number {
  const info = getSlaInfo(a)
  if (!info) return Infinity
  return info.slaDays - info.daysOnStage
}

function sortApplications(list: Application[], sort: SortKey): Application[] {
  const arr = [...list]
  if (sort === 'date_desc') {
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (sort === 'date_asc') {
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  } else {
    arr.sort((a, b) => slaUrgency(a) - slaUrgency(b))
  }
  return arr
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', height: 32, border: 'none', borderRadius: 6,
    background: active ? '#fff' : 'transparent',
    color: active ? 'var(--color-text)' : 'var(--color-text-3)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
    boxShadow: active ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }
}

export function AdminApplications() {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  // Раскрытая строка с предварительной оценкой заявителя.
  const [expanded, setExpanded] = useState<string | null>(null)
  // Row id awaiting a "request additional data" message, plus the message draft.
  const [docsModal, setDocsModal] = useState<string | null>(null)
  const [docsMessage, setDocsMessage] = useState('')

  // Поиск / фильтр по услуге / сортировка / пагинация.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [sort, setSort] = useState<SortKey>('date_desc')
  const [page, setPage] = useState(0)

  const { push } = useToast()
  const qc = useQueryClient()

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ['admin-applications'],
    queryFn: () => applicationsApi.list().then((r) => r.data),
  })

  // Debounce ввода поиска, чтобы не гонять запрос к /users на каждый символ.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Applications API не отдаёт ФИО/ИИН заявителя (форма не всегда их содержит).
  // Для поиска по заявителю используем существующий admin-эндпоинт /users
  // (ILIKE по full_name/iin/org_name на бэкенде) и сопоставляем найденных
  // пользователей с a.user_id — один лёгкий запрос вместо N+1.
  const { data: userSearchResults, isFetching: isUserSearchFetching } = useQuery({
    queryKey: ['admin-applications-user-search', debouncedSearch],
    queryFn: () => usersApi.list({ q: debouncedSearch, limit: 100 }).then((r) => r.data.items),
    enabled: debouncedSearch.length >= 2,
  })
  const matchedUserIds = useMemo(
    () => new Set((userSearchResults ?? []).map((u) => u.id)),
    [userSearchResults]
  )

  const serviceOptions = useMemo(() => {
    const set = new Set<string>()
    for (const a of applications) if (a.service_title) set.add(a.service_title)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [applications])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    for (const a of applications) {
      counts[a.status] = (counts[a.status] ?? 0) + 1
      if (a.status !== 'draft') counts.all += 1
    }
    return counts
  }, [applications])

  const updateStatus = useMutation({
    mutationFn: ({ id, status, message }: { id: string; status: string; message?: string }) =>
      applicationsApi.updateStatus(id, status, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-applications'] })
      push('Статус обновлён', 'success')
      setSelected([])
    },
  })

  const filteredSorted = useMemo(() => {
    let list = filter === 'all'
      ? applications.filter((a) => a.status !== 'draft')
      : applications.filter((a) => a.status === filter)

    if (serviceFilter) list = list.filter((a) => a.service_title === serviceFilter)

    const term = debouncedSearch.toLowerCase()
    if (term) {
      list = list.filter((a) =>
        (a.service_title ?? '').toLowerCase().includes(term) ||
        a.id.toLowerCase().includes(term) ||
        matchedUserIds.has(a.user_id)
      )
    }

    return sortApplications(list, sort)
  }, [applications, filter, serviceFilter, debouncedSearch, matchedUserIds, sort])

  // Сброс на первую страницу при смене любого из фильтров/сортировки.
  useEffect(() => { setPage(0) }, [filter, serviceFilter, debouncedSearch, sort])

  const total = filteredSorted.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageItems = filteredSorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)
  const allOnPageSelected = pageItems.length > 0 && pageItems.every((a) => selected.includes(a.id))

  return (
    <div className="page-fade" style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          Заявки <span style={{ fontSize: 14, color: 'var(--color-text-3)', fontWeight: 500 }}>· {total}</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm"><I.Filter size={14} />Фильтры</button>
          <button className="btn btn-secondary btn-sm"><I.Download size={14} />Экспорт</button>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', padding: 3, borderRadius: 8, marginBottom: 16, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
        {FILTERS.map((t) => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={tabStyle(filter === t.id)}>
            {t.label}
            <span style={{ fontSize: 11, opacity: 0.7 }}>{statusCounts[t.id] ?? 0}</span>
          </button>
        ))}
        <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border)', margin: '3px 2px' }} />
        <button
          onClick={() => setFilter(DRAFT_FILTER.id)}
          title="Черновик — заявка ещё не подана заявителем"
          style={tabStyle(filter === DRAFT_FILTER.id)}
        >
          {DRAFT_FILTER.label}
          <span style={{ fontSize: 11, opacity: 0.7 }}>{statusCounts.draft ?? 0}</span>
        </button>
      </div>

      {/* Search + service filter + sort */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
          <I.Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)' }} />
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, ИИН заявителя, услуге или номеру заявки…"
            style={{ paddingLeft: 36, paddingRight: isUserSearchFetching ? 28 : undefined, width: '100%' }}
          />
          {isUserSearchFetching && (
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-text-3)' }}>…</span>
          )}
        </div>
        <select
          className="select"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          style={{ maxWidth: 260, flex: '1 1 200px', minWidth: 0 }}
        >
          <option value="">Все услуги</option>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{ maxWidth: 220, flex: '1 1 180px', minWidth: 0 }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
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
                  checked={allOnPageSelected}
                  onChange={(e) => {
                    const ids = pageItems.map((a) => a.id)
                    setSelected((arr) => e.target.checked
                      ? Array.from(new Set([...arr, ...ids]))
                      : arr.filter((id) => !ids.includes(id)))
                  }}
                  style={{ accentColor: 'var(--color-accent)' }} />
              </th>
              {['Номер', 'Услуга', 'Дата', 'Статус', 'Действия'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>
                {applications.length === 0 ? 'Заявок нет' : 'По заданным фильтрам ничего не найдено'}
              </td></tr>
            ) : pageItems.map((a) => {
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

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
          {total > 0 ? <>Показано {from}–{to} из {total}</> : '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <I.ChevronLeft size={14} /> Назад
          </button>
          <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{page + 1} / {pageCount}</span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд <I.ChevronRight size={14} />
          </button>
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
