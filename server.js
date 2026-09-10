import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pg from "pg";

const { Pool } = pg;
const required = ["DASHBOARD_USERNAME", "DASHBOARD_PASSWORD_HASH", "SESSION_SECRET", "SALARY_DATA_JSON", "SALARY_PAYMENT_DATA_JSON", "STAFF_HOURS_DATA_JSON", "WEEKLY_PERFORMANCE_DATA_JSON", "WEEKLY_BENCHMARKS_DATA_JSON", "DATABASE_URL"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT || 10000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const salaryData = JSON.parse(process.env.SALARY_DATA_JSON);
const salaryDataOverrides = JSON.parse(process.env.SALARY_DATA_OVERRIDES_JSON || "[]");
const normalizedSalaryData = salaryData.map((period) => {
  const override = salaryDataOverrides.find((entry) =>
    Number(entry.year) === Number(period.year)
    && String(entry.month || "").slice(0, 3).toLowerCase() === String(period.month || "").slice(0, 3).toLowerCase()
  );
  return override ? { ...period, ...override } : period;
});
const salaryPaymentSourceData = JSON.parse(process.env.SALARY_PAYMENT_DATA_JSON);

const staffHoursData = JSON.parse(process.env.STAFF_HOURS_DATA_JSON);
const staffHoursAppend = JSON.parse(process.env.STAFF_HOURS_APPEND_JSON || "[]");
const staffHoursOverrides = JSON.parse(process.env.STAFF_HOURS_OVERRIDES_JSON || "[]");
const staffHoursExclusions = JSON.parse(process.env.STAFF_HOURS_EXCLUSIONS_JSON || "[]");
const appendedStaffHoursData = [...staffHoursData];
staffHoursAppend.forEach((entry) => {
  const index = appendedStaffHoursData.findIndex((period) =>
    Number(period.year) === Number(entry.year)
    && String(period.month || "").slice(0, 3).toLowerCase() === String(entry.month || "").slice(0, 3).toLowerCase()
  );
  if (index >= 0) appendedStaffHoursData[index] = { ...appendedStaffHoursData[index], ...entry };
  else appendedStaffHoursData.push(entry);
});
const overriddenStaffHoursData = appendedStaffHoursData.map((period) => {
  const override = staffHoursOverrides.find((entry) =>
    Number(entry.year) === Number(period.year)
    && String(entry.month || "").slice(0, 3).toLowerCase() === String(period.month || "").slice(0, 3).toLowerCase()
  );
  return override ? { ...period, ...override } : period;
});

const normalizedStaffHoursData = overriddenStaffHoursData.map((period) => {
  const exclusion = staffHoursExclusions.find((rule) =>
    Number(rule.year) === Number(period.year)
    && String(rule.month || "").slice(0, 3).toLowerCase() === String(period.month || "").slice(0, 3).toLowerCase()
  );
  if (!exclusion || !Array.isArray(period.employees)) return period;
  const excludedNames = new Set((exclusion.names || []).map((name) => String(name).trim().toLowerCase()));
  return {
    ...period,
    employees: period.employees.filter((employee) => !excludedNames.has(String(employee.name || "").trim().toLowerCase())),
  };
});
const weeklyPerformanceData = JSON.parse(process.env.WEEKLY_PERFORMANCE_DATA_JSON);
const weeklyPerformanceAppend = JSON.parse(process.env.WEEKLY_PERFORMANCE_APPEND_JSON || "[]");
const weeklyGuestAppendData = JSON.parse(process.env.WEEKLY_GUEST_APPEND_JSON || "[]");
const weeklyPerformanceOverrides = JSON.parse(process.env.WEEKLY_PERFORMANCE_OVERRIDES_JSON || "[]");
const appendedWeeklyPerformanceData = [...weeklyPerformanceData];
weeklyPerformanceAppend.forEach((entry) => {
  const index = appendedWeeklyPerformanceData.findIndex((week) =>
    week.id === entry.id || Number(week.weekNumber) === Number(entry.weekNumber)
  );
  if (index >= 0) appendedWeeklyPerformanceData[index] = { ...appendedWeeklyPerformanceData[index], ...entry };
  else appendedWeeklyPerformanceData.push(entry);
});
const normalizedWeeklyPerformanceData = appendedWeeklyPerformanceData.map((week) => {
  const override = weeklyPerformanceOverrides.find((entry) => entry.id === week.id || Number(entry.weekNumber) === Number(week.weekNumber));
  if (!override) return week;
  const overrideDays = Array.isArray(override.days) ? override.days : [];
  return {
    ...week,
    ...override,
    days: (week.days || []).map((day) => ({
      ...day,
      ...(overrideDays.find((entry) => entry.currentDate === day.currentDate || entry.day === day.day) || {}),
    })),
  };
});
const weeklyBenchmarksData = JSON.parse(process.env.WEEKLY_BENCHMARKS_DATA_JSON);
const database = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
const cookieName = "kk_management_session";
const sessionDurationSeconds = 8 * 60 * 60;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: "10kb" }));

const parseCookies = (header = "") =>
  Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key]) => key));

const sign = (value) => crypto.createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("base64url");

const createSession = () => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + sessionDurationSeconds })).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const validSession = (req) => {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

const verifyPassword = (password) => {
  const [saltHex, expectedHex] = process.env.DASHBOARD_PASSWORD_HASH.split(":");
  if (!saltHex || !expectedHex) return false;
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const requireAuth = (req, res, next) => {
  if (!validSession(req)) return res.status(401).json({ error: "Authentication required" });
  res.set("Cache-Control", "no-store");
  next();
};

const requireSameOrigin = (req, res, next) => {
  const origin = req.get("origin");
  if (!origin) return res.status(403).json({ error: "Request origin is required." });
  try {
    if (new URL(origin).host !== req.get("host")) return res.status(403).json({ error: "Invalid request origin." });
  } catch {
    return res.status(403).json({ error: "Invalid request origin." });
  }
  next();
};

const paymentWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many payment updates. Please wait and try again." },
});

