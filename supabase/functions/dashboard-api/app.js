import express from "express";
import { createSecurity } from "./security.js";
import { mergeDailyRevenue, mergeDailyGuestRecords } from "./data/weeklyPerformanceUtils.js";
import { weeklyGuestData } from "./data/weeklyGuestData.js";
import { latestDailyRevenue, latestDailyGuests } from "./data/latestDailyData.js";

// Inject dependencies so auth, authorization and validation can be exercised without production writes.
export function createApp(database, config, allowedOrigins) {
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  const origin = req.get("origin");
  if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ error: "Invalid request origin." });
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "authorization, content-type");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  // Supabase retains the function name when forwarding requests.
  req.url = req.url.replace(/^\/dashboard-api(?=\/|$)/, "") || "/";
  next();
});
app.use(express.json({ limit: "10kb" }));
const { requireAuth, requireAdmin, requireSalaryPayment, requireSameOrigin, paymentWriteLimiter, installAuth } = createSecurity(database, config, allowedOrigins);
installAuth(app);
const salaryData = JSON.parse(config.SALARY_DATA_JSON);
// Fresh authorized sheet periods take precedence over older source overrides.
// Database salary entries and deletions are still applied last.
const salaryDataOverrides = [
  ...JSON.parse(config.SALARY_SOURCE_REFRESH_JSON || "[]"),
  ...JSON.parse(config.SALARY_DATA_OVERRIDES_JSON || "[]"),
];
const normalizedSalaryData = salaryData.map((period) => {
  const override = salaryDataOverrides.find((entry) =>
    Number(entry.year) === Number(period.year)
    && String(entry.month || "").slice(0, 3).toLowerCase() === String(period.month || "").slice(0, 3).toLowerCase()
  );
  return override ? { ...period, ...override } : period;
});
const salaryPaymentSourceData = JSON.parse(config.SALARY_PAYMENT_DATA_JSON);

const staffHoursData = JSON.parse(config.STAFF_HOURS_DATA_JSON);
const staffHoursAppend = JSON.parse(config.STAFF_HOURS_APPEND_JSON || "[]");
const staffHoursOverrides = JSON.parse(config.STAFF_HOURS_OVERRIDES_JSON || "[]");
const staffHoursExclusions = JSON.parse(config.STAFF_HOURS_EXCLUSIONS_JSON || "[]");
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
const dailyStaffHoursData = [
  ...JSON.parse(config.STAFF_HOURS_DAILY_SOURCE_JSON || "[]"),
  ...JSON.parse(config.STAFF_HOURS_SOURCE_REFRESH_JSON || "[]"),
];
dailyStaffHoursData.forEach((entry) => {
  const index = normalizedStaffHoursData.findIndex((period) =>
    Number(period.year) === Number(entry.year)
    && String(period.month || "").slice(0, 3).toLowerCase() === String(entry.month || "").slice(0, 3).toLowerCase()
  );
  if (index >= 0) normalizedStaffHoursData[index] = { ...normalizedStaffHoursData[index], ...entry };
  else normalizedStaffHoursData.push(entry);
});
const weeklyPerformanceData = JSON.parse(config.WEEKLY_PERFORMANCE_DATA_JSON);
const weeklyPerformanceAppend = JSON.parse(config.WEEKLY_PERFORMANCE_APPEND_JSON || "[]");
const weeklyGuestAppendData = JSON.parse(config.WEEKLY_GUEST_APPEND_JSON || "[]");
const weeklyPerformanceOverrides = JSON.parse(config.WEEKLY_PERFORMANCE_OVERRIDES_JSON || "[]");
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
const weeklyBenchmarksData = JSON.parse(config.WEEKLY_BENCHMARKS_DATA_JSON);
const refreshedWeeklyPerformanceData = mergeDailyRevenue(
  normalizedWeeklyPerformanceData, weeklyBenchmarksData,
  [...JSON.parse(config.WEEKLY_REVENUE_DAILY_JSON || "[]"), ...latestDailyRevenue],
);
const refreshedWeeklyGuestData = mergeDailyGuestRecords(
  weeklyGuestData, weeklyGuestAppendData, weeklyBenchmarksData,
  [...JSON.parse(config.WEEKLY_GUEST_DAILY_JSON || "[]"), ...latestDailyGuests],
);
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

const readSalaryEntries = async () => {
  const result = await database.query(`
    SELECT period_year AS "year", period_month AS "month", employee_name AS "employeeName",
           department, salary::float8 AS salary, tips::float8 AS tips
    FROM dashboard_private.salary_entries
    ORDER BY period_year, period_month, department, employee_name
  `);
  return result.rows;
};

const salaryEntryKey = ({ year, month, employeeName, name, department }) =>
  `${Number(year)}::${monthKey(month)}::${String(department || "").trim().toLowerCase()}::${String(employeeName || name || "").trim().toLowerCase()}`;

const readSalaryEntryDeletions = async () => {
  const result = await database.query(`
    SELECT period_year AS "year", period_month AS "month", employee_name AS "employeeName", department
    FROM dashboard_private.salary_entry_deletions
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
      const opened = await database.query('SELECT period_year AS "year", period_month AS "month" FROM dashboard_private.salary_months');
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
    await database.query(`INSERT INTO dashboard_private.salary_months (period_year, period_month) VALUES ($1, $2)
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
      DELETE FROM dashboard_private.salary_entry_deletions
      WHERE period_year = $1 AND period_month = $2 AND employee_name = $3 AND department = $4
    `, [year, month, rosterEmployee.name, rosterEmployee.department]);
    const result = await client.query(`
      INSERT INTO dashboard_private.salary_entries (period_year, period_month, employee_name, department, salary, tips, updated_at)
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
      await client.query(`DELETE FROM dashboard_private.salary_payments WHERE period_year = $1 AND period_month = $2 AND employee_name = $3 AND department = $4`, values);
      await client.query(`DELETE FROM dashboard_private.salary_entries WHERE period_year = $1 AND period_month = $2 AND employee_name = $3 AND department = $4`, values);
      await client.query(`
        INSERT INTO dashboard_private.salary_entry_deletions (period_year, period_month, employee_name, department, deleted_at)
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
      FROM dashboard_private.salary_payments
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
      INSERT INTO dashboard_private.salary_payments
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
app.get("/api/weekly-guests", requireAuth, requireAdmin, (_req, res) => res.json(refreshedWeeklyGuestData));
app.get("/api/weekly-benchmarks", requireAuth, requireAdmin, (_req, res) => res.json(weeklyBenchmarksData));


app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((error, _req, res, _next) => {
  // Never log database errors, bodies or credentials.
  const status = error?.type === "entity.too.large" ? 413 : error?.type === "entity.parse.failed" ? 400 : 500;
  res.status(status).json({ error: status === 500 ? "The requested update could not be completed." : "Invalid request body." });
});
return app;
}
