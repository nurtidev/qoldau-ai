import { useEffect, useState, useCallback } from 'react'
import Joyride, { CallBackProps, Step, STATUS } from 'react-joyride'

// Onboarding tour for /admin/services/new — designed for hackathon jurors.

const STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: '👋 Добро пожаловать в конструктор форм',
    content: (
      <div style={{ lineHeight: 1.55 }}>
        За 60 секунд я покажу, как собрать государственную услугу без программирования.<br /><br />
        Любая мера поддержки в Qoldau AI — это структура полей, шагов и условий, которую можно
        собрать вручную или сгенерировать через AI.
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="ai-block"]',
    placement: 'bottom',
    title: '✨ AI-конструктор формы',
    content: (
      <div style={{ lineHeight: 1.55 }}>
        Опишите услугу обычным текстом — Claude Sonnet 4.6 создаст 6 шагов с полями,
        формулами, условиями и валидацией за ~60 секунд.<br /><br />
        Под полем — 4 готовых пресета: контрольный кейс БРК-Лизинг, оборудование Байтерек,
        кредит Damu и молодёжный грант.
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="ai-generate-btn"]',
    placement: 'bottom',
    title: '🚀 Запустить генерацию',
    content: (
      <div style={{ lineHeight: 1.55 }}>
        Нажмите эту кнопку — структура заявки появится на холсте ниже.
        Можно нажать «Применить к холсту» или «Пересоздать» если результат не понравился.
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="canvas-header"]',
    placement: 'right',
    title: '📐 Холст формы',
    content: (
      <div style={{ lineHeight: 1.55 }}>
        Здесь живёт структура заявки. Каждый шаг можно переименовать, передвинуть,
        добавить условия показа. Поля редактируются в правой панели — тип, формулы,
        связь с eGov, валидация.
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="meta-panel"]',
    placement: 'right',
    title: '⚙️ Параметры программы',
    content: (
      <div style={{ lineHeight: 1.55 }}>
        Название, категория, организация — отображаются в каталоге услуг.<br /><br />
        Внизу — параметры программы (ставка, сумма, срок), они показываются на карточке
        заявителю и используются калькулятором подбора.
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '[data-tour-id="publish-btn"]',
    placement: 'right',
    title: '🚀 Опубликовать',
    content: (
      <div style={{ lineHeight: 1.55 }}>
        Один клик — услуга появляется в публичном каталоге, и предприниматели могут
        подавать заявки.<br /><br />
        Готово! Теперь сами: нажмите «Сгенерировать форму через AI», опубликуйте — и
        зайдите в каталог.
      </div>
    ),
    disableBeacon: true,
  },
]

interface Props {
  /** Auto-start once on mount. Pass false on the edit route (draft already saved)
      so the tour doesn't re-appear over "Опубликовать" after the /new → /:id/edit
      navigation. */
  autoStart?: boolean
  /** External control: when truthy, restart the tour from the first step. */
  forceStart?: boolean
  /** Notify parent when tour finishes/skips, so it can reset forceStart. */
  onFinish?: () => void
}

export function BuilderTour({ autoStart = true, forceStart, onFinish }: Props) {
  const [run, setRun] = useState(false)

  // Auto-start on mount for a brand-new service (skip via ?e2e=1 for Playwright tests)
  useEffect(() => {
    if (!autoStart) return
    const skip = new URLSearchParams(window.location.search).get('e2e') === '1'
    if (skip) return
    // Tiny delay so the page has time to render anchor elements
    const t = setTimeout(() => setRun(true), 400)
    return () => clearTimeout(t)
  }, [autoStart])

  // Manual restart from parent
  useEffect(() => {
    if (forceStart) setRun(true)
  }, [forceStart])

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status } = data
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED]
    if (finished.includes(status)) {
      setRun(false)
      onFinish?.()
    }
  }, [onFinish])

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      scrollOffset={120}
      callback={handleCallback}
      locale={{
        back: 'Назад',
        close: 'Закрыть',
        last: 'Поехали!',
        next: 'Дальше',
        skip: 'Пропустить',
      }}
      styles={{
        options: {
          primaryColor: 'var(--color-primary-600)',
          textColor: '#0F172A',
          backgroundColor: '#fff',
          arrowColor: '#fff',
          overlayColor: 'rgba(15, 23, 42, 0.55)',
          zIndex: 10000,
        },
        tooltip:           { borderRadius: 12, padding: 20, maxWidth: 420, fontSize: 14 },
        tooltipTitle:      { fontSize: 16, fontWeight: 700, marginBottom: 8 },
        buttonNext:        { background: 'var(--color-primary-600)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600 },
        buttonBack:        { color: '#64748B', fontSize: 13, marginRight: 8 },
        buttonSkip:        { color: '#94A3B8', fontSize: 13 },
      }}
    />
  )
}
