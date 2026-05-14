import { useEffect, useMemo, useState } from 'react'
import { I } from '@/components/icons'
import { evaluatePreflight, type RiskItem } from '@/lib/preflight'
import type { EligibilityRuleset } from '@/types'
import type { KGDData } from '@/api/client'

interface Props {
  ruleset?: EligibilityRuleset
  formData: Record<string, unknown>
  egov: Record<string, unknown> | null
  kgd: KGDData | null
  /** Колбек: вызывается при изменении флага «есть блокирующие риски». */
  onBlockingChange?: (hasBlocking: boolean) => void
  /** Кнопка «Подобрать альтернативу» (показывается при наличии fail-рисков). */
  onRequestAlternatives?: () => void
}

const LEVEL_BG: Record<RiskItem['level'], string> = {
  blocking: '#FEF2F2',
  warning:  '#FEF3C7',
  info:     'var(--color-info-soft)',
}
const LEVEL_BORDER: Record<RiskItem['level'], string> = {
  blocking: '#FECACA',
  warning:  '#FCD34D',
  info:     '#BAE6FD',
}
const LEVEL_LABEL: Record<RiskItem['level'], string> = {
  blocking: 'Блокирующее условие',
  warning:  'Риск отказа',
  info:     'Замечание',
}

function StatusIcon({ risk }: { risk: RiskItem }) {
  if (risk.status === 'ok') {
    return <I.CheckCircle size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
  }
  if (risk.status === 'pending') {
    return <I.Clock size={18} style={{ color: 'var(--color-text-3)', flexShrink: 0, marginTop: 1 }} />
  }
  if (risk.level === 'blocking') {
    return <I.X size={18} strokeWidth={2.5} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
  }
  if (risk.level === 'warning') {
    return <I.Alert size={18} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
  }
  return <I.Info size={18} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 1 }} />
}

export function PreflightPanel({
  ruleset, formData, egov, kgd, onBlockingChange, onRequestAlternatives,
}: Props) {
  const result = useMemo(
    () => evaluatePreflight(ruleset, { formData, egov, kgd }),
    [ruleset, formData, egov, kgd],
  )

  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    onBlockingChange?.(result.hasBlocking)
  }, [result.hasBlocking, onBlockingChange])

  if (!ruleset || ruleset.rules.length === 0) return null

  const okCount   = result.risks.filter(r => r.status === 'ok').length
  const failCount = result.failingCount
  const pending   = result.risks.filter(r => r.status === 'pending').length
  const total     = result.risks.length

  // Cap «топ-3 риска отказа» в свёрнутом виде
  const sortedRisks = [...result.risks].sort((a, b) => {
    const rank = (r: RiskItem) =>
      (r.status === 'fail' ? 0 : r.status === 'pending' ? 1 : 2) * 10 +
      (r.level === 'blocking' ? 0 : r.level === 'warning' ? 1 : 2)
    return rank(a) - rank(b)
  })

  const headerBg = result.hasBlocking
    ? '#FEF2F2'
    : failCount > 0
      ? '#FEF3C7'
      : okCount === total
        ? 'var(--color-success-soft)'
        : 'var(--color-surface-2)'

  const headerBorder = result.hasBlocking
    ? '#FECACA'
    : failCount > 0
      ? '#FCD34D'
      : okCount === total
        ? '#A7F3D0'
        : 'var(--color-border)'

  const headerTitle = result.hasBlocking
    ? 'Подача заблокирована — есть стоп-факторы'
    : failCount > 0
      ? `Найдено ${failCount} риск${failCount === 1 ? '' : failCount < 5 ? 'а' : 'ов'} отказа`
      : okCount === total
        ? 'Все условия программы выполнены'
        : 'Предварительная проверка заявки'

  const headerSub = result.hasBlocking
    ? 'Программа отказывает заявителям, не выполнившим эти условия'
    : failCount > 0
      ? 'Рекомендуем устранить, иначе вероятность отказа высокая'
      : okCount === total
        ? `${okCount} из ${total} проверок пройдено`
        : `Проверено ${okCount + failCount} из ${total}${pending > 0 ? ` · ${pending} ждёт заполнения` : ''}`

  return (
    <div style={{
      background: headerBg,
      border: `1px solid ${headerBorder}`,
      borderRadius: 10,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        {result.hasBlocking
          ? <I.Alert size={22} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          : failCount > 0
            ? <I.Alert size={22} style={{ color: '#B45309', flexShrink: 0 }} />
            : okCount === total
              ? <I.CheckCircle size={22} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              : <I.Shield size={22} style={{ color: 'var(--color-text-2)', flexShrink: 0 }} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
            {headerTitle}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 2, lineHeight: 1.4 }}>
            {headerSub}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: '#fff', color: 'var(--color-text-2)',
            border: '1px solid var(--color-border)',
          }}>
            {okCount}/{total} OK
          </span>
          {expanded
            ? <I.ChevronUp size={16} style={{ color: 'var(--color-text-3)' }} />
            : <I.ChevronDown size={16} style={{ color: 'var(--color-text-3)' }} />}
        </div>
      </button>

      {expanded && (
        <div style={{
          padding: '4px 18px 16px',
          borderTop: `1px solid ${headerBorder}`,
          background: '#fff',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {sortedRisks.map(risk => (
            <div
              key={risk.id}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: 8,
                background: risk.status === 'fail' ? LEVEL_BG[risk.level] : 'var(--color-surface-2)',
                border: risk.status === 'fail'
                  ? `1px solid ${LEVEL_BORDER[risk.level]}`
                  : '1px solid var(--color-border)',
              }}
            >
              <StatusIcon risk={risk} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                    {risk.title}
                  </span>
                  {risk.status === 'fail' && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                      background: LEVEL_BORDER[risk.level], color: 'var(--color-text)',
                    }}>
                      {LEVEL_LABEL[risk.level]}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                  {risk.message}
                </div>
                {risk.status === 'fail' && risk.detail && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4, lineHeight: 1.5 }}>
                    {risk.detail}
                  </div>
                )}
              </div>
            </div>
          ))}

          {failCount > 0 && onRequestAlternatives && (
            <button
              type="button"
              onClick={onRequestAlternatives}
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
              <I.Sparkle size={14} /> Подобрать подходящую программу
            </button>
          )}
        </div>
      )}
    </div>
  )
}
