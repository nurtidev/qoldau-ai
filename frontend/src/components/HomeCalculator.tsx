import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi } from '@/api/client'
import { I } from '@/components/icons'
import { categoryColor, categorySoftBg } from '@/lib/categoryColor'
import type { Service } from '@/types'

// Интерактивный кредитный калькулятор для главной. В отличие от
// ServiceCalculator (собирается из calculated-полей конкретной схемы), этот
// работает по «рыночным» параметрам программы — interest_rate / max_amount /
// max_term_months, которые проставлены на услугах (см. migration 008/013).
// Аннуитетная математика — та же, что в KnowledgePage.CreditCalculator.

const MIN_AMOUNT = 1_000_000
const AMOUNT_STEP = 500_000
const DEFAULT_AMOUNT = 10_000_000
const DEFAULT_TERM = 36

// Пресеты сроков (мес.) для чипов — как в akk-portal (funnel/calculator.tsx):
// ряд кнопок, отфильтрованных по потолку программы. Реальный max программы
// добавляется отдельно, если он не совпадает с пресетом (напр. 18 мес. у
// «Кең дала 2»), чтобы верхняя граница всегда была доступна выбором.
const TERM_PRESETS = [12, 24, 36, 60, 84, 120]

function termOptionsFor(maxTerm: number): number[] {
  const opts = TERM_PRESETS.filter((x) => x <= maxTerm)
  if (maxTerm > 0 && !opts.includes(maxTerm)) opts.push(maxTerm)
  if (opts.length === 0) opts.push(maxTerm > 0 ? maxTerm : DEFAULT_TERM)
  return opts.sort((a, b) => a - b)
}

/** Дефолтный срок в новых границах: наибольший пресет ≤ 36, иначе минимальный. */
function pickInitialTerm(opts: number[]): number {
  return [...opts].reverse().find((x) => x <= DEFAULT_TERM) ?? opts[0]
}

/** Короткое имя программы — часть до « — » (полное имя длинное для чипа-карточки). */
function shortName(title: string): string {
  const head = title.split('—')[0].trim()
  return head.length >= 3 ? head : title
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/** Аннуитетный ежемесячный платёж. */
function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRatePct / 12 / 100
  if (r === 0) return principal / months
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

interface ScheduleRow {
  m: number
  payment: number
  principalPart: number
  interest: number
  balance: number
}

function buildSchedule(principal: number, annualRatePct: number, months: number): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  if (principal <= 0 || months <= 0) return rows
  const r = annualRatePct / 12 / 100
  const payment = annuityPayment(principal, annualRatePct, months)
  let balance = principal
  for (let m = 1; m <= months; m++) {
    const interest = balance * r
    let principalPart = payment - interest
    // Последний платёж закрывает остаток без «копеечного» хвоста.
    if (m === months) principalPart = balance
    balance = Math.max(0, balance - principalPart)
    rows.push({ m, payment: m === months ? interest + principalPart : payment, principalPart, interest, balance })
  }
  return rows
}

function SliderRow({ label, value, min, max, step, suffix, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (v: number) => void
}) {
  const [text, setText] = useState('')
  const editing = text !== ''
  const displayValue = editing ? text : fmt(value)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <label className="field-label" style={{ margin: 0 }}>{label}</label>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          border: '1px solid var(--color-border)', borderRadius: 8,
          padding: '4px 10px', background: '#fff',
        }}>
          <input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '')
              setText(e.target.value)
              if (digits !== '') onChange(clamp(Number(digits), min, max))
            }}
            onBlur={() => { setText(''); onChange(clamp(value, min, max)) }}
            style={{
              width: 96, border: 'none', outline: 'none', textAlign: 'right',
              fontSize: 15, fontWeight: 600, color: 'var(--color-text)', background: 'transparent',
              padding: 0,
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0 }}>{suffix}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { setText(''); onChange(Number(e.target.value)) }}
        style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer', display: 'block' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-4)', marginTop: 4 }}>
        <span>{fmt(min)} {suffix}</span>
        <span>{fmt(max)} {suffix}</span>
      </div>
    </div>
  )
}

