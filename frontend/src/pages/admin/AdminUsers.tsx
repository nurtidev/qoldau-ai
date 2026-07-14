import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { usersApi, type UserListItem, type UsersListResponse } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/components/Toast'
import { I } from '@/components/icons'

const PAGE_SIZE = 50

const ROLE_FILTERS: { id: string; label: string }[] = [
  { id: '',       label: 'Все роли' },
  { id: 'user',   label: 'Заявители' },
  { id: 'author', label: 'Методологи' },
  { id: 'admin',  label: 'Администраторы' },
]

const ROLE_OPTIONS: { value: 'user' | 'author' | 'admin'; label: string }[] = [
  { value: 'user',   label: 'Заявитель' },
  { value: 'author', label: 'Методолог' },
  { value: 'admin',  label: 'Администратор' },
]

function RoleBadge({ role }: { role: UserListItem['role'] }) {
  if (role === 'admin') {
    return <span className="badge badge-green">Администратор</span>
  }
  if (role === 'author') {
    return (
      <span className="badge" style={{
        background: 'var(--color-accent-soft)',
        color: 'var(--color-accent-text)',
      }}>Методолог</span>
    )
  }
  return <span className="badge badge-gray">Заявитель</span>
}

export function AdminUsers() {
  const { user: me } = useAuthStore()
  const { push } = useToast()
  const qc = useQueryClient()

  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(0)

  const { data, isLoading, isFetching } = useQuery<UsersListResponse>({
    queryKey: ['admin-users', { search, role, page }],
    queryFn: () =>
      usersApi
        .list({
          q: search || undefined,
          role: role || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        })
        .then((r) => r.data ?? { items: [], total: 0 }),
    placeholderData: keepPreviousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)

  const setRoleMut = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: 'user' | 'author' | 'admin' }) =>
      usersApi.setRole(id, nextRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      push('Роль обновлена', 'success')
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Не удалось изменить роль'
      push(msg, 'error')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      push('Пользователь удалён', 'success')
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Не удалось удалить пользователя'
      push(msg, 'error')
    },
  })

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearch(q.trim())
  }

  return (
    <div className="page-fade admin-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          Пользователи{' '}
          <span style={{ fontSize: 14, color: 'var(--color-text-3)', fontWeight: 500 }}>· {total}</span>
        </h1>
      </div>

      {/* Search + role filter */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <form onSubmit={submitSearch} style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
          <I.Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)' }} />
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по ФИО, ИИН или организации…"
            style={{ paddingLeft: 36, width: '100%' }}
          />
        </form>
        <select
          className="select"
          value={role}
          onChange={(e) => { setPage(0); setRole(e.target.value) }}
          style={{ width: 200, flexShrink: 0 }}
        >
          {ROLE_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {['ФИО', 'ИИН', 'Организация', 'Роль', 'Заявок', 'Регистрация', 'Изменить роль'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Загрузка…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Пользователи не найдены</td></tr>
              ) : items.map((u) => {
                const isSelf = me?.id === u.id
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>
                      {u.full_name}
                      {isSelf && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-3)', fontWeight: 400 }}>(вы)</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{u.iin}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)' }}>{u.org_name ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)' }}>{u.applications_count}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                      {new Date(u.created_at).toLocaleDateString('ru-KZ')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          value={u.role}
                          disabled={isSelf || setRoleMut.isPending}
                          onChange={(e) => setRoleMut.mutate({ id: u.id, nextRole: e.target.value as 'user' | 'author' | 'admin' })}
                          title={isSelf ? 'Нельзя менять собственную роль' : undefined}
                          style={{
                            fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)',
                            borderRadius: 4, background: 'var(--color-surface)',
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSelf ? 0.5 : 1,
                          }}
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isSelf || deleteMut.isPending}
                          onClick={() => {
                            if (window.confirm(`Удалить пользователя «${u.full_name}» (ИИН ${u.iin}) и все его заявки? Действие необратимо.`))
                              deleteMut.mutate(u.id)
                          }}
                          title={isSelf ? 'Нельзя удалить свой аккаунт' : 'Удалить пользователя'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', padding: 5,
                            border: '1px solid var(--color-border)', borderRadius: 4,
                            background: 'var(--color-surface)',
                            color: isSelf ? 'var(--color-text-4)' : 'var(--color-danger)',
                            cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.5 : 1,
                          }}
                        >
                          <I.Trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
          {total > 0 ? <>Показано {from}–{to} из {total}{isFetching ? ' · обновление…' : ''}</> : '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <I.ChevronLeft size={14} /> Назад
          </button>
          <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{page + 1} / {pages}</span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд <I.ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
