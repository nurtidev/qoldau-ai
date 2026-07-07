import { useMemo, useState } from 'react'
import type { FormField, FormSchema } from '@/types'
import { I } from '@/components/icons'
import { buildCalcPlan, recomputeAll, formatCurrency, formatCalcValue, type CalcNode } from '@/lib/formula'

// Виджет-калькулятор, порождаемый из no-code схемы формы: если админ добавил
// в конструкторе calculated-поля — на витрине услуги сам собой появляется
// интерактивный калькулятор с их прямыми и транзитивными зависимостями.

const INPUT_TYPES = new Set<FormField['type']>(['number', 'currency', 'select', 'radio', 'checkbox'])

interface ResolvedCalculator {
  calcFields: FormField[]
  calcPlan: CalcNode[]
  inputFields: FormField[]
}

/**
 * Извлекает все calculated-поля схемы и транзитивное множество их
 * зависимостей (переменные formula), сопоставленных с реальными полями формы.
 *
 * Edge cases:
 * - зависимость ссылается на другое calculated-поле → рекурсивно разворачиваем
 *   его собственные зависимости (calc → calc цепочки, напр. an19 → an17 → an15,an16);
 * - зависимость ссылается на несуществующий field.id → не рендерим как инпут
 *   (нечего показывать), но formula всё равно посчитается — evalNode подставит 0;
 * - зависимость ссылается на поле неподдерживаемого для инпута типа
 *   (text/textarea/date/file/multiselect) → аналогично не рендерим, эвалюатор
 *   использует 0;
 * - циклическая зависимость (calc A → calc B → calc A) → защищаемся флагом
 *   visiting, чтобы не уйти в бесконечную рекурсию.
 */
function resolveCalculator(fullSchema: FormSchema): ResolvedCalculator {
  // Публичный калькулятор строится только по шагам этапа 1 —
  // поля этапа 2 (дозапрос документов) на витрину не выносим.
  const schema: FormSchema = { ...fullSchema, steps: fullSchema.steps.filter(s => (s.stage ?? 1) !== 2) }
  const allFields = schema.steps.flatMap(s => s.fields)
  const fieldById = new Map(allFields.map(f => [f.id, f]))
  const calcPlan = buildCalcPlan(schema)
  const calcIds = new Set(calcPlan.map(n => n.id))
  const calcById = new Map(calcPlan.map(n => [n.id, n]))

  const inputIds: string[] = []
  const seen = new Set<string>()
  const visiting = new Set<string>()

  function visit(id: string) {
    if (seen.has(id) || visiting.has(id)) return
    const node = calcById.get(id)
    if (node) {
      visiting.add(id)
      node.deps.forEach(visit)
      visiting.delete(id)
      seen.add(id)
      return
    }
    seen.add(id)
    const f = fieldById.get(id)
    if (f && INPUT_TYPES.has(f.type) && !inputIds.includes(id)) {
      inputIds.push(id)
    }
  }
  calcPlan.forEach(n => visit(n.id))

  const calcFields = allFields.filter(f => calcIds.has(f.id))
  const inputFields = inputIds
    .map(id => fieldById.get(id))
    .filter((f): f is FormField => !!f)

  return { calcFields, calcPlan, inputFields }
}

function pickDefaultOption(options: string[]): string {
  if (options.length === 0) return ''
  const nums = options.map(o => parseFloat(o))
  if (nums.every(n => Number.isFinite(n))) {
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length
    let bestIdx = 0
    let bestDiff = Infinity
    nums.forEach((n, i) => {
      const diff = Math.abs(n - avg)
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
    })
    return options[bestIdx]
  }
  return options[0]
}

function defaultValueFor(field: FormField): unknown {
  switch (field.type) {
    case 'number':
    case 'currency':
      return ''
    case 'checkbox':
      return false
    case 'select':
    case 'radio':
      return pickDefaultOption(field.options ?? [])
    default:
      return ''
  }
}

// Если результат не размечен маской в конструкторе (mask отсутствовал в старых
// сидах), пытаемся угадать «денежность» по формулировке лейбла/id — так же,
// как это делает витрина услуги для других разделов (см. benefits в
// ServiceDetailPage).
const CURRENCY_HINT_RE = /сумм|стоимост|плат[её]ж|аванс/i

