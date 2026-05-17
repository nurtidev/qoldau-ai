-- 005_audience: synthetic audience for reach calculator + broadcast
-- Adds profile columns to users + seeds 3000 synthetic entrepreneurs
-- with realistic distributions by region / sector / revenue / business age.
--
-- Used by:
--   POST /api/services/:id/audience  — count + breakdowns
--   POST /api/services/:id/broadcast — send personalized notifications

-- ============================================================================
-- 1. Extend users table with business profile columns
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sector              VARCHAR(30),
  ADD COLUMN IF NOT EXISTS business_age_months INT,
  ADD COLUMN IF NOT EXISTS annual_revenue      BIGINT,
  ADD COLUMN IF NOT EXISTS region              VARCHAR(50),
  ADD COLUMN IF NOT EXISTS oked                VARCHAR(10),
  ADD COLUMN IF NOT EXISTS headcount           INT,
  ADD COLUMN IF NOT EXISTS msb_category        VARCHAR(20),  -- micro/small/medium/large
  ADD COLUMN IF NOT EXISTS has_tax_debt        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS in_risk_register    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_age           INT,
  ADD COLUMN IF NOT EXISTS is_synthetic        BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_sector       ON users(sector);
CREATE INDEX IF NOT EXISTS idx_users_region       ON users(region);
CREATE INDEX IF NOT EXISTS idx_users_msb_category ON users(msb_category);
CREATE INDEX IF NOT EXISTS idx_users_revenue      ON users(annual_revenue);
CREATE INDEX IF NOT EXISTS idx_users_business_age ON users(business_age_months);
CREATE INDEX IF NOT EXISTS idx_users_is_synthetic ON users(is_synthetic) WHERE is_synthetic = TRUE;

-- ============================================================================
-- 2. Seed 3000 synthetic users
-- ============================================================================
--
-- Distributions (approximating RK SME landscape):
--   • Region: г. Алматы 20%, г. Астана 15%, Шымкент 8%, остальные 18 регионов 57%
--   • Sector: trade 30%, agro 20%, services 15%, industry 12%, construction 8%,
--             tech 5%, tourism 3%, other 7%
--   • Revenue: micro (<30M ₸) 50%, small (30–300M) 30%, medium (300M–3B) 15%, large 5%
--   • Business age (months): 0–12 (20%), 12–36 (25%), 36–120 (30%), 120+ (25%)
--   • Tax debt: 8% (blocking factor for most Baiterek programs)
--   • Risk register: 2% (stop-factor)
--   • Owner age: 18–65, weighted toward 28–45
--
-- Deterministic via setseed() — повторный запуск миграции (после down/up)
-- даст ровно те же 3000 записей.

SELECT setseed(0.4242);

