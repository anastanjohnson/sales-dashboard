import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { scrypt } from "@noble/hashes/scrypt";

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const tokenFrom = (req) => /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") || "")?.[1];
export function verifyPassword(password, encoded) {
  const [saltHex, expectedHex] = String(encoded || "").split(":");
  if (!/^[a-f0-9]+$/i.test(saltHex || "") || !/^[a-f0-9]{128}$/i.test(expectedHex || "")) return false;
  const actual = scrypt(password, Buffer.from(saltHex, "hex"), { N: 16384, r: 8, p: 1, dkLen: 64 });
  return crypto.timingSafeEqual(actual, Buffer.from(expectedHex, "hex"));
}
export function createSecurity(database, config, allowedOrigins) {
  async function getSession(req) {
    const token = tokenFrom(req);
    if (!token) return null;
    const result = await database.query(`SELECT role FROM dashboard_private.firebase_sessions
      WHERE token_hash = $1 AND expires_at > now()`, [hash(token)]);
    return result.rows[0] || null;
  }
  // Atomic shared counters keep limits effective across all Edge Function instances.
  async function allow(bucket, limit, seconds) {
    const result = await database.query(`INSERT INTO dashboard_private.firebase_rate_limits (bucket, attempts, reset_at)
      VALUES ($1, 1, now() + $2 * interval '1 second')
      ON CONFLICT (bucket) DO UPDATE SET
        attempts = CASE WHEN firebase_rate_limits.reset_at <= now() THEN 1 ELSE firebase_rate_limits.attempts + 1 END,
        reset_at = CASE WHEN firebase_rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE firebase_rate_limits.reset_at END
      RETURNING attempts`, [bucket, seconds]);
    return result.rows[0].attempts <= limit;
  }
  const requireAuth = asyncRoute(async (req, res, next) => {
    req.session = await getSession(req);
    if (!req.session) return res.status(401).json({ error: "Authentication required" });
    next();
  });
  const requireAdmin = (req, res, next) => req.session?.role === "admin" ? next() : res.status(403).json({ error: "Administrator access required" });
  const requireSalaryPayment = (req, res, next) => req.session?.role === "salary-payment" ? next() : res.status(403).json({ error: "Salary payment access required" });
  const requireSameOrigin = (req, res, next) => allowedOrigins.includes(req.get("origin")) ? next() : res.status(403).json({ error: "Invalid request origin." });
  const paymentWriteLimiter = asyncRoute(async (req, res, next) => {
    if (!await allow(`writes:${req.session.role}`, 60, 60)) return res.status(429).json({ error: "Too many payment updates. Please wait and try again." });
    next();
  });
  function installAuth(app) {
    app.get("/health", (_req, res) => res.json({ status: "ok", backend: "supabase" }));
    app.get("/api/session", asyncRoute(async (req, res) => {
      const session = await getSession(req);
      res.json({ authenticated: Boolean(session), role: session?.role || null });
    }));
    app.post("/api/login", requireSameOrigin, asyncRoute(async (req, res) => {
      const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (username.length > 160 || password.length > 1024) return res.status(400).json({ error: "Invalid sign-in details." });
      const role = username === config.DASHBOARD_USERNAME.toLowerCase() ? "admin"
        : username === config.SALARY_PAYMENT_USERNAME.toLowerCase() ? "salary-payment" : null;
      // Fixed bucket set avoids an attacker creating unlimited database rows with random usernames.
      if (!await allow(`login:${role || "unknown"}`, 8, 900)) return res.status(429).json({ error: "Too many login attempts. Please try again later." });
      const encoded = role === "salary-payment" ? config.SALARY_PAYMENT_PASSWORD_HASH : config.DASHBOARD_PASSWORD_HASH;
      const valid = verifyPassword(password, encoded);
      if (!role || !valid) return res.status(401).json({ error: "Incorrect username or password." });
      const token = crypto.randomBytes(32).toString("hex");
      await database.query("DELETE FROM dashboard_private.firebase_sessions WHERE expires_at <= now()");
      await database.query(`INSERT INTO dashboard_private.firebase_sessions (token_hash, role, expires_at)
        VALUES ($1, $2, now() + interval '8 hours')`, [hash(token), role]);
      res.json({ authenticated: true, role, token });
    }));
    app.post("/api/logout", requireSameOrigin, asyncRoute(async (req, res) => {
      const token = tokenFrom(req);
      if (token) await database.query("DELETE FROM dashboard_private.firebase_sessions WHERE token_hash = $1", [hash(token)]);
      res.json({ authenticated: false });
    }));
  }
  return { requireAuth, requireAdmin, requireSalaryPayment, requireSameOrigin, paymentWriteLimiter, installAuth };
}
