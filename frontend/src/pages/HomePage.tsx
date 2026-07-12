import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi, contentApi, type HoldingStat, type NewsItem } from '@/api/client'
import { I } from '@/components/icons'
import { EligibilityScreener } from '@/components/EligibilityScreener'
import { EcosystemCard } from '@/components/HeroVisual'
import { HomeCalculator } from '@/components/HomeCalculator'
import { categoryColor, categorySoftBg } from '@/lib/categoryColor'
import { BAITEREK_GROUP, PARTNER_ORGS, type OrgEntry } from '@/lib/orgs'
import { MediaCover } from '@/components/MediaCover'
import { NewsCover, fmtNewsDate } from '@/pages/NewsPage'
import { useIsNarrow, useMediaQuery } from '@/hooks/useMediaQuery'
import type { Service } from '@/types'

// title строго совпадает с category услуги в БД — иначе ссылка
// /services?category=… ничего не отфильтрует. Счётчики считаются из реального
// каталога (см. dirCounts в HomePage), хардкод-цифр здесь нет.
const DIRECTIONS = [
  { id: 'fin',   title: 'Финансирование', desc: 'Кредиты и займы для МСБ и крупного бизнеса', icon: 'Coins' },
  { id: 'guar',  title: 'Гарантии',       desc: 'Государственные гарантии по кредитам',       icon: 'Shield' },
  { id: 'exp',   title: 'Экспорт',        desc: 'Поддержка экспортной деятельности',           icon: 'Plane' },
  { id: 'inv',   title: 'Инвестиции',     desc: 'Привлечение инвестиций и размещение',         icon: 'Building' },
  { id: 'agr',   title: 'Агросектор',     desc: 'Поддержка сельхозпроизводителей',             icon: 'Sprout' },
  { id: 'lease', title: 'Лизинг',         desc: 'Лизинг техники, оборудования и транспорта',   icon: 'Grid' },
  { id: 'subs',  title: 'Субсидии',       desc: 'Субсидирование ставки и части затрат',        icon: 'Tag' },
  { id: 'grant', title: 'Гранты',         desc: 'Безвозмездные гранты на развитие',            icon: 'Sparkle' },
]

/**
 * Фоновое hero-медиа (инфраструктура «как в akk-portal», с фолбэками).
 * Два НЕЗАВИСИМЫХ слоя со своими onLoad/onError — потому что jpg и mp4 могут
 * существовать в любой комбинации:
 *  — постер <img> (jpg): самостоятельный слой, fade-in по onLoad. ВАЖНО: он не
 *    poster-атрибут видео — 404 у <source> не вызывает onError видео-элемента,
 *    и с атрибутом постер оставался невидимым (video стоял в opacity:0);
 *  — <video> (mp4) поверх: src напрямую (тогда 404 честно даёт onError),
 *    preload="metadata", кроссфейд после onPlaying/onLoadedData;
 *  — только десктоп (min-width: 768px): на мобиле НИ img, НИ video не
 *    рендерятся вовсе (ноль запросов — исправляем ошибку донора, где видео
 *    скрыто лишь CSS'ом, но качается);
 *  — prefers-reduced-motion → только постер, видео не рендерится;
 *  — градиент-переток слева держит текст на var(--color-bg) (контраст как
 *    сейчас), оверлеи включаются только когда виден хоть один медиа-слой.
 * Матрица: ничего нет → кремовый фон; jpg → статичный фото-hero; jpg+mp4 →
 * видео поверх постера; mp4 без jpg → видео после onPlaying.
 */
