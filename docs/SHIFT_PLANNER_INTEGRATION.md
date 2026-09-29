# Live Shift Planner

The Shift Planner tab embeds the existing Flutter application from the requested GitHub Pages release URL. It replaces the sample roster with the full application: Plan, Staff, Published, Messages, staff availability and staff shifts.

The planner retains its own Firebase authentication and Firestore project `karikaala-staff-planner`. The legacy Supabase planner project `tyehobosgcyukavvucsv` is not migrated or modified. Dashboard authentication is separate; dashboard session tokens are never passed into the frame. Dashboard logout does not sign out the independent planner account.

The dashboard shell follows the dashboard theme; the embedded app retains its own design. Cross-origin isolation intentionally prevents the dashboard from reading the planner DOM or data. CSP permits frames only from the existing GitHub Pages origin. A reload button and separate-window link support recovery if embedded storage is restricted by a browser. The release query is an upstream cache version, not an immutable build pin; future GitHub Pages deployments update the embedded application.

Production verification must not publish schedules or send staff messages as test data.
