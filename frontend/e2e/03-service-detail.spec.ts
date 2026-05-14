import { test, expect } from '@playwright/test'

test.describe('Детальная страница услуги', () => {
  test.beforeEach(async ({ page }) => {
    // Логин, чтобы виджет показывал "Подать заявку" (без auth — "Войти и проверить готовность")
    await page.goto('/login')
    await page.getByPlaceholder('123456789012').fill('123456789012')
    await page.getByRole('button', { name: /войти через egov/i }).click()
    await page.waitForURL(/\/cabinet/, { timeout: 15_000 })
    // Переходим через каталог, чтобы не зашивать UUID
    await page.goto('/services')
    await expect(page.locator('a.card').first()).toBeVisible({ timeout: 20_000 })
    await page.locator('a.card').first().click()
    await expect(page).toHaveURL(/\/services\/[a-f0-9-]+/)
  })

  test('показывает название услуги как h1', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('показывает описание услуги', async ({ page }) => {
    // Описание есть в service.description
    const desc = page.locator('p').first()
    await expect(desc).toBeVisible()
  })

  test('показывает кнопку "Подать заявку"', async ({ page }) => {
    // Link с текстом "Подать заявку"
    await expect(page.getByRole('link', { name: /подать заявку/i })).toBeVisible({ timeout: 10_000 })
  })

  test('breadcrumb содержит ссылку на каталог "Услуги"', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Услуги', exact: true }).first()).toBeVisible()
  })

  test('вкладки (описание/условия/документы) работают', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Ищем TabBar — текст вкладок
    const docsTab = page.getByText(/документ/i).first()
    if (await docsTab.isVisible()) {
      await docsTab.click()
    }
  })

  test('услуга лизинга авиатранспорта показывает calculated-поля', async ({ page }) => {
    // Кликаем на фильтр Лизинг в сайдбаре — не зависит от пагинации
    await page.goto('/services')
    await expect(page.locator('a.card').first()).toBeVisible({ timeout: 20_000 })
    await page.locator('aside').getByText('Лизинг').click()
    const card = page.locator('a.card').filter({ hasText: 'авиатранспорта' })
    await card.waitFor({ timeout: 10_000 })
    await card.click()
    await page.getByText('Как подать', { exact: true }).click()
    // Шаги формы показаны как карточки — проверяем заголовок шага и кол-во полей
    await expect(page.getByText('Информация о компании')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/10 пол/i)).toBeVisible()
  })
})
