-- 009_docs_requested_enum: add the "docs_requested" application status.
--
-- Two-stage applications: an admin can move a submitted application into
-- "docs_requested" ("Требуются данные") to ask the applicant for additional
-- data/documents (stage 2), after which it returns to "in_review".
--
-- IMPORTANT: a freshly added enum value cannot be USED in the same
-- transaction that adds it. This migration therefore ONLY adds the value;
-- everything that depends on it (columns, seed changes) lives in 010.

ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'docs_requested';
