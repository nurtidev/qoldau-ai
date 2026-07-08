import { I } from '@/components/icons'

const ORGS = [
  { short: 'АО «НИХ «Байтерек»',        color: 'var(--color-primary)', tag: 'НБ', phone: '+7 (7172) 69-30-00', email: 'info@baiterek.gov.kz', address: 'пр. Мангилик Ел, 55А', site: 'baiterek.gov.kz' },
  { short: 'Даму',                      color: '#085E2C', tag: 'ДМ',  phone: '1408',                    email: 'info@damu.kz',         address: 'ул. Достык, 18',       site: 'damu.kz' },
  { short: 'Аграрная кредитная корпорация', color: '#1F6B3B', tag: 'АК', phone: '+7 (7172) 72-24-34', email: 'info@agrocredit.kz',   address: 'пр. Кабанбай батыра, 11', site: 'agrocredit.kz' },
  { short: 'КазАгроФинанс',              color: '#257E43', tag: 'КФ',  phone: '+7 (7172) 73-31-41', email: 'info@kaf.kz',          address: 'ул. Сыганак, 70',      site: 'kaf.kz' },
  { short: 'Фонд развития промышленности', color: '#0A4F3A', tag: 'ФР', phone: '+7 (7172) 74-38-48', email: 'info@idfrk.kz',        address: 'пр. Туран, 24',        site: 'idfrk.kz' },
  { short: 'ЭКА KazakhExport',           color: '#176D62', tag: 'ЭК',  phone: '+7 (7172) 75-45-55', email: 'info@kazakhexport.kz', address: 'ул. Орынбор, 8',       site: 'kazakhexport.kz' },
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-2)' }}>
                  <I.ExternalLink size={14} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />{o.site}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
