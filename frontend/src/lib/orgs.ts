/**
 * Каноника организаций портала (ЕППБ ТЗ п.5) — единый источник истины вместо
 * россыпи локальных `ORGS`-массивов по страницам.
 *
 * Группа «Байтерек» на портале = 7 прямых дочек холдинга (БРК, Даму, Отбасы,
 * КЖК, ЭКА, АКК, QIC) + ФРП (дочка БРК) и КазАгроФинанс (дочка АКК) — итого
 * 9 организаций группы. `Astana Hub`,
 * `QazIndustry`, `Kazakh Invest` и «Центры занятости (enbek.kz)» — это НЕ
 * дочки холдинга, а партнёрские программы других ведомств; путать их с
 * группой — фактическая ошибка, которую мгновенно замечает жюри (сотрудники
 * самого «Байтерека»).
 *
 * `dbMatch` — подстрока для матчинга РЕАЛЬНОГО `service.org_name` из БД
 * (см. backend/migrations/013_actualize_programs.up.sql). У БРК, Отбасы банка,
 * КЖК и QIC своих услуг в MVP-каталоге пока нет — `dbMatch` не задан, значит:
 * не считаем услуги, не даём клик по плашке (см. HomePage.tsx OrgTile).
 */

export interface OrgEntry {
  id: string
  /** Короткое имя — для плашек/бейджей. */
  short: string
  /** Полное официальное имя — для тултипов/детальных карточек. */
  full: string
  /** Канонический цвет плашки (зелёно-золотая гамма Байтерека для группы, свой оттенок — для партнёров). */
  color: string
  /** 2-буквенный тег на плашке. */
  tag: string
  /** Публичный домен (без протокола), если известен. */
  website?: string
  /** Подстрока для матчинга service.org_name; отсутствует = нет услуг в MVP. */
  dbMatch?: string
  /** Путь к официальному логотипу (public/img/orgs/*) для светлого фона; отсутствует = плашка с тегом. */
  logo?: string
}

export const BAITEREK_GROUP: OrgEntry[] = [
  { id: 'brk',    short: 'БРК',                full: 'Банк развития Казахстана',                    color: '#14532D', tag: 'БР', website: 'kdb.kz',           logo: '/img/orgs/brk.png' },
  { id: 'frp',    short: 'ФРП',                full: 'Фонд развития промышленности',                color: '#0A4F3A', tag: 'ФР', website: 'idfrk.kz',        dbMatch: 'Фонд развития промышленности', logo: '/img/orgs/frp.png' },
  { id: 'damu',   short: 'Даму',               full: 'Фонд развития предпринимательства «Даму»',     color: '#085E2C', tag: 'ДМ', website: 'damu.kz',          dbMatch: 'Даму', logo: '/img/orgs/damu.png' },
  { id: 'otbasy', short: 'Отбасы банк',        full: 'Отбасы банк',                                  color: '#3A8B5C', tag: 'ОБ', website: 'otbasybank.kz',    logo: '/img/orgs/otbasy.svg' },
  { id: 'kzhk',   short: 'Казахстанская жилищная компания', full: 'АО «Казахстанская жилищная компания»', color: '#2F6B4F', tag: 'КЖ', website: 'homeportal.kz' },
  { id: 'eca',    short: 'ЭКА KazakhExport',   full: 'Экспортно-кредитное агентство Казахстана (KazakhExport)', color: '#176D62', tag: 'ЭК', website: 'kazakhexport.kz', dbMatch: 'ЭКА KazakhExport', logo: '/img/orgs/eca.png' },
  { id: 'kaf',    short: 'КазАгроФинанс',      full: 'КазАгроФинанс',                                color: '#257E43', tag: 'КФ', website: 'kaf.kz',           dbMatch: 'КазАгроФинанс', logo: '/img/orgs/kaf.png' },
  { id: 'akk',    short: 'АКК',                full: 'Аграрная кредитная корпорация',                color: '#1F6B3B', tag: 'АК', website: 'agrocredit.kz',    dbMatch: 'Аграрная кредитная корпорация', logo: '/img/orgs/akk.png' },
  { id: 'qic',    short: 'QIC',                full: 'Qazaqstan Investment Corporation',             color: '#0F6B4D', tag: 'QC', website: 'qic.kz',           logo: '/img/orgs/qic.svg' },
]

export const PARTNER_ORGS: OrgEntry[] = [
  // Официальный лого-файл Astana Hub (cdn.astanahub.com/static/img_v2/logo-mobile.svg) —
  // сложная luminance-mask с мелкими кольцами; в Chromium на размере плашки (32px)
  // рендерится нечитаемым чёрным пятном (в отличие от превью в Quick Look/macOS).
  // Пригодного для этого масштаба официального файла не нашли — оставлено на тэге.
  { id: 'astanahub', short: 'Astana Hub',         full: 'Международный технопарк IT-стартапов Astana Hub', color: '#6E4A24', tag: 'AH', dbMatch: 'Astana Hub' },
  { id: 'qazind',    short: 'QazIndustry',        full: 'QazIndustry',                                      color: '#705C33', tag: 'QI', dbMatch: 'QazIndustry', logo: '/img/orgs/qazind.svg' },
  { id: 'kzinvest',  short: 'Kazakh Invest',      full: 'Kazakh Invest',                                    color: '#387557', tag: 'KI', dbMatch: 'Kazakh Invest', logo: '/img/orgs/kzinvest.svg' },
  { id: 'enbek',     short: 'Центры занятости',   full: 'Центры занятости (enbek.kz)',                      color: '#8A6A14', tag: 'ЦЗ', dbMatch: 'Центры занятости', logo: '/img/orgs/enbek.svg' },
]

/** Матчинг по подстроке против реального `service.org_name` из данных. */
export function isPartnerOrg(orgName?: string | null): boolean {
  if (!orgName) return false
  return PARTNER_ORGS.some((o) => o.dbMatch && orgName.includes(o.dbMatch))
}
