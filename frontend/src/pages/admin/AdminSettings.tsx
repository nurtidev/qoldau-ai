import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { I } from '@/components/icons'
import type { UserRole } from '@/types'

/* ===== Персист: клиентские настройки ============================
   Ниже — единственные два места в приложении, где реально хранится
   состояние этой страницы. Оба живут в localStorage браузера:
   - qoldau_notification_prefs: предпочтения по e-mail-уведомлениям.
     На бэкенде нет отправки почты (проверено — только in-app
     уведомления через /api/notifications), поэтому это ПОДГОТОВКА
     интерфейса, честно помечено ниже.
   - qoldau_table_density: реально переключает плотность списков
     (таблицы «Заявки», «Пользователи», «Мои заявки» в кабинете) —
     см. applyDensity(), которая ставит атрибут на <html> и один раз
     подмешивает CSS-правило в <head>. */

const NOTIF_KEY = 'qoldau_notification_prefs'
const DENSITY_KEY = 'qoldau_table_density'
const DENSITY_STYLE_ID = 'qoldau-density-style'

interface NotificationPrefs {
  newApplications: boolean
  slaOverdue: boolean
  weeklyDigest: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  newApplications: true,
  slaOverdue: true,
  weeklyDigest: false,
}

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs))
}

type Density = 'comfortable' | 'compact'

function loadDensity(): Density {
  return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
}

/** Подмешивает CSS-правило один раз за сессию: сжимает отступы во
 *  всех обычных <table> портала, когда на <html> стоит
 *  data-density="compact". Работает глобально, т.к. и <head>, и
 *  <html> — общие узлы DOM для всего SPA. */
function ensureDensityStyleTag() {
  if (document.getElementById(DENSITY_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = DENSITY_STYLE_ID
  style.textContent = `
html[data-density="compact"] table td,
html[data-density="compact"] table th {
  padding: 6px 12px !important;
}
`
  document.head.appendChild(style)
}

function applyDensity(d: Density) {
  ensureDensityStyleTag()
  document.documentElement.setAttribute('data-density', d)
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--color-primary)' : 'var(--color-border-strong)',
        position: 'relative', flexShrink: 0, padding: 0, transition: 'background 150ms',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 19 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 150ms', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }} />
    </button>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'admin') {
    return <span className="badge badge-green">Администратор</span>
  }
  if (role === 'author') {
    return (
      <span className="badge" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-text)' }}>
        Методолог
      </span>
    )
  }
  return <span className="badge badge-gray">Заявитель</span>
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function SectionCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subtitle ? 4 : 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>{title}</h2>
      </div>
      {subtitle && (
        <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: '0 0 16px', lineHeight: 1.5 }}>{subtitle}</p>
      )}
      {children}
    </section>
  )
}

function PrefRow({ title, description, checked, onChange, last }: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  last?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
      padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--color-border)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.4 }}>{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{label}</span>
      <span style={{
        fontSize: 13, color: 'var(--color-text)', fontWeight: 500, textAlign: 'right',
        fontFamily: mono ? 'ui-monospace, monospace' : undefined,
      }}>{value}</span>
    </div>
  )
}

