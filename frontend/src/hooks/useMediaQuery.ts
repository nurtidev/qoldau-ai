import { useEffect, useState } from 'react'

/**
 * Подписка на CSS media-query. Возвращает true, если запрос совпадает.
 * SSR-safe: до монтирования возвращает false.
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Брейкпоинты портала (max-width, в px). */
export const BP = {
  mobile: 640,
  tablet: 768,
  laptop: 1024,
} as const

/** Удобные шорткаты. */
export const useIsMobile = () => useMediaQuery(`(max-width: ${BP.tablet}px)`)
export const useIsNarrow = () => useMediaQuery(`(max-width: ${BP.mobile}px)`)
export const useIsBelowLaptop = () => useMediaQuery(`(max-width: ${BP.laptop}px)`)
