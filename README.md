# Qoldau AI — Единый портал поддержки бизнеса

> **Хакатон:** Astana Hub × АО «НИХ «Байтерек» · дедлайн 04.05.2026  
> **Demo Day:** 15.05.2026, Astana Hub

Платформа-конструктор для автоматизации 70+ мер государственной поддержки бизнеса.  
Ключевое требование выполнено: все услуги реализованы через **no-code конструктор форм** (FormSchema в PostgreSQL JSONB), а не через хардкод.

---

## Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Тестовые аккаунты](#тестовые-аккаунты)
3. [Сценарий демонстрации для жюри](#сценарий-демонстрации-для-жюри)
4. [Контрольный кейс — Лизинг](#контрольный-кейс--лизинг)
5. [Архитектура](#архитектура)
6. [FormSchema — ключевая концепция](#formschema--ключевая-концепция)
7. [API](#api)
8. [Разработка](#разработка)

---

## Быстрый старт

**Требования:** Docker Desktop, Make

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd qoldau-ai

# 2. Создать .env
cp .env.example .env
# Открыть .env и вставить ANTHROPIC_API_KEY

# 3. Запустить
make up
```

| Сервис | URL |
|--------|-----|
| Фронтенд | http://localhost:3000 |
| Backend API | http://localhost:8080 |

> Миграции и seed-данные применяются автоматически при первом запуске.

---

## Тестовые аккаунты

| Роль | ИИН | Имя (любое) | Доступ |
|------|-----|-------------|--------|
| **Администратор** | `000000000000` | Администратор | Конструктор форм, все заявки, аналитика |
| **Пользователь** | любые 12 цифр | любое | Личный кабинет, подача заявок |

Авторизация без пароля — имитация входа через eGov (mock).

---

## Сценарий демонстрации для жюри

### Путь 1 — Администратор (конструктор форм)

1. Открыть http://localhost:3000 → войти с ИИН `000000000000`
2. Перейти в **Администрирование → Услуги**
3. Нажать **«Создать услугу»**
4. Ввести название и описание → нажать **«Сгенерировать форму через AI»**  
   _(Claude API создаёт form_schema по описанию за ~5 секунд)_
5. Отредактировать поля вручную в визуальном конструкторе: добавить/удалить поля, настроить условия видимости шагов, формулы расчёта
6. Опубликовать услугу → она сразу появляется на портале

### Путь 2 — Пользователь (подача заявки)

1. Открыть http://localhost:3000 → войти с любым ИИН
2. Перейти в **Каталог услуг** → выбрать «Приобретение авиатранспорта и вагонов в лизинг»
3. Нажать **«Подать заявку»**
4. Форма автоматически заполняет ИИН/БИН/название организации из mock eGov
5. Ввести количество и стоимость единиц → поля «Общая стоимость», «Сумма лизинга», «Ежемесячный платёж» пересчитываются **в реальном времени**
6. Шаг «Документы» появляется **условно** (только для МСБ — условие по типу организации)
7. Загрузить документы → отправить заявку

### Путь 3 — Администратор (обработка заявок)

1. Войти с ИИН `000000000000`
2. **Администрирование → Заявки** — список всех поданных заявок
3. Открыть заявку → изменить статус (На рассмотрении → Одобрена / Отклонена)
4. Пользователь получает уведомление в личном кабинете

---

## Контрольный кейс — Лизинг

Услуга **«Приобретение авиатранспорта и вагонов в лизинг»** предустановлена в базе данных через seed-миграцию ([backend/migrations/001_init.up.sql](backend/migrations/001_init.up.sql)).

### Доказательство no-code реализации

Услуга хранится в `services.form_schema` (PostgreSQL JSONB), а не в коде:

```json
{
  "steps": [
    {
      "id": "step_1",
      "title": "Информация о компании",
      "fields": [
        {"id":"field_1","type":"text","label":"БИН организации","prefill_from":"egov.iin","required":true},
        {"id":"field_4","type":"select","label":"Предмет лизинга","options":["Авиатранспорт","Вагоны"],"required":true},
        {"id":"field_5","type":"number","label":"Количество единиц","required":true},
        {"id":"field_6","type":"number","label":"Стоимость единицы (тенге)","required":true,"mask":"currency"},
        {"id":"field_7","type":"calculated","label":"Общая стоимость","formula":"field_5 * field_6","readonly":true},
        {"id":"field_8","type":"calculated","label":"Сумма лизинга (80%)","formula":"field_7 * 0.8","readonly":true},
        {"id":"field_9","type":"select","label":"Срок лизинга (месяцев)","options":["12","24","36","48","60"],"required":true},
        {"id":"field_10","type":"calculated","label":"Ежемесячный платёж","formula":"field_8 / field_9","readonly":true}
      ]
    },
    {
      "id": "step_2",
      "title": "Документы",
      "condition": {"field_id":"field_3","operator":"equals","value":"МСБ"},
      "fields": [
        {"id":"field_11","type":"file","label":"Финансовая отчётность за 2 года","accept":".pdf","required":true},
        {"id":"field_12","type":"file","label":"Бизнес-план","accept":".pdf","required":true}
      ]
    }
  ]
}
```

Вся бизнес-логика — в данных. Код FormRenderer одинаков для всех 70+ услуг.

### Что проверить для подтверждения

```bash
# Убедиться, что услуга хранится в БД как JSONB, не в коде
docker exec qoldau_postgres psql -U qoldau -d qoldau \
  -c "SELECT title, form_schema->>'steps' IS NOT NULL as has_schema FROM services LIMIT 5;"
```

---

## Архитектура

```
┌─────────────────────────────┐
│        Пользователь         │
└──────────────┬──────────────┘
               │ HTTP
┌──────────────▼──────────────┐
│   React 18 + TypeScript     │
│   Vite · TanStack Query v5  │
│   Zustand · Axios           │
│                             │
│  FormRenderer  ←── FormSchema (JSONB)
│  FormBuilder (конструктор)  │
└──────────────┬──────────────┘
               │ /api  (nginx proxy)
┌──────────────▼──────────────┐
│   Go 1.22 + chi router      │
│   JWT Auth · sqlx           │
│   Anthropic Claude API      │
└──────┬──────────────┬───────┘
       │              │
┌──────▼──────┐ ┌─────▼──────┐
│ PostgreSQL  │ │  Redis 7   │
│ 16 (JSONB)  │ │  (сессии)  │
└─────────────┘ └────────────┘
```

### Тиражируемость на 70+ услуг

| Компонент | Один раз написан | Данные в БД |
|-----------|-----------------|-------------|
| FormRenderer | ✅ Один рендерер | form_schema |
| FormBuilder | ✅ Один конструктор | — |
| API /applications | ✅ Один эндпоинт | form_data |
| Бизнес-логика услуги | — | form_schema.steps[].condition |
| Расчёты | — | form_schema fields[].formula |
| Список полей | — | form_schema fields[] |

Добавление новой услуги = создание записи в таблице `services` с нужным `form_schema`. Деплой не требуется.

---

## FormSchema — ключевая концепция

Структура `form_schema` (PostgreSQL JSONB):

```typescript
interface FormSchema {
  steps: FormStep[]
}

interface FormStep {
  id: string
  title: string
  fields: FormField[]
  condition?: {          // условная видимость шага
    field_id: string
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than'
    value: string
  }
}

interface FormField {
  id: string
  type: 'text' | 'textarea' | 'number' | 'currency' | 'select' | 'multiselect'
      | 'date' | 'file' | 'calculated' | 'checkbox' | 'radio'
  label: string
  required?: boolean
  options?: string[]       // для select/multiselect/radio
  formula?: string         // для calculated: JS-выражение с id полей
  readonly?: boolean
  accept?: string          // для file: '.pdf,.xlsx'
  prefill_from?: string    // 'egov.iin' | 'egov.org_name' | 'egov.bin' | ...
  condition?: { ... }      // условная видимость конкретного поля
  mask?: 'currency' | 'percent'
}
```

### Возможности FormRenderer

- **Пошаговая форма** (stepper) — произвольное количество шагов
- **Calculated поля** — формулы вычисляются в реальном времени при изменении зависимых полей
- **Conditions** — шаги и поля показываются/скрываются по значениям других полей
- **prefill_from** — автозаполнение из mock eGov API при открытии формы
- **Валидация** — `required`, типы полей, маски ввода
- **Загрузка файлов** — с фильтрацией по расширению

---

## API

| Метод | Путь | Роль | Описание |
|-------|------|------|----------|
| POST | `/api/auth/login` | — | Вход по ИИН |
| GET | `/api/auth/me` | user | Текущий пользователь |
| GET | `/api/services` | public | Список опубликованных услуг |
| POST | `/api/services` | admin/author | Создать услугу |
| PUT | `/api/services/:id` | admin/author | Обновить услугу |
| DELETE | `/api/services/:id` | admin | Удалить услугу |
| POST | `/api/services/:id/publish` | admin | Опубликовать |
| **POST** | **`/api/ai/generate-form`** | user | **AI-генерация form_schema** |
| POST | `/api/applications` | user | Подать заявку |
| GET | `/api/applications` | user | Мои заявки |
| PUT | `/api/applications/:id/status` | admin | Изменить статус заявки |
| POST | `/api/documents` | user | Загрузить документ |
| GET | `/api/documents` | user | Мои документы |
| GET | `/api/notifications` | user | Уведомления |
| PUT | `/api/notifications/:id/read` | user | Отметить прочитанным |
| GET | `/api/mock/egov/:iin` | — | Mock eGov: данные по ИИН |
| GET | `/api/analytics/summary` | admin | Сводная аналитика |

### Пример: AI-генерация формы

```bash
curl -X POST http://localhost:8080/api/ai/generate-form \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"description": "Грант на цифровизацию МСБ до 5 млн тенге, нужны документы о деятельности"}'
```

Ответ — готовый `form_schema` JSON, который сразу можно сохранить как услугу.

### Пример: Mock eGov

```bash
curl http://localhost:8080/api/mock/egov/123456789012
# → {"iin":"123456789012","full_name":"Иванов Иван","org_name":"ТОО «Пример»","bin":"123456789012","address":"г. Алматы","phone":"+7 777 000 0000"}
```

---

## Разработка

```bash
make up            # запустить всё через Docker
make down          # остановить
make logs          # стриминг логов всех сервисов
make infra         # только postgres + redis (для локальной разработки)
make backend-dev   # go run ./cmd/server (порт 8080)
make frontend-dev  # vite dev (порт 5173)
make migrate       # применить миграции вручную
make install-frontend  # npm install
```

### TypeScript проверка

```bash
cd frontend && npx tsc --noEmit
```

### Структура проекта

```
qoldau-ai/
├── backend/
│   ├── cmd/server/main.go          # точка входа, chi роутер, DI
│   ├── internal/
│   │   ├── config/                 # env-переменные
│   │   ├── db/                     # postgres + redis + миграции
│   │   ├── handlers/               # auth, services, applications, ai, mock, ...
│   │   └── middleware/             # JWT, RequireRole
│   └── migrations/
│       ├── 001_init.up.sql         # схема БД + seed (admin + контрольный кейс)
│       └── 002_seed_services.up.sql # дополнительные услуги всех категорий
├── frontend/
│   └── src/
│       ├── api/client.ts           # axios-клиенты для всех доменов
│       ├── store/auth.ts           # zustand + localStorage
│       ├── types/index.ts          # TypeScript-типы (FormSchema, Service, ...)
│       ├── components/
│       │   ├── FormRenderer/       # рендерит FormSchema → пошаговую форму
│       │   └── Layout/             # Header, Footer, AdminTopBar
│       └── pages/
│           ├── admin/              # конструктор, список услуг, заявки, аналитика
│           └── cabinet/            # личный кабинет, подача заявок, документы
├── docker-compose.yml
└── Makefile
```

### Стек

| Слой | Технология |
|------|-----------|
| Frontend | React 18, TypeScript, Vite, TanStack Query v5, Zustand |
| Backend | Go 1.22, chi, sqlx, golang-migrate |
| База данных | PostgreSQL 16 (JSONB для form_schema) |
| Кэш | Redis 7 |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Auth | JWT, IIN-based (mock eGov) |
| Deploy | Docker Compose, nginx (SPA + API proxy) |
