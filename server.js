import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pg from "pg";
import { mergeDailyRevenue } from "./src/data/weeklyPerformanceUtils.js";

const { Pool } = pg;
const required = ["DASHBOARD_USERNAME", "DASHBOARD_PASSWORD_HASH", "SALARY_PAYMENT_USERNAME", "SALARY_PAYMENT_PASSWORD_HASH", "SESSION_SECRET", "SALARY_DATA_JSON", "SALARY_PAYMENT_DATA_JSON", "STAFF_HOURS_DATA_JSON", "WEEKLY_PERFORMANCE_DATA_JSON", "WEEKLY_BENCHMARKS_DATA_JSON", "DATABASE_URL"];
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
// Verified daily time records replace only the supplied monthly periods.
const dailyStaffHoursData = JSON.parse(process.env.STAFF_HOURS_DAILY_SOURCE_JSON || "[]");
dailyStaffHoursData.forEach((entry) => {
  const index = normalizedStaffHoursData.findIndex((period) =>
    Number(period.year) === Number(entry.year)
    && String(period.month || "").slice(0, 3).toLowerCase() === String(entry.month || "").slice(0, 3).toLowerCase()
  );
  if (index >= 0) normalizedStaffHoursData[index] = { ...normalizedStaffHoursData[index], ...entry };
  else normalizedStaffHoursData.push(entry);
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
const refreshedWeeklyPerformanceData = mergeDailyRevenue(
  normalizedWeeklyPerformanceData, weeklyBenchmarksData,
  JSON.parse(process.env.WEEKLY_REVENUE_DAILY_JSON || "[]"),
);
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

const createSession = (role) => {
  const payload = Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + sessionDurationSeconds })).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const getSession = (req) => {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.exp > Math.floor(Date.now() / 1000) && ["admin", "salary-payment"].includes(session.role) ? session : null;
  } catch {
    return null;
  }
};

const verifyPassword = (password, passwordHash) => {
  const [saltHex, expectedHex] = String(passwordHash || "").split(":");
  if (!saltHex || !expectedHex) return false;
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const requireAuth = (req, res, next) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Authentication required" });
  req.session = session;
  res.set("Cache-Control", "no-store");
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.session?.role !== "admin") return res.status(403).json({ error: "Administrator access required" });
  next();
};

const requireSalaryPayment = (req, res, next) => {
  if (req.session?.role !== "salary-payment") return res.status(403).json({ error: "Salary payment access required" });
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
const findSalaryPaymentEmployee = (sourceData, { year, month, employeeName, department }) => {
  const period = sourceData.find((entry) => Number(entry.year) === Number(year) && monthKey(entry.month) === monthKey(month));
  if (!period) return null;
  const employee = (period.employees || []).find((entry) =>
    String(entry.name || "").trim().toLowerCase() === String(employeeName || "").trim().toLowerCase()
    && String(entry.department || "").trim().toLowerCase() === String(department || "").trim().toLowerCase()
  );
  return employee ? { period, employee } : null;
};

const findRosterEmployee = ({ employeeName, department }) => {
  const periods = [...normalizedSalaryData, ...salaryPaymentSourceData].slice().reverse();
  for (const period of periods) {
    const employee = (period.employees || []).find((entry) =>
      String(entry.name || "").trim().toLowerCase() === String(employeeName || "").trim().toLowerCase()
      && String(entry.department || "").trim().toLowerCase() === String(department || "").trim().toLowerCase()
    );
    if (employee) return { name: employee.name, department: employee.department };
  }
  return null;
};

const getSalaryPaymentStaff = () => {
  const staff = new Map();
  [...normalizedSalaryData, ...salaryPaymentSourceData].slice().reverse().forEach((period) => {
    (period.employees || []).forEach((employee) => {
      const name = String(employee.name || "").trim();
      const department = String(employee.department || "").trim();
      if (!name || !department) return;
      const key = `${department.toLowerCase()}::${name.toLowerCase()}`;
      if (!staff.has(key)) staff.set(key, { name, department });
    });
  });
  return Array.from(staff.values()).sort((a, b) =>
    a.department.localeCompare(b.department) || a.name.localeCompare(b.name)
  );
};

const parseMoney = (value) => {
  if (value === "" || value == null) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000
    ? Math.round((amount + Number.EPSILON) * 100) / 100
    : undefined;
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
  const session = getSession(req);
  res.json({ authenticated: Boolean(session), role: session?.role || null });
});

