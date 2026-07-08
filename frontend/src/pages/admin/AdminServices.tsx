import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '@/api/client'
import { I } from '@/components/icons'
import { ServiceInsights } from '@/components/ServiceInsights'
import type { Service } from '@/types'
import { useIsNarrow } from '@/hooks/useMediaQuery'
import { useAuthStore } from '@/store/auth'

export function AdminServices() {
  const qc = useQueryClient()
  const isNarrow = useIsNarrow()
  // Publish/delete are admin-only on the backend (adminMw). Authors build drafts only.
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  // Service whose AI-insights panel is open.
  const [insightsFor, setInsightsFor] = useState<Service | null>(null)

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ['admin-services'],
    queryFn: () => servicesApi.list().then(r => r.data),
  })

  const publish = useMutation({
    mutationFn: (id: string) => servicesApi.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-services'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-services'] }),
  })

  return (
    <div className="page-fade" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Услуги</h1>
        <Link to="/admin/services/new" className="btn btn-primary">
          <I.Plus size={15} /> Создать услугу
        </Link>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-3)' }}>
              Нет услуг.{' '}
              <Link to="/admin/services/new" style={{ color: 'var(--color-accent-text)', fontWeight: 500 }}>
                Создать первую
              </Link>
            </div>
          ) : (
            services.map((service, i) => (
              <div key={service.id} style={{
                display: 'flex', alignItems: isNarrow ? 'flex-start' : 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', rowGap: 10,
                padding: '16px 20px',
                borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{ flex: isNarrow ? '1 1 100%' : 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500, color: 'var(--color-text)',
                    overflow: isNarrow ? 'visible' : 'hidden',
                    textOverflow: isNarrow ? 'clip' : 'ellipsis',
                    whiteSpace: isNarrow ? 'normal' : 'nowrap',
                  }}>
                    {service.title}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--color-text-3)', flexWrap: 'wrap' }}>
                    <span>{service.category ?? 'Без категории'}</span>
                    {service.org_name && <span>{service.org_name}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: isNarrow ? 0 : 16, flexShrink: 1, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
                  <span className={service.status === 'published' ? 'badge badge-green' : 'badge badge-gray'}>
                    {service.status === 'published' ? 'Опубликована' : 'Черновик'}
                  </span>

                  {isAdmin && service.status !== 'published' && (
                    <button
                      onClick={() => publish.mutate(service.id)}
                      disabled={publish.isPending}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-success)', fontSize: 13 }}
                    >
                      Опубликовать
                    </button>
                  )}

                  <button
                    onClick={() => setInsightsFor(service)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 13, color: 'var(--color-accent-text)' }}
                    title="AI-инсайты по накопленным данным"
                  >
                    <I.Sparkle size={14} /> AI-инсайты
                  </button>

                  <Link
                    to={`/admin/services/${service.id}/edit`}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 13 }}
                  >
                    <I.Wand size={14} /> Редактировать
                  </Link>

                  {isAdmin && (
                    <button
                      onClick={() => { if (confirm('Удалить услугу?')) remove.mutate(service.id) }}
                      disabled={remove.isPending}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)', fontSize: 13 }}
                    >
                      <I.Trash size={14} /> Удалить
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {insightsFor && (
        <ServiceInsights
          serviceId={insightsFor.id}
          serviceTitle={insightsFor.title}
          onClose={() => setInsightsFor(null)}
        />
      )}
    </div>
  )
}
