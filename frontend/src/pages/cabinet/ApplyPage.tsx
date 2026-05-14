import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi, applicationsApi, documentsApi, mockApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { I } from '@/components/icons'
import { useToast } from '@/components/Toast'
import { FormRenderer } from '@/components/FormRenderer'
import type { Service } from '@/types'

export function ApplyPage() {
  const { service_id } = useParams<{ service_id: string }>()
  const { user }       = useAuthStore()
  const navigate       = useNavigate()
  const toast          = useToast()

  const [submitting, setSubmitting]   = useState(false)
  const [egovLoaded, setEgovLoaded]     = useState(false)
  const [egovChecked, setEgovChecked]   = useState(false)
  const [initialData, setInitialData]   = useState<Record<string, unknown>>({})

  const { data: service, isLoading } = useQuery<Service>({
    queryKey: ['service', service_id],
    queryFn: () => servicesApi.get(service_id!).then(r => r.data),
    enabled: !!service_id,
  })

  useEffect(() => {
    if (!user || !service) return
    mockApi.egov(user.iin).then(res => {
      const egov = res.data as Record<string, string>
      const prefilled: Record<string, unknown> = {}
      service.form_schema.steps.forEach(step => {
        step.fields.forEach(field => {
          if (field.prefill_from?.startsWith('egov.')) {
            const key = field.prefill_from.split('.')[1]
            if (egov[key] !== undefined) prefilled[field.id] = egov[key]
          }
        })
      })
      setInitialData(prefilled)
      setEgovLoaded(Object.keys(prefilled).length > 0)
    }).catch(() => {}).finally(() => setEgovChecked(true))
  }, [user, service])

  const handleSubmit = async (formData: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      // Separate File objects — JSON.stringify can't serialize them
      const files: { fieldId: string; file: File }[] = []
      const cleanData: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(formData)) {
        if (val instanceof File) {
          files.push({ fieldId: key, file: val })
          cleanData[key] = val.name
        } else {
          cleanData[key] = val
        }
      }

      const res = await applicationsApi.create(service_id!, cleanData)
      const appId = res.data.id

      // Upload files sequentially after application is created
      for (const { file } of files) {
        await documentsApi.upload(appId, file)
      }

      toast.push('Заявка успешно подана!', 'success')
      navigate('/cabinet')
    } catch {
      toast.push('Ошибка при подаче заявки. Попробуйте снова.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container page-fade" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 980 }}>
        <div className="skeleton" style={{ height: 14, width: 300, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 36, width: '50%', marginBottom: 32 }} />
        <div className="skeleton" style={{ height: 500 }} />
      </div>
    )
  }

  if (!service) return null

  return (
    <div className="container page-fade" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 980 }}>
      <nav style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 16 }}>
        <Link to="/" style={{ color: 'var(--color-text-3)' }}>Главная</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <Link to="/services" style={{ color: 'var(--color-text-3)' }}>Услуги</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <Link to={`/services/${service_id}`} style={{ color: 'var(--color-text-3)' }}>{service.title}</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--color-text-2)' }}>Подача заявки</span>
      </nav>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Подача заявки</h1>
        <div style={{ fontSize: 14, color: 'var(--color-text-3)', marginTop: 6 }}>
          {service.org_name && <span>{service.org_name} · </span>}
          <span>{service.title}</span>
        </div>
      </div>

      {egovLoaded && (
        <div style={{
          background: 'var(--color-success-soft)', border: '1px solid #A7F3D0',
          borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, marginBottom: 24,
        }}>
          <I.CheckCircle size={20} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 14, color: '#065F46', lineHeight: 1.55 }}>
            <strong>Данные подгружены из eGov.</strong> Проверьте корректность и при необходимости отредактируйте поля.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 32 }}>
        {!egovChecked
          ? <div className="skeleton" style={{ height: 480, borderRadius: 8 }} />
          : <FormRenderer
              schema={service.form_schema}
              initialData={initialData}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
        }
      </div>
    </div>
  )
}
