import { useEffect, useRef, useState } from 'react'
import { mockApi, type ECPSignature } from '@/api/client'
import { I } from '@/components/icons'

interface Props {
  open: boolean
  iin: string
  fullName?: string
  /** Вызывается по завершении подписания — родитель делает реальную отправку заявки. */
  onSigned: (signature: ECPSignature) => void
  /** Отмена на шаге выбора ключа/пароля — возврат к форме без отправки. */
  onCancel: () => void
}

// Имитация стадий NCALayer (по мотивам KGDCheck — тот же приём с анимированным
// прогрессом стадий).
const STAGES = [
  'Подключение к NCALayer…',
  'Чтение ключа…',
  'Формирование подписи ГОСТ…',
  'Проверка сертификата в НУЦ РК…',
]

// В e2e-режиме (?e2e=1, см. BuilderTour) анимацию стадий ускоряем, чтобы не
// замедлять тесты — но само подписание не пропускаем, тесты обязаны пройти модалку.
function isE2E(): boolean {
  return new URLSearchParams(window.location.search).get('e2e') === '1'
}

type Phase = 'select' | 'signing' | 'done' | 'error'

export function ECPSignModal({ open, iin, fullName, onSigned, onCancel }: Props) {
  const [phase, setPhase]             = useState<Phase>('select')
  const [password, setPassword]       = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [stage, setStage]             = useState(0)
  const [signature, setSignature]     = useState<ECPSignature | null>(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const timers = useRef<number[]>([])
  // Guard от двойного клика/Enter: setPhase асинхронный, полагаться на phase нельзя.
  const signingRef = useRef(false)

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // Сбрасываем состояние при закрытии, чтобы следующее открытие начиналось с шага выбора ключа.
  useEffect(() => {
    if (!open) {
      clearTimers()
      signingRef.current = false
      setPhase('select')
      setPassword('')
      setPasswordError('')
      setStage(0)
      setSignature(null)
      setErrorMsg('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => clearTimers(), [])

  if (!open) return null

  const stepMs = isE2E() ? 50 : 650

  const startSigning = () => {
    if (!password.trim()) {
      setPasswordError('Введите пароль хранилища ключей')
      return
    }
    if (signingRef.current) return
    signingRef.current = true
    setPasswordError('')
    setErrorMsg('')
    setPhase('signing')
    setStage(0)

    STAGES.forEach((_, idx) => {
      timers.current.push(window.setTimeout(() => setStage(idx), idx * stepMs))
    })
    const minDelay = STAGES.length * stepMs

    const apiCall = mockApi.ecpSign({ iin, full_name: fullName }).then(res => res.data)
    const minWait = new Promise<void>(resolve => {
      timers.current.push(window.setTimeout(resolve, minDelay))
    })

    Promise.all([apiCall, minWait])
      .then(([sig]) => {
        setSignature(sig)
        setPhase('done')
        timers.current.push(window.setTimeout(() => onSigned(sig), isE2E() ? 80 : 900))
      })
      .catch(() => {
        signingRef.current = false
        setErrorMsg('Не удалось подписать заявку — проверьте соединение и попробуйте снова.')
        setPhase('error')
      })
  }

  const handleCancel = () => {
    clearTimers()
    onCancel()
  }

  return (
    <div
      onClick={phase === 'signing' ? undefined : handleCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(16,58,38,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        animation: 'pageFade 160ms var(--ease-out) both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Подписание ЭЦП"
        style={{
          width: 440, maxWidth: '100%', background: '#fff', borderRadius: 14,
          boxShadow: 'var(--sh-lg)', padding: 28,
          animation: 'modalPop 240ms var(--ease-out) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I.Shield size={18} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Подписание ЭЦП</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Имитация NCALayer</div>
          </div>
          {phase !== 'signing' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCancel}
              aria-label="Закрыть"
              style={{ width: 28, padding: 0, marginLeft: 'auto' }}
            >
              <I.X size={14} />
            </button>
          )}
        </div>

        {phase === 'select' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 14 }}>
              Выберите ключ ЭЦП для подписания заявки.
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              border: '1px solid var(--color-primary-soft)', borderRadius: 10,
              background: 'var(--color-accent-soft)', marginBottom: 16,
            }}>
              <I.Lock size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  AUTH_RSA256_{iin}.p12
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>ГОСТ · хранилище NCALayer</div>
              </div>
            </div>

            <label htmlFor="ecp-password" style={{
              display: 'block', fontSize: 13, fontWeight: 500,
              color: 'var(--color-text-2)', marginBottom: 6,
            }}>
              Пароль хранилища
            </label>
            <input
              id="ecp-password"
              type="password"
              className={`input ${passwordError ? 'is-error' : ''}`}
              placeholder="Введите пароль"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError('') }}
              onKeyDown={e => { if (e.key === 'Enter') startSigning() }}
              autoFocus
              aria-invalid={!!passwordError}
            />
            {passwordError && (
              <p role="alert" style={{ fontSize: 12, color: 'var(--color-danger)', margin: '6px 0 0' }}>
                {passwordError}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={startSigning}>
                <I.Shield size={14} /> Подписать
              </button>
            </div>
          </>
        )}

        {phase === 'signing' && (
          <div style={{ padding: '12px 0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 20, height: 20, border: '2px solid var(--color-primary)',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'ecp-spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <strong style={{ fontSize: 14 }}>{STAGES[stage]}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STAGES.map((s, i) => (
                <div key={s} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  color: i < stage ? 'var(--color-success)'
                       : i === stage ? 'var(--color-text-2)' : 'var(--color-text-3)',
                }}>
                  {i < stage ? <I.Check size={12} strokeWidth={3} /> : <span style={{ width: 12, flexShrink: 0 }} />}
                  {s}
                </div>
              ))}
            </div>
            <style>{`@keyframes ecp-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {phase === 'done' && signature && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', margin: '0 auto 14px',
              background: 'var(--color-success-soft)', color: 'var(--color-success)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <I.CheckCircle size={28} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Заявка подписана</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
              № подписи: <strong>{signature.signature_id}</strong><br />
              Владелец сертификата: <strong>{signature.cert_owner}</strong>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ padding: '8px 0' }}>
            <div style={{
              display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10,
              background: 'var(--color-danger-soft)', border: '1px solid #FECACA', marginBottom: 18,
            }}>
              <I.Alert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: '#991B1B' }}>{errorMsg}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>Отмена</button>
              <button type="button" className="btn btn-primary" onClick={startSigning}>Повторить</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
