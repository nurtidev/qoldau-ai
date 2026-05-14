import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '@/api/client'
import { I } from '@/components/icons'
import { LoginModal } from '@/components/LoginModal'

const LINKS = [
  { id: 'services',  label: 'Услуги',       to: '/services' },
  { id: 'knowledge', label: 'База знаний',  to: '/knowledge' },
  { id: 'news',      label: 'Новости',      to: '/news' },
  { id: 'contacts',  label: 'Контакты',     to: '/contacts' },
]

export function Logo({ size = 32, withText = true }: { size?: number; withText?: boolean }) {
  const fz = Math.round(size * 0.53)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="logo-mark" style={{ width: size, height: size, borderRadius: size * 0.25, fontSize: fz }}>Q</div>
      {withText && (
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>
            Qoldau <span style={{ color: 'var(--color-accent)' }}>AI</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 1 }}>Единое окно поддержки бизнеса</div>
        </div>
      )}
    </div>
  )
}

export function Header() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [lang, setLang] = useState('RU')
  const [showLogin, setShowLogin] = useState(false)

  const current = location.pathname.startsWith('/services') ? 'services'
    : location.pathname.startsWith('/knowledge') ? 'knowledge'
    : location.pathname.startsWith('/news') ? 'news'
    : location.pathname.startsWith('/contacts') ? 'contacts'
    : ''

  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  })
  const unread = notifs.filter((n: { is_read: boolean }) => !n.is_read).length

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'saturate(140%) blur(8px)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64, gap: 32 }}>
          <Link to="/"><Logo /></Link>

          <nav style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {LINKS.map((l) => (
              <Link key={l.id} to={l.to} style={{
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 500,
                color: current === l.id ? 'var(--color-primary)' : 'var(--color-text-2)',
                borderRadius: 6,
                background: current === l.id ? 'var(--color-accent-soft)' : 'transparent',
                transition: 'background 120ms, color 120ms',
              }}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Lang switcher */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-surface-2)', borderRadius: 6, padding: 2 }}>
              {['RU', 'KZ'].map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{
                  height: 28, padding: '0 10px', border: 'none',
                  background: lang === l ? '#fff' : 'transparent',
                  color: lang === l ? 'var(--color-text)' : 'var(--color-text-3)',
                  fontSize: 12, fontWeight: 600, borderRadius: 5, cursor: 'pointer',
                  boxShadow: lang === l ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                }}>{l}</button>
              ))}
            </div>

            <button className="btn btn-ghost btn-sm">
              <I.Phone size={16} /><span>1414</span>
            </button>

            {user ? (
              <>
                {/* Notifications */}
                <Link to="/cabinet" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, color: 'var(--color-text-2)' }}>
                  <I.Bell size={18} />
                  {unread > 0 && (
                    <span style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--color-danger)',
                      border: '2px solid #fff',
                    }} />
                  )}
                </Link>
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'var(--color-primary)', color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13,
                  }}>
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                </div>
                {user.role === 'admin' || user.role === 'author' ? (
                  <Link to="/admin" className="btn btn-secondary btn-sm">Админ</Link>
                ) : (
                  <Link to="/cabinet" className="btn btn-secondary btn-sm">Кабинет</Link>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/') }}>
                  Выйти
                </button>
              </>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowLogin(true)}>
                <I.User size={16} /> Войти
              </button>
            )}
          </div>
        </div>
      </header>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={(role) => {
            setShowLogin(false)
            if (role === 'admin' || role === 'author') navigate('/admin')
            else navigate('/cabinet')
          }}
        />
      )}
    </>
  )
}

const ADMIN_NAV = [
  { id: 'dash',     label: 'Дашборд',      icon: 'Grid',      to: '/admin' },
  { id: 'apps',     label: 'Заявки',       icon: 'Document',  to: '/admin/applications' },
  { id: 'services', label: 'Услуги',       icon: 'Briefcase', to: '/admin/services' },
  { id: 'users',    label: 'Пользователи', icon: 'User',      to: null },
  { id: 'analytics',label: 'Аналитика',    icon: 'Hash',      to: null },
  { id: 'settings', label: 'Настройки',    icon: 'Sliders',   to: null },
]

export function AdminSidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const active = location.pathname.startsWith('/admin/applications') ? 'apps'
    : location.pathname.startsWith('/admin/services') ? 'services'
    : 'dash'

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: '#0F172A', color: '#CBD5E1',
      padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 2,
      minHeight: 'calc(100vh - 64px)', position: 'sticky', top: 64,
    }}>
      <div style={{ padding: '8px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Админ-панель</div>
      </div>
      {ADMIN_NAV.map((it) => {
        const Ic = I[it.icon as keyof typeof I]
        const isActive = active === it.id
        return (
          <button
            key={it.id}
            onClick={() => it.to && navigate(it.to)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', border: 'none', cursor: it.to ? 'pointer' : 'not-allowed',
              background: isActive ? 'rgba(59,130,246,0.18)' : 'transparent',
              color: isActive ? '#fff' : it.to ? '#94A3B8' : '#475569',
              borderRadius: 6, fontSize: 13, fontWeight: isActive ? 600 : 500,
              transition: 'all 120ms', opacity: it.to ? 1 : 0.5,
              borderLeft: isActive ? '3px solid #3B82F6' : '3px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (!isActive && it.to) {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(255,255,255,0.04)'
                el.style.color = '#fff'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'transparent'
                el.style.color = it.to ? '#94A3B8' : '#475569'
              }
            }}
          >
            {Ic && <Ic size={16} />}
            <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
          </button>
        )
      })}
    </aside>
  )
}

export function AdminTopBar() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: '#0F172A', borderBottom: '1px solid rgba(255,255,255,0.08)',
      color: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 64, padding: '0 28px', gap: 24 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <div className="logo-mark" style={{ background: 'var(--color-accent)' }}>Q</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Qoldau <span style={{ color: 'var(--color-accent)' }}>AI</span></div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Admin Console</div>
          </div>
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 320 }}>
            <I.Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input placeholder="Поиск по заявкам, пользователям…" style={{
              width: '100%', height: 34, paddingLeft: 36, paddingRight: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none',
            }} />
          </div>
          <button
            onClick={() => { logout(); navigate('/') }}
            style={{
              height: 34, padding: '0 12px', border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', color: '#CBD5E1', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <I.ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} />Выйти
          </button>
        </div>
      </div>
    </header>
  )
}
