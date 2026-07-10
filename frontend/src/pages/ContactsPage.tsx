import { useState } from 'react'
import { I } from '@/components/icons'
import { BAITEREK_GROUP } from '@/lib/orgs'
import { useAssistant } from '@/store/assistant'

// Контакты организаций — по их официальным сайтам. `orgId` матчит запись
// канонического реестра (lib/orgs) ради официального логотипа; телефон/почта/
// адрес хранятся локально, т.к. реестр их не содержит. Холдинг «НИХ «Байтерек»»
// сам в BAITEREK_GROUP не входит (там только дочки) — у него orgId нет и плашка
// падает на буквенный тег.
// NB: холдинг, Даму, ФРП и ЭКА реально сидят в одном БЦ «Байтерек»
// (пр. Мангилик Ел, 55А) — прежние «разные улицы» были выдуманы.
const ORGS = [
  { orgId: undefined, short: 'АО «НИХ «Байтерек»',        color: 'var(--color-primary)', tag: 'НБ', phone: '+7 (7172) 91-91-90', email: 'kense@baiterek.gov.kz', address: 'пр. Мангилик Ел, 55А',              site: 'baiterek.gov.kz' },
  { orgId: 'damu',    short: 'Даму',                       color: '#085E2C', tag: 'ДМ', phone: '1408',              email: 'info@fund.kz',         address: 'пр. Мангилик Ел, 55А, блок B',        site: 'damu.kz' },
  { orgId: 'akk',     short: 'Аграрная кредитная корпорация', color: '#1F6B3B', tag: 'АК', phone: '1408',           email: 'info@agrocredit.kz',   address: 'ул. Иманова, 11 (БЦ «Нурсаулет»)',    site: 'agrocredit.kz' },
  { orgId: 'kaf',     short: 'КазАгроФинанс',              color: '#257E43', tag: 'КФ', phone: '1408',              email: 'mailbox@kaf.kz',       address: 'ул. Кенесары, 51',                    site: 'kaf.kz' },
  { orgId: 'frp',     short: 'Фонд развития промышленности', color: '#0A4F3A', tag: 'ФР', phone: '+7 (7172) 79-65-43', email: 'info@idfrk.kz',      address: 'пр. Мангилик Ел, 55А (БЦ «Байтерек»)', site: 'idfrk.kz' },
  { orgId: 'eca',     short: 'ЭКА Казахстана (KazakhExport)', color: '#176D62', tag: 'ЭК', phone: '+7 (7172) 95-56-56', email: 'info@kazakhexport.kz', address: 'пр. Мангилик Ел, 55А, блок B',      site: 'kazakhexport.kz' },
]

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

const logoFor = (orgId?: string) => (orgId ? BAITEREK_GROUP.find((o) => o.id === orgId)?.logo : undefined)

// Приподнятая тень контакт-плашек hero; фокус-кольцо добавляется поверх.
const TILE_SHADOW = 'var(--sh-lg), inset 0 1px 0 rgba(255,255,255,0.85)'

