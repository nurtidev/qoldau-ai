const NEWS = [
  { id: 1, org: 'Демеу',    color: 'var(--color-primary)', date: '24 апр. 2026', title: 'Снижена ставка по программе «Demeu» до 9% годовых',  tag: 'Программы', readTime: '3 мин', excerpt: 'С 1 мая 2026 года вступают в силу обновлённые условия льготного финансирования малого и среднего бизнеса.' },
  { id: 2, org: 'KazExport',color: '#176D62', date: '22 апр. 2026', title: 'KazExport открыл представительство в Ташкенте',       tag: 'Новости',    readTime: '2 мин', excerpt: 'Новый офис будет работать с экспортёрами текстиля, продовольствия и машиностроения.' },
  { id: 3, org: 'ИнноФонд', color: '#0A4F3A', date: '18 апр. 2026', title: 'Запущен новый раунд грантов для tech-стартапов',       tag: 'Гранты',     readTime: '4 мин', excerpt: 'Подача заявок открыта до 30 июня 2026. Гранты до 50 млн тенге для проектов в области ИТ и биотех.' },
  { id: 4, org: 'Astana Cap',color: '#705C33', date: '15 апр. 2026', title: 'Astana Capital снизил минимальный порог инвестиций',   tag: 'Инвестиции', readTime: '3 мин', excerpt: 'Минимальный размер инвестиционного раунда снижен до 200 млн тенге.' },
  { id: 5, org: 'АгроКапитал',color:'#1F6B3B', date: '11 апр. 2026', title: 'Новые условия лизинга сельхозтехники в АПК',          tag: 'Агросектор', readTime: '5 мин', excerpt: 'Аванс снижен с 20% до 15%, добавлены сезонные графики платежей.' },
  { id: 6, org: 'KazGuarantee',color:'#6E4A24',date: '08 апр. 2026', title: 'Расширены отрасли для гарантирования кредитов',        tag: 'Гарантии',   readTime: '3 мин', excerpt: 'В программу включены креативные индустрии, образование и здравоохранение.' },
]

export function NewsPage() {
  return (
    <div className="page-fade container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ marginBottom: 32 }}>
        <div className="section-eyebrow" style={{ marginBottom: 8 }}>События</div>
        <h1 className="section-title" style={{ fontSize: 32 }}>Новости и анонсы</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
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
                <span>{n.date}</span><span>·</span><span>{n.tag}</span><span>·</span><span>{n.readTime}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>{n.excerpt}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
