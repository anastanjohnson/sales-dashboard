-- Additive only: preserve existing salary tables, manual entries and deletion records.
CREATE TABLE dashboard_private.firebase_config (
  id text PRIMARY KEY,
  value jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE dashboard_private.firebase_sessions (
  token_hash text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'salary-payment')),
  expires_at timestamptz NOT NULL
);
CREATE INDEX firebase_sessions_expiry ON dashboard_private.firebase_sessions (expires_at);
CREATE TABLE dashboard_private.firebase_rate_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  reset_at timestamptz NOT NULL
);
ALTER TABLE dashboard_private.firebase_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_private.firebase_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_private.firebase_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dashboard_private.firebase_config, dashboard_private.firebase_sessions, dashboard_private.firebase_rate_limits FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE dashboard_private.firebase_config IS 'Server-only Render source snapshot; never expose through Data API';
