-- 003_realism_pack: realism upgrade for jury demo
-- 1) Expand the control-case leasing form_schema with DSCR/IRR/казсодержание/ПКБ/KYC
-- 2) Add three explicitly-branded Damu services (guarantee, subsidy, grant)

-- ============================================================================
-- 1. UPDATE leasing service — full BRK-Leasing-grade form
-- ============================================================================
UPDATE services
SET form_schema = '{
  "steps": [
    {
      "id": "step_1",
      "title": "Информация о компании",
      "fields": [
        {"id":"f_bin","type":"text","label":"БИН организации","placeholder":"123456789012","required":true,"prefill_from":"egov.iin"},
        {"id":"f_name","type":"text","label":"Наименование организации","placeholder":"ТОО ...","required":true,"prefill_from":"egov.org_name"},
        {"id":"f_org_type","type":"select","label":"Тип организации","options":["МСБ","Крупный бизнес"],"required":true},
        {"id":"f_oked","type":"text","label":"Основной ОКЭД","placeholder":"49.41 — Деятельность грузового автотранспорта","required":true},
        {"id":"f_reg_date","type":"date","label":"Дата регистрации компании","required":true},
        {"id":"f_revenue_avg","type":"number","label":"Среднегодовая выручка за 3 года, тенге","required":true},
        {"id":"f_headcount","type":"number","label":"Средняя численность сотрудников","required":true}
      ]
    },
    {
      "id": "step_2",
      "title": "Предмет лизинга и казсодержание",
      "fields": [
        {"id":"f_subject","type":"select","label":"Предмет лизинга","options":["Авиатранспорт","Вагоны","Промышленное оборудование","Спецтехника"],"required":true},
        {"id":"f_subject_name","type":"text","label":"Наименование / модель","placeholder":"Например: Boeing 737-800 или вагон-цистерна модель 15-1547","required":true},
        {"id":"f_qty","type":"number","label":"Количество единиц","required":true},
        {"id":"f_unit_cost","type":"currency","label":"Стоимость единицы, тенге","required":true},
        {"id":"f_total_cost","type":"calculated","label":"Общая стоимость","formula":"f_qty * f_unit_cost","mask":"currency","readonly":true},
        {"id":"f_origin","type":"select","label":"Страна происхождения","options":["Казахстан","Россия","Беларусь","Китай","Турция","ЕС","США","Другое"],"required":true},
        {"id":"f_local_content","type":"number","label":"Доля казахстанского содержания, %","placeholder":"0–100","required":true},
        {"id":"f_supplier","type":"text","label":"Поставщик / производитель","placeholder":"Наименование поставщика","required":true},
        {"id":"f_supplier_country","type":"text","label":"Страна нахождения поставщика","required":true}
      ]
    },
    {
      "id": "step_3",
      "title": "Финансовая модель проекта",
      "fields": [
        {"id":"f_advance_pct","type":"number","label":"Авансовый взнос, % (мин. 15%)","required":true,"placeholder":"20"},
        {"id":"f_advance_sum","type":"calculated","label":"Сумма аванса","formula":"f_total_cost * f_advance_pct / 100","mask":"currency","readonly":true},
        {"id":"f_lease_amount","type":"calculated","label":"Запрашиваемая сумма лизинга","formula":"f_total_cost - f_advance_sum","mask":"currency","readonly":true},
        {"id":"f_term_months","type":"select","label":"Срок лизинга","options":["24","36","48","60","72","84"],"required":true},
        {"id":"f_rate","type":"number","label":"Ожидаемая годовая ставка лизинга, %","placeholder":"15","required":true},
        {"id":"f_annual_payment","type":"calculated","label":"Среднегодовой лизинговый платёж","formula":"f_lease_amount * 12 / f_term_months + f_lease_amount * f_rate / 100","mask":"currency","readonly":true},
        {"id":"f_net_profit","type":"number","label":"Чистая прибыль за последний год, тенге","required":true},
        {"id":"f_dscr","type":"calculated","label":"DSCR — коэффициент покрытия долга (цель ≥ 1.3)","formula":"f_net_profit / f_annual_payment","readonly":true},
        {"id":"f_irr","type":"number","label":"Прогнозная IRR проекта, % (цель ≥ 12%)","placeholder":"15","required":true},
        {"id":"f_equity_share","type":"calculated","label":"Доля собственного участия в проекте, % (цель ≥ 20%)","formula":"f_advance_pct","mask":"percent","readonly":true}
      ]
    },
    {
      "id": "step_4",
      "title": "Обеспечение и оценка",
      "fields": [
        {"id":"f_appraiser","type":"select","label":"Аккредитованный оценщик (реестр БРК-Лизинг)","options":["ТОО «Центр Оценки Активов»","ТОО «KazAppraisal»","ТОО «Astana Valuation Group»","ТОО «BCC Invest Appraisal»","ТОО «Almaty Property Experts»"],"required":true},
        {"id":"f_appraisal_value","type":"currency","label":"Стоимость предмета по независимой оценке, тенге","required":true},
        {"id":"f_extra_collateral","type":"radio","label":"Предлагается ли дополнительное залоговое обеспечение?","options":["Да","Нет"],"required":true},
        {"id":"f_collateral_desc","type":"textarea","label":"Описание дополнительного залога","placeholder":"Тип, местонахождение, оценочная стоимость","condition":{"field_id":"f_extra_collateral","operator":"equals","value":"Да"}},
        {"id":"f_insurer","type":"select","label":"Страховая компания (предмет лизинга)","options":["АО «Евразия»","АО «Халык»","АО «Jysan Garant»","АО «Сентрас Иншуранс»","АО «Nomad Insurance»"],"required":true}
      ]
    },
    {
      "id": "step_5",
      "title": "Бенефициары и комплаенс (KYC / ПОД-ФТ)",
      "fields": [
        {"id":"f_ubo_name","type":"text","label":"ФИО бенефициарного владельца","placeholder":"Конечный бенефициар с долей > 25%","required":true},
        {"id":"f_ubo_iin","type":"text","label":"ИИН бенефициара","placeholder":"12 цифр","required":true},
        {"id":"f_ubo_share","type":"number","label":"Доля участия бенефициара, %","required":true},
        {"id":"f_funds_source","type":"textarea","label":"Источник происхождения средств для аванса","placeholder":"Собственные средства / кредит / реинвестиция прибыли — опишите","required":true},
        {"id":"f_consent_credit_bureau","type":"checkbox","label":"Согласие на запрос кредитной истории","placeholder":"Даю согласие БРК-Лизингу запросить мою кредитную историю в ПКБ и Государственном кредитном бюро (Закон РК «О кредитных бюро»)","required":true},
        {"id":"f_consent_personal_data","type":"checkbox","label":"Согласие на обработку персональных данных","placeholder":"Даю согласие на обработку моих персональных данных согласно Закону РК № 94-V от 21.05.2013","required":true},
        {"id":"f_consent_sanctions","type":"checkbox","label":"Декларация о санкционных рисках","placeholder":"Подтверждаю, что я и бенефициары не находимся в санкционных списках, перечне террористов АФМ РК и реестре лиц с публичными должностями","required":true},
        {"id":"f_consent_egov","type":"checkbox","label":"Согласие на запрос данных в госорганах","placeholder":"Даю согласие на запрос налоговой истории в КГД, сведений из ЕНПФ и Гос.БД ЮЛ","required":true}
      ]
    },
    {
      "id": "step_6",
      "title": "Документы",
      "fields": [
        {"id":"f_doc_fin_3y","type":"file","label":"Финансовая отчётность за 3 года","accept":".pdf","required":true},
        {"id":"f_doc_audit","type":"file","label":"Аудиторское заключение (только для крупного бизнеса)","accept":".pdf","condition":{"field_id":"f_org_type","operator":"equals","value":"Крупный бизнес"}},
        {"id":"f_doc_business_plan","type":"file","label":"Бизнес-план / ТЭО проекта","accept":".pdf","required":true},
        {"id":"f_doc_charter","type":"file","label":"Устав и учредительные документы","accept":".pdf","required":true},
        {"id":"f_doc_decision","type":"file","label":"Решение учредителя / протокол участников о привлечении лизинга","accept":".pdf","required":true},
        {"id":"f_doc_tax_cert","type":"file","label":"Справка об отсутствии налоговой задолженности (КГД)","accept":".pdf","required":true},
        {"id":"f_doc_appraisal","type":"file","label":"Отчёт независимого оценщика","accept":".pdf","required":true},
        {"id":"f_doc_commercial","type":"file","label":"Коммерческое предложение от поставщика","accept":".pdf","required":true},
        {"id":"f_doc_local_content","type":"file","label":"Сертификат происхождения / индустриальный сертификат СТ-KZ","accept":".pdf","required":false}
      ]
    }
  ]
}'::jsonb
WHERE title = 'Приобретение авиатранспорта и вагонов в лизинг'
  AND org_name = 'АО «НИХ «Байтерек»';

