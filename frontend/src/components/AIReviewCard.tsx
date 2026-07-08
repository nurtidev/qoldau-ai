import { useState } from 'react'
import { aiApi, type ReviewResult } from '@/api/client'
import { I } from '@/components/icons'
import { useToast } from '@/components/Toast'

// AI-проверка заявки перед отправкой. Запускается только по клику (контроль
// токенов) и НИКОГДА не блокирует отправку — только информирует.
export function AIReviewCard({ serviceId, formData }: {
  serviceId: string
  formData: Record<string, unknown>
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)

  const run = async () => {
    setLoading(true)
    try {
      // Файлы не отправляем — только факт заполнения.
      const clean: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(formData)) {
        clean[k] = v instanceof File ? `[файл загружен: ${v.name}]` : v
      }
      const res = await aiApi.reviewApplication(serviceId, clean)
      setResult({ ...res.data, issues: res.data.issues ?? [] })
    } catch {
      toast.push('Не удалось проверить заявку. Попробуйте ещё раз.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const ok = result != null && (result.verdict === 'ok' || result.issues.length === 0)

  return (
    <div className="card" style={{ padding: 18, marginTop: 12, border: '1.5px solid var(--color-accent-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <I.Sparkle size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Проверка заявки с AI</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.5 }}>
            AI найдёт пропуски и противоречия до отправки. Проверка необязательна и не блокирует подачу.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={run}
          disabled={loading}
          style={{ flexShrink: 0 }}
        >
          {loading ? (
            <>
              <span style={{
                width: 13, height: 13, borderRadius: '50%',
                border: '2px solid var(--color-primary-soft)', borderTopColor: 'var(--color-primary)',
                animation: 'spin 700ms linear infinite', display: 'inline-block',
              }} />
              Проверяем…
            </>
          ) : (
            <>
              <I.Sparkle size={14} /> {result ? 'Проверить снова' : 'Проверить заявку с AI'}
            </>
          )}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 14 }}>
          {ok ? (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', borderRadius: 8,
              background: 'var(--color-success-soft)', color: '#047857',
            }}>
              <I.CheckCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>AI не нашёл проблем.</strong>
                {result.summary && <> {result.summary}</>}
              </div>
            </div>
          ) : (
            <>
              {result.summary && (
                <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55, marginBottom: 10 }}>
                  {result.summary}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.issues.map((is, i) => {
                  const isErr = is.severity === 'error'
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      background: isErr ? '#FEF2F2' : 'var(--color-warning-soft)',
                      border: `1px solid ${isErr ? '#FECACA' : '#FDE68A'}`,
                    }}>
                      <I.Alert size={15} style={{ color: isErr ? '#B91C1C' : '#92400E', flexShrink: 0, marginTop: 1 }} />
                      <div style={{ minWidth: 0 }}>
                        {is.label && (
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: isErr ? '#991B1B' : '#92400E' }}>
                            {is.label}
                          </div>
                        )}
                        <div style={{ fontSize: 12.5, color: isErr ? '#991B1B' : '#92400E', lineHeight: 1.5, marginTop: is.label ? 2 : 0 }}>
                          {is.message}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', marginTop: 10, lineHeight: 1.5 }}>
            Замечания носят рекомендательный характер и не блокируют отправку заявки.
          </div>
        </div>
      )}
    </div>
  )
}
