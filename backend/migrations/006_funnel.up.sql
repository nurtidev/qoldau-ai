-- 006_funnel: program-level funnel analytics
-- Tracks the full lifecycle of an applicant journey:
--   service view → started application → step events → submitted → decision
--
-- Used by:
--   POST /api/services/:id/view          — log a service-card view
--   POST /api/applications/:id/event     — log a step transition
--   GET  /api/services/:id/funnel        — aggregated funnel + drilldown
--
-- Plus seeds ~8k views and ~480 synthetic applications with realistic
-- drop-off distributions, including a special "killer drop" on step 2
-- of the leasing control case (median lease amount above program limit)
-- to power the demo insight.

-- ============================================================================
-- 1. Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_views (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_views_service ON service_views(service_id);
CREATE INDEX IF NOT EXISTS idx_service_views_created ON service_views(created_at);

CREATE TABLE IF NOT EXISTS application_events (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id    UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    step_id           VARCHAR(60) NOT NULL,
    step_index        INT NOT NULL,
    event_type        VARCHAR(20) NOT NULL,   -- 'entered' | 'completed' | 'abandoned'
    last_field_id     VARCHAR(80),
    last_field_value  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_events_app    ON application_events(application_id);
CREATE INDEX IF NOT EXISTS idx_app_events_step   ON application_events(step_id);
CREATE INDEX IF NOT EXISTS idx_app_events_type   ON application_events(event_type);

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_applications_synthetic
    ON applications(is_synthetic) WHERE is_synthetic = TRUE;

-- ============================================================================
-- 2. Synthetic service_views
--
-- Volume: 200–2200 views per service, weighted by category popularity
--         (financing/leasing/guarantees/subsidies → higher; others → lower).
-- Time:   distributed over the past 60 days.
-- ============================================================================

SELECT setseed(0.4242);

INSERT INTO service_views (service_id, user_id, created_at)
WITH services_ranked AS (
    SELECT
        id,
        title,
        CASE
            WHEN category IN ('Финансирование','Лизинг','Субсидии','Гарантии') THEN 1500
            WHEN category IN ('Гранты','Экспорт','Агросектор') THEN 900
            ELSE 500
        END AS base_views,
        random() AS r_views
    FROM services
),
view_counts AS (
    SELECT
        id   AS service_id,
        GREATEST(150, (base_views * (0.4 + r_views * 0.8))::int) AS views
    FROM services_ranked
)
SELECT
    vc.service_id,
    NULL::uuid,  -- views are anonymous in MVP
    NOW() - (random() * INTERVAL '60 days')
FROM view_counts vc
CROSS JOIN LATERAL generate_series(1, vc.views) gs;

-- ============================================================================
-- 3. Synthetic applications (~30 per service)
--
-- Each application has a "_synthetic_stop_at_step" in form_data:
--   NULL → user completed the full form (submitted/approved/rejected)
--   N    → user abandoned at step N (1-indexed)
--
-- Drop-off distributions per category:
--   • Leasing control case (титул содержит "лизинг" + "авиа"):
--       step 1: 20%,  STEP 2: 55% (the killer drop), step 3: 10%,
--       step 4: 7%, step 5: 5%, completed: 3%
--   • Other services: smoother funnel, ~25-30% drop per step.
--
-- The "killer drop" at step 2 of leasing encodes a high f_lease_amount
-- (500M–1.2B ₸, median ~800M) — above the typical BRK program limit.
-- This drives the drilldown insight "лимит ниже реальной потребности".
-- ============================================================================

INSERT INTO applications (service_id, user_id, form_data, status, is_synthetic, created_at)
WITH numbered_users AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY iin) AS rn
    FROM users WHERE is_synthetic = TRUE
),
plans AS (
    SELECT
        s.id    AS service_id,
        s.title AS service_title,
        jsonb_array_length(s.form_schema->'steps') AS num_steps,
        ROW_NUMBER() OVER ()    AS plan_idx,
        random()                AS r1,
        random()                AS r2,
        random()                AS r3
    FROM services s
    CROSS JOIN LATERAL generate_series(
        1,
        CASE
            WHEN s.title ILIKE '%авиа%' AND s.title ILIKE '%лизинг%' THEN 250
            WHEN s.category IN ('Финансирование','Лизинг','Субсидии','Гарантии') THEN 120
            ELSE 60
        END
    ) gs
),
plans_classified AS (
    SELECT
        *,
        -- Stop step distribution: NULL = completed, otherwise step index (1-based)
        CASE
            WHEN (service_title ILIKE '%авиа%' AND service_title ILIKE '%лизинг%') THEN
                CASE
                    WHEN r1 < 0.15 THEN 1
                    WHEN r1 < 0.30 THEN 2
                    WHEN r1 < 0.80 THEN 3   -- KILLER DROP: финансовая модель / сумма лизинга
                    WHEN r1 < 0.88 THEN 4
                    WHEN r1 < 0.95 THEN 5
                    ELSE NULL
                END
            ELSE
                CASE
                    WHEN r1 < 0.28 THEN 1
                    WHEN r1 < 0.55 THEN 2
                    WHEN r1 < 0.74 THEN 3
                    WHEN r1 < 0.85 THEN LEAST(4, num_steps)
                    ELSE NULL
                END
        END AS stopped_at_step,
        -- For leasing killer drop — synthetic amount above program limit
        (500000000 + r2 * 700000000)::bigint AS lease_amount,
        -- Created timestamp distributed over last 30 days
        NOW() - (r3 * INTERVAL '30 days') AS created_at
    FROM plans
)
SELECT
    p.service_id,
    u.id,
    jsonb_build_object(
        '_synthetic_stop_at_step', p.stopped_at_step,
        '_synthetic_lease_amount', p.lease_amount
    ),
    CASE
        WHEN p.stopped_at_step IS NULL THEN
            (ARRAY['submitted','in_review','approved','rejected']::application_status[])
                [1 + floor(p.r2 * 4)::int]
        ELSE 'draft'::application_status
    END,
    TRUE,
    p.created_at
