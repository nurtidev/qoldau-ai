import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi, funnelApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { I } from '@/components/icons'
import { ServiceCalculator } from '@/components/ServiceCalculator'
import { useIsNarrow, useMediaQuery } from '@/hooks/useMediaQuery'
import { categoryColor } from '@/lib/categoryColor'
import { CategoryArt } from '@/components/CategoryArt'
import { ServiceExplainer } from '@/components/ServiceExplainer'
import { ServiceFaq } from '@/components/ServiceFaq'
import { isPartnerOrg } from '@/lib/orgs'
import type { Service, FormField, EligibilityRule } from '@/types'

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
        <div style={{ fontSize: 22, fontWeight: 700, color: isHigh ? 'var(--color-success)' : 'var(--color-accent-text)' }}>
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

// Секция единого скролл-потока: общий id-якорь, отступ сверху под липкую
// навигацию (scrollMarginTop) и вертикальный ритм между блоками.
function Section({ id, title, children }: { id: string; title?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 120, marginBottom: 48 }}>
      {title && <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>{title}</h2>}
      {children}
    </section>
  )
}

// Группа правил соответствия (eligibility_rules) — блокирующие/учитываемые.
function RuleGroup({ title, rules, icon, iconColor }: {
  title: string
  rules: EligibilityRule[]
  icon: IconName
  iconColor: string
}) {
  const Ic = I[icon]
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-2)', margin: '0 0 10px' }}>{title}</h3>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {rules.map((r, i) => (
          <div key={r.id} style={{
            padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start',
            borderBottom: i < rules.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}>
            <Ic size={18} style={{ color: iconColor, flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                {r.ok_label || r.title}
              </div>
              {r.detail && (
                <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 3, lineHeight: 1.5 }}>
                  {r.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const isNarrow = useIsNarrow()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [bookmarked, setBookmarked] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')

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

  // Пункты якорной навигации — калькулятор появляется только при наличии формул.
  const navItems = useMemo(() => {
    const items = [
      { id: 'overview',     label: 'Обзор' },
      { id: 'requirements', label: 'Требования' },
      { id: 'documents',    label: 'Документы' },
    ]
    if (hasCalculator) items.push({ id: 'calculator', label: 'Калькулятор' })
    items.push({ id: 'how', label: 'Как подать' })
    items.push({ id: 'faq', label: 'Вопросы' })
    return items
  }, [hasCalculator])

  const benefits = useMemo(() => {
    const b: string[] = ['Онлайн-подача заявки']
    if (allFields.some(f => f.prefill_from)) b.push('Автозаполнение данных из eGov')
    if (allFields.some(f => f.type === 'calculated')) b.push('Автоматический расчёт платежей')
    if (allFields.some(f => f.type === 'file')) b.push('Загрузка документов онлайн')
    if ((service?.form_schema?.steps?.length ?? 0) > 1) b.push('Пошаговое заполнение формы')
    return b
  }, [allFields, service])

  // Эвристический fallback критериев участия: select/radio-поля первого шага.
  // Используется только когда у услуги нет размеченных eligibility_rules.
  const criteria = useMemo(() => {
    if (!service?.form_schema?.steps?.length) return []
    return service.form_schema.steps[0].fields
      .filter(f => (f.type === 'select' || f.type === 'radio') && f.options?.length)
      .map(f => `${f.label}: ${f.options!.join(', ')}`)
  }, [service])

  // Scrollspy: подсвечиваем активный пункт навигации по секции под липкой панелью.
  // rootMargin сдвигает «активную линию» ниже шапки+навигации (~120px сверху).
  useEffect(() => {
    if (!service) return
    const ids = navItems.map(n => n.id)
    const els = ids
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (els.length === 0) return

    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        })
        // Активна самая верхняя видимая секция в порядке документа.
        const first = ids.find(id => visible.has(id))
        if (first) setActiveSection(first)
      },
      { rootMargin: '-140px 0px -55% 0px', threshold: 0 }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [navItems, service])

  const scrollToSection = (targetId: string) => {
    const el = document.getElementById(targetId)
    if (!el) return
    setActiveSection(targetId)
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

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

  // Правила соответствия из конструктора: блокирующие vs учитываемые при рассмотрении.
  const rules = service.eligibility_rules?.rules ?? []
  const blockingRules = rules.filter(r => r.level === 'blocking')
  const softRules = rules.filter(r => r.level !== 'blocking')

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
            {service.org_name && isPartnerOrg(service.org_name) && (
              <span className="badge badge-gray">Партнёрская программа</span>
            )}
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

      {/* Key params bar — «выжимка»: top edge carries the category accent */}
      <div className="card card-elevated" style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
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
                <div style={{
                  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: 'var(--color-text-3)', marginBottom: 3,
                }}>{k.l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>{k.v}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Two-column layout */}
      <div className="two-col-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32 }}>
        <main>
          {/* Липкая якорная навигация — заменяет прежние вкладки */}
          <nav className="svc-anchor-nav" style={{
            position: 'sticky', top: 64, zIndex: 40,
            display: 'flex', gap: 4, marginBottom: 32,
            padding: '10px 0',
            background: 'var(--color-bg)',
            borderBottom: '1px solid var(--color-border)',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          }}>
            {navItems.map(item => {
              const active = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  style={{
                    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', flexShrink: 0,
                    background: active ? 'var(--color-primary-soft)' : 'transparent',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-3)',
                    transition: reduceMotion ? 'none' : 'background 120ms, color 120ms',
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Обзор */}
          <Section id="overview" title="О программе">
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-2)', marginTop: 0 }}>
              {service.description ||
                'Программа направлена на поддержку субъектов малого и среднего предпринимательства Республики Казахстан, реализующих проекты в приоритетных секторах экономики. Финансирование предоставляется на расширение деятельности, пополнение оборотных средств и приобретение основных средств.'}
            </p>

            {/* «Важно знать» — мягкая тонированная плашка без левой полосы */}
            <div style={{
              display: 'flex', gap: 12, background: 'var(--color-info-soft)',
              borderRadius: 12, padding: '14px 18px', marginTop: 20, marginBottom: 28,
            }}>
              <I.Info size={20} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>Важно знать</div>
                <div style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.55 }}>
                  Заявки принимаются круглосуточно. Решение принимается в течение 10 рабочих дней с момента подачи полного пакета документов.
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>Ключевые преимущества</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
              {benefits.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
                  <I.Check size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} strokeWidth={2.5} />
                  <span style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.45 }}>{b}</span>
                </div>
              ))}
            </div>

            {/* AI-объяснение «простыми словами» — на видном месте в конце обзора */}
            <ServiceExplainer key={service.id} serviceId={service.id} />
          </Section>

          {/* Требования к заёмщику */}
          <Section id="requirements" title="Требования к заёмщику">
            {rules.length > 0 ? (
              <>
                {blockingRules.length > 0 && (
                  <RuleGroup
                    title="Обязательные условия"
                    rules={blockingRules}
                    icon="CheckCircle"
                    iconColor="var(--color-success)"
                  />
                )}
                {softRules.length > 0 && (
                  <RuleGroup
                    title="Учитывается при рассмотрении"
                    rules={softRules}
                    icon="Info"
                    iconColor="var(--color-warning)"
                  />
                )}
              </>
            ) : criteria.length > 0 ? (
              // Fallback: эвристические критерии участия из полей формы.
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {criteria.map((c, i) => (
                  <div key={i} className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'var(--color-success-soft)', color: 'var(--color-success)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <I.Check size={13} strokeWidth={3} />
                    </div>
                    <span style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.5, paddingTop: 1 }}>{c}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySchemaInfo />
            )}
          </Section>

          {/* Пакет документов — нумерованный чек-лист */}
          <Section id="documents" title="Пакет документов">
            {fileFields.length === 0 ? (
              <div style={{ padding: '24px 0', color: 'var(--color-text-3)', fontSize: 14, lineHeight: 1.6 }}>
                Для этой программы документы загружаются после одобрения заявки.
              </div>
            ) : (
              <>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {fileFields.map((f, i) => {
                    const badge = fileTypeBadge(f.accept)
                    return (
                      <div key={f.id} style={{
                        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                        borderBottom: i < fileFields.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--color-primary-tint)', color: 'var(--color-primary)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                        }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{f.label}</div>
                          {f.accept && (
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{f.accept}</div>
                          )}
                        </div>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                          background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700,
                        }}>{badge.label}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>
                  <I.Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Точный перечень фиксируется на шаге подачи заявки — форма подскажет каждому файлу своё место.</span>
                </div>
              </>
            )}
          </Section>

          {/* Калькулятор — авто-собран из calculated-полей конструктора */}
          {hasCalculator && (
            <Section id="calculator" title="Рассчитайте условия">
              <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: -6, marginBottom: 20, lineHeight: 1.5 }}>
                Расчёт формируется автоматически из конструктора формы.
              </p>
              <ServiceCalculator key={service.id} schema={service.form_schema} />
            </Section>
          )}

          {/* Как подать — шаги из form_schema */}
          <Section id="how" title="Как подать заявку">
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
          </Section>

          {/* Вопросы и ответы — Kaspi-паттерн (компонент рендерит свой заголовок) */}
          <section id="faq" style={{ scrollMarginTop: 120 }}>
            <ServiceFaq key={service.id} serviceId={service.id} />
          </section>

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
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                      {isPartnerOrg(service.org_name) ? 'Партнёрская программа' : 'Дочерняя организация Холдинга «Байтерек»'}
                    </div>
                  </div>
                </div>
                {/* Блок общий для любой организации — показываем канонические
                    контакты портала (единый контакт-центр), а не выдуманные
                    номера конкретной дочки. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--color-text-2)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <I.Phone size={14} style={{ color: 'var(--color-text-3)' }} />1408 · единый контакт-центр
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <I.Mail size={14} style={{ color: 'var(--color-text-3)' }} />support@qoldau.kz
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

      {/* Скрыть скроллбар у горизонтальной якорной навигации на узких экранах */}
      <style>{`.svc-anchor-nav { scrollbar-width: none; }
.svc-anchor-nav::-webkit-scrollbar { display: none; }`}</style>
    </div>
  )
}
