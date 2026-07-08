import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi } from '@/api/client'
import { I } from '@/components/icons'
import { EligibilityScreener } from '@/components/EligibilityScreener'
import { HeroVisual } from '@/components/HeroVisual'
import { categoryColor, categorySoftBg } from '@/lib/categoryColor'
import type { Service } from '@/types'

const DIRECTIONS = [
  { id: 'fin',   title: 'Финансирование', desc: 'Кредиты и займы для МСБ и крупного бизнеса', icon: 'Coins',    count: 23 },
  { id: 'guar',  title: 'Гарантии',       desc: 'Государственные гарантии по кредитам',       icon: 'Shield',   count: 9  },
  { id: 'exp',   title: 'Экспорт',        desc: 'Поддержка экспортной деятельности',           icon: 'Plane',    count: 14 },
  { id: 'inv',   title: 'Инвестиции',     desc: 'Привлечение инвестиций и размещение',         icon: 'Building', count: 11 },
  { id: 'agr',   title: 'Агросектор',     desc: 'Поддержка сельхозпроизводителей',             icon: 'Sprout',   count: 16 },
  { id: 'grant', title: 'Гранты',         desc: 'Безвозмездные гранты и субсидии',             icon: 'Sparkle',  count: 7  },
]

const NEWS = [
  { id: 1, org: 'Демеу',    color: '#07663D', date: '24 апр. 2026', title: 'Снижена ставка по программе до 9% годовых',      tag: 'Программы' },
  { id: 2, org: 'KazExport',color: '#C9A21C', date: '22 апр. 2026', title: 'KazExport открыл представительство в Ташкенте',   tag: 'Новости'   },
  { id: 3, org: 'ИнноФонд', color: '#0F766E', date: '18 апр. 2026', title: 'Запущен новый раунд грантов для tech-стартапов',  tag: 'Гранты'    },
]

const ORGS = [
  { id: 'demeu',   short: 'Демеу',        color: '#07663D', tag: 'D',  count: 12 },
  { id: 'kazex',   short: 'KazExport',    color: '#C9A21C', tag: 'KE', count: 8  },
  { id: 'agrokap', short: 'АгроКапитал', color: '#0A7A47', tag: 'AK', count: 14 },
  { id: 'astana',  short: 'Astana Cap.',  color: '#8A6A14', tag: 'AC', count: 7  },
  { id: 'innofnd', short: 'ИнноФонд',    color: '#0F766E', tag: 'IF', count: 5  },
  { id: 'guarant', short: 'KazGuarantee',color: '#B45309', tag: 'KG', count: 9  },
]

function HeroSearch() {
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const navigate = useNavigate()
  const suggestions = ['Льготное финансирование', 'Гарантии по кредиту', 'Гранты для стартапов', 'Лизинг сельхозтехники']

  return (
    <section className="hero-gradient-bg" style={{
      borderBottom: '1px solid var(--color-border)',
      paddingTop: 64, paddingBottom: 64, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(7,102,61,0.06) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'linear-gradient(180deg, transparent, black 20%, black 80%, transparent)',
        pointerEvents: 'none',
      }} />
      <div className="ornament-tile ornament-fade ornament-hero" aria-hidden="true" />
      <div className="container hero-grid" style={{ position: 'relative' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 999, fontSize: 12, color: 'var(--color-text-2)', marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
            Объединяем 70+ мер поддержки от 6 институтов развития
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
              transition: 'all 120ms ease',
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
            {[{ v: '70+', l: 'мер поддержки' }, { v: '6', l: 'институтов развития' }, { v: '24/7', l: 'подача заявок онлайн' }, { v: '1414', l: 'единый колл-центр' }].map((s, i) => (
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

        <HeroVisual />
      </div>
    </section>
  )
}

function DirectionCard({ d }: { d: typeof DIRECTIONS[0] }) {
  const Icon = I[d.icon as keyof typeof I]
  return (
    <Link to={`/services?category=${encodeURIComponent(d.title)}`}
      className="card"
      style={{ padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 140ms, box-shadow 140ms', textDecoration: 'none' }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-accent)'; el.style.boxShadow = 'var(--sh-md)' }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border)'; el.style.boxShadow = 'var(--sh-xs)' }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
        {Icon && <Icon size={22} />}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>{d.title}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>{d.desc}</div>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{d.count} услуг</span>
        <I.ArrowRight size={16} style={{ color: 'var(--color-accent)' }} />
      </div>
    </Link>
  )
}

function ServiceTile({ service }: { service: Service }) {
  const accent = categoryColor(service.category)
  return (
    <Link to={`/services/${service.id}`}
      className="card card-elevated card-elevated-hover"
      style={{ padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 320, width: 320, textDecoration: 'none', borderLeft: `3px solid ${accent}` }}
    >
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
    </Link>
  )
}

export function HomePage() {
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  })

  return (
    <div className="page-fade">
      <HeroSearch />
      <EligibilityScreener services={services} />

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
          {DIRECTIONS.map((d) => <DirectionCard key={d.id} d={d} />)}
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

      {/* Organisations */}
      <section className="container" style={{ paddingTop: 72 }}>
        <div style={{ marginBottom: 24 }}>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Институты развития</div>
          <h2 className="section-title">Наши партнёры</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6 }}>Дочерние организации Холдинга «Байтерек» и партнёры портала</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {ORGS.map((o) => (
            <Link key={o.id} to={`/services?org_name=${encodeURIComponent(o.short)}`}
              className="card"
              style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'border-color 140ms', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)' }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 10, background: o.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{o.tag}</div>
              <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{o.short}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{o.count} услуг</div>
            </Link>
          ))}
        </div>
      </section>

      {/* News */}
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
          {NEWS.map((n) => (
            <article key={n.id} className="card" style={{ overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 140ms' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-md)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-xs)' }}
            >
              <div style={{ height: 160, background: `repeating-linear-gradient(135deg, ${n.color}18 0 12px, ${n.color}08 12px 24px)`, borderBottom: '1px solid var(--color-border)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, left: 12 }}>
                  <span className="badge" style={{ background: '#fff', color: n.color }}>{n.org}</span>
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--color-text-3)', marginBottom: 10 }}>
                  <span>{n.date}</span><span>·</span><span>{n.tag}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{n.title}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* eGov CTA */}
      <section className="container" style={{ paddingTop: 80 }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary) 0%, #0A7A47 100%)',
          borderRadius: 16, padding: '48px 56px', color: '#fff',
          display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 32,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -80, top: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div className="ornament-tile-gold" aria-hidden="true" />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#FAF0D8' /* pale gold, AA on green gradient (var(--color-gold) failed 2.8-3.66:1 here) */, fontWeight: 600, marginBottom: 10 }}>Цифровое удостоверение РК</div>
            <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>Подавайте заявки за 2 минуты</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', marginTop: 12, marginBottom: 0, maxWidth: 480 }}>
              Войдите через eGov — данные о вашей компании подгрузятся автоматически из государственных реестров.
            </p>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link to="/services" className="btn btn-lg" style={{ background: '#fff', color: 'var(--color-primary)', height: 52, fontSize: 15, fontWeight: 600 }}>
              <I.Shield size={18} /> Выбрать услугу
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
