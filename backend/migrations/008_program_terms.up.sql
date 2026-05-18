-- 008_program_terms: add headline financial terms to services + leads table

ALTER TABLE services
    ADD COLUMN interest_rate    NUMERIC(5,2),
    ADD COLUMN max_amount       BIGINT,
    ADD COLUMN max_term_months  INT;

COMMENT ON COLUMN services.interest_rate   IS 'Annual interest rate (%) — NULL for non-credit programs (grants, guarantees, consulting).';
COMMENT ON COLUMN services.max_amount      IS 'Maximum financing amount in KZT — NULL when not applicable.';
COMMENT ON COLUMN services.max_term_months IS 'Maximum term in months — NULL when not applicable.';

CREATE TABLE leads (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(50)  NOT NULL,
    service_id  UUID REFERENCES services(id) ON DELETE SET NULL,
    message     TEXT,
    status      VARCHAR(20)  NOT NULL DEFAULT 'new',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status  ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);

-- Backfill realistic program terms for existing published services.
-- Patterns match the seed titles from migration 001 and 002.

UPDATE services SET interest_rate = 8.00, max_amount = 5000000000, max_term_months = 84
  WHERE title LIKE 'Приобретение авиатранспорта и вагонов%';

UPDATE services SET interest_rate = 6.00, max_amount = 750000000,  max_term_months = 84
  WHERE title = 'Льготное финансирование субъектов МСБ';

UPDATE services SET interest_rate = 5.00, max_amount = 1000000000, max_term_months = 36
  WHERE title = 'Финансирование предэкспортное и постэкспортное';

UPDATE services SET interest_rate = 4.00, max_amount = 300000000,  max_term_months = 36
  WHERE title = 'Льготное кредитование сельхозпроизводителей';

UPDATE services SET interest_rate = 7.00, max_amount = 500000000,  max_term_months = 84
  WHERE title = 'Лизинг сельскохозяйственной техники и оборудования';

UPDATE services SET interest_rate = 4.00, max_amount = 33000000,   max_term_months = 60
  WHERE title = 'Микрокредитование для начинающих предпринимателей';

-- Grants & subsidies: rate/term не применимы, но max_amount имеет смысл показать.
UPDATE services SET max_amount = 50000000
  WHERE title = 'Грант для инновационных стартапов (Seed)';

-- Subsidy of rate up to 5 years
UPDATE services SET max_term_months = 60
  WHERE title = 'Субсидирование процентной ставки по инвестиционным кредитам';

-- Guarantee programs — храним только max_amount как ориентир покрытия (без ставки/срока).
UPDATE services SET max_amount = 1000000000
  WHERE title = 'Государственная гарантия по банковским кредитам';

UPDATE services SET max_amount = 7000000000, max_term_months = 84
  WHERE title = 'Гарантирование кредитов МСБ (Damu)';

UPDATE services SET interest_rate = 6.00, max_term_months = 60
  WHERE title = 'Субсидирование ставки вознаграждения (Damu, ДКБ-2025)';

UPDATE services SET max_amount = 5000000
  WHERE title = 'Грант молодёжного предпринимательства (Damu)';
