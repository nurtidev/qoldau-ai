import { useEffect, useState } from 'react'
import { mockApi, type KGDData } from '@/api/client'
import { I } from '@/components/icons'

interface Props {
  bin: string
  onComplete?: (data: KGDData) => void
}

function formatKZT(n: number): string {
  return new Intl.NumberFormat('ru-KZ').format(Math.round(n)) + ' ₸'
}

const STAGES = [
  'Подключение к cabinet.salyk.kz…',
  'Запрос налоговой истории по БИН…',
  'Проверка задолженностей и нарушений…',
  'Сверка с реестром НДС-плательщиков…',
]

export function KGDCheck({ bin, onComplete }: Props) {
  const [stage, setStage] = useState(0)
  const [data, setData] = useState<KGDData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []

    // Animated stage progression (visual realism)
    STAGES.forEach((_, idx) => {
      timers.push(window.setTimeout(() => {
        if (!cancelled) setStage(idx)
      }, idx * 450))
    })

    // Fetch in parallel; show after animation
    mockApi.kgd(bin)
      .then(res => {
        const d = res.data as KGDData
        const minDelay = STAGES.length * 450 + 200
        window.setTimeout(() => {
          if (!cancelled) {
            setData(d)
            onComplete?.(d)
          }
        }, minDelay)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось получить данные из КГД')
      })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [bin, onComplete])

  if (error) {
    return (
      <div style={{
        background: '#FEF2F2', border: '1px solid #FECACA',
        borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, marginBottom: 16,
      }}>
        <I.Alert size={20} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 14, color: '#991B1B' }}>{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{
        background: 'var(--color-info-soft)', border: '1px solid #BAE6FD',
        borderRadius: 10, padding: '16px 18px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 18, height: 18, border: '2px solid #0369A1', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <strong style={{ fontSize: 14, color: '#075985' }}>Получаем налоговую историю из КГД</strong>
        </div>
        <div style={{ fontSize: 13, color: '#0C4A6E', paddingLeft: 30, minHeight: 18 }}>
          {STAGES[stage]}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const latest = data.annual_revenue[data.annual_revenue.length - 1]
  const compliant = data.compliance_status === 'compliant' && data.current_tax_debt === 0

  return (
    <div style={{
      background: compliant ? 'var(--color-success-soft)' : '#FEF3C7',
      border: `1px solid ${compliant ? '#A7F3D0' : '#FCD34D'}`,
      borderRadius: 10, padding: '14px 18px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <I.CheckCircle size={20} style={{
          color: compliant ? 'var(--color-success)' : '#B45309',
          flexShrink: 0, marginTop: 1,
        }} />
        <div style={{ flex: 1, fontSize: 14, color: compliant ? '#065F46' : '#78350F', lineHeight: 1.55 }}>
          <strong>Налоговая история КГД получена.</strong>{' '}
          Режим: {data.tax_regime}. Задолженность: {data.current_tax_debt === 0 ? 'отсутствует' : formatKZT(data.current_tax_debt)}.
          Выручка за {latest.year}: {formatKZT(latest.amount)}.
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            style={{
              marginLeft: 8, background: 'none', border: 'none', padding: 0,
              color: compliant ? '#047857' : '#92400E', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, textDecoration: 'underline',
            }}
          >
            {expanded ? 'скрыть' : 'подробнее'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${compliant ? '#A7F3D0' : '#FCD34D'}`,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px',
          fontSize: 13, color: 'var(--color-text-2)',
        }}>
          <Row label="БИН"                value={data.bin} />
          <Row label="Дата регистрации"   value={data.registration_date} />
          <Row label="НДС-плательщик"     value={data.is_vat_payer ? `Да (свид-во ${data.vat_certificate_no})` : 'Нет'} />
          <Row label="Последний период"   value={data.last_filed_period} />
          <Row label="Сотрудников"        value={String(data.employees_count)} />
          <Row label="ФОТ годовой"        value={formatKZT(data.wage_fund_annual)} />
          <Row label="КПН уплачен"        value={formatKZT(data.corporate_income_tax_paid)} />
          <Row label="Соц.отчисления"     value={formatKZT(data.social_contributions_paid)} />
          <Row label="Задолж. в ЕНПФ"     value={data.current_pension_debt === 0 ? 'нет' : formatKZT(data.current_pension_debt)} />
          <Row label="В реестре риска"    value={data.in_risk_register ? 'Да' : 'Нет'} />
          <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>Выручка за 3 года</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {data.annual_revenue.map(r => (
                <div key={r.year} style={{ fontSize: 13 }}>
                  <strong>{r.year}:</strong> {formatKZT(r.amount)}
                </div>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>Виды деятельности (ОКЭД)</div>
            {data.okeds.map(o => (
              <div key={o.code} style={{ fontSize: 13 }}>
                <strong>{o.code}</strong> — {o.name}
              </div>
            ))}
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--color-text-3)', marginTop: 6 }}>
            Источник: {data.data_source} · получено {new Date(data.fetched_at).toLocaleString('ru-RU')}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--color-text-3)' }}>{label}</span>
      <span style={{ color: 'var(--color-text)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
