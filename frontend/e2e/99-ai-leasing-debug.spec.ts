import { test, expect } from '@playwright/test'

// Repro: admin opens AI form builder with the default leasing prompt and clicks generate.
// Goal: capture what actually goes wrong end-to-end (request/response, parse errors, toasts).

test('AI form builder: leasing prompt end-to-end', async ({ page }) => {
  // Внутренний Promise.race ждёт до 120с — глобальный timeout 30с из конфига убивал тест раньше.
  test.setTimeout(130_000)
  const logs: string[] = []
  const errors: string[] = []
  const sseEvents: { len: number; tail: string; done: boolean; error?: string } = {
    len: 0, tail: '', done: false,
  }

  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', e => errors.push(String(e)))

  // Capture the AI stream response body
  page.on('response', async resp => {
    if (resp.url().endsWith('/api/ai/generate-form-stream')) {
      try {
        const body = await resp.text()
        sseEvents.len = body.length
        sseEvents.tail = body.slice(-2000)
        sseEvents.done = body.includes('"done":true')
        const m = body.match(/"error":"([^"]+)"/)
        if (m) sseEvents.error = m[1]
      } catch (e) { sseEvents.error = `read fail: ${e}` }
    }
  })

  // 1. Login as admin
  await page.goto('/login')
  await page.locator('input[type="text"]').fill('000000000000')
  await page.getByRole('button', { name: /Войти через eGov/i }).click()
  await page.waitForURL(/\/admin/, { timeout: 15_000 })

  // 2. Go to create-new-service page (AI builder lives here)
  await page.goto('/admin/services/new?e2e=1')
  await expect(page.getByText('AI-конструктор формы')).toBeVisible({ timeout: 10_000 })

  // 3. Confirm the default prompt is preloaded (target the AI block by placeholder)
  const promptArea = page.locator('textarea[placeholder*="льготный кредит"]')
  await expect(promptArea).toBeVisible({ timeout: 10_000 })
  const promptText = await promptArea.inputValue()
  console.log('PROMPT_PRELOADED_LEN=', promptText.length)
  console.log('PROMPT_PRELOADED_HEAD=', promptText.slice(0, 120))

  // 4. Click the "Сгенерировать форму через AI" button
  const genBtn = page.getByRole('button', { name: /Сгенерировать форму через AI/i })
  await expect(genBtn).toBeVisible()
  await genBtn.click()

  // 5. Wait for: success ("сек с AI") OR toast (.toast-error) OR streaming indicator vanishing
  const ok = page.getByText(/сек с AI/i).first()
  const errToast = page.locator('.toast-error').first()
  const streaming = page.getByText(/Claude генерирует форму/i).first()

  const result = await Promise.race([
    ok.waitFor({ state: 'visible', timeout: 120_000 }).then(() => 'ok' as const).catch(() => null),
    errToast.waitFor({ state: 'visible', timeout: 120_000 }).then(() => 'err' as const).catch(() => null),
    page.waitForTimeout(120_000).then(() => 'timeout' as const),
  ])

  // Capture error toast text if any
  let toastText = ''
  try { toastText = await errToast.innerText({ timeout: 500 }) } catch {}
  console.log('TOAST_TEXT=', toastText)
  console.log('STREAMING_VISIBLE_AT_END=', await streaming.isVisible().catch(() => false))

  // 6. Take a screenshot regardless
  await page.screenshot({ path: 'test-results/ai-leasing-final.png', fullPage: true })

  console.log('OUTCOME=', result)
  console.log('SSE_BYTES=', sseEvents.len, 'DONE=', sseEvents.done, 'ERR=', sseEvents.error ?? 'none')
  console.log('SSE_TAIL_LAST_2KB:\n', sseEvents.tail)
  console.log('CONSOLE_LOGS:\n', logs.slice(-30).join('\n'))
  console.log('PAGE_ERRORS:\n', errors.join('\n'))

  // Soft assertion — we want diagnostics either way, but mark as failed if not ok.
  expect(result, 'AI form generation should reach the success state').toBe('ok')
})
