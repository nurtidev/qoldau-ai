-- 004_eligibility_rules: pre-flight risk-of-rejection engine
-- Adds a separate JSONB column with business-rule checks that run against
-- form_data + eGov + КГД before application submit.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS eligibility_rules JSONB NOT NULL DEFAULT '{"rules":[]}'::jsonb;

-- ============================================================================
-- 1. BRK Leasing — лизинг авиатранспорта / вагонов
-- ============================================================================
UPDATE services SET eligibility_rules = '{
  "rules": [
    {
      "id": "no_tax_debt",
      "level": "blocking",
      "title": "Налоговая задолженность",
      "ok_label": "Налоговая задолженность отсутствует",
      "fail_label": "По данным КГД у вас есть налоговая задолженность",
      "detail": "БРК-Лизинг отказывает заявителям с непогашенной задолженностью перед бюджетом",
      "check": { "source": "kgd", "field": "current_tax_debt", "op": "eq", "value": 0 }
    },
    {
      "id": "no_risk_register",
      "level": "blocking",
      "title": "Реестр риска КГД",
      "ok_label": "Не в реестре риска КГД",
      "fail_label": "Заявитель числится в реестре риска КГД",
      "detail": "Включение в реестр риска — стоп-фактор для всех программ Байтерек",
      "check": { "source": "kgd", "field": "in_risk_register", "op": "eq", "value": false }
    },
    {
      "id": "business_age",
      "level": "warning",
      "title": "Возраст бизнеса",
      "ok_label": "Бизнес работает более 2 лет",
      "fail_label": "Бизнес моложе 24 месяцев — повышенный риск отказа",
      "detail": "БРК-Лизинг предпочитает заявителей с историей операционной деятельности от 2 лет",
      "check": { "source": "kgd_derived", "field": "business_age_months", "op": "gte", "value": 24 }
    },
    {
      "id": "min_revenue",
      "level": "warning",
      "title": "Минимальная выручка",
      "ok_label": "Выручка соответствует масштабу проекта",
      "fail_label": "Выручка ниже 200 млн ₸ — высокий риск отказа по авиа/вагонному лизингу",
      "detail": "По таким объёмам проектов БРК ожидает среднегодовую выручку от 200 млн ₸",
      "check": { "source": "kgd_derived", "field": "annual_revenue_latest", "op": "gte", "value": 200000000 }
    },
    {
      "id": "advance_min",
      "level": "warning",
      "title": "Авансовый взнос",
      "ok_label": "Авансовый взнос ≥ 15%",
      "fail_label": "Авансовый взнос ниже 15% — нарушение требований программы",
      "detail": "Минимальный авансовый платёж по программе лизинга — 15% от стоимости предмета",
      "check": { "source": "form", "field": "f_advance_pct", "op": "gte", "value": 15 }
    },
    {
      "id": "dscr_min",
      "level": "warning",
      "title": "DSCR ниже целевого",
      "ok_label": "DSCR ≥ 1.3 — комфортная нагрузка",
      "fail_label": "DSCR ниже 1.3 — кредитный комитет может отказать",
      "detail": "БРК-Лизинг ориентируется на коэффициент покрытия долга от 1.3",
      "check": { "source": "form", "field": "f_dscr", "op": "gte", "value": 1.3 }
    }
  ]
}'::jsonb
WHERE title = 'Приобретение авиатранспорта и вагонов в лизинг'
  AND org_name = 'АО «НИХ «Байтерек»';

-- ============================================================================
-- 2. Damu — Гарантирование кредитов МСБ
-- ============================================================================
UPDATE services SET eligibility_rules = '{
  "rules": [
    {
      "id": "no_tax_debt",
      "level": "blocking",
      "title": "Налоговая задолженность",
      "ok_label": "Налоговая задолженность отсутствует",
      "fail_label": "Есть налоговая задолженность — гарантия Damu невозможна",
      "detail": "Условие программы — отсутствие задолженности по налогам и пенсионным отчислениям",
      "check": { "source": "kgd", "field": "current_tax_debt", "op": "eq", "value": 0 }
    },
    {
      "id": "msb_category",
      "level": "blocking",
      "title": "Категория МСБ",
      "ok_label": "Подходит под категорию МСБ",
      "fail_label": "Выручка > 3 млрд ₸ — это крупный бизнес, гарантия Damu недоступна",
      "detail": "Гарантирование Damu — только для МСБ (выручка до 3 млрд тенге)",
      "check": { "source": "kgd_derived", "field": "annual_revenue_latest", "op": "lte", "value": 3000000000 }
    },
    {
      "id": "business_age_min",
      "level": "warning",
      "title": "Возраст бизнеса",
      "ok_label": "Бизнес работает более 6 месяцев",
      "fail_label": "Бизнес моложе 6 месяцев — банки-партнёры почти всегда отказывают",
      "detail": "Хотя формально лимита нет, банки-партнёры требуют операционную историю от 6 месяцев",
      "check": { "source": "kgd_derived", "field": "business_age_months", "op": "gte", "value": 6 }
    },
    {
      "id": "loan_amount_max",
      "level": "warning",
      "title": "Лимит суммы кредита",
      "ok_label": "Сумма кредита в пределах лимита",
      "fail_label": "Запрашиваемая сумма превышает лимит 7 млрд ₸",
      "detail": "Максимальный лимит гарантирования по программе — 7 млрд ₸",
      "check": { "source": "form", "field": "dg_loan_amount", "op": "lte", "value": 7000000000 }
    },
    {
      "id": "guarantee_pct",
      "level": "info",
      "title": "Размер гарантии",
      "ok_label": "Запрашиваемая доля гарантии в норме",
      "fail_label": "Запрашиваемая доля гарантии превышает 85%",
      "detail": "Максимум по программе — 85% от суммы кредита",
      "check": { "source": "form", "field": "dg_guarantee_pct", "op": "lte", "value": 85 }
    }
  ]
}'::jsonb
WHERE title = 'Гарантирование кредитов МСБ (Damu)';

