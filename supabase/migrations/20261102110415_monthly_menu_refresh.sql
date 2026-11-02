-- Server-only monthly rotation settings and chef changes. No existing data is altered.
CREATE TABLE IF NOT EXISTS dashboard_private.menu_rotation_months (
  month text PRIMARY KEY CHECK (month ~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'),
  target_count integer NOT NULL DEFAULT 0 CHECK (target_count >= 0),
  allowed_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allowed_item_ids) = 'array'),
  rows jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rows) = 'array'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dashboard_private.menu_rotation_months ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dashboard_private.menu_rotation_months FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE dashboard_private.menu_rotation_months IS 'Server-only monthly menu rotation; Anastan configures the target and allowed dishes, Admin fulfils changes.';