app.post("/api/login", loginLimiter, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const adminMatches = username.toLowerCase() === process.env.DASHBOARD_USERNAME.toLowerCase()
    && verifyPassword(password, process.env.DASHBOARD_PASSWORD_HASH);
  const salaryPaymentMatches = username.toLowerCase() === process.env.SALARY_PAYMENT_USERNAME.toLowerCase()
    && verifyPassword(password, process.env.SALARY_PAYMENT_PASSWORD_HASH);
  const role = adminMatches ? "admin" : salaryPaymentMatches ? "salary-payment" : null;
  if (!role) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  res.cookie(cookieName, createSession(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: sessionDurationSeconds * 1000,
    path: "/",
  });
  res.json({ authenticated: true, role });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" });
  res.json({ authenticated: false });
});

const readSalaryEntries = async () => {
  const result = await database.query(`
    SELECT period_year AS "year", period_month AS "month", employee_name AS "employeeName",
           department, salary::float8 AS salary, tips::float8 AS tips
    FROM salary_entries
    ORDER BY period_year, period_month, department, employee_name
  `);
  return result.rows;
};

const salaryEntryKey = ({ year, month, employeeName, name, department }) =>
  `${Number(year)}::${monthKey(month)}::${String(department || "").trim().toLowerCase()}::${String(employeeName || name || "").trim().toLowerCase()}`;

const readSalaryEntryDeletions = async () => {
  const result = await database.query(`
    SELECT period_year AS "year", period_month AS "month", employee_name AS "employeeName", department
    FROM salary_entry_deletions
  `);
  return result.rows;
};

const readSalaryState = async () => {
  const [entries, deletions] = await Promise.all([readSalaryEntries(), readSalaryEntryDeletions()]);
  return { entries, deletions };
};

