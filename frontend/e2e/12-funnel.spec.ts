import { test, expect, type Page } from '@playwright/test'

/**
 * E2E воронки программы + drilldown + связка с калькулятором аудитории
 * (миграция 006).
 *
 * Сценарий жюри:
 *   1. Админ открывает услугу лизинга в конструкторе
 *   2. Нажимает «Аналитика» — видит воронку с явной просадкой на шаге 3
 *   3. Кликает на шаг — справа drilldown по полю «Запрашиваемая сумма лизинга»,
 *      медиана ~840 млн ₸, insight «лимит ниже потребности»
 *   4. Клик «Перенастроить аудиторию» — открывается AudienceDrawer с фильтрами
 *      и баннером откуда они пришли
 */

const ADMIN_IIN = '000000000000'

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('123456789012').fill(ADMIN_IIN)
  await page.getByRole('button', { name: /войти через egov/i }).click()
  await page.waitForURL(/\/admin/, { timeout: 15_000 })
}

async function getLeasingId(page: Page): Promise<string> {
  const res = await page.request.get('/api/services')
  const services = await res.json()
  const leasing = services.find((s: { title: string }) =>
    s.title.toLowerCase().includes('авиа') && s.title.toLowerCase().includes('лизинг'),
  )
  if (!leasing) throw new Error('Лизинговая услуга не найдена')
  return leasing.id
}

test.describe('Воронка программы + drilldown', () => {
  test('GET /api/services/:id/funnel возвращает реалистичную воронку для лизинга', async ({ request }) => {
    const adminLogin = await request.post('/api/auth/login', {
      data: { iin: ADMIN_IIN, full_name: 'Администратор' },
    })
    const { token } = await adminLogin.json()

    const services = await (await request.get('/api/services', {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    const leasing = services.find((s: { title: string }) =>
      s.title.toLowerCase().includes('авиа') && s.title.toLowerCase().includes('лизинг'),
    )

    const res = await request.get(`/api/services/${leasing.id}/funnel`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()

    // Funnel structure
    expect(data.funnel.length).toBeGreaterThanOrEqual(8) // views + started + 6 steps + submitted + approved
    expect(data.funnel[0].stage).toBe('views')
    expect(data.funnel[0].count).toBeGreaterThan(500)
    expect(data.funnel.at(-1)?.stage).toBe('approved')

    // Biggest drop should be on a form step (not views→started)
    expect(data.biggest_drop).toBeTruthy()
    expect(data.biggest_drop.stage).toMatch(/^step_/)
    expect(data.biggest_drop.abandoned_count).toBeGreaterThan(50)

    // Drilldown should identify the lease amount field with stats and insight
    expect(data.biggest_drop.top_fields).toBeTruthy()
    expect(data.biggest_drop.top_fields.length).toBeGreaterThan(0)

    const top = data.biggest_drop.top_fields[0]
    expect(top.field_label.toLowerCase()).toContain('лизинг')
    expect(top.stats.median).toBeGreaterThan(500_000_000)  // > 500 млн ₸
    expect(top.insight).toContain('лимит')
    expect(top.audience_fix).toBeTruthy()
    expect(top.audience_fix.min_revenue).toBeGreaterThan(0)
    expect(top.audience_fix.max_revenue).toBeGreaterThan(top.audience_fix.min_revenue)
  })

  test('drawer аналитики открывается из конструктора, виден counter просадки', async ({ page }) => {
    await loginAsAdmin(page)
    const leasingId = await getLeasingId(page)
    await page.goto(`/admin/services/${leasingId}/edit?e2e=1`)

    const analyticsBtn = page.locator('button[title="Воронка программы"]')
    await expect(analyticsBtn).toBeVisible({ timeout: 15_000 })
    await analyticsBtn.click()

    // Drawer header
    await expect(page.getByText(/воронка программы/i)).toBeVisible({ timeout: 5_000 })

    // Headline of biggest drop
    await expect(page.getByText(/заявок не дошли/i)).toBeVisible({ timeout: 10_000 })

    // Top field name appears in drilldown (at least once)
    await expect(page.getByText(/запрашиваемая сумма лизинга/i).first()).toBeVisible({ timeout: 5_000 })

    // Insight mentions limit
    await expect(page.getByText(/лимит ниже/i)).toBeVisible()

    // Audience fix CTA exists
    await expect(page.getByRole('button', { name: /перенастроить аудиторию/i })).toBeVisible()
  })

  test('клик «Перенастроить аудиторию» закрывает аналитику и открывает калькулятор с баннером', async ({ page }) => {
    await loginAsAdmin(page)
    const leasingId = await getLeasingId(page)
    await page.goto(`/admin/services/${leasingId}/edit?e2e=1`)

    await page.locator('button[title="Воронка программы"]').click()

    const fix = page.getByRole('button', { name: /перенастроить аудиторию/i })
    await expect(fix).toBeVisible({ timeout: 10_000 })
    await fix.click()

    // Audience drawer opened
    await expect(page.getByText(/калькулятор охвата/i)).toBeVisible({ timeout: 5_000 })
    // Banner explains source of pre-applied filters
    await expect(page.getByText(/анализ.* воронки/i)).toBeVisible()
  })
})
