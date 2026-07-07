-- 010_two_stage: two-stage applications.
--
-- 1) applications get a `stage` (1 = primary submission, 2 = follow-up data)
--    and a `request_message` (what the admin asked the applicant to provide).
-- 2) The control-case leasing service gets its "Документы" step marked as
--    stage 2 (follow-up), so documents are requested only after preliminary
--    approval. Any step-level condition on that step is dropped so stage 2
--    applies to every applicant.
--
-- Note on the seed: migration 003 replaced the leasing form_schema with the
-- full 6-step BRK-Leasing version whose documents live in the step titled
-- "Документы" (step_6). That step already includes the tax-clearance
-- certificate ("Справка об отсутствии налоговой задолженности"), so no extra
-- file field is added here — we only move the whole documents step to stage 2.

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS stage           SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS request_message TEXT     NOT NULL DEFAULT '';

COMMENT ON COLUMN applications.stage           IS 'Submission stage: 1 = primary, 2 = follow-up (docs_requested → resubmitted).';
COMMENT ON COLUMN applications.request_message IS 'Admin message describing what additional data was requested (docs_requested).';

-- Mark the "Документы" step of the leasing service as stage 2 (and strip any
-- step-level condition so it is shown to all applicants).
UPDATE services
SET form_schema = jsonb_set(
    form_schema,
    '{steps}',
    (
        SELECT jsonb_agg(
                   CASE
                       WHEN step->>'title' = 'Документы'
                           THEN (step - 'condition') || '{"stage": 2}'::jsonb
                       ELSE step
                   END
                   ORDER BY ord
               )
        FROM jsonb_array_elements(form_schema->'steps') WITH ORDINALITY AS t(step, ord)
    )
)
WHERE title = 'Приобретение авиатранспорта и вагонов в лизинг'
  AND form_schema->'steps' @> '[{"title": "Документы"}]'::jsonb;
