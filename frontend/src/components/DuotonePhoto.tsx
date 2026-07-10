import { useState } from 'react'

/**
 * Фото под зелёным дуотоном (брендовая гамма Байтерека). Приём как на главной
 * (.hero-visual-wrap): реальный кадр из media/services превращается в
 * монохромно-зелёный через mix-blend-mode:luminosity над зелёным градиентом —
 * так фото несёт фактуру и свет, а цвет остаётся строго фирменным.
 *
 * Позиционируется абсолютом (inset:0) — родитель ОБЯЗАН быть position:relative
 * с заданной высотой. onError скрывает фото-слой: остаётся сплошная зелёная
 * подложка (никаких битых картинок / серых дыр). isolation:isolate держит
 * blend-эффект внутри и не задевает соседей.
 */
export function DuotonePhoto({
  src,
  focus = 'center 40%',
  scrim = 'none',
  style,
  children,
}: {
  src: string
  /** CSS object-position кропа кадра. */
  focus?: string
  /** Затемняющий градиент под белый текст. */
  scrim?: 'bottom' | 'left' | 'none'
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  const [ok, setOk] = useState(true)
  const scrimBg =
    scrim === 'left'
      ? 'linear-gradient(90deg, rgba(0,52,28,0.72) 0%, rgba(0,64,34,0.34) 46%, transparent 82%)'
      : scrim === 'bottom'
        ? 'linear-gradient(0deg, rgba(0,52,28,0.80) 0%, rgba(0,64,34,0.28) 46%, transparent 78%)'
        : ''
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        isolation: 'isolate',
        background:
          'linear-gradient(150deg, var(--color-primary-700) 0%, var(--color-primary) 56%, var(--color-primary-600) 100%)',
        ...style,
      }}
    >
      {ok && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setOk(false)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: focus,
            mixBlendMode: 'luminosity',
            opacity: 0.85,
          }}
        />
      )}
      {/* multiply-слой углубляет зелёный в тенях, сохраняя фирменный hue */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(150deg, rgba(0,86,46,0.42) 0%, rgba(0,122,64,0.12) 58%, transparent 100%)',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />
      {scrimBg && (
        <div style={{ position: 'absolute', inset: 0, background: scrimBg, pointerEvents: 'none' }} />
      )}
      {children}
    </div>
  )
}
