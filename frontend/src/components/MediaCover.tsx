import { useEffect, useRef, useState } from 'react'
import { CategoryArt } from '@/components/CategoryArt'
import { resolveServiceMedia } from '@/lib/serviceMedia'

/**
 * Обложка карточки услуги с тремя слоями (снизу вверх):
 *   (а) базовый — брендовый SVG CategoryArt, рендерится ВСЕГДА и сразу;
 *   (б) фото — <img> из resolveServiceMedia, fade-in по onLoad; onError скрывает
 *       слой (остаётся SVG — текущий вид), файла может не быть;
 *   (в) hover-видео (только при hoverVideo) — <video preload="none">, стартует
 *       по наведению/фокусу карточки, кроссфейд только после onPlaying, onError
 *       скрывает слой; при prefers-reduced-motion не запускается.
 *
 * Файлов медиа может ещё не быть — тогда компонент выглядит ровно как прежний
 * CategoryArt, без битых повторных запросов (один onError на источник).
 *
 * Позиционирование: компонент заполняет родителя (position:absolute, inset:0),
 * поэтому родитель ДОЛЖЕН быть position:relative с заданной высотой — так слои
 * не двигают лейаут и сохраняют текущий aspect-ratio карточки.
 */
export function MediaCover({
  title,
  category,
  className,
  style,
  hoverVideo = false,
  children,
}: {
  title?: string | null
  category?: string | null
  className?: string
  style?: React.CSSProperties
  /** Проигрывать hover-видео (карточки каталога/главной). */
  hoverVideo?: boolean
  /** Оверлеи поверх обложки (напр. bookmark-кнопка). */
  children?: React.ReactNode
}) {
  const { image, video } = resolveServiceMedia(title, category)

  const hostRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [imgOk, setImgOk] = useState(!!image) // есть ли фото-слой (до onError)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [videoOk, setVideoOk] = useState(!!video)
  const [active, setActive] = useState(false) // курсор/фокус на карточке
  const [videoReady, setVideoReady] = useState(false) // видео реально играет

  const useHoverVideo = hoverVideo && !!video

  // Активация по наведению/фокусу самой карточки (ближайший focusable-предок —
  // <a>/<button>). mouseenter/leave не всплывают, поэтому слушаем напрямую.
  useEffect(() => {
    if (!useHoverVideo) return
    const host = hostRef.current
    const card = (host?.closest('a, button, [tabindex]') as HTMLElement | null) ?? host
    if (!card) return
    const on = () => setActive(true)
    const off = () => setActive(false)
    card.addEventListener('mouseenter', on)
    card.addEventListener('mouseleave', off)
    card.addEventListener('focusin', on)
    card.addEventListener('focusout', off)
    return () => {
      card.removeEventListener('mouseenter', on)
      card.removeEventListener('mouseleave', off)
      card.removeEventListener('focusin', on)
      card.removeEventListener('focusout', off)
    }
  }, [useHoverVideo])

  // Пуск/пауза видео по активности. prefers-reduced-motion → не запускаем.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !useHoverVideo || !videoOk) return
    if (active) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      v.play().catch(() => {})
    } else {
      v.pause()
      v.currentTime = 0
      setVideoReady(false)
    }
  }, [active, useHoverVideo, videoOk])

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}
    >
      {/* (а) базовый SVG — всегда */}
      <CategoryArt
        category={category}
        height={120}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* (б) фото-слой */}
      {image && imgOk && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgOk(false)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 400ms var(--ease-out)',
          }}
        />
      )}

      {/* (в) hover-видео */}
      {useHoverVideo && videoOk && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          onPlaying={() => setVideoReady(true)}
          onError={() => setVideoOk(false)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: active && videoReady ? 1 : 0,
            transition: 'opacity 500ms var(--ease-out)',
          }}
        >
          <source src={video} type="video/mp4" />
        </video>
      )}

      {children}
    </div>
  )
}
