import { I } from '@/components/icons'

const ORGS = [
  { short: 'АО «НИХ «Байтерек»',        color: 'var(--color-primary)', tag: 'НБ', phone: '+7 (7172) 69-30-00', email: 'info@baiterek.gov.kz', address: 'пр. Мангилик Ел, 55А', site: 'baiterek.gov.kz' },
  { short: 'Даму',                      color: '#085E2C', tag: 'ДМ',  phone: '1408',                    email: 'info@damu.kz',         address: 'ул. Достык, 18',       site: 'damu.kz' },
  { short: 'Аграрная кредитная корпорация', color: '#1F6B3B', tag: 'АК', phone: '+7 (7172) 72-24-34', email: 'info@agrocredit.kz',   address: 'пр. Кабанбай батыра, 11', site: 'agrocredit.kz' },
  { short: 'КазАгроФинанс',              color: '#257E43', tag: 'КФ',  phone: '+7 (7172) 73-31-41', email: 'info@kaf.kz',          address: 'ул. Сыганак, 70',      site: 'kaf.kz' },
  { short: 'Фонд развития промышленности', color: '#0A4F3A', tag: 'ФР', phone: '+7 (7172) 74-38-48', email: 'info@idfrk.kz',        address: 'пр. Туран, 24',        site: 'idfrk.kz' },
  { short: 'ЭКА KazakhExport',           color: '#176D62', tag: 'ЭК',  phone: '+7 (7172) 75-45-55', email: 'info@kazakhexport.kz', address: 'ул. Орынбор, 8',       site: 'kazakhexport.kz' },
]

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

export function ContactsPage() {
  return (
    <div className="page-fade container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="section-eyebrow" style={{ marginBottom: 8 }}>Помощь</div>
        <h1 className="section-title" style={{ fontSize: 32 }}>Контакты</h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-3)', marginTop: 8 }}>Единое окно поддержки бизнеса — организации группы Холдинга «Байтерек».</p>
      </div>

      {/* Call-center highlight — единая точка входа для предпринимателя */}
      <div
        className="card"
        style={{
          padding: '22px 26px', marginBottom: 32,
          background: 'linear-gradient(135deg, var(--color-primary-tint) 0%, var(--color-surface) 82%)',
          borderColor: 'var(--color-primary-soft)',
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 260px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--color-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <I.Phone size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-3)', fontWeight: 500 }}>Единый колл-центр</div>
            <a href="tel:1414" className="contact-link" style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>1414</a>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: 14, color: 'var(--color-text-2)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <I.Clock size={16} style={{ color: 'var(--color-text-3)' }} /> Пн–Пт, 09:00–18:00
          </div>
          <a href="mailto:support@qoldau.kz" className="contact-link" style={{ fontSize: 14 }}>
            <I.Mail size={16} className="contact-link-ico" /> support@qoldau.kz
          </a>
        </div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Институты развития</h2>
      <div className="contacts-grid">
        {ORGS.map((o, i) => (
          <div key={i} className="card" style={{ padding: 24, display: 'flex', gap: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, background: o.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>{o.tag}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{o.short}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <a href={telHref(o.phone)} className="contact-link">
                  <I.Phone size={14} className="contact-link-ico" />{o.phone}
                </a>
                <a href={`mailto:${o.email}`} className="contact-link">
                  <I.Mail size={14} className="contact-link-ico" />{o.email}
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-2)' }}>
                  <I.MapPin size={14} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />г. Астана, {o.address}
                </div>
                <a href={`https://${o.site}`} target="_blank" rel="noreferrer" className="contact-link">
                  <I.ExternalLink size={14} className="contact-link-ico" />{o.site}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
