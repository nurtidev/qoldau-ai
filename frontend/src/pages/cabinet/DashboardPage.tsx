import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi, notificationsApi, documentsApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { I } from '@/components/icons'
import { useToast } from '@/components/Toast'
import type { Application, Notification, ApplicationStatus, Document } from '@/types'
import { APPLICATION_STATUS_LABELS } from '@/types'

type Section = 'apps' | 'notifs' | 'profile' | 'docs'
type AppFilter = 'all' | 'review' | 'docs' | 'approved' | 'rejected'

const STATUS_BADGE: Record<ApplicationStatus, { cls: string; label: string }> = {
  draft:          { cls: 'badge badge-gray',            label: 'Черновик'         },
  submitted:      { cls: 'badge badge-blue badge-dot',  label: 'Подана'           },
  in_review:      { cls: 'badge badge-amber badge-dot', label: 'На рассмотрении' },
  docs_requested: { cls: 'badge badge-amber badge-dot', label: 'Требуются данные' },
  approved:       { cls: 'badge badge-green badge-dot', label: 'Одобрена'         },
  rejected:       { cls: 'badge badge-red badge-dot',   label: 'Отклонена'        },
}

function statusToStep(status: ApplicationStatus): number {
  if (status === 'submitted')      return 1
  if (status === 'in_review')      return 2
  if (status === 'docs_requested') return 2
  if (status === 'approved')       return 4
  if (status === 'rejected')       return 4
  return 0
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function docTypeBadge(name: string): { label: string; bg: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf')  return { label: 'PDF',  bg: '#FEE2E2', color: '#B91C1C' }
  if (ext === 'xlsx' || ext === 'xls') return { label: 'XLSX', bg: '#D1FAE5', color: '#047857' }
  return { label: ext.toUpperCase() || 'DOC', bg: 'var(--color-primary-soft)', color: 'var(--color-primary-700)' }
}

function ApplicationDetailModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const step = statusToStep(app.status)
  const meta = STATUS_BADGE[app.status]

  const timeline = [
    { n: 1, title: 'Заявка подана',          state: step >= 1 ? 'done' : 'pending',    date: new Date(app.created_at).toLocaleDateString('ru-KZ') },
    { n: 2, title: 'Документы проверены',    state: step >= 2 ? 'done' : 'pending',    date: step >= 2 ? new Date(app.updated_at).toLocaleDateString('ru-KZ') : '' },
    { n: 3, title: 'Рассмотрение комитетом', state: step >= 3 ? 'done' : step === 2 ? 'active' : 'pending', date: '' },
    { n: 4, title: app.status === 'rejected' ? 'Отказано' : 'Решение принято', state: step >= 4 ? (app.status === 'rejected' ? 'rejected' : 'done') : 'pending', date: step >= 4 ? new Date(app.updated_at).toLocaleDateString('ru-KZ') : '' },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>{app.id}</div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{app.service_title}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }}>
            <I.X size={16} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            <span className={meta.cls}>{meta.label}</span>
            <span className="badge badge-gray">Подана {new Date(app.created_at).toLocaleDateString('ru-KZ')}</span>
          </div>

          <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', margin: 0, marginBottom: 16, fontWeight: 600 }}>
            Статус обработки
          </h4>

          <div style={{ position: 'relative', paddingLeft: 4 }}>
            <div style={{ position: 'absolute', left: 14, top: 14, bottom: 14, width: 2, background: 'var(--color-border)' }} />
            {timeline.map((t, i) => {
              const color = t.state === 'done'     ? 'var(--color-success)'
                          : t.state === 'active'   ? 'var(--color-accent)'
                          : t.state === 'rejected' ? 'var(--color-danger)'
                          : 'var(--color-border-strong)'
              return (
                <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16, position: 'relative' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: t.state === 'pending' ? '#fff' : color,
                    color:      t.state === 'pending' ? 'var(--color-text-3)' : '#fff',
                    border:     t.state === 'pending' ? '2px solid var(--color-border-strong)' : 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, flexShrink: 0, zIndex: 1,
                  }}>
                    {t.state === 'done'     && <I.Check size={13} strokeWidth={3} />}
                    {t.state === 'rejected' && <I.X size={13} strokeWidth={3} />}
                    {t.state === 'active'   && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'block' }} />}
                    {t.state === 'pending'  && t.n}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{t.title}</div>
                    {t.date && <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{t.date}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {(() => {
          const nextStep: Record<ApplicationStatus, string> = {
            draft:          'Завершите заполнение и отправьте заявку.',
            submitted:      'Ожидайте проверки документов — обычно 1–2 рабочих дня.',
            in_review:      'Заявка на рассмотрении у комитета. Решение принимается в течение 10 рабочих дней.',
            docs_requested: 'Администратор запросил дополнительные данные — откройте заявку и заполните этап 2.',
            approved:       'Поздравляем! Ожидайте звонка менеджера для подписания договора.',
            rejected:       'По этой заявке отказ. Вы можете подать повторно или выбрать другую программу.',
          }
          const isPositive = app.status === 'approved'
          const isNegative = app.status === 'rejected'
          const isDocsRequested = app.status === 'docs_requested'
          const bg = isPositive ? 'var(--color-success-soft)' : isNegative ? '#FEF2F2' : isDocsRequested ? 'var(--color-warning-soft)' : 'var(--color-info-soft)'
          const color = isPositive ? '#047857' : isNegative ? '#B91C1C' : isDocsRequested ? '#92400E' : 'var(--color-info)'
          return (
            <div style={{ margin: '0 24px 20px', padding: '12px 16px', background: bg, borderRadius: 8, fontSize: 13, color, lineHeight: 1.5 }}>
              <strong>Что делать сейчас:</strong> {nextStep[app.status]}
              {app.status === 'docs_requested' && (
                <div style={{ marginTop: 8 }}>
                  <Link to={`/cabinet/applications/${app.id}`} onClick={onClose} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    Заполнить данные этапа 2 →
                  </Link>
                </div>
              )}
              {app.status === 'rejected' && (
                <div style={{ marginTop: 8 }}>
                  <Link to="/services" onClick={onClose} style={{ color: 'var(--color-accent-text)', fontWeight: 500 }}>
                    Найти другую программу →
                  </Link>
                </div>
              )}
            </div>
          )
        })()}

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

export function CabinetDashboard() {
  const { user } = useAuthStore()
  const qc       = useQueryClient()
  const toast    = useToast()

  const [searchParams, setSearchParams] = useSearchParams()
  const initialSection = (searchParams.get('section') as Section) || 'apps'
  const [section, setSectionState] = useState<Section>(initialSection)
  const setSection = (s: Section) => {
    setSectionState(s)
    if (s === 'apps') searchParams.delete('section')
    else searchParams.set('section', s)
    setSearchParams(searchParams, { replace: true })
  }
  // Реакция на смену query-параметра извне (например, навигация из колокольчика)
  useEffect(() => {
    const q = (searchParams.get('section') as Section) || 'apps'
    if (q !== section) setSectionState(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  const [filter, setFilter]   = useState<AppFilter>('all')
  const [openApp, setOpenApp] = useState<Application | null>(null)

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.list().then(r => r.data),
  })

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then(r => r.data),
  })

  const { data: documents = [], isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => documentsApi.listAll().then(r => r.data ?? []),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unread = notifications.filter(n => !n.is_read).length

  const filterApp = (a: Application) => {
    if (filter === 'all')      return true
    if (filter === 'review')   return a.status === 'submitted' || a.status === 'in_review'
    if (filter === 'docs')     return a.status === 'docs_requested'
    if (filter === 'approved') return a.status === 'approved'
    if (filter === 'rejected') return a.status === 'rejected'
    return true
  }
  const filtered = applications.filter(filterApp)

  const filterTabs: { id: AppFilter; label: string; count: number }[] = [
    { id: 'all',      label: 'Все',              count: applications.length },
    { id: 'review',   label: 'На рассмотрении',  count: applications.filter(a => a.status === 'submitted' || a.status === 'in_review').length },
    { id: 'docs',     label: 'Требуются данные', count: applications.filter(a => a.status === 'docs_requested').length },
    { id: 'approved', label: 'Одобрено',          count: applications.filter(a => a.status === 'approved').length },
    { id: 'rejected', label: 'Отклонено',         count: applications.filter(a => a.status === 'rejected').length },
  ]

  const navItems: { id: Section; label: string; icon: keyof typeof I; count?: number }[] = [
    { id: 'apps',    label: 'Мои заявки',  icon: 'Document', count: applications.length },
    { id: 'notifs',  label: 'Уведомления', icon: 'Bell',     count: unread || undefined },
    { id: 'profile', label: 'Профиль',     icon: 'User' },
    { id: 'docs',    label: 'Документы',   icon: 'Briefcase' },
  ]

  return (
    <div className="container page-fade" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <nav style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 12 }}>
        <Link to="/" style={{ color: 'var(--color-text-3)' }}>Главная</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--color-text-2)' }}>Личный кабинет</span>
      </nav>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, marginBottom: 24 }}>
        Личный кабинет
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28 }}>
        {/* Sidebar */}
        <aside className="card" style={{ padding: 20, position: 'sticky', top: 80, alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--color-border)', marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--color-primary)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 15, flexShrink: 0,
            }}>
              {user ? initials(user.full_name) : '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name}
              </div>
              {user?.org_name && (
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.org_name}
                </div>
              )}
            </div>
          </div>

          {navItems.map(it => {
            const Ic = I[it.icon]
            const isActive = section === it.id
            return (
              <button
                key={it.id}
                onClick={() => setSection(it.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-2)',
                  borderRadius: 6, fontSize: 14, fontWeight: 500, marginBottom: 2,
                  transition: 'background 120ms',
                }}
              >
                <Ic size={17} />
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {it.count !== undefined && it.count > 0 && (
                  <span style={{
                    minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999,
                    background: isActive ? 'var(--color-primary)' : 'var(--color-surface-2)',
                    color: isActive ? '#fff' : 'var(--color-text-3)',
                    fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{it.count}</span>
                )}
              </button>
            )
          })}
        </aside>

        <main>
          {/* Мои заявки */}
          {section === 'apps' && (
            <div className="page-fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', padding: 3, borderRadius: 8 }}>
                  {filterTabs.map(t => (
                    <button key={t.id} onClick={() => setFilter(t.id)} style={{
                      padding: '6px 12px', height: 32, border: 'none', borderRadius: 6,
                      background: filter === t.id ? '#fff' : 'transparent',
                      color: filter === t.id ? 'var(--color-text)' : 'var(--color-text-3)',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      boxShadow: filter === t.id ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {t.label}
                      <span style={{ fontSize: 11, color: filter === t.id ? 'var(--color-text-3)' : 'var(--color-text-4)' }}>
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>
                <Link to="/services" className="btn btn-primary">
                  <I.Plus size={15} /> Подать новую заявку
                </Link>
              </div>

              {filtered.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--color-primary)' }}>
                    <I.Document size={28} />
                  </div>
                  {filter === 'all' ? (
                    <>
                      <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Вы ещё не подавали заявки</h3>
                      <p style={{ fontSize: 14, color: 'var(--color-text-3)', margin: '0 auto 24px', maxWidth: 340 }}>
                        Узнайте, какие программы государственной поддержки вам подходят — это займёт 2 минуты
                      </p>
                      <Link to="/services" className="btn btn-primary">
                        Найти программу <I.ArrowRight size={15} />
                      </Link>
                    </>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>В этой категории пока нет заявок</h3>
                      <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0 }}>Попробуйте другой фильтр</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-2)' }}>
                        {['Номер', 'Услуга', 'Дата', 'Статус', ''].map((h, i) => (
                          <th key={i} style={{
                            padding: '10px 16px', textAlign: 'left',
                            fontSize: 11, fontWeight: 600,
                            color: 'var(--color-text-3)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(app => {
                        const meta = STATUS_BADGE[app.status]
                        return (
                          <tr
                            key={app.id}
                            style={{ borderTop: '1px solid var(--color-border)', cursor: 'pointer' }}
                            onClick={() => setOpenApp(app)}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-2)' }}>
                              {app.id.slice(0, 8)}…
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 2 }}>
                                {app.service_title}
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>
                              {new Date(app.created_at).toLocaleDateString('ru-KZ')}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span className={meta.cls}>{meta.label}</span>
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                              <I.ChevronRight size={16} style={{ color: 'var(--color-text-3)' }} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Уведомления */}
          {section === 'notifs' && (
            <div className="page-fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Уведомления</h2>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toast.push('Все уведомления отмечены прочитанными', 'success')}
                >
                  Прочитать все
                </button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-text-3)' }}>
                      <I.Bell size={24} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Уведомлений пока нет</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: '0 auto 20px', maxWidth: 300, lineHeight: 1.5 }}>
                      Здесь будут обновления по вашим заявкам — подайте первую и мы будем держать вас в курсе
                    </p>
                    <Link to="/services" className="btn btn-secondary btn-sm">
                      Подать заявку
                    </Link>
                  </div>
                ) : (
                  notifications.map((n, i) => {
                    const Ic = I.Info
                    return (
                      <div
                        key={n.id}
                        onClick={() => !n.is_read && markRead.mutate(n.id)}
                        style={{
                          padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start',
                          borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                          background: n.is_read ? 'transparent' : 'rgba(7,102,61,0.04)',
                          cursor: n.is_read ? 'default' : 'pointer',
                        }}
                      >
                        <Ic size={20} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: n.is_read ? 400 : 500, color: 'var(--color-text)' }}>
                            {n.title}
                          </div>
                          {n.message && (
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{n.message}</div>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                            {new Date(n.created_at).toLocaleDateString('ru-KZ')}
                          </div>
                        </div>
                        {!n.is_read && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', marginTop: 8, flexShrink: 0 }} />
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Профиль */}
          {section === 'profile' && (
            <div className="page-fade">
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 20 }}>Профиль</h2>
              <div className="card" style={{ padding: 28 }}>
                <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', margin: 0, marginBottom: 16, fontWeight: 600 }}>
                  Личные данные
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 14, columnGap: 24, fontSize: 14, marginBottom: 28 }}>
                  <span style={{ color: 'var(--color-text-3)' }}>ФИО</span>
                  <span>{user?.full_name || '—'}</span>
                  <span style={{ color: 'var(--color-text-3)' }}>ИИН</span>
                  <span style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>{user?.iin || '—'}</span>
                  <span style={{ color: 'var(--color-text-3)' }}>Телефон</span>
                  <span style={{ color: 'var(--color-text-3)' }}>—</span>
                  <span style={{ color: 'var(--color-text-3)' }}>Email</span>
                  <span style={{ color: 'var(--color-text-3)' }}>—</span>
                </div>
                {user?.org_name && (
                  <>
                    <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', margin: 0, marginBottom: 16, fontWeight: 600 }}>
                      Компания
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 14, columnGap: 24, fontSize: 14, marginBottom: 24 }}>
                      <span style={{ color: 'var(--color-text-3)' }}>Наименование</span>
                      <span>{user.org_name}</span>
                      <span style={{ color: 'var(--color-text-3)' }}>БИН</span>
                      <span style={{ color: 'var(--color-text-3)' }}>—</span>
                      <span style={{ color: 'var(--color-text-3)' }}>Регион</span>
                      <span style={{ color: 'var(--color-text-3)' }}>—</span>
                    </div>
                  </>
                )}
                <button className="btn btn-secondary">
                  <I.Document size={15} /> Редактировать профиль
                </button>
              </div>
            </div>
          )}

          {/* Документы */}
          {section === 'docs' && (
            <div className="page-fade">
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 20 }}>Мои документы</h2>
              {!docsLoading && documents.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--color-primary)' }}>
                    <I.Briefcase size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Документов пока нет</h3>
                  <p style={{ fontSize: 14, color: 'var(--color-text-3)', margin: '0 auto 24px', maxWidth: 360, lineHeight: 1.55 }}>
                    Документы, которые вы загрузите при подаче заявки, сохранятся здесь — не придётся загружать повторно
                  </p>
                  <Link to="/services" className="btn btn-primary">
                    Подать первую заявку <I.ArrowRight size={15} />
                  </Link>
                </div>
              ) : docsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />)}
                </div>
              ) : (
                <div className="card" style={{ padding: 0 }}>
                  {documents.map((d, i) => {
                    const badge = docTypeBadge(d.name)
                    const date  = new Date(d.created_at).toLocaleDateString('ru-KZ', { day: 'numeric', month: 'short', year: 'numeric' })
                    return (
                      <div key={d.id} style={{
                        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
                        borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                      }}>
                        <div style={{
                          width: 38, height: 46, borderRadius: 5, flexShrink: 0,
                          background: badge.bg, color: badge.color,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                        }}>{badge.label}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{date}</div>
                        </div>
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                          <I.Download size={15} />
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {openApp && <ApplicationDetailModal app={openApp} onClose={() => setOpenApp(null)} />}
    </div>
  )
}
