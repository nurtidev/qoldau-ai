// =====================================================================
// Движок «Предварительная оценка заявителя» (по мотивам AgroScore).
// Чистый TypeScript, без React. Все данные — mock (eGov + КГД).
// Веса факторов в сумме дают 1.0.
//
// Вход:  { egov, kgd, requestedAmount? }
// Выход: { score 0–100, band A/B/C/D, factors[], preapprovedLimit, recommendations[] }
//
// ВАЖНО: это не решение о выдаче, а справочная предоценка по открытым
// данным eGov и КГД. Честная подпись выводится в UI (PrescoreCard).
// =====================================================================

import type { KGDData } from '@/api/client'
import type { FormSchema } from '@/types'

export type Band = 'A' | 'B' | 'C' | 'D'

export interface PrescoreFactor {
  id: string
  label: string
  score: number // вклад фактора 0–100 (bucket)
  weight: number // вес 0–1
  hint: string // человеко-понятная подсказка
}

export interface PrescoreResult {
  score: number // итоговый балл 0–100
  band: Band
  factors: PrescoreFactor[]
  preapprovedLimit: number // предодобряемый лимит, ₸
  recommendations: string[]
}

/** Снимок результата для сохранения в form_data._prescore (факторы без hint). */
export interface PrescoreSnapshot {
  score: number
  band: Band
  preapprovedLimit: number
  factors: { id: string; label: string; score: number; weight: number }[]
}

export interface PrescoreInput {
  egov: Record<string, unknown> | null
  kgd: KGDData | null
  requestedAmount?: number
}

// ── утилиты ────────────────────────────────────────────────────────────────
function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

/** Возраст компании в годах по дате регистрации (ISO-строка). */
function yearsSince(dateStr: unknown): number {
  if (typeof dateStr !== 'string' || !dateStr) return 0
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 0
  const ms = Date.now() - d.getTime()
  return Math.max(0, ms / (365.25 * 24 * 3600 * 1000))
}

/** Последняя (самая свежая) годовая выручка из истории КГД. */
function latestRevenue(kgd: KGDData): number {
  const arr = kgd.annual_revenue ?? []
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a.year - b.year)
  return sorted[sorted.length - 1]?.amount ?? 0
}

/** Средний рост выручки год-к-году, доля (0.15 = +15%). */
function revenueGrowth(kgd: KGDData): number {
  const arr = [...(kgd.annual_revenue ?? [])].sort((a, b) => a.year - b.year)
  if (arr.length < 2) return 0
  let sum = 0
  let n = 0
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1].amount
    const curr = arr[i].amount
    if (prev > 0) {
      sum += (curr - prev) / prev
      n++
    }
  }
  return n > 0 ? sum / n : 0
}

// ── фактор 1: Налоговая дисциплина (вес 0.30) ────────────────────────────────
// Долги (налог/пенсия) = 0, compliance_status, реестр риска, нарушения.
function calcTaxDiscipline(kgd: KGDData): { bucket: number; hint: string } {
  let s = 100
  if (kgd.current_tax_debt > 0) s -= 45
  if (kgd.current_pension_debt > 0) s -= 25
  if (kgd.in_risk_register) s -= 40
  if (kgd.compliance_status === 'attention') s -= 20
  else if (kgd.compliance_status === 'blocked') s -= 60
  const violations = Array.isArray(kgd.violations) ? kgd.violations.length : 0
  s -= Math.min(violations * 10, 30)

  const bucket = clamp(s)
  const hint =
    bucket >= 85
      ? 'Налоговая дисциплина в порядке — задолженностей и нарушений нет'
      : kgd.current_tax_debt > 0 || kgd.current_pension_debt > 0
        ? 'Погашение налоговой и пенсионной задолженности заметно повысит балл'
        : kgd.in_risk_register
          ? 'Компания в реестре риска — устранение снизит стоп-факторы'
          : 'Соблюдение налоговой дисциплины повышает балл'
  return { bucket, hint }
}

