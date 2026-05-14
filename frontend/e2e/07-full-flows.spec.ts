import { test, expect, type Page } from '@playwright/test'

const MICROCREDIT_ID = '5232e8aa-721e-400e-806a-7e625a9d5205'
const USER_IIN  = '123456789012'
const ADMIN_IIN = '000000000000'

async function loginAsUser(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('123456789012').fill(USER_IIN)
  await page.getByRole('button', { name: /войти через egov/i }).click()
  await page.waitForURL(/\/cabinet/, { timeout: 15_000 })
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('123456789012').fill(ADMIN_IIN)
  await page.getByRole('button', { name: /войти через egov/i }).click()
  await page.waitForURL(/\/admin/, { timeout: 15_000 })
}

// Ждём пока skeleton пропадёт и форма загрузится
async function waitForForm(page: Page) {
  // FormRenderer рендерится только после eGov-ответа (egovChecked=true)
  await expect(page.locator('select').first()).toBeVisible({ timeout: 12_000 })
}

// ─── Пользователь: полная подача заявки ──────────────────────────────────────

test.describe('Подача заявки — полный сценарий', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page)
  })

  test('eGov prefill заполняет ИИН автоматически', async ({ page }) => {
    await page.goto(`/cabinet/apply/${MICROCREDIT_ID}`)
    await waitForForm(page)

    // m1 = ИИН, prefill_from=egov.iin — должен быть заполнен автоматически
    const iinInput = page.locator('input[type="text"]').first()
    await expect(iinInput).toHaveValue(USER_IIN)
  })

  test('Шаг 1: заполнение обязательных полей и переход к шагу 2', async ({ page }) => {
    await page.goto(`/cabinet/apply/${MICROCREDIT_ID}`)
    await waitForForm(page)

    // m3: Статус (первый select)
    await page.locator('select').first().selectOption('Зарегистрированный ИП')
    // m4: Вид деятельности (второй select)
    await page.locator('select').nth(1).selectOption('Торговля')
    // m5: Чекбокс
    await page.locator('input[type="checkbox"]').first().check()

    await page.getByRole('button', { name: /далее/i }).click()

    // Шаг 2: появился number input (Запрашиваемая сумма)
    await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 8_000 })
  })

  test('Шаг 2: заполнение параметров займа и успешная отправка', async ({ page }) => {
    await page.goto(`/cabinet/apply/${MICROCREDIT_ID}`)
    await waitForForm(page)

    // --- Шаг 1 ---
    await page.locator('select').first().selectOption('Зарегистрированный ИП')
    await page.locator('select').nth(1).selectOption('Услуги')
    await page.locator('input[type="checkbox"]').first().check()
    await page.getByRole('button', { name: /далее/i }).click()

    // --- Шаг 2 ---
    // m6: Запрашиваемая сумма (number)
    const amountInput = page.locator('input[type="number"]').first()
    await amountInput.waitFor({ timeout: 8_000 })
    await amountInput.fill('5000000')

    // m7: Срок займа (select)
    await page.locator('select').first().selectOption('36 месяцев')

    // m8: Цель займа (textarea)
    await page.locator('textarea').first().fill('Закупка товаров для торговой точки на рынке')

    // Calculated поле должно обновиться (ежемесячный платёж)
    await expect(page.getByText(/ежемесячный платёж/i)).toBeVisible()

    // Отправка
    await page.getByRole('button', { name: /подать заявку/i }).click()
    await expect(page).toHaveURL(/\/cabinet/, { timeout: 15_000 })
  })

  test('Заявка появляется в личном кабинете после подачи', async ({ page }) => {
    await page.goto(`/cabinet/apply/${MICROCREDIT_ID}`)
    await waitForForm(page)

    await page.locator('select').first().selectOption('Планирую открыть ИП')
    await page.locator('select').nth(1).selectOption('Ремёсла')
    await page.locator('input[type="checkbox"]').first().check()
    await page.getByRole('button', { name: /далее/i }).click()

    await page.locator('input[type="number"]').first().waitFor({ timeout: 8_000 })
    await page.locator('input[type="number"]').first().fill('2000000')
    await page.locator('select').first().selectOption('24 месяца')
    await page.locator('textarea').first().fill('Открытие кофейни в торговом центре')
    await page.getByRole('button', { name: /подать заявку/i }).click()
    await page.waitForURL(/\/cabinet/, { timeout: 15_000 })

    // В дашборде должна появиться карточка заявки на эту услугу
    await expect(page.getByText(/Микрокредитование/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Валидация: нельзя перейти к шагу 2 с незаполненными полями', async ({ page }) => {
    await page.goto(`/cabinet/apply/${MICROCREDIT_ID}`)
    await waitForForm(page)

    // Не заполняем ничего — кликаем Далее
    await page.getByRole('button', { name: /далее/i }).click()

    // Ошибка валидации — остаёмся на шаге 1
    await expect(page.getByText(/обязательное поле/i).first()).toBeVisible({ timeout: 5_000 })
    // Number input шага 2 не появился
    await expect(page.locator('input[type="number"]')).not.toBeVisible()
  })
})

