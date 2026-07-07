import { createContext, useCallback, useContext, useState } from 'react'
import { I } from './icons'

type ToastKind = 'info' | 'success' | 'error'

interface Toast {
  id: string
  msg: string
  kind: ToastKind
}

interface ToastCtx {
  push: (msg: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastCtx>({ push: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'success' && <I.CheckCircle size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />}
            {t.kind === 'error'   && <I.Alert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />}
            {t.kind === 'info'    && <I.Info size={18} style={{ color: 'var(--color-accent-text)', flexShrink: 0, marginTop: 1 }} />}
            <div style={{ flex: 1, color: 'var(--color-text)', fontSize: 14 }}>{t.msg}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
