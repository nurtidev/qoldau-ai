import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer style={{ background: '#0F172A', color: '#CBD5E1', marginTop: 80, position: 'relative', overflow: 'hidden' }}>
      <div className="ornament-tile-gold" aria-hidden="true" style={{ opacity: 0.05 }} />
      <div className="container footer-container" style={{ padding: '56px 32px 32px', position: 'relative', zIndex: 1 }}>
        <div className="footer-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/img/baiterek.png" alt="Байтерек" style={{ height: 28, width: 'auto', display: 'block' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Qoldau AI</div>
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
            { title: 'Платформа', items: [
              { label: 'Все услуги', to: '/services' },
              { label: 'База знаний', to: '/knowledge' },
              { label: 'Новости', to: '/news' },
              { label: 'Контакты', to: '/contacts' },
            ]},
            { title: 'Информация', items: [
              { label: 'О портале', to: '/' },
              { label: 'Документы', to: '/' },
              { label: 'Часто задаваемые вопросы', to: '/knowledge' },
              { label: 'Партнёры', to: '/' },
            ]},
            { title: 'Контакты', items: [
              { label: '+7 (7172) 79-70-70', to: null },
              { label: 'support@qoldau.kz', to: null },
              { label: 'г. Астана, пр. Мангилик Ел, 55А', to: null },
              { label: 'Пн–Пт, 09:00–18:00', to: null },
            ]},
          ].map((col, i) => (
            <div key={i}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 14, letterSpacing: '0.02em' }}>{col.title}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.items.map((it, j) => (
                  <li key={j} style={{ fontSize: 13, color: '#94A3B8' }}>
                    {it.to ? <Link to={it.to} style={{ color: '#94A3B8' }}>{it.label}</Link> : it.label}
                  </li>
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

      <style>{`
        @media (max-width: 640px) {
          .footer-container { padding-left: 16px !important; padding-right: 16px !important; }
          .footer-cols { gap: 32px !important; }
        }
      `}</style>
    </footer>
  )
}
