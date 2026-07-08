import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi, documentsApi, mockApi, servicesApi, type ECPSignature } from '@/api/client'
import { I } from '@/components/icons'
import { useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/components/Toast'
import { FormRenderer } from '@/components/FormRenderer'
import { AlternativeRecommendations } from '@/components/AlternativeRecommendations'
import { PrescoreCard, type PrescoreCardResult } from '@/components/PrescoreCard'
import { SlaBadge } from '@/components/SlaBadge'
import { ECPSignModal } from '@/components/ECPSignModal'
import { getSlaInfo } from '@/lib/sla'
import type { Application, Document, ApplicationStatus, Service } from '@/types'
import { APPLICATION_STATUS_LABELS } from '@/types'

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  draft:          'badge badge-gray',
  submitted:      'badge badge-blue badge-dot',
  in_review:      'badge badge-amber badge-dot',
  docs_requested: 'badge badge-amber badge-dot',
  approved:       'badge badge-green badge-dot',
  rejected:       'badge badge-red badge-dot',
}

type TLState = 'done' | 'active' | 'warning' | 'rejected' | 'pending'
interface TimelineNode { title: string; state: TLState; date?: string }

// Builds a status timeline that grows a "Дозапрос данных" node for two-stage
// applications (status docs_requested or already resubmitted at stage 2).
function buildTimeline(app: Application): TimelineNode[] {
  const created = new Date(app.created_at).toLocaleDateString('ru-KZ')
  const updated = new Date(app.updated_at).toLocaleDateString('ru-KZ')
  const st = app.status
  const twoStage = st === 'docs_requested' || app.stage === 2
  const final = st === 'approved' || st === 'rejected'

  const nodes: TimelineNode[] = [
    { title: 'Заявка подана',       state: 'done', date: created },
    { title: 'Документы проверены', state: st === 'submitted' ? 'pending' : 'done' },
  ]

  if (twoStage) {
    nodes.push({
      title: 'Дозапрос данных',
      state: st === 'docs_requested' ? 'warning' : 'done',
      date:  st === 'docs_requested' ? updated : '',
    })
  }

  nodes.push({
    title: 'Рассмотрение комитетом',
    state: final ? 'done' : st === 'in_review' ? 'active' : 'pending',
  })
  nodes.push({
    title: st === 'rejected' ? 'Отказано' : 'Решение принято',
    state: final ? (st === 'rejected' ? 'rejected' : 'done') : 'pending',
    date:  final ? updated : '',
  })

  return nodes
}

const FILE_EXT_RE = /\.(\w+)$/

function fileTypeBg(name: string) {
  const ext = (name.match(FILE_EXT_RE)?.[1] ?? '').toLowerCase()
  if (ext === 'pdf')  return { bg: '#FEE2E2', color: '#B91C1C', label: 'PDF'  }
  if (ext === 'xlsx') return { bg: '#D1FAE5', color: '#047857', label: 'XLSX' }
  if (ext === 'docx') return { bg: 'var(--color-primary-soft)', color: 'var(--color-primary-700)', label: 'DOCX' }
  return { bg: '#F3F4F6', color: '#4B5563', label: ext.toUpperCase() || 'FILE' }
}

