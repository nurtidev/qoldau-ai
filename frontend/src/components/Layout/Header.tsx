import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/client'
import { I } from '@/components/icons'
import { LoginModal } from '@/components/LoginModal'
import { useIsMobile, useIsBelowLaptop } from '@/hooks/useMediaQuery'
import type { Notification } from '@/types'

const LINKS = [
  { id: 'services',  label: 'Услуги',       to: '/services' },
  { id: 'knowledge', label: 'База знаний',  to: '/knowledge' },
  { id: 'map',       label: 'Карта',        to: '/projects-map' },
  { id: 'analytics', label: 'Аналитика',    to: '/analytics' },
  { id: 'news',      label: 'Новости',      to: '/news' },
  { id: 'contacts',  label: 'Контакты',     to: '/contacts' },
]

export function Logo({ size = 40, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img src="/img/baiterek.png" alt="Байтерек" style={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }} />
      {withText && (
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>
            Qoldau <span style={{ color: 'var(--color-accent-text)' }}>AI</span>
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
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  const isBelowLaptop = useIsBelowLaptop()
  // Гость сворачивается на ≤768; авторизованный (доп. элементы) — уже на ≤1024.
  const collapse = user ? isBelowLaptop : isMobile
  const isAdminUser = user?.role === 'admin' || user?.role === 'author'

  const current = location.pathname.startsWith('/services') ? 'services'
    : location.pathname.startsWith('/knowledge') ? 'knowledge'
    : location.pathname.startsWith('/projects-map') ? 'map'
    : location.pathname.startsWith('/analytics') ? 'analytics'
    : location.pathname.startsWith('/news') ? 'news'
    : location.pathname.startsWith('/contacts') ? 'contacts'
    : ''

  const { data: notifs = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  })
  const unread = notifs.filter((n) => !n.is_read).length

  // Закрывать drawer при переходе по маршруту
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Esc + блокировка скролла body, пока drawer открыт
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const langSwitcher = (
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
  )

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'saturate(140%) blur(8px)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64, gap: collapse ? 12 : 32 }}>
          <Link to="/"><Logo /></Link>

          {!collapse && (
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
          )}

          {!collapse ? (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {langSwitcher}

              {/* Телефон поддержки — скрываем у авторизованного, чтобы шапка не переполнялась */}
              {!user && (
                <button className="btn btn-ghost btn-sm">
                  <I.Phone size={16} /><span>1414</span>
                </button>
              )}

              {user ? (
                <>
                  <NotificationsBell notifications={notifs} unread={unread} />
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
                  {isAdminUser ? (
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
          ) : (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Открыть меню"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                className="btn btn-ghost btn-sm"
                style={{ width: 40, height: 40, padding: 0, position: 'relative' }}
              >
                <I.List size={22} />
                {user && unread > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    minWidth: 8, height: 8, borderRadius: 999,
                    background: 'var(--color-danger)', border: '2px solid #fff',
                  }} />
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Мобильный drawer (справа) */}
      {collapse && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
              zIndex: 60, opacity: menuOpen ? 1 : 0,
              pointerEvents: menuOpen ? 'auto' : 'none',
              transition: 'opacity 200ms ease',
            }}
          />
          <div
            role="dialog" aria-modal="true" aria-label="Главное меню"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 'min(320px, 86vw)', background: '#fff', zIndex: 61,
              boxShadow: 'var(--sh-lg)', display: 'flex', flexDirection: 'column',
              transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 220ms ease', overflowY: 'auto',
            }}
          >
            {/* header панели */}
            <div style={{ display: 'flex', alignItems: 'center', height: 64, padding: '0 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <Logo size={34} />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Закрыть меню"
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 'auto', width: 40, height: 40, padding: 0 }}
              >
                <I.X size={20} />
              </button>
            </div>

            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'var(--color-primary)', color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    {user.role === 'admin' ? 'Администратор' : user.role === 'author' ? 'Автор' : 'Пользователь'}
                  </div>
                </div>
              </div>
            )}

            <nav style={{ display: 'flex', flexDirection: 'column', padding: 8, gap: 2 }}>
              {user && (
                <Link
                  to="/cabinet?section=notifs"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px', fontSize: 15, fontWeight: 500, borderRadius: 8,
                    color: 'var(--color-text)',
                  }}
                >
                  <I.Bell size={18} />
                  <span style={{ flex: 1 }}>Уведомления</span>
                  {unread > 0 && (
                    <span style={{
                      minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999,
                      background: 'var(--color-danger)', color: '#fff',
                      fontSize: 11, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{unread > 9 ? '9+' : unread}</span>
                  )}
                </Link>
              )}
              {LINKS.map((l) => (
                <Link
                  key={l.id}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: '12px', fontSize: 15, fontWeight: 500, borderRadius: 8,
                    color: current === l.id ? 'var(--color-primary)' : 'var(--color-text)',
                    background: current === l.id ? 'var(--color-accent-soft)' : 'transparent',
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div style={{ marginTop: 'auto', padding: 16, borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                {langSwitcher}
                <a href="tel:1414" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
                  <I.Phone size={16} /><span>1414</span>
                </a>
              </div>
              {user ? (
                <>
                  <Link
                    to={isAdminUser ? '/admin' : '/cabinet'}
                    onClick={() => setMenuOpen(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    {isAdminUser ? 'Админ-панель' : 'Личный кабинет'}
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setMenuOpen(false); logout(); navigate('/') }}>
                    Выйти
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => { setMenuOpen(false); setShowLogin(true) }}>
                  <I.User size={16} /> Войти
                </button>
              )}
            </div>
          </div>
        </>
      )}

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

// ─── NotificationsBell ────────────────────────────────────────────────────────

function NotificationsBell({ notifications, unread }: {
  notifications: Notification[]
  unread: number
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Закрытие по клику снаружи + Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const recent = notifications.slice(0, 7)

  const markOne = async (id: string) => {
    try { await notificationsApi.markRead(id) }
    catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }
  const markAll = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    try { await Promise.all(unreadIds.map(id => notificationsApi.markRead(id))) }
    catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  const openAll = () => {
    setOpen(false)
    navigate('/cabinet?section=notifs')
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : 'Уведомления'}
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          position: 'relative', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 6,
          background: open ? 'var(--color-surface-2)' : 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--color-text-2)',
          transition: 'background 120ms',
        }}
      >
        <I.Bell size={18} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 999, background: 'var(--color-danger)',
            border: '2px solid #fff', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Уведомления"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 360, maxHeight: 'min(70vh, 540px)',
            background: '#fff', border: '1px solid var(--color-border)',
            borderRadius: 12, boxShadow: 'var(--sh-lg)',
            display: 'flex', flexDirection: 'column',
            zIndex: 60,
            animation: 'pageFade 140ms ease both',
          }}
        >
          {/* header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Уведомления</div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  color: 'var(--color-accent-text)', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Прочитать все
              </button>
            )}
          </div>

          {/* list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {recent.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--color-surface-2)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-text-3)', marginBottom: 10,
                }}>
                  <I.Bell size={18} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                  Уведомлений пока нет
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.5 }}>
                  Здесь будут обновления по вашим заявкам
                </div>
              </div>
            ) : (
              recent.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { if (!n.is_read) markOne(n.id) }}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '12px 16px', border: 'none',
                    background: n.is_read ? '#fff' : 'rgba(7,102,61,0.04)',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    cursor: n.is_read ? 'default' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!n.is_read) (e.currentTarget.style.background = 'rgba(7,102,61,0.07)') }}
                  onMouseLeave={e => { (e.currentTarget.style.background = n.is_read ? '#fff' : 'rgba(7,102,61,0.04)') }}
                >
                  <I.Info size={16} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: n.is_read ? 400 : 600,
                      color: 'var(--color-text)', lineHeight: 1.4,
                    }}>
                      {n.title}
                    </div>
                    {n.message && (
                      <div style={{
                        fontSize: 12, color: 'var(--color-text-3)',
                        marginTop: 2, lineHeight: 1.5,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                      }}>
                        {n.message}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleDateString('ru-KZ', { day: 'numeric', month: 'short' })}
                      {' · '}
                      {new Date(n.created_at).toLocaleTimeString('ru-KZ', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.is_read && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--color-accent)', flexShrink: 0, marginTop: 6,
                    }} />
                  )}
                </button>
              ))
            )}
          </div>

          {/* footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}>
            <button
              type="button"
              onClick={openAll}
              style={{
                width: '100%', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'transparent', border: 'none', padding: '6px 0',
                color: 'var(--color-primary)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Все уведомления <I.ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// adminOnly items are hidden from the "author" (методолог) role — author only
// builds services, it has no access to applications/users/analytics per backend gates.
const ADMIN_NAV = [
  { id: 'dash',     label: 'Дашборд',      icon: 'Grid',      to: '/admin',              adminOnly: false },
  { id: 'apps',     label: 'Заявки',       icon: 'Document',  to: '/admin/applications', adminOnly: true },
  { id: 'services', label: 'Услуги',       icon: 'Briefcase', to: '/admin/services',     adminOnly: false },
  { id: 'content',  label: 'Контент',      icon: 'Sparkle',   to: '/admin/content',      adminOnly: false },
  { id: 'users',    label: 'Пользователи', icon: 'User',      to: '/admin/users',        adminOnly: true },
  { id: 'analytics',label: 'Аналитика',    icon: 'Hash',      to: '/admin/analytics',    adminOnly: true },
  { id: 'settings', label: 'Настройки',    icon: 'Sliders',   to: '/admin/settings',     adminOnly: false },
]

export function AdminSidebar({ offCanvas = false, open = false, onClose }: {
  offCanvas?: boolean
  open?: boolean
  onClose?: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const nav = ADMIN_NAV.filter((it) => isAdmin || !it.adminOnly)

  const active = location.pathname.startsWith('/admin/applications') ? 'apps'
    : location.pathname.startsWith('/admin/services') ? 'services'
    : location.pathname.startsWith('/admin/content') ? 'content'
    : location.pathname.startsWith('/admin/users') ? 'users'
    : location.pathname.startsWith('/admin/analytics') ? 'analytics'
    : location.pathname.startsWith('/admin/settings') ? 'settings'
    : 'dash'

  const go = (to: string | null) => {
    if (!to) return
    navigate(to)
    onClose?.()
  }

  const inner = (
    <>
      <div style={{
        padding: '8px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ fontSize: 11, color: '#8FA79A', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flex: 1 }}>Админ-панель</div>
        {offCanvas && (
          <button
            type="button" onClick={onClose} aria-label="Закрыть меню"
            style={{ background: 'transparent', border: 'none', color: '#A7BBAF', cursor: 'pointer', display: 'inline-flex', padding: 2 }}
          >
            <I.X size={18} />
          </button>
        )}
      </div>
      {nav.map((it) => {
        const Ic = I[it.icon as keyof typeof I]
        const isActive = active === it.id
        return (
          <button
            key={it.id}
            onClick={() => go(it.to)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', border: 'none', cursor: it.to ? 'pointer' : 'not-allowed',
              background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: isActive ? '#fff' : it.to ? '#A7BBAF' : '#5E7468',
              borderRadius: 6, fontSize: 13, fontWeight: isActive ? 600 : 500,
              transition: 'all 120ms', opacity: it.to ? 1 : 0.5,
              borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
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
                el.style.color = it.to ? '#A7BBAF' : '#5E7468'
              }
            }}
          >
            {Ic && <Ic size={16} />}
            <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
          </button>
        )
      })}
    </>
  )

  const baseStyle: React.CSSProperties = {
    width: 240, background: '#073822', color: '#C2D3C9',
    padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 2,
  }

  // Off-canvas режим (≤1024): фикс-панель + бэкдроп, не резервирует место в потоке
  if (offCanvas) {
    return (
      <>
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            zIndex: 60, opacity: open ? 1 : 0,
            pointerEvents: open ? 'auto' : 'none',
            transition: 'opacity 200ms ease',
          }}
        />
        <aside style={{
          ...baseStyle,
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 61,
          overflowY: 'auto', boxShadow: 'var(--sh-lg)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 220ms ease',
        }}>
          {inner}
        </aside>
      </>
    )
  }

  // Десктоп (>1024): фикс-сайдбар в потоке
  return (
    <aside style={{
      ...baseStyle,
      flexShrink: 0,
      minHeight: 'calc(100vh - 64px)', position: 'sticky', top: 64,
    }}>
      {inner}
    </aside>
  )
}

export function AdminTopBar({ onMenuClick, showMenuButton = false }: {
  onMenuClick?: () => void
  showMenuButton?: boolean
}) {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: '#073822', borderBottom: '1px solid rgba(255,255,255,0.08)',
      color: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 64, padding: isMobile ? '0 14px' : '0 28px', gap: isMobile ? 12 : 24 }}>
        {showMenuButton && (
          <button
            type="button" onClick={onMenuClick}
            aria-label="Открыть меню" aria-haspopup="dialog"
            style={{
              width: 40, height: 40, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, color: '#C2D3C9', cursor: 'pointer',
            }}
          >
            <I.List size={20} />
          </button>
        )}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/img/baiterek.png" alt="Байтерек" style={{ height: 28, width: 'auto', display: 'block' }} />
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Qoldau <span style={{ color: 'var(--color-accent)' }}>AI</span></div>
            <div style={{ fontSize: 11, color: '#8FA79A' }}>Admin Console</div>
          </div>
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isMobile && (
            <div style={{ position: 'relative', width: 320 }}>
              <I.Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8FA79A' }} />
              <input placeholder="Поиск по заявкам, пользователям…" style={{
                width: '100%', height: 34, paddingLeft: 36, paddingRight: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none',
              }} />
            </div>
          )}
          <button
            onClick={() => { logout(); navigate('/') }}
            style={{
              height: 34, padding: '0 12px', border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', color: '#C2D3C9', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <I.ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} />Выйти
          </button>
        </div>
      </div>
    </header>
  )
}
