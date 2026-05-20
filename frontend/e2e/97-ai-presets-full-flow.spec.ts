import { test, expect, Page } from '@playwright/test'

// For each of the 4 AI-prompt presets, run the full lifecycle:
//   click chip → generate via AI → apply to canvas → fill meta → publish →
//   open public catalog → open service → click "Подать заявку" → confirm ApplyPage opens.
// This is what the jury will reproduce live. Slow (each AI call ~45-60s),
// so we share login across cases.

const PRESETS = [
  { id: 'brk-leasing',         label: '⭐ БРК-Лизинг (контрольный кейс)' },
  { id: 'baiterek-equipment',  label: '🏭 Байтерек: оборудование' },
  { id: 'damu-credit',         label: '💰 Damu: льготный кредит' },
  { id: 'youth-grant',         label: '🎯 Молодёжный грант' },
]

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="text"]').fill('000000000000')
  await page.getByRole('button', { name: /Войти через eGov/i }).click()
  await page.waitForURL(/\/admin/, { timeout: 15_000 })
}

async function runPreset(page: Page, preset: { id: string; label: string }) {
  const runId   = `${preset.id}-${Date.now()}`
  const title   = `E2E · ${preset.label} · ${runId}`

  // 1. Open empty admin/services/new
  await page.goto('/admin/services/new?e2e=1')
  await expect(page.getByText('AI-конструктор формы')).toBeVisible({ timeout: 10_000 })

  // 2. Click the preset chip and verify the textarea picked up the prompt
  const chip      = page.getByTestId(`ai-preset-${preset.id}`)
  const promptTA  = page.locator('textarea[placeholder*="льготный кредит"]')
  await expect(chip).toBeVisible()
  await chip.click()
  await expect.poll(async () => (await promptTA.inputValue()).length, { timeout: 3_000 }).toBeGreaterThan(80)
  const prefilled = await promptTA.inputValue()
  console.log(`[${preset.id}] prompt_len=${prefilled.length} head="${prefilled.slice(0, 60)}…"`)

  // 3. Trigger AI generation
  await page.getByRole('button', { name: /Сгенерировать форму через AI/i }).click()
  await expect(page.getByText(/сек с AI/i)).toBeVisible({ timeout: 120_000 })

  // 4. Apply generated structure to canvas
  await page.getByRole('button', { name: /Применить к холсту/i }).click()
  await expect(page.getByText(/Структура применена/i)).toBeVisible({ timeout: 5_000 })

  // 5. Fill meta (LeftPanel) — required for publish
  await page.locator('input[placeholder="Льготный кредит для МСБ"]').fill(title)
  await page.locator('select').nth(0).selectOption({ index: 1 })   // category
  await page.locator('select').nth(1).selectOption({ index: 1 })   // org
  await page.locator('textarea[placeholder*="2–3 предложения"]').fill(
    `Автотест полного флоу для пресета «${preset.label}».`,
  )

  // 6. Publish
  await page.getByRole('button', { name: /Опубликовать/ }).click()
  await expect(page.locator('.toast-success', { hasText: /опубликована/i }))
    .toBeVisible({ timeout: 20_000 })
  await page.waitForURL(/\/admin\/services\/[0-9a-f-]+\/edit/, { timeout: 10_000 })
  const serviceId = page.url().match(/services\/([0-9a-f-]+)\/edit/)?.[1]
  console.log(`[${preset.id}] published service_id=${serviceId}`)
  expect(serviceId).toBeTruthy()

  // 7. Open public catalog and find the card
  await page.goto('/services')
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })

  // 8. Open service detail (click the title — clickable within the card)
  await page.goto(`/services/${serviceId}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 })

  // 9. Submit application — link "Подать заявку"
  const applyLink = page.getByRole('link', { name: /Подать заявку/i }).first()
  await expect(applyLink).toBeVisible()
  await applyLink.click()

  // 10. ApplyPage opened with FormRenderer
  await page.waitForURL(new RegExp(`/cabinet/apply/${serviceId}`), { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /Подача заявки/i })).toBeVisible({ timeout: 10_000 })

  console.log(`[${preset.id}] ✓ apply page reached`)
}

test.describe('AI presets: full lifecycle on Railway', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  for (const preset of PRESETS) {
    test(`preset ${preset.id}: generate → publish → apply`, async ({ page }) => {
      test.setTimeout(240_000) // AI call + UI ~ up to 4 min worst case
      await runPreset(page, preset)
    })
  }
})
