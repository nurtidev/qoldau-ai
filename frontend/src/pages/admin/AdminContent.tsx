import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  contentApi,
  faqApi,
  servicesApi,
  type AnalyticsMaterial,
  type MapProjectItem,
  type MaterialInput,
  type MapProjectInput,
  type NewsItem,
  type NewsInput,
  type KnowledgeArticle,
  type KnowledgeInput,
  type HoldingStat,
  type HoldingStatInput,
  type FaqItem,
  type FaqInput,
} from '@/api/client'
import type { Service } from '@/types'
import { useToast } from '@/components/Toast'
import { I } from '@/components/icons'
import { Portal } from '@/components/Portal'

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
  const [tab, setTab] = useState<'materials' | 'projects' | 'news' | 'knowledge' | 'holding' | 'faq'>('materials')

  return (
    <div className="page-fade" style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Контент порталов</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6 }}>
          Управление публичными разделами «Аналитика дочек», «Карта проектов», «Новости» и «О холдинге» без правки кода.
        </p>
      </div>

      {/* Tabs — горизонтальный скролл на узких экранах (ряд шире вьюпорта) */}
      <div style={{ position: 'relative', marginBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
        <div className="no-scrollbar" style={{
          display: 'flex', gap: 4, flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          WebkitMaskImage: 'linear-gradient(90deg, #000 calc(100% - 24px), transparent)',
          maskImage: 'linear-gradient(90deg, #000 calc(100% - 24px), transparent)',
        }}>
          {([
            { id: 'materials', label: 'Аналитика дочек' },
            { id: 'projects', label: 'Карта проектов' },
            { id: 'news', label: 'Новости' },
            { id: 'knowledge', label: 'База знаний' },
            { id: 'holding', label: 'О холдинге' },
            { id: 'faq', label: 'FAQ' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={(e) => { setTab(t.id); e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' }) }}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 14, fontWeight: tab === t.id ? 600 : 500, whiteSpace: 'nowrap', flexShrink: 0,
                color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-2)',
                borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Правый край-фейд — подсказка о прокрутке */}
        <div aria-hidden style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 28, pointerEvents: 'none',
          background: 'linear-gradient(to right, transparent, var(--color-bg))',
        }} />
      </div>

      {tab === 'materials' ? <MaterialsTab /> : tab === 'projects' ? <ProjectsTab /> : tab === 'news' ? <NewsTab /> : tab === 'knowledge' ? <KnowledgeTab /> : tab === 'holding' ? <HoldingTab /> : <FaqTab />}
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
    <Portal>
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
    </Portal>
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
    <Portal>
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
    </Portal>
  )
}

// ─── News ─────────────────────────────────────────────────────────────────────

const NEWS_RUBRICS = ['Программы', 'Новости', 'Истории успеха', 'СМИ о нас']

const emptyNews: NewsInput = {
  title: '', lead: '', body: '', rubric: 'Новости', source: '', source_url: '',
  image_url: '', published_at: '', is_featured: false, sort_order: 0,
}

// ISO datetime → 'YYYY-MM-DD' для <input type="date">.
const toDateInput = (iso?: string): string => (iso ? iso.slice(0, 10) : '')
const fmtDate = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function NewsTab() {
  const { push } = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<{ id?: string; data: NewsInput } | null>(null)

  const { data: items = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: () => contentApi.news().then((r) => r.data ?? []),
  })

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: NewsInput }) =>
      id ? contentApi.updateNews(id, data) : contentApi.createNews(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news'] })
      push('Новость сохранена', 'success')
      setEditing(null)
    },
    onError: (e) => push(apiErr(e, 'Не удалось сохранить новость'), 'error'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => contentApi.deleteNews(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news'] })
      push('Новость удалена', 'success')
    },
    onError: (e) => push(apiErr(e, 'Не удалось удалить новость'), 'error'),
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Всего: {items.length}</div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ data: { ...emptyNews } })}>
          <I.Plus size={14} /> Добавить новость
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {['#', 'Заголовок', 'Рубрика', 'Дата', 'Топ', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Загрузка…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Новостей пока нет</td></tr>
              ) : items.map((n) => (
                <tr key={n.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>{n.sort_order}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, maxWidth: 380 }}>{n.title}</td>
                  <td style={{ padding: '12px 16px' }}><span className="badge badge-gray">{n.rubric ?? '—'}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{fmtDate(n.published_at)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {n.is_featured
                      ? <I.Star size={15} style={{ color: 'var(--color-accent)' }} />
                      : <span style={{ color: 'var(--color-text-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <RowActions
                      onEdit={() => setEditing({
                        id: n.id,
                        data: {
                          title: n.title, lead: n.lead ?? '', body: n.body ?? '', rubric: n.rubric ?? 'Новости',
                          source: n.source ?? '', source_url: n.source_url ?? '', image_url: n.image_url ?? '',
                          published_at: toDateInput(n.published_at), is_featured: n.is_featured, sort_order: n.sort_order,
                        },
                      })}
                      onDelete={() => { if (window.confirm(`Удалить новость «${n.title}»?`)) delMut.mutate(n.id) }}
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
        <NewsModal
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

function NewsModal({ value, isEdit, saving, onClose, onSave }: {
  value: NewsInput
  isEdit: boolean
  saving: boolean
  onClose: () => void
  onSave: (data: NewsInput) => void
}) {
  const [f, setF] = useState<NewsInput>(value)
  const set = <K extends keyof NewsInput>(k: K, v: NewsInput[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.title.trim()) return
    onSave({ ...f, title: f.title.trim() })
  }

  return (
    <Portal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: '100%' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Редактировать новость' : 'Новая новость'}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }}><I.X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '72vh', overflowY: 'auto' }}>
          <Field label="Заголовок *">
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Row>
            <Field label="Рубрика">
              <select className="select" value={f.rubric} onChange={(e) => set('rubric', e.target.value)}>
                {NEWS_RUBRICS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Дата публикации">
              <input className="input" type="date" value={f.published_at} onChange={(e) => set('published_at', e.target.value)} />
            </Field>
          </Row>
          <Field label="Лид" hint="1–3 предложения — показывается в карточке">
            <textarea className="textarea" value={f.lead} onChange={(e) => set('lead', e.target.value)} rows={2} />
          </Field>
          <Field label="Текст" hint="markdown: ## подзаголовок, «- » список, **жирный**">
            <textarea className="textarea" value={f.body} onChange={(e) => set('body', e.target.value)} rows={9} />
          </Field>
          <Row>
            <Field label="Источник">
              <input className="input" value={f.source} onChange={(e) => set('source', e.target.value)} placeholder="Пресс-служба Байтерека" />
            </Field>
            <Field label="Ссылка на источник">
              <input className="input" value={f.source_url} onChange={(e) => set('source_url', e.target.value)} placeholder="https://…" />
            </Field>
          </Row>
          <Row>
            <Field label="Обложка (image URL)" hint="пусто — градиент по рубрике">
              <input className="input" value={f.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Порядок">
              <input className="input" type="number" value={f.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} />
            </Field>
          </Row>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!f.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
            Главный материал (featured)
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  )
}

// ─── Knowledge base ─────────────────────────────────────────────────────────────

const KNOWLEDGE_CATEGORIES = ['С чего начать', 'Подача заявки', 'Документы', 'ЭЦП и eGov', 'Финансирование']

const emptyKnowledge: KnowledgeInput = {
  slug: '', category: 'С чего начать', title: '', excerpt: '', body: '',
  read_minutes: null, published_at: '', sort_order: 0,
}

function KnowledgeTab() {
  const { push } = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<{ id?: string; data: KnowledgeInput } | null>(null)

  const { data: items = [], isLoading } = useQuery<KnowledgeArticle[]>({
    queryKey: ['knowledge'],
    queryFn: () => contentApi.knowledge().then((r) => r.data ?? []),
  })

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: KnowledgeInput }) =>
      id ? contentApi.updateKnowledge(id, data) : contentApi.createKnowledge(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge'] })
      push('Статья сохранена', 'success')
      setEditing(null)
    },
    onError: (e) => push(apiErr(e, 'Не удалось сохранить статью'), 'error'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => contentApi.deleteKnowledge(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge'] })
      push('Статья удалена', 'success')
    },
    onError: (e) => push(apiErr(e, 'Не удалось удалить статью'), 'error'),
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Всего: {items.length}</div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ data: { ...emptyKnowledge } })}>
          <I.Plus size={14} /> Добавить статью
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {['#', 'Заголовок', 'Категория', 'Мин', 'Дата', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Загрузка…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Статей пока нет</td></tr>
              ) : items.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>{a.sort_order}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, maxWidth: 360 }}>{a.title}</td>
                  <td style={{ padding: '12px 16px' }}><span className="badge badge-gray">{a.category}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{a.read_minutes ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{fmtDate(a.published_at)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <RowActions
                      onEdit={() => setEditing({
                        id: a.id,
                        data: {
                          slug: a.slug, category: a.category, title: a.title, excerpt: a.excerpt ?? '',
                          body: a.body, read_minutes: a.read_minutes ?? null,
                          published_at: toDateInput(a.published_at), sort_order: a.sort_order,
                        },
                      })}
                      onDelete={() => { if (window.confirm(`Удалить статью «${a.title}»?`)) delMut.mutate(a.id) }}
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
        <KnowledgeModal
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

function KnowledgeModal({ value, isEdit, saving, onClose, onSave }: {
  value: KnowledgeInput
  isEdit: boolean
  saving: boolean
  onClose: () => void
  onSave: (data: KnowledgeInput) => void
}) {
  const [f, setF] = useState<KnowledgeInput>(value)
  const set = <K extends keyof KnowledgeInput>(k: K, v: KnowledgeInput[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.title.trim() || !f.slug.trim() || !f.body.trim()) return
    onSave({ ...f, title: f.title.trim(), slug: f.slug.trim(), body: f.body.trim() })
  }

  return (
    <Portal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: '100%' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Редактировать статью' : 'Новая статья'}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }}><I.X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '72vh', overflowY: 'auto' }}>
          <Field label="Заголовок *">
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Row>
            <Field label="Slug *" hint="латиницей, в URL: /knowledge/slug">
              <input className="input" value={f.slug} onChange={(e) => set('slug', e.target.value)} placeholder="podacha-zayavki" required />
            </Field>
            <Field label="Категория">
              <select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>
                {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </Row>
          <Field label="Краткое описание (excerpt)" hint="1–2 предложения — показывается в списке и как лид">
            <textarea className="textarea" value={f.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={2} />
          </Field>
          <Field label="Текст *" hint="markdown: ## подзаголовок, «- » список, **жирный**">
            <textarea className="textarea" value={f.body} onChange={(e) => set('body', e.target.value)} rows={12} required />
          </Field>
          <Row>
            <Field label="Время чтения, мин">
              <input className="input" type="number" min={0} value={f.read_minutes ?? ''} onChange={(e) => set('read_minutes', e.target.value === '' ? null : Number(e.target.value))} />
            </Field>
            <Field label="Дата публикации">
              <input className="input" type="date" value={f.published_at} onChange={(e) => set('published_at', e.target.value)} />
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
    </Portal>
  )
}

// ─── Holding stats ────────────────────────────────────────────────────────────

// Набор фиксирован (4 цифры о холдинге): правятся value/label/asof, без add/delete.
function HoldingTab() {
  const { push } = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<HoldingStat | null>(null)

  const { data: items = [], isLoading } = useQuery<HoldingStat[]>({
    queryKey: ['holding-stats'],
    queryFn: () => contentApi.holdingStats().then((r) => r.data ?? []),
  })

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: HoldingStatInput }) =>
      contentApi.updateHoldingStat(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holding-stats'] })
      push('Показатель сохранён', 'success')
      setEditing(null)
    },
    onError: (e) => push(apiErr(e, 'Не удалось сохранить показатель'), 'error'),
  })

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 16 }}>
        Цифры для секции «Холдинг „Байтерек“» на главной. Набор фиксирован — правятся значение, подпись и сноска.
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {['#', 'Подпись', 'Значение', 'Сноска', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Загрузка…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Показателей пока нет</td></tr>
              ) : items.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>{s.sort_order}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>{s.label}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.value}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-2)' }}>{s.asof ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(s)}>Изменить</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <HoldingModal
          value={editing}
          saving={saveMut.isPending}
          onClose={() => setEditing(null)}
          onSave={(data) => saveMut.mutate({ id: editing.id, data })}
        />
      )}
    </>
  )
}