WITH gen AS (
  SELECT
    n,
    LPAD((100000000000 + n)::text, 12, '0')      AS iin,
    random() AS r_sector,
    random() AS r_age,
    random() AS r_revenue,
    random() AS r_region,
    random() AS r_form,
    random() AS r_first,
    random() AS r_last,
    random() AS r_oked,
    random() AS r_tax,
    random() AS r_risk,
    random() AS r_owner_age,
    random() AS r_headcount
  FROM generate_series(1, 3000) n
),
classified AS (
  SELECT
    *,
    -- Sector (weighted 8-bucket)
    CASE
      WHEN r_sector < 0.30 THEN 'trade'
      WHEN r_sector < 0.50 THEN 'agro'
      WHEN r_sector < 0.65 THEN 'services'
      WHEN r_sector < 0.77 THEN 'industry'
      WHEN r_sector < 0.85 THEN 'construction'
      WHEN r_sector < 0.90 THEN 'tech'
      WHEN r_sector < 0.93 THEN 'tourism'
      ELSE 'other'
    END AS sector,
    -- Region
    CASE
      WHEN r_region < 0.20 THEN 'г. Алматы'
      WHEN r_region < 0.35 THEN 'г. Астана'
      WHEN r_region < 0.43 THEN 'г. Шымкент'
      WHEN r_region < 0.51 THEN 'Алматинская'
      WHEN r_region < 0.57 THEN 'Туркестанская'
      WHEN r_region < 0.62 THEN 'Карагандинская'
      WHEN r_region < 0.67 THEN 'Восточно-Казахстанская'
      WHEN r_region < 0.71 THEN 'Жамбылская'
      WHEN r_region < 0.74 THEN 'Кызылординская'
      WHEN r_region < 0.77 THEN 'Костанайская'
      WHEN r_region < 0.80 THEN 'Павлодарская'
      WHEN r_region < 0.84 THEN 'Актюбинская'
      WHEN r_region < 0.87 THEN 'Атырауская'
      WHEN r_region < 0.90 THEN 'Мангистауская'
      WHEN r_region < 0.93 THEN 'Акмолинская'
      WHEN r_region < 0.95 THEN 'Северо-Казахстанская'
      WHEN r_region < 0.97 THEN 'Западно-Казахстанская'
      WHEN r_region < 0.98 THEN 'Абайская'
      WHEN r_region < 0.99 THEN 'Жетісу'
      ELSE 'Улытауская'
    END AS region,
    -- Business age in months (0..240)
    CASE
      WHEN r_age < 0.20 THEN (r_age * 60)::int
      WHEN r_age < 0.45 THEN (12 + r_age * 60)::int
      WHEN r_age < 0.75 THEN (36 + r_age * 130)::int
      ELSE (120 + r_age * 130)::int
    END AS business_age_months,
    -- Revenue
    CASE
      WHEN r_revenue < 0.50 THEN (1000000 + r_revenue * 58000000)::bigint
      WHEN r_revenue < 0.80 THEN (30000000 + r_revenue * 337000000)::bigint
      WHEN r_revenue < 0.95 THEN (300000000 + r_revenue * 2840000000)::bigint
      ELSE (3000000000 + r_revenue * 5260000000)::bigint
    END AS annual_revenue,
    -- Tax debt (8%) and risk register (2%)
    r_tax  < 0.08 AS has_tax_debt,
    r_risk < 0.02 AS in_risk_register,
    -- Owner age: triangular-ish around 35
    GREATEST(18, LEAST(65,
      (28 + r_owner_age * 28 + r_first * 6 - r_last * 6)::int
    )) AS owner_age,
    -- Legal form
    CASE
      WHEN r_form < 0.50 THEN 'ИП'
      WHEN r_form < 0.92 THEN 'ТОО'
      ELSE 'АО'
    END AS legal_form
  FROM gen
),
named AS (
  SELECT
    *,
    -- MSB category from revenue
    CASE
      WHEN annual_revenue <    30000000 THEN 'micro'
      WHEN annual_revenue <   300000000 THEN 'small'
      WHEN annual_revenue <  3000000000 THEN 'medium'
      ELSE                                   'large'
    END AS msb_category,
    -- Headcount derived from revenue & sector (range 1..15000)
    GREATEST(1, LEAST(15000,
      ((annual_revenue / 6000000.0) * (0.6 + r_headcount * 0.9))::int
    )) AS headcount,
    -- OKED per sector
    CASE sector
      WHEN 'agro'         THEN (ARRAY['01.11','01.21','01.41','01.50','03.21'])[1 + floor(r_oked * 5)::int]
      WHEN 'industry'     THEN (ARRAY['10.51','10.71','13.10','25.62','27.51'])[1 + floor(r_oked * 5)::int]
      WHEN 'trade'        THEN (ARRAY['47.11','47.71','47.78','45.11','46.90'])[1 + floor(r_oked * 5)::int]
      WHEN 'tech'         THEN (ARRAY['62.01','62.02','63.11','58.29','62.09'])[1 + floor(r_oked * 5)::int]
      WHEN 'services'     THEN (ARRAY['56.10','56.30','95.21','95.29','96.02'])[1 + floor(r_oked * 5)::int]
      WHEN 'construction' THEN (ARRAY['41.20','42.11','43.21','43.39','43.91'])[1 + floor(r_oked * 5)::int]
      WHEN 'tourism'      THEN (ARRAY['55.10','55.20','79.11','79.12','79.90'])[1 + floor(r_oked * 5)::int]
      ELSE '00.00'
    END AS oked,
    -- First name
    (ARRAY[
      'Айдар','Бекжан','Дамир','Ерлан','Жанибек','Куаныш','Марат','Нурбек','Олжас','Руслан',
      'Талгат','Чингиз','Алмас','Бауржан','Данияр','Айгуль','Бахыт','Гульнара','Динара','Жанна',
      'Камила','Лаура','Мадина','Орынбасар','Сабина'
    ])[1 + floor(r_first * 25)::int] AS first_name,
    -- Last name (mixed male/female forms — kept simple for synthetic data)
    (ARRAY[
      'Абдуллаев','Бекжанов','Дюсенов','Ерланов','Жаксыбеков','Калиев','Молдабеков','Нурлыбеков',
      'Омаров','Рамазанов','Сейтжанов','Талиев','Усенов','Шарипов','Ыбрайымов','Алимова','Бекенова',
      'Жанибекова','Касымова','Назарбаева','Орынбасарова','Сулейменова','Тлеубаева','Утебекова','Шакирова'
    ])[1 + floor(r_last * 25)::int] AS last_name
  FROM classified
)
INSERT INTO users (
  iin, full_name, org_name, role,
  sector, business_age_months, annual_revenue, region, oked,
  headcount, msb_category, has_tax_debt, in_risk_register, owner_age, is_synthetic
)
SELECT
  iin,
  first_name || ' ' || last_name,
  CASE
    WHEN legal_form = 'ИП' THEN 'ИП ' || last_name
    ELSE legal_form || ' «' || last_name || '»'
  END,
  'user',
  sector,
  business_age_months,
  annual_revenue,
  region,
  oked,
  headcount,
  msb_category,
  has_tax_debt,
  in_risk_register,
  owner_age,
  TRUE
FROM named
ON CONFLICT (iin) DO NOTHING;

-- Mark admin and existing real users as non-synthetic (no-op for fresh DB)
UPDATE users SET is_synthetic = FALSE WHERE is_synthetic IS NULL;
