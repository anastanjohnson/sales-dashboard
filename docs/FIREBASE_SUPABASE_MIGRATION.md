# Firebase + Supabase migration

Status: preparation only, 29 September 2026. Not deployed and not yet a working Firebase backend.

## Scope

- Repository: anastanjohnson/sales-dashboard, branch firebase-supabase.
- Start from secure-dashboard commit 40b9e352f966e4317bee818ae45c88d20f4310c6 (includes latest UI and guest corrections).
- Leave secure-dashboard, Render, main, and the public dashboard unchanged.
- Replace only Cloud Run sales-dashboard-supabase in tidy-groove-496114-i4 / europe-west1 after full verification.
- Firebase project: karikaala-sales-dashboard. Observed Spark plan. Use Firebase Hosting; do not add Cloud Run rewrites or Firebase App Hosting.
- Existing Supabase project: wwidrvwkfltwrexzxvyl (karikaala-dashboard).
- Do not use the separate KARIKAALA Staff Planner project.

## Verified existing state

Supabase keeps dashboard_private.salary_months, salary_entries, salary_entry_deletions, salary_payments, and app_migrations. RLS is enabled on these tables. The public schema has no tables and no Edge Functions were present at inspection. Preserve private schema and existing records. An empty public schema does not mean the dashboard database is empty.

The Node server also consumes salary source data, salary payment source data, staff hours, weekly revenue, guests, benchmarks and overrides from its runtime environment. The Supabase database alone does not contain the entire application state. Inspect the Cloud Run copy's actual source, TLS/search-path patches, configuration and secret references before changing its backend. Do not copy Render configuration over it.

Both Cloud Run Console and embedded Cloud Shell were unavailable in this session. Firebase Console itself was accessible. No Cloud Run export or Firebase deployment credential has been obtained.

## Prepared files

- firebase.json and .firebaserc: static SPA hosting configuration targeting the existing Firebase project.
- scripts/check-firebase-migration.mjs: intentional predeploy stop, because publishing the unchanged frontend would leave /api calls without a backend.
- scripts/export-cloud-run-config.py: read-only local export of the exact service, with private file permissions. Does not resolve Secret Manager references or print values.
- .gitignore: excludes private migration exports and local credential files.

## Next implementation steps

1. On an authenticated local machine, run python3 scripts/export-cloud-run-config.py. Keep its output local and private; do not commit or paste it in chat. Separately recover the actual deployed source and authorized Secret Manager values into protected local storage as needed.
2. Back up the existing private tables and configuration. Reconcile source data with private manual records, preserving deletion markers. Record totals and checksums privately.
3. Adapt login/session handling to Supabase Auth. Preserve admin and salary-payment role distinctions with server-controlled authorization; do not trust editable user metadata. Existing login credentials cannot be assumed portable.
4. Port the endpoint contracts below to authenticated Supabase operations or Edge Functions. Keep sensitive source datasets server-side. Do not bundle salaries, staff records, database credentials or service-role keys in Vite assets.
5. Update frontend API calls and login/logout flows. Firebase SPA rewrites do not implement the current /api endpoints. Add exact allowed-origin CORS and token validation for the new API.
6. Configure Firebase deployment credentials through an approved secure flow. GitHub deployment automation is not connected yet. Firebase's official setup is firebase init hosting:github; review its proposed permissions before granting access. Scope any eventual workflow to firebase-supabase, never secure-dashboard.
7. Replace the predeploy stop with actual readiness checks only after the acceptance checklist passes. Publish to a test/preview channel first. Preview URLs can still use the real database: do not perform disposable write tests against real staff records.
8. Switch the Cloud Run site's users to the verified Firebase URL or custom domain. Retire Cloud Run only after acceptance and a rollback window. A run.app URL cannot simply become a Firebase Hosting URL.

## Endpoint contracts to preserve

| Existing endpoint | Behavior |
|---|---|
| /api/session, /api/login, /api/logout | Authentication and role-aware session state |
| GET /api/salary | Admin-only salary view with manual overrides and deletions |
| GET /api/salary-payment-source | Role-dependent source periods |
| GET /api/salary-payment-staff | Salary-payment role roster |
| POST /api/salary-months | Salary-payment role opens a month |
| PUT/DELETE /api/salary-entry | Validated salary/tips edits and deletion markers; transactional behavior |
| GET/PUT /api/salary-payments | Validate employee, amount and date; preserve payment persistence |
| GET /api/staff-hours | Admin-only protected hours |
| GET /api/weekly-performance | Admin-only revenue aggregation |
| GET /api/weekly-guests | Admin-only guest aggregation |
| GET /api/weekly-benchmarks | Admin-only comparison data |

## Acceptance checklist

- [ ] Recover and reconcile Cloud Run source/configuration and private data.
- [ ] Create/activate intended login accounts securely; verify both existing roles.
- [ ] Anonymous requests cannot read protected data or write records.
- [ ] Restricted users cannot access admin-only data, including direct API requests.
- [ ] All report periods, manual entries, deletion markers and totals match the source copy.
- [ ] Payment save/reload, salary edits/deletion and opening months work in an isolated test fixture.
- [ ] Desktop/mobile navigation, themes and Shift Planner screen work.
- [ ] Firebase preview works without Cloud Run or Render as its API backend.
- [ ] Deployment credentials and automatic deployment branch are verified.
- [ ] Render branch and live site remain unchanged.
- [ ] Approved cutover and rollback plan completed before Cloud Run retirement.

Official references: https://firebase.google.com/docs/hosting/full-config and https://firebase.google.com/docs/hosting/github-integration