function HoldingModal({ value, saving, onClose, onSave }: {
  value: HoldingStat
  saving: boolean
  onClose: () => void
  onSave: (data: HoldingStatInput) => void
}) {
  const [f, setF] = useState<HoldingStatInput>({
    value: value.value, label: value.label, asof: value.asof ?? '', sort_order: value.sort_order,
  })
  const set = <K extends keyof HoldingStatInput>(k: K, v: HoldingStatInput[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.value.trim() || !f.label.trim()) return
    onSave({ ...f, value: f.value.trim(), label: f.label.trim() })
  }

  return (
    <Portal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '100%' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Показатель холдинга</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }}><I.X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Подпись *" hint="напр. Активы холдинга">
            <input className="input" value={f.label} onChange={(e) => set('label', e.target.value)} required />
          </Field>
          <Field label="Значение *" hint="число/текст как строка: 15,91 трлн ₸">
            <input className="input" value={f.value} onChange={(e) => set('value', e.target.value)} required />
          </Field>
          <Field label="Сноска" hint="мелким серым: на 30.06.2025">
            <input className="input" value={f.asof} onChange={(e) => set('asof', e.target.value)} />
          </Field>
          <Field label="Порядок">
            <input className="input" type="number" value={f.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  )
}

// ─── Service FAQ ──────────────────────────────────────────────────────────────

