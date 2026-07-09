import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { contentApi } from '@/api/client'
import { I } from '@/components/icons'
import { NewsCover, fmtNewsDate } from '@/pages/NewsPage'

// ── Мини-рендер markdown (подход из ServiceExplainer): ## / ###, списки, **жирный**,
// *курсив-источник*. Без внешних зависимостей.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={`${keyBase}-b${i}`} style={{ color: 'var(--color-text)', fontWeight: 700 }}>{p}</strong>
      : <span key={`${keyBase}-t${i}`}>{p}</span>,
  )
}

function NewsBody({ text }: { text: string }) {
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
      blocks.push(
        <h3 key={`h3-${key++}`} style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-primary)', margin: '26px 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--color-accent)', flexShrink: 0 }} />
          {renderInline(trimmed.replace(/^##\s+/, ''), `h3-${key}`)}
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

export function NewsDetailPage() {
  const { id = '' } = useParams()
  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['news', id],
    queryFn: () => contentApi.newsOne(id).then((r) => r.data),
    enabled: !!id,
  })

  return (
    <div className="page-fade container" style={{ paddingTop: 32, paddingBottom: 80, maxWidth: 820 }}>
      {/* Крошки */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-3)', marginBottom: 22, flexWrap: 'wrap' }}>
        <Link to="/" style={{ color: 'var(--color-text-3)', textDecoration: 'none' }}>Главная</Link>
        <span>/</span>
        <Link to="/news" style={{ color: 'var(--color-text-3)', textDecoration: 'none' }}>Новости</Link>
        {item && (<><span>/</span><span style={{ color: 'var(--color-text-2)' }}>{item.rubric ?? 'Материал'}</span></>)}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton" style={{ height: 12, width: '30%' }} />
          <div className="skeleton" style={{ height: 30, width: '92%' }} />
          <div className="skeleton" style={{ aspectRatio: '16 / 9', borderRadius: 14, marginTop: 8 }} />
          <div className="skeleton" style={{ height: 16, width: '100%', marginTop: 12 }} />
          <div className="skeleton" style={{ height: 16, width: '85%' }} />
          <div className="skeleton" style={{ height: 16, width: '90%' }} />
        </div>
      ) : isError || !item ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-2)' }}>Материал не найден</div>
          <Link to="/news" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>
            <I.ArrowLeft size={14} /> Все новости
          </Link>
        </div>
      ) : (
        <article>
          {/* Мета */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-text-3)', marginBottom: 14, flexWrap: 'wrap' }}>
            <time>{fmtNewsDate(item.published_at)}</time>
            {item.source && (<><span aria-hidden>·</span><span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{item.source}</span></>)}
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.02em', margin: '0 0 22px' }}>
            {item.title}
          </h1>

          {/* Обложка */}
          <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 26 }}>
            <NewsCover item={item} aspect="16 / 9" ornament />
          </div>

          {/* Лид с левым бордером */}
          {item.lead && (
            <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.6, color: 'var(--color-text)', borderLeft: '4px solid var(--color-primary)', paddingLeft: 18, margin: '0 0 30px' }}>
              {item.lead}
            </p>
          )}

          {/* Тело */}
          {item.body && <NewsBody text={item.body} />}

          {/* Ссылка на источник */}
          {item.source_url && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text-3)' }}>
              Источник:{' '}
              <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                {item.source ?? item.source_url}
              </a>
            </div>
          )}

          {/* Назад */}
          <div style={{ marginTop: 34 }}>
            <Link to="/news" className="btn btn-secondary btn-sm">
              <I.ArrowLeft size={14} /> Все новости
            </Link>
          </div>
        </article>
      )}
    </div>
  )
}
