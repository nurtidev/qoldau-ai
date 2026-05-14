import { useState, useEffect, useCallback, useRef } from 'react'
import type { FormSchema, FormField, FormStep } from '@/types'

interface Props {
  schema: FormSchema
  initialData?: Record<string, unknown>
  onSubmit: (data: Record<string, unknown>) => void
  submitting?: boolean
}

function evaluateFormula(formula: string, values: Record<string, unknown>): number {
  try {
    // Replace field IDs with their numeric values
    let expr = formula
    Object.entries(values).forEach(([id, val]) => {
      const num = parseFloat(String(val)) || 0
      expr = expr.replace(new RegExp(`\\b${id}\\b`, 'g'), String(num))
    })
    // Safe eval using Function
    return Number(new Function('return ' + expr)()) || 0
  } catch {
    return 0
  }
}

function checkCondition(
  condition: FormStep['condition'],
  values: Record<string, unknown>
): boolean {
  if (!condition) return true
  const val = values[condition.field_id]
  switch (condition.operator) {
    case 'equals':     return String(val) === String(condition.value)
    case 'not_equals': return String(val) !== String(condition.value)
    case 'greater_than': return Number(val) > Number(condition.value)
    case 'less_than':    return Number(val) < Number(condition.value)
    default: return true
  }
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('ru-KZ').format(Math.round(val))
}

export function FormRenderer({ schema, initialData = {}, onSubmit, submitting }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [values, setValues] = useState<Record<string, unknown>>(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const prevVisibleCount = useRef(0)

  const visibleSteps = schema.steps.filter((step) =>
    checkCondition(step.condition, values)
  )

  const getVisibleFields = (step: FormStep) =>
    step.fields.filter(f => checkCondition(f.condition, values))

  // Clamp currentStep when visible steps shrink (e.g. conditional step hides)
  useEffect(() => {
    if (currentStep >= visibleSteps.length && visibleSteps.length > 0) {
      setCurrentStep(visibleSteps.length - 1)
    }
    prevVisibleCount.current = visibleSteps.length
  }, [visibleSteps.length, currentStep])

  const handleChange = useCallback((fieldId: string, value: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [fieldId]: value }
      // Recalculate all calculated fields
      schema.steps.forEach((step) => {
        step.fields.forEach((field) => {
          if (field.type === 'calculated' && field.formula) {
            next[field.id] = evaluateFormula(field.formula, next)
          }
        })
      })
      return next
    })
    setErrors((prev) => ({ ...prev, [fieldId]: '' }))
  }, [schema])

  const validateStep = (step: FormStep): boolean => {
    const newErrors: Record<string, string> = {}
    getVisibleFields(step).forEach((field) => {
      if (field.required && field.type !== 'calculated') {
        const val = values[field.id]
        const isEmpty = val === undefined || val === null || val === '' ||
          (Array.isArray(val) && val.length === 0)
        if (isEmpty) {
          newErrors[field.id] = 'Обязательное поле'
        }
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (!validateStep(visibleSteps[currentStep])) return
    setCurrentStep((s) => Math.min(s + 1, visibleSteps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = () => {
    if (!validateStep(visibleSteps[currentStep])) return
    const visibleFieldIds = new Set(
      visibleSteps.flatMap(s => getVisibleFields(s).map(f => f.id))
    )
    const cleanValues: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(values)) {
      if (visibleFieldIds.has(key)) cleanValues[key] = val
    }
    onSubmit(cleanValues)
  }

  const step = visibleSteps[currentStep]
  if (!step) return null

  return (
    <div>
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          {visibleSteps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < currentStep ? 'bg-green-500 text-white' :
                i === currentStep ? 'bg-primary-600 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              {i < visibleSteps.length - 1 && (
                <div className={`h-0.5 flex-1 min-w-8 ${i < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          {visibleSteps.map((s, i) => (
            <span key={s.id} className={i === currentStep ? 'text-primary-600 font-medium' : ''}>
              {s.title}
            </span>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="space-y-5 mb-8">
        {getVisibleFields(step).map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            error={errors[field.id]}
            onChange={(val) => handleChange(field.id, val)}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="btn-secondary"
        >
          ← Назад
        </button>
        <span className="text-sm text-gray-500">
          Шаг {currentStep + 1} из {visibleSteps.length}
        </span>
        {currentStep < visibleSteps.length - 1 ? (
          <button type="button" onClick={handleNext} className="btn-primary">
            Далее →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary bg-green-600 hover:bg-green-700"
          >
            {submitting ? 'Отправка...' : 'Подать заявку'}
          </button>
        )}
      </div>
    </div>
  )
}

interface FieldProps {
  field: FormField
  value: unknown
  error?: string
  onChange: (val: unknown) => void
}

function FieldRenderer({ field, value, error, onChange }: FieldProps) {
  const strVal = String(value ?? '')
  const numVal = Number(value ?? 0)

  if (field.type === 'calculated') {
    const mask = field.mask
    let display = strVal
    if (mask === 'currency') display = formatCurrency(numVal) + ' ₸'
    else if (mask === 'percent') display = numVal.toFixed(2) + '%'
    else display = numVal % 1 === 0 ? String(Math.round(numVal)) : numVal.toFixed(2)

    return (
      <div>
        <label className="label">{field.label}</label>
        <div className="input bg-blue-50 text-blue-800 font-semibold cursor-default">
          {display || '—'}
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {(field.type === 'text' || field.type === 'number') && (
        <input
          type={field.type}
          value={strVal}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.type === 'number' ? e.target.value : e.target.value)}
          className={`input ${error ? 'border-red-400' : ''}`}
          readOnly={field.readonly}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={strVal}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`input min-h-24 resize-y ${error ? 'border-red-400' : ''}`}
          rows={4}
        />
      )}

      {field.type === 'select' && (
        <select
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${error ? 'border-red-400' : ''}`}
        >
          <option value="">Выберите...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === 'multiselect' && (
        <div className={`space-y-2 mt-1 rounded-lg border p-3 ${error ? 'border-red-400' : 'border-gray-200'}`}>
          {field.options?.map((opt) => {
            const checked = Array.isArray(value) && (value as string[]).includes(opt)
            return (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? (value as string[]) : []
                    onChange(e.target.checked ? [...current, opt] : current.filter(v => v !== opt))
                  }}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm">{opt}</span>
              </label>
            )
          })}
        </div>
      )}

      {field.type === 'date' && (
        <input
          type="date"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${error ? 'border-red-400' : ''}`}
        />
      )}

      {field.type === 'checkbox' && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 text-primary-600"
          />
          <span className="text-sm text-gray-600">{field.placeholder}</span>
        </div>
      )}

      {field.type === 'radio' && (
        <div className="space-y-2 mt-1">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={opt}
                checked={strVal === opt}
                onChange={(e) => onChange(e.target.value)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'currency' && (
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={strVal}
            placeholder={field.placeholder || '0'}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
            className={`input ${error ? 'border-red-400' : ''}`}
            style={{ paddingRight: 32, fontFamily: 'monospace' }}
            readOnly={field.readonly}
          />
          <span style={{ position: 'absolute', right: 12, top: 9, color: 'var(--color-text-3)', fontSize: 13, pointerEvents: 'none' }}>₸</span>
        </div>
      )}

      {field.type === 'file' && (
        <input
          type="file"
          accept={field.accept}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
        />
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
