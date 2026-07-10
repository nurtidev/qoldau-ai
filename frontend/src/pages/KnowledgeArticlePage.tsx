import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { contentApi } from '@/api/client'
import { I } from '@/components/icons'
import { MarkdownBody } from '@/components/MarkdownBody'
import { fmtNewsDate } from '@/pages/NewsPage'

export function KnowledgeArticlePage() {
  const { slug = '' } = useParams()
  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['knowledge', slug],
    queryFn: () => contentApi.knowledgeOne(slug).then((r) => r.data),
    enabled: !!slug,
  })

  return (
    <div className="page-fade container" style={{ paddingTop: 32, paddingBottom: 80, maxWidth: 820 }}>
      {/* Крошки */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-3)', marginBottom: 22, flexWrap: 'wrap' }}>
        <Link to="/" style={{ color: 'var(--color-text-3)', textDecoration: 'none' }}>Главная</Link>
        <span>/</span>
        <Link to="/knowledge" style={{ color: 'var(--color-text-3)', textDecoration: 'none' }}>База знаний</Link>
        {item && (<><span>/</span><span style={{ color: 'var(--color-text-2)' }}>{item.category}</span></>)}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton" style={{ height: 12, width: '30%' }} />
          <div className="skeleton" style={{ height: 30, width: '92%' }} />
          <div className="skeleton" style={{ height: 16, width: '100%', marginTop: 12 }} />
          <div className="skeleton" style={{ height: 16, width: '85%' }} />
          <div className="skeleton" style={{ height: 16, width: '90%' }} />
        </div>
      ) : isError || !item ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-2)' }}>Статья не найдена</div>
          <Link to="/knowledge" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>
            <I.ArrowLeft size={14} /> В базу знаний
          </Link>
        </div>
      ) : (
        <article>
          {/* Мета */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-text-3)', marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="badge badge-gray">{item.category}</span>
            {item.published_at && <time>{fmtNewsDate(item.published_at)}</time>}
            {item.read_minutes ? (<><span aria-hidden>·</span><span>{item.read_minutes} мин чтения</span></>) : null}
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.02em', margin: '0 0 22px' }}>
            {item.title}
          </h1>

          {/* Лид с левым бордером */}
          {item.excerpt && (
            <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.6, color: 'var(--color-text)', borderLeft: '4px solid var(--color-primary)', paddingLeft: 18, margin: '0 0 30px' }}>
              {item.excerpt}
            </p>
          )}

          {/* Тело */}
          <MarkdownBody text={item.body} />

          {/* Назад */}
          <div style={{ marginTop: 34 }}>
            <Link to="/knowledge" className="btn btn-secondary btn-sm">
              <I.ArrowLeft size={14} /> В базу знаний
            </Link>
          </div>
        </article>
      )}
    </div>
  )
}
