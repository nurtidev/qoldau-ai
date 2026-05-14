import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { applicationsApi, documentsApi, mockApi } from '@/api/client'
import { I } from '@/components/icons'
import { useRef } from 'react'
import { useAuthStore } from '@/store/auth'
import { AlternativeRecommendations } from '@/components/AlternativeRecommendations'
import type { Application, Document, ApplicationStatus } from '@/types'
import { APPLICATION_STATUS_LABELS } from '@/types'

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  draft:     'badge badge-gray',
  submitted: 'badge badge-blue badge-dot',
  in_review: 'badge badge-amber badge-dot',
  approved:  'badge badge-green badge-dot',
  rejected:  'badge badge-red badge-dot',
}

function statusToStep(status: ApplicationStatus): number {
  if (status === 'submitted') return 1
  if (status === 'in_review') return 2
  if (status === 'approved' || status === 'rejected') return 4
  return 0
}

const FILE_EXT_RE = /\.(\w+)$/

function fileTypeBg(name: string) {
  const ext = (name.match(FILE_EXT_RE)?.[1] ?? '').toLowerCase()
  if (ext === 'pdf')  return { bg: '#FEE2E2', color: '#B91C1C', label: 'PDF'  }
  if (ext === 'xlsx') return { bg: '#D1FAE5', color: '#047857', label: 'XLSX' }
  if (ext === 'docx') return { bg: '#DBEAFE', color: '#1E40AF', label: 'DOCX' }
  return { bg: '#F3F4F6', color: '#4B5563', label: ext.toUpperCase() || 'FILE' }
}

export function ApplicationDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const fileRef   = useRef<HTMLInputElement>(null)
  const { user }  = useAuthStore()

  const { data: app } = useQuery<Application>({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: docs = [], refetch: refetchDocs } = useQuery<Document[]>({
    queryKey: ['documents', id],
    queryFn: () => documentsApi.list(id!).then(r => r.data),
    enabled: !!id,
  })

  const uploadDoc = useMutation({
    mutationFn: (file: File) => documentsApi.upload(id!, file),
    onSuccess: () => refetchDocs(),
  })

  const submitToEish = useMutation({
    mutationFn: () => mockApi.eishSubmit(id!),
    onSuccess: res => alert(`✅ ${res.data.message}\nID: ${res.data.external_id}`),
  })

  if (!app) return null

  const step = statusToStep(app.status)

  const timeline = [
    { n: 1, title: 'Заявка подана',          state: step >= 1 ? 'done' : 'pending',    date: new Date(app.created_at).toLocaleDateString('ru-KZ') },
    { n: 2, title: 'Документы проверены',    state: step >= 2 ? 'done' : 'pending',    date: '' },
    { n: 3, title: 'Рассмотрение комитетом', state: step >= 3 ? 'done' : step === 2 ? 'active' : 'pending', date: '' },
    { n: 4, title: app.status === 'rejected' ? 'Отказано' : 'Решение принято', state: step >= 4 ? (app.status === 'rejected' ? 'rejected' : 'done') : 'pending', date: step >= 4 ? new Date(app.updated_at).toLocaleDateString('ru-KZ') : '' },
  ]

  const formEntries = Object.entries(app.form_data).filter(([, v]) => v !== null && v !== '')

  return (
    <div className="container page-fade" style={{ paddingTop: 28, paddingBottom: 60, maxWidth: 900 }}>
      <Link to="/cabinet" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-3)', marginBottom: 20 }}>
        <I.ArrowLeft size={14} /> Мои заявки
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-3)', marginBottom: 6 }}>
                  #{app.id.slice(0, 8)}
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                  {app.service_title}
                </h1>
              </div>
              <span className={STATUS_BADGE[app.status]}>
                {APPLICATION_STATUS_LABELS[app.status]}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, color: 'var(--color-text-2)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <I.Calendar size={14} style={{ color: 'var(--color-text-3)', marginTop: 1, flexShrink: 0 }} />
                <span>Подана: <strong>{new Date(app.created_at).toLocaleDateString('ru-KZ')}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <I.Clock size={14} style={{ color: 'var(--color-text-3)', marginTop: 1, flexShrink: 0 }} />
                <span>Обновлена: <strong>{new Date(app.updated_at).toLocaleDateString('ru-KZ')}</strong></span>
              </div>
            </div>

            {app.status === 'approved' && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => submitToEish.mutate()}
                  disabled={submitToEish.isPending}
                  className="btn btn-primary"
                >
                  {submitToEish.isPending ? 'Отправка…' : <><I.Plane size={15} /> Отправить в ЕИШ (BPM)</>}
                </button>
              </div>
            )}

            {app.status === 'rejected' && (
              <div style={{
                marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)',
                fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55,
              }}>
                <strong style={{ color: 'var(--color-danger)' }}>Заявка отклонена.</strong>{' '}
                Ниже мы подобрали альтернативные программы на основе вашего профиля.
              </div>
            )}
          </div>

          {app.status === 'rejected' && user && (
            <AlternativeRecommendations
              iin={user.iin}
              excludeServiceId={app.service_id}
              rejectionReason={`Заявителю отказали по программе «${app.service_title}»`}
              title="Альтернативные программы для вас"
              subtitle="AI подобрал программы под ваш профиль и налоговую историю"
              autoRun
            />
          )}

          {/* Form data */}
          {formEntries.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', background: 'var(--color-surface-2)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Данные заявки
              </div>
              {formEntries.map(([key, val], i) => (
                <div key={key} style={{
                  display: 'grid', gridTemplateColumns: '180px 1fr',
                  padding: '10px 20px', fontSize: 13,
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <span style={{ color: 'var(--color-text-3)' }}>{key}</span>
                  <span style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>{String(val)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Documents */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Документы
              </span>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadDoc.isPending}
                className="btn btn-ghost btn-sm"
              >
                <I.Upload size={14} />
                {uploadDoc.isPending ? 'Загрузка…' : 'Прикрепить файл'}
              </button>
              <input
                ref={fileRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.xlsx,.docx,.jpg,.png"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) uploadDoc.mutate(file)
                  e.target.value = ''
                }}
              />
            </div>

            {docs.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: 14 }}>
                Документов нет
              </div>
            ) : (
              docs.map((doc, i) => {
                const ft = fileTypeBg(doc.name)
                return (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 20px', textDecoration: 'none',
                      borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: 36, height: 44, borderRadius: 5, flexShrink: 0,
                      background: ft.bg, color: ft.color,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                    }}>{ft.label}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
                        {doc.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                        {new Date(doc.created_at).toLocaleDateString('ru-KZ')}
                      </div>
                    </div>
                    <I.Download size={15} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
                  </a>
                )
              })
            )}
          </div>
        </div>

        {/* Sidebar — timeline */}
        <aside>
          <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>
              Статус обработки
            </div>

            <div style={{ position: 'relative', paddingLeft: 4 }}>
              <div style={{ position: 'absolute', left: 14, top: 14, bottom: 14, width: 2, background: 'var(--color-border)' }} />
              {timeline.map((t, i) => {
                const color = t.state === 'done'     ? 'var(--color-success)'
                            : t.state === 'active'   ? 'var(--color-accent)'
                            : t.state === 'rejected' ? 'var(--color-danger)'
                            : 'var(--color-border-strong)'
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, position: 'relative' }}>
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
                    <div style={{ paddingTop: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.3 }}>{t.title}</div>
                      {t.date && <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>{t.date}</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-border)', marginTop: 4 }}>
              <Link to="/cabinet" className="btn btn-secondary btn-block" style={{ fontSize: 13 }}>
                ← Вернуться к заявкам
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
