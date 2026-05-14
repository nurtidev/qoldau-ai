import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Parser, type Expression } from 'expr-eval'
import type { FormSchema, FormField, FormStep } from '@/types'
import { I } from '@/components/icons'

interface Props {
  schema: FormSchema
  initialData?: Record<string, unknown>
  onSubmit: (data: Record<string, unknown>) => void
  submitting?: boolean
  /** Множество field.id, чьи значения пришли из eGov — на них рисуется бейдж */
  prefilledKeys?: Set<string>
  /** Ключ для localStorage-черновика. Если не задан — autosave выключен. */
  draftKey?: string
  /** Колбек на каждое изменение значений формы (для внешних подписчиков, например preflight) */
  onValuesChange?: (values: Record<string, unknown>) => void
  /** Если true — финальная кнопка «Подать заявку» заблокирована (например, есть стоп-факторы preflight). */
  submitBlocked?: boolean
  /** Текст подсказки при заблокированной отправке. */
  submitBlockedHint?: string
}

// ── formula evaluation ────────────────────────────────────────────────────────

const formulaParser = new Parser()

interface CalcNode {
  id: string
  expr: Expression
  deps: string[]
}

function buildCalcPlan(schema: FormSchema): CalcNode[] {
  const plan: CalcNode[] = []
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'calculated' && f.formula) {
        try {
          const expr = formulaParser.parse(f.formula)
          plan.push({ id: f.id, expr, deps: expr.variables() })
        } catch {
          // Invalid formula — skip; value will stay 0
        }
      }
    }
  }
  return plan
}

