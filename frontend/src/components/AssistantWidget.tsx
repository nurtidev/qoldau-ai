import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { I } from '@/components/icons'
import { useAssistant } from '@/store/assistant'
import { useIsNarrow, useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'

// ── Типы и константы ───────────────────────────────────────────────────────────

type Role = 'user' | 'assistant'
interface Msg {
  role: Role
  content: string
  error?: boolean // true — ассистент вернул ошибку (danger-обводка)
}

const AVATAR = '/media/assistant/chat.webp'

const SUGGESTIONS = [
  'Какие программы есть для МСБ?',
  'Как получить грант на стартап?',
  'Условия лизинга сельхозтехники',
]

// ── Рендер ссылок вида [текст](/services/id) как <Link> ────────────────────────
// Всё остальное — обычный текст с сохранением переносов (whiteSpace: pre-wrap).

const LINK_RE = /\[([^\]]+)\]\((\/services\/[^)\s]+)\)/g

function renderContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  let i = 0
  while ((m = LINK_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    nodes.push(
      <Link
        key={`lnk-${i++}`}
        to={m[2]}
        style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}
      >
        {m[1]}
      </Link>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

// ── Индикатор набора («печатает…») ─────────────────────────────────────────────

function TypingDots({ reduced }: { reduced: boolean }) {
  if (reduced) {
    return <span style={{ color: 'var(--color-text-3)', fontSize: 18, lineHeight: 1 }}>…</span>
  }
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 8 }}>
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          style={{
            width: 6, height: 6, borderRadius: 999, background: 'var(--color-text-3)',
            animation: 'assistantDot 1.2s ease-in-out infinite', animationDelay: `${n * 0.16}s`,
          }}
        />
      ))}
    </span>
  )
}

// ── Основной виджет ─────────────────────────────────────────────────────────────

