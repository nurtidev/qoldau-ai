import { useMemo, useState } from 'react'
import { I } from '@/components/icons'

const CATEGORIES = [
  { id: 'start', title: 'С чего начать',    count: 8,  icon: 'Sparkle' },
  { id: 'apply', title: 'Подача заявки',    count: 12, icon: 'Document' },
  { id: 'docs',  title: 'Документы',        count: 9,  icon: 'Briefcase' },
  { id: 'edit',  title: 'ЭЦП и eGov',      count: 6,  icon: 'Shield' },
  { id: 'fin',   title: 'Финансирование',   count: 14, icon: 'Coins' },
  { id: 'faq',   title: 'Часто задаваемые', count: 23, icon: 'Info' },
]

const ARTICLES = [
  { title: 'Как зарегистрироваться на портале Qoldau AI',              read: '3 мин', date: '20 апр. 2026' },
  { title: 'Пошаговая инструкция по подаче заявки на финансирование',  read: '7 мин', date: '18 апр. 2026' },
  { title: 'Установка и настройка NCALayer для подписания ЭЦП',        read: '5 мин', date: '14 апр. 2026' },
  { title: 'Какие документы нужны для подачи заявки на кредит',        read: '4 мин', date: '12 апр. 2026' },
  { title: 'Различия между льготным и коммерческим финансированием',    read: '6 мин', date: '08 апр. 2026' },
  { title: 'Что делать, если заявка отклонена',                        read: '4 мин', date: '02 апр. 2026' },
]

const TEMPLATES: { slug: string; title: string; desc: string; icon: keyof typeof I; size: string }[] = [
  { slug: 'business-plan-structure',    title: 'Структура бизнес-плана',                          desc: 'Разделы и содержание для подготовки бизнес-плана проекта', icon: 'Briefcase', size: '~4 КБ' },
  { slug: 'support-application-form',   title: 'Заявление на получение меры поддержки',           desc: 'Готовая форма заявления с полями для заполнения',           icon: 'Document',  size: '~3 КБ' },
  { slug: 'credit-application-checklist', title: 'Чек-лист документов для кредитной заявки',      desc: 'Полный список документов для подачи на финансирование',     icon: 'CheckCircle', size: '~3 КБ' },
  { slug: 'financial-model-description', title: 'Финансовая модель проекта',                     desc: 'Структура листов финансовой модели (Excel/Google Sheets)',   icon: 'Coins',     size: '~4 КБ' },
  { slug: 'leasing-readiness-checklist', title: 'Чек-лист готовности к подаче на лизинг',          desc: 'Проверка готовности документов и условий по лизингу',       icon: 'Shield',    size: '~3 КБ' },
  { slug: 'power-of-attorney',           title: 'Доверенность на представителя',                  desc: 'Шаблон доверенности для подачи документов через представителя', icon: 'Users',   size: '~2 КБ' },
]

function fmt(n: number): string {
  if (!isFinite(n)) return '—'
  return Math.round(n).toLocaleString('ru-RU')
}

