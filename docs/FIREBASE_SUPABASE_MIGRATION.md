# Firebase + Supabase migration

## Scope and status

Source: current Render deployment on `secure-dashboard`, commit `40b9e352f966e4317bee818ae45c88d20f4310c6`.
Migration branch: `firebase-supabase`. Render, its database, and Cloud Run are not modified.
Firebase project: `karikaala-sales-dashboard`. Supabase project: `wwidrvwkfltwrexzxvyl`.

The Supabase `dashboard-api` Edge Function is deployed. The private Render environment snapshot was imported on 2026-09-29, excluding the Render database connection and session secret. Existing Supabase manual salary entries, opened months, payments and deletion records were retained. Render's database could not be accessed directly; its independent database edits have not been imported or reconciled. Existing Supabase records are the authoritative manual state for this migration.

Firebase Hosting is published at https://karikaala-sales-dashboard.web.app/ (2026-09-29). GitHub Actions run 36558057156 completed successfully. Administrator login, logout, reporting, 2026-09-28 guest count 37, weekly guests 249, Shift Planner preview and bottom-left account controls were verified in the live browser. The second secure sign-in used the administrator account again; live restricted-account verification and isolated financial-write verification remain pending. Cloud Run has not been retired and DNS has not been changed.

## Backend and authentication

The frontend uses `VITE_DASHBOARD_API_URL` to select the Supabase API. Without it, existing same-origin Render behavior is preserved. All existing API routes are ported, including transactional salary changes and payment validation.

Credentials remain username/password with the existing scrypt hashes. Raw passwords are not exported or stored. Firebase login returns a random 256-bit opaque bearer token; only its SHA-256 hash is stored in the private database, with an eight-hour expiry. The browser stores it in sessionStorage. Logout revokes the server session. This is custom dashboard authentication, not Supabase Auth.

API role middleware preserves administrator and salary-payment restrictions. Login counters use atomic Postgres upserts shared across Edge Function instances (8 attempts per role or unknown-user bucket per 15 minutes). Writes allow 60 requests per role per minute. Login throttling is shared by users of the same role; repeated failed attempts can temporarily block that role.

Only the two Firebase project origins are allowed. New custom domains require an explicit API allowlist update. All API responses use `Cache-Control: no-store`. Hosting applies CSP, clickjacking protection and restrictive browser permissions. No database URLs, service-role keys, password hashes, salary source data or deployment keys belong in Vite environment variables or browser bundles.

New tables in `dashboard_private` have RLS enabled and no grants to anon/authenticated. The schema must remain unexposed in the Data API. Edge Functions access it server-side with the built-in `SUPABASE_DB_URL`. Password/config changes require updating the private configuration and redeploying the function to refresh its startup snapshot.

## Validation

Run `node --test tests/firebase-api.test.mjs` for anonymous access, role boundaries, login/logout, origin restrictions, invalid write rejection and throttling checks. Test fixtures use synthetic credentials and no production writes.

The deployment guard checks live API health and anonymous denial for salary/payment endpoints. It also requires the approved API URL. Production login must then be verified with both roles through the secure browser sign-in flow. Validate reporting totals, 2026-09-28 guest count 37, salary months, saved payments, sidebar controls and mobile layout. Financial write/transaction behavior should be exercised against isolated test data before go-live; no production payment records were altered for testing.

## Publish from a trusted signed-in workstation

```sh
git switch firebase-supabase
npm ci
node --test tests/firebase-api.test.mjs
npx firebase-tools@15.32.0 login
export VITE_DASHBOARD_API_URL=https://wwidrvwkfltwrexzxvyl.supabase.co/functions/v1/dashboard-api
npx firebase-tools@15.32.0 deploy --only hosting --project karikaala-sales-dashboard
```

Alternatively, the GitHub workflow builds/tests pushes to this branch and offers a manual deployment action. Configure the repository secret `FIREBASE_HOSTING_DEPLOY_CREDENTIAL` with an approved deployment service-account JSON and set the repository variable `FIREBASE_HOSTING_DEPLOY_ENABLED=true` to deploy subsequent pushes to this branch. Manual dispatch with `deploy=true` is also supported once GitHub exposes that workflow on the default branch. Prefer a dedicated Hosting deployment account with minimum required permissions; do not commit credentials. Credential provisioning requires owner approval. The workflow does not update Render or deploy Supabase functions.

The owner approved generating a Firebase service-account key and storing it as the encrypted GitHub Actions secret. `FIREBASE_HOSTING_DEPLOY_ENABLED=true` is configured. Publishing runs on GitHub because this workspace cannot resolve Google deployment API hosts. Google Cloud IAM and Cloud Shell are unavailable in this browser.

Security follow-up: the credential was unexpectedly included in a browser tool trace while the secret form was submitting. It was not committed to GitHub source code. Revoke and replace that credential, then update the encrypted deployment secret. Key revocation/rotation has not been completed.

## Maintenance

Deploy backend changes with `supabase functions deploy dashboard-api --project-ref wwidrvwkfltwrexzxvyl`. The `verify_jwt=false` setting is required because this function validates its own server-side sessions; never remove its authentication middleware. Keep the `data` modules bundled with the function synchronized with approved reporting changes in `src/data`. The SQL migration adds new private tables only and must be applied once. Never rerun imports by overwriting existing salary records.

Rollback frontend changes using Firebase Hosting release rollback. Keep Render available throughout migration. Revert only the migration branch when needed; do not overwrite `secure-dashboard`.