export function ContactsPage() {
  const setOpen = useAssistant((s) => s.setOpen)

  // Ховер-подъём + фокус-кольцо для интерактивных стеклянных плашек. Transform и
  // box-shadow разведены: ховер трогает только transform, фокус — только тень,
  // чтобы состояния не затирали друг друга.
  const lift = (e: React.SyntheticEvent) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }
  const drop = (e: React.SyntheticEvent) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }
  const focusRing = (e: React.FocusEvent) => { (e.currentTarget as HTMLElement).style.boxShadow = `var(--sh-focus), ${TILE_SHADOW}` }
  const blurRing = (e: React.FocusEvent) => { (e.currentTarget as HTMLElement).style.boxShadow = TILE_SHADOW }

  const tileStyle: React.CSSProperties = {
    padding: '16px 18px',
    boxShadow: TILE_SHADOW,
    cursor: 'pointer',
    display: 'block',
    textDecoration: 'none',
    transition: 'transform 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
  }

  return (
    <div className="page-fade">
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="hero-gradient-bg" style={{ paddingTop: 48, paddingBottom: 56, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(7,102,61,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(180deg, transparent, black 20%, black 80%, transparent)',
          pointerEvents: 'none',
        }} />
        <div className="ornament-tile ornament-fade ornament-hero" aria-hidden="true" />
        <div className="container" style={{ position: 'relative' }}>
          <div className="section-eyebrow" style={{ marginBottom: 10 }}>Мы на связи</div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--color-text)', lineHeight: 1.12 }}>
            Свяжитесь с нами удобным способом
          </h1>
          <p style={{ fontSize: 16, color: 'var(--color-text-2)', maxWidth: 640, lineHeight: 1.55, marginTop: 14, marginBottom: 0 }}>
            Консультации по программам всех организаций группы «Байтерек» — в одном месте. Позвоните
            в единый контакт-центр, напишите на почту поддержки или спросите AI-консультанта прямо
            на портале.
          </p>

          {/* Каналы связи — стеклянные плашки, каждая интерактивна */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 32, maxWidth: 760 }}>
            {/* Единый контакт-центр */}
            <a
              href="tel:1408"
              className="glass"
              style={tileStyle}
              onMouseEnter={lift} onMouseLeave={drop} onFocus={focusRing} onBlur={blurRing}
            >
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 500 }}>Единый контакт-центр</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.01em', lineHeight: 1.2, marginTop: 4 }}>1408</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>бесплатно · Пн–Пт 08:30–17:30</div>
            </a>

            {/* Почта поддержки */}
            <a
              href="mailto:support@qoldau.kz"
              className="glass"
              style={tileStyle}
              onMouseEnter={lift} onMouseLeave={drop} onFocus={focusRing} onBlur={blurRing}
            >
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 500 }}>Почта поддержки</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1.3, marginTop: 4, wordBreak: 'break-all' }}>support@qoldau.kz</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>ответим в течение рабочего дня</div>
            </a>

            {/* AI-консультант — открывает плавающий виджет чата */}
            <button
              type="button"
              aria-label="Открыть AI-консультанта"
              onClick={() => setOpen(true)}
              className="glass"
              style={{ ...tileStyle, font: 'inherit', textAlign: 'left', border: 'none', width: '100%' }}
              onMouseEnter={lift} onMouseLeave={drop} onFocus={focusRing} onBlur={blurRing}
            >
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 500 }}>AI-консультант</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1.2, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <I.Sparkle size={18} /> Спросить сейчас
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>мгновенные ответы по программам · 24/7</div>
            </button>
          </div>
        </div>
      </section>

      {/* ── ГЛАВНАЯ КАРТОЧКА КОЛЛ-ЦЕНТРА ────────────────────────────────── */}
      <div className="container" style={{ marginTop: 28 }}>
        <div
          className="card"
          style={{
            padding: '26px 28px',
            background: 'linear-gradient(135deg, var(--color-primary-tint) 0%, var(--color-surface) 82%)',
            borderColor: 'var(--color-primary-soft)',
            display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: '1 1 300px' }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--color-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <I.Phone size={24} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-3)', fontWeight: 500 }}>Единый контакт-центр холдинга</div>
              <a href="tel:1408" className="contact-link" style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>1408</a>
              <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 4, lineHeight: 1.5 }}>
                Бесплатно с любых мобильных · консультации по программам всех дочерних организаций
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 999, color: 'var(--color-text-2)' }}>
              <I.Clock size={16} style={{ color: 'var(--color-text-3)' }} /> Пн–Пт, 08:30–17:30
            </span>
            <a href="mailto:support@qoldau.kz" className="contact-link" style={{ fontSize: 14 }}>
              <I.Mail size={16} className="contact-link-ico" /> support@qoldau.kz
            </a>
          </div>
        </div>
      </div>

      {/* ── ОРГАНИЗАЦИИ ГРУППЫ ───────────────────────────────────────────── */}
      <section className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>Группа «Байтерек»</div>
            <h2 className="section-title">Институты развития</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6, marginBottom: 0 }}>Организации-операторы услуг портала</p>
          </div>
          <a href="https://baiterek.gov.kz" target="_blank" rel="noreferrer" className="contact-link" style={{ fontSize: 12.5 }}>
            <I.ExternalLink size={13} className="contact-link-ico" />Полная структура группы — на baiterek.gov.kz
          </a>
        </div>

        <div className="contacts-grid">
          {ORGS.map((o, i) => (
            <OrgCard key={i} org={o} />
          ))}
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginTop: 28, marginBottom: 0 }}>
          Контактные данные организаций приведены по их официальным сайтам.
        </p>
      </section>
    </div>
  )
}

function OrgCard({ org: o }: { org: typeof ORGS[number] }) {
  const logo = logoFor(o.orgId)
  // Официальный логотип — приоритет; onError откатывает на буквенную плашку без
  // повторных запросов (паттерн OrgTile на главной).
  const [logoOk, setLogoOk] = useState(!!logo)

  return (
    <div
      className="card"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', transition: 'transform 160ms var(--ease-out), border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)' }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = o.color; el.style.boxShadow = 'var(--sh-md)'; el.style.transform = 'translateY(-3px)' }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border)'; el.style.boxShadow = 'var(--sh-xs)'; el.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {logo && logoOk ? (
          <img
            src={logo}
            alt={o.short}
            onError={() => setLogoOk(false)}
            style={{ height: 28, width: 'auto', maxWidth: 140, objectFit: 'contain' }}
          />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 10, background: o.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{o.tag}</div>
        )}
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, minWidth: 0 }}>{o.short}</div>
      </div>

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
  )
}