FROM plans_classified p
JOIN numbered_users u ON u.rn = ((p.plan_idx - 1) % 3000) + 1;

-- ============================================================================
-- 4. Synthetic application_events
--
-- For each synthetic application, emit step events up to its stop point:
--   • Completed steps (index < stop_at_step - 1): "entered" + "completed"
--   • Stop step (index = stop_at_step - 1): "entered" + "abandoned"
--   • If stop_at_step IS NULL: "entered" + "completed" for all steps
--
-- The abandoned event of leasing step 2 carries last_field_id = 'f_lease_amount'
-- with the synthesized amount — this is what drives the drilldown insight.
-- ============================================================================

INSERT INTO application_events (application_id, step_id, step_index, event_type, last_field_id, last_field_value, created_at)
WITH apps AS (
    SELECT
        a.id          AS application_id,
        a.created_at  AS app_created,
        a.form_data,
        s.title       AS service_title,
        s.form_schema->'steps' AS steps,
        jsonb_array_length(s.form_schema->'steps') AS num_steps,
        (a.form_data->>'_synthetic_stop_at_step')::int AS stop_at_step,
        (a.form_data->>'_synthetic_lease_amount')::bigint AS lease_amount
    FROM applications a
    JOIN services s ON s.id = a.service_id
    WHERE a.is_synthetic = TRUE
),
expanded AS (
    -- One row per (application, step_index) up to the highest step the user reached.
    -- If stop_at_step IS NULL → all steps (0..num_steps-1)
    -- Else → steps 0..(stop_at_step - 1)
    SELECT
        a.application_id,
        a.service_title,
        a.app_created,
        a.stop_at_step,
        a.lease_amount,
        a.num_steps,
        gs AS step_index,
        a.steps->gs->>'id' AS step_id
    FROM apps a
    CROSS JOIN LATERAL generate_series(
        0,
        LEAST(COALESCE(a.stop_at_step, a.num_steps + 1) - 1, a.num_steps - 1)
    ) gs
),
events_entered AS (
    SELECT
        application_id, step_id, step_index,
        'entered'::varchar AS event_type,
        NULL::varchar      AS last_field_id,
        NULL::text         AS last_field_value,
        app_created + (step_index * INTERVAL '40 seconds') AS created_at
    FROM expanded
),
events_completed_or_abandoned AS (
    SELECT
        application_id, step_id, step_index,
        CASE
            WHEN stop_at_step IS NULL THEN 'completed'::varchar
            WHEN step_index + 1 < stop_at_step THEN 'completed'::varchar
            WHEN step_index + 1 = stop_at_step THEN 'abandoned'::varchar
            ELSE 'completed'::varchar
        END AS event_type,
        CASE
            WHEN (service_title ILIKE '%авиа%' AND service_title ILIKE '%лизинг%')
                 AND stop_at_step = 3
                 AND step_index + 1 = stop_at_step
            THEN 'f_lease_amount'::varchar
            ELSE NULL::varchar
        END AS last_field_id,
        CASE
            WHEN (service_title ILIKE '%авиа%' AND service_title ILIKE '%лизинг%')
                 AND stop_at_step = 3
                 AND step_index + 1 = stop_at_step
            THEN lease_amount::text
            ELSE NULL::text
        END AS last_field_value,
        app_created + (step_index * INTERVAL '40 seconds') + INTERVAL '25 seconds' AS created_at
    FROM expanded
)
SELECT * FROM events_entered
UNION ALL
SELECT * FROM events_completed_or_abandoned;
