import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi, applicationsApi, documentsApi, mockApi, type KGDData, type ISZData, type ECPSignature } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { I } from '@/components/icons'
import { useToast } from '@/components/Toast'
import { FormRenderer } from '@/components/FormRenderer'
import { KGDCheck } from '@/components/KGDCheck'
import { ISZCheck, evaluateLivestockMatch } from '@/components/ISZCheck'
import { PreflightPanel } from '@/components/PreflightPanel'
import { AlternativeRecommendations } from '@/components/AlternativeRecommendations'
import { PrescoreCard } from '@/components/PrescoreCard'
import { AIReviewCard } from '@/components/AIReviewCard'
import { ECPSignModal } from '@/components/ECPSignModal'
import { computePrescore, extractRequestedAmount, toPrescoreSnapshot, type PrescoreIszInput } from '@/lib/prescore'
import { isAgroLivestockService, getAgroLivestockClaim } from '@/lib/agroLivestock'
import type { Service } from '@/types'

export function ApplyPage() {
  const { service_id } = useParams<{ service_id: string }>()
  const { user }       = useAuthStore()
  const navigate       = useNavigate()
  const toast          = useToast()

  const [submitting, setSubmitting]   = useState(false)
  const [egovLoaded, setEgovLoaded]     = useState(false)
  const [egovChecked, setEgovChecked]   = useState(false)
  const [egovData, setEgovData]         = useState<Record<string, unknown> | null>(null)
  const [kgdData, setKgdData]           = useState<KGDData | null>(null)
  const [iszData, setIszData]           = useState<ISZData | null>(null)
  const [initialData, setInitialData]   = useState<Record<string, unknown>>({})
  const [prefilledKeys, setPrefilledKeys] = useState<Set<string>>(new Set())
  const [currentValues, setCurrentValues] = useState<Record<string, unknown>>({})
  const [hasBlocking, setHasBlocking]     = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<Record<string, unknown> | null>(null)

  const { data: service, isLoading } = useQuery<Service>({
    queryKey: ['service', service_id],
    queryFn: () => servicesApi.get(service_id!).then(r => r.data),
    enabled: !!service_id,
  })

  useEffect(() => {
    if (!user || !service) return
    mockApi.egov(user.iin).then(res => {
      const egov = res.data as Record<string, string>
      setEgovData(egov)
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
      setPrefilledKeys(new Set(Object.keys(prefilled)))
      setEgovLoaded(Object.keys(prefilled).length > 0)
    }).catch(() => {}).finally(() => setEgovChecked(true))
  }, [user, service])

  // Предварительная оценка заявителя (по данным eGov + КГД).
  const requestedAmount = useMemo(
    () => extractRequestedAmount(service?.form_schema, currentValues),
    [service, currentValues],
  )

  // Контрольный кейс животноводства: сверка заявленного поголовья с ИСЖ МСХ РК.
  const isAgro = useMemo(() => isAgroLivestockService(service), [service])
  const agroClaim = useMemo(
    () => (isAgro ? getAgroLivestockClaim(currentValues) : {}),
    [isAgro, currentValues],
  )
  const iszMatch = useMemo(
    () => (iszData ? evaluateLivestockMatch(iszData, agroClaim.species, agroClaim.claimedCount) : null),
    [iszData, agroClaim],
  )
  const iszPrescoreInput: PrescoreIszInput | undefined = useMemo(() => {
    if (!iszData) return undefined
    return {
      hasActiveQuarantine: iszData.has_active_quarantine,
      discrepancyRatio: iszMatch?.status === 'discrepancy' ? (iszMatch.discrepancyPct ?? 0) / 100 : undefined,
      discrepancyMessage: iszMatch?.status === 'discrepancy' ? iszMatch.message : undefined,
    }
  }, [iszData, iszMatch])

  const prescore = useMemo(
    () => (kgdData ? computePrescore({ egov: egovData, kgd: kgdData, requestedAmount, isz: iszPrescoreInput }) : null),
    [egovData, kgdData, requestedAmount, iszPrescoreInput],
  )

  // FormRenderer вызывает onSubmit только после прохождения валидации всех шагов —
  // но перед реальной отправкой заявки требуем подписание ЭЦП (имитация NCALayer/eGov).
  const handleFormSubmit = (formData: Record<string, unknown>) => {
    setPendingFormData(formData)
    setSignModalOpen(true)
  }

  const handleSignCancel = () => {
    setSignModalOpen(false)
    setPendingFormData(null)
  }

  const handleSigned = async (signature: ECPSignature) => {
    setSignModalOpen(false)
    const formData = pendingFormData
    setPendingFormData(null)
    if (!formData) return

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

      // Сверка поголовья с ИСЖ — пересчитываем по финальным данным формы
      // (currentValues к моменту сабмита совпадают с formData, но не полагаемся на это).
      const finalClaim = isAgro ? getAgroLivestockClaim(formData) : {}
      const finalIszMatch = iszData ? evaluateLivestockMatch(iszData, finalClaim.species, finalClaim.claimedCount) : null
      const finalIszInput: PrescoreIszInput | undefined = iszData ? {
        hasActiveQuarantine: iszData.has_active_quarantine,
        discrepancyRatio: finalIszMatch?.status === 'discrepancy' ? (finalIszMatch.discrepancyPct ?? 0) / 100 : undefined,
        discrepancyMessage: finalIszMatch?.status === 'discrepancy' ? finalIszMatch.message : undefined,
      } : undefined

      // Снимок предоценки в заявку (под служебным ключом _prescore).
      const amount = extractRequestedAmount(service?.form_schema, formData)
      const result = kgdData
        ? computePrescore({ egov: egovData, kgd: kgdData, requestedAmount: amount, isz: finalIszInput })
        : null
      if (result) cleanData._prescore = toPrescoreSnapshot(result)

      // Снимок сверки с ИСЖ (под служебным ключом _isz) — чтобы аналитик видел
      // расхождение поголовья, зафиксированное на момент подачи.
      if (iszData) {
        cleanData._isz = {
          farm_name: iszData.farm_name,
          region: iszData.region,
          livestock: iszData.livestock,
          has_active_quarantine: iszData.has_active_quarantine,
          claimed_species: finalClaim.species,
          claimed_count: finalClaim.claimedCount,
          verdict: finalIszMatch?.status,
          verdict_message: finalIszMatch?.message,
        }
      }

      // Снимок подписи ЭЦП (мок NCALayer/НУЦ РК).
      cleanData._signature = signature

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

  const handleBlockingChange = useCallback((v: boolean) => setHasBlocking(v), [])
  const handleValuesChange   = useCallback((v: Record<string, unknown>) => setCurrentValues(v), [])

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

  // Two-stage service: render only stage-1 steps here. Stage-2 steps (documents,
  // extended data) are filled later in the cabinet, after preliminary approval.
  const hasStage2 = service.form_schema.steps.some(s => (s.stage ?? 1) === 2)
  const stage1Schema = { steps: service.form_schema.steps.filter(s => (s.stage ?? 1) !== 2) }

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

      {hasStage2 && (
        <div style={{
          background: 'var(--color-info-soft)', border: '1px solid var(--color-info)',
          borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, marginBottom: 12,
        }}>
          <I.Info size={20} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.55 }}>
            <strong>Услуга оформляется в два этапа.</strong> Сначала — первичная заявка,
            а после её предварительного одобрения администратор запросит загрузку документов
            в личном кабинете.
          </div>
        </div>
      )}

      {egovLoaded && (
        <div style={{
          background: 'var(--color-success-soft)', border: '1px solid #A7F3D0',
          borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, marginBottom: 12,
        }}>
          <I.CheckCircle size={20} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 14, color: '#065F46', lineHeight: 1.55 }}>
            <strong>Данные подгружены из eGov.</strong> Проверьте корректность и при необходимости отредактируйте поля.
          </div>
        </div>
      )}

      {egovChecked && user && (
        <KGDCheck bin={user.iin} onComplete={setKgdData} />
      )}

      {isAgro && egovChecked && user && agroClaim.claimedCount !== undefined && (
        <ISZCheck
          iinOrBin={user.iin}
          species={agroClaim.species}
          claimedCount={agroClaim.claimedCount}
          onComplete={setIszData}
        />
      )}

      <PreflightPanel
        ruleset={service.eligibility_rules}
        formData={currentValues}
        egov={egovData}
        kgd={kgdData}
        onBlockingChange={handleBlockingChange}
        onRequestAlternatives={() => setShowAlternatives(true)}
      />

      {showAlternatives && user && (
        <div style={{ marginBottom: 16 }}>
          <AlternativeRecommendations
            iin={user.iin}
            excludeServiceId={service.id}
            rejectionReason={hasBlocking
              ? 'Текущая программа имеет блокирующие риски по профилю заявителя'
              : 'Заявитель ищет более подходящую программу'}
            title="Подходящие альтернативы"
            subtitle="AI подобрал программы под ваш профиль из каталога Байтерек"
          />
        </div>
      )}

      <div className="card" style={{ padding: 32 }}>
        {!egovChecked
          ? <div className="skeleton" style={{ height: 480, borderRadius: 8 }} />
          : <FormRenderer
              schema={stage1Schema}
              initialData={initialData}
              onSubmit={handleFormSubmit}
              submitting={submitting}
              prefilledKeys={prefilledKeys}
              draftKey={user ? `qoldau:draft:${service_id}:${user.id}` : undefined}
              onValuesChange={handleValuesChange}
              submitBlocked={hasBlocking}
              submitBlockedHint={hasBlocking
                ? 'Есть стоп-факторы программы — устраните их или выберите альтернативу'
                : undefined}
              reviewSlot={
                <>
                  <PrescoreCard result={prescore} loading={!kgdData} />
                  <AIReviewCard serviceId={service.id} formData={currentValues} />
                </>
              }
            />
        }
      </div>

      <ECPSignModal
        open={signModalOpen}
        iin={user?.iin ?? ''}
        fullName={user?.full_name}
        onSigned={handleSigned}
        onCancel={handleSignCancel}
      />
    </div>
  )
}
