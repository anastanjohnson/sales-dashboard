# Separate KARIKAALA dashboard

## Deployment status — 16 September 2026

The original Render service and `secure-dashboard` branch are unchanged.
This branch started at `2fa7919d0855bb9b9d2d60babd9f7863ef2bf40d`.
All frontend code, styles, assets, login behavior and application permissions are unchanged.

Supabase project `wwidrvwkfltwrexzxvyl` (`karikaala-dashboard`) was created in
`anastan Org`, Frankfurt (`eu-central-1`), on the Free plan ($0/month at creation).

The five database tables were copied using a read-only source snapshot into
the new `dashboard_private` schema and compared record for record:

| Table | Records |
| --- | ---: |
| salary_entries | 12 |
| salary_entry_deletions | 7 |
| salary_months | 1 |
| app_migrations | 1 |
| salary_payments | 0 |

These are a point-in-time copy, not ongoing synchronization. The original
empty payment table and deletion markers were preserved exactly. No employee
records or credentials are stored in this repository.

Every copied table has RLS enabled. `anon` and `authenticated` have no schema
or table access. Supabase security advisors returned no findings.

## Remaining prerequisites

The website has **not** been deployed. Google Cloud Console returned
"Site Unavailable" in the working browser; no Google Cloud resources were
created or modified. The following work still requires authenticated access:

1. Read the current protected configuration from the original Render service
   (`srv-da25qspt0dsc73b5ue60`) without editing it. Copy the two username/password
   hashes and all current dataset environment variables and overrides to the
   new service's protected configuration. GitHub does not contain these values.
   Do not reconstruct source configuration from merged API responses because
   that can apply overrides twice or restore deleted entries.
2. Provision a dedicated Supabase database login inheriting
   `karikaala_dashboard_app`, with no elevated privileges. Store its credentials
   only in the new service's secret configuration. Use the project's actual
   Session pooler connection details from the Supabase Connect panel; do not
   guess its pooler hostname. This app uses session-scoped `search_path`.
3. Obtain the project CA if needed for verified TLS. Set `DATABASE_CA_CERT` to
   its PEM contents. Certificate verification must stay enabled.
4. Configure a new Cloud Run service named `sales-dashboard-supabase` in project
   `tidy-groove-496114-i4`. Do not replace the existing `salesdashboard` service.
   Use this branch's Dockerfile, container port 8080, one maximum instance at
   first, zero minimum instances, and a 512 MiB memory limit. Confirm the actual
   Cloud billing configuration before deploying; Supabase's $0 price does not
   cover Google Cloud usage or container build/storage charges.
5. Set `NODE_ENV=production` and `DATABASE_PREPROVISIONED=true`. The latter
   prevents startup DDL or seeding over the copied database state. Give the new
   service a fresh `SESSION_SECRET`; retain both existing login password hashes.
6. Supply all required data configuration listed at the beginning of `server.js`
   plus every currently used optional dataset variable. Keep the connection URL
   scoped to the **new Supabase** database. Do not use Render's `DATABASE_URL`.
   Check source sizes against Cloud Run's configuration limits and use protected
   file mounts if necessary before publishing.
7. Recheck the Render database for changes since this snapshot before opening
   the new copy for use. Resolve changes deliberately; never blindly overwrite
   new salary edits made independently in either database.

The restricted server role can read/write only these private tables and use
their sequences. It cannot change schema or update migration history. Browser
clients continue using the existing protected `/api/*` routes, not Supabase's
Data API. No Supabase key should be added to the React bundle.

## Verification completed

- `npm ci --no-audit --no-fund` and `npm run build` succeeded.
- `node --test database-config.test.js` passed all three security checks.
- `node --check server.js` succeeded.
- Frontend files are unchanged from the original branch.
- Supabase contents equal the source snapshot; public/API-role access is denied.

Docker image execution, both login roles, browser appearance, API dataset totals,
and save/delete behavior on the new website remain untested because it has not
been deployed. Test writes must use an isolated test record and leave copied
production records intact. After testing, confirm the Render service is still
on its original deployment.

## Keeping both websites identical

This branch provides the same frontend and behavior with a different database
connection. It does not add automatic Git synchronization or bidirectional data
sync. Future code, spreadsheet refreshes and salary edits can diverge. Establish
a single authoritative write location and an explicit replication/refresh
workflow before treating the two sites as interchangeable live systems.

## Schema record

`database/schema.sql` records the schema applied to the new Supabase project.
It contains no live data. Do not reapply it on every application start. The
Supabase migration history records `isolated_dashboard_schema`.

References:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/psql
- https://cloud.google.com/run/docs/configuring/services/containers
