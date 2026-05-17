-- 005_audience: rollback

DELETE FROM users WHERE is_synthetic = TRUE;

DROP INDEX IF EXISTS idx_users_is_synthetic;
DROP INDEX IF EXISTS idx_users_business_age;
DROP INDEX IF EXISTS idx_users_revenue;
DROP INDEX IF EXISTS idx_users_msb_category;
DROP INDEX IF EXISTS idx_users_region;
DROP INDEX IF EXISTS idx_users_sector;

ALTER TABLE users
  DROP COLUMN IF EXISTS is_synthetic,
  DROP COLUMN IF EXISTS owner_age,
  DROP COLUMN IF EXISTS in_risk_register,
  DROP COLUMN IF EXISTS has_tax_debt,
  DROP COLUMN IF EXISTS msb_category,
  DROP COLUMN IF EXISTS headcount,
  DROP COLUMN IF EXISTS oked,
  DROP COLUMN IF EXISTS region,
  DROP COLUMN IF EXISTS annual_revenue,
  DROP COLUMN IF EXISTS business_age_months,
  DROP COLUMN IF EXISTS sector;
