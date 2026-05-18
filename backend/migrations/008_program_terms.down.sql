DROP INDEX IF EXISTS idx_leads_created;
DROP INDEX IF EXISTS idx_leads_status;
DROP TABLE IF EXISTS leads;

ALTER TABLE services
    DROP COLUMN IF EXISTS max_term_months,
    DROP COLUMN IF EXISTS max_amount,
    DROP COLUMN IF EXISTS interest_rate;
