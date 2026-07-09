import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { contentApi, type NewsItem } from '@/api/client'
import { I } from '@/components/icons'

// ── Обложки без фото: детерминированный брендовый градиент по рубрике ──────────
// Реальных снимков у новостей нет, поэтому обложка собирается из фирменного
// цвета рубрики, примешанного к --color-primary (по аналогии с донором akk).

const RUBRIC_TINT: Record<string, string> = {
  'Программы':      '#007A40',
  'Истории успеха': '#B4975A',
  'Новости':        '#176D62',
  'СМИ о нас':      '#6E4A24',
}

export function rubricTint(rubric?: string): string {
  return (rubric && RUBRIC_TINT[rubric]) || '#387557'
}

export function coverGradient(rubric?: string): string {
  const c = rubricTint(rubric)
  return `linear-gradient(135deg, ${c} 0%, color-mix(in srgb, ${c} 55%, var(--color-primary)) 100%)`
}

export function fmtNewsDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Декоративная марка-орнамент (кулпытас-мотив) поверх градиента featured-обложки.
function OrnamentMark({ size = 160, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" style={style}>
      <circle cx="50" cy="50" r="46" stroke="#fff" strokeWidth="1.4" opacity="0.5" />
      <path d="M50 8 C34 30 34 70 50 92 C66 70 66 30 50 8 Z" stroke="#fff" strokeWidth="1.4" opacity="0.55" />
      <path d="M8 50 C30 34 70 34 92 50 C70 66 30 66 8 50 Z" stroke="#fff" strokeWidth="1.4" opacity="0.55" />
      <circle cx="50" cy="50" r="8" stroke="#fff" strokeWidth="1.4" opacity="0.6" />
    </svg>
  )
}

