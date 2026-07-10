import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { contentApi, type KnowledgeArticle } from '@/api/client'
import { I } from '@/components/icons'
import { DuotonePhoto } from '@/components/DuotonePhoto'
import { fmtNewsDate } from '@/pages/NewsPage'

// Фото для hero базы знаний — тёплый сюжет малого бизнеса (пекарня), под зелёным дуотоном.
const KNOWLEDGE_HERO_PHOTO = '/media/services/microcredit.jpg'

interface Template { slug: string; title: string; desc: string; icon: keyof typeof I; size: string; note?: string }

// Хитовые шаблоны — вынесены карточками (лизинговый чек-лист = контрольный кейс).
const FEATURED_TEMPLATES: Template[] = [
  { slug: 'leasing-readiness-checklist', title: 'Чек-лист готовности к подаче на лизинг', desc: 'Пошаговая проверка документов и условий перед подачей заявки на лизинг сельхозтехники.', icon: 'Shield', size: '~3 КБ', note: 'Контрольный кейс' },
  { slug: 'credit-application-checklist', title: 'Чек-лист документов для кредитной заявки', desc: 'Полный список документов для подачи на финансирование — ничего не забыть.', icon: 'CheckCircle', size: '~3 КБ' },
]

// Остальные шаблоны — компактным списком-таблицей, без сетки одинаковых карточек.
const MORE_TEMPLATES: Template[] = [
  { slug: 'business-plan-structure',     title: 'Структура бизнес-плана',                desc: 'Разделы и содержание для подготовки бизнес-плана проекта', icon: 'Briefcase', size: '~4 КБ' },
  { slug: 'support-application-form',    title: 'Заявление на получение меры поддержки', desc: 'Готовая форма заявления с полями для заполнения',           icon: 'Document',  size: '~3 КБ' },
  { slug: 'financial-model-description', title: 'Финансовая модель проекта',             desc: 'Структура листов финансовой модели (Excel/Google Sheets)', icon: 'Coins',     size: '~4 КБ' },
  { slug: 'power-of-attorney',           title: 'Доверенность на представителя',         desc: 'Шаблон доверенности для подачи документов через представителя', icon: 'Users',  size: '~2 КБ' },
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

      <div style={{ background: 'linear-gradient(160deg, var(--color-primary-tint) 0%, var(--color-primary-soft) 100%)', border: '1px solid var(--color-primary-soft)', boxShadow: 'var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.7)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
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

        <div style={{ background: 'linear-gradient(160deg, var(--color-primary-tint) 0%, var(--color-primary-soft) 100%)', border: '1px solid var(--color-primary-soft)', boxShadow: 'var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.7)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
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
    <div className="page-fade">
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="hero-gradient-bg" style={{ paddingTop: 44, paddingBottom: 44, position: 'relative', overflow: 'hidden' }}>
        <div className="ornament-tile ornament-fade ornament-hero" aria-hidden="true" />
        <div className="container" style={{ position: 'relative' }}>
          <div className="hero-grid">
            <div>
              <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--color-text)', lineHeight: 1.12 }}>
                База знаний
              </h1>
              <p style={{ fontSize: 16, color: 'var(--color-text-2)', maxWidth: 540, lineHeight: 1.55, marginTop: 14, marginBottom: 0 }}>
                Калькуляторы, шаблоны документов и пошаговые инструкции — всё, что нужно предпринимателю,
                чтобы подготовить заявку без ошибок и лишних визитов.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, fontSize: 13.5, color: 'var(--color-text-2)', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><I.Coins size={15} style={{ color: 'var(--color-primary)' }} /> 2 калькулятора</span>
                <span aria-hidden style={{ color: 'var(--color-border-strong)' }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><I.Document size={15} style={{ color: 'var(--color-primary)' }} /> 6 шаблонов</span>
                <span aria-hidden style={{ color: 'var(--color-border-strong)' }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><I.List size={15} style={{ color: 'var(--color-primary)' }} /> инструкции</span>
              </div>
            </div>
            <div className="hero-visual-wrap">
              <div style={{ position: 'relative', height: 260, borderRadius: 'var(--r-card)', overflow: 'hidden', boxShadow: 'var(--sh-lg)' }}>
                <DuotonePhoto src={KNOWLEDGE_HERO_PHOTO} focus="center 46%" scrim="bottom">
                  <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18, color: '#fff', pointerEvents: 'none' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Помогаем бизнесу расти</div>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.82)', marginTop: 3 }}>от идеи до первой заявки на поддержку</div>
                  </div>
                </DuotonePhoto>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
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

      {/* Хитовые шаблоны — карточками */}
      <div className="two-col-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
        {FEATURED_TEMPLATES.map((t) => {
          const Icon = I[t.icon]
          return (
            <div key={t.slug} className="card card-elevated" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                  <Icon size={21} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 650 }}>{t.title}</span>
                    {t.note && <span className="badge" style={{ background: 'var(--color-accent-soft)', color: '#1A1206', fontWeight: 600 }}>{t.note}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 3 }}>Markdown · {t.size}</div>
                </div>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--color-text-2)', margin: 0, lineHeight: 1.5, flex: 1 }}>{t.desc}</p>
              <a
                href={`/templates/${t.slug}.md`}
                download
                className="btn btn-primary btn-sm"
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <I.Download size={14} /> Скачать шаблон
              </a>
            </div>
          )
        })}
      </div>

      {/* Остальные — компактным списком (как «Статьи и инструкции») */}
      <div className="card" style={{ padding: 0, marginBottom: 48 }}>
        {MORE_TEMPLATES.map((t, i) => {
          const Icon = I[t.icon]
          return (
            <a
              key={t.slug}
              href={`/templates/${t.slug}.md`}
              download
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', textDecoration: 'none', color: 'inherit', transition: 'background 140ms var(--ease-out)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                <Icon size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.desc}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.size} <I.Download size={15} />
              </span>
            </a>
          )
        })}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Статьи и инструкции</h2>
      <ArticlesSection />
      </div>
    </div>
  )
}

