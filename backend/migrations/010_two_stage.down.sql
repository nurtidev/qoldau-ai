-- 010 down: revert the stage-2 marker on the leasing form_schema, then drop
-- the two-stage columns.

UPDATE services
SET form_schema = jsonb_set(
    form_schema,
    '{steps}',
    (
        SELECT jsonb_agg((step - 'stage') ORDER BY ord)
        FROM jsonb_array_elements(form_schema->'steps') WITH ORDINALITY AS t(step, ord)
    )
)
WHERE title = 'Приобретение авиатранспорта и вагонов в лизинг'
  AND form_schema->'steps' @> '[{"stage": 2}]'::jsonb;

ALTER TABLE applications
    DROP COLUMN IF EXISTS request_message,
    DROP COLUMN IF EXISTS stage;
