-- Schema only. No employee data, passwords, or source snapshots belong here.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'karikaala_dashboard_app') THEN
    CREATE ROLE karikaala_dashboard_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
    CREATE TABLE IF NOT EXISTS dashboard_private.salary_months (
      period_year INTEGER NOT NULL CHECK (period_year = 2026),
      period_month VARCHAR(20) NOT NULL CHECK (period_month IN ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December')),
      PRIMARY KEY (period_year, period_month)
    );

    CREATE TABLE IF NOT EXISTS dashboard_private.app_migrations (
      migration_key VARCHAR(120) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dashboard_private.salary_entries (
      id BIGSERIAL PRIMARY KEY,
      period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
      period_month VARCHAR(20) NOT NULL,
      employee_name VARCHAR(160) NOT NULL,
      department VARCHAR(80) NOT NULL,
      salary NUMERIC(12, 2) NOT NULL CHECK (salary >= 0),
      tips NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tips >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (period_year, period_month, employee_name, department)
    );

    CREATE TABLE IF NOT EXISTS dashboard_private.salary_entry_deletions (
      id BIGSERIAL PRIMARY KEY,
      period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
      period_month VARCHAR(20) NOT NULL,
      employee_name VARCHAR(160) NOT NULL,
      department VARCHAR(80) NOT NULL,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (period_year, period_month, employee_name, department)
    );

    CREATE TABLE IF NOT EXISTS dashboard_private.salary_payments (
      id BIGSERIAL PRIMARY KEY,
      period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
      period_month VARCHAR(20) NOT NULL,
      employee_name VARCHAR(160) NOT NULL,
      department VARCHAR(80) NOT NULL,
      paid_amount NUMERIC(12, 2),
      paid_date DATE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (period_year, period_month, employee_name, department)
    )
;
ALTER TABLE dashboard_private.salary_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON dashboard_private.salary_months FOR ALL TO karikaala_dashboard_app USING (true) WITH CHECK (true);
ALTER TABLE dashboard_private.app_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON dashboard_private.app_migrations FOR ALL TO karikaala_dashboard_app USING (true) WITH CHECK (true);
ALTER TABLE dashboard_private.salary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON dashboard_private.salary_entries FOR ALL TO karikaala_dashboard_app USING (true) WITH CHECK (true);
ALTER TABLE dashboard_private.salary_entry_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON dashboard_private.salary_entry_deletions FOR ALL TO karikaala_dashboard_app USING (true) WITH CHECK (true);
ALTER TABLE dashboard_private.salary_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON dashboard_private.salary_payments FOR ALL TO karikaala_dashboard_app USING (true) WITH CHECK (true);
REVOKE ALL ON ALL TABLES IN SCHEMA dashboard_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA dashboard_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA dashboard_private TO karikaala_dashboard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dashboard_private TO karikaala_dashboard_app;
REVOKE INSERT, UPDATE, DELETE ON dashboard_private.app_migrations FROM karikaala_dashboard_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dashboard_private TO karikaala_dashboard_app;