// ── фактор 2: Финансовая устойчивость (вес 0.25) ─────────────────────────────
// Абсолютная выручка + средний рост год-к-году.
function calcFinancialStability(kgd: KGDData): { bucket: number; hint: string } {
  const revenue = latestRevenue(kgd)
  const growth = revenueGrowth(kgd)

  // Бенчмарк: 250 млн ₸/год → 100 баллов по масштабу.
  const revenueScore = clamp((revenue / 250_000_000) * 100)

  // Рост: +15% и выше → 100; стагнация → 50; спад → низко.
  let growthScore: number
  if (growth >= 0.15) growthScore = 100
  else if (growth >= 0.1) growthScore = 85
  else if (growth >= 0.05) growthScore = 70
  else if (growth >= 0) growthScore = 50
  else if (growth >= -0.1) growthScore = 30
  else growthScore = 12

  const bucket = clamp(revenueScore * 0.5 + growthScore * 0.5)
  const hint =
    growth < 0
      ? 'Выручка снижается год-к-году — восстановление динамики улучшит оценку'
      : bucket >= 80
        ? 'Устойчивая выручка и положительная динамика'
        : 'Рост выручки повышает финансовую устойчивость'
  return { bucket, hint }
}

// ── фактор 3: Зрелость бизнеса (вес 0.15) ────────────────────────────────────
// Возраст компании (по registered_at eGov) + число сотрудников (КГД).
function calcBusinessMaturity(
  egov: Record<string, unknown> | null,
  kgd: KGDData,
): { bucket: number; hint: string } {
  const regDate = egov?.registered_at ?? kgd.registration_date
  const age = yearsSince(regDate)
  const employees = kgd.employees_count ?? 0

  // 5+ лет → 100; линейно до этого.
  const ageScore = clamp((age / 5) * 100)
  // 50+ сотрудников → 100.
  const empScore = clamp((employees / 50) * 100)

  const bucket = clamp(ageScore * 0.6 + empScore * 0.4)
  const hint =
    age < 1
      ? 'Молодой бизнес (менее года) — история ещё формируется'
      : bucket >= 75
        ? 'Зрелый бизнес с устойчивым штатом'
        : 'С возрастом компании и ростом штата балл повышается'
  return { bucket, hint }
}

// ── фактор 4: Долговая нагрузка запроса (вес 0.20) ───────────────────────────
// Отношение запрашиваемой суммы к годовой выручке.
function calcRequestBurden(
  kgd: KGDData,
  requestedAmount?: number,
): { bucket: number; hint: string } {
  const revenue = latestRevenue(kgd)
  // Суммы нет или выручка неизвестна → нейтральные 60 баллов.
  if (!requestedAmount || requestedAmount <= 0 || revenue <= 0) {
    return {
      bucket: 60,
      hint: 'Сумма запроса не указана — учтён нейтральный уровень нагрузки',
    }
  }

  const ratio = requestedAmount / revenue
  let bucket: number
  if (ratio < 0.1) bucket = 100
  else if (ratio < 0.25) bucket = 85
  else if (ratio < 0.5) bucket = 65
  else if (ratio < 0.8) bucket = 40
  else if (ratio < 1.2) bucket = 20
  else bucket = 5

  const hint =
    ratio >= 0.8
      ? 'Запрос сопоставим с годовой выручкой — рассмотрите меньшую сумму или залог'
      : ratio >= 0.5
        ? 'Умеренно высокая нагрузка относительно выручки'
        : 'Комфортное соотношение суммы запроса и выручки'
  return { bucket, hint }
}

// ── фактор 5: Формальные признаки (вес 0.10) ─────────────────────────────────
// Статус НДС-плательщика и налоговый режим.
function calcFormalSigns(kgd: KGDData): { bucket: number; hint: string } {
  let s = 40
  if (kgd.is_vat_payer) s += 30
  const regime = (kgd.tax_regime || '').toLowerCase()
  if (regime.includes('оур') || regime.includes('общеустановлен')) s += 30
  else if (regime) s += 15

  const bucket = clamp(s)
  const hint = kgd.is_vat_payer
    ? 'Статус НДС-плательщика и прозрачный налоговый режим — плюс к оценке'
    : 'Регистрация НДС и переход на общеустановленный режим повышают балл'
  return { bucket, hint }
}

