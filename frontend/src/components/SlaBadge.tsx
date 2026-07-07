import type { ApplicationStatus } from '@/types'
import { getSlaInfo, type SlaState } from '@/lib/sla'
import { I } from '@/components/icons'

const STATE_STYLE: Record<SlaState, { bg: string; color: string }> = {
  ok:      { bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
  // "Осталось мало времени" оформляем акцентным золотом бренда, а не бурым warning-токеном.
  warning: { bg: 'var(--color-accent-soft)',  color: 'var(--color-accent-text)' },
  overdue: { bg: 'var(--color-danger-soft)',  color: 'var(--color-danger)' },
}

interface SlaBadgeProps {
  app: { status: ApplicationStatus; updated_at: string; created_at: string }
  /** Компактный вариант для строк таблиц: меньше паддинги, без иконки. */
  inline?: boolean
  style?: React.CSSProperties
}

/**
 * Компактная плашка SLA-срока текущего этапа заявки. Ничего не рендерит для
 * терминальных статусов (draft/approved/rejected) — там срока нет.
 */
export function SlaBadge({ app, inline, style }: SlaBadgeProps) {
  const sla = getSlaInfo(app)
  if (!sla) return null
  const s = STATE_STYLE[sla.state]
  const deadlineStr = sla.deadline.toLocaleDateString('ru-KZ')

  return (
    <span
      title={`Дедлайн этапа: ${deadlineStr}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: inline ? '2px 7px' : '4px 10px',
        borderRadius: 999,
        background: s.bg, color: s.color,
        fontSize: inline ? 11 : 12, fontWeight: 600,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {!inline && (sla.state === 'overdue' ? <I.Alert size={12} /> : <I.Clock size={12} />)}
      {sla.label}
    </span>
  )
}
