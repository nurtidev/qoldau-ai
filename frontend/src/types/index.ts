export type UserRole = 'admin' | 'author' | 'user'

export interface User {
  id: string
  iin: string
  full_name: string
  org_name?: string
  role: UserRole
  created_at: string
}

export interface FormFieldCondition {
  field_id: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than'
  value: string | number
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'file'
  | 'calculated'
  | 'checkbox'
  | 'radio'

export interface FormField {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  mask?: 'currency' | 'percent'
  formula?: string
  readonly?: boolean
  accept?: string
  prefill_from?: string
  condition?: FormFieldCondition
}

export interface FormStep {
  id: string
  title: string
  fields: FormField[]
  condition?: FormFieldCondition
}

export interface FormSchema {
  steps: FormStep[]
}

export type ServiceStatus = 'draft' | 'published'

export type EligibilityLevel = 'blocking' | 'warning' | 'info'
export type EligibilitySource = 'kgd' | 'kgd_derived' | 'egov' | 'form'
export type EligibilityOp =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'truthy' | 'falsy'

export interface EligibilityCheck {
  source: EligibilitySource
  field: string
  op: EligibilityOp
  value?: unknown
}

export interface EligibilityRule {
  id: string
  level: EligibilityLevel
  title: string
  ok_label?: string
  fail_label?: string
  detail?: string
  check: EligibilityCheck
}

export interface EligibilityRuleset {
  rules: EligibilityRule[]
}

export interface Service {
  id: string
  title: string
  description?: string
  category?: string
  org_name?: string
  status: ServiceStatus
  form_schema: FormSchema
  eligibility_rules?: EligibilityRuleset
  created_by?: string
  created_at: string
}

export interface RecommendationItem {
  service_id: string
  title: string
  org_name?: string
  reason: string
}

export interface RecommendationResponse {
  recommendations: RecommendationItem[]
  note?: string
}

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'

export interface Application {
  id: string
  service_id: string
  user_id: string
  form_data: Record<string, unknown>
  status: ApplicationStatus
  service_title?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  application_id: string
  name: string
  file_url: string
  uploaded_by?: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message?: string
  is_read: boolean
  created_at: string
}

export interface AnalyticsSummary {
  total_applications: number
  total_services: number
  total_users: number
  pending_applications: number
  by_status: { status: ApplicationStatus; count: number }[]
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft:     'Черновик',
  submitted: 'Подана',
  in_review: 'На рассмотрении',
  approved:  'Одобрена',
  rejected:  'Отклонена',
}

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
}
