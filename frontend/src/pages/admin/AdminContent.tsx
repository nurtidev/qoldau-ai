import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  contentApi,
  type AnalyticsMaterial,
  type MapProjectItem,
  type MaterialInput,
  type MapProjectInput,
} from '@/api/client'
import { useToast } from '@/components/Toast'
import { I } from '@/components/icons'

const REGIONS = [
  'Акмолинская', 'Алматинская', 'Атырауская', 'ВКО', 'Жамбылская', 'ЗКО',
  'Карагандинская', 'Костанайская', 'Кызылординская', 'Мангистауская',
  'Павлодарская', 'СКО', 'Туркестанская', 'Абай', 'Жетісу', 'Улытау',
  'Астана', 'Алматы', 'Шымкент',
]

const MATERIAL_TYPES = ['Интерактивный отчёт', 'Финансовая отчётность', 'Исследование', 'Дашборд', 'Годовой отчёт']
const FORMATS: { value: string; label: string }[] = [
  { value: 'web', label: 'Ссылка (Web)' },
  { value: 'pdf', label: 'Ссылка (PDF)' },
  { value: 'embed', label: 'Встраивание (embed)' },
]

function apiErr(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback
}

export function AdminContent() {
  const [tab, setTab] = useState<'materials' | 'projects'>('materials')

  return (
    <div className="page-fade" style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Контент порталов</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6 }}>
          Управление публичными разделами «Аналитика дочек» и «Карта проектов» без правки кода.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
        {([
          { id: 'materials', label: 'Аналитика дочек' },
          { id: 'projects', label: 'Карта проектов' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === t.id ? 600 : 500,
              color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-2)',
              borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'materials' ? <MaterialsTab /> : <ProjectsTab />}
    </div>
  )
}

// ─── Materials ────────────────────────────────────────────────────────────────

const emptyMaterial: MaterialInput = {
  title: '', description: '', org: '', material_type: '', period: '',
  source: '', url: '', format: 'web', updated_date: '', sort_order: 0,
}

function MaterialsTab() {
  const { push } = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<{ id?: string; data: MaterialInput } | null>(null)

  const { data: items = [], isLoading } = useQuery<AnalyticsMaterial[]>({
    queryKey: ['materials'],
    queryFn: () => contentApi.materials().then((r) => r.data ?? []),
  })

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: MaterialInput }) =>
      id ? contentApi.updateMaterial(id, data) : contentApi.createMaterial(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] })
      push('Материал сохранён', 'success')
      setEditing(null)
    },
    onError: (e) => push(apiErr(e, 'Не удалось сохранить материал'), 'error'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => contentApi.deleteMaterial(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] })
      push('Материал удалён', 'success')
    },
    onError: (e) => push(apiErr(e, 'Не удалось удалить материал'), 'error'),
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Всего: {items.length}</div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ data: { ...emptyMaterial } })}>
          <I.Plus size={14} /> Добавить материал
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {['#', 'Название', 'Организация', 'Тип', 'Период', 'Формат', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Загрузка…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Материалов пока нет</td></tr>
              ) : items.map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>{m.sort_order}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, maxWidth: 320 }}>{m.title}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)' }}>{m.org ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)' }}>{m.material_type ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{m.period ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}><span className="badge badge-gray">{m.format}</span></td>
                  <td style={{ padding: '12px 16px' }}>
                    <RowActions
                      onEdit={() => setEditing({
                        id: m.id,
                        data: {
                          title: m.title, description: m.description ?? '', org: m.org ?? '',
                          material_type: m.material_type ?? '', period: m.period ?? '',
                          source: m.source ?? '', url: m.url ?? '', format: m.format,
                          updated_date: m.updated_date ?? '', sort_order: m.sort_order,
                        },
                      })}
                      onDelete={() => { if (window.confirm(`Удалить материал «${m.title}»?`)) delMut.mutate(m.id) }}
                      disabled={delMut.isPending}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <MaterialModal
          value={editing.data}
          isEdit={!!editing.id}
          saving={saveMut.isPending}
          onClose={() => setEditing(null)}
          onSave={(data) => saveMut.mutate({ id: editing.id, data })}
        />
      )}
    </>
  )
}

