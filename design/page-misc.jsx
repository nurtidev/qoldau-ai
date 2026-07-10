// ===== Knowledge, News, Contacts =====

const KnowledgePage = ({ go }) => {
  const [cat, setCat] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const filtered = MOCK2.KB_ARTICLES.filter(a =>
    (cat === 'all' || a.cat === cat) &&
    (!search || a.title.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="page-fade container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <nav style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 12 }}>
        <a onClick={() => go('home')} style={{ cursor: 'pointer' }}>Главная</a>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--color-text-2)' }}>База знаний</span>
      </nav>
      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>База знаний</h1>
      <p style={{ fontSize: 15, color: 'var(--color-text-3)', marginTop: 6, marginBottom: 28, maxWidth: 600 }}>
        Инструкции, руководства и ответы на часто задаваемые вопросы
      </p>

      <div style={{ position: 'relative', maxWidth: 600, marginBottom: 32 }}>
        <I.Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)' }} />
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по статьям…" style={{ height: 48, paddingLeft: 44, fontSize: 15 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32 }}>
        <aside>
          <div className="card" style={{ padding: 12, position: 'sticky', top: 80 }}>
            <button onClick={() => setCat('all')} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: cat === 'all' ? 'var(--color-accent-soft)' : 'transparent',
              color: cat === 'all' ? 'var(--color-primary)' : 'var(--color-text-2)',
              fontSize: 13, fontWeight: 500, marginBottom: 2,
            }}>
              <span>Все статьи</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{MOCK2.KB_ARTICLES.length}</span>
            </button>
            {MOCK2.KB_CATEGORIES.map(c => {
              const Ic = I[c.icon];
              const active = cat === c.id;
              return (
                <button key={c.id} onClick={() => setCat(c.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  background: active ? 'var(--color-accent-soft)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'var(--color-text-2)',
                  fontSize: 13, fontWeight: 500, marginBottom: 2,
                }}>
                  <Ic size={16} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{c.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{c.count}</span>
                </button>
              );
            })}
          </div>
        </aside>
        <main>
          <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 12 }}>
            Найдено: <strong style={{ color: 'var(--color-text-2)' }}>{filtered.length}</strong> {filtered.length === 1 ? 'статья' : 'статей'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(a => {
              const c = MOCK2.KB_CATEGORIES.find(x => x.id === a.cat);
              return (
                <a key={a.id} className="card" style={{
                  padding: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'border-color 140ms, box-shadow 140ms',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = 'var(--sh-md)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'var(--sh-xs)'; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--color-accent-soft)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(() => { const Ic = I[c?.icon || 'Document']; return <Ic size={20} />; })()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', display: 'flex', gap: 10 }}>
                      <span>{c?.title}</span><span>·</span><span>{a.read} чтения</span><span>·</span><span>{a.date}</span>
                    </div>
                  </div>
                  <I.ChevronRight size={16} style={{ color: 'var(--color-text-3)' }} />
                </a>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

const NewsPage = ({ go }) => {
  const [tag, setTag] = React.useState('all');
  const tags = ['all', ...new Set(MOCK2.NEWS_FULL.map(n => n.tag))];
  const filtered = tag === 'all' ? MOCK2.NEWS_FULL : MOCK2.NEWS_FULL.filter(n => n.tag === tag);
  const featured = filtered.find(n => n.featured) || filtered[0];
  const rest = filtered.filter(n => n.id !== featured?.id);
  return (
    <div className="page-fade container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <nav style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 12 }}>
        <a onClick={() => go('home')} style={{ cursor: 'pointer' }}>Главная</a>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--color-text-2)' }}>Новости</span>
      </nav>
      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, marginBottom: 24 }}>Новости и анонсы</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {tags.map(t => (
          <button key={t} onClick={() => setTag(t)} style={{
            padding: '8px 14px', height: 34, borderRadius: 999,
            border: '1px solid ' + (tag === t ? 'var(--color-primary)' : 'var(--color-border)'),
            background: tag === t ? 'var(--color-primary)' : '#fff',
            color: tag === t ? '#fff' : 'var(--color-text-2)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'all 120ms',
          }}>{t === 'all' ? 'Все' : t}</button>
        ))}
      </div>

      {featured && (() => {
        const o = MOCK.orgById(featured.org);
        return (
          <article className="card" style={{ padding: 0, marginBottom: 32, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.2fr 1fr', cursor: 'pointer' }}>
            <div style={{
              minHeight: 300,
              background: `repeating-linear-gradient(135deg, ${o.color}24 0 14px, ${o.color}10 14px 28px)`,
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', top: 16, left: 16 }}>
                <span className="badge" style={{ background: '#fff', color: o.color }}>{o.short}</span>
              </div>
              <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'JetBrains Mono, monospace' }}>featured_image.jpg</div>
            </div>
            <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span className="badge badge-amber" style={{ width: 'fit-content', marginBottom: 14 }}><I.Star size={11} />Главная новость</span>
              <h2 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25, margin: 0, letterSpacing: '-0.01em' }}>{featured.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginTop: 12, marginBottom: 20, lineHeight: 1.6 }}>{featured.excerpt}</p>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-3)' }}>
                <span>{featured.date}</span><span>·</span><span>{featured.readTime}</span>
              </div>
            </div>
          </article>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {rest.map(n => {
          const o = MOCK.orgById(n.org);
          return (
            <article key={n.id} className="card" style={{ overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 140ms' }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--sh-md)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--sh-xs)'}
            >
              <div style={{
                height: 160,
                background: `repeating-linear-gradient(135deg, ${o.color}18 0 12px, ${o.color}08 12px 24px)`,
                position: 'relative',
                borderBottom: '1px solid var(--color-border)',
              }}>
                <div style={{ position: 'absolute', top: 12, left: 12 }}>
                  <span className="badge" style={{ background: '#fff', color: o.color }}>{o.short}</span>
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8 }}>{n.date} · {n.tag} · {n.readTime}</div>
                <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>{n.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>{n.excerpt}</div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

const ContactsPage = ({ go }) => {
  const [activeOrg, setActiveOrg] = React.useState(MOCK2.CONTACTS_ORGS[0].id);
  const [form, setForm] = React.useState({ name: '', email: '', topic: '', msg: '' });
  const toast = useToast();
  const o = MOCK2.CONTACTS_ORGS.find(x => x.id === activeOrg);

  return (
    <div className="page-fade container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <nav style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 12 }}>
        <a onClick={() => go('home')} style={{ cursor: 'pointer' }}>Главная</a>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--color-text-2)' }}>Контакты</span>
      </nav>
      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>Контакты</h1>
      <p style={{ fontSize: 15, color: 'var(--color-text-3)', marginTop: 0, marginBottom: 28 }}>
        Свяжитесь с нами или с одним из институтов развития напрямую
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {[
          { icon: 'Phone', title: 'Колл-центр', value: '1408', sub: 'Бесплатно по Казахстану' },
          { icon: 'Mail',  title: 'Email',      value: 'support@qolday.kz', sub: 'Ответим в течение 24 часов' },
        ].map((c, i) => {
          const Ic = I[c.icon];
          return (
            <div key={i} className="card" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--color-accent-soft)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ic size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{c.value}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{c.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 16 }}>Институты развития</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {MOCK2.CONTACTS_ORGS.map(x => (
          <button key={x.id} onClick={() => setActiveOrg(x.id)} style={{
            padding: '8px 14px', height: 34, borderRadius: 8,
            border: '1px solid ' + (activeOrg === x.id ? x.color : 'var(--color-border)'),
            background: activeOrg === x.id ? x.color : '#fff',
            color: activeOrg === x.id ? '#fff' : 'var(--color-text-2)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>{x.short}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 40, display: 'grid', gridTemplateColumns: '1fr 1.4fr', overflow: 'hidden' }}>
        <div style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 10, background: o.color, color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700,
            }}>{o.tag}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{o.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Институт развития</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <I.MapPin size={18} style={{ color: 'var(--color-text-3)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ color: 'var(--color-text-3)', fontSize: 12, marginBottom: 2 }}>Адрес</div>
                <div>г. Астана, {o.address}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <I.Phone size={18} style={{ color: 'var(--color-text-3)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ color: 'var(--color-text-3)', fontSize: 12, marginBottom: 2 }}>Телефон</div>
                <div>{o.phone}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <I.Mail size={18} style={{ color: 'var(--color-text-3)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ color: 'var(--color-text-3)', fontSize: 12, marginBottom: 2 }}>Email</div>
                <div>{o.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <I.Clock size={18} style={{ color: 'var(--color-text-3)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ color: 'var(--color-text-3)', fontSize: 12, marginBottom: 2 }}>Часы работы</div>
                <div>{o.hours}</div>
              </div>
            </div>
          </div>
        </div>
        {/* Map placeholder */}
        <div style={{
          minHeight: 280,
          background: `
            linear-gradient(135deg, #E2E8F0 0%, #F1F5F9 100%),
            repeating-linear-gradient(0deg, transparent 0 39px, rgba(15,23,42,0.06) 39px 40px),
            repeating-linear-gradient(90deg, transparent 0 39px, rgba(15,23,42,0.06) 39px 40px)
          `,
          backgroundBlendMode: 'normal, multiply, multiply',
          position: 'relative',
        }}>
          {/* fake roads */}
          <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.7)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '55%', width: 4, background: 'rgba(255,255,255,0.7)' }} />
          {/* pin */}
          <div style={{ position: 'absolute', top: '40%', left: '55%', transform: 'translate(-50%, -100%)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: o.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-md)', border: '3px solid #fff' }}>
              <I.MapPin size={18} />
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: 4 }}>map_embed_placeholder</div>
        </div>
      </div>

      {/* Feedback form */}
      <div className="card" style={{ padding: 32, maxWidth: 720 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 6 }}>Обратная связь</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 0, marginBottom: 24 }}>Напишите нам, и мы свяжемся с вами в течение рабочего дня</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="field-label">Имя<span className="req">*</span></label>
            <input className="input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ваше имя" />
          </div>
          <div>
            <label className="field-label">Email<span className="req">*</span></label>
            <input className="input" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@mail.kz" />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Тема обращения<span className="req">*</span></label>
          <select className="select" value={form.topic} onChange={(e) => setForm(f => ({ ...f, topic: e.target.value }))} style={{ appearance: 'none' }}>
            <option value="">Выберите тему</option>
            <option>Вопрос по подаче заявки</option>
            <option>Технические проблемы</option>
            <option>Сотрудничество</option>
            <option>Другое</option>
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Сообщение<span className="req">*</span></label>
          <textarea className="textarea" placeholder="Опишите ваш вопрос подробно"
            value={form.msg} onChange={(e) => setForm(f => ({ ...f, msg: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Поля, отмеченные <span style={{ color: 'var(--color-danger)' }}>*</span>, обязательны</span>
          <button className="btn btn-primary" onClick={() => {
            if (!form.name || !form.email || !form.topic || !form.msg) { toast.push('Заполните все обязательные поля', 'error'); return; }
            toast.push('Сообщение отправлено!', 'success');
            setForm({ name: '', email: '', topic: '', msg: '' });
          }}>Отправить <I.ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  );
};

window.KnowledgePage = KnowledgePage;
window.NewsPage = NewsPage;
window.ContactsPage = ContactsPage;
