// =====================================================================
// Маппинг формы «Агробизнес: развитие животноводства» (migrations/011)
// на данные для сверки с ИСЖ МСХ РК (Информационная система идентификации
// сельскохозяйственных животных). Изолировано от prescore.ts/ISZCheck.tsx,
// чтобы те оставались независимыми от конкретных field_id этой формы.
// =====================================================================

import type { FormSchema, Service } from '@/types'

// Реальные id полей из миграции 011_agroanimal_control.up.sql.
export const AGRO_SPECIES_FIELD_ID = 'an6'   // "Вид скота" (select)
export const AGRO_HEADCOUNT_FIELD_ID = 'an7' // "Текущее поголовье, гол." (number)

// Значения an6 → вид скота, как он приходит из мока ИСЖ (species).
// «Свиноводство» не отслеживается в ИСЖ (мок покрывает КРС/МРС/Лошади/Верблюды/Птица),
// поэтому для него сверка не проводится (см. getAgroLivestockClaim).
const AN6_TO_ISZ_SPECIES: Record<string, string> = {
  'КРС молочное':      'КРС',
  'КРС мясное':        'КРС',
  'МРС (овцы/козы)':   'МРС',
  'Птица':             'Птица',
  'Коневодство':       'Лошади',
}

/**
 * Определяет, является ли услуга контрольным кейсом животноводства, для
 * которого нужно показывать сверку с ИСЖ. Не завязано на UUID услуги.
 *
 * Основной признак — форма (наличие полей an6/an7 нужных типов, сигнатура
 * схемы миграции 011). Категория «Агросектор» сама по себе НЕ используется
 * как единственный признак: в каталоге есть другие агро-услуги той же
 * категории, но не про животноводство (например, «Кең дала 2» — финансирование
 * полевых работ, поля a3..a12 — без учёта поголовья). Категория учитывается
 * только вместе с текстовым признаком «животноводств» в названии/описании —
 * как резервный сигнал, если поля когда-нибудь переименуют.
 */
export function isAgroLivestockService(service: Service | undefined | null): boolean {
  if (!service) return false

  const schema: FormSchema | undefined = service.form_schema
  const fields = schema ? schema.steps.flatMap(s => s.fields) : []
  const hasSpecies   = fields.some(f => f.id === AGRO_SPECIES_FIELD_ID && f.type === 'select')
  const hasHeadcount = fields.some(f => f.id === AGRO_HEADCOUNT_FIELD_ID && f.type === 'number')
  if (hasSpecies && hasHeadcount) return true

  const text = `${service.title ?? ''} ${service.description ?? ''}`.toLowerCase()
  return service.category === 'Агросектор' && text.includes('животноводств')
}

export interface AgroLivestockClaim {
  /** Вид скота в терминах ИСЖ (КРС/МРС/Лошади/Верблюды/Птица) — undefined, если вид не отслеживается в ИСЖ. */
  species?: string
  /** Заявленное в форме поголовье, гол. — undefined, пока поле не заполнено. */
  claimedCount?: number
}

/** Достаёт вид скота и заявленное поголовье из текущих значений формы. */
export function getAgroLivestockClaim(values: Record<string, unknown>): AgroLivestockClaim {
  const an6 = values[AGRO_SPECIES_FIELD_ID]
  const an7 = values[AGRO_HEADCOUNT_FIELD_ID]

  const species = typeof an6 === 'string' ? AN6_TO_ISZ_SPECIES[an6] : undefined
  const count = Number(an7)
  const claimedCount = Number.isFinite(count) && count > 0 ? count : undefined

  return { species, claimedCount }
}