const emptyFaq: FaqInput = { service_id: '', question: '', answer: '', sort_order: 0 }

// Доля 👎 среди всех голосов — чтобы отсортировать «не помогающие» ответы наверх.
function downShare(f: FaqItem): number {
  const total = f.up_votes + f.down_votes
  return total === 0 ? 0 : f.down_votes / total
}

function FaqTab() {
  const { push } = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<{ id?: string; data: FaqInput } | null>(null)

  const { data: items = [], isLoading } = useQuery<FaqItem[]>({
    queryKey: ['faq-admin'],
    queryFn: () => faqApi.listAll().then((r) => r.data ?? []),
  })

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then((r) => r.data ?? []),
  })

  const serviceTitle = (id?: string) => services.find((s) => s.id === id)?.title

  // Общий список — все вопросы, но «не помогающие» (высокая доля 👎) сверху.
  const sorted = [...items].sort((a, b) => downShare(b) - downShare(a))

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: FaqInput }) =>
      id ? faqApi.update(id, data) : faqApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faq-admin'] })
      qc.invalidateQueries({ queryKey: ['faq'] })
      push('Вопрос сохранён', 'success')
      setEditing(null)
    },
    onError: (e) => push(apiErr(e, 'Не удалось сохранить вопрос'), 'error'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => faqApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faq-admin'] })
      qc.invalidateQueries({ queryKey: ['faq'] })
      push('Вопрос удалён', 'success')
    },
    onError: (e) => push(apiErr(e, 'Не удалось удалить вопрос'), 'error'),
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
          Всего: {items.length}. «Не помогающие» ответы (высокая доля 👎) — сверху.
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ data: { ...emptyFaq } })}>
          <I.Plus size={14} /> Добавить вопрос
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {['#', 'Вопрос', 'Услуга', '👍', '👎', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Загрузка…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Вопросов пока нет</td></tr>
              ) : sorted.map((f) => {
                const hot = f.down_votes > f.up_votes && f.down_votes > 0
                return (
                  <tr key={f.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-3)' }}>{f.sort_order}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, maxWidth: 360 }}>{f.question}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {f.service_id
                        ? <span className="badge badge-gray">{serviceTitle(f.service_id) ?? 'Услуга'}</span>
                        : <span className="badge badge-green">Общий</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-success)', fontWeight: 600 }}>{f.up_votes}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: hot ? 'var(--color-danger)' : 'var(--color-text-2)' }}>{f.down_votes}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <RowActions
                        onEdit={() => setEditing({
                          id: f.id,
                          data: {
                            service_id: f.service_id ?? '', question: f.question,
                            answer: f.answer, sort_order: f.sort_order,
                          },
                        })}
                        onDelete={() => { if (window.confirm(`Удалить вопрос «${f.question}»?`)) delMut.mutate(f.id) }}
                        disabled={delMut.isPending}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <FaqModal
          value={editing.data}
          isEdit={!!editing.id}
          saving={saveMut.isPending}
          services={services}
          onClose={() => setEditing(null)}
          onSave={(data) => saveMut.mutate({ id: editing.id, data })}
        />
      )}
    </>
  )
}

