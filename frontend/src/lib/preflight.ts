import type {
  EligibilityCheck,
  EligibilityLevel,
  EligibilityRule,
  EligibilityRuleset,
} from '@/types'
import type { KGDData } from '@/api/client'

export interface RiskItem {
  id: string
  level: EligibilityLevel
  status: 'ok' | 'fail' | 'pending'
  title: string
  message: string
  detail?: string
}

export interface PreflightContext {
  formData: Record<string, unknown>
  egov: Record<string, unknown> | null
  kgd: KGDData | null
}

/** Дата вида "YYYY-MM-DD" → возраст в месяцах относительно текущей даты. */
function monthsBetween(dateStr: string): number | null {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

/** Производные значения из КГД, на которые ссылается DSL. */
function derivedKGD(kgd: KGDData, field: string): unknown {
  switch (field) {
    case 'business_age_months':
      return monthsBetween(kgd.registration_date)
    case 'annual_revenue_latest': {
      const arr = kgd.annual_revenue
      return arr.length ? arr[arr.length - 1].amount : null
    }
    case 'annual_revenue_avg': {
      if (kgd.annual_revenue.length === 0) return null
      const sum = kgd.annual_revenue.reduce((s, r) => s + r.amount, 0)
      return sum / kgd.annual_revenue.length
    }
    default:
      return undefined
  }
}

function resolveSource(check: EligibilityCheck, ctx: PreflightContext): unknown {
  switch (check.source) {
    case 'form':
      return ctx.formData[check.field]
    case 'egov':
      return ctx.egov?.[check.field]
    case 'kgd':
      return ctx.kgd ? (ctx.kgd as unknown as Record<string, unknown>)[check.field] : undefined
    case 'kgd_derived':
      return ctx.kgd ? derivedKGD(ctx.kgd, check.field) : undefined
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isPending(v: unknown): boolean {
  return v === undefined || v === null || v === ''
}

function evalCheck(check: EligibilityCheck, ctx: PreflightContext): 'ok' | 'fail' | 'pending' {
  const raw = resolveSource(check, ctx)

  if (check.op === 'truthy') {
    if (isPending(raw)) return 'pending'
    return raw === true || raw === 'true' || raw === 1 ? 'ok' : 'fail'
  }
  if (check.op === 'falsy') {
    if (isPending(raw)) return 'pending'
    return raw === false || raw === 'false' || raw === 0 ? 'ok' : 'fail'
  }
  if (check.op === 'eq') {
    if (isPending(raw)) return 'pending'
    return raw === check.value ? 'ok' : 'fail'
  }
  if (check.op === 'ne') {
    if (isPending(raw)) return 'pending'
    return raw !== check.value ? 'ok' : 'fail'
  }
  if (check.op === 'between') {
    const n = toNumber(raw)
    if (n === null) return 'pending'
    const range = check.value as [unknown, unknown] | undefined
    const lo = toNumber(range?.[0])
    const hi = toNumber(range?.[1])
    if (lo === null || hi === null) return 'pending'
    return n >= lo && n <= hi ? 'ok' : 'fail'
  }
  const n = toNumber(raw)
  const t = toNumber(check.value)
  if (n === null || t === null) return 'pending'
  switch (check.op) {
    case 'gt':  return n >  t ? 'ok' : 'fail'
    case 'gte': return n >= t ? 'ok' : 'fail'
    case 'lt':  return n <  t ? 'ok' : 'fail'
    case 'lte': return n <= t ? 'ok' : 'fail'
  }
  return 'pending'
}

function ruleToRisk(rule: EligibilityRule, ctx: PreflightContext): RiskItem {
  const status = evalCheck(rule.check, ctx)
  let message: string
  if (status === 'ok') message = rule.ok_label ?? `${rule.title} — OK`
  else if (status === 'fail') message = rule.fail_label ?? `${rule.title} — не выполнено`
  else message = `${rule.title} — данные ещё не заполнены`
  return {
    id: rule.id,
    level: rule.level,
    status,
    title: rule.title,
    message,
    detail: rule.detail,
  }
}

export interface PreflightResult {
  risks: RiskItem[]
  hasBlocking: boolean
  failingCount: number
}

export function evaluatePreflight(
  ruleset: EligibilityRuleset | undefined,
  ctx: PreflightContext,
): PreflightResult {
  const rules = ruleset?.rules ?? []
  const risks = rules.map(r => ruleToRisk(r, ctx))
  const hasBlocking = risks.some(r => r.level === 'blocking' && r.status === 'fail')
  const failingCount = risks.filter(r => r.status === 'fail').length
  return { risks, hasBlocking, failingCount }
}
