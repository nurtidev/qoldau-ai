import { test, expect } from '@playwright/test'

test.describe('Каталог услуг', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services')
  })

  test('загружает и отображает карточки услуг', async ({ page }) => {
    // Ждём пока пропадут скелетоны и появятся реальные карточки (cold start бэкенда)
    await expect(page.getByText(/мер поддержки/i)).toBeVisible({ timeout: 20_000 })
    // Ищем ссылки на услуги (карточки — это <a> с классом card)
    const serviceLinks = page.locator('a.card')
    await expect(serviceLinks.first()).toBeVisible({ timeout: 20_000 })
    expect(await serviceLinks.count()).toBeGreaterThan(3)
  })

  test('показывает счётчик найденных услуг', async ({ page }) => {
    await expect(page.getByText(/мер поддержки/i)).toBeVisible({ timeout: 20_000 })
  })

  test('поиск фильтрует результаты', async ({ page }) => {
    await expect(page.locator('a.card').first()).toBeVisible({ timeout: 20_000 })
    const search = page.getByPlaceholder(/поиск по названию/i)
    await search.fill('лизинг')
    // должны остаться только услуги с "лизинг"
    await expect(page.getByText(/лизинг/i).first()).toBeVisible()
    await expect(page.getByText('Seed Money — грант для стартапов (Astana Hub)')).not.toBeVisible()
  })

  test('поиск без результатов показывает заглушку', async ({ page }) => {
    await expect(page.locator('a.card').first()).toBeVisible({ timeout: 20_000 })
    await page.getByPlaceholder(/поиск по названию/i).fill('xyzxyz999невозможныйзапрос')
    await expect(page.getByText('Ничего не найдено')).toBeVisible()
  })

  test('фильтр по направлению "Гранты" работает', async ({ page }) => {
    await expect(page.locator('a.card').first()).toBeVisible({ timeout: 20_000 })
    // Кликаем именно на label внутри сайдбара (aside)
    await page.locator('aside').getByText('Гранты').click()
    await expect(page.getByText('Seed Money — грант для стартапов (Astana Hub)')).toBeVisible({ timeout: 10_000 })
  })

  test('кнопка сброса фильтров появляется при активном фильтре', async ({ page }) => {
    await expect(page.locator('a.card').first()).toBeVisible({ timeout: 20_000 })
    await page.locator('aside').getByText('Гранты').click()
    await expect(page.getByRole('button', { name: /сбросить/i })).toBeVisible()
  })

  test('клик на карточку услуги открывает детальную страницу', async ({ page }) => {
    await expect(page.locator('a.card').first()).toBeVisible({ timeout: 20_000 })
    await page.locator('a.card').first().click()
    await expect(page).toHaveURL(/\/services\/[a-f0-9-]+/)
  })
})