function evalNode(node: CalcNode, values: Record<string, unknown>): number {
  try {
    const scope: Record<string, number> = {}
    for (const v of node.deps) scope[v] = parseFloat(String(values[v])) || 0
    const r = node.expr.evaluate(scope)
    return Number.isFinite(r) ? Number(r) : 0
  } catch {
    return 0
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function checkCondition(
  condition: FormStep['condition'],
  values: Record<string, unknown>
): boolean {
  if (!condition) return true
  const val = values[condition.field_id]
  switch (condition.operator) {
    case 'equals':       return String(val) === String(condition.value)
    case 'not_equals':   return String(val) !== String(condition.value)
    case 'greater_than': return Number(val) > Number(condition.value)
    case 'less_than':    return Number(val) < Number(condition.value)
    default: return true
  }
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('ru-KZ').format(Math.round(val))
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('ru-KZ', { hour: '2-digit', minute: '2-digit' })
}

function errorForField(field: FormField): string {
  switch (field.type) {
    case 'file':       return `Загрузите файл${field.accept ? ` (${field.accept})` : ''}`
    case 'select':     return `Выберите вариант${field.label ? ` — ${field.label.toLowerCase()}` : ''}`
    case 'multiselect':return 'Отметьте хотя бы один вариант'
    case 'radio':      return 'Выберите один из вариантов'
    case 'checkbox':   return 'Подтвердите согласие'
    case 'date':       return 'Укажите дату'
    case 'currency':
    case 'number':     return `Укажите ${field.label?.toLowerCase() || 'значение'}`
    default:           return `Заполните поле «${field.label}»`
  }
}

function autocompleteFor(field: FormField): string | undefined {
  const pf = field.prefill_from
  if (pf === 'egov.org_name') return 'organization'
  if (pf === 'egov.phone')    return 'tel'
  if (pf === 'egov.address')  return 'street-address'
  if (pf === 'egov.iin' || pf === 'egov.bin') return 'off'
  return undefined
}

// ── main component ────────────────────────────────────────────────────────────

export function FormRenderer({
  schema, initialData = {}, onSubmit, submitting, prefilledKeys, draftKey,
  onValuesChange, submitBlocked, submitBlockedHint,
}: Props) {
  // Восстановление черновика из localStorage (только при первом монтировании)
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.values && typeof parsed.values === 'object') {
            return { ...initialData, ...parsed.values }
          }
        }
      } catch { /* ignore */ }
    }
    return initialData
  })

  const [currentStep, setCurrentStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<Date | null>(() => {
    if (!draftKey) return null
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.savedAt) return new Date(parsed.savedAt)
      }
    } catch { /* ignore */ }
    return null
  })

  const calcPlan = useMemo(() => buildCalcPlan(schema), [schema])

  // initialData приходит асинхронно (eGov-prefill) — доливаем недостающие ключи
  const prevInitialRef = useRef(initialData)
  useEffect(() => {
    if (initialData === prevInitialRef.current) return
    prevInitialRef.current = initialData
    setValues(prev => {
      const next = { ...prev }
      for (const [k, v] of Object.entries(initialData)) {
        if (next[k] === undefined || next[k] === '') next[k] = v
      }
      return next
    })
  }, [initialData])

  const visibleSteps = useMemo(
    () => schema.steps.filter(step => checkCondition(step.condition, values)),
    [schema.steps, values]
  )

  const getVisibleFields = useCallback(
    (step: FormStep) => step.fields.filter(f => checkCondition(f.condition, values)),
    [values]
  )

  // Виртуальный финальный шаг «Проверьте данные» — индекс = visibleSteps.length
  const reviewStepIndex = visibleSteps.length
  const isReviewStep = currentStep === reviewStepIndex

  // Clamp при изменении количества видимых шагов
  useEffect(() => {
    if (currentStep > reviewStepIndex) setCurrentStep(reviewStepIndex)
  }, [reviewStepIndex, currentStep])

  // Сообщаем родителю о текущих значениях (для preflight-движка)
  useEffect(() => {
    onValuesChange?.(values)
  }, [values, onValuesChange])

  // Autosave в localStorage (debounce 600 мс)
  useEffect(() => {
    if (!draftKey) return
    const t = setTimeout(() => {
      try {
        const serializable: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(values)) {
          if (v instanceof File) continue // File нельзя сериализовать
          serializable[k] = v
        }
        const now = new Date()
        localStorage.setItem(draftKey, JSON.stringify({
          values: serializable, savedAt: now.toISOString(),
        }))
        setSavedAt(now)
      } catch { /* quota / private mode — игнор */ }
    }, 600)
    return () => clearTimeout(t)
  }, [values, draftKey])

  const handleChange = useCallback((fieldId: string, value: unknown) => {
    setValues(prev => {
      const next = { ...prev, [fieldId]: value }
      // Пересчитываем только калькулируемые поля, чьи зависимости задеты
      const dirty = new Set<string>([fieldId])
      for (const node of calcPlan) {
        if (!node.deps.some(d => dirty.has(d))) continue
        next[node.id] = evalNode(node, next)
        dirty.add(node.id)
      }
      return next
    })
    setErrors(prev => ({ ...prev, [fieldId]: '' }))
  }, [calcPlan])

  const validateStep = (step: FormStep): boolean => {
    const newErrors: Record<string, string> = { ...errors }
    let hasError = false
    getVisibleFields(step).forEach(field => {
      if (field.required && field.type !== 'calculated') {
        const val = values[field.id]
        const isEmpty = val === undefined || val === null || val === '' ||
          (Array.isArray(val) && val.length === 0)
        if (isEmpty) {
          newErrors[field.id] = errorForField(field)
          hasError = true
        } else {
          delete newErrors[field.id]
        }
      }
    })
    setErrors(newErrors)
    return !hasError
  }

  const handleNext = () => {
    if (!validateStep(visibleSteps[currentStep])) return
    setCurrentStep(s => Math.min(s + 1, reviewStepIndex))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setCurrentStep(s => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const jumpToStep = (idx: number) => {
    setCurrentStep(idx)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = () => {
    // Валидируем все шаги перед отправкой
    const allErrors: Record<string, string> = {}
    let firstBadStep = -1
    visibleSteps.forEach((s, idx) => {
      getVisibleFields(s).forEach(field => {
        if (field.required && field.type !== 'calculated') {
          const val = values[field.id]
          const isEmpty = val === undefined || val === null || val === '' ||
            (Array.isArray(val) && val.length === 0)
          if (isEmpty) {
            allErrors[field.id] = errorForField(field)
            if (firstBadStep === -1) firstBadStep = idx
          }
        }
      })
    })
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      if (firstBadStep >= 0) {
        setCurrentStep(firstBadStep)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }
    const visibleFieldIds = new Set(
      visibleSteps.flatMap(s => getVisibleFields(s).map(f => f.id))
    )
    const cleanValues: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(values)) {
      if (visibleFieldIds.has(key)) cleanValues[key] = val
    }
    if (draftKey) {
      try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    }
    onSubmit(cleanValues)
  }

  const resetDraft = () => {
    if (!draftKey) return
    if (!confirm('Сбросить введённые данные и начать заново?')) return
    try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    setValues(initialData)
    setErrors({})
    setCurrentStep(0)
    setSavedAt(null)
  }

  if (visibleSteps.length === 0) return null

  // Счётчик обязательных полей для review-шага
  const totalRequired = visibleSteps.reduce(
    (n, s) => n + getVisibleFields(s).filter(f => f.required && f.type !== 'calculated').length, 0
  )
  const filledRequired = visibleSteps.reduce((n, s) => {
    return n + getVisibleFields(s).filter(f => {
      if (!f.required || f.type === 'calculated') return false
      const v = values[f.id]
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    }).length
  }, 0)

  return (
    <div>
      <StepProgress
        steps={visibleSteps}
        currentStep={currentStep}
        reviewStepIndex={reviewStepIndex}
        onJump={jumpToStep}
      />

      {draftKey && savedAt && !isReviewStep && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999,
          background: 'var(--color-success-soft)', color: '#047857',
          fontSize: 12, fontWeight: 500, marginBottom: 18,
        }}>
          <I.Check size={12} strokeWidth={3} />
          <span>Черновик сохранён в {formatTime(savedAt)}</span>
          <button
            type="button"
            onClick={resetDraft}
            style={{
              background: 'transparent', border: 'none', padding: 0, marginLeft: 4,
              color: '#047857', textDecoration: 'underline',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            сбросить
          </button>
        </div>
      )}

      {!isReviewStep ? (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 18px' }}>
            {visibleSteps[currentStep].title}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 28 }}>
            {getVisibleFields(visibleSteps[currentStep]).map(field => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                error={errors[field.id]}
                fromEgov={prefilledKeys?.has(field.id) ?? false}
                onChange={val => handleChange(field.id, val)}
              />
            ))}
          </div>
        </>
      ) : (
        <ReviewStep
          steps={visibleSteps}
          values={values}
          getVisibleFields={getVisibleFields}
          onEdit={jumpToStep}
          filledRequired={filledRequired}
          totalRequired={totalRequired}
        />
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, paddingTop: 16, borderTop: '1px solid var(--color-border)',
        flexWrap: 'wrap',
      }}>
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 0}
          aria-disabled={currentStep === 0}
          className="btn btn-secondary"
        >
          <I.ArrowLeft size={14} /> Назад
        </button>
        <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
          {isReviewStep
            ? 'Проверка перед отправкой'
            : `Шаг ${currentStep + 1} из ${visibleSteps.length}`}
        </span>
        {!isReviewStep ? (
          <button type="button" onClick={handleNext} className="btn btn-primary">
            {currentStep === visibleSteps.length - 1 ? 'К проверке' : 'Далее'} <I.ArrowRight size={14} />
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || submitBlocked}
              title={submitBlocked ? submitBlockedHint : undefined}
              className="btn"
              style={{
                background: submitBlocked ? 'var(--color-border-strong)' : 'var(--color-success)',
                color: '#fff',
                cursor: submitBlocked ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                    animation: 'spin 700ms linear infinite', display: 'inline-block',
                  }} />
                  Отправка…
                </>
              ) : (
                <>
                  <I.CheckCircle size={14} /> Подать заявку
                </>
              )}
            </button>
            {submitBlocked && submitBlockedHint && (
              <span style={{ fontSize: 12, color: 'var(--color-danger)', maxWidth: 320, textAlign: 'right' }}>
                {submitBlockedHint}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── StepProgress ──────────────────────────────────────────────────────────────

function StepProgress({ steps, currentStep, reviewStepIndex, onJump }: {
  steps: FormStep[]
  currentStep: number
  reviewStepIndex: number
  onJump: (i: number) => void
}) {
  const totalNodes = steps.length + 1
  const allNodes = [
    ...steps.map(s => ({ id: s.id, title: s.title, isReview: false })),
    { id: '__review__', title: 'Проверка', isReview: true },
  ]

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Мобильный вид — компактный */}
      <div className="form-progress-mobile" style={{ display: 'none' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 6 }}>
          Шаг {Math.min(currentStep + 1, totalNodes)} из {totalNodes}
          {currentStep === reviewStepIndex
            ? ' · Проверка'
            : steps[currentStep] ? ` · ${steps[currentStep].title}` : ''}
        </div>
        <div style={{
          height: 6, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${((currentStep + 1) / totalNodes) * 100}%`,
            background: 'var(--color-accent)',
            transition: 'width 200ms ease',
          }} />
        </div>
      </div>

      {/* Десктоп — кружки */}
      <div className="form-progress-desktop" style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {allNodes.map((s, i) => {
          const isPast = i < currentStep
          const isCurrent = i === currentStep
          const canJump = isPast

          const bg = isPast ? 'var(--color-success)'
                  : isCurrent ? 'var(--color-primary)'
                  : 'var(--color-surface-2)'
          const color = (isPast || isCurrent) ? '#fff' : 'var(--color-text-3)'
          const border = (isPast || isCurrent) ? 'none' : '1px solid var(--color-border-strong)'

          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, flex: '0 0 auto' }}>
                <button
                  type="button"
                  onClick={() => canJump && onJump(i)}
                  disabled={!canJump}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Шаг ${i + 1}: ${s.title}${isPast ? ', завершён' : isCurrent ? ', текущий' : ''}`}
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: bg, color, border,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, flexShrink: 0,
                    cursor: canJump ? 'pointer' : 'default',
                    padding: 0,
                  }}
                >
                  {isPast ? <I.Check size={14} strokeWidth={3} />
                   : s.isReview ? <I.Eye size={14} />
                   : i + 1}
                </button>
                <div style={{
                  fontSize: 11, marginTop: 6, maxWidth: 96, textAlign: 'center',
                  color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-3)',
                  fontWeight: isCurrent ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', lineHeight: 1.3,
                }}>
                  {s.title}
                </div>
              </div>
              {i < allNodes.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginTop: 14, marginLeft: 6, marginRight: 6,
                  background: isPast ? 'var(--color-success)' : 'var(--color-border)',
                  minWidth: 12,
                }} />
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .form-progress-desktop { display: none !important; }
          .form-progress-mobile  { display: block !important; }
        }
      `}</style>
    </div>
  )
}

// ── ReviewStep ────────────────────────────────────────────────────────────────

function ReviewStep({ steps, values, getVisibleFields, onEdit, filledRequired, totalRequired }: {
  steps: FormStep[]
  values: Record<string, unknown>
  getVisibleFields: (s: FormStep) => FormField[]
  onEdit: (i: number) => void
  filledRequired: number
  totalRequired: number
}) {
  const allFilled = filledRequired >= totalRequired

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
        Проверьте данные перед отправкой
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: '0 0 16px', lineHeight: 1.55 }}>
        После отправки изменить значения будет нельзя. Если что-то не так — нажмите «Изменить» рядом с этапом.
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 8, marginBottom: 20,
        background: allFilled ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
        color: allFilled ? '#047857' : '#92400E',
        fontSize: 13,
      }}>
        {allFilled ? <I.CheckCircle size={16} /> : <I.Alert size={16} />}
        <span>
          {allFilled
            ? `Заполнено всё необходимое: ${filledRequired} из ${totalRequired} обязательных полей.`
            : `Заполнено ${filledRequired} из ${totalRequired} обязательных полей. Вернитесь к этапу с пропусками.`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step, idx) => {
          const fields = getVisibleFields(step)
          return (
            <div key={step.id} style={{
              border: '1px solid var(--color-border)', borderRadius: 8,
              background: '#fff', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', background: 'var(--color-surface-2)',
                borderBottom: '1px solid var(--color-border)',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--color-primary)', color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{idx + 1}</div>
                <div style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{step.title}</div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onEdit(idx)}
                  style={{ fontSize: 12 }}
                >
                  <I.Sliders size={12} /> Изменить
                </button>
              </div>
              <div style={{ padding: '4px 16px' }}>
                {fields.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--color-text-3)', padding: '12px 0' }}>
                    Нет полей на этом этапе
                  </div>
                )}
                {fields.map((field, fi) => {
                  const val = values[field.id]
                  return (
                    <div key={field.id} style={{
                      display: 'grid', gridTemplateColumns: '220px 1fr',
                      gap: 16, padding: '10px 0',
                      borderTop: fi > 0 ? '1px solid var(--color-border)' : 'none',
                      fontSize: 13,
                    }}>
                      <div style={{ color: 'var(--color-text-3)' }}>
                        {field.label}
                        {field.required && <span style={{ color: 'var(--color-danger)', marginLeft: 4 }} aria-hidden="true">*</span>}
                      </div>
                      <div style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>
                        {formatValueForReview(field, val)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatValueForReview(field: FormField, val: unknown): React.ReactNode {
  const empty = val === undefined || val === null || val === '' ||
    (Array.isArray(val) && val.length === 0)
  if (empty) {
    return <span style={{ color: 'var(--color-text-4)' }}>— не указано</span>
  }
  if (val instanceof File) {
    const kb = (val.size / 1024).toFixed(0)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <I.Document size={13} /> {val.name}
        <span style={{ color: 'var(--color-text-3)' }}>· {kb} КБ</span>
      </span>
    )
  }
  if (field.type === 'currency' || (field.type === 'calculated' && field.mask === 'currency')) {
    return `${formatCurrency(Number(val) || 0)} ₸`
  }
  if (field.type === 'calculated' && field.mask === 'percent') {
    return `${(Number(val) || 0).toFixed(2)}%`
  }
  if (Array.isArray(val)) return val.join(', ')
  if (typeof val === 'boolean') return val ? 'Да' : 'Нет'
  return String(val)
}

// ── FieldRenderer ─────────────────────────────────────────────────────────────

interface FieldProps {
  field: FormField
  value: unknown
  error?: string
  fromEgov?: boolean
  onChange: (val: unknown) => void
}

function FieldRenderer({ field, value, error, fromEgov, onChange }: FieldProps) {
  const strVal = String(value ?? '')
  const numVal = Number(value ?? 0)

  if (field.type === 'calculated') {
    const mask = field.mask
    let display = '—'
    if (value !== undefined && value !== null && value !== '') {
      if (mask === 'currency')      display = formatCurrency(numVal) + ' ₸'
      else if (mask === 'percent')  display = numVal.toFixed(2) + '%'
      else display = numVal % 1 === 0 ? String(Math.round(numVal)) : numVal.toFixed(2)
    }
    return (
      <div>
        <FieldLabel field={field} fromEgov={false} />
        <div style={{
          padding: '10px 14px',
          background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
          borderRadius: 'var(--r-input)', fontWeight: 600,
          border: '1px solid #DBEAFE',
        }}>
          {display}
        </div>
      </div>
    )
  }

  if (field.type === 'currency') {
    const formatted = (value !== '' && value !== undefined && value !== null)
      ? formatCurrency(Number(value) || 0) : ''
    return (
      <div>
        <FieldLabel field={field} fromEgov={fromEgov} />
        <div style={{ position: 'relative' }}>
          <input
            id={field.id}
            type="text"
            inputMode="numeric"
            value={formatted}
            placeholder={field.placeholder || '0'}
            onChange={e => {
              const digits = e.target.value.replace(/\D/g, '')
              onChange(digits === '' ? '' : Number(digits))
            }}
            className={`input ${error ? 'is-error' : ''}`}
            style={{ paddingRight: 32 }}
            readOnly={field.readonly}
            aria-required={field.required}
            aria-invalid={!!error}
            aria-describedby={error ? `${field.id}-err` : undefined}
          />
          <span style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-text-3)', fontSize: 13, pointerEvents: 'none',
          }}>₸</span>
        </div>
        <FieldError id={`${field.id}-err`} error={error} />
      </div>
    )
  }

  return (
    <div>
      <FieldLabel field={field} fromEgov={fromEgov} />

      {(field.type === 'text' || field.type === 'number') && (
        <input
          id={field.id}
          type={field.type}
          inputMode={field.type === 'number' ? 'numeric' : undefined}
          autoComplete={autocompleteFor(field)}
          value={strVal}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          className={`input ${error ? 'is-error' : ''}`}
          readOnly={field.readonly}
          aria-required={field.required}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.id}-err` : undefined}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          id={field.id}
          value={strVal}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          className={`textarea ${error ? 'is-error' : ''}`}
          rows={4}
          aria-required={field.required}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.id}-err` : undefined}
        />
      )}

      {field.type === 'select' && (
        <select
          id={field.id}
          value={strVal}
          onChange={e => onChange(e.target.value)}
          className={`select ${error ? 'is-error' : ''}`}
          aria-required={field.required}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.id}-err` : undefined}
        >
          <option value="">
            {field.placeholder || `Выберите ${(field.label || '').toLowerCase()}`}
          </option>
          {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === 'multiselect' && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: 12, borderRadius: 'var(--r-input)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          background: '#fff',
        }}>
          {field.options?.map(opt => {
            const checked = Array.isArray(value) && (value as string[]).includes(opt)
            return (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    const current = Array.isArray(value) ? (value as string[]) : []
                    onChange(e.target.checked ? [...current, opt] : current.filter(v => v !== opt))
                  }}
                  style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
                />
                <span style={{ fontSize: 14 }}>{opt}</span>
              </label>
            )
          })}
        </div>
      )}

      {field.type === 'date' && (
        <input
          id={field.id}
          type="date"
          value={strVal}
          onChange={e => onChange(e.target.value)}
          className={`input ${error ? 'is-error' : ''}`}
          aria-required={field.required}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.id}-err` : undefined}
        />
      )}

      {field.type === 'checkbox' && (
        <label htmlFor={field.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            id={field.id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => onChange(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--color-accent)' }}
            aria-required={field.required}
            aria-invalid={!!error}
            aria-describedby={error ? `${field.id}-err` : undefined}
          />
          <span style={{ fontSize: 14, color: 'var(--color-text-2)' }}>
            {field.placeholder || field.label}
          </span>
        </label>
      )}

      {field.type === 'radio' && (
        <div role="radiogroup" aria-required={field.required} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {field.options?.map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={strVal === opt}
                onChange={e => onChange(e.target.value)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
              />
              <span style={{ fontSize: 14 }}>{opt}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'file' && (
        <FileField field={field} value={value} error={error} onChange={onChange} />
      )}

      <FieldError id={`${field.id}-err`} error={error} />
    </div>
  )
}

function FieldLabel({ field, fromEgov }: { field: FormField; fromEgov?: boolean }) {
  return (
    <label htmlFor={field.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-2)' }}>
        {field.label}
        {field.required && (
          <>
            <span style={{ color: 'var(--color-danger)', marginLeft: 4 }} aria-hidden="true">*</span>
            <span style={srOnly}>— обязательное поле</span>
          </>
        )}
      </span>
      {fromEgov && (
        <span
          title="Значение получено из реестра eGov. Вы можете его изменить."
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999,
            background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
            fontSize: 11, fontWeight: 500,
          }}>
          <I.Shield size={10} /> из eGov
        </span>
      )}
    </label>
  )
}

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <p id={id} role="alert" style={{ fontSize: 12, color: 'var(--color-danger)', margin: '6px 0 0' }}>
      {error}
    </p>
  )
}

// ── FileField ─────────────────────────────────────────────────────────────────

function FileField({ field, value, error, onChange }: {
  field: FormField
  value: unknown
  error?: string
  onChange: (val: unknown) => void
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const file = value instanceof File ? value : null

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onChange(f)
  }

  if (file) {
    const kb = (file.size / 1024).toFixed(0)
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 'var(--r-input)',
        border: '1px solid var(--color-border)', background: '#fff',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 6, flexShrink: 0,
          background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <I.Document size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{kb} КБ</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="btn btn-ghost btn-sm"
          aria-label="Удалить файл"
          style={{ width: 32, padding: 0 }}
        >
          <I.X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label={`Загрузить файл${field.label ? `: ${field.label}` : ''}`}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        style={{
          padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
          borderRadius: 'var(--r-input)',
          border: `1.5px dashed ${error ? 'var(--color-danger)' : dragging ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
          background: dragging ? 'var(--color-accent-soft)' : '#fff',
          transition: 'all 120ms',
        }}
      >
        <I.Upload size={20} style={{ color: 'var(--color-text-3)' }} />
        <div style={{ fontSize: 13, color: 'var(--color-text-2)', fontWeight: 500, marginTop: 6 }}>
          Перетащите файл или нажмите для выбора
        </div>
        {field.accept && (
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
            Форматы: {field.accept}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        id={field.id}
        type="file"
        accept={field.accept}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />
    </div>
  )
}