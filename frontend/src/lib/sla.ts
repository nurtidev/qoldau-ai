import type { ApplicationStatus } from '@/types'

/**
 * SLA-трекер сроков рассмотрения (паттерн «трекер сроков поверх процесса»,
 * по мотивам SMART-30 из АКК).
 *
 * Норматив в календарных днях на этап. Терминальные статусы (draft — заявка ещё
 * не подана, approved/rejected — решение уже принято) SLA не имеют.
 */
export const SLA_DAYS: Partial<Record<ApplicationStatus, number>> = {
  submitted:      5,  // первичное рассмотрение / проверка документов
  in_review:      10, // рассмотрение комитетом
  docs_requested: 10, // заявителю — на досдачу документов
}

export type SlaState = 'ok' | 'warning' | 'overdue'

export interface SlaInfo {
  daysOnStage: number
  slaDays: number
  deadline: Date
  state: SlaState
  label: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Считает состояние SLA для текущего этапа заявки.
 *
 * ВАЖНО: истории смены статусов в БД нет, поэтому "момент входа в текущий
 * статус" аппроксимируется полем updated_at — это осознанное упрощение.
 * Оно точно для однократного перехода (submitted → in_review и т.п.), но если
 * запись обновится по другой причине без смены status, отсчёт SLA собьётся.
 * Для полноценного трекера нужна таблица application_status_history.
 *
 * Дни считаются календарные (не рабочие) — так честнее и проще, чем делать вид
 * точного расчёта по рабочим дням без учёта праздников РК.
 *
 * Возвращает null для статусов без SLA (draft, approved, rejected) —
 * бейдж в этом случае просто не показывается.
 */
export function getSlaInfo(app: {
  status: ApplicationStatus
  updated_at: string
  created_at: string
}): SlaInfo | null {
  const slaDays = SLA_DAYS[app.status]
  if (slaDays === undefined) return null

  const stageStart = new Date(app.updated_at || app.created_at)
  if (Number.isNaN(stageStart.getTime())) return null

  const now = new Date()
  const daysOnStage = Math.max(0, Math.floor((now.getTime() - stageStart.getTime()) / DAY_MS))
  const deadline = new Date(stageStart.getTime() + slaDays * DAY_MS)
  const daysLeft = slaDays - daysOnStage

  const state: SlaState = daysLeft < 0 ? 'overdue' : daysLeft <= 2 ? 'warning' : 'ok'

  const label =
    state === 'overdue'
      ? `Просрочено на ${Math.abs(daysLeft)} дн. · SLA ${slaDays} дней`
      : `${daysOnStage} дн. на этапе · SLA ${slaDays} дней`

  return { daysOnStage, slaDays, deadline, state, label }
}
