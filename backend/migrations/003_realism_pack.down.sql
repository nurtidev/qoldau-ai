-- Revert realism pack: remove Damu services. Leasing form_schema rollback is best-effort
-- (we do not restore the original schema — re-running 001_init handles fresh installs).
DELETE FROM services
WHERE org_name = 'Damu'
  AND created_by = (SELECT id FROM users WHERE iin = '000000000000');