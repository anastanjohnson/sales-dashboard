import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Award, Banknote, BarChart3, Clock3, Euro, Gauge,
  RefreshCcw, RefreshCw, TrendingDown, TrendingUp, Users,
} from "lucide-react";
import SalaryPage from "./SalaryPage";
import SalaryPaymentPage from "./SalaryPaymentPage";
import StaffHoursPage from "./StaffHoursPage";
import SalesPage from "./SalesPage";
import WeeklyInsightsPage from "./WeeklyInsightsPage";
import RepeatedGuestPage from "./RepeatedGuestPage";
import SettingsPage from "./SettingsPage";
import { salesData } from "../data/salesData";
import { weeklyGuestData } from "../data/weeklyGuestData";
import { repeatGuestData } from "../data/repeatGuestData";
import {
  getIsoWeekNumber, getWeekTotals, mergeWeeklyGuestBenchmarks,
  mergeWeeklyRevenueBenchmarks, percentageChange,
} from "../data/weeklyPerformanceUtils";

const number = new Intl.NumberFormat("de-DE");
const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 });
const hours = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const DEFAULT_HOURS_LIMIT = 43;
const STAFF_HOURS_LIMITS = { fawad: null, dina: 10, thikalya: 14, kirushalani: 14, suman: 14 };

const getHoursLimit = (name) => {
  const normalized = String(name || "").trim().toLowerCase();
  const match = Object.keys(STAFF_HOURS_LIMITS).find((key) => normalized.includes(key));
  return match ? STAFF_HOURS_LIMITS[match] : DEFAULT_HOURS_LIMIT;
};

const mergeGuestUpdates = (baseWeeks, updates) => {
  const updateList = Array.isArray(updates) ? updates : [];
  const merged = baseWeeks.map((week) =>
    updateList.find((update) => update.id === week.id || Number(update.weekNumber) === Number(week.weekNumber)) || week
  );
  updateList.forEach((update) => {
    if (!merged.some((week) => week.id === update.id || Number(week.weekNumber) === Number(update.weekNumber))) merged.push(update);
  });
  return merged.sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber));
};

const findRevenueWeek = (guestWeek, revenueWeeks) => revenueWeeks.find((week) => {
  const weekNumber = Number(week.weekNumber) || getIsoWeekNumber(week.startDate);
  return week.id === guestWeek?.id || week.startDate === guestWeek?.startDate || weekNumber === Number(guestWeek?.weekNumber);
});

