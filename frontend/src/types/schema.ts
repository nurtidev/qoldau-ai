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

  // Claude часто кладёт "mask": null / "options": null для полей,
  // где значение не нужно. zod .optional() пропускает undefined, но не null,
  // поэтому до валидации рекурсивно вычищаем все null-ключи.
  json = stripNulls(json)

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

function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue
      out[k] = stripNulls(v)
    }
    return out
  }
  return value
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

// ─── service_meta extraction ──────────────────────────────────────────────────
// AI also returns top-level service_meta with title/category/org/program-terms.
// All fields are optional — if Claude couldn't infer them, we just don't override.

export interface AiServiceMeta {
  title?:           string
  description?:     string
  category?:        string
  org_name?:        string
  interest_rate?:   string
  max_amount?:      string
  max_term_months?: string
}

const zAiServiceMeta = z.object({
  title:           z.string().optional(),
  description:     z.string().optional(),
  category:        z.string().optional(),
  org_name:        z.string().optional(),
  interest_rate:   z.string().optional(),
  max_amount:      z.string().optional(),
  max_term_months: z.string().optional(),
})

/** Soft-parse AI service_meta. Returns empty object on any failure. */
export function parseAiServiceMeta(raw: string): AiServiceMeta {
  const cleaned = raw.trim().replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
  let json: unknown
  try { json = JSON.parse(cleaned) } catch { return {} }
  const stripped = stripNulls(json) as { service_meta?: unknown } | null
  if (!stripped || typeof stripped !== 'object') return {}
  const parsed = zAiServiceMeta.safeParse(stripped.service_meta ?? {})
  return parsed.success ? parsed.data : {}
}
