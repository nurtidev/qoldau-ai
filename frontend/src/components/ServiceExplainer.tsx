import { useRef, useState } from 'react'
import { aiApi } from '@/api/client'
import { I } from '@/components/icons'
import { useToast } from '@/components/Toast'

// ── Мини-рендер Markdown (без внешних зависимостей) ────────────────────────────
// Поддерживает: заголовки ## / ###, списки "- "/"* ", **жирный**.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Разбиваем по **...**, чётные — обычный текст, нечётные — жирный.
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={`${keyBase}-b${i}`} style={{ color: 'var(--color-text)', fontWeight: 700 }}>{p}</strong>
      : <span key={`${keyBase}-t${i}`}>{p}</span>
  )
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  let key = 0

  const flushList = () => {
    if (list.length === 0) return
    const items = list
    blocks.push(
      <ul key={`ul-${key++}`} style={{ margin: '4px 0 14px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
    const line = raw.trimEnd()
    const trimmed = line.trim()
    if (trimmed === '') { flushList(); continue }

    if (/^###\s+/.test(trimmed)) {
      flushList()
      blocks.push(
        <h4 key={`h4-${key++}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: '14px 0 6px' }}>
          {renderInline(trimmed.replace(/^###\s+/, ''), `h4-${key}`)}
        </h4>
      )
      continue
    }
    if (/^##\s+/.test(trimmed)) {
      flushList()
      blocks.push(
        <h3 key={`h3-${key++}`} style={{
          fontSize: 15, fontWeight: 700, color: 'var(--color-primary)',
          margin: '18px 0 8px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--color-accent)', flexShrink: 0 }} />
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
      <p key={`p-${key++}`} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-2)', margin: '0 0 12px' }}>
        {renderInline(trimmed, `p-${key}`)}
      </p>
    )
  }
  flushList()
  return <div>{blocks}</div>
}

// ── Основной компонент ─────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'streaming' | 'done' | 'error'

export function ServiceExplainer({ serviceId }: { serviceId: string }) {
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('idle')
  const [text, setText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const run = async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('loading')
    setText('')
    try {
      await aiApi.explainServiceStream(
        serviceId,
        (chunk) => {
          setPhase((p) => (p === 'loading' ? 'streaming' : p))
          setText((prev) => prev + chunk)
        },
        ctrl.signal,
      )
      setPhase('done')
    } catch (e) {
      if (ctrl.signal.aborted) return
      setPhase('error')
      toast.push('Не удалось получить объяснение. Попробуйте ещё раз.', 'error')
    }
  }

  // Заголовок-кнопка (idle)
  if (phase === 'idle') {
    return (
      <div className="card" style={{
        padding: 18, marginBottom: 24,
        border: '1.5px solid var(--color-accent-soft)',
        background: 'var(--color-accent-soft)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'var(--color-primary)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I.Sparkle size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
              Объяснить простыми словами
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 3, lineHeight: 1.5 }}>
              AI разберёт условия программы: кому подходит, что вы получите, какие документы готовить.
            </div>
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={run}>
              <I.Sparkle size={14} /> Объяснить простыми словами
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <I.Sparkle size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Объяснение простыми словами</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 1 }}>Сгенерировано AI</div>
        </div>
        {(phase === 'done' || phase === 'error') && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={run}>
            <I.ArrowRight size={13} /> Повторить
          </button>
        )}
      </div>

      {phase === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ height: 14, width: '35%' }} />
          <div className="skeleton" style={{ height: 12, width: '90%' }} />
          <div className="skeleton" style={{ height: 12, width: '80%' }} />
          <div className="skeleton" style={{ height: 12, width: '85%' }} />
        </div>
      )}

      {phase === 'error' && text === '' && (
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontSize: 13,
        }}>
          Не удалось получить объяснение. Нажмите «Повторить».
        </div>
      )}

      {text !== '' && (
        <>
          <Markdown text={text} />
          {phase === 'streaming' && (
            <span style={{
              display: 'inline-block', width: 8, height: 14, marginLeft: 2,
              background: 'var(--color-accent)', borderRadius: 2,
              animation: 'blink 1s step-start infinite', verticalAlign: 'text-bottom',
            }} />
          )}
        </>
      )}

      {(phase === 'done' || phase === 'streaming') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
          fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.5,
        }}>
          <I.Info size={13} style={{ flexShrink: 0 }} />
          <span>Сгенерировано AI. Точные условия уточняйте у оператора программы.</span>
        </div>
      )}

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  )
}
