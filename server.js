import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const required = ["DASHBOARD_USERNAME", "DASHBOARD_PASSWORD_HASH", "SESSION_SECRET", "SALARY_DATA_JSON", "STAFF_HOURS_DATA_JSON", "WEEKLY_PERFORMANCE_DATA_JSON", "WEEKLY_BENCHMARKS_DATA_JSON"];
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

const staffHoursData = JSON.parse(process.env.STAFF_HOURS_DATA_JSON);
const staffHoursOverrides = JSON.parse(process.env.STAFF_HOURS_OVERRIDES_JSON || "[]");
const staffHoursExclusions = JSON.parse(process.env.STAFF_HOURS_EXCLUSIONS_JSON || "[]");
const overriddenStaffHoursData = staffHoursData.map((period) => {
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
const weeklyPerformanceOverrides = JSON.parse(process.env.WEEKLY_PERFORMANCE_OVERRIDES_JSON || "[]");
const normalizedWeeklyPerformanceData = weeklyPerformanceData.map((week) => {
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
app.get("/api/staff-hours", requireAuth, (_req, res) => res.json(normalizedStaffHoursData));
app.get("/api/weekly-performance", requireAuth, (_req, res) => res.json(normalizedWeeklyPerformanceData));
app.get("/api/weekly-benchmarks", requireAuth, (_req, res) => res.json(weeklyBenchmarksData));

app.use(express.static(path.join(__dirname, "dist"), {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-store");
  },
}));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(port, "0.0.0.0", () => console.log(`Secure dashboard listening on port ${port}`));
