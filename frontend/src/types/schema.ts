import { z } from 'zod'
import type { FormField, FormStep, FormSchema } from './index'

const FIELD_TYPES = [
  'text', 'textarea', 'number', 'currency',
  'select', 'multiselect', 'radio', 'checkbox',
  'date', 'file', 'calculated',
] as const

const CONDITION_OPS = ['equals', 'not_equals', 'greater_than', 'less_than'] as const

const zCondition = z.object({
  field_id: z.string().min(1),
  operator: z.enum(CONDITION_OPS),
  value: z.union([z.string(), z.number()]),
})

const zFormField = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(FIELD_TYPES),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  mask: z.enum(['currency', 'percent']).optional(),
  formula: z.string().optional(),
  readonly: z.boolean().optional(),
  accept: z.string().optional(),
  prefill_from: z.string().optional(),
  condition: zCondition.optional(),
})

const zFormStep = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  fields: z.array(zFormField).min(1),
  condition: zCondition.optional(),
})

export const zFormSchema = z.object({
  steps: z.array(zFormStep).min(1),
})

export type ParsedFormField = z.infer<typeof zFormField>
export type ParsedFormStep = z.infer<typeof zFormStep>

/**
 * Parse AI-generated form schema. Returns hydrated steps with guaranteed ids
 * for every step and field. Throws with a human-readable message on validation
 * failure so the admin sees *why* the generation failed.
 */
export function parseAiFormSchema(raw: string): FormStep[] {
  const cleaned = raw
    .trim()
    .replace(/^```json\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  let json: unknown
  try {
    json = JSON.parse(cleaned)
  } catch {
    throw new Error('AI вернул невалидный JSON')
  }

  const result = zFormSchema.safeParse(json)
  if (!result.success) {
    throw new Error(formatZodError(result.error))
  }

  return result.data.steps.map((s, i) => ({
    id: s.id || `s${i + 1}_ai`,
    title: s.title,
    condition: s.condition,
    fields: s.fields.map((f, j): FormField => ({
      id: f.id || `f${i + 1}_${j + 1}_ai`,
      type: f.type,
      label: f.label,
      placeholder: f.placeholder,
      required: f.required,
      options: f.options,
      mask: f.mask,
      formula: f.formula,
      readonly: f.readonly,
      accept: f.accept,
      prefill_from: f.prefill_from,
      condition: f.condition,
    })),
  }))
}

function formatZodError(err: z.ZodError): string {
  const first = err.issues[0]
  if (!first) return 'AI вернул структуру, не соответствующую формату'

  const path = first.path.map(String)
  const pathStr = path.join('.') || 'root'
  const leaf = path[path.length - 1] ?? ''
  const received = (first as { received?: unknown }).received

  if (leaf === 'type') {
    const got = received !== undefined ? `«${String(received)}»` : ''
    return `AI выдал недопустимый тип поля ${got}. Допустимы: ${FIELD_TYPES.join(', ')}`
  }
  if (leaf === 'operator') {
    const got = received !== undefined ? `«${String(received)}»` : ''
    return `AI выдал недопустимый оператор условия ${got}. Допустимы: ${CONDITION_OPS.join(', ')}`
  }

  return `AI выдал некорректную структуру (${pathStr}): ${first.message}`
}

// Re-export for future use (e.g. validating service.form_schema from API).
export type { FormSchema }
