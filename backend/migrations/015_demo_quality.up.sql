-- 015: демо-данные для аналитических виджетов «Качество входящего потока»
-- и «Брошенные черновики» (admin /admin/analytics, GET /api/analytics/quality).
--
-- Контекст: миграции 005/006 сеют is_synthetic=TRUE заявки (в т.ч. ~1500
-- черновиков) исключительно для воронки/охвата аудитории — виджеты качества
-- читают только is_synthetic=FALSE, поэтому у реальных заявок не было ни
-- одного черновика, а _prescore встречался только у бэндов A/B. Без этой
-- миграции виджет черновиков пуст, а распределение по грейдам не показывает
-- C/D. Добавляем 5 черновиков (разные услуги/даты, с суммой в form_data по
-- эвристике amount/sum) и 2 поданные заявки с _prescore бэндов C и D и
-- правдоподобным form_data по реальным field_id их услуг — чтобы карточка
-- заявки в админке не открывалась пустой.
--
-- Миграция самодостаточна: собственные демо-пользователи создаются здесь же
-- (фиксированные UUID, ON CONFLICT (iin) DO NOTHING) — никакой зависимости
-- от synthetic-сидов 005, которые на проде могли быть удалены через
-- админское удаление пользователя. Фиксированные UUID заявок и пользователей
-- позволяют down.sql точечно откатить только эти строки.

-- ── демо-пользователи ────────────────────────────────────────────────────────
-- is_synthetic=TRUE (колонка из 005): не «настоящие» люди; профильные поля
-- заполнены, чтобы пользователи не создавали NULL-шума в охвате аудитории.
INSERT INTO users (id, iin, full_name, org_name, role, sector, region, msb_category, is_synthetic)
VALUES
  ('00000000-0000-4000-b000-000000000001', '900000015001', 'Ерлан Абенов',      'ИП Абенов',        'user', 'agro',     'Акмолинская',    'micro', TRUE),
  ('00000000-0000-4000-b000-000000000002', '900000015002', 'Салтанат Мукашева', 'ИП Мукашева',      'user', 'trade',    'г. Шымкент',     'micro', TRUE),
  ('00000000-0000-4000-b000-000000000003', '900000015003', 'Азамат Досжанов',   'ТОО «Дән-Агро»',   'user', 'agro',     'Костанайская',   'small', TRUE),
  ('00000000-0000-4000-b000-000000000004', '900000015004', 'Гульнара Сапарова', 'ТОО «СапарТрейд»', 'user', 'trade',    'г. Алматы',      'small', TRUE),
  ('00000000-0000-4000-b000-000000000005', '900000015005', 'Нурбол Кенжебаев',  'ИП Кенжебаев',     'user', 'services', 'Карагандинская', 'micro', TRUE),
  ('00000000-0000-4000-b000-000000000006', '900000015006', 'Аружан Темирова',   'ИП Темирова',      'user', 'services', 'Карагандинская', 'micro', TRUE),
  ('00000000-0000-4000-b000-000000000007', '900000015007', 'Бауыржан Косанов',  'ИП Косанов',       'user', 'trade',    'Павлодарская',   'micro', TRUE)
ON CONFLICT (iin) DO NOTHING;

-- ── брошенные черновики (5 услуг, разные даты) ──────────────────────────────
-- Пользователь берётся по iin (а не по фиксированному id) — на случай, если
-- iin уже существовал и ON CONFLICT пропустил вставку.
INSERT INTO applications (id, service_id, user_id, form_data, status, stage, created_at, updated_at)
SELECT
  d.id::uuid,
  s.id,
  (SELECT id FROM users WHERE iin = d.iin),
  d.form_data,
  'draft'::application_status,
  1,
  now() - (d.days || ' days')::interval,
  now() - (d.days || ' days')::interval
FROM (VALUES
  -- id, услуга, iin, дней назад, form_data
  ('00000000-0000-4000-a000-000000000001', 'Льготный лизинг сельхозтехники',                            '900000015001', 9,
    jsonb_build_object('_seed', 'demo_015', 'requested_amount', 45000000)),
  ('00000000-0000-4000-a000-000000000002', 'Микрокредитование для начинающих предпринимателей',         '900000015002', 2,
    jsonb_build_object('_seed', 'demo_015', 'requested_amount', 3500000)),
  ('00000000-0000-4000-a000-000000000003', 'Кең дала 2 — кредитование весенне-полевых и уборочных работ','900000015003', 15,
    jsonb_build_object('_seed', 'demo_015', 'requested_amount', 120000000)),
  ('00000000-0000-4000-a000-000000000004', 'Гарантирование кредитов МСБ (Даму)',                         '900000015004', 4,
    jsonb_build_object('_seed', 'demo_015', 'requested_amount', 60000000)),
  ('00000000-0000-4000-a000-000000000005', 'Іскер аймақ — субсидирование ставки для малого бизнеса',     '900000015005', 1,
    jsonb_build_object('_seed', 'demo_015', 'requested_amount', 25000000))
) AS d(id, svc_title, iin, days, form_data)
JOIN services s ON s.title = d.svc_title;

