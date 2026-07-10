import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { contentApi } from '@/api/client'
import { I } from '@/components/icons'
import { MarkdownBody, extractHeadings } from '@/components/MarkdownBody'
import { DuotonePhoto } from '@/components/DuotonePhoto'
import { fmtNewsDate } from '@/pages/NewsPage'
import { useIsBelowLaptop } from '@/hooks/useMediaQuery'

// Обложка статьи по категории (кадр из media/services под зелёным дуотоном).
const COVER_BY_CATEGORY: Record<string, string> = {
  'С чего начать': 'orleu.jpg',
  'Подача заявки': 'invest-generic.jpg',
  'Документы': 'credit-generic.jpg',
  'ЭЦП и eGov': 'finance-generic.jpg',
  'Финансирование': 'isker.jpg',
}
const DEFAULT_COVER = 'finance-generic.jpg'
const coverFor = (category?: string) =>
  `/media/services/${(category && COVER_BY_CATEGORY[category]) || DEFAULT_COVER}`

export function KnowledgeArticlePage() {
  const { slug = '' } = useParams()
  const belowLaptop = useIsBelowLaptop()
  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['knowledge', slug],
    queryFn: () => contentApi.knowledgeOne(slug).then((r) => r.data),
    enabled: !!slug,
  })

  const headings = item ? extractHeadings(item.body) : []

  return (
    <div className="page-fade container" style={{ paddingTop: 32, paddingBottom: 80, maxWidth: belowLaptop ? 820 : 1120 }}>
      {/* Крошки */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-3)', marginBottom: 22, flexWrap: 'wrap' }}>
        <Link to="/" style={{ color: 'var(--color-text-3)', textDecoration: 'none' }}>Главная</Link>
        <span>/</span>
        <Link to="/knowledge" style={{ color: 'var(--color-text-3)', textDecoration: 'none' }}>База знаний</Link>
        {item && (<><span>/</span><span style={{ color: 'var(--color-text-2)' }}>{item.category}</span></>)}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
          <div className="skeleton" style={{ height: 210, borderRadius: 'var(--r-card)' }} />
          <div className="skeleton" style={{ height: 12, width: '30%', marginTop: 8 }} />
          <div className="skeleton" style={{ height: 30, width: '92%' }} />
          <div className="skeleton" style={{ height: 16, width: '100%', marginTop: 12 }} />
          <div className="skeleton" style={{ height: 16, width: '85%' }} />
          <div className="skeleton" style={{ height: 16, width: '90%' }} />
        </div>
      ) : isError || !item ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 820 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-2)' }}>Статья не найдена</div>
          <Link to="/knowledge" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>
            <I.ArrowLeft size={14} /> В базу знаний
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: belowLaptop ? '1fr' : 'minmax(0, 1fr) 260px', gap: belowLaptop ? 0 : 40, alignItems: 'start' }}>
          {/* ── Основная колонка ─────────────────────────────────────────── */}
          <article style={{ maxWidth: 820, minWidth: 0 }}>
            {/* Обложка */}
            <div style={{ position: 'relative', height: 220, borderRadius: 'var(--r-card)', overflow: 'hidden', marginBottom: 24, boxShadow: 'var(--sh-md)' }}>
              <DuotonePhoto src={coverFor(item.category)} focus="center 44%" scrim="bottom">
                <div style={{ position: 'absolute', left: 22, bottom: 18, right: 22, pointerEvents: 'none' }}>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.28)', fontWeight: 600 }}>
                    {item.category}
                  </span>
                </div>
              </DuotonePhoto>
            </div>

            {/* Мета */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-text-3)', marginBottom: 14, flexWrap: 'wrap' }}>
              {item.published_at && <time>{fmtNewsDate(item.published_at)}</time>}
              {item.read_minutes ? (<><span aria-hidden>·</span><span>{item.read_minutes} мин чтения</span></>) : null}
            </div>

            <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.02em', margin: '0 0 22px', textWrap: 'balance' } as React.CSSProperties}>
              {item.title}
            </h1>

            {/* Лид — увеличенный кегль, без цветного бордера */}
            {item.excerpt && (
              <p style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.55, color: 'var(--color-text)', margin: '0 0 30px' }}>
                {item.excerpt}
              </p>
            )}

            {/* Тело */}
            <MarkdownBody text={item.body} />

            {/* Финальный CTA — «Остались вопросы?» на зелёной поверхности */}
            <div className="screener-panel" style={{ marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div className="ornament-tile-gold ornament-fade" aria-hidden="true" />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Остались вопросы?</div>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.82)', margin: '6px 0 0', maxWidth: 420, lineHeight: 1.5 }}>
                  Единый контакт-центр Холдинга «Байтерек» поможет с подготовкой заявки и документов.
                </p>
              </div>
              <div style={{ position: 'relative', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="tel:1408" className="btn btn-accent"><I.Phone size={16} /> 1408</a>
                <Link to="/contacts" className="btn screener-glass-btn">Все контакты</Link>
              </div>
            </div>

            {/* Назад */}
            <div style={{ marginTop: 28 }}>
              <Link to="/knowledge" className="btn btn-secondary btn-sm">
                <I.ArrowLeft size={14} /> В базу знаний
              </Link>
            </div>
          </article>

          {/* ── Правый рейл (десктоп) ────────────────────────────────────── */}
          {!belowLaptop && (
            <aside style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {headings.length > 1 && (
                <nav aria-label="Содержание статьи">
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 12 }}>
                    В этой статье
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {headings.map((h) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '7px 10px', borderRadius: 8, fontSize: 13, lineHeight: 1.4, color: 'var(--color-text-2)', textDecoration: 'none', transition: 'color 140ms var(--ease-out), background 140ms var(--ease-out)' }}
                          onMouseEnter={(e) => { const el = e.currentTarget; el.style.color = 'var(--color-primary)'; el.style.background = 'var(--color-surface-2)' }}
                          onMouseLeave={(e) => { const el = e.currentTarget; el.style.color = 'var(--color-text-2)'; el.style.background = 'transparent' }}
                        >
                          <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--color-accent)', flexShrink: 0, transform: 'translateY(-1px)' }} />
                          {h.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              {/* Мини-CTA на зелёной поверхности */}
              <div className="glass-green" style={{ position: 'relative', overflow: 'hidden', padding: 18 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>Не получилось?</div>
                <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.82)', margin: '6px 0 12px', lineHeight: 1.5 }}>
                  Позвоните в единый контакт-центр — подскажем по шагам.
                </p>
                <a href="tel:1408" className="btn btn-accent btn-sm btn-block" style={{ justifyContent: 'center' }}>
                  <I.Phone size={14} /> 1408
                </a>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
