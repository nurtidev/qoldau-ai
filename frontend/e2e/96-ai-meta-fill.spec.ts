import { test, expect } from '@playwright/test'

// Verifies that AI generation also auto-fills the LeftPanel meta
// (title / category / org_name / description / program terms),
// so the admin can publish without retyping anything.

test('AI fills program meta after "Применить к холсту"', async ({ page }) => {
  test.setTimeout(180_000)

  // Login as admin
  await page.goto('/login')
  await page.locator('input[type="text"]').fill('000000000000')
  await page.getByRole('button', { name: /Войти через eGov/i }).click()
  await page.waitForURL(/\/admin/, { timeout: 15_000 })

  // Builder page (skip tour)
  await page.goto('/admin/services/new?e2e=1')
  await expect(page.getByText('AI-конструктор формы')).toBeVisible({ timeout: 10_000 })

  // BRK preset chip (default already, but click to be explicit)
  await page.getByTestId('ai-preset-brk-leasing').click()
  await page.getByRole('button', { name: /Сгенерировать форму через AI/i }).click()
  await expect(page.getByText(/сек с AI/i)).toBeVisible({ timeout: 120_000 })

  // Apply
  await page.getByRole('button', { name: /Применить к холсту/i }).click()
  await expect(page.getByText(/Структура применена/i)).toBeVisible({ timeout: 5_000 })

  // — Verify meta got auto-filled —
  const titleInput  = page.locator('input[placeholder="Льготный кредит для МСБ"]')
  const descInput   = page.locator('textarea[placeholder*="2–3 предложения"]')
  const catSelect   = page.locator('select').nth(0)
  const orgSelect   = page.locator('select').nth(1)
  const rateInput   = page.locator('input[placeholder="6.0"]')
  const termInput   = page.locator('input[placeholder="60"]')
  const amountInput = page.locator('input[placeholder="750000000"]')

  const titleVal  = await titleInput.inputValue()
  const descVal   = await descInput.inputValue()
  const catVal    = await catSelect.inputValue()
  const orgVal    = await orgSelect.inputValue()
  const rateVal   = await rateInput.inputValue()
  const termVal   = await termInput.inputValue()
  const amountVal = await amountInput.inputValue()

  console.log('META: title  =', JSON.stringify(titleVal))
  console.log('META: desc   =', JSON.stringify(descVal.slice(0, 80) + (descVal.length > 80 ? '…' : '')))
  console.log('META: cat    =', JSON.stringify(catVal))
  console.log('META: org    =', JSON.stringify(orgVal))
  console.log('META: rate   =', JSON.stringify(rateVal))
  console.log('META: term   =', JSON.stringify(termVal))
  console.log('META: amount =', JSON.stringify(amountVal))

  // Hard requirements: title + category + org_name + description must be filled.
  expect(titleVal.length, 'AI should fill title').toBeGreaterThan(3)
  expect(descVal.length,  'AI should fill description').toBeGreaterThan(20)
  expect(catVal,          'AI should pick a category from the list').not.toBe('')
  expect(orgVal,          'AI should pick an org from the list').not.toBe('')

  // Soft requirements: at least one of the three program-terms should be filled
  // for BRK-Leasing (it's a financing product, has all three).
  const termFilled = [rateVal, termVal, amountVal].filter(v => v.trim().length > 0).length
  expect(termFilled, 'AI should fill at least 1 program term for BRK').toBeGreaterThanOrEqual(1)
})