-- ── поданные заявки с _prescore бэндов C и D ─────────────────────────────────
-- Существующие демо-данные покрывают только A/B. Снимок _prescore точно
-- повторяет структуру PrescoreSnapshot из frontend/src/lib/prescore.ts
-- (score, band, preapprovedLimit, factors[]). form_data заполнен реальными
-- field_id из form_schema соответствующих услуг (грант — grnt_*, гарантия —
-- dg1..dg9), чтобы карточка заявки в очереди администратора не была пустой.
INSERT INTO applications (id, service_id, user_id, form_data, status, stage, created_at, updated_at)
SELECT
  d.id::uuid,
  s.id,
  (SELECT id FROM users WHERE iin = d.iin),
  d.form_data,
  d.st::application_status,
  1,
  now() - (d.days || ' days')::interval,
  now() - (d.days || ' days')::interval
FROM (VALUES
  ('00000000-0000-4000-a000-000000000006', 'Грант «Бастау Бизнес»', '900000015006', 'submitted', 3,
    jsonb_build_object(
      '_seed', 'demo_015',
      'grnt_iin', '900000015006',
      'grnt_fio', 'Аружан Темирова',
      'grnt_birth', '1998-03-14',
      'grnt_age', 28,
      'grnt_status', 'Зарегистрированный ИП (до 12 мес)',
      'grnt_region', 'Карагандинская',
      'grnt_education', 'Высшее',
      'grnt_passed_training', true,
      'grnt_business_name', 'Пекарня «Наурыз»',
      'grnt_sector', 'Общественное питание',
      'grnt_description', 'Мини-пекарня с доставкой свежей выпечки в офисы и школы Караганды. Аренда помещения уже оформлена, требуется оборудование.',
      'grnt_amount', 4500000,
      'grnt_use_equipment', 3000000,
      'grnt_use_renovation', 800000,
      'grnt_use_materials', 700000,
      'grnt_use_total', 4500000,
      'grnt_own_funds', 500000,
      'grnt_own_pct', 10,
      'grnt_jobs_kpi', 2,
      'grnt_revenue_kpi', 12000000,
      'grnt_other_grants', true,
      'grnt_no_debt', true,
      'grnt_consent_pdn', true,
      '_prescore', jsonb_build_object(
        'score', 59, 'band', 'C', 'preapprovedLimit', 4500000,
        'factors', jsonb_build_array(
          jsonb_build_object('id','tax','label','Налоговая дисциплина','score',70,'weight',0.3),
          jsonb_build_object('id','finance','label','Финансовая устойчивость','score',55,'weight',0.25),
          jsonb_build_object('id','maturity','label','Зрелость бизнеса','score',45,'weight',0.15),
          jsonb_build_object('id','burden','label','Долговая нагрузка запроса','score',60,'weight',0.2),
          jsonb_build_object('id','formal','label','Формальные признаки','score',50,'weight',0.1)
        )
      )
    )),
  ('00000000-0000-4000-a000-000000000007', 'Гарантия по кредиту для начинающих предпринимателей', '900000015007', 'rejected', 10,
    jsonb_build_object(
      '_seed', 'demo_015',
      'dg1', '900000015007',
      'dg2', 'ИП Косанов',
      'dg3', 'ИП',
      'dg4', 7,
      'dg5', 'Торговля',
      'dg6', 'Halyk Bank',
      'dg7', 18000000,
      'dg8', 12600000,
      'dg9', 'Пополнение оборотных средств: закуп товара к сезону и открытие второй торговой точки в Павлодаре.',
      '_prescore', jsonb_build_object(
        'score', 30, 'band', 'D', 'preapprovedLimit', 0,
        'factors', jsonb_build_array(
          jsonb_build_object('id','tax','label','Налоговая дисциплина','score',30,'weight',0.3),
          jsonb_build_object('id','finance','label','Финансовая устойчивость','score',25,'weight',0.25),
          jsonb_build_object('id','maturity','label','Зрелость бизнеса','score',20,'weight',0.15),
          jsonb_build_object('id','burden','label','Долговая нагрузка запроса','score',40,'weight',0.2),
          jsonb_build_object('id','formal','label','Формальные признаки','score',40,'weight',0.1)
        )
      )
    ))
) AS d(id, svc_title, iin, st, days, form_data)
JOIN services s ON s.title = d.svc_title;
