import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { faqApi, type FaqItem } from '@/api/client'
import { I } from '@/components/icons'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// ── Мини-рендер Markdown (без внешних зависимостей) ────────────────────────────
// Тот же подход, что в ServiceExplainer: заголовки ## / ###, списки "- "/"* ",
// **жирный**. Компактная версия для ответов FAQ.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={`${keyBase}-b${i}`} style={{ color: 'var(--color-text)', fontWeight: 700 }}>{p}</strong>
      : <span key={`${keyBase}-t${i}`}>{p}</span>
  )
}

function FaqMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  let key = 0

  const flushList = () => {
    if (list.length === 0) return
    const items = list
    blocks.push(
      <ul key={`ul-${key++}`} style={{ margin: '4px 0 12px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-2)' }}>
            {renderInline(it, `li-${key}-${i}`)}
          </li>
        ))}
      </ul>
    )
    list = []
  }

  for (const raw of lines) {
    const trimmed = raw.trim()
    if (trimmed === '') { flushList(); continue }

    if (/^###\s+/.test(trimmed)) {
      flushList()
      blocks.push(
        <h4 key={`h4-${key++}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: '12px 0 6px' }}>
          {renderInline(trimmed.replace(/^###\s+/, ''), `h4-${key}`)}
        </h4>
      )
      continue
    }
    if (/^##\s+/.test(trimmed)) {
      flushList()
      blocks.push(
        <h3 key={`h3-${key++}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: '14px 0 6px' }}>
          {renderInline(trimmed.replace(/^##\s+/, ''), `h3-${key}`)}
        </h3>
      )
      continue
    }
    if (/^[-*]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*]\s+/, ''))
      continue
    }
    flushList()
    blocks.push(
      <p key={`p-${key++}`} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-2)', margin: '0 0 10px' }}>
        {renderInline(trimmed, `p-${key}`)}
      </p>
    )
  }
  flushList()
  return <div>{blocks}</div>
}

// ── Голосование ────────────────────────────────────────────────────────────────
// Выбор пользователя хранится в localStorage по faq_id, чтобы не голосовать
// повторно между сессиями (дедупликация на бэкенде осознанно отсутствует — MVP).

type Vote = 'up' | 'down'
const voteKey = (id: string) => `qoldau-faq-vote-${id}`

function readVote(id: string): Vote | null {
  try {
    const v = localStorage.getItem(voteKey(id))
    return v === 'up' || v === 'down' ? v : null
  } catch {
    return null
  }
}

function FaqRow({ item, open, onToggle, reduceMotion, isLast }: {
  item: FaqItem
  open: boolean
  onToggle: () => void
  reduceMotion: boolean
  isLast: boolean
}) {
  const [voted, setVoted]   = useState<Vote | null>(() => readVote(item.id))
  const [up, setUp]         = useState(item.up_votes)
  const [down, setDown]     = useState(item.down_votes)

  const voteMut = useMutation({
    mutationFn: (helpful: boolean) => faqApi.vote(item.id, helpful),
    // Откат оптимистичного апдейта: иначе при ошибке сети голос «застревает»
    // локально (счётчик завышен, кнопки заблокированы без возможности повтора).
    onError: (_e, helpful) => {
      if (helpful) setUp((n) => n - 1)
      else setDown((n) => n - 1)
      setVoted(null)
      try { localStorage.removeItem(voteKey(item.id)) } catch { /* ignore */ }
    },
  })

  const vote = (v: Vote) => {
    if (voted) return
    // Оптимистичное обновление: счётчик растёт сразу, кнопки блокируются.
    if (v === 'up') setUp((n) => n + 1)
    else setDown((n) => n + 1)
    setVoted(v)
    try { localStorage.setItem(voteKey(item.id), v) } catch { /* ignore */ }
    voteMut.mutate(v === 'up')
  }

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-border)' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', padding: '16px 20px', background: 'none', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          cursor: 'pointer', textAlign: 'left',
          transition: reduceMotion ? 'none' : 'background 120ms var(--ease-out)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.45 }}>
          {item.question}
        </span>
        <I.ChevronDown
          size={18}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: reduceMotion ? 'none' : 'transform 220ms var(--ease-out)',
            color: 'var(--color-text-3)', flexShrink: 0,
          }}
        />
      </button>

      {/* grid-rows-трюк для плавного раскрытия по высоте */}
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: reduceMotion ? 'none' : 'grid-template-rows 240ms var(--ease-out)',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 20px 18px' }}>
            <FaqMarkdown text={item.answer} />

            {/* «Был ли ответ полезен?» */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
                {voted ? 'Спасибо за отзыв!' : 'Был ли ответ полезен?'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <VoteButton
                  kind="up" count={up} active={voted === 'up'} disabled={!!voted}
                  onClick={() => vote('up')} reduceMotion={reduceMotion}
                />
                <VoteButton
                  kind="down" count={down} active={voted === 'down'} disabled={!!voted}
                  onClick={() => vote('down')} reduceMotion={reduceMotion}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VoteButton({ kind, count, active, disabled, onClick, reduceMotion }: {
  kind: Vote
  count: number
  active: boolean
  disabled: boolean
  onClick: () => void
  reduceMotion: boolean
}) {
  const Ic = kind === 'up' ? I.ThumbsUp : I.ThumbsDown
  const accent = kind === 'up' ? 'var(--color-success)' : 'var(--color-danger)'
  const softBg = kind === 'up' ? 'var(--color-success-soft)' : '#FEE2E2'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={kind === 'up' ? 'Ответ полезен' : 'Ответ не полезен'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${active ? accent : 'var(--color-border)'}`,
        background: active ? softBg : 'var(--color-surface)',
        color: active ? accent : 'var(--color-text-3)',
        opacity: disabled && !active ? 0.55 : 1,
        transition: reduceMotion ? 'none' : 'all 140ms var(--ease-out)',
      }}
    >
      <Ic size={15} />
      {count}
    </button>
  )
}

export function ServiceFaq({ serviceId }: { serviceId: string }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: items = [] } = useQuery<FaqItem[]>({
    queryKey: ['faq', serviceId],
    queryFn: () => faqApi.list(serviceId).then((r) => r.data ?? []),
    enabled: !!serviceId,
  })

  const list = useMemo(() => items, [items])

  // Если вопросов нет вовсе (и общих, и по услуге) — блок не показываем.
  if (list.length === 0) return null

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Вопросы и ответы</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 0, marginBottom: 16 }}>
        Не нашли ответ — задайте вопрос оператору 1414.
      </p>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {list.map((item, i) => (
          <FaqRow
            key={item.id}
            item={item}
            open={openId === item.id}
            onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
            reduceMotion={reduceMotion}
            isLast={i === list.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
