import pg from "pg";
import { createApp } from "./app.js";

const database = new pg.Pool({
  connectionString: Deno.env.get("SUPABASE_DB_URL"),
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});
const result = await database.query("SELECT value FROM dashboard_private.firebase_config WHERE id = 'render-source-v1'");
if (result.rows.length !== 1) throw new Error("Dashboard configuration has not been imported");
const plannerSecret = await database.query("SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dashboard_planner_service_account'");
const app = createApp(database, { ...result.rows[0].value, PLANNER_FIREBASE_SERVICE_ACCOUNT_JSON: Deno.env.get("PLANNER_FIREBASE_SERVICE_ACCOUNT_JSON") || plannerSecret.rows[0]?.decrypted_secret }, [
  "https://karikaala-sales-dashboard.web.app",
  "https://karikaala-sales-dashboard.firebaseapp.com",
]);
app.listen(8000);