export function ApplicationDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const fileRef   = useRef<HTMLInputElement>(null)
  const { user }  = useAuthStore()
  const qc        = useQueryClient()
  const toast     = useToast()

  const [stage2Open, setStage2Open]           = useState(false)
  const [stage2Submitting, setStage2Submitting] = useState(false)
  const [signModalOpen, setSignModalOpen]     = useState(false)
  const [pendingStage2Data, setPendingStage2Data] = useState<Record<string, unknown> | null>(null)

  const { data: app } = useQuery<Application>({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  // Service form_schema — needed to render the stage-2 (follow-up) steps.
  const { data: service } = useQuery<Service>({
    queryKey: ['service', app?.service_id],
    queryFn: () => servicesApi.get(app!.service_id).then(r => r.data),
    enabled: !!app?.service_id && app?.status === 'docs_requested',
  })

  const { data: docs = [], refetch: refetchDocs } = useQuery<Document[]>({
    queryKey: ['documents', id],
    queryFn: () => documentsApi.list(id!).then(r => r.data ?? []),
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

  const timeline = buildTimeline(app)
  const stage2Steps = service?.form_schema?.steps?.filter(s => s.stage === 2) ?? []

  // FormRenderer вызывает onSubmit после валидации — перед реальной отправкой
  // этапа 2 требуем подписание ЭЦП, как и на этапе 1 (см. ApplyPage).
  const handleStage2FormSubmit = (formData: Record<string, unknown>) => {
    setPendingStage2Data(formData)
    setSignModalOpen(true)
  }

  const handleStage2SignCancel = () => {
    setSignModalOpen(false)
    setPendingStage2Data(null)
  }

  const handleStage2Signed = async (signature: ECPSignature) => {
    setSignModalOpen(false)
    const formData = pendingStage2Data
    setPendingStage2Data(null)
    if (!formData) return

    setStage2Submitting(true)
    try {
      // Separate File objects — they are uploaded, JSONB keeps the file name.
      const files: File[] = []
      const clean: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(formData)) {
        if (val instanceof File) { files.push(val); clean[key] = val.name }
        else clean[key] = val
      }
      clean._signature_stage2 = signature
      for (const file of files) await documentsApi.upload(id!, file)
      await applicationsApi.submitStage2(id!, clean)

      qc.invalidateQueries({ queryKey: ['application', id] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['documents', id] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.push('Данные отправлены на рассмотрение', 'success')
      setStage2Open(false)
    } catch {
      toast.push('Ошибка при отправке данных. Попробуйте снова.', 'error')
    } finally {
      setStage2Submitting(false)
    }
  }

  // Служебные ключи (начинаются с _) не показываем как поля формы.
  const formEntries = Object.entries(app.form_data)
    .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== '')
  const prescore = app.form_data._prescore as PrescoreCardResult | undefined
  // Снимки подписи ЭЦП (мок NCALayer) — могут отсутствовать у старых заявок.
  const signature1 = app.form_data._signature as ECPSignature | undefined
  const signature2 = app.form_data._signature_stage2 as ECPSignature | undefined

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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className={STATUS_BADGE[app.status]}>
                  {APPLICATION_STATUS_LABELS[app.status]}
                </span>
                <SlaBadge app={app} />
              </div>
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

          {/* Two-stage: admin requested additional data */}
          {app.status === 'docs_requested' && (
            <div className="card" style={{
              padding: 24, border: '1px solid var(--color-warning)',
              background: 'var(--color-warning-soft)',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <I.Alert size={20} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#92400E' }}>
                    Требуются дополнительные данные
                  </h3>
                  {app.request_message && (
                    <p style={{ fontSize: 14, color: 'var(--color-text-2)', margin: '8px 0 0', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                      {app.request_message}
                    </p>
                  )}
                  {(() => {
                    const sla = getSlaInfo(app)
                    if (!sla) return null
                    const overdue = sla.state === 'overdue'
                    return (
                      <p style={{
                        fontSize: 13, fontWeight: 600, margin: '10px 0 0',
                        color: overdue ? 'var(--color-danger)' : '#92400E',
                      }}>
                        {overdue ? 'Срок дозагрузки документов истёк — ' : 'Досдайте документы до '}
                        {sla.deadline.toLocaleDateString('ru-KZ')}
                      </p>
                    )
                  })()}
                  {!stage2Open && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 14 }}
                      onClick={() => setStage2Open(true)}
                      disabled={stage2Steps.length === 0}
                    >
                      <I.Upload size={15} /> Заполнить данные этапа 2
                    </button>
                  )}
                </div>
              </div>

              {stage2Open && (
                <div className="card" style={{ padding: 24, marginTop: 16, background: '#fff' }}>
                  {stage2Steps.length > 0 ? (
                    <FormRenderer
                      schema={{ steps: stage2Steps }}
                      initialData={app.form_data}
                      onSubmit={handleStage2FormSubmit}
                      submitting={stage2Submitting}
                    />
                  ) : (
                    <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
                  )}
                </div>
              )}
            </div>
          )}

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

          {/* Предварительная оценка заявителя (снимок на момент подачи) */}
          {prescore && <PrescoreCard result={prescore} compact />}

          {/* Снимки подписи ЭЦП (мок NCALayer/НУЦ РК) */}
          {(signature1 || signature2) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {signature1 && <SignatureBadge signature={signature1} label="Этап 1 подписан ЭЦП" />}
              {signature2 && <SignatureBadge signature={signature2} label="Этап 2 подписан ЭЦП" />}
            </div>
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
                            : t.state === 'warning'  ? 'var(--color-warning)'
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
                      {t.state === 'warning'  && <I.Alert size={13} />}
                      {t.state === 'active'   && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'block' }} />}
                      {t.state === 'pending'  && (i + 1)}
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

      <ECPSignModal
        open={signModalOpen}
        iin={user?.iin ?? ''}
        fullName={user?.full_name}
        onSigned={handleStage2Signed}
        onCancel={handleStage2SignCancel}
      />
    </div>
  )
}

// ── SignatureBadge ────────────────────────────────────────────────────────────
// Компактный бейдж со снимком подписи ЭЦП (мок NCALayer/НУЦ РК) — form_data
// может не содержать этих ключей у заявок, поданных до внедрения подписания.

function SignatureBadge({ signature, label }: { signature: ECPSignature; label: string }) {
  return (
    <div className="card" style={{
      padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12,
      background: 'var(--color-success-soft)', border: '1px solid #A7F3D0',
    }}>
      <I.Shield size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13, color: '#065F46', lineHeight: 1.55 }}>
        <strong>{label}</strong>
        <div style={{ marginTop: 2 }}>
          № подписи: <strong>{signature.signature_id}</strong> · Владелец: <strong>{signature.cert_owner}</strong>
        </div>
        <div style={{ color: 'var(--color-text-3)', marginTop: 2 }}>
          {new Date(signature.signed_at).toLocaleString('ru-KZ')} · {signature.algorithm}
        </div>
      </div>
    </div>
  )
}
