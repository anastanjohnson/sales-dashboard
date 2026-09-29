# Native Shift Planner integration

Status: prepared for review; activation requires a server credential for the existing staff planner project and live verification. Do not deploy these branches until the connection is configured.

The previous iframe has been replaced by React controls that inherit the dashboard font and CSS theme tokens. Features include week/day boards, open-shift filtering, editable shift hours/breaks/roles/notes, assignment checks, presets, previous-roster and standard templates, staff editing, monthly hours, availability, draft/publish snapshots, roster copying, staff login links, direct/group conversations, unread counts and message history.

Data stays in the existing `karikaala-staff-planner` Firebase project using the same version-3 roster JSON, Firestore transaction revision, staff profiles/alerts, availability document IDs and chat paths as Flutter release 7f75b61. No data is copied from or written to the legacy Supabase planner project. Read does not initialize or overwrite missing data.

## Single sign-in

POST /api/planner/session requires the existing authenticated dashboard admin session, approved request origin and write rate limit. Salary-payment users are denied. The server signs a 60-second Firebase custom token for the verified existing planner manager UID; neither the UID nor project can be selected by a client. The browser exchanges the token through Firebase Auth and continues to use existing Firestore rules. The token response is never cached.

Firebase Auth uses in-memory persistence in an isolated named app. Leaving the planner or logging out clears this session. Each planner write checks the dashboard session; a 60-second heartbeat stops read subscriptions after session expiry. Firebase-issued ID/refresh tokens have the normal Firebase lifetime: local logout clears this browser, but is not a server-wide Firebase token revocation. The implementation does not revoke the separate staff app's sessions or change Firestore rules.

## Required server setup

Create or supply an authorized signing credential from `karikaala-staff-planner`, not the dashboard hosting project. Configure PLANNER_FIREBASE_SERVICE_ACCOUNT_JSON in the Render service's secret environment and the Supabase dashboard-api Edge Function secrets. Never use a VITE_ variable, commit it, return it to the browser, or paste it into chat. A missing/invalid credential returns 503 and no token.

After configuring the credential: deploy the dashboard-api function (including planner-session.js), merge the provider-specific branches and verify both websites with an admin session. Confirm Firestore accepts the manager token and that roster, staff, availability and chat reads succeed. Test mutation/notification behavior only in an emulator or explicitly authorized test data. Do not publish real rosters or send staff messages merely to verify deployment.

## Validation

Node tests cover overlapping overnight shifts, break validation, closed days, publication validation, immutable published snapshots, partial availability, templates/repeating weeks, monthly hours across month boundaries, signed token identity/expiry, missing-key behavior, anonymous/payroll rejection and origin checks. Both production builds are required. Live Firestore synchronization and browser visual verification remain pending until secure setup.
