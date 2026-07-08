import { I } from '@/components/icons'

const ORGS = [
  { short: 'Демеу Финанс',    color: 'var(--color-primary)', tag: 'D', phone: '+7 (7172) 70-10-20', email: 'info@demeu.kz',    address: 'пр. Мангилик Ел, 55А' },
  { short: 'KazExport',       color: '#176D62', tag: 'KE', phone: '+7 (7172) 71-17-27', email: 'info@kazex.kz',    address: 'ул. Достык, 18' },
  { short: 'АгроКапитал',    color: '#1F6B3B', tag: 'AK', phone: '+7 (7172) 72-24-34', email: 'info@agrokap.kz',  address: 'пр. Кабанбай батыра, 11' },
  { short: 'Astana Capital',  color: '#705C33', tag: 'AC', phone: '+7 (7172) 73-31-41', email: 'info@astana.kz',   address: 'ул. Сыганак, 70' },
  { short: 'ИнноФонд',       color: '#0A4F3A', tag: 'IF', phone: '+7 (7172) 74-38-48', email: 'info@innofnd.kz',  address: 'пр. Туран, 24' },
  { short: 'KazGuarantee',   color: '#6E4A24', tag: 'KG', phone: '+7 (7172) 75-45-55', email: 'info@guarant.kz',  address: 'ул. Орынбор, 8' },
]

export function ContactsPage() {
  return (
    <div className="page-fade container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ marginBottom: 32 }}>
        <div className="section-eyebrow" style={{ marginBottom: 8 }}>Помощь</div>
        <h1 className="section-title" style={{ fontSize: 32 }}>Контакты</h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-3)', marginTop: 8 }}>Единый колл-центр: <strong>1414</strong> · Пн–Пт, 09:00–18:00</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {ORGS.map((o, i) => (
          <div key={i} className="card" style={{ padding: 24, display: 'flex', gap: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, background: o.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>{o.tag}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{o.short}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-2)' }}>
                  <I.Phone size={14} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />{o.phone}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-2)' }}>
                  <I.Mail size={14} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />{o.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-2)' }}>
                  <I.MapPin size={14} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />г. Астана, {o.address}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
