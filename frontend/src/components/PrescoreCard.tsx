import { I } from '@/components/icons'
import type { Band } from '@/lib/prescore'

// Карточка предварительной оценки заявителя. Принимает уже посчитанный
// результат (из computePrescore) либо сохранённый снимок (_prescore из заявки).
// Снимок не содержит hint/recommendations — карточка это учитывает.

interface CardFactor {
  id: string
  label: string
  score: number
  weight: number
  hint?: string
}

export interface PrescoreCardResult {
  score: number
  band: Band
  preapprovedLimit: number
  factors: CardFactor[]
  recommendations?: string[]
}

interface Props {
  result: PrescoreCardResult | null
  /** Показать скелетон, пока грузятся mock-данные eGov/КГД. */
  loading?: boolean
  /** Компактный вариант (для админки / карточек заявки). */
  compact?: boolean
}

// ── палитра по бэндам (зелёно-золотая, без синего) ────────────────────────────
const BAND_META: Record<Band, { color: string; soft: string; label: string }> = {
  A: { color: 'var(--color-success)', soft: 'var(--color-success-soft)', label: 'Высокая надёжность' },
  B: { color: 'var(--color-accent)', soft: 'var(--color-accent-soft)', label: 'Хорошая надёжность' },
  C: { color: 'var(--color-warning)', soft: 'var(--color-warning-soft)', label: 'Средний риск' },
  D: { color: 'var(--color-danger)', soft: 'var(--color-danger-soft)', label: 'Высокий риск' },
}

function formatKZT(n: number): string {
  return new Intl.NumberFormat('ru-KZ').format(Math.round(n)) + ' ₸'
}

// ── полукруглый gauge (SVG) ───────────────────────────────────────────────────
function Gauge({ score, color, size = 168 }: { score: number; color: string; size?: number }) {
  const r = 72
  const cx = 90
  const cy = 90
  const semi = Math.PI * r // длина полудуги
  const frac = Math.max(0, Math.min(100, score)) / 100
  const height = size * 0.6

  return (
    <div style={{ position: 'relative', width: size, height, flexShrink: 0 }}>
      <svg width={size} height={height} viewBox={`0 8 180 100`} style={{ display: 'block' }}>
        {/* фон дуги */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={13}
          strokeLinecap="round"
        />
        {/* заполнение по баллу */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={13}
          strokeLinecap="round"
          strokeDasharray={semi}
          strokeDashoffset={semi * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 700ms ease, stroke 300ms ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          {score}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>из 100</div>
      </div>
    </div>
  )
}

function BandBadge({ band }: { band: Band }) {
  const m = BAND_META[band]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 12px',
        borderRadius: 999,
        background: m.soft,
        color: m.color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: m.color,
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {band}
      </span>
      {m.label}
    </span>
  )
}

function FactorBars({ factors }: { factors: CardFactor[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {factors.map((f) => {
        const color =
          f.score >= 70 ? 'var(--color-success)' : f.score >= 50 ? 'var(--color-accent)' : 'var(--color-danger)'
        return (
          <div key={f.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
                {f.label}
                <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 6 }}>
                  · вес {Math.round(f.weight * 100)}%
                </span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{f.score}</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, f.score))}%`,
                  background: color,
                  borderRadius: 999,
                  transition: 'width 600ms ease',
                }}
              />
            </div>
            {f.hint && (
              <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', marginTop: 4, lineHeight: 1.45 }}>{f.hint}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const DISCLAIMER =
  'Предварительная оценка по данным eGov и КГД. Не является решением о выдаче финансирования.'

// ── основной компонент ────────────────────────────────────────────────────────
export function PrescoreCard({ result, loading, compact }: Props) {
  if (loading) {
    return (
      <div className="card" style={{ padding: compact ? 16 : 24 }}>
        <div className="skeleton" style={{ height: 14, width: 220, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div className="skeleton" style={{ height: 100, width: 168, borderRadius: 12 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 14 }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!result) return null

  const m = BAND_META[result.band]

  // ── компактный вариант (админка / карточка заявки) ──
  if (compact) {
    return (
      <div
        className="card"
        style={{ padding: 16, borderLeft: `3px solid ${m.color}`, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: m.soft,
              color: m.color,
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{result.score}</span>
            <span style={{ fontSize: 9, opacity: 0.8 }}>балл</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <I.Shield size={13} /> Предварительная оценка
            </div>
            <BandBadge band={result.band} />
          </div>
          {result.preapprovedLimit > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Предодобрено до</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>
                {formatKZT(result.preapprovedLimit)}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {result.factors.map((f) => {
            const color = f.score >= 70 ? 'var(--color-success)' : f.score >= 50 ? 'var(--color-accent)' : 'var(--color-danger)'
            return (
              <div key={f.id} title={`${f.label}: ${f.score}`}>
                <div style={{ fontSize: 10.5, color: 'var(--color-text-3)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.label}
                </div>
                <div style={{ height: 5, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${f.score}%`, background: color, borderRadius: 999 }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 10.5, color: 'var(--color-text-3)', lineHeight: 1.4 }}>{DISCLAIMER}</div>
      </div>
    )
  }

  // ── полный вариант ──
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <I.Shield size={16} style={{ color: 'var(--color-primary)' }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Предварительная оценка заявителя</h3>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--color-text-3)', margin: '0 0 18px', lineHeight: 1.5 }}>
        Рассчитано по открытым данным eGov и КГД. Ориентир, а не решение о выдаче.
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Gauge score={result.score} color={m.color} />
          <BandBadge band={result.band} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <FactorBars factors={result.factors} />
        </div>
      </div>

      {result.preapprovedLimit > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'var(--color-primary-tint)',
            border: '1px solid var(--color-primary-soft)',
            marginBottom: result.recommendations && result.recommendations.length > 0 ? 18 : 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <I.Coins size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Предварительно одобряемый лимит</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>
              {formatKZT(result.preapprovedLimit)}
            </div>
          </div>
        </div>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            Рекомендации
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.recommendations.map((rec, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                <I.ChevronRight size={15} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 1 }} />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border)', lineHeight: 1.5 }}>
        {DISCLAIMER}
      </div>
    </div>
  )
}