// Универсальная обложка: градиент рубрики + чип категории (+ орнамент/марка на featured).
// Если у материала задан image_url — показываем картинку с фолбэком на градиент.
export function NewsCover({
  item,
  aspect,
  radius = 0,
  showChip = true,
  ornament = false,
}: {
  item: NewsItem
  aspect: string
  radius?: number
  showChip?: boolean
  ornament?: boolean
}) {
  const tint = rubricTint(item.rubric)
  return (
    <div
      aria-hidden={!item.image_url}
      style={{
        position: 'relative',
        aspectRatio: aspect,
        background: coverGradient(item.rubric),
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      {/* мягкий световой блик */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 120% at 15% 12%, rgba(255,255,255,0.28), transparent 55%)' }} />
      {ornament && (
        <OrnamentMark size={190} style={{ position: 'absolute', right: -34, bottom: -46, opacity: 0.16 }} />
      )}
      {item.image_url && (
        <img
          src={item.image_url}
          alt=""
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', animation: 'newsFade 320ms var(--ease-out, ease-out)' }}
        />
      )}
      {showChip && item.rubric && (
        <span style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1,
          background: 'rgba(255,255,255,0.94)', color: tint,
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          padding: '4px 10px', borderRadius: 999, backdropFilter: 'blur(4px)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}>
          {item.rubric}
        </span>
      )}
    </div>
  )
}

const RUBRIC_ORDER = ['Программы', 'Новости', 'Истории успеха', 'СМИ о нас']

export function NewsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: () => contentApi.news().then((r) => r.data ?? []),
  })
  const items = data ?? []

  const { featured, picks, sections } = useMemo(() => {
    const sorted = [...items].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    const feat = sorted.find((n) => n.is_featured) ?? sorted[0]
    const rest = sorted.filter((n) => n.id !== feat?.id)
    const pk = rest.slice(0, 5)
    const shown = new Set([feat?.id, ...pk.map((p) => p.id)])
    const remaining = sorted.filter((n) => !shown.has(n.id))
    const byRubric = new Map<string, NewsItem[]>()
    for (const n of remaining) {
      const key = n.rubric || 'Новости'
      if (!byRubric.has(key)) byRubric.set(key, [])
      byRubric.get(key)!.push(n)
    }
    const ordered = [...byRubric.keys()].sort(
      (a, b) => (RUBRIC_ORDER.indexOf(a) + 1 || 99) - (RUBRIC_ORDER.indexOf(b) + 1 || 99),
    )
    return { featured: feat, picks: pk, sections: ordered.map((k) => ({ title: k, items: byRubric.get(k)! })) }
  }, [items])

  return (
    <div className="page-fade container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <style>{`
        @keyframes newsFade { from { opacity: 0 } to { opacity: 1 } }
        .news-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .news-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .news-hero-grid { display: grid; gap: 32px; grid-template-columns: 1fr; }
        @media (min-width: 900px) { .news-hero-grid { grid-template-columns: 2fr 1fr; } }
        .news-grid { display: grid; gap: 20px; grid-template-columns: 1fr; }
        @media (min-width: 640px) { .news-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 960px) { .news-grid { grid-template-columns: repeat(3, 1fr); } }
        .news-card { transition: box-shadow 160ms var(--ease-out, ease-out), transform 160ms var(--ease-out, ease-out); }
        .news-card:hover { box-shadow: var(--sh-md); transform: translateY(-2px); }
        .news-title-link:hover { color: var(--color-primary); }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <div className="section-eyebrow" style={{ marginBottom: 8 }}>Пресс-центр</div>
        <h1 className="section-title" style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Новости и события</h1>
      </div>

      {isLoading ? (
        <NewsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ── Верх: featured + «Выбор редакции» ── */}
          <div className="news-hero-grid">
            {featured && (
              <Link to={`/news/${featured.id}`} className="card news-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
                <NewsCover item={featured} aspect="16 / 9" ornament />
                <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 500 }}>
                    {fmtNewsDate(featured.published_at)}{featured.source ? ` · ${featured.source}` : ''}
                  </div>
                  <h2 className="news-title-link" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, margin: '8px 0 0', letterSpacing: '-0.01em', transition: 'color 140ms' }}>
                    {featured.title}
                  </h2>
                  {featured.lead && (
                    <p className="news-clamp-3" style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--color-text-2)', margin: '12px 0 0' }}>
                      {featured.lead}
                    </p>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>
                    Читать далее <I.ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            )}

            <aside aria-label="Выбор редакции">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>
                <span style={{ width: 4, height: 16, borderRadius: 999, background: 'var(--color-accent)' }} />
                Выбор редакции
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {picks.map((item, i) => (
                  <Link
                    key={item.id}
                    to={`/news/${item.id}`}
                    style={{
                      display: 'flex', gap: 14, padding: '14px 0', textDecoration: 'none', color: 'inherit',
                      borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ flexShrink: 0, width: 96 }}>
                      <NewsCover item={item} aspect="4 / 3" radius={8} showChip={false} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: rubricTint(item.rubric) }}>
                        {item.rubric}
                      </div>
                      <div className="news-clamp-2 news-title-link" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, margin: '3px 0 0', transition: 'color 140ms' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 5 }}>
                        {fmtNewsDate(item.published_at)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          </div>

          {/* ── Ниже: секции по рубрикам ── */}
          {sections.map((section) => (
            <section key={section.title} style={{ marginTop: 48 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 18px', paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
                {section.title}
              </h2>
              <div className="news-grid">
                {section.items.map((item) => (
                  <Link key={item.id} to={`/news/${item.id}`} className="card news-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
                    <NewsCover item={item} aspect="16 / 10" />
                    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{fmtNewsDate(item.published_at)}</div>
                      <h3 className="news-clamp-2 news-title-link" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35, margin: '6px 0 0', transition: 'color 140ms' }}>
                        {item.title}
                      </h3>
                      {item.lead && (
                        <p className="news-clamp-3" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-2)', margin: '10px 0 0', flex: 1 }}>
                          {item.lead}
                        </p>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
                        Читать далее <I.ArrowRight size={13} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card" style={{ padding: 56, textAlign: 'center', color: 'var(--color-text-3)' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-2)' }}>Новостей пока нет</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>Материалы появятся здесь, как только редакция их опубликует.</div>
    </div>
  )
}

function NewsSkeleton() {
  return (
    <div className="news-hero-grid">
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="skeleton" style={{ aspectRatio: '16 / 9', borderRadius: 0 }} />
        <div style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 12, width: '40%' }} />
          <div className="skeleton" style={{ height: 22, width: '90%', marginTop: 12 }} />
          <div className="skeleton" style={{ height: 14, width: '100%', marginTop: 14 }} />
          <div className="skeleton" style={{ height: 14, width: '80%', marginTop: 8 }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 14 }}>
            <div className="skeleton" style={{ width: 96, height: 72, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 10, width: '30%' }} />
              <div className="skeleton" style={{ height: 14, width: '95%', marginTop: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '70%', marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
