import { test, expect } from '@playwright/test'

// Manual flow: admin creates a service through the no-code builder *without* AI.
// Critical path for the jury demo — must remain green at all times.

test('Manual builder: create + save draft + publish', async ({ page }) => {
  const logs: string[] = []
  const errors: string[] = []
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', e => errors.push(String(e)))

  // Unique title so reruns don't conflict
  const title = `E2E тест · ручная услуга · ${Date.now()}`

  // 1. Login as admin
  await page.goto('/login')
  await page.locator('input[type="text"]').fill('000000000000')
  await page.getByRole('button', { name: /Войти через eGov/i }).click()
  await page.waitForURL(/\/admin/, { timeout: 15_000 })

  // 2. New service page
  await page.goto('/admin/services/new?e2e=1')
  await expect(page.getByText('Структура заявки')).toBeVisible({ timeout: 10_000 })

  // 3. Fill meta (LeftPanel)
  await page.locator('input[placeholder="Льготный кредит для МСБ"]').fill(title)
  // Categories and orgs come from constants — pick the first non-empty option in each <select>
  const categorySelect = page.locator('select').nth(0)
  const orgSelect      = page.locator('select').nth(1)
  await categorySelect.selectOption({ index: 1 })
  await orgSelect.selectOption({ index: 1 })
  await page.locator('textarea[placeholder*="2–3 предложения"]').fill('E2E-описание программы поддержки для проверки ручного конструктора.')

  // 4. Verify default step is rendered: "Информация о компании" with 3 fields
  await expect(page.getByText('Информация о компании')).toBeVisible()
  // Page header line "1 этапов · 3 полей"
  await expect(page.getByText(/1 этапов · 3 полей/)).toBeVisible()

  // 5. Add a second step
  await page.getByRole('button', { name: /Добавить этап/ }).click()
  // Two steps now — header shows "2 этапов · ... полей"
  await expect(page.getByText(/2 этапов/)).toBeVisible({ timeout: 5_000 })

  // 6. Add a field to step 2 (the last "Добавить поле" button on the page)
  const addFieldBtns = page.getByRole('button', { name: /Добавить поле/ })
  await addFieldBtns.last().click()
  // AddFieldMenu opens — pick "Число"
  await page.getByRole('button', { name: /^Число/ }).first().click()
  // Header now shows total 4 fields (3 in step 1 + 1 just added in step 2)
  await expect(page.getByText(/2 этапов · 4 полей/)).toBeVisible({ timeout: 5_000 })

  // 7. Save draft
  await page.getByRole('button', { name: /Сохранить черновик/ }).click()
  await expect(page.locator('.toast-success', { hasText: /Черновик сохранён/i }))
    .toBeVisible({ timeout: 15_000 })

  // 8. URL should switch to /admin/services/:id/edit
  await page.waitForURL(/\/admin\/services\/[0-9a-f-]+\/edit/, { timeout: 10_000 })
  const editUrl = page.url()
  console.log('EDIT_URL=', editUrl)

  // 9. Publish
  await page.getByRole('button', { name: /Опубликовать/ }).click()
  await expect(page.locator('.toast-success', { hasText: /опубликована/i }))
    .toBeVisible({ timeout: 15_000 })

  // 10. Confirm the published service shows up in the public catalog
  await page.goto('/services')
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })

  console.log('CONSOLE_TAIL=', logs.slice(-15).join('\n'))
  console.log('PAGE_ERRORS=', errors.join('\n'))
  expect(errors, 'no page errors').toHaveLength(0)
})
