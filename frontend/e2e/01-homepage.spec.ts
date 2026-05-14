import { test, expect } from '@playwright/test'

test.describe('Главная страница', () => {
  test('загружается и показывает hero-секцию', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('казахстанского бизнеса')).toBeVisible()
  })

  test('показывает поисковую строку в hero', async ({ page }) => {
    await page.goto('/')
    const search = page.getByPlaceholder(/например|кредит|грант/i).first()
    await expect(search).toBeVisible()
  })

  test('показывает карточки направлений', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Финансирование').first()).toBeVisible()
    await expect(page.getByText('Гарантии').first()).toBeVisible()
    await expect(page.getByText('Экспорт').first()).toBeVisible()
  })

  test('клик на направление открывает каталог с фильтром', async ({ page }) => {
    await page.goto('/')
    // DirectionCard — именно ссылки (a.card) с текстом направления, не кнопки screener
    await page.locator('a.card').filter({ hasText: 'Финансирование' }).first().click()
    await expect(page).toHaveURL(/\/services/)
  })

  test('ссылка "Услуги" в header работает', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /услуги/i }).first().click()
    await expect(page).toHaveURL(/\/services/)
  })

  test('показывает блок последних новостей', async ({ page }) => {
    await page.goto('/')
    // Статичный блок новостей на главной
    await expect(page.getByText(/апр\.|2026/i).first()).toBeVisible()
  })
})
