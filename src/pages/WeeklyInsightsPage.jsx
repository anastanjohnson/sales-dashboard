import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Euro,
  Lightbulb,
  Table2,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { weeklyGuestData, weeklyGuestMeta } from "../data/weeklyGuestData";
import { getIsoWeekNumber, getWeekTotals, percentageChange } from "../data/weeklyPerformanceUtils";

const number = new Intl.NumberFormat("de-DE");
const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const latestWeekId = weeklyGuestData.filter((week) => week.available).at(-1)?.id || "";

const dateLabel = (value) => value ? shortDate.format(new Date(`${value}T12:00:00`)) : "—";
const rangeLabel = (week) => week ? `${dateLabel(week.startDate)} – ${dateLabel(week.endDate)}` : "Thursday – Monday";
const signedPercentage = (value) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

const findRevenueWeek = (guestWeek, revenueData) => revenueData.find((week) => {
  const revenueWeekNumber = Number(week.weekNumber) || getIsoWeekNumber(week.startDate);
  return week.id === guestWeek?.id
    || week.startDate === guestWeek?.startDate
    || revenueWeekNumber === guestWeek?.weekNumber;
});

function KpiCard({ icon: Icon, label, value, note, change }) {
  return (
    <div className="stat-card">
      <div className="stat-card__head"><span className="stat-card__label">{label}</span><span className="stat-card__icon"><Icon size={16} /></span></div>
      <div className="stat-card__value">{value}</div>
      <div className={change == null ? "sales-kpi-note" : `sales-change ${change >= 0 ? "sales-change--up" : "sales-change--down"}`}>
        {change == null ? note : <>{change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{note}</>}
      </div>
    </div>
  );
}

function buildGrowthInsight(revenueChange, guestChange, spendingChange) {
  if ([revenueChange, guestChange, spendingChange].some((value) => value == null)) {
    return { label: "Waiting for data", text: "Revenue and guest data are both needed to identify the weekly growth driver." };
  }

  const guestUp = guestChange >= 0;
  const spendingUp = spendingChange >= 0;
  const revenueUp = revenueChange >= 0;
  const stronger = Math.abs(guestChange) >= Math.abs(spendingChange) ? "guest volume" : "spending per guest";

  if (guestUp && spendingUp) {
    return {
      label: revenueUp ? "Both improved" : "Balanced",
      text: `Guest volume rose ${signedPercentage(guestChange)} and spending per guest rose ${signedPercentage(spendingChange)}. ${stronger === "guest volume" ? "Guest volume" : "Guest spending"} was the stronger growth driver.`,
    };
  }

  if (!guestUp && !spendingUp) {
    return {
      label: "Both declined",
      text: `Guest volume fell ${Math.abs(guestChange).toFixed(1)}% and spending per guest fell ${Math.abs(spendingChange).toFixed(1)}%. ${stronger === "guest volume" ? "Lower guest volume" : "Lower guest spending"} was the larger drag on revenue.`,
    };
  }

  if (guestUp) {
    return revenueUp
      ? { label: "Guest volume", text: `More guests drove revenue growth, overcoming a ${Math.abs(spendingChange).toFixed(1)}% decrease in spending per guest.` }
      : { label: "Guest spending", text: `A ${Math.abs(spendingChange).toFixed(1)}% decrease in spending per guest outweighed ${signedPercentage(guestChange)} guest growth.` };
  }

  return revenueUp
    ? { label: "Guest spending", text: `Higher spending per guest drove revenue growth, overcoming a ${Math.abs(guestChange).toFixed(1)}% decrease in guest volume.` }
    : { label: "Guest volume", text: `A ${Math.abs(guestChange).toFixed(1)}% decrease in guests outweighed ${signedPercentage(spendingChange)} growth in spending per guest.` };
}

function CombinedTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  const formatValue = metric === "guests" ? (value) => `${number.format(value)} guests` : money.format;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{label}</div>
      {payload.map((item) => (
        <div className="chart-tooltip__row" key={item.name}>
          <span className="chart-tooltip__swatch" style={{ background: item.color }} />
          <span className="chart-tooltip__name">{item.name}</span>
          <span className="chart-tooltip__value">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function WeeklyInsightsPage() {
  const [weeklyRevenueData, setWeeklyRevenueData] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState(latestWeekId);
  const [metric, setMetric] = useState("revenue");
  const [view, setView] = useState("chart");
  const [status, setStatus] = useState("loading");

  const loadWeeklyData = async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/weekly-performance", { credentials: "include" });
      if (response.status === 401) return window.location.reload();
      if (!response.ok) throw new Error("Unable to load weekly performance data.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid weekly performance data.");
      setWeeklyRevenueData(data);
      const latestCombinedWeek = [...weeklyGuestData].reverse().find((week) => week.available && findRevenueWeek(week, data));
      setSelectedWeekId(latestCombinedWeek?.id || latestWeekId);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { loadWeeklyData(); }, []);

  const selectedGuestWeek = weeklyGuestData.find((week) => week.id === selectedWeekId) || null;
  const selectedRevenueWeek = findRevenueWeek(selectedGuestWeek, weeklyRevenueData) || null;
  const currentYear = selectedRevenueWeek?.currentYear || weeklyGuestMeta.currentYear;
  const comparisonYear = selectedRevenueWeek?.comparisonYear || weeklyGuestMeta.comparisonYear;
  const revenueTotals = useMemo(() => getWeekTotals(selectedRevenueWeek), [selectedRevenueWeek]);
  const currentGuests = Number(selectedGuestWeek?.currentCovers) || 0;
  const comparisonGuests = Number(selectedGuestWeek?.comparisonCovers) || 0;
  const currentSpending = currentGuests > 0 ? revenueTotals.current / currentGuests : null;
  const comparisonSpending = comparisonGuests > 0 ? revenueTotals.comparison / comparisonGuests : null;
  const revenueChange = percentageChange(revenueTotals.current, revenueTotals.comparison);
  const guestChange = percentageChange(currentGuests, comparisonGuests);
  const spendingChange = currentSpending != null && comparisonSpending != null
    ? percentageChange(currentSpending, comparisonSpending)
    : null;
  const insight = buildGrowthInsight(revenueChange, guestChange, spendingChange);

  const combinedRows = useMemo(() => (selectedGuestWeek?.days || []).map((guestRow) => {
    const revenueRow = (selectedRevenueWeek?.days || []).find((row) => row.day === guestRow.day || row.currentDate === guestRow.currentDate);
    const currentRevenue = Number(revenueRow?.currentRevenue) || 0;
    const comparisonRevenue = Number(revenueRow?.comparisonRevenue) || 0;
    const currentDayGuests = Number(guestRow.currentCovers) || 0;
    const comparisonDayGuests = Number(guestRow.comparisonCovers) || 0;

    return {
      day: guestRow.day,
      currentDate: guestRow.currentDate,
      comparisonDate: guestRow.comparisonDate,
      currentRevenue,
      comparisonRevenue,
      currentGuests: currentDayGuests,
      comparisonGuests: comparisonDayGuests,
      currentSpending: currentDayGuests > 0 ? currentRevenue / currentDayGuests : 0,
      comparisonSpending: comparisonDayGuests > 0 ? comparisonRevenue / comparisonDayGuests : 0,
    };
  }), [selectedGuestWeek, selectedRevenueWeek]);

  const metricConfig = {
    revenue: { title: "Daily Sales Revenue", currentKey: "currentRevenue", comparisonKey: "comparisonRevenue", yAxis: compactMoney.format },
    guests: { title: "Daily Guest Count", currentKey: "currentGuests", comparisonKey: "comparisonGuests", yAxis: number.format },
    spending: { title: "Daily Average Guest Spending", currentKey: "currentSpending", comparisonKey: "comparisonSpending", yAxis: compactMoney.format },
  }[metric];

  if (status === "loading") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Loading weekly insights…</h3></div></div></div>;
  if (status === "error") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Weekly insights could not be loaded.</h3><button className="btn btn--ghost" onClick={loadWeeklyData}>Try again</button></div></div></div>;

  return (
    <div className="dashboard weekly-performance-page">
      <div className="dashboard__header">
        <div><h1>Weekly Insights</h1><p className="dashboard__subtitle">See how guest volume and spending per guest combine to drive weekly sales revenue.</p></div>
      </div>

      <div className="weekly-week-picker" aria-label="Select a combined reporting week">
        <div className="weekly-week-picker__head">
          <span><CalendarDays size={15} />Select week</span>
          <span className="weekly-week-picker__legend"><i className="weekly-week-picker__dot weekly-week-picker__dot--up" />Revenue positive <i className="weekly-week-picker__dot weekly-week-picker__dot--down" />Revenue negative</span>
        </div>
        <div className="weekly-week-grid">
          {weeklyGuestData.map((guestWeek) => {
            const revenueWeek = findRevenueWeek(guestWeek, weeklyRevenueData);
            const totals = getWeekTotals(revenueWeek);
            const hasData = Boolean(guestWeek.available && revenueWeek?.days?.length);
            const change = hasData ? percentageChange(totals.current, totals.comparison) : null;
            const direction = change == null ? "empty" : change > 0 ? "up" : change < 0 ? "down" : "neutral";
            const isSelected = guestWeek.id === selectedWeekId;
            const resultLabel = change == null ? "Combined data not available" : `${signedPercentage(change)} revenue year on year`;
            const accessibleLabel = `W${String(guestWeek.weekNumber).padStart(2, "0")}, ${rangeLabel(guestWeek)}, ${resultLabel}`;

            return (
              <button
                type="button"
                className={`weekly-week-button weekly-week-button--${direction} ${isSelected ? "weekly-week-button--selected" : ""}`}
                key={guestWeek.id}
                disabled={!hasData}
                aria-label={accessibleLabel}
                aria-pressed={isSelected}
                title={accessibleLabel}
                onClick={() => setSelectedWeekId(guestWeek.id)}
              >
                <span>W{String(guestWeek.weekNumber).padStart(2, "0")}</span>
                <small>{change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="toolbar weekly-toolbar weekly-view-toolbar">
        <div className="weekly-selected-range"><CalendarDays size={15} /><span>{rangeLabel(selectedGuestWeek)}</span></div>
        <div className="toolbar__controls">
          <button className={`select-btn ${view === "chart" ? "select-btn--active" : ""}`} onClick={() => setView("chart")}><BarChart3 size={14} />Bar Chart</button>
          <button className={`select-btn ${view === "table" ? "select-btn--active" : ""}`} onClick={() => setView("table")}><Table2 size={14} />Table</button>
        </div>
      </div>

      <div className="stat-grid weekly-summary">
        <KpiCard icon={Euro} label={`${currentYear} Revenue`} value={money.format(revenueTotals.current)} note={`${signedPercentage(revenueChange)} vs ${comparisonYear}`} change={revenueChange} />
        <KpiCard icon={Users} label={`${currentYear} Guests`} value={number.format(currentGuests)} note={`${signedPercentage(guestChange)} vs ${comparisonYear}`} change={guestChange} />
        <KpiCard icon={Euro} label="Average Guest Spending" value={currentSpending == null ? "—" : money.format(currentSpending)} note={`${comparisonYear}: ${comparisonSpending == null ? "—" : money.format(comparisonSpending)} · ${signedPercentage(spendingChange)}`} change={spendingChange} />
        <KpiCard icon={Lightbulb} label="Growth Driver" value={insight.label} note={`${signedPercentage(revenueChange)} revenue change`} />
      </div>

      <div className={`weekly-insight-banner ${revenueChange != null && revenueChange < 0 ? "weekly-insight-banner--down" : ""}`}>
        <Lightbulb size={19} />
        <div><strong>What changed this week</strong><p>{insight.text}</p></div>
      </div>

      <div className="panel weekly-panel">
        <div className="panel__head sales-panel__head">
          <div><h3>{metricConfig.title}</h3><p>{rangeLabel(selectedGuestWeek)} · Thursday to Monday · {currentYear} vs {comparisonYear}</p></div>
          <div className="metric-switch weekly-insights-metric-switch" aria-label="Select a weekly insight metric">
            <button className={metric === "revenue" ? "active" : ""} onClick={() => setMetric("revenue")}>Revenue</button>
            <button className={metric === "guests" ? "active" : ""} onClick={() => setMetric("guests")}>Guests</button>
            <button className={metric === "spending" ? "active" : ""} onClick={() => setMetric("spending")}>Avg Spend</button>
          </div>
        </div>

        {view === "chart" ? (
          <div className="sales-chart">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={combinedRows} margin={{ top: 12, right: 18, left: 4, bottom: 8 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis tickFormatter={metricConfig.yAxis} allowDecimals={metric !== "guests"} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={58} />
                <Tooltip content={<CombinedTooltip metric={metric} />} cursor={{ fill: "var(--surface-hover)" }} />
                <Legend verticalAlign="top" align="right" height={34} iconType="circle" iconSize={8} />
                <Bar dataKey={metricConfig.comparisonKey} name={String(comparisonYear)} fill="var(--series-1)" radius={[5, 5, 0, 0]} maxBarSize={38} />
                <Bar dataKey={metricConfig.currentKey} name={String(currentYear)} fill="var(--series-2)" radius={[5, 5, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="weekly-table weekly-insights-table">
              <thead><tr><th>Day</th><th>{currentYear} Revenue</th><th>{currentYear} Guests</th><th>{currentYear} Avg Spend</th><th>{comparisonYear} Revenue</th><th>{comparisonYear} Guests</th><th>{comparisonYear} Avg Spend</th></tr></thead>
              <tbody>{combinedRows.map((row) => (
                <tr key={`${row.day}-${row.currentDate}`}>
                  <td>{row.day}<small>{dateLabel(row.currentDate)}</small></td>
                  <td>{money.format(row.currentRevenue)}</td><td>{number.format(row.currentGuests)}</td><td>{money.format(row.currentSpending)}</td>
                  <td>{money.format(row.comparisonRevenue)}</td><td>{number.format(row.comparisonGuests)}</td><td>{money.format(row.comparisonSpending)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="source-note"><strong>Sources:</strong> General Ledger weekly sales revenue and OpenTable seated covers, aggregated without guest personal information. <strong>Week definition:</strong> Thursday through the following Monday; the {comparisonYear} comparison uses the same weekdays.</div>
    </div>
  );
}
