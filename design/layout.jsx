// ===== Shared layout: Logo, Header, Footer, Toast, OrgBadge =====

const Logo = ({ size = 32, withText = true }) => {
  const fz = Math.round(size * 0.53);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="logo-mark" style={{ width: size, height: size, borderRadius: size * 0.25, fontSize: fz }}>
        Q
      </div>
      {withText && (
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>Qolday <span style={{ color: 'var(--color-accent)' }}>AI</span></div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 1 }}>Единое окно поддержки бизнеса</div>
        </div>
      )}
    </div>
  );
};

const OrgBadge = ({ orgId, size = 'sm' }) => {
  const o = MOCK.orgById(orgId);
  if (!o) return null;
  const dim = size === 'lg' ? 40 : size === 'md' ? 32 : 24;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: dim, height: dim, borderRadius: 6,
        background: o.color, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: dim * 0.34, fontWeight: 700, letterSpacing: '0.02em',
        flexShrink: 0,
      }}>{o.tag}</div>
      <span style={{ fontSize: size === 'lg' ? 14 : 13, color: 'var(--color-text-2)', fontWeight: 500 }}>{o.short}</span>
    </div>
  );
};

const Header = ({ go, current, onLogin }) => {
  const [lang, setLang] = React.useState('RU');
  const links = [
    { id: 'services',  label: 'Услуги' },
    { id: 'knowledge', label: 'База знаний' },
    { id: 'news',      label: 'Новости' },
    { id: 'contacts',  label: 'Контакты' },
  ];
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'saturate(140%) blur(8px)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64, gap: 32 }}>
        <a onClick={() => go('home')} style={{ cursor: 'pointer' }}><Logo /></a>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {links.map(l => (
            <a key={l.id}
              onClick={() => go(l.id)}
              style={{
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 500,
                color: current === l.id ? 'var(--color-primary)' : 'var(--color-text-2)',
                borderRadius: 6,
                cursor: 'pointer',
                background: current === l.id ? 'var(--color-accent-soft)' : 'transparent',
                transition: 'background 120ms, color 120ms',
              }}
              onMouseEnter={(e) => { if (current !== l.id) e.currentTarget.style.background = 'var(--color-surface-2)'; }}
              onMouseLeave={(e) => { if (current !== l.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'var(--color-surface-2)',
            borderRadius: 6, padding: 2,
          }}>
            {['RU', 'KZ'].map(l => (
              <button key={l}
                onClick={() => setLang(l)}
                style={{
                  height: 28, padding: '0 10px', border: 'none',
                  background: lang === l ? '#fff' : 'transparent',
                  color: lang === l ? 'var(--color-text)' : 'var(--color-text-3)',
                  fontSize: 12, fontWeight: 600, borderRadius: 5,
                  boxShadow: lang === l ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                }}
              >{l}</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm">
            <I.Phone size={16} />
            <span>1408</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onLogin}>
            <I.User size={16} /> Войти
          </button>
        </div>
      </div>
    </header>
  );
};

const Footer = ({ go }) => (
  <footer style={{ background: '#0F172A', color: '#CBD5E1', marginTop: 80 }}>
    <div className="container" style={{ padding: '56px 32px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 48 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div className="logo-mark" style={{ background: 'var(--color-accent)' }}>Q</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Qolday AI</div>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#94A3B8', maxWidth: 320, margin: 0 }}>
            Единое окно государственной поддержки бизнеса. Объединяем 70+ мер поддержки от институтов развития РК.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {['T', 'F', 'I', 'Y'].map((l, i) => (
              <a key={i} style={{
                width: 32, height: 32, borderRadius: 6,
                background: 'rgba(255,255,255,0.06)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{l}</a>
            ))}
          </div>
        </div>
        {[
          { title: 'Платформа', items: ['Все услуги', 'Категории', 'Организации', 'База знаний'] },
          { title: 'Информация', items: ['О портале', 'Новости', 'Документы', 'Часто задаваемые вопросы'] },
          { title: 'Контакты', items: ['+7 (7172) 79-70-70', 'support@qolday.kz', 'г. Астана, пр. Мангилик Ел, 55А', 'Пн–Пт, 09:00–18:00'] },
        ].map((col, i) => (
          <div key={i}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 14, letterSpacing: '0.02em' }}>{col.title}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.items.map((it, j) => (
                <li key={j} style={{ fontSize: 13, color: '#94A3B8', cursor: i < 2 ? 'pointer' : 'default' }}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '40px 0 20px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#64748B' }}>
        <div>© 2026 АО «Холдинг «Байтерек». Все права защищены.</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <span style={{ cursor: 'pointer' }}>Условия использования</span>
          <span style={{ cursor: 'pointer' }}>Политика конфиденциальности</span>
          <span style={{ cursor: 'pointer' }}>Карта сайта</span>
        </div>
      </div>
    </div>
  </footer>
);

// Toast manager
const ToastContext = React.createContext({ push: () => {} });
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((msg, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'success' && <I.CheckCircle size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />}
            {t.kind === 'error' && <I.Alert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />}
            {t.kind === 'info' && <I.Info size={18} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 1 }} />}
            <div style={{ flex: 1, color: 'var(--color-text)', fontSize: 14 }}>{t.msg}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
const useToast = () => React.useContext(ToastContext);

Object.assign(window, { Logo, OrgBadge, Header, Footer, ToastProvider, useToast, ToastContext });