function Change({ value }) {
  if (value == null) return <span className="overview-widget__change overview-widget__change--neutral">No comparison</span>;
  const positive = value >= 0;
  return (
    <span className={`overview-widget__change ${positive ? "overview-widget__change--up" : "overview-widget__change--down"}`}>
      {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {positive ? "+" : ""}{value.toFixed(1)}% vs 2025
    </span>
  );
}

function Widget({ icon: Icon, label, value, note, change, page, onNavigate, tone = "accent" }) {
  return (
    <button type="button" className={`overview-widget overview-widget--${tone}`} onClick={() => onNavigate?.(page)}>
      <span className="overview-widget__top">
        <span className="overview-widget__icon"><Icon size={18} /></span>
        <ArrowRight size={16} className="overview-widget__arrow" />
      </span>
      <span className="overview-widget__label">{label}</span>
      <strong className="overview-widget__value">{value}</strong>
      {change !== undefined ? <Change value={change} /> : <span className="overview-widget__note">{note}</span>}
    </button>
  );
}

function Section({ title, subtitle, page, onNavigate, children }) {
  return (
    <section className="overview-section">
      <div className="overview-section__head">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <button type="button" className="overview-section__link" onClick={() => onNavigate?.(page)}>View details <ArrowRight size={14} /></button>
      </div>
      <div className="overview-widget-grid">{children}</div>
    </section>
  );
}

export default function Dashboard({ activePage, theme, onToggleTheme, onNavigate, role }) {
  const [liveData, setLiveData] = useState({ salary: [], staffHours: [], weeklyRevenue: [], guestWeeks: weeklyGuestData });
  const [status, setStatus] = useState("loading");

  const loadOverview = useCallback(async () => {
    setStatus("loading");
    try {
      const responses = await Promise.all([
        fetch("/api/salary", { credentials: "include" }),
        fetch("/api/staff-hours", { credentials: "include" }),
        fetch("/api/weekly-performance", { credentials: "include" }),
        fetch("/api/weekly-benchmarks", { credentials: "include" }),
        fetch("/api/weekly-guests", { credentials: "include" }),
      ]);
      if (responses.some((response) => response.status === 401)) return window.location.reload();
      if (responses.some((response) => !response.ok)) throw new Error("Unable to load dashboard data.");
      const [salary, staffHoursData, weeklyRevenueData, benchmarkData, guestUpdates] = await Promise.all(responses.map((response) => response.json()));
      const weeklyRevenue = mergeWeeklyRevenueBenchmarks(weeklyRevenueData, benchmarkData);
      const guestWeeks = mergeWeeklyGuestBenchmarks(mergeGuestUpdates(weeklyGuestData, guestUpdates), benchmarkData);
      setLiveData({ salary, staffHours: staffHoursData, weeklyRevenue, guestWeeks });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (activePage === "overview") loadOverview();
  }, [activePage, loadOverview]);

  if (activePage === "sales-salary") return <SalaryPage />;
  if (activePage === "salary-payment") return <SalaryPaymentPage canEnterSalary={role === "salary-payment"} />;
  if (activePage === "staff-hours") return <StaffHoursPage />;
  if (activePage === "sales") return <SalesPage />;
  if (activePage === "weekly-performance") return <WeeklyInsightsPage />;
  if (activePage === "repeated-guests") return <RepeatedGuestPage />;
  if (activePage === "settings") return <SettingsPage theme={theme} onToggleTheme={onToggleTheme} />;

  const sales2026 = salesData.filter((row) => row.year === 2026);
  const completedSales2026 = sales2026.filter((row) => !row.partial);
  const latestSales = sales2026.at(-1);
  const totalRevenue = sales2026.reduce((sum, row) => sum + row.revenue, 0);
  const averageMonthlyRevenue = completedSales2026.length
    ? completedSales2026.reduce((sum, row) => sum + row.revenue, 0) / completedSales2026.length
    : 0;

  const latestGuestWeek = [...liveData.guestWeeks].reverse().find((week) =>
    week.available && findRevenueWeek(week, liveData.weeklyRevenue)?.days?.some((day) => day.currentRevenue != null)
  );
  const latestRevenueWeek = findRevenueWeek(latestGuestWeek, liveData.weeklyRevenue);
  const weeklyTotals = getWeekTotals(latestRevenueWeek);
  const weeklyRevenueChange = latestRevenueWeek ? percentageChange(weeklyTotals.current, weeklyTotals.comparison) : null;
  const weeklyGuests = Number(latestGuestWeek?.currentCovers) || 0;
  const weeklyGuestChange = latestGuestWeek?.comparisonCovers ? percentageChange(weeklyGuests, Number(latestGuestWeek.comparisonCovers)) : null;
  const averageGuestSpend = weeklyGuests > 0 ? weeklyTotals.current / weeklyGuests : 0;

  const latestSalary = liveData.salary.at(-1);
  const salaryTotals = (latestSalary?.employees || []).reduce((totals, employee) => {
    const value = Number(employee.salary) || 0;
    totals.total += value;
    if (employee.department === "Kitchen") totals.kitchen += value;
    if (employee.department === "Service") totals.service += value;
    return totals;
  }, { total: 0, kitchen: 0, service: 0 });
  const salarySales = sales2026.find((row) => String(row.month).slice(0, 3).toLowerCase() === String(latestSalary?.month).slice(0, 3).toLowerCase())?.revenue || 0;
  const salaryRatio = salarySales > 0 ? (salaryTotals.total / salarySales) * 100 : null;

  const latestStaffHours = liveData.staffHours.at(-1);
  const staffSummary = (latestStaffHours?.employees || []).reduce((summary, employee) => {
    const worked = Math.max(0, Number(employee.workingHours) || 0);
    const limit = getHoursLimit(employee.name);
    const extra = limit == null ? 0 : Math.max(0, worked - limit);
    summary.total += worked;
    summary.extra += extra;
    if (extra > 0) summary.aboveLimit += 1;
    return summary;
  }, { total: 0, extra: 0, aboveLimit: 0 });

  const repeatRate2026 = repeatGuestData.visitorTypeSplitByYear["2026"].find((entry) => entry.name === "Repeat visitors")?.value ?? 0;
  const vipGuests2026 = repeatGuestData.yearlyRepeatCounts["2026"]?.tenOrMore ?? 0;
  const medianReturn2026 = repeatGuestData.visitGapStatsByYear["2026"]?.medianDays ?? 0;

  return (
    <div className="dashboard overview-dashboard">
      <div className="dashboard__header">
        <div>
          <h1>KARIKAALA Dashboard</h1>
          <p className="dashboard__subtitle">The most important results from every management page in one place.</p>
        </div>
        <div className="dashboard__header-actions">
          <span className={`overview-status overview-status--${status}`}>{status === "loading" ? "Updating…" : status === "error" ? "Some live data unavailable" : "Live data"}</span>
          <button className="btn btn--ghost" onClick={loadOverview} disabled={status === "loading"}><RefreshCw size={15} />Refresh</button>
        </div>
      </div>

      {status === "error" && <div className="overview-alert"><AlertTriangle size={17} />Sales and loyalty figures are visible, but protected salary, staff-hours or weekly data could not be refreshed.</div>}

      <Section title="Sales Revenue" subtitle="2026 revenue performance from the General Ledger" page="sales" onNavigate={onNavigate}>
        <Widget icon={Euro} label="2026 Revenue" value={money.format(totalRevenue)} note="Year to date" page="sales" onNavigate={onNavigate} tone="purple" />
        <Widget icon={Gauge} label={`${latestSales?.monthName || "Latest Month"} Revenue${latestSales?.partial ? " · MTD" : ""}`} value={money.format(latestSales?.revenue || 0)} note={latestSales?.asOf ? `Updated through ${latestSales.asOf}` : "Latest available month"} page="sales" onNavigate={onNavigate} tone="blue" />
        <Widget icon={BarChart3} label="Average Monthly Revenue" value={money.format(averageMonthlyRevenue)} note={`${completedSales2026.length} completed months in 2026`} page="sales" onNavigate={onNavigate} tone="gold" />
      </Section>

      <Section title="Weekly Performance" subtitle={latestGuestWeek ? `Latest completed reporting week · W${latestGuestWeek.weekNumber}` : "Latest completed Thursday–Monday reporting week"} page="weekly-performance" onNavigate={onNavigate}>
        <Widget icon={Euro} label="Weekly Revenue" value={status === "ready" ? money.format(weeklyTotals.current) : "—"} change={status === "ready" ? weeklyRevenueChange : null} page="weekly-performance" onNavigate={onNavigate} tone="green" />
        <Widget icon={Users} label="Weekly Guests" value={status === "ready" ? number.format(weeklyGuests) : "—"} change={status === "ready" ? weeklyGuestChange : null} page="weekly-performance" onNavigate={onNavigate} tone="blue" />
        <Widget icon={Gauge} label="Average Guest Spending" value={status === "ready" ? money.format(averageGuestSpend) : "—"} note="Revenue ÷ seated guests" page="weekly-performance" onNavigate={onNavigate} tone="purple" />
      </Section>

      <div className="overview-two-column">
        <Section title="Salary" subtitle={`${latestSalary?.month || "Latest month"} 2026 · aggregate protected totals`} page="sales-salary" onNavigate={onNavigate}>
          <Widget icon={Banknote} label="Total Salary" value={status === "ready" ? money.format(salaryTotals.total) : "—"} note={salaryRatio == null ? "Sales ratio unavailable" : `${salaryRatio.toFixed(1)}% of monthly sales`} page="sales-salary" onNavigate={onNavigate} tone="purple" />
          <Widget icon={Users} label="Kitchen / Service" value={status === "ready" ? `${compactMoney.format(salaryTotals.kitchen)} / ${compactMoney.format(salaryTotals.service)}` : "—"} note="Department totals" page="sales-salary" onNavigate={onNavigate} tone="gold" />
        </Section>

        <Section title="Staff Hours" subtitle={`${latestStaffHours?.month || "Latest month"} 2026 · Service team`} page="staff-hours" onNavigate={onNavigate}>
          <Widget icon={Clock3} label="Worked Hours" value={status === "ready" ? `${hours.format(staffSummary.total)} h` : "—"} note="All Service staff" page="staff-hours" onNavigate={onNavigate} tone="blue" />
          <Widget icon={AlertTriangle} label="Extra Hours" value={status === "ready" ? `${hours.format(staffSummary.extra)} h` : "—"} note={`${staffSummary.aboveLimit} staff above their limit`} page="staff-hours" onNavigate={onNavigate} tone={staffSummary.extra > 0 ? "red" : "green"} />
        </Section>
      </div>

      <Section title="Repeated Guests" subtitle="2026 loyalty and return behaviour from completed visits" page="repeated-guests" onNavigate={onNavigate}>
        <Widget icon={RefreshCcw} label="Repeat Visitor Rate" value={`${repeatRate2026}%`} note="Guests who returned" page="repeated-guests" onNavigate={onNavigate} tone="green" />
        <Widget icon={Award} label="VIP Guests" value={number.format(vipGuests2026)} note="10+ visits in 2026" page="repeated-guests" onNavigate={onNavigate} tone="gold" />
        <Widget icon={Clock3} label="Median Return Gap" value={`${medianReturn2026} days`} note="Typical time between visits" page="repeated-guests" onNavigate={onNavigate} tone="purple" />
      </Section>
    </div>
  );
}