-- ============================================================================
-- 2. Damu — Гарантирование кредитов МСБ (массовый продукт)
-- ============================================================================
INSERT INTO services (title, description, category, org_name, status, form_schema, created_by)
VALUES (
  'Гарантирование кредитов МСБ (Damu)',
  'Государственная гарантия Фонда «Damu» по банковским кредитам субъектам малого и среднего предпринимательства. Сумма гарантии — до 85% от кредита, лимит до 7 млрд тг, срок — до 7 лет. Программа в рамках Концепции инвестиционной политики и нацпроекта.',
  'Гарантии',
  'Damu',
  'published',
  '{
    "steps": [
      {
        "id": "step_1",
        "title": "Заявитель и бизнес",
        "fields": [
          {"id":"dg_bin","type":"text","label":"БИН / ИИН","required":true,"prefill_from":"egov.iin"},
          {"id":"dg_name","type":"text","label":"Наименование заявителя","required":true,"prefill_from":"egov.org_name"},
          {"id":"dg_form","type":"select","label":"Организационно-правовая форма","options":["ИП","ТОО","АО","Крестьянское хозяйство"],"required":true},
          {"id":"dg_oked","type":"text","label":"ОКЭД","placeholder":"Например: 10.71 — Производство хлеба","required":true},
          {"id":"dg_business_age","type":"number","label":"Срок работы бизнеса, месяцев","required":true},
          {"id":"dg_headcount","type":"number","label":"Численность сотрудников","required":true},
          {"id":"dg_revenue","type":"number","label":"Выручка за прошлый год, тенге","required":true},
          {"id":"dg_msb_category","type":"calculated","label":"Категория субъекта (расчёт по выручке)","formula":"dg_revenue > 0 ? (dg_revenue < 300000000 ? 1 : (dg_revenue < 3000000000 ? 2 : 3)) : 0","readonly":true}
        ]
      },
      {
        "id": "step_2",
        "title": "Параметры кредита",
        "fields": [
          {"id":"dg_bank","type":"select","label":"Банк-партнёр","options":["Halyk Bank","Kaspi Bank","Jusan Bank","ForteBank","Bereke Bank","Банк ЦентрКредит","Altyn Bank","Eurasian Bank","Freedom Bank"],"required":true},
          {"id":"dg_loan_amount","type":"currency","label":"Сумма кредита, тенге","required":true},
          {"id":"dg_loan_term","type":"select","label":"Срок кредита","options":["12 месяцев","24 месяца","36 месяцев","48 месяцев","60 месяцев","84 месяца"],"required":true},
          {"id":"dg_purpose","type":"select","label":"Цель кредита","options":["Инвестиционный кредит (приобретение ОС)","Пополнение оборотных средств","Рефинансирование","Строительство"],"required":true},
          {"id":"dg_guarantee_pct","type":"select","label":"Запрашиваемая доля гарантии Damu, %","options":["50","70","85"],"required":true},
          {"id":"dg_guarantee_sum","type":"calculated","label":"Сумма гарантии Damu","formula":"dg_loan_amount * dg_guarantee_pct / 100","mask":"currency","readonly":true},
          {"id":"dg_collateral_value","type":"currency","label":"Стоимость собственного залога заявителя, тенге","required":true},
          {"id":"dg_collateral_gap","type":"calculated","label":"Недостаток обеспечения (покрывается гарантией)","formula":"dg_loan_amount - dg_collateral_value","mask":"currency","readonly":true}
        ]
      },
      {
        "id": "step_3",
        "title": "Согласия и документы",
        "fields": [
          {"id":"dg_consent_pkb","type":"checkbox","label":"Согласие на запрос в ПКБ и ГКБ","placeholder":"Даю согласие Фонду «Damu» и банку-партнёру на запрос моей кредитной истории","required":true},
          {"id":"dg_consent_pdn","type":"checkbox","label":"Согласие на обработку персональных данных","placeholder":"Согласно Закону РК № 94-V","required":true},
          {"id":"dg_doc_app","type":"file","label":"Предварительное одобрение / письмо банка","accept":".pdf","required":true},
          {"id":"dg_doc_fin","type":"file","label":"Финансовая отчётность за 2 года","accept":".pdf","required":true},
          {"id":"dg_doc_business_plan","type":"file","label":"Бизнес-план или ТЭО","accept":".pdf","required":true},
          {"id":"dg_doc_charter","type":"file","label":"Учредительные документы","accept":".pdf","required":true}
        ]
      }
    ]
  }'::jsonb,
  (SELECT id FROM users WHERE iin = '000000000000')
);

