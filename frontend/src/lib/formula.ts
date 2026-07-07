// Общий движок вычисления `calculated`-полей формы (formula: JS-выражение
// с id других полей как переменными). Используется как в FormRenderer
// (пошаговая подача заявки), так и в ServiceCalculator (публичный виджет
// на странице услуги, авто-собираемый из form_schema).
import { Parser, type Expression } from 'expr-eval'
import type { FormSchema } from '@/types'

export const formulaParser = new Parser()

export interface CalcNode {
  id: string
  expr: Expression
  deps: string[]
}

/** Собирает план вычисления всех calculated-полей схемы (в порядке их объявления). */
export function buildCalcPlan(schema: FormSchema): CalcNode[] {
  const plan: CalcNode[] = []
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'calculated' && f.formula) {
        try {
          const expr = formulaParser.parse(f.formula)
          plan.push({ id: f.id, expr, deps: expr.variables() })
        } catch {
          // Невалидная формула — пропускаем, значение останется 0
        }
      }
    }
  }
  return plan
}

function coerceNum(raw: unknown): number {
  if (typeof raw === 'boolean') return raw ? 1 : 0
  const n = parseFloat(String(raw))
  return Number.isFinite(n) ? n : 0
}

/** Вычисляет один calculated-узел по текущим значениям формы (не рекурсивно по calc-цепочкам). */
export function evalNode(node: CalcNode, values: Record<string, unknown>): number {
  try {
    const scope: Record<string, number> = {}
    for (const v of node.deps) scope[v] = coerceNum(values[v])
    const r = node.expr.evaluate(scope)
    return Number.isFinite(r) ? Number(r) : 0
  } catch {
    return 0
  }
}

/**
 * Полный пересчёт всех calculated-полей с нуля, включая цепочки
 * calculated → calculated (например, an19 зависит от an17, а an17 сам calculated).
 * Несколько проходов гарантируют сходимость независимо от порядка объявления
 * полей в схеме (для DAG без циклов).
 */
export function recomputeAll(
  calcPlan: CalcNode[],
  baseValues: Record<string, unknown>
): Record<string, unknown> {
  const values = { ...baseValues }
  const passes = Math.max(1, calcPlan.length)
  for (let pass = 0; pass < passes; pass++) {
    for (const node of calcPlan) {
      values[node.id] = evalNode(node, values)
    }
  }
  return values
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('ru-KZ').format(Math.round(val))
}

/** Форматирование значения calculated-поля для отображения (по маске поля). */
export function formatCalcValue(mask: 'currency' | 'percent' | undefined, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  if (mask === 'currency') return `${formatCurrency(num)} ₸`
  if (mask === 'percent') return `${num.toFixed(2)}%`
  return num % 1 === 0 ? String(Math.round(num)) : num.toFixed(2)
}
