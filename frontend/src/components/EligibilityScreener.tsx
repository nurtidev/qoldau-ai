import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { I } from '@/components/icons'
import { leadsApi } from '@/api/client'
import { useToast } from '@/components/Toast'
import type { Service } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(v: number): string {
  if (v >= 1_000_000_000) {
    const n = v / 1_000_000_000
    return `${n % 1 === 0 ? n : n.toFixed(1)} млрд ₸`
  }
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)} млн ₸`
  if (v >= 1_000)     return `${Math.round(v / 1_000)} тыс ₸`
  return `${v} ₸`
}

function formatTerm(months: number): string {
  if (months % 12 === 0) {
    const y = months / 12
    return `${months} мес. (${y} ${y === 1 ? 'год' : y < 5 ? 'года' : 'лет'})`
  }
  return `${months} мес.`
}

// Annuity payment. r = annual rate %, n = months. Falls back to linear for r=0.
function annuity(principal: number, rateAnnualPercent: number, months: number): number {
  if (months <= 0) return 0
  const r = rateAnnualPercent / 100 / 12
  if (r === 0) return principal / months
  const pow = Math.pow(1 + r, months)
  return (principal * r * pow) / (pow - 1)
}

const TERM_PRESETS = [12, 24, 36, 48, 60, 84] as const

type Goal    = 'credit' | 'grant' | 'subsidy' | 'guarantee'
type Sector  = 'agro' | 'industry' | 'trade' | 'tech' | 'tourism' | 'other'
type Age     = 'new' | 'young' | 'mid' | 'mature'
type Revenue = 'micro' | 'small' | 'medium'

interface Answers {
  goal:    Goal    | null
  sector:  Sector  | null
  age:     Age     | null
  revenue: Revenue | null
}

const QUESTIONS = [
  {
    key: 'goal' as const,
    question: 'Что вам нужно?',
    hint: 'Выберите основной вид поддержки',
    cols: 2,
    options: [
      { value: 'credit'    as Goal, label: 'Кредит или лизинг',         desc: 'Займы и финансирование на льготных условиях',  icon: 'Coins'    },
      { value: 'grant'     as Goal, label: 'Грант без возврата',          desc: 'Безвозмездная поддержка для вашего проекта',  icon: 'Sparkle'  },
      { value: 'subsidy'   as Goal, label: 'Субсидия / льготная ставка',  desc: 'Снижение процентной нагрузки по кредитам',    icon: 'Coins'    },
      { value: 'guarantee' as Goal, label: 'Гарантия по кредиту',         desc: 'Государственное поручительство перед банком', icon: 'Shield'   },
    ],
  },
  {
    key: 'sector' as const,
    question: 'Ваша отрасль',
    hint: 'Поможет найти отраслевые программы',
    cols: 3,
    options: [
      { value: 'agro'     as Sector, label: 'Сельское хозяйство', desc: 'Растениеводство, животноводство', icon: 'Sprout'   },
      { value: 'industry' as Sector, label: 'Производство',        desc: 'Промышленность, переработка',    icon: 'Building' },
      { value: 'trade'    as Sector, label: 'Торговля и услуги',   desc: 'Ретейл, услуги, общепит',        icon: 'Hash'     },
      { value: 'tech'     as Sector, label: 'IT и инновации',      desc: 'Стартапы, разработка',           icon: 'Sparkle'  },
      { value: 'tourism'  as Sector, label: 'Туризм',              desc: 'Гостиницы, туроператоры',        icon: 'Plane'    },
      { value: 'other'    as Sector, label: 'Другое',              desc: 'Иные виды деятельности',         icon: 'Document' },
    ],
  },
  {
    key: 'age' as const,
    question: 'Возраст бизнеса',
    hint: 'Определяет программы по стадии развития',
    cols: 2,
    options: [
      { value: 'new'    as Age, label: 'Только открываюсь', desc: 'Нет регистрации или < 3 мес.',  icon: 'Sparkle'    },
      { value: 'young'  as Age, label: 'До 1 года',          desc: 'Молодой, развивающийся бизнес', icon: 'ArrowRight' },
      { value: 'mid'    as Age, label: '1–3 года',            desc: 'Ищу масштабирование',           icon: 'Check'      },
      { value: 'mature' as Age, label: 'Более 3 лет',         desc: 'Зрелый бизнес с историей',      icon: 'Shield'     },
    ],
  },
  {
    key: 'revenue' as const,
    question: 'Годовая выручка',
    hint: 'Влияет на лимиты и доступные программы',
    cols: 3,
    options: [
      { value: 'micro'  as Revenue, label: 'До 30 млн ₸',     desc: 'Микробизнес и ИП',          icon: 'Coins'    },
      { value: 'small'  as Revenue, label: '30 – 300 млн ₸',  desc: 'Малый бизнес',              icon: 'Coins'    },
      { value: 'medium' as Revenue, label: 'Более 300 млн ₸', desc: 'Средний и крупный бизнес',  icon: 'Building' },
    ],
  },
] as const

function scoreService(service: Service, answers: Answers): number {
  const text = [service.title, service.description, service.category, service.org_name]
    .filter(Boolean).join(' ').toLowerCase()
  let score = 0

  // Goal — 50 pts
  switch (answers.goal) {
    case 'credit':
      if (/лизинг|кредит|займ/.test(text) || service.category?.match(/Финансирование|Лизинг/)) score += 50
      else if (service.category?.includes('Гарантии')) score += 10
      break
    case 'grant':
      if (/грант/.test(text) || service.category?.includes('Гранты')) score += 50
      else score += 5
      break
    case 'subsidy':
      if (/субсид|льготн/.test(text) || service.category?.includes('Субсидии')) score += 50
      else if (/кредит|лизинг/.test(text)) score += 18
      break
    case 'guarantee':
      if (/гарант/.test(text) || service.category?.includes('Гарантии')) score += 50
      else score += 5
      break
  }

  // Sector — 25 pts
  switch (answers.sector) {
    case 'agro':
      score += /сельхоз|аграр|агро|казагро|растение|животновод/.test(text) || service.category?.includes('Агросектор') ? 25 : 8
      break
    case 'tech':
      score += /стартап|иннов|it |цифров|иннофонд/.test(text) ? 25 : 8
      break
    case 'industry':
      score += /производ|промышл|переработ/.test(text) ? 25 : 8
      break
    case 'tourism':
      score += /туризм|гостин/.test(text) ? 25 : 5
      break
    default:
      score += 12
  }

  // Age — 15 pts
  switch (answers.age) {
    case 'new':
    case 'young':
      score += /начинающ|стартап|бастау|жас/.test(text) ? 15 : 7
      break
    case 'mid':
      score += 11
      break
    case 'mature':
      score += /крупн|устоявш/.test(text) ? 15 : 10
      break
  }

  // Revenue — 10 pts
  switch (answers.revenue) {
    case 'micro':
      score += /микро|мсб|малый/.test(text) ? 10 : 4
      break
    case 'small':
      score += /мсб|малый|средн/.test(text) ? 10 : 6
      break
    case 'medium':
      score += /крупн|средн/.test(text) ? 10 : 5
      break
  }

  return Math.min(score, 99)
}

function ScoreChip({ score }: { score: number }) {
  const high = score >= 70
  return (
    <div style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      background: high ? 'var(--color-success-soft)' : 'var(--color-surface-2)',
      color: high ? 'var(--color-success)' : 'var(--color-text-3)',
    }}>
      {score}% совпадение
    </div>
  )
}

function ProgramTermsStrip({ service }: { service: Service }) {
  const cells: { label: string; value: string }[] = []
  if (service.interest_rate != null)
    cells.push({ label: 'ставка',      value: `${service.interest_rate}%` })
  if (service.max_amount != null)
    cells.push({ label: 'до',          value: formatAmount(service.max_amount) })
  if (service.max_term_months != null)
    cells.push({ label: 'срок до',     value: `${service.max_term_months} мес.` })
  if (cells.length === 0) return null

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
      gap: 8, padding: '10px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)',
    }}>
      {cells.map((c, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>{c.value}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

function InlineCalculator({ service }: { service: Service }) {
  const rate     = service.interest_rate
  const maxAmt   = service.max_amount
  const maxTerm  = service.max_term_months
  if (rate == null || maxAmt == null || maxTerm == null) return null

  const defaultAmount = Math.round(maxAmt / 2)
  const [amount, setAmount] = useState(defaultAmount)
  const termOptions = TERM_PRESETS.filter(t => t <= maxTerm)
  const [term, setTerm] = useState(termOptions[Math.min(2, termOptions.length - 1)] ?? maxTerm)

  const monthly  = annuity(amount, rate, term)
  const total    = monthly * term
  const overpay  = total - amount

  const clampedAmount = Math.min(Math.max(amount, 0), maxAmt)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 500 }}>Сумма займа</label>
          <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>макс. {formatAmount(maxAmt)}</span>
        </div>
        <input
          type="range"
          min={0} max={maxAmt} step={Math.max(Math.round(maxAmt / 100), 1000)}
          value={clampedAmount}
          onChange={e => setAmount(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-accent)' }}
        />
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{formatAmount(clampedAmount)}</div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Срок</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {termOptions.map(t => (
            <button
              key={t}
              onClick={() => setTerm(t)}
              style={{
                padding: '6px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                border: t === term ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: t === term ? 'var(--color-accent-soft)' : '#fff',
                color: t === term ? 'var(--color-primary)' : 'var(--color-text-2)',
                cursor: 'pointer', transition: 'all 120ms',
              }}
            >
              {t} мес
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--color-accent-soft)', borderRadius: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Платёж/мес</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', marginTop: 2 }}>{formatAmount(Math.round(monthly))}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Переплата</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-2)', marginTop: 2 }}>{formatAmount(Math.round(overpay))}</div>
        </div>
      </div>
    </div>
  )
}

function ResultCard({ service, score }: { service: Service; score: number }) {
  const hasCalc = service.interest_rate != null && service.max_amount != null && service.max_term_months != null
  const hasTerms = service.interest_rate != null || service.max_amount != null || service.max_term_months != null

  return (
    <div
      className="card"
      style={{
        padding: 20, display: 'flex', flexDirection: 'column', gap: 12, height: '100%',
        border: score >= 70 ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
        transition: 'box-shadow 140ms',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-md)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-xs)' }}
    >
      <Link to={`/services/${service.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="badge badge-blue">{service.category ?? 'Общее'}</span>
          <ScoreChip score={score} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: 'var(--color-text)' }}>
          {service.title}
        </div>
        {service.description && (
          <div style={{
            fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {service.description}
          </div>
        )}
      </Link>

      {hasTerms && <ProgramTermsStrip service={service} />}
      {hasCalc && <InlineCalculator service={service} />}

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{service.org_name ?? '—'}</span>
        <Link
          to={`/services/${service.id}`}
          style={{ fontSize: 13, color: 'var(--color-accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          Подать заявку <I.ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}

function CallMeBack() {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)

  const mut = useMutation({
    mutationFn: () => leadsApi.create({ name: name.trim(), phone: phone.trim() }),
    onSuccess: () => {
      setSent(true)
      toast.push('Заявка отправлена — мы перезвоним', 'success')
    },
    onError: () => toast.push('Не удалось отправить заявку', 'error'),
  })

  if (sent) {
    return (
      <div className="card" style={{ padding: 24, marginTop: 20, background: 'var(--color-success-soft)', borderColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <I.CheckCircle size={24} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Заявка принята</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 2 }}>Менеджер свяжется с вами в рабочее время.</div>
        </div>
      </div>
    )
  }

  const canSend = name.trim().length >= 2 && phone.trim().length >= 6 && !mut.isPending

  return (
    <div className="card" style={{ padding: 24, marginTop: 20, display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'end' }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Не уверены, какая программа подойдёт?</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 14 }}>Оставьте телефон — консультант перезвонит и поможет с подбором и подачей заявки.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="field-label" style={{ fontSize: 12 }}>Ваше имя</label>
            <input className="input" placeholder="Айдар" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" style={{ fontSize: 12 }}>Телефон</label>
            <input className="input" type="tel" placeholder="+7 ___ ___ __ __" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
        </div>
      </div>
      <button
        className="btn btn-primary"
        disabled={!canSend}
        onClick={() => mut.mutate()}
        style={{ height: 44, minWidth: 180 }}
      >
        {mut.isPending ? 'Отправляем…' : 'Перезвоните мне'}
      </button>
    </div>
  )
}

function Results({ services, answers, onReset }: { services: Service[]; answers: Answers; onReset: () => void }) {
  const scored = services
    .filter(s => s.status === 'published')
    .map(s => ({ service: s, score: scoreService(s, answers) }))
    .filter(x => x.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  const goalQuery = { credit: 'кредит', grant: 'грант', subsidy: 'субсидия', guarantee: 'гарантия' }[answers.goal!] ?? ''

  return (
    <section className="container page-fade" style={{ paddingTop: 52 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Подбор программ</div>
          <h2 className="section-title">
            {scored.length > 0
              ? `Найдено ${scored.length} подходящ${scored.length === 1 ? 'ая программа' : scored.length < 5 ? 'ие программы' : 'их программ'}`
              : 'Подходящих программ не найдено'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 4 }}>
            По вашим ответам — показываем наилучшие совпадения. Рассчитайте платёж прямо в карточке.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onReset}>
          <I.ArrowLeft size={14} /> Изменить ответы
        </button>
      </div>

      {scored.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-3)' }}>
          <p>Попробуйте изменить параметры подбора</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
          {scored.map(({ service, score }) => (
            <ResultCard key={service.id} service={service} score={score} />
          ))}
        </div>
      )}

      <CallMeBack />

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Link
          to={`/services?q=${encodeURIComponent(goalQuery)}`}
          style={{ fontSize: 14, color: 'var(--color-accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          Смотреть все программы <I.ArrowRight size={14} />
        </Link>
      </div>
    </section>
  )
}

interface Props {
  services: Service[]
}

export function EligibilityScreener({ services }: Props) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({ goal: null, sector: null, age: null, revenue: null })

  const reset = () => {
    setStep(0)
    setAnswers({ goal: null, sector: null, age: null, revenue: null })
  }

  if (step >= QUESTIONS.length) {
    return <Results services={services} answers={answers} onReset={reset} />
  }

  const current = QUESTIONS[step]
  const selectedValue = answers[current.key]

  const select = (value: string) => {
    const next = { ...answers, [current.key]: value }
    setAnswers(next as Answers)
    setTimeout(() => setStep(s => s + 1), 160)
  }

  return (
    <section className="container" style={{ paddingTop: 52 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div className="section-eyebrow">Подбор программы</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {QUESTIONS.map((_, i) => (
              <div key={i} style={{
                height: 4, borderRadius: 2,
                width: i === step ? 24 : 12,
                background: i < step ? 'var(--color-accent)' : i === step ? 'var(--color-primary)' : 'var(--color-border)',
                transition: 'all 200ms',
              }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{step + 1} / {QUESTIONS.length}</span>
        </div>
        <h2 className="section-title">{current.question}</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 4 }}>{current.hint}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${current.cols}, 1fr)`, gap: 12 }}>
        {current.options.map((opt) => {
          const Icon = I[opt.icon as keyof typeof I]
          const isSelected = selectedValue === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className="card"
              style={{
                padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                border: isSelected ? '2px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                background: isSelected ? 'var(--color-accent-soft)' : '#fff',
                transition: 'all 140ms',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'var(--color-accent)'
                  el.style.boxShadow = 'var(--sh-md)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'var(--color-border)'
                  el.style.boxShadow = 'var(--sh-xs)'
                }
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: isSelected ? 'var(--color-primary)' : 'var(--color-accent-soft)',
                color: isSelected ? '#fff' : 'var(--color-primary)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 140ms',
              }}>
                {Icon && <Icon size={18} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.4 }}>{opt.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {step > 0 && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setStep(s => s - 1)}
          style={{ marginTop: 16 }}
        >
          <I.ArrowLeft size={14} /> Назад
        </button>
      )}
    </section>
  )
}