export function AdminSettings() {
  const user = useAuthStore((s) => s.user)

  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs)
  const [density, setDensity] = useState<Density>(loadDensity)

  // Применить сохранённую плотность при заходе на страницу (и убедиться,
  // что глобальный <style> с правилом compact-режима подмешан в <head>).
  useEffect(() => {
    applyDensity(density)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setPref = (key: keyof NotificationPrefs) => (value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      savePrefs(next)
      return next
    })
  }

  const setDensityAndPersist = (d: Density) => {
    setDensity(d)
    localStorage.setItem(DENSITY_KEY, d)
    applyDensity(d)
  }

  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString('ru-KZ') : '—'

  return (
    <div className="page-fade" style={{ padding: '32px 40px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>Настройки</h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-3)', margin: '0 0 24px' }}>
        Профиль аккаунта, уведомления и параметры отображения админ-панели.
      </p>

      {/* 1. Профиль */}
      <SectionCard icon={<I.User size={16} />} title="Профиль">
        {user ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'var(--color-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700,
              }}>
                {initials(user.full_name)}
              </div>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{user.full_name}</span>
                  <RoleBadge role={user.role} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 2 }}>
                  {user.org_name || 'Организация не указана'}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 4 }}>
              <InfoRow label="ИИН" value={user.iin} mono />
              <InfoRow label="Организация" value={user.org_name || '—'} />
              <InfoRow label="Роль" value={user.role === 'admin' ? 'Администратор' : user.role === 'author' ? 'Методолог' : 'Заявитель'} />
              <InfoRow label="Дата регистрации" value={joined} />
            </div>

            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14,
              padding: '10px 12px', borderRadius: 8, background: 'var(--color-surface-2)',
              fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.5,
            }}>
              <I.Lock size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-text-3)' }} />
              <span>Данные получены из eGov при входе и привязаны к сессии — изменить их в этом кабинете нельзя.</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Не удалось загрузить данные пользователя.</div>
        )}
      </SectionCard>

      {/* 2. Уведомления */}
      <SectionCard
        icon={<I.Bell size={16} />}
        title="Уведомления"
        subtitle="Клиентские предпочтения — сохраняются в этом браузере (localStorage) и не привязаны к аккаунту."
      >
        <PrefRow
          title="Новые заявки"
          description="Письмо при поступлении новой заявки на рассмотрение."
          checked={prefs.newApplications}
          onChange={setPref('newApplications')}
        />
        <PrefRow
          title="Просрочка SLA"
          description="Письмо, если заявка превышает срок рассмотрения по SLA."
          checked={prefs.slaOverdue}
          onChange={setPref('slaOverdue')}
        />
        <PrefRow
          title="Еженедельный дайджест"
          description="Сводка по заявкам и услугам раз в неделю."
          checked={prefs.weeklyDigest}
          onChange={setPref('weeklyDigest')}
          last
        />
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14,
          padding: '10px 12px', borderRadius: 8, background: 'var(--color-info-soft)',
          fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5,
        }}>
          <I.Info size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-info)' }} />
          <span>Отправка e-mail пока не подключена на бэкенде — переключатели сохраняют ваш выбор и готовят интерфейс к этой функции.</span>
        </div>
      </SectionCard>

      {/* 3. Оформление */}
      <SectionCard
        icon={<I.Sliders size={16} />}
        title="Оформление"
        subtitle="Плотность таблиц в списках — «Заявки», «Пользователи» и «Мои заявки» в личном кабинете."
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['comfortable', 'compact'] as Density[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDensityAndPersist(d)}
              className={density === d ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              style={{ flex: '0 0 auto' }}
            >
              {d === 'comfortable' ? 'Свободно' : 'Компактно'}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8 }}>Пример:</div>
        <div className="card" style={{ padding: 0, overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 320, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Заявка</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>№ 2026-0143</td>
                <td style={{ padding: '12px 16px' }}><span className="badge badge-green">Одобрено</span></td>
              </tr>
              <tr>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>№ 2026-0144</td>
                <td style={{ padding: '12px 16px' }}><span className="badge badge-amber">На проверке</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 4. О системе */}
      <SectionCard icon={<I.Info size={16} />} title="О системе">
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
          Qoldau AI — единое окно поддержки бизнеса
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 14 }}>
          Версия 0.1.0 · MVP
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
          Услуги поддержки бизнеса собираются администраторами через no-code конструктор форм
          (без правки кода), а не хардкодятся. ИИ помогает предзаполнить структуру формы по
          описанию услуги, заявитель проходит форму пошагово, заявка — двухэтапную проверку.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/services" className="btn btn-secondary btn-sm">
            <I.ExternalLink size={14} style={{ marginRight: 6 }} />
            Публичный каталог услуг
          </Link>
          <a href="mailto:support@qoldau.kz" className="btn btn-ghost btn-sm">
            support@qoldau.kz
          </a>
        </div>
      </SectionCard>
    </div>
  )
}