function CreditCalculator() {
  const [amount, setAmount] = useState(10_000_000)
  const [rate, setRate] = useState(20.5)
  const [term, setTerm] = useState(36)

  const result = useMemo(() => {
    const S = Number(amount) || 0
    const annual = Number(rate) || 0
    const n = Number(term) || 0
    if (S <= 0 || n <= 0) return null
    const r = annual / 12 / 100
    let payment: number
    if (r === 0) {
      payment = S / n
    } else {
      payment = (S * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    }
    const total = payment * n
    const overpay = total - S
    return { payment, total, overpay }
  }, [amount, rate, term])

  return (
    <div className="two-col-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="field-label">Сумма кредита, тенге</label>
          <input
            className="input"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label">Процентная ставка, % годовых</label>
          <input
            className="input"
            type="number"
            step="0.1"
            min={0}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label">Срок кредита, мес.</label>
          <input
            className="input"
            type="number"
            min={1}
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
          />
        </div>
      </div>

      <div style={{ background: 'var(--color-surface-2)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Ежемесячный платёж (аннуитет)</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-primary)' }}>
            {result ? `${fmt(result.payment)} ₸` : '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Переплата по процентам</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{result ? `${fmt(result.overpay)} ₸` : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Общая сумма выплат</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{result ? `${fmt(result.total)} ₸` : '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubsidyCalculator() {
  const [amount, setAmount] = useState(10_000_000)
  const [marketRate, setMarketRate] = useState(20.5)
  const [subsidy, setSubsidy] = useState(7)
  const [term, setTerm] = useState(36)

  const result = useMemo(() => {
    const S = Number(amount) || 0
    const market = Number(marketRate) || 0
    const sub = Number(subsidy) || 0
    const n = Number(term) || 0
    if (S <= 0 || n <= 0) return null

    const borrowerRate = Math.max(market - sub, 0)

    const annuity = (rateAnnual: number) => {
      const r = rateAnnual / 12 / 100
      if (r === 0) return S / n
      return (S * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    }

    const paymentBefore = annuity(market)
    const paymentAfter = annuity(borrowerRate)
    const savings = (paymentBefore - paymentAfter) * n

    return { borrowerRate, paymentBefore, paymentAfter, savings }
  }, [amount, marketRate, subsidy, term])

  return (
    <div>
      <div className="two-col-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label">Сумма кредита, тенге</label>
            <input
              className="input"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">Рыночная ставка, % годовых</label>
            <input
              className="input"
              type="number"
              step="0.1"
              min={0}
              value={marketRate}
              onChange={(e) => setMarketRate(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">Субсидируемая часть ставки, %</label>
            <input
              className="input"
              type="number"
              step="0.1"
              min={0}
              value={subsidy}
              onChange={(e) => setSubsidy(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">Срок кредита, мес.</label>
            <input
              className="input"
              type="number"
              min={1}
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{ background: 'var(--color-surface-2)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Ставка для заёмщика после субсидирования</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-primary)' }}>
              {result ? `${result.borrowerRate.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%` : '—'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Платёж до субсидии</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{result ? `${fmt(result.paymentBefore)} ₸` : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Платёж после субсидии</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-success, #07663D)' }}>{result ? `${fmt(result.paymentAfter)} ₸` : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Экономия за весь срок</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-success, #07663D)' }}>{result ? `${fmt(result.savings)} ₸` : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 16, marginBottom: 0 }}>
        Расчёт предварительный, по программам льготного финансирования дочерних организаций Холдинга.
      </p>
    </div>
  )
}

type ToolId = 'credit' | 'subsidy'

export function KnowledgePage() {
  const [openTool, setOpenTool] = useState<ToolId>('credit')

  const tools: { id: ToolId; title: string; icon: keyof typeof I; render: () => JSX.Element }[] = [
    { id: 'credit', title: 'Кредитный калькулятор', icon: 'Coins', render: () => <CreditCalculator /> },
    { id: 'subsidy', title: 'Калькулятор субсидирования ставки', icon: 'TrendingDown', render: () => <SubsidyCalculator /> },
  ]

  return (
    <div className="page-fade container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ marginBottom: 32 }}>
        <div className="section-eyebrow" style={{ marginBottom: 8 }}>Помощь</div>
        <h1 className="section-title" style={{ fontSize: 32 }}>База знаний</h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-3)', marginTop: 8 }}>Инструкции, FAQ, шаблоны документов и цифровые инструменты для предпринимателей</p>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Цифровые инструменты</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 48 }}>
        {tools.map((tool) => {
          const Icon = I[tool.icon]
          const isOpen = openTool === tool.id
          return (
            <div key={tool.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenTool(isOpen ? ('' as ToolId) : tool.id)}
                style={{
                  width: '100%',
                  padding: '18px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{tool.title}</div>
                {isOpen ? <I.ChevronUp size={18} style={{ color: 'var(--color-text-3)' }} /> : <I.ChevronDown size={18} style={{ color: 'var(--color-text-3)' }} />}
              </button>
              {isOpen && (
                <div style={{ padding: '4px 20px 24px', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ paddingTop: 20 }}>{tool.render()}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Шаблоны документов и чек-листы</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 48 }}>
        {TEMPLATES.map((t) => {
          const Icon = I[t.icon]
          return (
            <div key={t.slug} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                  <Icon size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>Markdown · {t.size}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-2)', margin: 0, flex: 1 }}>{t.desc}</p>
              <a
                href={`/templates/${t.slug}.md`}
                download
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <I.Download size={14} /> Скачать
              </a>
            </div>
          )
        })}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Разделы базы знаний</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 48 }}>
        {CATEGORIES.map((cat) => {
          const Icon = I[cat.icon as keyof typeof I]
          return (
            <div key={cat.id} className="card" style={{ padding: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 140ms' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                {Icon && <Icon size={20} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{cat.count} статей</div>
              </div>
            </div>
          )
        })}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Популярные статьи</h2>
      <div className="card" style={{ padding: 0 }}>
        {ARTICLES.map((a, i) => (
          <div key={i} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{a.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>{a.date} · {a.read} чтения</div>
            </div>
            <I.ChevronRight size={16} style={{ color: 'var(--color-text-4)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
