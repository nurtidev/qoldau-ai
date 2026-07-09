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
  const programs = useMemo(
    () => services.filter(
      (s) => typeof s.interest_rate === 'number' && typeof s.max_amount === 'number' && s.max_amount > 0
    ),
    [services]
  )

  const [selectedId, setSelectedId] = useState<string>('')
  const selected = programs.find((p) => p.id === selectedId) ?? programs[0]

  const maxAmount = selected?.max_amount ?? DEFAULT_AMOUNT
  const maxTerm = selected?.max_term_months ?? 60
  const rate = selected?.interest_rate ?? 0

  const [amount, setAmount] = useState(DEFAULT_AMOUNT)
  const [term, setTerm] = useState(DEFAULT_TERM)
  const [showSchedule, setShowSchedule] = useState(false)

  // Смена программы → пересобираем разумные дефолты в новых границах.
  useEffect(() => {
    if (!selected) return
    setAmount(clamp(DEFAULT_AMOUNT, MIN_AMOUNT, selected.max_amount ?? DEFAULT_AMOUNT))
    setTerm(Math.min(DEFAULT_TERM, selected.max_term_months ?? 60))
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
        {/* Программа */}
        <div>
          <label className="field-label" htmlFor="home-calc-program">Программа финансирования</label>
          <select
            id="home-calc-program"
            className="select"
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.interest_rate}% годовых
              </option>
            ))}
          </select>
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
        <SliderRow
          label="Срок"
          value={term}
          min={6}
          max={maxTerm}
          step={1}
          suffix="мес."
          onChange={setTerm}
        />

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
