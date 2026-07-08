import { useEffect, useState } from 'react'
import { mockApi, type ISZData } from '@/api/client'
import { I } from '@/components/icons'

interface Props {
  /** ИИН/БИН заявителя — ключ для запроса к мок-ИСЖ. */
  iinOrBin: string
  /** Вид скота из формы, приведённый к терминам ИСЖ (см. lib/agroLivestock.ts). */
  species?: string
  /** Заявленное в форме поголовье, гол. */
  claimedCount?: number
  onComplete?: (data: ISZData) => void
}

const STAGES = [
  'Подключение к ИСЖ МСХ РК…',
  'Запрос по ИИН/БИН…',
  'Сверка поголовья…',
]

export type LivestockMatchStatus = 'confirmed' | 'discrepancy' | 'no_match'

export interface LivestockMatchResult {
  status: LivestockMatchStatus
  message: string
  identifiedCount?: number
  totalCount?: number
  discrepancyPct?: number
}

/**
 * Сверяет заявленное поголовье (вид + количество) с данными ИСЖ. Используется
 * и в UI (карточка результата ниже), и при формировании снимка _isz/isz-входа
 * для prescore.ts — единая логика, без дублирования порогов.
 */
export function evaluateLivestockMatch(
  data: ISZData,
  species?: string,
  claimedCount?: number,
): LivestockMatchResult {
  if (!species || !claimedCount) {
    return { status: 'no_match', message: 'Недостаточно данных формы для сверки поголовья с ИСЖ' }
  }
  const entry = data.livestock.find(l => l.species === species)
  if (!entry) {
    return { status: 'no_match', message: `Вид «${species}» не отслеживается в ИСЖ по данному хозяйству` }
  }
  if (claimedCount > entry.identified_count) {
    const pct = entry.identified_count > 0
      ? Math.round(((claimedCount - entry.identified_count) / entry.identified_count) * 100)
      : 100
    return {
      status: 'discrepancy',
      identifiedCount: entry.identified_count,
      totalCount: entry.count,
      discrepancyPct: pct,
      message: `Заявлено ${claimedCount} гол., в ИСЖ идентифицировано ${entry.identified_count} гол. — расхождение ${pct}%, придётся подтвердить документами`,
    }
  }
  return {
    status: 'confirmed',
    identifiedCount: entry.identified_count,
    totalCount: entry.count,
    message: `Поголовье подтверждено данными ИСЖ (идентифицировано ${entry.identified_count} из ${entry.count} гол.)`,
  }
}

export function ISZCheck({ iinOrBin, species, claimedCount, onComplete }: Props) {
  const [stage, setStage] = useState(0)
  const [data, setData] = useState<ISZData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []

    STAGES.forEach((_, idx) => {
      timers.push(window.setTimeout(() => {
        if (!cancelled) setStage(idx)
      }, idx * 420))
    })

    mockApi.isz(iinOrBin)
      .then(res => {
        const d = res.data
        const minDelay = STAGES.length * 420 + 200
        window.setTimeout(() => {
          if (!cancelled) {
            setData(d)
            onComplete?.(d)
          }
        }, minDelay)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось получить данные из ИСЖ МСХ РК')
      })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // Данные ИСЖ фиксируются один раз на ИИН/БИН — species/claimedCount меняют
    // только вердикт сверки ниже, не требуют повторного запроса.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iinOrBin])

  if (error) {
    return (
      <div style={{
        background: '#FEF2F2', border: '1px solid #FECACA',
        borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, marginBottom: 16,
      }}>
        <I.Alert size={20} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 14, color: '#991B1B' }}>{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{
        background: 'var(--color-info-soft)', border: '1px solid #BAE6FD',
        borderRadius: 10, padding: '16px 18px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 18, height: 18, border: '2px solid #0369A1', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <strong style={{ fontSize: 14, color: '#075985' }}>Сверяем поголовье с ИСЖ МСХ РК</strong>
        </div>
        <div style={{ fontSize: 13, color: '#0C4A6E', paddingLeft: 30, minHeight: 18 }}>
          {STAGES[stage]}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const match = evaluateLivestockMatch(data, species, claimedCount)
  const quarantine = data.has_active_quarantine

  const cardBg = quarantine
    ? '#FEF2F2'
    : match.status === 'discrepancy' ? '#FEF3C7' : 'var(--color-success-soft)'
  const cardBorder = quarantine
    ? '#FECACA'
    : match.status === 'discrepancy' ? '#FCD34D' : '#A7F3D0'

  return (
    <div style={{
      background: cardBg, border: `1px solid ${cardBorder}`,
      borderRadius: 10, padding: '14px 18px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <I.Shield size={20} style={{
          color: quarantine ? 'var(--color-danger)' : match.status === 'discrepancy' ? '#B45309' : 'var(--color-success)',
          flexShrink: 0, marginTop: 1,
        }} />
        <div style={{ flex: 1, fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.55 }}>
          <strong>Данные ИСЖ МСХ РК получены.</strong>{' '}
          Хозяйство: {data.farm_name} ({data.region}). Идентифицировано голов всего: {data.total_identified}.
        </div>
      </div>

      {quarantine && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: '#FEE2E2', border: '1px solid #FECACA',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <I.Alert size={16} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}>
            Действует карантин — подача ограничена
          </span>
        </div>
      )}

      {match.status !== 'no_match' && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: match.status === 'discrepancy' ? '#FFFBEB' : '#ECFDF5',
          border: `1px solid ${match.status === 'discrepancy' ? '#FCD34D' : '#A7F3D0'}`,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          {match.status === 'discrepancy'
            ? <I.Alert size={16} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
            : <I.CheckCircle size={16} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />}
          <span style={{ fontSize: 13, color: match.status === 'discrepancy' ? '#78350F' : '#065F46' }}>
            {match.message}
          </span>
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8 }}>Поголовье по видам</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--color-text-3)', textAlign: 'left' }}>
              <th style={{ fontWeight: 500, paddingBottom: 6 }}>Вид</th>
              <th style={{ fontWeight: 500, paddingBottom: 6, textAlign: 'right' }}>В базе</th>
              <th style={{ fontWeight: 500, paddingBottom: 6, textAlign: 'right' }}>Идентифицировано</th>
            </tr>
          </thead>
          <tbody>
            {data.livestock.map(l => (
              <tr key={l.species} style={{
                borderTop: '1px solid rgba(0,0,0,0.06)',
                fontWeight: l.species === species ? 700 : 400,
                color: 'var(--color-text)',
              }}>
                <td style={{ padding: '5px 0' }}>{l.species}</td>
                <td style={{ padding: '5px 0', textAlign: 'right' }}>{l.count}</td>
                <td style={{ padding: '5px 0', textAlign: 'right' }}>{l.identified_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 8 }}>
          Источник: {data.data_source} · получено {new Date(data.fetched_at).toLocaleString('ru-RU')}
        </div>
      </div>
    </div>
  )
}
