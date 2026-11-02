-- Additive only: preserve existing targets, allowed dishes, saved rows and versions.
ALTER TABLE dashboard_private.menu_rotation_months
  ADD COLUMN IF NOT EXISTS available_at timestamptz;
COMMENT ON COLUMN dashboard_private.menu_rotation_months.available_at IS
  'Optional UTC menu availability instant, configured by Anastan and read-only for Admin.';
