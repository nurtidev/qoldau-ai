import { I } from '@/components/icons'

export function AdminAnalytics() {
  return (
    <div className="page-fade" style={{ padding: '32px 40px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>Аналитика</h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-3)', margin: '0 0 24px' }}>
        Сводная аналитика по услугам, заявкам и охвату аудитории.
      </p>
      <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: '0 auto 14px',
          background: 'var(--color-surface-2)', color: 'var(--color-text-3)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <I.Hash size={22} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Раздел в разработке</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Появится в следующей версии.</div>
      </div>
    </div>
  )
}