function inferredMask(field: FormField): 'currency' | 'percent' | undefined {
  if (field.mask) return field.mask
  if (CURRENCY_HINT_RE.test(field.label || '') || CURRENCY_HINT_RE.test(field.id)) return 'currency'
  return undefined
}

function DigitInput({ field, value, onChange }: {
  field: FormField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const formatted = (value !== '' && value !== undefined && value !== null)
    ? formatCurrency(Number(value) || 0) : ''
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        inputMode="numeric"
        value={formatted}
        placeholder={field.placeholder || '0'}
        onChange={e => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits === '' ? '' : Number(digits))
        }}
        className="input"
        style={{ paddingRight: field.type === 'currency' ? 32 : 14 }}
      />
      {field.type === 'currency' && (
        <span style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--color-text-3)', fontSize: 13, pointerEvents: 'none',
        }}>₸</span>
      )}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--color-accent)' : 'var(--color-border-strong)',
        position: 'relative', flexShrink: 0, padding: 0, transition: 'background 150ms',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 19 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 150ms', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }} />
    </button>
  )
}

function CalcInputField({ field, value, onChange }: {
  field: FormField
  value: unknown
  onChange: (v: unknown) => void
}) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6, gap: 8,
      }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-2)' }}>
          {field.label}
        </label>
        {field.type === 'checkbox' && (
          <Toggle checked={Boolean(value)} onChange={onChange} />
        )}
      </div>

      {(field.type === 'number' || field.type === 'currency') && (
        <DigitInput field={field} value={value} onChange={onChange} />
      )}

      {(field.type === 'select' || field.type === 'radio') && (
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="select"
        >
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
    </div>
  )
}

export function ServiceCalculator({ schema }: { schema: FormSchema }) {
  const { calcFields, calcPlan, inputFields } = useMemo(() => resolveCalculator(schema), [schema])

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    inputFields.forEach(f => { init[f.id] = defaultValueFor(f) })
    return init
  })

  const numericInputs = useMemo(
    () => inputFields.filter(f => f.type === 'number' || f.type === 'currency'),
    [inputFields]
  )

  const ready = numericInputs.every(f => {
    const v = values[f.id]
    return v !== '' && v !== undefined && v !== null && Number.isFinite(Number(v))
  })

  const computed = useMemo(() => recomputeAll(calcPlan, values), [calcPlan, values])

  if (calcFields.length === 0) return null

  const handleChange = (id: string, val: unknown) => setValues(prev => ({ ...prev, [id]: val }))

  return (
    <div className="card svc-calc-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="svc-calc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* Параметры */}
        <div style={{ padding: 24, borderRight: '1px solid var(--color-border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
            fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--color-text-3)',
          }}>
            <I.Sliders size={14} /> Параметры расчёта
          </div>
          {inputFields.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
              Формула не использует входных параметров.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {inputFields.map(field => (
                <CalcInputField
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  onChange={v => handleChange(field.id, v)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Результат */}
        <div style={{ padding: 24, background: 'var(--color-surface-2)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
            fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--color-text-3)',
          }}>
            <I.Coins size={14} /> Результат
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {calcFields.map(field => {
              const mask = inferredMask(field)
              const display = ready ? formatCalcValue(mask, computed[field.id]) : '—'
              return (
                <div key={field.id}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 4 }}>
                    {field.label}
                  </div>
                  <div style={{
                    fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em',
                    color: ready ? 'var(--color-primary)' : 'var(--color-text-4)',
                    lineHeight: 1.2,
                  }}>
                    {display}
                  </div>
                </div>
              )
            })}
          </div>
          {!ready && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 16, lineHeight: 1.5 }}>
              Заполните все параметры слева, чтобы увидеть расчёт.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .svc-calc-grid { display: flex !important; flex-direction: column; }
          .svc-calc-grid > div:first-child { border-right: none !important; border-bottom: 1px solid var(--color-border); }
        }
      `}</style>
    </div>
  )
}