-- ============================================================================
-- 3. Damu — Субсидирование ставки вознаграждения (ДКБ-2025 / ЭПВ)
-- ============================================================================
INSERT INTO services (title, description, category, org_name, status, form_schema, created_by)
VALUES (
  'Субсидирование ставки вознаграждения (Damu, ДКБ-2025)',
  'Субсидирование части ставки по кредитам и лизингу для МСБ в рамках программы «Дорожная карта бизнеса — 2025» и «Экономика простых вещей». Субсидия до 6 п.п. в год, эффективная ставка для предпринимателя — от 6%. Срок субсидирования — до 5 лет.',
  'Субсидии',
  'Damu',
  'published',
  '{
    "steps": [
      {
        "id": "step_1",
        "title": "Заявитель",
        "fields": [
          {"id":"sub_bin","type":"text","label":"БИН","required":true,"prefill_from":"egov.iin"},
          {"id":"sub_name","type":"text","label":"Наименование организации","required":true,"prefill_from":"egov.org_name"},
          {"id":"sub_oked","type":"text","label":"ОКЭД основной деятельности","placeholder":"Например: 10.51 — Производство молочных продуктов","required":true},
          {"id":"sub_program","type":"select","label":"Программа субсидирования","options":["ДКБ-2025 (приоритетные секторы)","Экономика простых вещей (ЭПВ)","Нацпроект «Сильные регионы»"],"required":true},
          {"id":"sub_region","type":"select","label":"Регион реализации проекта","options":["г. Астана","г. Алматы","г. Шымкент","Акмолинская","Актюбинская","Алматинская","Атырауская","ВКО","Жамбылская","ЗКО","Карагандинская","Костанайская","Кызылординская","Мангистауская","Павлодарская","СКО","Туркестанская","Улытауская","Абайская","Жетісу"],"required":true},
          {"id":"sub_msb","type":"radio","label":"Категория предпринимательства","options":["Микро","Малый","Средний","Крупный"],"required":true}
        ]
      },
      {
        "id": "step_2",
        "title": "Параметры кредита",
        "fields": [
          {"id":"sub_bank","type":"select","label":"Банк-партнёр / лизинговая компания","options":["Halyk Bank","Kaspi Bank","Jusan Bank","ForteBank","Bereke Bank","Банк ЦентрКредит","БРК-Лизинг","KazAgroFinance","Альфа Финанс"],"required":true},
          {"id":"sub_loan_amount","type":"currency","label":"Сумма кредита / лизинга, тенге","required":true},
          {"id":"sub_loan_type","type":"select","label":"Тип финансирования","options":["Инвестиционный кредит","Оборотный кредит","Лизинг","Рефинансирование"],"required":true},
          {"id":"sub_bank_rate","type":"number","label":"Номинальная ставка банка, % годовых","placeholder":"19","required":true},
          {"id":"sub_subsidy_pp","type":"select","label":"Размер субсидии, п.п.","options":["4","5","6","7"],"required":true},
          {"id":"sub_effective_rate","type":"calculated","label":"Эффективная ставка для бизнеса, %","formula":"sub_bank_rate - sub_subsidy_pp","mask":"percent","readonly":true},
          {"id":"sub_term_years","type":"select","label":"Срок субсидирования","options":["1 год","2 года","3 года","4 года","5 лет"],"required":true},
          {"id":"sub_annual_saving","type":"calculated","label":"Годовая экономия на процентах","formula":"sub_loan_amount * sub_subsidy_pp / 100","mask":"currency","readonly":true}
        ]
      },
      {
        "id": "step_3",
        "title": "Эффект проекта",
        "fields": [
          {"id":"sub_jobs","type":"number","label":"Планируемое создание рабочих мест","required":true},
          {"id":"sub_tax_increase","type":"currency","label":"Прирост налоговых отчислений за 3 года, тенге","required":false},
          {"id":"sub_local_content","type":"number","label":"Доля казсодержания в проекте, %","placeholder":"0–100","required":true},
          {"id":"sub_export_oriented","type":"radio","label":"Экспортная ориентация проекта","options":["Да","Нет"],"required":true}
        ]
      },
      {
        "id": "step_4",
        "title": "Согласия и документы",
        "fields": [
          {"id":"sub_consent_pkb","type":"checkbox","label":"Согласие на запрос в кредитное бюро","placeholder":"Согласие на запрос в ПКБ и ГКБ","required":true},
          {"id":"sub_consent_pdn","type":"checkbox","label":"Согласие на обработку ПДн","placeholder":"Согласно Закону № 94-V","required":true},
          {"id":"sub_doc_credit","type":"file","label":"Действующий кредитный / лизинговый договор","accept":".pdf","required":true},
          {"id":"sub_doc_business_plan","type":"file","label":"Бизнес-план / финмодель","accept":".pdf","required":true},
          {"id":"sub_doc_tax","type":"file","label":"Справка КГД об отсутствии задолженности","accept":".pdf","required":true},
          {"id":"sub_doc_fin","type":"file","label":"Финансовая отчётность","accept":".pdf","required":true}
        ]
      }
    ]
  }'::jsonb,
  (SELECT id FROM users WHERE iin = '000000000000')
);

