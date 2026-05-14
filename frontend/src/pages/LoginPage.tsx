import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi, mockApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { I } from '@/components/icons'
import { Logo } from '@/components/Layout/Header'

export function LoginPage() {
  const [iin, setIin]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()

  const handleEgov = async (e: React.FormEvent) => {
    e.preventDefault()
    if (iin.length < 12) {
      setError('ИИН/БИН должен содержать 12 цифр')
      return
    }
    setLoading(true)
    setError('')
    try {
      const egovRes = await mockApi.egov(iin)
      const egov    = egovRes.data
      const res     = await authApi.login(iin, egov.full_name, egov.org_name ?? '')
      setAuth(res.data.user, res.data.token)
      if (res.data.user.role === 'admin' || res.data.user.role === 'author') {
        navigate('/admin')
      } else {
        navigate('/cabinet')
      }
    } catch {
      setError('Ошибка авторизации. Проверьте ИИН/БИН.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Logo size={28} withText={false} />
            <Link to="/" className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }}>
              <I.X size={16} />
            </Link>
          </div>

          <div style={{ padding: '20px 28px 28px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 6, letterSpacing: '-0.01em' }}>
              Войти в Qoldau AI
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 0, marginBottom: 20 }}>
              Используйте ИИН/БИН для входа через eGov
            </p>

            {/* eGov trust badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--color-info-soft)', borderRadius: 8, marginBottom: 20, fontSize: 13, color: 'var(--color-info)' }}>
              <I.Shield size={16} style={{ flexShrink: 0 }} />
              <span>Защищённое подключение через eGov — данные компании заполнятся автоматически</span>
            </div>

            {/* eGov form */}
            <form onSubmit={handleEgov}>
              <div style={{ marginBottom: 12 }}>
                <label className="field-label">ИИН / БИН</label>
                <input
                  className="input"
                  type="text"
                  value={iin}
                  onChange={e => setIin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="123456789012"
                  maxLength={12}
                  autoFocus
                  style={{ letterSpacing: '0.08em', fontSize: 15 }}
                />
                <div className="field-help">{iin.length}/12 · Для теста: <strong>000000000000</strong> (админ) или любой 12-значный</div>
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--color-danger-soft)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#B91C1C' }}>
                  <I.Alert size={15} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block" style={{ height: 48 }}>
                {loading ? (
                  <>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 700ms linear infinite', display: 'inline-block' }} />
                    Загрузка…
                  </>
                ) : (
                  <><I.Shield size={18} /> Войти через eGov</>
                )}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--color-text-3)' }}>
              Нет аккаунта? Просто введите ваш ИИН — он будет создан автоматически.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
