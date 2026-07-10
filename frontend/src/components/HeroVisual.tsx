import { I } from '@/components/icons'

/**
 * Deep-green liquid-glass panel ("экосистема Байтерек" — единое окно):
 * a fanned stack of step cards (find → apply → track) plus a seal-style
 * Bayterek emblem. Раньше жил desktop-only якорем в hero; после того как
 * hero стал «текст + чистое фото», карточка переехала в секцию
 * «Рассчитайте условия» рядом с калькулятором (см. HomePage) и теперь
 * видна на всех ширинах, поэтому больше не завёрнута в .hero-visual-wrap
 * и не aria-hidden — это самостоятельный информационный блок.
 */

const STEPS: Array<{ n: number; icon: keyof typeof I; title: string; tag: string; style: React.CSSProperties }> = [
  {
    n: 1,
    icon: 'Search',
    title: 'Подберите меру поддержки',
    tag: 'Каталог программ',
    style: { top: 0, right: 36, transform: 'rotate(-5deg)', zIndex: 1, opacity: 0.92 },
  },
  {
    n: 2,
    icon: 'Document',
    title: 'Подайте заявку онлайн',
    tag: 'через eGov-профиль',
    style: { top: 54, right: 14, transform: 'rotate(3deg)', zIndex: 2 },
  },
  {
    n: 3,
    icon: 'CheckCircle',
    title: 'Отследите статус в кабинете',
    tag: 'решение за дни, не месяцы',
    style: { top: 110, right: 0, transform: 'rotate(-1.5deg)', zIndex: 3 },
  },
]

function StepCard({ n, icon, title, tag, style }: (typeof STEPS)[number]) {
  const Icon = I[icon]
  return (
    <div
      className="glass"
      style={{
        position: 'absolute',
        left: 0,
        maxWidth: 280,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: 'var(--sh-lg), inset 0 1px 0 rgba(255,255,255,0.85)',
        ...style,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {Icon && <Icon size={18} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>{tag}</div>
      </div>
      <div style={{
        marginLeft: 'auto', width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: 'var(--color-accent)', color: '#1A1206', fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {n}
      </div>
    </div>
  )
}

export function EcosystemCard() {
  return (
    <div className="glass-green" style={{
      position: 'relative',
      overflow: 'hidden',
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* ornament overlay — a separate absolutely-positioned layer, not
          applied to the panel itself: .ornament-tile-gold sets
          position:absolute + opacity on its own element, which would
          fade the whole panel (incl. text) if placed on the same node. */}
      <div className="ornament-tile-gold ornament-hero" aria-hidden="true" />

        {/* glass sheen highlight, top-left */}
        <div style={{
          position: 'absolute', top: -70, left: -70, width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* seal / emblem, top-right */}
        <div style={{
          position: 'absolute', top: 24, right: 24, width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(255,255,255,0.10)',
          border: '1.5px solid rgba(211,185,97,0.55)',
          boxShadow: '0 0 0 4px rgba(211,185,97,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <I.Shield size={24} style={{ color: 'var(--color-gold)' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
            padding: '6px 14px', borderRadius: 999,
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.26)',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.03em',
            color: '#FAF0D8' /* pale gold, AA on green gradient — see eGov CTA note below */,
          }}>
            <I.Building size={14} /> Экосистема «Байтерек»
          </div>

          <div style={{ marginTop: 24, maxWidth: 240, fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 700, lineHeight: 1.32, color: '#fff' }}>
            Все меры поддержки — в одном окне
          </div>

          {/* fanned stack of step cards — центрируется в свободной высоте
              (flex:1 обёртка), чтобы при равной высоте с калькулятором не
              оставалось пустой «дыры» между шагами и статами внизу. */}
          <div style={{ flex: 1, minHeight: 254, display: 'flex', alignItems: 'center', marginTop: 32 }}>
            <div style={{ position: 'relative', width: '100%', height: 210 }}>
              {STEPS.map((s) => <StepCard key={s.n} {...s} />)}
            </div>
          </div>

          <div style={{
            paddingTop: 24, display: 'flex', gap: 28,
            borderTop: '1px solid rgba(255,255,255,0.18)',
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Онлайн</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>без визита в офис</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>1 профиль</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>для всех институтов</div>
            </div>
          </div>
        </div>
    </div>
  )
}