-- ============================================================================
-- 3. Damu — Субсидирование ставки (ДКБ-2025 / ЭПВ)
-- ============================================================================
UPDATE services SET eligibility_rules = '{
  "rules": [
    {
      "id": "no_tax_debt",
      "level": "blocking",
      "title": "Налоговая задолженность",
      "ok_label": "Налоговая задолженность отсутствует",
      "fail_label": "Есть налоговая задолженность",
      "detail": "Условие программы ДКБ-2025 — отсутствие задолженности по налогам",
      "check": { "source": "kgd", "field": "current_tax_debt", "op": "eq", "value": 0 }
    },
    {
      "id": "msb_category",
      "level": "blocking",
      "title": "Категория МСБ",
      "ok_label": "Подходит под категорию МСБ",
      "fail_label": "Программа доступна только МСБ (выручка до 3 млрд ₸)",
      "detail": "ДКБ-2025 — субсидирование МСБ, для крупного бизнеса свои программы",
      "check": { "source": "kgd_derived", "field": "annual_revenue_latest", "op": "lte", "value": 3000000000 }
    },
    {
      "id": "rate_ceiling",
      "level": "warning",
      "title": "Ставка банка",
      "ok_label": "Ставка банка в пределах нормы",
      "fail_label": "Ставка банка выше 25% — комиссия Damu может отказать в субсидировании",
      "detail": "Эффективная ставка после субсидии не должна превышать рыночную более чем на 6 п.п.",
      "check": { "source": "form", "field": "sub_bank_rate", "op": "lte", "value": 25 }
    },
    {
      "id": "subsidy_cap",
      "level": "warning",
      "title": "Размер субсидии",
      "ok_label": "Размер субсидии в пределах лимита",
      "fail_label": "Запрашиваемая субсидия выше лимита 7 п.п.",
      "detail": "Максимальный размер субсидии — 7 процентных пунктов",
      "check": { "source": "form", "field": "sub_subsidy_pp", "op": "lte", "value": 7 }
    },
    {
      "id": "local_content",
      "level": "info",
      "title": "Казсодержание",
      "ok_label": "Доля казсодержания ≥ 30%",
      "fail_label": "Низкая доля казсодержания — приоритет ниже",
      "detail": "Программы поддержки приоритизируют проекты с высокой долей казсодержания",
      "check": { "source": "form", "field": "sub_local_content", "op": "gte", "value": 30 }
    }
  ]
}'::jsonb
WHERE title = 'Субсидирование ставки вознаграждения (Damu, ДКБ-2025)';

-- ============================================================================
-- 4. Damu — Грант молодёжного предпринимательства
-- ============================================================================
UPDATE services SET eligibility_rules = '{
  "rules": [
    {
      "id": "no_tax_debt",
      "level": "blocking",
      "title": "Налоговая задолженность",
      "ok_label": "Налоговая задолженность отсутствует",
      "fail_label": "Есть налоговая задолженность — грант недоступен",
      "detail": "Обязательное условие программы",
      "check": { "source": "kgd", "field": "current_tax_debt", "op": "eq", "value": 0 }
    },
    {
      "id": "age_min",
      "level": "blocking",
      "title": "Возраст заявителя",
      "ok_label": "Возраст в пределах программы (18–35 лет)",
      "fail_label": "Возраст вне диапазона 18–35 лет",
      "detail": "Программа предназначена для молодёжного предпринимательства",
      "check": { "source": "form", "field": "grnt_age", "op": "between", "value": [18, 35] }
    },
    {
      "id": "training",
      "level": "blocking",
      "title": "Обучение «Бастау Бизнес»",
      "ok_label": "Сертификат «Бастау Бизнес» подтверждён",
      "fail_label": "Не пройдено обучение «Бастау Бизнес»",
      "detail": "Прохождение обучения — обязательное условие участия в программе",
      "check": { "source": "form", "field": "grnt_passed_training", "op": "truthy" }
    },
    {
      "id": "amount_cap",
      "level": "warning",
      "title": "Сумма гранта",
      "ok_label": "Сумма гранта в пределах лимита",
      "fail_label": "Сумма гранта превышает лимит 5 000 000 ₸",
      "detail": "Максимальный размер гранта Damu для молодёжи — 5 000 000 тенге",
      "check": { "source": "form", "field": "grnt_amount", "op": "lte", "value": 5000000 }
    },
    {
      "id": "own_share",
      "level": "warning",
      "title": "Доля собственного участия",
      "ok_label": "Доля собственного участия ≥ 10%",
      "fail_label": "Доля собственного участия меньше 10%",
      "detail": "Программа требует софинансирование от заявителя — минимум 10%",
      "check": { "source": "form", "field": "grnt_own_pct", "op": "gte", "value": 10 }
    }
  ]
}'::jsonb
WHERE title = 'Грант молодёжного предпринимательства (Damu)';