export function AssistantWidget() {
  const { open, setOpen } = useAssistant()
  const isNarrow = useIsNarrow()
  const isMobile = useIsMobile()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [avatarOk, setAvatarOk] = useState(true)
  const [showBubble, setShowBubble] = useState(false)
  // Подпись-призыв дисмиссится один раз за монтирование (не мигает при open/close).
  const bubbleDone = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const openChat = () => setOpen(true)

  // Автоскролл к последнему сообщению при обновлении диалога/стриминга.
  useEffect(() => {
    if (!open) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming, open])

  // Esc закрывает панель; фокус на поле ввода при открытии.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t) }
  }, [open, setOpen])

  // Подпись-призыв «Получи консультацию!»: авто-скрытие, чтобы не висеть вечно
  // над CTA-карточек. На мобильных — компактный FAB, подсказка один раз за сессию.
  useEffect(() => {
    if (open || bubbleDone.current) { setShowBubble(false); return }
    // На мобильных показываем подсказку не чаще одного раза за сессию.
    if (isMobile && sessionStorage.getItem('qoldau_asst_bubble') === '1') {
      bubbleDone.current = true
      setShowBubble(false)
      return
    }
    setShowBubble(true)
    if (isMobile) sessionStorage.setItem('qoldau_asst_bubble', '1')

    const dismiss = () => {
      bubbleDone.current = true
      setShowBubble(false)
      window.removeEventListener('scroll', dismiss)
      window.removeEventListener('pointerdown', dismiss)
    }
    const ms = isMobile ? 4000 : 5000
    const timer = window.setTimeout(dismiss, ms)
    window.addEventListener('scroll', dismiss, { passive: true, once: true })
    window.addEventListener('pointerdown', dismiss, { passive: true, once: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', dismiss)
      window.removeEventListener('pointerdown', dismiss)
    }
  }, [open, isMobile])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || streaming) return

    const history: Msg[] = [...messages.filter((m) => !m.error), { role: 'user', content: text }]
    // Плейсхолдер ассистента, в который дольём дельты стрима.
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const appendDelta = (delta: string) =>
      setMessages((prev) => {
        const next = [...prev]
        const li = next.length - 1
        if (li >= 0 && next[li].role === 'assistant') {
          next[li] = { ...next[li], content: next[li].content + delta }
        }
        return next
      })

    const fail = () =>
      setMessages((prev) => {
        const next = [...prev]
        const li = next.length - 1
        if (li >= 0 && next[li].role === 'assistant') {
          next[li] = {
            role: 'assistant', error: true,
            content: 'Не получилось получить ответ. Попробуйте ещё раз или позвоните 1408.',
          }
        }
        return next
      })

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      })
      if (!res.ok || !res.body) throw new Error('stream failed')

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let done = false
      while (!done) {
        const { done: rd, value } = await reader.read()
        if (rd) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.error) throw new Error(evt.error)
            if (evt.t) appendDelta(evt.t as string)
            if (evt.done) done = true
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }
      setStreaming(false)
    } catch {
      setStreaming(false)
      fail()
    }
  }

  // ── Плавающий маскот (панель закрыта) ─────────────────────────────────────────
  // Паттерн baiterek.gov.kz: робот стоит крупный, сам по себе (без кнопки-круга),
  // под ним золотая подпись-призыв. Фолбэк без картинки — прежний круг с иконкой.
  if (!open) {
    // ── Мобильный компактный FAB (<768): круглая кнопка-«лицо» без вечной подписи ──
    if (isMobile) {
      return (
        <>
          <div style={{
            position: 'fixed', zIndex: 90, right: 14, bottom: 14,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
          }}>
            {showBubble && (
              <div
                className="assistant-bubble"
                style={{
                  maxWidth: 190, background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)', boxShadow: 'var(--sh-md)',
                  borderRadius: 12, padding: '8px 12px', fontSize: 13, fontWeight: 700,
                  color: 'var(--color-primary)', lineHeight: 1.3,
                  animation: reduced ? undefined : 'assistantBubbleIn 220ms var(--ease-out) both',
                }}
              >
                Получи консультацию!
              </div>
            )}
            <button
              type="button"
              onClick={openChat}
              aria-label="Открыть AI-консультанта"
              className="assistant-fab"
              style={{
                width: 54, height: 54, borderRadius: '50%', padding: 0, cursor: 'pointer',
                border: '2px solid #fff', overflow: 'hidden', background: 'var(--color-primary)',
                boxShadow: 'var(--sh-lg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {avatarOk ? (
                <img
                  src={AVATAR}
                  alt=""
                  onError={() => setAvatarOk(false)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                />
              ) : (
                <I.Sparkle size={24} style={{ color: '#fff' }} />
              )}
            </button>
          </div>
          <style>{FAB_CSS}</style>
        </>
      )
    }

    // ── Десктоп: крупный маскот + подпись-призыв (подпись авто-скрывается) ──
    return (
      <>
        <div style={{
          position: 'fixed', zIndex: 90, right: 24, bottom: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          {avatarOk ? (
            <button
              type="button"
              onClick={openChat}
              aria-label="Открыть AI-консультанта"
              className="assistant-fab"
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'block' }}
            >
              <img
                src={AVATAR}
                alt=""
                onError={() => setAvatarOk(false)}
                style={{
                  height: 150, width: 'auto', display: 'block',
                  filter: 'drop-shadow(0 8px 18px rgba(7, 60, 36, 0.30))',
                }}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={openChat}
              aria-label="Открыть AI-консультанта"
              className="assistant-fab"
              style={{
                width: 64, height: 64, borderRadius: '50%', border: 'none',
                background: 'var(--color-primary)', boxShadow: 'var(--sh-lg)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              <I.Sparkle size={26} style={{ color: '#fff' }} />
            </button>
          )}
          {showBubble && (
            <button
              type="button"
              onClick={openChat}
              className="assistant-bubble"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 15, fontWeight: 700, letterSpacing: '0.01em',
                color: 'var(--color-accent-text)', whiteSpace: 'nowrap',
                animation: reduced ? undefined : 'assistantBubbleIn 220ms var(--ease-out) both',
              }}
            >
              Получи консультацию!
            </button>
          )}
        </div>
        <style>{FAB_CSS}</style>
      </>
    )
  }

  // ── Панель чата (открыта) ─────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = isNarrow
    ? {
      position: 'fixed', inset: 0, zIndex: 95, borderRadius: 0,
      background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }
    : {
      position: 'fixed', right: 20, bottom: 20, zIndex: 95,
      width: 380, height: 'min(620px, calc(100vh - 40px))', borderRadius: 16,
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      boxShadow: 'var(--sh-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }

  const waitingFirstDelta =
    streaming && messages.length > 0 &&
    messages[messages.length - 1].role === 'assistant' &&
    messages[messages.length - 1].content === ''

  return (
    <>
      <div
        style={{ ...panelStyle, animation: reduced ? undefined : 'assistantPanelIn 220ms var(--ease-drawer) both' }}
        role="dialog"
        aria-label="AI-консультант"
      >
        {/* Шапка */}
        <div style={{
          background: 'var(--color-primary)', color: '#fff', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
            background: 'rgba(255,255,255,0.15)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {avatarOk ? (
              <img src={AVATAR} alt="" onError={() => setAvatarOk(false)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.25) translateY(6%)' }} />
            ) : (
              <I.Sparkle size={16} style={{ color: '#fff' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>AI-консультант</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>
              Qoldau · знает программы группы «Байтерек»
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Закрыть"
            style={{
              background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
              padding: 4, borderRadius: 8, display: 'inline-flex', flexShrink: 0,
            }}
          >
            <I.X size={20} />
          </button>
        </div>

        {/* Сообщения */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: 16, background: 'var(--color-bg)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={bubbleStyle('assistant')}>
                Здравствуйте! Помогу подобрать меру поддержки, рассказать об условиях программ и
                подаче заявки. Спросите что-нибудь — например:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    style={{
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 500,
                      color: 'var(--color-primary)', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                style={m.error
                  ? { ...bubbleStyle('assistant'), border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }
                  : bubbleStyle(m.role)}
              >
                {renderContent(m.content)}
              </div>
            ))
          )}

          {waitingFirstDelta && (
            <div style={{ ...bubbleStyle('assistant'), padding: '12px 14px' }}>
              <TypingDots reduced={reduced} />
            </div>
          )}
        </div>

        {/* Ввод */}
        <div style={{
          borderTop: '1px solid var(--color-border)', padding: 12, flexShrink: 0,
          display: 'flex', gap: 8, background: 'var(--color-surface)',
        }}>
          <input
            ref={inputRef}
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(input) } }}
            placeholder="Ваш вопрос…"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => send(input)}
            disabled={streaming || input.trim() === ''}
            aria-label="Отправить"
            style={{ flexShrink: 0, padding: '0 14px' }}
          >
            <I.Send size={16} />
          </button>
        </div>

        <div style={{
          fontSize: 11, color: 'var(--color-text-3)', textAlign: 'center',
          padding: '0 12px 10px', background: 'var(--color-surface)', flexShrink: 0,
        }}>
          Ответы ИИ носят справочный характер
        </div>
      </div>
      <style>{PANEL_CSS}</style>
    </>
  )
}

// ── Стили пузырей ────────────────────────────────────────────────────────────

function bubbleStyle(role: Role): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 14, lineHeight: 1.5, padding: '10px 14px', maxWidth: '85%',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }
  if (role === 'user') {
    return {
      ...base, background: 'var(--color-primary)', color: '#fff',
      borderRadius: '14px 14px 4px 14px', alignSelf: 'flex-end',
    }
  }
  return {
    ...base, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', borderRadius: '14px 14px 14px 4px', alignSelf: 'flex-start',
  }
}

const FAB_CSS = `
.assistant-fab { transition: transform 160ms var(--ease-out); }
.assistant-fab:hover { transform: scale(1.06); }
.assistant-fab:focus-visible { outline: none; box-shadow: var(--sh-focus); }
@keyframes assistantBubbleIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .assistant-fab { transition: none; }
  .assistant-fab:hover { transform: none; }
  .assistant-bubble { animation: none !important; }
}
`

const PANEL_CSS = `
@keyframes assistantPanelIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes assistantDot { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }
`