-- ============================================================================
-- 4. Damu — Грант для молодёжного предпринимательства (5 млн тг)
-- ============================================================================
INSERT INTO services (title, description, category, org_name, status, form_schema, created_by)
VALUES (
  'Грант молодёжного предпринимательства (Damu)',
  'Безвозмездный грант Фонда «Damu» до 5 000 000 тенге для начинающих предпринимателей в возрасте от 18 до 35 лет. Целевое использование: приобретение оборудования, ремонт, закуп сырья. Без возврата при выполнении KPI по созданию рабочих мест.',
  'Гранты',
  'Damu',
  'published',
  '{
    "steps": [
      {
        "id": "step_1",
        "title": "Заявитель",
        "fields": [
          {"id":"grnt_iin","type":"text","label":"ИИН","required":true,"prefill_from":"egov.iin"},
          {"id":"grnt_fio","type":"text","label":"ФИО","required":true,"prefill_from":"egov.org_name"},
          {"id":"grnt_birth","type":"date","label":"Дата рождения","required":true},
          {"id":"grnt_age","type":"number","label":"Возраст (18–35)","required":true,"placeholder":"Возраст на дату подачи"},
          {"id":"grnt_status","type":"select","label":"Статус предпринимателя","options":["Планирую открыть ИП","Зарегистрированный ИП (до 12 мес)","Зарегистрированное ТОО (до 12 мес)"],"required":true},
          {"id":"grnt_region","type":"select","label":"Регион","options":["г. Астана","г. Алматы","г. Шымкент","Акмолинская","Актюбинская","Алматинская","Атырауская","ВКО","Жамбылская","ЗКО","Карагандинская","Костанайская","Кызылординская","Мангистауская","Павлодарская","СКО","Туркестанская","Улытауская","Абайская","Жетісу"],"required":true},
          {"id":"grnt_education","type":"select","label":"Образование","options":["Среднее","Среднее специальное","Высшее","Магистратура / PhD"],"required":true},
          {"id":"grnt_passed_training","type":"checkbox","label":"Прошёл обучение «Бастау Бизнес» / аналогичная программа","placeholder":"Обязательно для участия в программе грантов Damu","required":true}
        ]
      },
      {
        "id": "step_2",
        "title": "Проект",
        "fields": [
          {"id":"grnt_business_name","type":"text","label":"Название бизнеса / проекта","required":true},
          {"id":"grnt_sector","type":"select","label":"Сфера деятельности","options":["Производство","Сельское хозяйство","Услуги","Ремесленничество","IT и креативные индустрии","Общественное питание","Розничная торговля","Бытовые услуги"],"required":true},
          {"id":"grnt_description","type":"textarea","label":"Краткое описание проекта","placeholder":"Что вы планируете делать, для кого, какую проблему решаете","required":true},
          {"id":"grnt_amount","type":"currency","label":"Запрашиваемая сумма гранта, тенге (макс. 5 000 000)","required":true},
          {"id":"grnt_use_equipment","type":"number","label":"На оборудование, тенге","required":false},
          {"id":"grnt_use_renovation","type":"number","label":"На ремонт помещения, тенге","required":false},
          {"id":"grnt_use_materials","type":"number","label":"На сырьё и материалы, тенге","required":false},
          {"id":"grnt_use_total","type":"calculated","label":"Сумма распределения","formula":"grnt_use_equipment + grnt_use_renovation + grnt_use_materials","mask":"currency","readonly":true},
          {"id":"grnt_own_funds","type":"currency","label":"Собственные средства в проект, тенге (не менее 10%)","required":true},
          {"id":"grnt_own_pct","type":"calculated","label":"Доля собственного участия, %","formula":"grnt_own_funds * 100 / (grnt_amount + grnt_own_funds)","mask":"percent","readonly":true}
        ]
      },
      {
        "id": "step_3",
        "title": "KPI и обязательства",
        "fields": [
          {"id":"grnt_jobs_kpi","type":"number","label":"Обязательство по созданию рабочих мест в течение 12 мес","placeholder":"Минимум 2","required":true},
          {"id":"grnt_revenue_kpi","type":"currency","label":"Плановая выручка за первый год, тенге","required":true},
          {"id":"grnt_other_grants","type":"checkbox","label":"Подтверждаю, что не получал других грантов Damu / государства за последние 3 года","placeholder":"Двойное финансирование недопустимо","required":true},
          {"id":"grnt_no_debt","type":"checkbox","label":"Не имею задолженности по налогам и пенсионным отчислениям","placeholder":"Проверяется через КГД и ЕНПФ","required":true}
        ]
      },
      {
        "id": "step_4",
        "title": "Документы",
        "fields": [
          {"id":"grnt_consent_pdn","type":"checkbox","label":"Согласие на обработку персональных данных","placeholder":"Согласно Закону РК № 94-V","required":true},
          {"id":"grnt_doc_id","type":"file","label":"Копия удостоверения личности","accept":".pdf,.jpg,.png","required":true},
          {"id":"grnt_doc_education","type":"file","label":"Документ об образовании","accept":".pdf","required":false},
          {"id":"grnt_doc_training","type":"file","label":"Сертификат «Бастау Бизнес»","accept":".pdf","required":true},
          {"id":"grnt_doc_business_plan","type":"file","label":"Бизнес-план проекта","accept":".pdf","required":true},
          {"id":"grnt_doc_quotes","type":"file","label":"Коммерческие предложения / счета на оборудование","accept":".pdf","required":true}
        ]
      }
    ]
  }'::jsonb,
  (SELECT id FROM users WHERE iin = '000000000000')
);