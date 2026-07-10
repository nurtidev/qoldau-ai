import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Рендерит children в document.body через портал.
 *
 * Зачем: страницы обёрнуты в `.page-fade`, у которого из-за
 * `animation-fill-mode: both` навсегда сохраняется `transform: translateY(0)`.
 * Ненулевой transform создаёт новый содержащий блок для `position: fixed`
 * потомков — из-за этого модалки-оверлеи (`.modal-backdrop`, z-index 100)
 * оказывались привязаны к странице, а не к вьюпорту, и не перекрывали
 * шапку/виджет-ассистента. Портал в body выносит модалку из этой ловушки.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