function HeroMedia() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [posterState, setPosterState] = useState<'idle' | 'ready' | 'error'>('idle')
  const [videoState, setVideoState] = useState<'idle' | 'ready' | 'error'>('idle')

  // На мобиле медиа-слоя не существует (ни запроса, ни элементов).
  if (!isDesktop) return null

  const posterVisible = posterState === 'ready'
  const videoVisible = videoState === 'ready' && !reduce
  const anyVisible = posterVisible || videoVisible

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Постер — самостоятельный слой (виден и когда mp4 ещё нет/не готов). */}
      {posterState !== 'error' && (
        <img
          src="/media/hero/hero-main.jpg?v=2"
          alt=""
          onLoad={() => setPosterState('ready')}
          onError={() => setPosterState('error')}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%',
            opacity: posterVisible ? 1 : 0, transition: 'opacity 700ms var(--ease-out)',
          }}
        />
      )}

      {/* Видео — поверх постера, кроссфейд когда реально готово. */}
      {!reduce && videoState !== 'error' && (
        <video
          src="/media/hero/hero-main.mp4?v=2"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={() => setVideoState('ready')}
          onPlaying={() => setVideoState('ready')}
          onError={() => setVideoState('error')}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%',
            opacity: videoVisible ? 1 : 0, transition: 'opacity 700ms var(--ease-out)',
          }}
        />
      )}

      {/* Переток медиа → фон hero слева (текст остаётся на кремовом, контраст AA). */}
      {anyVisible && (
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(90deg, var(--color-bg) 0%, var(--color-bg) 42%, color-mix(in srgb, var(--color-bg) 40%, transparent) 52%, transparent 58%)',
        }} />
      )}
      {/* Нижний мягкий стык с секцией: медиа полностью растворяется в кремовом
          фоне секции (снизу секция = var(--color-bg)), стык поднят и усилен —
          сплошной кремовый до 34% высоты полосы, затем плавно в прозрачность,
          чтобы не было видимого шва между фото/видео и скринером ниже. */}
      {anyVisible && (
        <div style={{
          position: 'absolute', insetInline: 0, bottom: 0, height: 160,
          background: 'linear-gradient(to top, var(--color-bg) 0%, var(--color-bg) 34%, transparent 100%)',
        }} />
      )}
    </div>
  )
}

