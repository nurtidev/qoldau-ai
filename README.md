# Qoldau AI — Единый портал поддержки бизнеса (ЕППБ)

> **Раунд:** tech task АО «НИХ «Байтерек» × Astana Hub · подача 12.07.2026 · финалисты 14.07.2026 · **Demo Day 16.07.2026** (alem.ai)
> **Прод:** https://frontend-production-c557.up.railway.app

Qoldau AI — портал, где **любая мера господдержки задаётся как форма в универсальном no-code конструкторе, а не пишется в коде**. Один движок форм + один конструктор + одна база данных обслуживают весь каталог мер холдинга — от лизинга подвижного состава до финансирования животноводства.

Ключевое требование ТЗ выполнено: услуги хранятся как данные (`services.form_schema` — JSONB в PostgreSQL) и рендерятся единым компонентом `FormRenderer`. Добавление новой меры — запись в таблицу или нажатие кнопки в конструкторе, без релиза кода.

> ⚠️ Источник истины по архитектуре — [ARCHITECTURE.md](ARCHITECTURE.md). Этот README — быстрый вход для жюри и разработчика.

---

## Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Тестовые аккаунты](#тестовые-аккаунты)
3. [Сценарий демонстрации для жюри](#сценарий-демонстрации-для-жюри)
4. [Два контрольных кейса ТЗ](#два-контрольных-кейса-тз)
5. [Двухэтапная подача заявки](#двухэтапная-подача-заявки)
6. [AI в продукте](#ai-в-продукте)
7. [Mock-интеграции](#mock-интеграции)
8. [Предоценка заявителя и SLA](#предоценка-заявителя-и-sla)
9. [Контент-платформа и админка](#контент-платформа-и-админка)
10. [Архитектура](#архитектура)
11. [FormSchema — ключевая концепция](#formschema--ключевая-концепция)
12. [API](#api)
13. [Разработка](#разработка)

---

## Быстрый старт

**Требования:** Docker Desktop, Make. Для AI-функций нужен `ANTHROPIC_API_KEY`.

```bash
git clone <repo-url>
cd qoldau-ai

cp .env.example .env      # вписать ANTHROPIC_API_KEY (JWT_SECRET опционален)

make up                   # postgres + redis + backend + frontend
```

Миграции и seed-данные (в т.ч. оба контрольных кейса) применяются автоматически при старте backend.

**Порты** (из `docker-compose.yml` и `Makefile`):

| Среда | Frontend | Backend API | PostgreSQL | Redis |
|-------|----------|-------------|------------|-------|
| Docker (`make up`) | http://localhost:3001 | http://localhost:8081 | `localhost:5433` | `localhost:6380` |
| Локальная разработка | 5173 (`make frontend-dev`) | 8080 (`make backend-dev`) | из `make infra` | из `make infra` |

В Docker frontend раздаётся через nginx и сам проксирует `/api` и `/uploads` на backend — в браузере достаточно `http://localhost:3001`. В локальной разработке Vite проксирует `/api` и `/uploads` → `http://localhost:8080`.

Быстрая проверка no-code-природы (услуги — данные, а не код):

```bash
docker exec qoldau_postgres psql -U qoldau -d qoldau \
  -c "SELECT title, jsonb_array_length(form_schema->'steps') AS steps FROM services ORDER BY title;"
```

---

## Тестовые аккаунты

Вход без пароля — имитация eGov IDP (JWT по паре `{iin, full_name, org_name?}`).

| Роль | ИИН | Доступ |
|------|-----|--------|
| **Администратор** | `000000000000` | Конструктор форм, все заявки, аналитика, контент, пользователи |
| **Заявитель** | любые другие 12 цифр | Каталог, подача заявок, личный кабинет |

Демо-ИИН для негативного агро-сценария (карантин по данным ИСЖ): `100000007777` — предоценка становится блокирующей.

---

## Сценарий демонстрации для жюри

Двусторонний путь (~4–5 минут), покрывающий все требования ТЗ.

### Часть 1 — Администратор дочки: собрать услугу в конструкторе

1. Вход с ИИН `000000000000` → **Администрирование → Услуги → Создать**.
2. Описать меру свободным текстом → **«Сгенерировать через AI»**. Claude (`claude-sonnet-4-6`, потоковая генерация) возвращает за один вызов метаданные (название, категория, орган-оператор, ставка/сумма/срок — из закрытых списков) и полную `form_schema` с шагами, полями, формулами, условиями и **разметкой этапов** (`stage 1` / `stage 2`).
3. Отредактировать в визуальном конструкторе: поля, формулы `calculated`, условную видимость, переключатель этапа на каждом шаге.
4. **Опубликовать** — услуга сразу на портале, без редеплоя.

> Оба контрольных кейса доступны как готовые пресеты AI-генератора — их можно воспроизвести на сцене.

### Часть 2 — Заявитель: пройти услугу в одном окне

5. Вход с любым другим ИИН. На главной — **скринер** (AI-подбор услуги по целям/отрасли/выручке, `/api/ai/pick-service`).
6. Страница услуги: **объяснение простым языком** (AI, SSE-стрим + кэш) и **авто-калькулятор**, порождённый из расчётных полей схемы.
7. **Подача:** пошаговая форма из `form_schema`, real-time пересчёт, условные шаги. Поля БИН/ИИН/организации **автозаполнены из mock eGov** (бейдж «из eGov»).
8. На шаге проверки: подтягиваются **КГД** (налоговая дисциплина) и для агро — **ИСЖ** (сверка поголовья); считается **предоценка A–D**; перед отправкой — **AI-ревью заявки** (`/api/ai/review-application`) на противоречия и незаполненное; подпись **ЭЦП** (mock NCALayer/НУЦ РК).

### Часть 3 — Дозапрос и решение (двухэтапность)

9. Админ (**Заявки**): видит ФИО заявителя, сумму, предоценку. Ставит статус **`docs_requested`** с сообщением, что донести → заявителю приходит уведомление.
10. Заявитель дозаполняет шаги `stage 2` (документы), подписывает **ЭЦП**, отправляет (`/api/applications/:id/stage2`). Данные **мёржатся** поверх первичных, статус → `in_review`.
11. Админ **одобряет** → заявитель получает уведомление.

---

## Два контрольных кейса ТЗ

ТЗ раунда даёт **две** контрольные услуги с bgov.kz — обе собраны средствами конструктора как многоэтапные (шаги документов помечены `stage 2`), а не захардкожены.

### Кейс 1 — «Приобретение авиатранспорта и вагонов в лизинг»
Оператор: **Фонд развития промышленности** (бывш. «БРК-Лизинг»). Аналог: `bgov.kz/ru/services/wagons_ind`.

- Засеян в [`001_init.up.sql`](backend/migrations/001_init.up.sql), развёрнут в полную 6-шаговую BRK-grade форму в [`003_realism_pack.up.sql`](backend/migrations/003_realism_pack.up.sql) (2-шаговый дубль удалён в [`007`](backend/migrations/007_cleanup_leasing_dup.up.sql)).
- 6 шагов, ~40 полей: компания/ОКЭД/выручка → предмет лизинга и **казсодержание** → финмодель (аванс, ставка, **DSCR**, **IRR**, собственное участие — расчётные) → обеспечение и оценка → **KYC/ПОД-ФТ** (бенефициар, согласия на ПКБ/ГКБ, ПДн, запрос в КГД/ЕНПФ) → **документы (stage 2)**.
- Этап 2 (шаг «Документы») вынесен в дозапрос миграцией [`010_two_stage.up.sql`](backend/migrations/010_two_stage.up.sql). Условия актуализированы в [`013`](backend/migrations/013_actualize_programs.up.sql): ставка от 12,6%, аванс от 20%, до 20 млрд ₸.

### Кейс 2 — «Агробизнес — развитие животноводства»
Оператор: **Аграрная кредитная корпорация (АКК)**. Аналог: `bgov.kz/ru/services/agroanimal2`.

- Засеян в [`011_agroanimal_control.up.sql`](backend/migrations/011_agroanimal_control.up.sql); условия/оператор актуализированы в [`013`](backend/migrations/013_actualize_programs.up.sql) (ставка 6%, до 5 млрд ₸).
- 6 шагов, ~30 полей, 3 расчётных: хозяйство (КХ/ТОО/СПК) → **направление животноводства** (вид скота — условная видимость полей) → параметры проекта → финмодель (льготная ставка, **субсидия части затрат** — расчётные поля) → обеспечение и ветсоответствие → **документы: ветзаключение и отчётность (stage 2)**.
- Вид скота питает mock-сверку с **ИСЖ МСХ РК** — расхождение заявленного поголовья с идентифицированным влияет на предоценку.

Оба кейса доступны как пресеты в AI-генераторе конструктора.

---

## Двухэтапная подача заявки

Центральное требование ТЗ — «многоэтапный сценарий: первичная подача + последующее предоставление расширенных данных». Реализовано без отдельной таблицы «доп. заявок»: одна запись `applications`, одна JSONB-колонка, слияние на бэкенде.

**Статусная модель** (`models.ApplicationStatus`): `draft → submitted → in_review → [docs_requested] → approved | rejected`.

Таблица `applications` несёт `stage SMALLINT` и `request_message TEXT` (миграция [`010_two_stage`](backend/migrations/010_two_stage.up.sql)); статус `docs_requested` добавлен в [`009`](backend/migrations/009_docs_requested_enum.up.sql).

Флоу ([`handlers/applications.go`](backend/internal/handlers/applications.go)):

1. **Первичная подача.** Заявитель проходит шаги `stage 1` → `POST /api/applications` создаёт запись со статусом `submitted`; `form_data` — только видимые на тот момент поля.
2. **Дозапрос.** Админ через `PUT /api/applications/:id/status` со `status=docs_requested` и `message` — хендлер атомарно пишет `request_message` и создаёт уведомление заявителю с этим текстом.
3. **Дозаполнение.** Заявитель видит `request_message` в кабинете, заполняет шаги `stage 2` и шлёт `POST /api/applications/:id/stage2`. `SubmitStage2` проверяет, что заявка в `docs_requested` и принадлежит заявителю, **мёржит** ключи stage 2 поверх `form_data`, переводит `stage → 2`, `status → in_review`.
4. Далее — `approved` / `rejected` с уведомлением.

---

## AI в продукте

Модель **`claude-sonnet-4-6`**, вызывается напрямую по HTTPS из Go ([`handlers/ai.go`](backend/internal/handlers/ai.go), [`handlers/ai_insights.go`](backend/internal/handlers/ai_insights.go)) — без промежуточного SDK. AI пронизывает и клиентский путь, и админку:

| Эндпоинт | Роль | Что делает |
|----------|------|-----------|
| `POST /api/ai/generate-form` | user | По описанию — метаданные услуги + полная `form_schema` + разметка этапов |
| `POST /api/ai/generate-form-stream` | user | То же потоково (SSE) — прогресс генерации в конструкторе |
| `POST /api/ai/explain-service` | public | Объяснение условий услуги простым языком (SSE-стрим + кэш по хэшу услуги) |
| `POST /api/ai/pick-service` | public | AI-подбор ТОП-3 услуг по ответам скринера на главной |
| `POST /api/ai/chat` | public | Сайтовый AI-консультант (плавающий виджет), SSE, знает каталог программ |
| `POST /api/ai/recommend` | user | Подбор 2–3 альтернатив под профиль (при отказе/блокирующих рисках) |
| `POST /api/ai/review-application` | user | Проверка заявки перед отправкой: противоречия, незаполненное, eligibility |
| `POST /api/ai/service-insights` | admin/author | AI-инсайты по накопленным данным (воронка/отказы/дозапросы) → что править в конструкторе; кэш с TTL |

Метаданные (`category`, `org_name`, ставка/сумма/срок) модель выбирает **строго из закрытых списков** в системном промпте — операторы только реальные (Даму, АКК, КазАгроФинанс, ФРП, ЭКА KazakhExport и др.). Промпт генератора отдельно инструктирует различать `stage 1` (первичная подача) и `stage 2` (дозапрос документов).

---

## Mock-интеграции

По ТЗ внешние интеграции реализованы как контролируемые заглушки ([`handlers/mock.go`](backend/internal/handlers/mock.go)) с чёткой границей замены. Данные детерминированы от ИИН/БИН — один заявитель всегда видит одни и те же цифры.

| Эндпоинт | Имитирует | Роль в демо |
|----------|-----------|-------------|
| `GET /api/mock/egov/:iin` | eGov (реестр ФЛ/ЮЛ) | Префилл ФИО/БИН/организации/адреса в форме |
| `GET /api/mock/kgd/:bin` | КГД (`cabinet.salyk.kz`) | Налоговый режим, выручка за 3 года, ФОТ, **задолженность**, реестр риска, ОКЭД → предоценка |
| `GET /api/mock/isz/:iin_or_bin` | ИСЖ МСХ РК | Поголовье по видам + идентификация + **карантин** → сверка в агро-кейсе, влияет на предоценку |
| `POST /api/mock/ecp/sign` | ЭЦП NCALayer / НУЦ РК | Подпись при подаче и на этапе 2: envelope с serial/owner/issuer/ГОСТ-алгоритмом |
| `POST /api/mock/eish/submit` | ЕИШ холдинга | Передача заявки в BPM дочки → фиктивный `external_id` |

Согласия на **ПКБ / ГКБ** (кредитная история) собираются в KYC-шаге лизинга; сам запрос в проде — по договору с бюро. ЭЦП, eGov IDP и ЕИШ имеют явный порт под боевую интеграцию без изменения `FormSchema`.

---

## Предоценка заявителя и SLA

**Предоценка** ([`frontend/src/lib/prescore.ts`](frontend/src/lib/prescore.ts)) — справочная оценка по mock eGov + КГД (не решение о выдаче, честная подпись в UI). Балл 0–100 по 5 факторам с весами:

| Фактор | Вес |
|--------|-----|
| Налоговая дисциплина (долги, реестр риска, нарушения) | 0.30 |
| Финансовая устойчивость (выручка + рост г/г) | 0.25 |
| Долговая нагрузка запроса (сумма / выручка) | 0.20 |
| Зрелость бизнеса (возраст + штат) | 0.15 |
| Формальные признаки (НДС, налоговый режим) | 0.10 |

Грейды: **A** ≥ 85, **B** ≥ 70, **C** ≥ 50, **D** < 50; предодобряемый лимит — доля годовой выручки по грейду. Для агро-кейса — пост-корректировка по ИСЖ: расхождение поголовья > 20% снижает балл, активный карантин — блокирующий стоп-фактор (грейд D). Снимок предоценки сохраняется в `form_data._prescore`.

**SLA** ([`frontend/src/lib/sla.ts`](frontend/src/lib/sla.ts)) — плашки сроков рассмотрения на статусах: `submitted` 5 дн., `in_review` 10 дн., `docs_requested` 10 дн. Состояния `ok / warning / overdue` считаются от `updated_at`.

---

## Контент-платформа и админка

Публичный контент вынесен из фронтенд-массивов в БД и **редактируется из админ-вкладки «Контент»** — портал администрируем без правки кода (миграции [`014`](backend/migrations/014_content_catalog.up.sql), [`016`](backend/migrations/016_news.up.sql)–[`018`](backend/migrations/018_service_faq.up.sql), [`020`](backend/migrations/020_knowledge_articles.up.sql)).

| Раздел | Таблица / роут | Публично | Правит |
|--------|----------------|----------|--------|
| Каталог аналитики дочек (`/analytics`) | `analytics_materials` · `/api/materials` | GET | admin/author |
| Карта проектов (`/projects-map`, Leaflet) | `map_projects` · `/api/map-projects` — **28 проектов** | GET | admin/author |
| Новости (`/news`) | `news` · `/api/news` | GET | admin/author |
| База знаний (`/knowledge`) | `knowledge_articles` · `/api/knowledge` | GET | admin/author |
| FAQ услуги (с голосованием) | `service_faq` · `/api/faq` | GET + `POST /:id/vote` | admin/author |
| «О холдинге» (цифры на главной) | `holding_stats` · `/api/holding-stats` | GET | admin/author (только value/label) |

Суммы карты и цифры холдинга откалиброваны по фактчек-аудиту ([`022`](backend/migrations/022_fact_audit_fixes.up.sql), [`023`](backend/migrations/023_map_projects_realistic.up.sql)): активы 15,91 трлн ₸ (30.06.2025), поддержка экономики за 2025 ≈ 9 трлн ₸, рейтинги Moody's Baa1 / Fitch BBB, единый контакт-центр 1408.

**Админ-панель** (`frontend/src/pages/admin/`):

- **Дашборд** — сводка по заявкам/услугам/пользователям.
- **Заявки** — очередь с ФИО заявителя, суммой, предоценкой; смена статуса и дозапрос (этап 2).
- **Услуги** — каталог + конструктор ([`ServiceFormPage.tsx`](frontend/src/pages/admin/ServiceFormPage.tsx)) с условиями программ, режимами «Аналитика» (воронка + drilldown) и «Аудитория» (охват + рассылка).
- **Пользователи** — список и назначение ролей.
- **Аналитика** — воронка от просмотра до одобрения, показатели качества.
- **Qoldau Voice** — roadmap-прототип AI-оценки качества **живых** консультаций (звонок/офис → транскрипция → чек-лист). Работает на статичных демо-данных, бэкенда нет — это макет будущего продукта.
- **Настройки**.

---

## Архитектура

```
             Заявитель / Администратор (браузер)
                          │
        React 18 + TS + Vite · TanStack Query v5 · Zustand · Axios
        FormRenderer ← FormSchema (JSONB) · ServiceFormPage (конструктор)
                          │  /api, SSE  (nginx / Vite proxy)
                          ▼
        Go 1.22 + chi · JWT · sqlx · golang-migrate
        auth · services · applications · documents · notifications ·
        ai · mock · analytics · audience · funnel · leads · content
              │                 │                  │
        ┌─────▼─────┐    ┌───────▼──────┐   ┌───────▼────────────┐
        │PostgreSQL │    │   Redis 7    │   │  Claude API         │
        │16 (JSONB) │    │ (кэш/сессии, │   │ (claude-sonnet-4-6) │
        └───────────┘    │  опционально)│   └─────────────────────┘
                         └──────────────┘   Mock: eGov · КГД · ИСЖ · ЭЦП · ЕИШ
```

**Стек:**

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite; TanStack Query v5, Zustand, Axios, React Router 6; `expr-eval` (безопасный расчёт формул), `leaflet` (карта), `react-joyride` (онбординг-тур конструктора) |
| Backend | Go 1.22, chi v5 (+cors), sqlx/lib/pq, golang-jwt v5, golang-migrate |
| БД | PostgreSQL 16 (JSONB для `form_schema` / `form_data` / `eligibility_rules`) |
| Кэш | Redis 7 (подключён, зарезервирован; сбой подключения только логируется) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`), прямой HTTPS |
| Auth | JWT, IIN-based, без пароля (mock eGov); роли `user / author / admin` |
| Deploy | Docker Compose; Railway (прод) |

**Тиражируемость.** `FormRenderer`, `ServiceFormPage` и `/api/applications` написаны один раз; бизнес-логика услуги (шаги, поля, формулы, условия, этапы) живёт в `form_schema`. Новая мера = строка в `services` или кнопка в конструкторе — без миграций и деплоя. Подход тиражируется на весь каталог мер поддержки холдинга.

**Границы (по ТЗ).** Портал не заменяет BPM дочек и единую CRM холдинга и не дублирует их BI — клиентский путь и конструктор в ЕППБ, скоринг и бэк-офис в системах дочек, аналитика дочек агрегируется каталогом ссылок.

---

## FormSchema — ключевая концепция

Вся логика форм — в `services.form_schema` (JSONB). Типы полей и структура ([`frontend/src/types/index.ts`](frontend/src/types/index.ts)):

```typescript
interface FormSchema { steps: FormStep[] }

interface FormStep {
  id: string
  title: string
  fields: FormField[]
  condition?: FormFieldCondition   // условная видимость шага
  stage?: number                   // 1 (или отсутствует) = первичная подача, 2 = дозапрос
}

interface FormField {
  id: string
  type: 'text' | 'textarea' | 'number' | 'currency' | 'select' | 'multiselect'
      | 'date' | 'file' | 'calculated' | 'checkbox' | 'radio'
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]               // select / multiselect / radio
  mask?: 'currency' | 'percent'
  formula?: string                 // calculated: выражение над id других полей
  readonly?: boolean
  accept?: string                  // file: '.pdf,.xlsx'
  prefill_from?: string            // 'egov.iin' | 'egov.org_name' | ...
  condition?: FormFieldCondition   // условная видимость поля
}

interface FormFieldCondition {
  field_id: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than'
  value: string | number
}
```

Механики, зашитые как данные (не в код услуги):
- **`calculated` + `formula`** — вычисляется библиотекой `expr-eval` (без `eval`); движок строит план зависимостей и пересчитывает только «грязные» поля в реальном времени.
- **`condition`** (шаг/поле) — фильтруется на каждый ре-рендер; ветвление сценария описывает администратор.
- **`prefill_from`** (`egov.xxx`) — автозаполнение из mock eGov; поле остаётся редактируемым, помечено бейджем «из eGov».
- **`stage`** — этапность подачи (см. [Двухэтапная подача](#двухэтапная-подача-заявки)).

Услуга на витрине (`ServiceDetailPage`), в подаче (`ApplyPage` → `FormRenderer`) и в конструкторе (`ServiceFormPage`) работает с одной и той же схемой.

---

## API

| Метод | Путь | Роль |
|-------|------|------|
| POST | `/api/auth/login` | — |
| GET | `/api/auth/me` | user |
| GET | `/api/services` · `/api/services/:id` | public |
| POST · PUT | `/api/services` · `/api/services/:id` | admin/author |
| DELETE · POST | `/api/services/:id` · `/api/services/:id/publish` | admin |
| POST | `/api/services/:id/audience` · `/broadcast` | admin/author · admin |
| POST · GET | `/api/services/:id/view` · `/api/services/:id/funnel` | public · admin/author |
| POST | `/api/ai/generate-form` · `/generate-form-stream` · `/recommend` · `/review-application` | user |
| POST | `/api/ai/explain-service` · `/pick-service` · `/chat` | public |
| POST | `/api/ai/service-insights` | admin/author |
| POST · GET | `/api/applications` · `/api/applications/:id` | user |
| PUT · POST | `/api/applications/:id/status` · `/nudge` | admin |
| POST | `/api/applications/:id/stage2` | user (владелец) |
| POST · GET | `/api/documents/upload` · `/api/documents` | user |
| GET · PUT | `/api/notifications` · `/api/notifications/:id/read` | user |
| GET | `/api/mock/egov/:iin` · `/mock/kgd/:bin` · `/mock/isz/:id` | — |
| POST | `/api/mock/ecp/sign` · `/mock/eish/submit` | — |
| GET · PUT · DELETE | `/api/users` · `/api/users/:id/role` · `/api/users/:id` | admin |
| GET | `/api/analytics/summary` · `/api/analytics/quality` | admin |
| POST · GET | `/api/leads` · `/api/leads` | public · admin |
| GET / CRUD | `/api/materials` · `/map-projects` · `/news` · `/knowledge` · `/holding-stats` · `/faq` | GET public / write admin+author |

Полный роутинг — [`backend/cmd/server/main.go`](backend/cmd/server/main.go).

### Примеры

```bash
# AI-генерация формы (backend локально на :8080; через Docker — :8081)
curl -X POST http://localhost:8080/api/ai/generate-form \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"description":"Грант на цифровизацию МСБ до 5 млн тенге"}'

# Mock eGov
curl http://localhost:8080/api/mock/egov/123456789012

# Mock ЭЦП (подпись)
curl -X POST http://localhost:8080/api/mock/ecp/sign \
  -H "Content-Type: application/json" -d '{"iin":"123456789012"}'
```

---

## Разработка

```bash
make up            # всё через Docker
make down          # остановить
make logs          # стриминг логов
make infra         # только postgres + redis (для локальной разработки)
make backend-dev   # go run ./cmd/server (:8080)
make frontend-dev  # vite dev (:5173)
make migrate       # применить миграции вручную (обычно применяются на старте backend)
make install-frontend

cd frontend && npx tsc --noEmit   # проверка типов
cd frontend && npm run lint
```

### Структура

```
qoldau-ai/
├── backend/
│   ├── cmd/server/main.go          # chi-роутинг, DI хендлеров, авто-миграции
│   ├── internal/
│   │   ├── config, db, middleware  # env · postgres/redis/migrate · JWT/RequireRole
│   │   ├── models/models.go        # User, Service, Application(stage/request_message), контент-модели
│   │   └── handlers/               # auth, services, applications, ai, ai_insights,
│   │       │                       #   mock, analytics, audience, funnel, leads,
│   │       │                       #   content, documents, notifications, users
│   └── migrations/                 # 001…023: схема+сиды → каталог → eligibility →
│                                   #   audience/funnel → two_stage → 2-й кейс → контент
├── frontend/src/
│   ├── api/client.ts               # servicesApi, applicationsApi, aiApi, mockApi, contentApi, …
│   ├── store/auth.ts               # zustand + localStorage
│   ├── types/index.ts             # FormSchema, Service, Application, …
│   ├── lib/                        # prescore, sla, preflight (eligibility), agroLivestock, formula
│   ├── components/FormRenderer/    # единый рендерер FormSchema
│   └── pages/                      # публичные · cabinet · admin (+ ServiceFormPage-конструктор)
├── docker-compose.yml
├── Makefile
└── ARCHITECTURE.md                 # детальный архитектурный разбор
```
