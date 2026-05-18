-- 006_funnel: rollback

DELETE FROM applications WHERE is_synthetic = TRUE;

DROP INDEX IF EXISTS idx_applications_synthetic;
ALTER TABLE applications DROP COLUMN IF EXISTS is_synthetic;

DROP INDEX IF EXISTS idx_app_events_type;
DROP INDEX IF EXISTS idx_app_events_step;
DROP INDEX IF EXISTS idx_app_events_app;
DROP TABLE IF EXISTS application_events;

DROP INDEX IF EXISTS idx_service_views_created;
DROP INDEX IF EXISTS idx_service_views_service;
DROP TABLE IF EXISTS service_views;
