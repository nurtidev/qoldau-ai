import { test, expect, type Page } from '@playwright/test'

/**
 * Smoke-проверка ключевых функций на prod через реальный UI.
 * Запускать с BASE_URL=https://frontend-production-7418.up.railway.app
 *
 * Не редактирует существующие услуги — создаёт новую черновую, потом удаляет
 * (если успели сохранить).
 */

const ADMIN_IIN = '000000000000'

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('123456789012').fill(ADMIN_IIN)
  await page.getByRole('button', { name: /войти через egov/i }).click()
  await page.waitForURL(/\/admin/, { timeout: 15_000 })
}

test('AI generate-form работает через UI — стрим стартует и приходит контент', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/admin/services/new')

  const textarea = page.locator('textarea').first()
  await textarea.fill('Льготный микрокредит для ИП до 10 млн тенге')

  await page.getByRole('button', { name: /сгенерировать форму|сгенерировать/i }).first().click()

  // 1. Streaming-индикатор появляется → значит запрос ушёл, Claude отвечает
  await expect(page.getByText(/claude генерирует форму/i))
    .toBeVisible({ timeout: 15_000 })

  // 2. В терминале появляется первая JSON-структура за ~10 сек → стрим живой
  // Слово "step" должно появиться в потоке очень рано
  await expect(page.getByText(/steps|step_1|fields/i).first())
    .toBeVisible({ timeout: 30_000 })

  // Полное завершение стрима не дожидаемся — это 30-90 сек и зависит от
  // объёма ответа Claude. Запуск стрима и поступление контента уже доказывают,
  // что AI-эндпоинт работает.
})

test('Калькулятор охвата открывается из конструктора и показывает счётчик', async ({ page }) => {
  await loginAsAdmin(page)

  // Открываем существующую опубликованную услугу
  const res = await page.request.get('/api/services')
  const services = await res.json()
  const published = services.find((s: { status: string }) => s.status === 'published')
  if (!published) throw new Error('Нет опубликованных услуг')

  await page.goto(`/admin/services/${published.id}/edit`)

  // Кнопка «Аудитория» в тулбаре
  const audienceBtn = page.getByRole('button', { name: /аудитория/i })
  await expect(audienceBtn).toBeVisible({ timeout: 15_000 })
  await audienceBtn.click()

  // Drawer открыт
  await expect(page.getByText(/калькулятор охвата/i)).toBeVisible({ timeout: 5_000 })

  // Поллим большой счётчик пока он не обновится с 0 на реальное число.
  // Snapshot + match-запросы суммарно ~1 сек, ставим 15 для запаса.
  await page.locator('text=/^3\\s?000$/').waitFor({ timeout: 15_000 })
})
