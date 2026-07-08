import axios from 'axios'
import { useAuthStore } from '@/store/auth'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

// Auth
export const authApi = {
  login: (iin: string, full_name: string, org_name?: string) =>
    api.post('/auth/login', { iin, full_name, org_name }),
  me: () => api.get('/auth/me'),
}

// Services
export const servicesApi = {
  list: (params?: { category?: string; org_name?: string }) =>
    api.get('/services', { params }),
  get: (id: string) => api.get(`/services/${id}`),
  create: (data: object) => api.post('/services', data),
  update: (id: string, data: object) => api.put(`/services/${id}`, data),
  delete: (id: string) => api.delete(`/services/${id}`),
  publish: (id: string) => api.post(`/services/${id}/publish`),
}

// AI
export const aiApi = {
  generateForm: (description: string) =>
    api.post('/ai/generate-form', { description }),
  recommend: (payload: {
    kgd?: unknown
    egov?: unknown
    exclude_service_id?: string
    rejection_reason?: string
    screener_answers?: unknown
  }) => api.post('/ai/recommend', payload),
}

// Applications
export const applicationsApi = {
  create: (service_id: string, form_data: object) =>
    api.post('/applications', { service_id, form_data }),
  list: () => api.get('/applications'),
  get: (id: string) => api.get(`/applications/${id}`),
  updateStatus: (id: string, status: string, message?: string) =>
    api.put(`/applications/${id}/status`, { status, message }),
  // Stage 2: applicant submits the additional data/documents the admin requested.
  submitStage2: (id: string, form_data: object) =>
    api.post(`/applications/${id}/stage2`, { form_data }),
}

// Documents
export const documentsApi = {
  upload: (application_id: string, file: File) => {
    const form = new FormData()
    form.append('application_id', application_id)
    form.append('file', file)
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  listAll: () => api.get('/documents'),
  list: (app_id: string) => api.get(`/documents/${app_id}`),
}

// Notifications
export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
}

// Leads — "Перезвоните мне" widget on the home screener.
export const leadsApi = {
  create: (payload: { name: string; phone: string; service_id?: string; message?: string }) =>
    api.post('/leads', payload),
  list: () => api.get('/leads'),
}

// Mock integrations
export const mockApi = {
  egov: (iin: string) => api.get(`/mock/egov/${iin}`),
  kgd:  (bin: string) => api.get(`/mock/kgd/${bin}`),
  eishSubmit: (application_id: string) =>
    api.post('/mock/eish/submit', { application_id }),
}

export interface KGDData {
  bin: string
  tax_regime: string
  registration_date: string
  is_vat_payer: boolean
  vat_certificate_no: string
  current_tax_debt: number
  current_pension_debt: number
  last_filed_period: string
  annual_revenue: { year: number; amount: number; currency: string }[]
  employees_count: number
  wage_fund_annual: number
  corporate_income_tax_paid: number
  social_contributions_paid: number
  okeds: { code: string; name: string }[]
  violations: unknown[]
  in_risk_register: boolean
  compliance_status: 'compliant' | 'attention' | 'blocked'
  data_source: string
  fetched_at: string
}

// Analytics
export const analyticsApi = {
  summary: () => api.get('/analytics/summary'),
}

// Users (admin-only management)
export interface UserListItem {
  id: string
  iin: string
  full_name: string
  org_name?: string
  role: 'user' | 'author' | 'admin'
  created_at: string
  applications_count: number
}

export interface UsersListResponse {
  items: UserListItem[]
  total: number
}

export const usersApi = {
  list: (params?: { role?: string; q?: string; limit?: number; offset?: number }) =>
    api.get<UsersListResponse>('/users', { params }),
  setRole: (id: string, role: 'user' | 'author' | 'admin') =>
    api.put(`/users/${id}/role`, { role }),
  remove: (id: string) => api.delete(`/users/${id}`),
}

// ─── Audience (reach calculator + broadcast) ──────────────────────────────────

export interface AudienceFilters {
  sectors?: string[]
  regions?: string[]
  msb_categories?: string[]
  min_business_age_months?: number | null
  max_business_age_months?: number | null
  min_revenue?: number | null
  max_revenue?: number | null
  min_owner_age?: number | null
  max_owner_age?: number | null
  exclude_tax_debt?: boolean
  exclude_risk_register?: boolean
}

export interface AudienceBreakdown { key: string; count: number }

export interface AudienceSampleUser {
  full_name: string
  org_name?: string
  region?: string
  sector?: string
  msb_category?: string
}

export interface AudienceMatch {
  total: number
  by_region: AudienceBreakdown[]
  by_sector: AudienceBreakdown[]
  by_msb:    AudienceBreakdown[]
  sample:    AudienceSampleUser[]
}

export interface AudienceSnapshot {
  total_audience: number
  regions:        string[]
  sectors:        string[]
  msb_categories: string[]
}

export const audienceApi = {
  snapshot: () => api.get<AudienceSnapshot>('/audience/snapshot'),
  match: (service_id: string, filters: AudienceFilters) =>
    api.post<AudienceMatch>(`/services/${service_id}/audience`, filters),
  broadcast: (service_id: string, payload: {
    filters: AudienceFilters
    title:   string
    message: string
  }) => api.post<{ sent_to: number; service_id: string; service_name: string }>(
    `/services/${service_id}/broadcast`, payload,
  ),
}

// ─── Funnel analytics ─────────────────────────────────────────────────────────

export interface FunnelStage {
  stage:    string
  label:    string
  count:    number
  drop_pct: number
}

export interface DrilldownField {
  field_id:        string
  field_label:     string
  abandoned_count: number
  abandoned_pct:   number
  stats:           Record<string, number | string>
  insight:         string
  audience_fix?: {
    min_revenue?: number
    max_revenue?: number
    note?:        string
  }
}

export interface BiggestDrop {
  stage:           string
  stage_label:     string
  abandoned_count: number
  top_fields:      DrilldownField[] | null
}

export interface FunnelResponse {
  service_id:    string
  service_title: string
  funnel:        FunnelStage[]
  biggest_drop?: BiggestDrop
}

export const funnelApi = {
  get: (service_id: string) =>
    api.get<FunnelResponse>(`/services/${service_id}/funnel`),
  logView: (service_id: string) =>
    api.post<{ status: string }>(`/services/${service_id}/view`, {}),
  logEvent: (application_id: string, payload: {
    step_id:           string
    step_index:        number
    event_type:        'entered' | 'completed' | 'abandoned'
    last_field_id?:    string
    last_field_value?: string
  }) => api.post<{ status: string }>(`/applications/${application_id}/event`, payload),
}