// ─── Администратор: создание услуги ──────────────────────────────────────────

test.describe('Администратор: создание новой услуги', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('Конструктор форм открывается и показывает холст', async ({ page }) => {
    await page.goto('/admin/services/new')
    // Поле названия — точный placeholder (не regex — иначе матчит и AI textarea)
    await expect(page.getByPlaceholder('Льготный кредит для МСБ', { exact: true })).toBeVisible({ timeout: 10_000 })
    // Дефолтный шаг на холсте
    await expect(page.getByText('Информация о компании').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Заполнение метаданных и сохранение черновика', async ({ page }) => {
    await page.goto('/admin/services/new')

    const titleInput = page.getByPlaceholder('Льготный кредит для МСБ', { exact: true })
    await titleInput.waitFor({ timeout: 10_000 })
    await titleInput.fill('Тестовая услуга E2E')

    // Категория — первый select в левой панели
    await page.locator('select').first().selectOption('Гранты')
    // Организация — второй select
    await page.locator('select').nth(1).selectOption({ index: 1 })

    // Описание
    await page.locator('textarea').first().fill('Тестовое описание для e2e-теста')

    // Сохранить черновик
    await page.getByRole('button', { name: /сохранить черновик/i }).click()

    // URL сменился с /new на реальный ID
    await expect(page).toHaveURL(/\/admin\/services\/[a-f0-9-]+\/edit$/, { timeout: 10_000 })
    await expect(page).not.toHaveURL(/\/new/)
  })

  test('Добавление текстового поля в шаг', async ({ page }) => {
    await page.goto('/admin/services/new')
    await page.getByPlaceholder('Льготный кредит для МСБ', { exact: true }).waitFor({ timeout: 10_000 })
    await page.getByPlaceholder('Льготный кредит для МСБ', { exact: true }).fill('Услуга с полем E2E')

    // Кнопка "Добавить поле"
    const addFieldBtn = page.getByRole('button', { name: 'Добавить поле' }).first()
    await addFieldBtn.waitFor({ timeout: 10_000 })
    await addFieldBtn.click()

    // Модалка выбора типа поля — выбираем "Текст"
    await expect(page.getByText('Выберите тип поля')).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /^Текст/ }).click()

    // Поле появилось на холсте
    await expect(page.getByText(/новое поле \(текст\)/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('Публикация услуги и проверка в каталоге', async ({ page }) => {
    await page.goto('/admin/services/new')
    await page.getByPlaceholder('Льготный кредит для МСБ', { exact: true }).waitFor({ timeout: 10_000 })
    await page.getByPlaceholder('Льготный кредит для МСБ', { exact: true }).fill('Тестовая публикация E2E')
    await page.locator('select').first().selectOption('Субсидии')
    await page.locator('select').nth(1).selectOption({ index: 1 })
    await page.locator('textarea').first().fill('Описание публикуемой услуги')

    // Публикуем
    await page.getByRole('button', { name: /опубликовать/i }).click()

    // URL сменился с /new
    await expect(page).toHaveURL(/\/admin\/services\/[a-f0-9-]+\/edit$/, { timeout: 10_000 })

    // Услуга появляется в публичном каталоге
    await page.goto('/services')
    await expect(page.getByText('Тестовая публикация E2E').first()).toBeVisible({ timeout: 15_000 })
  })

  test('Без названия — сохранение заблокировано', async ({ page }) => {
    await page.goto('/admin/services/new')
    await page.getByPlaceholder('Льготный кредит для МСБ', { exact: true }).waitFor({ timeout: 10_000 })

    // Не заполняем название — сразу сохраняем
    await page.getByRole('button', { name: /сохранить черновик/i }).click()

    // Остаёмся на /new
    await expect(page).toHaveURL(/\/new/, { timeout: 3_000 })
  })
})