const mergeSalaryEntries = (baseData, entries, includeCurrentMonth = false, deletions = []) => {
  const deletedKeys = new Set(deletions.map(salaryEntryKey));
  const periods = baseData.map((period) => ({
    ...period,
    employees: (period.employees || [])
      .filter((employee) => !deletedKeys.has(salaryEntryKey({ ...employee, year: period.year, month: period.month })))
      .map((employee) => ({ ...employee })),
  }));
  if (includeCurrentMonth && !periods.some((period) => Number(period.year) === 2026 && monthKey(period.month) === "sep")) {
    periods.push({ year: 2026, month: "September", employees: [] });
  }
  entries.forEach((entry) => {
    if (deletedKeys.has(salaryEntryKey(entry))) return;
    let period = periods.find((item) => Number(item.year) === Number(entry.year) && monthKey(item.month) === monthKey(entry.month));
    if (!period) {
      period = { year: Number(entry.year), month: entry.month, employees: [] };
      periods.push(period);
    }
    const index = period.employees.findIndex((employee) =>
      String(employee.name || "").trim().toLowerCase() === String(entry.employeeName || "").trim().toLowerCase()
      && String(employee.department || "").trim().toLowerCase() === String(entry.department || "").trim().toLowerCase()
    );
    const employee = { name: entry.employeeName, department: entry.department, salary: entry.salary, tips: entry.tips };
    if (index >= 0) period.employees[index] = { ...period.employees[index], ...employee };
    else period.employees.push(employee);
  });
  return periods.sort((a, b) => Number(a.year) - Number(b.year) || monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
};

const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

app.get("/api/salary", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const { entries, deletions } = await readSalaryState();
    res.json(mergeSalaryEntries(normalizedSalaryData, entries, false, deletions));
  }
  catch (error) { next(error); }
});
app.get("/api/salary-payment-source", requireAuth, async (req, res, next) => {
  try {
    const { entries, deletions } = await readSalaryState();
    const periods = mergeSalaryEntries(salaryPaymentSourceData, entries, true, deletions);
    if (req.session.role === "salary-payment") {
      const opened = await database.query('SELECT period_year AS "year", period_month AS "month" FROM salary_months');
      for (const period of opened.rows) {
        if (!periods.some((item) => Number(item.year) === period.year && item.month === period.month)) {
          periods.push({ ...period, employees: [] });
        }
      }
    }
    res.json(req.session.role === "admin"
      ? periods.filter((period) => !(Number(period.year) === 2026 && monthKey(period.month) === "sep"))
      : periods);
  }
  catch (error) { next(error); }
});
app.get("/api/salary-payment-staff", requireAuth, requireSalaryPayment, (_req, res) => res.json(getSalaryPaymentStaff()));
app.post("/api/salary-months", requireAuth, requireSalaryPayment, requireSameOrigin, paymentWriteLimiter, async (req, res, next) => {
  const year = Number(req.body?.year);
  const month = monthOrder.find((item) => item === req.body?.month);
  if (year !== 2026 || !month) return res.status(400).json({ error: "Select a valid month in 2026." });
  try {
    await database.query(`INSERT INTO salary_months (period_year, period_month) VALUES ($1, $2)
      ON CONFLICT (period_year, period_month) DO NOTHING`, [year, month]);
    res.json({ year, month });
  } catch (error) { next(error); }
});
app.put("/api/salary-entry", requireAuth, requireSalaryPayment, requireSameOrigin, paymentWriteLimiter, async (req, res, next) => {
  const year = Number(req.body?.year);
  const month = monthOrder.find((item) => monthKey(item) === monthKey(req.body?.month));
  const employeeName = String(req.body?.employeeName || "").trim();
  const department = String(req.body?.department || "").trim();
  const salary = parseMoney(req.body?.salary);
  const tips = parseMoney(req.body?.tips);
  const rosterEmployee = findRosterEmployee({ employeeName, department });
  if (year !== 2026 || !month || !rosterEmployee) return res.status(400).json({ error: "Select a valid employee and salary month." });
  if (salary === undefined || tips === undefined) return res.status(400).json({ error: "Salary and Tips must be valid non-negative amounts." });
  let client;
  try {
    client = await database.connect();
    await client.query("BEGIN");
    await client.query(`
      DELETE FROM salary_entry_deletions
      WHERE period_year = $1 AND period_month = $2 AND employee_name = $3 AND department = $4
    `, [year, month, rosterEmployee.name, rosterEmployee.department]);
    const result = await client.query(`
      INSERT INTO salary_entries (period_year, period_month, employee_name, department, salary, tips, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (period_year, period_month, employee_name, department)
      DO UPDATE SET salary = EXCLUDED.salary, tips = EXCLUDED.tips, updated_at = NOW()
      RETURNING period_year AS "year", period_month AS "month", employee_name AS "employeeName",
                department, salary::float8 AS salary, tips::float8 AS tips, updated_at AS "updatedAt"
    `, [year, month, rosterEmployee.name, rosterEmployee.department, salary, tips]);
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    next(error);
  } finally {
    client?.release();
  }
});
app.delete("/api/salary-entry", requireAuth, requireSalaryPayment, requireSameOrigin, paymentWriteLimiter, async (req, res, next) => {
  const year = Number(req.body?.year);
  const month = monthOrder.find((item) => monthKey(item) === monthKey(req.body?.month));
  const employeeName = String(req.body?.employeeName || "").trim();
  const department = String(req.body?.department || "").trim();
  try {
    const { entries, deletions } = await readSalaryState();
    const match = findSalaryPaymentEmployee(mergeSalaryEntries(salaryPaymentSourceData, entries, true, deletions), { year, month, employeeName, department });
    if (year !== 2026 || !month || !match) return res.status(404).json({ error: "Salary entry was not found." });
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const values = [year, match.period.month, match.employee.name, match.employee.department];
      await client.query(`DELETE FROM salary_payments WHERE period_year = $1 AND period_month = $2 AND employee_name = $3 AND department = $4`, values);
      await client.query(`DELETE FROM salary_entries WHERE period_year = $1 AND period_month = $2 AND employee_name = $3 AND department = $4`, values);
      await client.query(`
        INSERT INTO salary_entry_deletions (period_year, period_month, employee_name, department, deleted_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (period_year, period_month, employee_name, department)
        DO UPDATE SET deleted_at = NOW()
      `, values);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({ deleted: true });
  } catch (error) { next(error); }
});
app.get("/api/salary-payments", requireAuth, async (_req, res, next) => {
  try {
    const result = await database.query(`
      SELECT period_year AS "year", period_month AS "month", employee_name AS "employeeName",
             department, paid_amount::float8 AS "paidAmount", paid_date::text AS "paidDate",
             (paid_amount IS NOT NULL AND paid_date IS NOT NULL) AS "locked",
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
  let salaryMatch;
  try {
    const { entries, deletions } = await readSalaryState();
    salaryMatch = findSalaryPaymentEmployee(mergeSalaryEntries(salaryPaymentSourceData, entries, true, deletions), { year, month, employeeName, department });
  } catch (error) { return next(error); }

  if (!Number.isInteger(year) || !month || !employeeName || !department || !salaryMatch) {
    return res.status(400).json({ error: "Select a valid salary employee and month." });
  }
  if (paidAmount === null || paidDate === null) return res.status(400).json({ error: "Paid Amount and Paid Date are both required." });
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
                (paid_amount IS NOT NULL AND paid_date IS NOT NULL) AS "locked",
                updated_at AS "updatedAt"
    `, [year, salaryMatch.period.month, salaryMatch.employee.name, salaryMatch.employee.department, paidAmount, paidDate]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
app.get("/api/staff-hours", requireAuth, requireAdmin, (_req, res) => res.json(normalizedStaffHoursData));
app.get("/api/weekly-performance", requireAuth, requireAdmin, (_req, res) => res.json(refreshedWeeklyPerformanceData));
app.get("/api/weekly-guests", requireAuth, requireAdmin, (_req, res) => res.json(weeklyGuestAppendData));
app.get("/api/weekly-benchmarks", requireAuth, requireAdmin, (_req, res) => res.json(weeklyBenchmarksData));

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

const seedInitialSalaryPayments = async () => {
  const migrationKey = "initial_salary_payments_v1";
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [migrationKey]);
    const applied = await client.query("SELECT 1 FROM app_migrations WHERE migration_key = $1", [migrationKey]);
    if (applied.rowCount) {
      await client.query("COMMIT");
      return;
    }

    const state = await client.query(`
      SELECT
        EXISTS (SELECT 1 FROM salary_payments) AS has_payments,
        EXISTS (SELECT 1 FROM salary_entries) AS has_entries,
        EXISTS (SELECT 1 FROM salary_entry_deletions) AS has_deletions
    `);
    const databaseAlreadyInUse = Object.values(state.rows[0]).some(Boolean);
    if (!databaseAlreadyInUse) {
      for (const period of salaryPaymentSourceData) {
        for (const employee of period.employees || []) {
          const paidAmount = parsePaidAmount(employee.paidAmount);
          const paidDate = parsePaidDate(employee.paidDate);
          if ((paidAmount == null && paidDate == null) || paidAmount === undefined || paidDate === undefined) continue;
          await client.query(`
            INSERT INTO salary_payments
              (period_year, period_month, employee_name, department, paid_amount, paid_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (period_year, period_month, employee_name, department) DO NOTHING
          `, [Number(period.year), period.month, employee.name, employee.department, paidAmount, paidDate]);
        }
      }
    }

    await client.query("INSERT INTO app_migrations (migration_key) VALUES ($1)", [migrationKey]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const start = async () => {
  await database.query(`
    CREATE TABLE IF NOT EXISTS salary_months (
      period_year INTEGER NOT NULL CHECK (period_year = 2026),
      period_month VARCHAR(20) NOT NULL CHECK (period_month IN ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December')),
      PRIMARY KEY (period_year, period_month)
    );

    CREATE TABLE IF NOT EXISTS app_migrations (
      migration_key VARCHAR(120) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS salary_entries (
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

    CREATE TABLE IF NOT EXISTS salary_entry_deletions (
      id BIGSERIAL PRIMARY KEY,
      period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
      period_month VARCHAR(20) NOT NULL,
      employee_name VARCHAR(160) NOT NULL,
      department VARCHAR(80) NOT NULL,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (period_year, period_month, employee_name, department)
    );

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
  await seedInitialSalaryPayments();
  app.listen(port, "0.0.0.0", () => console.log(`Secure dashboard listening on port ${port}`));
};

start().catch((error) => {
  console.error("Unable to initialize the secure dashboard database:", error?.message || error);
  process.exit(1);
});
