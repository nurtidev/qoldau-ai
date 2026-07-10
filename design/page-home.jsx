// ===== Home Page =====

const HeroSearch = ({ go }) => {
  const [q, setQ] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const suggestions = ['Льготное финансирование', 'Гарантии по кредиту', 'Гранты для стартапов', 'Лизинг сельхозтехники'];
  return (
    <section style={{
      background: 'linear-gradient(180deg, #F8FAFC 0%, #EFF4FB 100%)',
      borderBottom: '1px solid var(--color-border)',
      paddingTop: 64,
      paddingBottom: 64,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle dotted texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(30,58,138,0.06) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'linear-gradient(180deg, transparent, black 20%, black 80%, transparent)',
        pointerEvents: 'none',
      }} />
      <div className="container" style={{ position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 999, fontSize: 12, color: 'var(--color-text-2)', marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
          Объединяем 70+ мер поддержки от 6 институтов развития
        </div>
        <h1 style={{ fontSize: 52, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.025em', margin: 0, maxWidth: 820, color: 'var(--color-text)' }}>
          Единое окно поддержки <br/>
          <span style={{ color: 'var(--color-primary)' }}>казахстанского бизнеса</span>
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--color-text-2)', maxWidth: 620, marginTop: 16, marginBottom: 32 }}>
          Найдите подходящие меры государственной поддержки, подайте заявку онлайн и отслеживайте её статус в одном кабинете.
        </p>
        <div style={{ position: 'relative', maxWidth: 720 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#fff',
            border: `1px solid ${focused ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
            borderRadius: 10,
            boxShadow: focused ? 'var(--sh-focus)' : 'var(--sh-sm)',
            transition: 'all 120ms ease',
            padding: 6,
            paddingLeft: 16,
          }}>
            <I.Search size={20} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Например: «кредит на пополнение оборотных средств» или «грант»"
              style={{
                flex: 1, height: 44, border: 'none', outline: 'none',
                fontSize: 15, padding: '0 12px', background: 'transparent',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') go('services'); }}
            />
            <button className="btn btn-primary" onClick={() => go('services')}>
              Найти
            </button>
          </div>
          {focused && (
            <div className="card" style={{
              position: 'absolute', top: 64, left: 0, right: 0,
              padding: 8, zIndex: 10, boxShadow: 'var(--sh-md)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', padding: '8px 12px 6px', letterSpacing: '0.06em' }}>Популярные запросы</div>
              {suggestions.map((s, i) => (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 6, fontSize: 14,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onMouseDown={() => go('services')}
                >
                  <I.Search size={15} style={{ color: 'var(--color-text-4)' }} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 36, flexWrap: 'wrap' }}>
          {[
            { v: '70+', l: 'мер поддержки' },
            { v: '6',   l: 'институтов развития' },
            { v: '24/7', l: 'подача заявок онлайн' },
            { v: '1408', l: 'единый колл-центр' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>{s.v}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const DirectionCard = ({ d, go }) => {
  const Icon = I[d.icon];
  return (
    <a className="card"
      onClick={() => go('services', { dir: d.id })}
      style={{
        padding: 24, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'border-color 140ms, transform 140ms, box-shadow 140ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = 'var(--sh-md)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'var(--sh-xs)'; }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: 'var(--color-accent-soft)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-primary)',
      }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>{d.title}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>{d.desc}</div>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{d.count} услуг</span>
        <I.ArrowRight size={16} style={{ color: 'var(--color-accent)' }} />
      </div>
    </a>
  );
};

const ServiceTile = ({ s, go }) => (
  <a className="card"
    onClick={() => go('service', { id: s.id })}
    style={{
      padding: 20, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 12,
      minWidth: 320, width: 320,
      transition: 'border-color 140ms, box-shadow 140ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = 'var(--sh-md)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'var(--sh-xs)'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <OrgBadge orgId={s.org} />
      {s.popular && <span className="badge badge-amber"><I.Star size={11} />Популярное</span>}
    </div>
    <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, minHeight: 40 }}>{s.title}</div>
    <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.short}</div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
      {s.tags.slice(0, 2).map((t, i) => <span key={i} className="badge badge-blue">{t}</span>)}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>До <strong style={{ color: 'var(--color-text-2)' }}>{s.sumMax}</strong></span>
      <span style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        Подробнее <I.ChevronRight size={14} />
      </span>
    </div>
  </a>
);

const HomePage = ({ go }) => {
  return (
    <div className="page-fade">
      <HeroSearch go={go} />

      {/* Quick directions */}
      <section className="container" style={{ paddingTop: 64 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>Направления</div>
            <h2 className="section-title">Выберите направление поддержки</h2>
          </div>
          <a onClick={() => go('services')} style={{ fontSize: 14, color: 'var(--color-accent)', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Все категории <I.ArrowRight size={14} />
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {MOCK.DIRECTIONS.map(d => <DirectionCard key={d.id} d={d} go={go} />)}
        </div>
      </section>

      {/* Popular services — horizontal scroll */}
      <section className="container" style={{ paddingTop: 72 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>Сейчас актуально</div>
            <h2 className="section-title">Популярные услуги</h2>
          </div>
          <a onClick={() => go('services')} style={{ fontSize: 14, color: 'var(--color-accent)', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Смотреть все <I.ArrowRight size={14} />
          </a>
        </div>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x mandatory' }}>
          {MOCK.SERVICES.filter(s => s.popular).concat(MOCK.SERVICES.slice(0, 2)).map((s, i) => (
            <div key={s.id + i} style={{ scrollSnapAlign: 'start' }}>
              <ServiceTile s={s} go={go} />
            </div>
          ))}
        </div>
      </section>

      {/* Organizations */}
      <section className="container" style={{ paddingTop: 72 }}>
        <div style={{ marginBottom: 24 }}>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Институты развития</div>
          <h2 className="section-title">Наши партнёры</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6 }}>Дочерние организации Холдинга «Байтерек» и партнёры портала</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {MOCK.ORGS.map(o => (
            <div key={o.id} className="card" style={{
              padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              cursor: 'pointer', transition: 'border-color 140ms',
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 10,
                background: o.color, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700,
              }}>{o.tag}</div>
              <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{o.short}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{Math.floor(Math.random() * 15) + 4} услуг</div>
            </div>
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
          <a onClick={() => go('news')} style={{ fontSize: 14, color: 'var(--color-accent)', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Все новости <I.ArrowRight size={14} />
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {MOCK.NEWS.map(n => {
            const o = MOCK.orgById(n.org);
            return (
              <article key={n.id} className="card" style={{ overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 140ms' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--sh-md)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--sh-xs)'}
              >
                {/* Striped placeholder image */}
                <div style={{
                  height: 160,
                  background: `repeating-linear-gradient(135deg, ${o.color}18 0 12px, ${o.color}08 12px 24px)`,
                  borderBottom: '1px solid var(--color-border)',
                  position: 'relative',
                }}>
                  <div style={{ position: 'absolute', top: 12, left: 12 }}>
                    <span className="badge" style={{ background: '#fff', color: o.color }}>{o.short}</span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'JetBrains Mono, monospace' }}>news_image.jpg</div>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--color-text-3)', marginBottom: 10 }}>
                    <span>{n.date}</span>
                    <span>·</span>
                    <span>{n.tag}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, color: 'var(--color-text)' }}>{n.title}</div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* eGov CTA */}
      <section className="container" style={{ paddingTop: 80 }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary) 0%, #2547A8 100%)',
          borderRadius: 16,
          padding: '48px 56px',
          color: '#fff',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          gap: 32,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -80, top: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', right: 60, bottom: -120, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A7C5FF', fontWeight: 600, marginBottom: 10 }}>
              Цифровое удостоверение РК
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>
              Подавайте заявки за 2 минуты
            </h2>
            <p style={{ fontSize: 16, color: '#CBD5E1', marginTop: 12, marginBottom: 0, maxWidth: 480 }}>
              Войдите через eGov — данные о вашей компании подгрузятся автоматически из государственных реестров.
            </p>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-lg" style={{ background: '#fff', color: 'var(--color-primary)', height: 52, fontSize: 15, fontWeight: 600 }}>
              <I.Shield size={18} /> Войти через eGov
            </button>
            <button className="btn btn-lg btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)', border: '1px solid' }}>
              Узнать больше <I.ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

window.HomePage = HomePage;
window.ServiceTile = ServiceTile;