function MaterialModal({ value, isEdit, saving, onClose, onSave }: {
  value: MaterialInput
  isEdit: boolean
  saving: boolean
  onClose: () => void
  onSave: (data: MaterialInput) => void
}) {
  const [f, setF] = useState<MaterialInput>(value)
  const set = <K extends keyof MaterialInput>(k: K, v: MaterialInput[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.title.trim()) return
    onSave({ ...f, title: f.title.trim() })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Редактировать материал' : 'Новый материал'}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }}><I.X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          <Field label="Название *">
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Field label="Описание">
            <textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} />
          </Field>
          <Row>
            <Field label="Организация">
              <input className="input" value={f.org} onChange={(e) => set('org', e.target.value)} placeholder="Даму" />
            </Field>
            <Field label="Тип">
              <input className="input" list="material-types" value={f.material_type} onChange={(e) => set('material_type', e.target.value)} placeholder="Исследование" />
              <datalist id="material-types">
                {MATERIAL_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </Field>
          </Row>
          <Row>
            <Field label="Период">
              <input className="input" value={f.period} onChange={(e) => set('period', e.target.value)} placeholder="2025 / Q1 2026" />
            </Field>
            <Field label="Источник">
              <input className="input" value={f.source} onChange={(e) => set('source', e.target.value)} placeholder="damu.kz" />
            </Field>
          </Row>
          <Row>
            <Field label="Формат">
              <select className="select" value={f.format} onChange={(e) => set('format', e.target.value)}>
                {FORMATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Дата обновления">
              <input className="input" value={f.updated_date} onChange={(e) => set('updated_date', e.target.value)} placeholder="12.03.2026" />
            </Field>
          </Row>
          <Row>
            <Field label="Ссылка / embed URL">
              <input className="input" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Порядок">
              <input className="input" type="number" value={f.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} />
            </Field>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Projects ─────────────────────────────────────────────────────────────────

const emptyProject: MapProjectInput = {
  name: '', org: '', region: '', city: '', industry: '', status: '',
  amount: 0, period: '', description: '', lat: null, lng: null, sort_order: 0,
}

function ProjectsTab() {
  const { push } = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<{ id?: string; data: MapProjectInput } | null>(null)

  const { data: items = [], isLoading } = useQuery<MapProjectItem[]>({
    queryKey: ['map-projects'],
    queryFn: () => contentApi.mapProjects().then((r) => r.data ?? []),
  })

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: MapProjectInput }) =>
      id ? contentApi.updateProject(id, data) : contentApi.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map-projects'] })
      push('Проект сохранён', 'success')
      setEditing(null)
    },
    onError: (e) => push(apiErr(e, 'Не удалось сохранить проект'), 'error'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => contentApi.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map-projects'] })
      push('Проект удалён', 'success')
    },
    onError: (e) => push(apiErr(e, 'Не удалось удалить проект'), 'error'),
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Всего: {items.length}</div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ data: { ...emptyProject } })}>
          <I.Plus size={14} /> Добавить проект
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {['#', 'Проект', 'Организация', 'Регион', 'Отрасль', 'Сумма, млн ₸', 'Статус', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Загрузка…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Проектов пока нет</td></tr>
              ) : items.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>{p.sort_order}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, maxWidth: 300 }}>{p.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)' }}>{p.org ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{p.region ?? '—'}{p.city ? `, ${p.city}` : ''}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)' }}>{p.industry ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{p.amount.toLocaleString('ru-RU')}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{p.status ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <RowActions
                      onEdit={() => setEditing({
                        id: p.id,
                        data: {
                          name: p.name, org: p.org ?? '', region: p.region ?? '', city: p.city ?? '',
                          industry: p.industry ?? '', status: p.status ?? '', amount: p.amount,
                          period: p.period ?? '', description: p.description ?? '',
                          lat: p.lat ?? null, lng: p.lng ?? null, sort_order: p.sort_order,
                        },
                      })}
                      onDelete={() => { if (window.confirm(`Удалить проект «${p.name}»?`)) delMut.mutate(p.id) }}
                      disabled={delMut.isPending}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ProjectModal
          value={editing.data}
          isEdit={!!editing.id}
          saving={saveMut.isPending}
          onClose={() => setEditing(null)}
          onSave={(data) => saveMut.mutate({ id: editing.id, data })}
        />
      )}
    </>
  )
}

function ProjectModal({ value, isEdit, saving, onClose, onSave }: {
  value: MapProjectInput
  isEdit: boolean
  saving: boolean
  onClose: () => void
  onSave: (data: MapProjectInput) => void
}) {
  const [f, setF] = useState<MapProjectInput>(value)
  const set = <K extends keyof MapProjectInput>(k: K, v: MapProjectInput[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    onSave({ ...f, name: f.name.trim() })
  }

  const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: '100%' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Редактировать проект' : 'Новый проект'}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }}><I.X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          <Field label="Название проекта *">
            <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Описание">
            <textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} />
          </Field>
          <Row>
            <Field label="Организация">
              <input className="input" value={f.org} onChange={(e) => set('org', e.target.value)} placeholder="Даму" />
            </Field>
            <Field label="Отрасль">
              <input className="input" value={f.industry} onChange={(e) => set('industry', e.target.value)} placeholder="АПК" />
            </Field>
          </Row>
          <Row>
            <Field label="Регион">
              <select className="select" value={f.region} onChange={(e) => set('region', e.target.value)}>
                <option value="">— выберите —</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Город">
              <input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Кокшетау" />
            </Field>
          </Row>
          <Row>
            <Field label="Сумма, млн ₸">
              <input className="input" type="number" value={f.amount ?? 0} onChange={(e) => set('amount', Number(e.target.value))} />
            </Field>
            <Field label="Период">
              <input className="input" value={f.period} onChange={(e) => set('period', e.target.value)} placeholder="2024–2026" />
            </Field>
          </Row>
          <Row>
            <Field label="Статус">
              <input className="input" list="project-statuses" value={f.status} onChange={(e) => set('status', e.target.value)} placeholder="Реализуется" />
              <datalist id="project-statuses">
                <option value="Реализуется" /><option value="Завершён" /><option value="Инвестфаза" />
              </datalist>
            </Field>
            <Field label="Порядок">
              <input className="input" type="number" value={f.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} />
            </Field>
          </Row>
          <Row>
            <Field label="Широта (lat)" hint="пусто — по центру региона">
              <input className="input" type="number" step="any" value={f.lat ?? ''} onChange={(e) => set('lat', numOrNull(e.target.value))} />
            </Field>
            <Field label="Долгота (lng)" hint="пусто — по центру региона">
              <input className="input" type="number" step="any" value={f.lng ?? ''} onChange={(e) => set('lng', numOrNull(e.target.value))} />
            </Field>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function RowActions({ onEdit, onDelete, disabled }: { onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>Изменить</button>
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        title="Удалить"
        style={{
          display: 'inline-flex', alignItems: 'center', padding: 6,
          border: '1px solid var(--color-border)', borderRadius: 4,
          background: 'var(--color-surface)', color: 'var(--color-danger)', cursor: 'pointer',
        }}
      >
        <I.Trash size={14} />
      </button>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label className="field-label" style={{ display: 'block', marginBottom: 4 }}>
        {label}
        {hint && <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--color-text-3)', fontSize: 11 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div>
}
