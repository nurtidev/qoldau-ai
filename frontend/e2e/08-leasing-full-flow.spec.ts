import { test, expect, type Page } from '@playwright/test'

/**
 * E2E полного цикла лизинга:
 *   1. Пользователь авторизуется → проходит eGov + КГД prefill → заполняет 5-шаговую форму этапа 1
 *      (включая DSCR/IRR/казсодержание + согласия ПКБ/ПДн/санкции/госорганы) → подаёт.
 *      Шаг "Документы" — stage 2 (двухэтапная заявка), в первичную подачу не входит:
 *      документы запрашиваются админом позже, в личном кабинете.
 *   2. Заявка появляется в личном кабинете
 *   3. Админ авторизуется → видит заявку → меняет статус submitted → in_review → approved
 *   4. Пользователь видит уведомление и новый статус
 */

const USER_IIN  = '123456789012'
const ADMIN_IIN = '000000000000'

async function loginAs(page: Page, iin: string, expectURL: RegExp) {
  await page.goto('/login')
  const input = page.getByPlaceholder('123456789012')
  await input.waitFor({ timeout: 10_000 })
  await input.fill(iin)
  await page.getByRole('button', { name: /войти через egov/i }).click()
  await page.waitForURL(expectURL, { timeout: 15_000 })
}

/**
 * Находит услугу «Приобретение авиатранспорта и вагонов в лизинг» через публичный API
 * и возвращает её ID. Это надёжнее, чем хардкод UUID.
 */
async function getLeasingId(page: Page): Promise<string> {
  const res = await page.request.get('/api/services')
  const services = await res.json()
  const leasing = services.find((s: { title: string; org_name: string }) =>
    s.title.toLowerCase().includes('авиатранспорта')
  )
  if (!leasing) throw new Error('Лизинговая услуга не найдена')
  return leasing.id
}

/** Ждём пока FormRenderer отрисует первый шаг (после eGov + КГД). */
async function waitForForm(page: Page) {
  await expect(page.locator('select, input[type="text"]').first()).toBeVisible({ timeout: 20_000 })
}

/** Заполнить number/text input по подписи (label). */
async function fillByLabel(page: Page, label: RegExp | string, value: string) {
  const lab = page.locator('label').filter({ hasText: label }).first()
  const wrapper = lab.locator('..').first()
  const input = wrapper.locator('input, textarea').first()
  await input.waitFor({ timeout: 5_000 })
  await input.fill(value)
}

async function selectByLabel(page: Page, label: RegExp | string, value: string) {
  const lab = page.locator('label').filter({ hasText: label }).first()
  const wrapper = lab.locator('..').first()
  await wrapper.locator('select').first().selectOption(value)
}

async function checkByLabel(page: Page, label: RegExp | string) {
  const lab = page.locator('label').filter({ hasText: label }).first()
  const wrapper = lab.locator('..').first()
  await wrapper.locator('input[type="checkbox"]').first().check()
}

async function clickNext(page: Page) {
  // На последнем шаге кнопка превращается в "К проверке"
  const next = page.getByRole('button', { name: /Далее|К проверке/i }).first()
  await next.click()
  await page.waitForTimeout(300)
}

/**
 * Проходит модалку подписания ЭЦП (мок NCALayer, см. ECPSignModal), которая
 * теперь открывается вместо мгновенной отправки по клику «Подать заявку».
 * Страница должна быть открыта с ?e2e=1, чтобы стадии анимации были короткими.
 */
async function signECP(page: Page) {
  await expect(page.getByText('Подписание ЭЦП')).toBeVisible({ timeout: 5_000 })
  await page.getByPlaceholder('Введите пароль').fill('e2e-test-pass')
  await page.getByRole('button', { name: /^подписать$/i }).click()
  await expect(page.getByText('Подписание ЭЦП')).not.toBeVisible({ timeout: 15_000 })
}

