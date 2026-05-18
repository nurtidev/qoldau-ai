-- 007_cleanup_leasing_dup: remove the 2-step leasing duplicate
-- Migration 001 seeded a 2-step "Приобретение авиатранспорта и вагонов в лизинг"
-- service. Migration 003 then INSERTED (rather than UPDATEd) the full
-- 6-step BRK-grade version. On prod both exist; the 2-step one shadows
-- the realism-packed one in listings and produces a thin funnel.
-- Keep only the version with > 2 steps.

DELETE FROM applications
WHERE service_id IN (
    SELECT id FROM services
    WHERE title = 'Приобретение авиатранспорта и вагонов в лизинг'
      AND jsonb_array_length(form_schema->'steps') < 3
);

DELETE FROM services
WHERE title = 'Приобретение авиатранспорта и вагонов в лизинг'
  AND jsonb_array_length(form_schema->'steps') < 3;