function FaqModal({ value, isEdit, saving, services, onClose, onSave }: {
  value: FaqInput
  isEdit: boolean
  saving: boolean
  services: Service[]
  onClose: () => void
  onSave: (data: FaqInput) => void
}) {
  const [f, setF] = useState<FaqInput>(value)
  const set = <K extends keyof FaqInput>(k: K, v: FaqInput[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.question.trim() || !f.answer.trim()) return
    onSave({ ...f, question: f.question.trim(), answer: f.answer.trim() })
  }

  return (
    <Portal>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Редактировать вопрос' : 'Новый вопрос'}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }}><I.X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '72vh', overflowY: 'auto' }}>
          <Field label="Услуга" hint="«Общий» — вопрос виден на всех услугах">
            <select className="select" value={f.service_id ?? ''} onChange={(e) => set('service_id', e.target.value)}>
              <option value="">Общий (все услуги)</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </Field>
          <Field label="Вопрос *">
            <input className="input" value={f.question} onChange={(e) => set('question', e.target.value)} required />
          </Field>
          <Field label="Ответ *" hint="markdown: ## подзаголовок, «- » список, **жирный**">
            <textarea className="textarea" value={f.answer} onChange={(e) => set('answer', e.target.value)} rows={8} required />
          </Field>
          <Field label="Порядок">
            <input className="input" type="number" value={f.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
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