function HeroSearch({ count }: { count: number }) {
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const navigate = useNavigate()
  const suggestions = ['Льготное финансирование', 'Гарантии по кредиту', 'Гранты для стартапов', 'Лизинг сельхозтехники']
  // Честная цифра каталога; пока услуги не загрузились — консервативный фолбэк.
  const catalogCount = count > 0 ? count : 17

  return (
    <section className="hero-gradient-bg" style={{
      paddingTop: 64, paddingBottom: 64, position: 'relative', overflow: 'hidden',
    }}>
      <HeroMedia />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(7,102,61,0.06) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'linear-gradient(180deg, transparent, black 20%, black 80%, transparent)',
        pointerEvents: 'none',
      }} />
      <div className="ornament-tile ornament-fade ornament-hero" aria-hidden="true" />
      <div className="container" style={{ position: 'relative' }}>
        <div style={{ minWidth: 0, maxWidth: 660 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 999, fontSize: 12, color: 'var(--color-text-2)', marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
            {catalogCount} мер поддержки — группа «Байтерек» и партнёры
          </div>
          <h1 style={{ fontSize: 'clamp(30px, 6vw, 52px)', lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.025em', margin: 0, maxWidth: 820, color: 'var(--color-text)' }}>
            Единое окно поддержки <br />
            <span style={{ color: 'var(--color-primary)' }}>казахстанского бизнеса</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--color-text-2)', maxWidth: 620, marginTop: 16, marginBottom: 32 }}>
            Найдите подходящие меры государственной поддержки, подайте заявку онлайн и отслеживайте её статус в одном кабинете.
          </p>

          {/* Search box */}
          <div style={{ position: 'relative', maxWidth: 720 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: '#fff',
              border: `1px solid ${focused ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
              borderRadius: 10,
              boxShadow: focused ? 'var(--sh-focus)' : 'var(--sh-sm)',
              transition: 'border-color 120ms var(--ease-out), box-shadow 120ms var(--ease-out)',
              padding: 6, paddingLeft: 16,
            }}>
              <I.Search size={20} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                placeholder="Например: «кредит на пополнение оборотных средств» или «грант»"
                style={{ flex: 1, height: 44, border: 'none', outline: 'none', fontSize: 15, padding: '0 12px', background: 'transparent' }}
                onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) navigate(`/services?q=${encodeURIComponent(q.trim())}`) }}
              />
              <button className="btn btn-primary" onClick={() => navigate(q.trim() ? `/services?q=${encodeURIComponent(q.trim())}` : '/services')}>Найти</button>
            </div>
            {focused && (
              <div className="card" style={{ position: 'absolute', top: 64, left: 0, right: 0, padding: 8, zIndex: 10, boxShadow: 'var(--sh-md)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', padding: '8px 12px 6px', letterSpacing: '0.06em' }}>Популярные запросы</div>
                {suggestions.map((s, i) => (
                  <div key={i} onMouseDown={() => navigate(`/services?q=${encodeURIComponent(s)}`)} style={{ padding: '10px 12px', borderRadius: 6, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <I.Search size={15} style={{ color: 'var(--color-text-4)' }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats — elevated glass tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 14, marginTop: 40, maxWidth: 640 }}>
            {[{ v: String(catalogCount), l: 'мер поддержки в каталоге' }, { v: '9', l: 'организаций группы «Байтерек»' }, { v: '24/7', l: 'подача заявок онлайн' }, { v: '1408', l: 'единый колл-центр' }].map((s, i) => (
              <div key={i} className="glass" style={{
                padding: '16px 18px',
                boxShadow: 'var(--sh-lg), inset 0 1px 0 rgba(255,255,255,0.85)',
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function DirectionCard({ d, count }: { d: typeof DIRECTIONS[0]; count?: number }) {
  const Icon = I[d.icon as keyof typeof I]
  // Спокойное оживление: категорийный цвет в иконке/стрелке + лёгкий стеклянный
  // хайлайт сверху и подъём на hover. Секция остаётся светлой — не спорит с
  // тёмно-зелёным glass-скринером выше по странице (ритм: скринер → спокойные
  // направления).
  const accent = categoryColor(d.title)
  return (
    <Link to={`/services?category=${encodeURIComponent(d.title)}`}
      className="card"
      style={{ position: 'relative', overflow: 'hidden', padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, transition: 'transform 160ms var(--ease-out), border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)', textDecoration: 'none' }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accent; el.style.boxShadow = 'var(--sh-md)'; el.style.transform = 'translateY(-3px)' }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border)'; el.style.boxShadow = 'var(--sh-xs)'; el.style.transform = 'translateY(0)' }}
    >
      {/* стеклянный хайлайт — тонкий градиент сверху в цвет категории */}
      <div aria-hidden="true" style={{ position: 'absolute', insetInline: 0, top: 0, height: 64, background: `linear-gradient(180deg, ${categorySoftBg(d.title, 0.10)} 0%, transparent 100%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 10, background: categorySoftBg(d.title, 0.12), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
        {Icon && <Icon size={22} />}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>{d.title}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>{d.desc}</div>
      </div>
      <div style={{ position: 'relative', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{count == null ? '—' : `${count} услуг`}</span>
        <I.ArrowRight size={16} style={{ color: accent }} />
      </div>
    </Link>
  )
}

function ServiceTile({ service }: { service: Service }) {
  const accent = categoryColor(service.category)
  return (
    <Link to={`/services/${service.id}`}
      className="card card-elevated card-elevated-hover"
      style={{ padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', minWidth: 320, width: 320, textDecoration: 'none', overflow: 'hidden' }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 9' }}>
        <MediaCover title={service.title} category={service.category} hoverVideo />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="badge" style={{ background: categorySoftBg(service.category), color: accent }}>
          {service.category ?? 'Общее'}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, minHeight: 40 }}>{service.title}</div>
      {service.description && (
        <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
          {service.description}
        </div>
      )}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        {service.org_name && <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{service.org_name}</span>}
        <span style={{ fontSize: 13, color: 'var(--color-accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          Подробнее <I.ChevronRight size={14} />
        </span>
      </div>
      </div>
    </Link>
  )
}

/** Плашка организации: клик-через в каталог только у тех, у кого уже есть услуги (dbMatch задан). */
function OrgTile({ org, count, size = 'lg' }: { org: OrgEntry; count?: number; size?: 'lg' | 'sm' }) {
  const clickable = !!org.dbMatch
  const dim = size === 'lg' ? 56 : 40
  const logoH = size === 'lg' ? 32 : 24
  // Официальный логотип — приоритет; onError (битый/пропавший файл) откатывает
  // на буквенную плашку без повторных запросов (паттерн как в MediaCover).
  const [logoOk, setLogoOk] = useState(!!org.logo)
  const style: React.CSSProperties = {
    padding: size === 'lg' ? 20 : 14,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size === 'lg' ? 10 : 6,
    transition: 'border-color 140ms', textDecoration: 'none',
  }
  const badge = org.logo && logoOk
    ? (
      <div style={{ height: dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={org.logo}
          alt={org.full}
          onError={() => setLogoOk(false)}
          style={{ height: logoH, width: 'auto', maxWidth: 120, objectFit: 'contain' }}
        />
      </div>
    )
    : (
      <div style={{ width: dim, height: dim, borderRadius: 10, background: org.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size === 'lg' ? 18 : 13, fontWeight: 700 }}>{org.tag}</div>
    )
  const body = (
    <>
      {badge}
      <div style={{ fontSize: size === 'lg' ? 13 : 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{org.short}</div>
      {clickable && !!count && <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{count} услуг</div>}
    </>
  )
  if (!clickable) {
    return <div className="card" style={{ ...style, cursor: 'default', opacity: 0.65 }}>{body}</div>
  }
  return (
    <Link to={`/services?org_name=${encodeURIComponent(org.dbMatch!)}`}
      className="card" style={{ ...style, cursor: 'pointer' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)' }}
    >
      {body}
    </Link>
  )
}

// Спокойная светлая секция об институте развития. Цифры администрируются из
// админки (/api/holding-stats). Если API пуст — секция не рендерится вовсе.
function HoldingSection() {
  const { data: stats, isLoading } = useQuery<HoldingStat[]>({
    queryKey: ['holding-stats'],
    queryFn: () => contentApi.holdingStats().then((r) => r.data ?? []),
  })

  if (!isLoading && (!stats || stats.length === 0)) return null

  return (
    <section className="container" style={{ paddingTop: 72 }}>
      <div
        style={{
          position: 'relative', overflow: 'hidden',
          background: 'var(--color-surface-warm)',
          border: '1px solid var(--color-border)', borderRadius: 20,
          padding: 'clamp(28px, 4vw, 48px)',
        }}
      >
        <div className="ornament-tile-gold" aria-hidden="true" style={{ opacity: 0.05 }} />
        <div
          className="two-col-mobile-stack"
          style={{
            position: 'relative', display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
            gap: 'clamp(28px, 4vw, 56px)', alignItems: 'center',
          }}
        >
          {/* Left column — текст */}
          <div style={{ minWidth: 0 }}>
            <div className="section-eyebrow" style={{ marginBottom: 8 }}>Институт развития страны</div>
            <h2 className="section-title" style={{ fontSize: 28 }}>Холдинг «Байтерек»</h2>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-2)', marginTop: 14, maxWidth: 520 }}>
              Национальный инвестиционный холдинг, основанный в 2013 году. Содействует устойчивому росту
              экономики Казахстана через поддержку производства отечественных товаров и услуг,
              модернизацию инфраструктуры и укрепление продовольственной безопасности.
            </p>
            <a
              href="#baiterek-group"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18,
                fontSize: 14, fontWeight: 500, color: 'var(--color-accent-text)',
              }}
            >
              <I.Building size={15} />
              7 дочерних организаций холдинга, а также ФРП и КазАгроФинанс в составе группы
            </a>
            <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 22, marginBottom: 0 }}>
              По данным официальной отчётности и публикаций холдинга.
            </p>
          </div>

          {/* Right — 2×2 стат-карточки */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {isLoading
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 128, borderRadius: 14 }} />
                ))
              : stats!.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 14, padding: '18px 18px', boxShadow: 'var(--sh-xs)', minWidth: 0,
                    }}
                  >
                    <div style={{ fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-primary)', lineHeight: 1.1 }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginTop: 8, lineHeight: 1.35 }}>
                      {s.label}
                    </div>
                    {s.asof && (
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', marginTop: 6, lineHeight: 1.35 }}>
                        {s.asof}
                      </div>
                    )}
                  </div>
                ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function NewsTile({ item }: { item: NewsItem }) {
  return (
    <Link to={`/news/${item.id}`} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit', transition: 'box-shadow 140ms' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-md)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-xs)' }}
    >
      <NewsCover item={item} aspect="16 / 10" />
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 10 }}>{fmtNewsDate(item.published_at)}</div>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{item.title}</div>
      </div>
    </Link>
  )
}

export function HomePage() {
  const isNarrow = useIsNarrow()
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  })
  const { data: newsData, isLoading: newsLoading } = useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: () => contentApi.news().then((r) => r.data ?? []),
  })
  const latestNews = useMemo(() => {
    return [...(newsData ?? [])]
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
      .slice(0, 3)
  }, [newsData])

  // Реальные счётчики услуг по направлениям (точный матч category → title карточки).
  const dirCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of services) {
      if (s.category) map[s.category] = (map[s.category] ?? 0) + 1
    }
    return map
  }, [services])

  // Реальные счётчики услуг по организациям (матч по подстроке org_name).
  const orgCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of [...BAITEREK_GROUP, ...PARTNER_ORGS]) {
      if (!o.dbMatch) continue
      map[o.id] = services.filter((s) => s.org_name?.includes(o.dbMatch!)).length
    }
    return map
  }, [services])

  return (
    <div className="page-fade">
      <HeroSearch count={services.length} />

      {/* Подбор программы — первый шаг клиентского пути, сразу под hero */}
      <EligibilityScreener services={services} />

      {/* Кредитный калькулятор + карточка «Экосистема Байтерек» */}
      <section className="container" style={{ paddingTop: 64 }}>
        <div style={{ marginBottom: 24 }}>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Инструменты</div>
          <h2 className="section-title">Рассчитайте условия</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6 }}>
            Подберите сумму и срок — увидите ежемесячный платёж и переплату по программе
          </p>
        </div>
        <div
          className="two-col-mobile-stack"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 24, alignItems: 'stretch' }}
        >
          <HomeCalculator />
          <EcosystemCard />
        </div>
      </section>

      {/* Directions */}
      <section className="container" style={{ paddingTop: 64 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>Направления</div>
            <h2 className="section-title">Выберите направление поддержки</h2>
          </div>
          <Link to="/services" style={{ fontSize: 14, color: 'var(--color-accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Все категории <I.ArrowRight size={14} />
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {DIRECTIONS.map((d) => <DirectionCard key={d.id} d={d} count={services.length ? dirCounts[d.title] ?? 0 : undefined} />)}
        </div>
      </section>

      {/* Popular services */}
      <section className="container" style={{ paddingTop: 72 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>Сейчас актуально</div>
            <h2 className="section-title">Популярные услуги</h2>
          </div>
          <Link to="/services" style={{ fontSize: 14, color: 'var(--color-accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Смотреть все <I.ArrowRight size={14} />
          </Link>
        </div>
        {services.length > 0 ? (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x mandatory' }}>
            {services.slice(0, 6).map((s) => (
              <div key={s.id} style={{ scrollSnapAlign: 'start' }}>
                <ServiceTile service={s} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ minWidth: 320, height: 200 }} />
            ))}
          </div>
        )}
      </section>

      {/* Organisations: группа «Байтерек» (9 организаций) + партнёрские программы (4) */}
      <section id="baiterek-group" className="container" style={{ paddingTop: 72, scrollMarginTop: 80 }}>
        <div style={{ marginBottom: 24 }}>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Группа «Байтерек»</div>
          <h2 className="section-title">Организации группы</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6 }}>9 организаций группы «Байтерек» — 7 дочерних холдинга, ФРП и КазАгроФинанс</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {BAITEREK_GROUP.map((o) => <OrgTile key={o.id} org={o} count={orgCounts[o.id]} size="lg" />)}
        </div>

        <div style={{ marginTop: 40, paddingTop: 28, borderTop: '1px solid var(--color-border)' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)' }}>Партнёрские программы</div>
            <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 4, marginBottom: 0 }}>
              Программы партнёров доступны на портале наравне с программами группы
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            {PARTNER_ORGS.map((o) => <OrgTile key={o.id} org={o} count={orgCounts[o.id]} size="sm" />)}
          </div>
        </div>
      </section>

      {/* Holding «Байтерек» — спокойная светлая секция с выверенными цифрами */}
      <HoldingSection />

      {/* News */}
      {(newsLoading || latestNews.length > 0) && (
        <section className="container" style={{ paddingTop: 72 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div className="section-eyebrow" style={{ marginBottom: 6 }}>События</div>
              <h2 className="section-title">Новости и анонсы</h2>
            </div>
            <Link to="/news" style={{ fontSize: 14, color: 'var(--color-accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Все новости <I.ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {newsLoading
              ? [...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 240, borderRadius: 14 }} />
                ))
              : latestNews.map((n) => <NewsTile key={n.id} item={n} />)}
          </div>
        </section>
      )}

      {/* eGov CTA */}
      <section className="container" style={{ paddingTop: 80 }}>
        <div className="two-col-mobile-stack" style={{
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
          borderRadius: 16, padding: isNarrow ? '28px' : '48px 56px', color: '#fff',
          display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 32,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -80, top: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div className="ornament-tile-gold" aria-hidden="true" />
          <div style={{ position: 'relative', minWidth: 0 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#FAF0D8' /* pale gold, AA on green gradient (var(--color-gold) failed 2.8-3.66:1 here) */, fontWeight: 600, marginBottom: 10 }}>Цифровое удостоверение РК</div>
            <h2 style={{ fontSize: isNarrow ? 26 : 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>Подавайте заявки за 2 минуты</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', marginTop: 12, marginBottom: 0, maxWidth: 480 }}>
              Войдите через eGov — данные о вашей компании подгрузятся автоматически из государственных реестров.
            </p>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, width: isNarrow ? '100%' : undefined }}>
            <Link to="/services" className="btn btn-lg" style={{ background: '#fff', color: 'var(--color-primary)', height: 52, fontSize: 15, fontWeight: 600, width: isNarrow ? '100%' : undefined }}>
              <I.Shield size={18} /> Выбрать услугу
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