function ArticlesSection() {
  const [active, setActive] = useState<string>('__all__')

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['knowledge'],
    queryFn: () => contentApi.knowledge().then((r) => r.data ?? []),
  })

  // Счётчики категорий из реально загруженных статей (без фейковых цифр).
  const chips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of articles) counts.set(a.category, (counts.get(a.category) ?? 0) + 1)
    const cats = [...counts.entries()].map(([id, count]) => ({ id, count }))
    return [{ id: '__all__', count: articles.length }, ...cats]
  }, [articles])

  const visible = active === '__all__' ? articles : articles.filter((a) => a.category === active)

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 0 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ padding: '16px 20px', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
            <div className="skeleton" style={{ height: 15, width: '70%' }} />
            <div className="skeleton" style={{ height: 11, width: '35%', marginTop: 8 }} />
          </div>
        ))}
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-2)' }}>Статей пока нет</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Материалы появятся здесь, как только редакция их опубликует.</div>
      </div>
    )
  }

  return (
    <>
      {/* Фильтр-чипы категорий с реальными счётчиками */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {chips.map((c) => {
          const isActive = active === c.id
          return (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className="badge"
              style={{
                cursor: 'pointer', border: '1px solid', padding: '6px 12px', fontSize: 13, fontWeight: 500,
                borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                color: isActive ? '#fff' : 'var(--color-text-2)',
                transition: 'all 140ms',
              }}
            >
              {c.id === '__all__' ? 'Все' : c.id}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{c.count}</span>
            </button>
          )
        })}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {visible.map((a: KnowledgeArticle, i) => (
          <Link
            key={a.id}
            to={`/knowledge/${a.slug}`}
            style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', textDecoration: 'none', color: 'inherit', transition: 'background 140ms' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{a.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span className="badge badge-gray">{a.category}</span>
                {a.read_minutes ? <span>{a.read_minutes} мин</span> : null}
                {a.published_at ? <span>· {fmtNewsDate(a.published_at)}</span> : null}
              </div>
            </div>
            <I.ChevronRight size={16} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </>
  )
}
