// ── Мини-рендер markdown (подход из ServiceExplainer): ## / ###, списки, **жирный**,
// *курсив-источник*. Без внешних зависимостей. Общий для новостей и базы знаний.

/** Стабильный якорь из текста заголовка (## → h3) для оглавления статьи.
 *  Кириллица в id/hash допустима в HTML5 и работает со scrollIntoView. */
export function slugifyHeading(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-zа-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

/** Заголовки верхнего уровня (## …) статьи — для правого оглавления. */
export function extractHeadings(text: string): Array<{ id: string; title: string }> {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^##\s+/.test(l) && !/^###/.test(l))
    .map((l) => {
      const title = l.replace(/^##\s+/, '').replace(/\*\*/g, '')
      return { id: slugifyHeading(title), title }
    })
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={`${keyBase}-b${i}`} style={{ color: 'var(--color-text)', fontWeight: 700 }}>{p}</strong>
      : <span key={`${keyBase}-t${i}`}>{p}</span>,
  )
}

export function MarkdownBody({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  let key = 0

  const flushList = () => {
    if (list.length === 0) return
    const items = list
    blocks.push(
      <ul key={`ul-${key++}`} style={{ margin: '6px 0 18px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--color-text-2)' }}>
            {renderInline(it, `li-${key}-${i}`)}
          </li>
        ))}
      </ul>,
    )
    list = []
  }

  for (const raw of lines) {
    const trimmed = raw.trim()
    if (trimmed === '') { flushList(); continue }

    if (/^###\s+/.test(trimmed)) {
      flushList()
      blocks.push(
        <h4 key={`h4-${key++}`} style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '20px 0 8px' }}>
          {renderInline(trimmed.replace(/^###\s+/, ''), `h4-${key}`)}
        </h4>,
      )
      continue
    }
    if (/^##\s+/.test(trimmed)) {
      flushList()
      const headText = trimmed.replace(/^##\s+/, '')
      blocks.push(
        <h3 key={`h3-${key++}`} id={slugifyHeading(headText)} style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-primary)', margin: '26px 0 10px', scrollMarginTop: 90, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--color-accent)', flexShrink: 0 }} />
          {renderInline(headText, `h3-${key}`)}
        </h3>,
      )
      continue
    }
    if (/^[-*]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*]\s+/, ''))
      continue
    }
    // *курсив-источник*
    if (/^\*[^*].*\*$/.test(trimmed)) {
      flushList()
      blocks.push(
        <p key={`i-${key++}`} style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--color-text-3)', margin: '0 0 14px' }}>
          {trimmed.slice(1, -1)}
        </p>,
      )
      continue
    }
    flushList()
    blocks.push(
      <p key={`p-${key++}`} style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-2)', margin: '0 0 16px' }}>
        {renderInline(trimmed, `p-${key}`)}
      </p>,
    )
  }
  flushList()
  return <div>{blocks}</div>
}