test.describe('Лизинг — полный сценарий (пользователь → админ)', () => {
  test.setTimeout(120_000)

  test('user fills 5-step (stage 1) leasing form, admin moves it through statuses', async ({ browser }) => {
    // ── PART 1: USER ──────────────────────────────────────────────────────
    const userCtx = await browser.newContext()
    const userPage = await userCtx.newPage()

    const leasingId = await getLeasingId(userPage)

    await loginAs(userPage, USER_IIN, /\/cabinet/)
    await userPage.goto(`/cabinet/apply/${leasingId}?e2e=1`)
    await waitForForm(userPage)

    // Проверим, что КГД-карточка появилась (или хотя бы попыталась)
    await expect(userPage.getByText(/налоговую историю|налоговая история|КГД/i).first()).toBeVisible({ timeout: 15_000 })

    // ─ Шаг 1: Информация о компании ─
    await selectByLabel(userPage, /Тип организации/i, 'МСБ')
    await fillByLabel  (userPage, /^Основной ОКЭД/i, '49.41')
    await fillByLabel  (userPage, /Дата регистрации компании/i, '2020-03-12')
    await fillByLabel  (userPage, /Среднегодовая выручка/i, '180000000')
    await fillByLabel  (userPage, /Средняя численность сотрудников/i, '24')
    await clickNext(userPage)

    // ─ Шаг 2: Предмет лизинга + казсодержание ─
    await selectByLabel(userPage, /^Предмет лизинга/i, 'Вагоны')
    await fillByLabel  (userPage, /Наименование \/ модель/i, 'Вагон-цистерна модель 15-1547')
    await fillByLabel  (userPage, /Количество единиц/i, '10')
    await fillByLabel  (userPage, /Стоимость единицы/i, '85000000')
    await selectByLabel(userPage, /Страна происхождения/i, 'Казахстан')
    await fillByLabel  (userPage, /казахстанского содержания/i, '65')
    await fillByLabel  (userPage, /Поставщик/i, 'АО «Қазақстан Темір Жолы — Грузовые перевозки»')
    await fillByLabel  (userPage, /Страна нахождения поставщика/i, 'Казахстан')
    await clickNext(userPage)

    // ─ Шаг 3: Финмодель — DSCR/IRR/equity ─
    await fillByLabel  (userPage, /Авансовый взнос/i, '25')
    await selectByLabel(userPage, /Срок лизинга/i, '60')
    await fillByLabel  (userPage, /Ожидаемая годовая ставка/i, '15')
    await fillByLabel  (userPage, /Чистая прибыль за последний год/i, '120000000')
    await fillByLabel  (userPage, /Прогнозная IRR/i, '18')

    // Проверим что calculated-поля посчитались
    await expect(userPage.getByText(/DSCR/i).first()).toBeVisible()
    await expect(userPage.getByText(/Доля собственного участия/i)).toBeVisible()

    await clickNext(userPage)

    // ─ Шаг 4: Обеспечение и оценка ─
    await selectByLabel(userPage, /Аккредитованный оценщик/i, 'ТОО «Центр Оценки Активов»')
    await fillByLabel  (userPage, /Стоимость предмета по независимой оценке/i, '880000000')
    // radio: "Нет" для доп. обеспечения
    await userPage.locator('label').filter({ hasText: 'Нет' }).first().click()
    await selectByLabel(userPage, /Страховая компания/i, 'АО «Евразия»')
    await clickNext(userPage)

    // ─ Шаг 5: KYC / согласия ─
    await fillByLabel(userPage, /ФИО бенефициарного владельца/i, 'Иванов Иван Иванович')
    await fillByLabel(userPage, /ИИН бенефициара/i, USER_IIN)
    await fillByLabel(userPage, /Доля участия бенефициара/i, '100')
    await fillByLabel(userPage, /Источник происхождения средств/i, 'Собственные средства, реинвестиция прибыли за 2024–2025')

    // 4 чекбокса согласий — это ключевая часть демо
    await checkByLabel(userPage, /Согласие на запрос кредитной истории/i)
    await checkByLabel(userPage, /Согласие на обработку персональных данных/i)
    await checkByLabel(userPage, /Декларация о санкционных рисках/i)
    await checkByLabel(userPage, /Согласие на запрос данных в госорганах/i)

    // Шаг "Документы" помечен как stage 2 и в первичную подачу не входит (см. migration
    // 010_two_stage) — админ запросит их позже в личном кабинете. clickNext сразу приводит
    // на финальный шаг "Проверка".
    await clickNext(userPage)

    // На шаге "Проверка" — карточка предварительной оценки (балл/бэнд по данным eGov+КГД)
    await expect(userPage.getByText('Предварительная оценка заявителя')).toBeVisible({ timeout: 10_000 })
    await expect(userPage.getByText('из 100')).toBeVisible()
    await expect(userPage.getByText(/Высокая надёжность|Хорошая надёжность|Средний риск|Высокий риск/)).toBeVisible()

    // Подача — открывается модалка подписания ЭЦП вместо мгновенной отправки
    const submitBtn = userPage.getByRole('button', { name: /^подать заявку$/i })
    await submitBtn.waitFor({ timeout: 10_000 })
    await submitBtn.click()
    await signECP(userPage)

    // Должны быть редирект на /cabinet
    await userPage.waitForURL(/\/cabinet(\/|$)/, { timeout: 20_000 })

    // Карточка заявки появилась
    await expect(userPage.getByText(/авиатранспорта/i).first()).toBeVisible({ timeout: 10_000 })

    // Заявка только что подана (статус submitted) — в списке кабинета виден SLA-бейдж срока рассмотрения
    const leasingRow = userPage.locator('tr').filter({ hasText: /авиатранспорта/i }).first()
    await expect(leasingRow.getByText(/дн\.|день|дня|просроч/i).first()).toBeVisible({ timeout: 10_000 })

    // Извлечём app_id для проверки админом
    const apps = await userPage.request.get('/api/applications', {
      headers: { Authorization: `Bearer ${await userPage.evaluate(() => localStorage.getItem('token'))}` },
    }).then(r => r.json())
    const myApp = apps.find((a: { service_id: string }) => a.service_id === leasingId)
    expect(myApp).toBeTruthy()
    expect(myApp.status).toBe('submitted')

    await userCtx.close()

    // ── PART 2: ADMIN ─────────────────────────────────────────────────────
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()

    await loginAs(adminPage, ADMIN_IIN, /\/admin/)
    await adminPage.goto('/admin/applications')

    // Заявка видна в списке
    const idBadge = myApp.id.slice(0, 8).toUpperCase()
    await expect(adminPage.getByText(idBadge).first()).toBeVisible({ timeout: 10_000 })

    // Найдём ряд этой заявки и его select
    const row = adminPage.locator('tr').filter({ hasText: idBadge })
    await expect(row).toBeVisible()
    const statusSelect = row.locator('select')

    // Текущий статус — Подана. Переводим в "На рассмотрении"
    await statusSelect.selectOption('in_review')
    await expect(adminPage.getByText(/Статус обновлён/i)).toBeVisible({ timeout: 5_000 })

    // Проверим через API
    const adminToken = await adminPage.evaluate(() => localStorage.getItem('token'))
    const afterReview = await adminPage.request.get(`/api/applications/${myApp.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(r => r.json())
    expect(afterReview.status).toBe('in_review')

    // Одобряем
    await statusSelect.selectOption('approved')
    await expect(adminPage.getByText(/Статус обновлён/i).last()).toBeVisible({ timeout: 5_000 })

    const final = await adminPage.request.get(`/api/applications/${myApp.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(r => r.json())
    expect(final.status).toBe('approved')

    await adminCtx.close()
  })
})