export function HomeCalculator() {
  const navigate = useNavigate()
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  })

  // Только кредитные/лизинговые программы: есть и ставка, и лимит суммы.
  // Отсекаем E2E-фикстуры (title «E2E · …») — тестовый мусор не место в
  // публичном калькуляторе главной.
  const programs = useMemo(
    () => services.filter(
      (s) => typeof s.interest_rate === 'number' && typeof s.max_amount === 'number' && s.max_amount > 0
        && !s.title.startsWith('E2E ·')
    ),
    [services]
  )

  const [selectedId, setSelectedId] = useState<string>('')
  const selected = programs.find((p) => p.id === selectedId) ?? programs[0]

  const maxAmount = selected?.max_amount ?? DEFAULT_AMOUNT
  const maxTerm = selected?.max_term_months ?? 60
  const rate = selected?.interest_rate ?? 0
  const termOptions = useMemo(() => termOptionsFor(maxTerm), [maxTerm])

  const [amount, setAmount] = useState(DEFAULT_AMOUNT)
  const [term, setTerm] = useState(DEFAULT_TERM)
  const [showSchedule, setShowSchedule] = useState(false)

  // Смена программы → пересобираем разумные дефолты в новых границах.
  useEffect(() => {
    if (!selected) return
    setAmount(clamp(DEFAULT_AMOUNT, MIN_AMOUNT, selected.max_amount ?? DEFAULT_AMOUNT))
    setTerm(pickInitialTerm(termOptionsFor(selected.max_term_months ?? 60)))
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const payment = useMemo(() => annuityPayment(amount, rate, term), [amount, rate, term])
  const total = payment * term
  const overpay = total - amount
  const schedule = useMemo(
    () => (showSchedule ? buildSchedule(amount, rate, term) : []),
    [showSchedule, amount, rate, term]
  )

  if (programs.length === 0) {
    return (
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 80 }} />
      </div>
    )
  }

  const accent = categoryColor(selected?.category)

  // Строки графика: первые 12 + «…» + последняя (если срок длиннее 13 мес.).
  const head = schedule.slice(0, 12)
  const showEllipsis = schedule.length > 13
  const tail = schedule.length > 12 ? schedule[schedule.length - 1] : null

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Программа — ряд карточек-табов (прокручиваемый на переполнении).
            Паттерн из akk-portal (funnel/program-showcase): активная программа
            подсвечена рамкой/заливкой primary; здесь — компактные табы вместо
            карусели со стрелками, т.к. блок узкий и программ немного. */}
        <div>
          <label className="field-label" style={{ marginBottom: 10 }}>Программа финансирования</label>
          <div
            role="tablist"
            aria-label="Программа финансирования"
            style={{
              display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8,
              scrollSnapType: 'x proximity', margin: '0 -4px', paddingInline: 4,
            }}
          >
            {programs.map((p) => {
              const active = p.id === selected?.id
              const pAccent = categoryColor(p.category)
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    flex: '0 0 auto', width: 158, textAlign: 'left', cursor: 'pointer',
                    scrollSnapAlign: 'start', borderRadius: 12, padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                    background: active ? categorySoftBg(p.category) : '#fff',
                    border: `1.5px solid ${active ? pAccent : 'var(--color-border)'}`,
                    boxShadow: active ? 'var(--sh-sm)' : 'none',
                    transition: 'border-color 140ms var(--ease-out), background 140ms var(--ease-out), box-shadow 140ms var(--ease-out)',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)' }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)' }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: 'var(--color-text)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    minHeight: 34,
                  } as React.CSSProperties}>
                    {shortName(p.title)}
                  </span>
                  {p.org_name && (
                    <span style={{
                      fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.org_name}
                    </span>
                  )}
                  <span style={{ marginTop: 'auto', fontSize: 18, fontWeight: 700, color: active ? pAccent : 'var(--color-primary)', letterSpacing: '-0.01em' }}>
                    от {p.interest_rate}%
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Параметры */}
        <SliderRow
          label="Сумма финансирования"
          value={amount}
          min={MIN_AMOUNT}
          max={maxAmount}
          step={AMOUNT_STEP}
          suffix="₸"
          onChange={setAmount}
        />

        {/* Срок — выбор чипами (как в akk-portal), применяется мгновенно. */}
        <div>
          <label className="field-label" style={{ marginBottom: 10 }}>Срок</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {termOptions.map((x) => {
              const active = x === term
              return (
                <button
                  key={x}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTerm(x)}
                  style={{
                    cursor: 'pointer', borderRadius: 8, padding: '7px 14px',
                    fontSize: 13, fontWeight: 600,
                    color: active ? '#fff' : 'var(--color-text-2)',
                    background: active ? 'var(--color-primary)' : '#fff',
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    transition: 'border-color 120ms var(--ease-out), background 120ms var(--ease-out), color 120ms var(--ease-out)',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)' }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)' }}
                >
                  {x} мес.
                </button>
              )
            })}
          </div>
        </div>

        {/* Результат */}
        <div style={{
          background: 'var(--color-surface-2)', borderRadius: 12, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Ежемесячный платёж</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                {fmt(payment)} ₸
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span className="badge" style={{ background: categorySoftBg(selected?.category), color: accent }}>
                {selected?.category ?? 'Финансирование'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-2)', fontWeight: 600 }}>
                Ставка {rate}% годовых
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Переплата по процентам</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(overpay)} ₸</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Итого к возврату</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(total)} ₸</div>
            </div>
          </div>
        </div>

        {/* Тоггл графика */}
        <button
          type="button"
          onClick={() => setShowSchedule((v) => !v)}
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          aria-expanded={showSchedule}
        >
          {showSchedule ? <I.ChevronUp size={15} /> : <I.ChevronDown size={15} />}
          График погашения
        </button>

        {showSchedule && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
            <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', textAlign: 'right', color: 'var(--color-text-3)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Месяц</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Платёж</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Осн. долг</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Проценты</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Остаток</th>
                </tr>
              </thead>
              <tbody>
                {head.map((row) => (
                  <tr key={row.m} style={{ borderTop: '1px solid var(--color-border)', textAlign: 'right' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--color-text-3)' }}>{row.m}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(row.payment)}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(row.principalPart)}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(row.interest)}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(row.balance)}</td>
                  </tr>
                ))}
                {showEllipsis && (
                  <tr style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--color-text-4)' }}>…</td>
                  </tr>
                )}
                {tail && (
                  <tr style={{ borderTop: '1px solid var(--color-border)', textAlign: 'right', background: 'var(--color-surface-2)' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--color-text-3)', fontWeight: 600 }}>{tail.m}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(tail.payment)}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(tail.principalPart)}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(tail.interest)}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(tail.balance)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '18px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => selected && navigate(`/services/${selected.id}`)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          Подать заявку <I.ArrowRight size={16} />
        </button>
        <p style={{ fontSize: 11, color: 'var(--color-text-4)', margin: '10px 0 0', textAlign: 'center' }}>
          Предварительный расчёт, не является офертой.
        </p>
      </div>
    </div>
  )
}
