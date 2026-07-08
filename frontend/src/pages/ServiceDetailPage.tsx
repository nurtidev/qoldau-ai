import { useState, useMemo, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi, funnelApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { I } from '@/components/icons'
import { ServiceCalculator } from '@/components/ServiceCalculator'
import { useIsNarrow } from '@/hooks/useMediaQuery'
import { categoryColor } from '@/lib/categoryColor'
import { CategoryArt } from '@/components/CategoryArt'
import { ServiceExplainer } from '@/components/ServiceExplainer'
import type { Service, FormField } from '@/types'

const PORTAL_FAQ = [
  { q: 'Как авторизоваться для подачи заявки?',  a: 'Используйте ИИН или БИН через eGov — кнопка «Войти» в верхнем меню. Регистрация не требуется.' },
  { q: 'Как узнать статус заявки?',              a: 'Статус отображается в личном кабинете в разделе «Мои заявки» сразу после подачи.' },
  { q: 'Нужна ли ЭЦП для подачи заявки?',       a: 'Для входа на портал ЭЦП не требуется — достаточно ИИН/БИН через eGov. Условия конкретной программы уточняйте у организации.' },
]

const BASE_TABS = [
  { id: 'desc', label: 'Описание' },
  { id: 'cond', label: 'Условия' },
  { id: 'docs', label: 'Документы' },
  { id: 'how',  label: 'Как подать' },
]

type IconName = keyof typeof I

function formatAmount(v: number): string {
  if (v >= 1_000_000_000) {
    const n = v / 1_000_000_000
    return `${n % 1 === 0 ? n : n.toFixed(1)} млрд ₸`
  }
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)} млн ₸`
  if (v >= 1_000)     return `${Math.round(v / 1_000)} тыс ₸`
  return `${v} ₸`
}

function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div style={{
      display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 32,
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
          color: active === t.id ? 'var(--color-primary)' : 'var(--color-text-3)',
          borderBottom: active === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
          marginBottom: -1, transition: 'color 120ms',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

const ORG_COLORS = ['var(--color-primary)', '#176D62', '#1F6B3B', '#705C33', '#0A4F3A', '#6E4A24']

function OrgBadge({ orgName, size = 'md' }: { orgName: string; size?: 'sm' | 'md' | 'lg' }) {
  const words = orgName.split(/\s+/).filter(Boolean)
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : orgName.slice(0, 2).toUpperCase()
  const colorIdx = orgName.charCodeAt(0) % ORG_COLORS.length
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : 36
  const fz  = size === 'sm' ? 10 : size === 'lg' ? 16 : 13
  return (
    <div style={{
      width: dim, height: dim, borderRadius: 8,
      background: ORG_COLORS[colorIdx], color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: fz, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function fileTypeBadge(accept?: string): { label: string; bg: string; color: string } {
  const first = (accept || '').split(',')[0].replace('.', '').trim().toUpperCase() || 'FILE'
  const bg    = first === 'PDF' ? '#FEE2E2' : first.includes('XLS') ? '#D1FAE5' : 'var(--color-primary-soft)'
  const color = first === 'PDF' ? '#B91C1C' : first.includes('XLS') ? '#047857' : 'var(--color-primary-700)'
  return { label: first, bg, color }
}

function ReadinessWidget({ user, fileFields, serviceId }: {
  user: { full_name: string; org_name?: string } | null
  fileFields: FormField[]
  serviceId: string
}) {
  const items = [
    { label: 'ИИН подтверждён',                done: !!user },
    { label: 'Данные организации загружены из eGov', done: !!(user?.org_name) },
    ...fileFields.slice(0, 2).map(f => ({ label: f.label, done: false })),
  ]
  const doneCount = items.filter(i => i.done).length
  const pct = Math.round((doneCount / items.length) * 100)
  const isHigh = pct >= 75

  return (
    <div className="card card-elevated" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Готовность к подаче</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: isHigh ? 'var(--color-success)' : 'var(--color-accent)' }}>
          {pct}%
        </div>
      </div>

      <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 999,
          background: isHigh ? 'var(--color-success)' : 'var(--color-accent)',
          transition: 'width 600ms ease',
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: item.done ? 'var(--color-success-soft)' : 'var(--color-surface-2)',
              color: item.done ? 'var(--color-success)' : 'var(--color-text-3)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {item.done
                ? <I.Check size={11} strokeWidth={3} />
                : <I.X size={11} strokeWidth={2.5} />
              }
            </div>
            <span style={{ color: item.done ? 'var(--color-text-2)' : 'var(--color-text-3)', lineHeight: 1.4 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {user ? (
        <Link to={`/cabinet/apply/${serviceId}`} className="btn btn-primary btn-lg btn-block">
          Подать заявку <I.ArrowRight size={16} />
        </Link>
      ) : (
        <Link to="/login" className="btn btn-primary btn-lg btn-block">
          Войти и проверить готовность <I.ArrowRight size={16} />
        </Link>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 14, padding: '10px 12px',
        background: 'var(--color-success-soft)', borderRadius: 8,
      }}>
        <I.Lock size={14} style={{ color: 'var(--color-success)' }} />
        <span style={{ fontSize: 12, color: '#047857' }}>Защищённое подключение через eGov</span>
      </div>
    </div>
  )
}

function EmptySchemaInfo() {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-3)', fontSize: 14 }}>
      Информация уточняется
    </div>
  )
}

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const isNarrow = useIsNarrow()
  const [tab, setTab]               = useState('desc')
  const [bookmarked, setBookmarked] = useState(false)
  const [openFaq, setOpenFaq]       = useState(-1)

  const { data: service, isLoading } = useQuery<Service>({
    queryKey: ['service', id],
    queryFn: () => servicesApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  // Funnel analytics: log the card view exactly once per service mount.
  // Fire-and-forget — failure must not affect page rendering.
  useEffect(() => {
    if (!id) return
    funnelApi.logView(id).catch(() => {})
  }, [id])

  const { data: allServices = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then(r => r.data),
    enabled: !!service,
  })

  const allFields = useMemo(
    () => service?.form_schema?.steps?.flatMap(s => s.fields) ?? [],
    [service]
  )

  // Калькулятор — фишка no-code конструктора: если в схеме есть хотя бы одно
  // calculated-поле, на витрине сам собой появляется интерактивный виджет.
  const hasCalculator = useMemo(() => allFields.some(f => f.type === 'calculated'), [allFields])

  const tabs = useMemo(() => {
    if (!hasCalculator) return BASE_TABS
    const withCalc = [...BASE_TABS]
    withCalc.splice(2, 0, { id: 'calc', label: 'Калькулятор' })
    return withCalc
  }, [hasCalculator])

  // Если переключились на услугу без калькулятора, находясь на его вкладке — вернёмся к описанию.
  useEffect(() => {
    if (tab === 'calc' && !hasCalculator) setTab('desc')
  }, [tab, hasCalculator])

  const benefits = useMemo(() => {
    const b: string[] = ['Онлайн-подача заявки']
    if (allFields.some(f => f.prefill_from)) b.push('Автозаполнение данных из eGov')
    if (allFields.some(f => f.type === 'calculated')) b.push('Автоматический расчёт платежей')
    if (allFields.some(f => f.type === 'file')) b.push('Загрузка документов онлайн')
    if ((service?.form_schema?.steps?.length ?? 0) > 1) b.push('Пошаговое заполнение формы')
    return b
  }, [allFields, service])

  const requirements = useMemo(() => {
    if (!service?.form_schema?.steps?.length) return []
    return service.form_schema.steps[0].fields
      .filter(f => (f.type === 'select' || f.type === 'radio') && f.options?.length)
      .map(f => `${f.label}: ${f.options!.join(', ')}`)
  }, [service])

  if (isLoading) {
    return (
      <div className="container page-fade" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="skeleton" style={{ height: 14, width: 220, marginBottom: 24, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 38, width: '60%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 100, marginBottom: 32 }} />
        <div className="two-col-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32 }}>
          <div className="skeleton" style={{ height: 420 }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      </div>
    )
  }

  if (!service) return null

  const relatedServices = allServices
    .filter(s => s.id !== service.id && s.category === service.category && s.status === 'published')
    .slice(0, 3)

  const updatedDate = new Date(service.created_at).toLocaleDateString('ru-KZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const keyParams: { l: string; v: string; icon: IconName }[] = [
    { l: 'Сумма финансирования',
      v: service.max_amount != null ? `до ${formatAmount(service.max_amount)}` : 'По договору',
      icon: 'Coins' },
    { l: 'Процентная ставка',
      v: service.interest_rate != null ? `от ${String(service.interest_rate).replace('.', ',')}%` : 'По договору',
      icon: 'Hash' },
    { l: 'Срок',
      v: service.max_term_months != null ? `до ${service.max_term_months} мес.` : 'По договору',
      icon: 'Clock' },
    { l: 'Срок рассмотрения',    v: '10 раб. дней', icon: 'Calendar' },
  ]

  const hasSteps = service.form_schema?.steps?.length > 0

  const fileFields: FormField[] = hasSteps
    ? service.form_schema.steps.flatMap(step => step.fields.filter(f => f.type === 'file'))
    : []

  const formSteps = hasSteps ? service.form_schema.steps : []

  return (
    <div className="container page-fade" style={{ paddingTop: 24, paddingBottom: 40 }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 16 }}>
        <Link to="/" style={{ color: 'var(--color-text-3)' }}>Главная</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <Link to="/services" style={{ color: 'var(--color-text-3)' }}>Услуги</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--color-text-2)' }}>{service.title}</span>
      </nav>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {service.org_name && <OrgBadge orgName={service.org_name} />}
            <span className="badge badge-green badge-dot">Действующая программа</span>
            <span className="badge badge-gray">Обновлено {updatedDate}</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2, maxWidth: 720 }}>
            {service.title}
          </h1>
          {service.description && (
            <p style={{ fontSize: 16, color: 'var(--color-text-2)', marginTop: 12, marginBottom: 0, lineHeight: 1.55, maxWidth: 720 }}>
              {service.description}
            </p>
          )}
        </div>
        {/* Брендовая декоративная панель — только на широких экранах (.detail-art) */}
        <div className="detail-art" style={{
          width: 200, height: 120, borderRadius: 14, overflow: 'hidden',
          flexShrink: 0, border: '1px solid var(--color-border)',
        }}>
          <CategoryArt category={service.category} height={120} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={() => setBookmarked(!bookmarked)}>
            <I.Star size={16} style={{ color: bookmarked ? 'var(--color-accent)' : undefined }} />
            {bookmarked ? 'В избранном' : 'В избранное'}
          </button>
          <button className="btn btn-secondary"><I.ExternalLink size={16} /></button>
        </div>
      </div>

      {/* Key params bar — top edge carries the category accent */}
      <div className="card card-elevated" style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        padding: 0, marginBottom: 32, overflow: 'hidden',
        borderTop: `3px solid ${categoryColor(service.category)}`,
      }}>
        {keyParams.map((k, i) => {
          const Ic = I[k.icon]
          const borderRight = isNarrow ? i % 2 === 0 : i < 3
          const borderBottom = isNarrow && i < 2
          return (
            <div key={i} style={{
              padding: isNarrow ? '16px' : '20px 24px',
              borderRight: borderRight ? '1px solid var(--color-border)' : 'none',
              borderBottom: borderBottom ? '1px solid var(--color-border)' : 'none',
              display: 'flex', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Ic size={18} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 2 }}>{k.l}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>{k.v}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Two-column layout */}
      <div className="two-col-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32 }}>
        <main>
          <TabBar tabs={tabs} active={tab} onChange={setTab} />

          {/* Описание */}
          {tab === 'desc' && (
            <div className="page-fade">
              <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>О программе</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-2)', marginTop: 0 }}>
                {service.description ||
                  'Программа направлена на поддержку субъектов малого и среднего предпринимательства Республики Казахстан, реализующих проекты в приоритетных секторах экономики. Финансирование предоставляется на расширение деятельности, пополнение оборотных средств и приобретение основных средств.'}
              </p>

              <div style={{
                background: 'var(--color-info-soft)', border: '1px solid #BAE6FD',
                borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12,
                marginTop: 24, marginBottom: 32,
              }}>
                <I.Info size={20} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 14, color: '#0C4A6E', lineHeight: 1.55 }}>
                  Заявки принимаются круглосуточно. Решение по заявке принимается в течение 10 рабочих дней с момента подачи полного пакета документов.
                </div>
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>Ключевые преимущества</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 32 }}>
                {benefits.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
                    <I.Check size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} strokeWidth={2.5} />
                    <span style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.45 }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Условия */}
          {tab === 'cond' && (
            <div className="page-fade">
              <ServiceExplainer key={service.id} serviceId={service.id} />
              <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Критерии участия</h2>
              {requirements.length === 0 ? (
                <EmptySchemaInfo />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                  {requirements.map((r, i) => (
                    <div key={i} className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--color-success-soft)', color: 'var(--color-success)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <I.Check size={13} strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.5, paddingTop: 1 }}>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Калькулятор — авто-собран из calculated-полей конструктора */}
          {tab === 'calc' && hasCalculator && (
            <div className="page-fade">
              <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 8 }}>Калькулятор</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
                Расчёт формируется автоматически из конструктора формы.
              </p>
              <div style={{ marginBottom: 32 }}>
                <ServiceCalculator key={service.id} schema={service.form_schema} />
              </div>
            </div>
          )}

          {/* Документы — динамически из form_schema */}
          {tab === 'docs' && (
            <div className="page-fade">
              <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Необходимые документы</h2>
              {fileFields.length === 0 ? (
                <EmptySchemaInfo />
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {fileFields.map((f, i) => {
                    const badge = fileTypeBadge(f.accept)
                    return (
                      <div key={f.id} style={{
                        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                        borderBottom: i < fileFields.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}>
                        <div style={{
                          width: 40, height: 48, borderRadius: 6,
                          background: badge.bg, color: badge.color,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                        }}>{badge.label}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{f.label}</div>
                          {f.accept && (
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{f.accept}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Как подать — шаги из form_schema */}
          {tab === 'how' && (
            <div className="page-fade">
              <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 24 }}>Процесс подачи заявки</h2>
              {formSteps.length === 0 ? (
                <EmptySchemaInfo />
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 18, top: 18, bottom: 18, width: 2, background: 'var(--color-border)' }} />
                  {formSteps.map((st, i) => (
                    <div key={st.id} style={{ display: 'flex', gap: 16, marginBottom: 20, position: 'relative' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: i === 0 ? 'var(--color-primary)' : '#fff',
                        color:      i === 0 ? '#fff' : 'var(--color-text-2)',
                        border: '2px solid ' + (i === 0 ? 'var(--color-primary)' : 'var(--color-border-strong)'),
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, flexShrink: 0, zIndex: 1,
                      }}>{i + 1}</div>
                      <div className="card" style={{ flex: 1, padding: '14px 18px' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{st.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 4 }}>
                          {st.fields.length} {st.fields.length === 1 ? 'поле' : st.fields.length < 5 ? 'поля' : 'полей'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FAQ */}
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Часто задаваемые вопросы</h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {PORTAL_FAQ.map((f, i) => (
                <div key={i} style={{ borderBottom: i < PORTAL_FAQ.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    style={{
                      width: '100%', padding: '16px 20px', background: 'none', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{f.q}</span>
                    <I.ChevronDown
                      size={16}
                      style={{
                        transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 200ms',
                        color: 'var(--color-text-3)', flexShrink: 0,
                      }}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="page-fade" style={{ padding: '0 20px 20px', fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Sticky sidebar */}
        <aside>
          <div style={{ position: isNarrow ? 'static' : 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ReadinessWidget user={user} fileFields={fileFields} serviceId={service.id} />

            {/* Org */}
            {service.org_name && (
              <div className="card card-elevated" style={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Организация
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <OrgBadge orgName={service.org_name} size="lg" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{service.org_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Дочерняя организация Холдинга «Байтерек»</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--color-text-2)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <I.Phone size={14} style={{ color: 'var(--color-text-3)' }} />+7 (7172) 79-70-70
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <I.Mail size={14} style={{ color: 'var(--color-text-3)' }} />info@organization.kz
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <I.MapPin size={14} style={{ color: 'var(--color-text-3)', marginTop: 2 }} />
                    г. Астана, пр. Мангилик Ел, 55А
                  </div>
                </div>
              </div>
            )}

            {/* Related services */}
            {relatedServices.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Похожие услуги
                </div>
                {relatedServices.map(rs => (
                  <Link key={rs.id} to={`/services/${rs.id}`} style={{
                    display: 'block', padding: '12px 0',
                    borderTop: '1px solid var(--color-border)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 4, color: 'var(--color-text)' }}>
                      {rs.title}
                    </div>
                    {rs.org_name && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{rs.org_name}</div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