// ── пороги бэндов ────────────────────────────────────────────────────────────
function bandFor(score: number): Band {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

// Предодобряемый лимит: доля годовой выручки в зависимости от бэнда.
const LIMIT_SHARE: Record<Band, number> = { A: 0.4, B: 0.25, C: 0.1, D: 0 }

// ── публичная функция ─────────────────────────────────────────────────────────
export function computePrescore(input: PrescoreInput): PrescoreResult | null {
  const { egov, kgd, requestedAmount } = input
  if (!kgd) return null

  const tax = calcTaxDiscipline(kgd)
  const fin = calcFinancialStability(kgd)
  const mat = calcBusinessMaturity(egov, kgd)
  const burden = calcRequestBurden(kgd, requestedAmount)
  const formal = calcFormalSigns(kgd)

  const factors: PrescoreFactor[] = [
    { id: 'tax', label: 'Налоговая дисциплина', score: Math.round(tax.bucket), weight: 0.3, hint: tax.hint },
    { id: 'finance', label: 'Финансовая устойчивость', score: Math.round(fin.bucket), weight: 0.25, hint: fin.hint },
    { id: 'maturity', label: 'Зрелость бизнеса', score: Math.round(mat.bucket), weight: 0.15, hint: mat.hint },
    { id: 'burden', label: 'Долговая нагрузка запроса', score: Math.round(burden.bucket), weight: 0.2, hint: burden.hint },
    { id: 'formal', label: 'Формальные признаки', score: Math.round(formal.bucket), weight: 0.1, hint: formal.hint },
  ]

  const raw =
    tax.bucket * 0.3 +
    fin.bucket * 0.25 +
    mat.bucket * 0.15 +
    burden.bucket * 0.2 +
    formal.bucket * 0.1
  const score = Math.round(clamp(raw))
  const band = bandFor(score)

  const revenue = latestRevenue(kgd)
  const preapprovedLimit = Math.round(revenue * LIMIT_SHARE[band])

  // Рекомендации: от самых слабых факторов + общий вывод по бэнду.
  const recommendations: string[] = []
  const weakest = [...factors].sort((a, b) => a.score - b.score)
  for (const f of weakest) {
    if (f.score < 70 && recommendations.length < 3) recommendations.push(f.hint)
  }
  if (band === 'A') {
    recommendations.unshift('Профиль соответствует высшей категории — можно подавать заявку на предодобренный лимит')
  } else if (band === 'D') {
    recommendations.unshift('Профиль ниже порога предодобрения — устраните стоп-факторы перед подачей')
  }

  return { score, band, factors, preapprovedLimit, recommendations }
}

// ── снимок для сохранения в заявке ───────────────────────────────────────────
export function toPrescoreSnapshot(r: PrescoreResult): PrescoreSnapshot {
  return {
    score: r.score,
    band: r.band,
    preapprovedLimit: r.preapprovedLimit,
    factors: r.factors.map(({ id, label, score, weight }) => ({ id, label, score, weight })),
  }
}

// ── эвристика: сумма запроса из данных формы ──────────────────────────────────
// Приоритет 1: поле (включая calculated — итог расчёта уже лежит в values),
// чей id/label содержит «запрашива» — это и есть сумма запроса.
// Приоритет 2: currency/number с «сумм»/sum/amount/финансир, кроме цен за
// единицу («стоимость единицы» — не сумма запроса).
const AMOUNT_PRIMARY_RE = /запрашива/i
const AMOUNT_FALLBACK_RE = /(sum|amount|сумм|финансир)/i
const AMOUNT_EXCLUDE_RE = /(стоимост|единиц|unit)/i

export function extractRequestedAmount(
  schema: FormSchema | undefined,
  values: Record<string, unknown>,
): number | undefined {
  if (!schema) return undefined
  const positive = (id: string): number | undefined => {
    const v = Number(values[id])
    return Number.isFinite(v) && v > 0 ? v : undefined
  }
  let fallback: number | undefined
  for (const step of schema.steps) {
    for (const f of step.fields) {
      const text = `${f.id} ${f.label || ''}`
      const numeric = f.type === 'currency' || f.type === 'number' || f.type === 'calculated'
      if (!numeric) continue
      if (AMOUNT_PRIMARY_RE.test(text)) {
        const v = positive(f.id)
        if (v !== undefined) return v
      }
      if (fallback === undefined && f.type !== 'calculated'
          && AMOUNT_FALLBACK_RE.test(text) && !AMOUNT_EXCLUDE_RE.test(text)) {
        fallback = positive(f.id)
      }
    }
  }
  return fallback
}