const monthKey = (value) => String(value || "").trim().slice(0, 3).toLowerCase();
const findSalaryPaymentEmployee = ({ year, month, employeeName, department }) => {
  const period = salaryPaymentSourceData.find((entry) =>
    Number(entry.year) === Number(year) && monthKey(entry.month) === monthKey(month)
  );
  if (!period) return null;
  const employee = (period.employees || []).find((entry) =>
    String(entry.name || "").trim().toLowerCase() === String(employeeName || "").trim().toLowerCase()
    && String(entry.department || "").trim().toLowerCase() === String(department || "").trim().toLowerCase()
  );
  return employee ? { period, employee } : null;
};

const parsePaidAmount = (value) => {
  if (value === "" || value == null) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000
    ? Math.round((amount + Number.EPSILON) * 100) / 100
    : undefined;
};

const parsePaidDate = (value) => {
  if (value === "" || value == null) return null;
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : undefined;
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/session", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ authenticated: validSession(req) });
});

app.post("/api/login", loginLimiter, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const usernameMatches = username.toLowerCase() === process.env.DASHBOARD_USERNAME.toLowerCase();
  if (!usernameMatches || !verifyPassword(password)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  res.cookie(cookieName, createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: sessionDurationSeconds * 1000,
    path: "/",
  });
  res.json({ authenticated: true });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" });
  res.json({ authenticated: false });
});

app.get("/api/salary", requireAuth, (_req, res) => res.json(normalizedSalaryData));
app.get("/api/salary-payment-source", requireAuth, (_req, res) => res.json(salaryPaymentSourceData));
app.get("/api/salary-payments", requireAuth, async (_req, res, next) => {
  try {
    const result = await database.query(`
      SELECT period_year AS "year", period_month AS "month", employee_name AS "employeeName",
             department, paid_amount::float8 AS "paidAmount", paid_date::text AS "paidDate",
             updated_at AS "updatedAt"
      FROM salary_payments
      ORDER BY period_year, period_month, department, employee_name
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
app.put("/api/salary-payments", requireAuth, requireSameOrigin, paymentWriteLimiter, async (req, res, next) => {
  const year = Number(req.body?.year);
  const month = String(req.body?.month || "").trim();
  const employeeName = String(req.body?.employeeName || "").trim();
  const department = String(req.body?.department || "").trim();
  const paidAmount = parsePaidAmount(req.body?.paidAmount);
  const paidDate = parsePaidDate(req.body?.paidDate);
  const salaryMatch = findSalaryPaymentEmployee({ year, month, employeeName, department });

  if (!Number.isInteger(year) || !month || !employeeName || !department || !salaryMatch) {
    return res.status(400).json({ error: "Select a valid salary employee and month." });
  }
  if (paidAmount === undefined) return res.status(400).json({ error: "Paid Amount must be a valid positive amount." });
  if (paidDate === undefined) return res.status(400).json({ error: "Paid Date must be a valid date." });

  try {
    const result = await database.query(`
      INSERT INTO salary_payments
        (period_year, period_month, employee_name, department, paid_amount, paid_date, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (period_year, period_month, employee_name, department)
      DO UPDATE SET paid_amount = EXCLUDED.paid_amount, paid_date = EXCLUDED.paid_date, updated_at = NOW()
      RETURNING period_year AS "year", period_month AS "month", employee_name AS "employeeName",
                department, paid_amount::float8 AS "paidAmount", paid_date::text AS "paidDate",
                updated_at AS "updatedAt"
    `, [year, salaryMatch.period.month, salaryMatch.employee.name, salaryMatch.employee.department, paidAmount, paidDate]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
app.get("/api/staff-hours", requireAuth, (_req, res) => res.json(normalizedStaffHoursData));
app.get("/api/weekly-performance", requireAuth, (_req, res) => res.json(normalizedWeeklyPerformanceData));
app.get("/api/weekly-guests", requireAuth, (_req, res) => res.json(weeklyGuestAppendData));
app.get("/api/weekly-benchmarks", requireAuth, (_req, res) => res.json(weeklyBenchmarksData));

app.use(express.static(path.join(__dirname, "dist"), {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-store");
  },
}));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error?.message || error);
  if (!res.headersSent) res.status(500).json({ error: "The requested update could not be completed." });
});

const start = async () => {
  await database.query(`
    CREATE TABLE IF NOT EXISTS salary_payments (
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
  `);
  for (const period of salaryPaymentSourceData) {
    for (const employee of period.employees || []) {
      const paidAmount = parsePaidAmount(employee.paidAmount);
      const paidDate = parsePaidDate(employee.paidDate);
      if ((paidAmount == null && paidDate == null) || paidAmount === undefined || paidDate === undefined) continue;
      await database.query(`
        INSERT INTO salary_payments
          (period_year, period_month, employee_name, department, paid_amount, paid_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (period_year, period_month, employee_name, department) DO NOTHING
      `, [Number(period.year), period.month, employee.name, employee.department, paidAmount, paidDate]);
    }
  }
  app.listen(port, "0.0.0.0", () => console.log(`Secure dashboard listening on port ${port}`));
};

start().catch((error) => {
  console.error("Unable to initialize the secure dashboard database:", error?.message || error);
  process.exit(1);
});
