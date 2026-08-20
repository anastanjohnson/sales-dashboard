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
import { getIsoWeekNumber, getWeekTotals, mergeWeeklyGuestBenchmarks, mergeWeeklyRevenueBenchmarks, percentageChange } from "../data/weeklyPerformanceUtils";

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
  const [guestWeeks, setGuestWeeks] = useState(weeklyGuestData);
  const [selectedWeekId, setSelectedWeekId] = useState(latestWeekId);
  const [metric, setMetric] = useState("revenue");
  const [view, setView] = useState("chart");
  const [status, setStatus] = useState("loading");

  const loadWeeklyData = async () => {
    setStatus("loading");
    try {
      const [response, benchmarkResponse] = await Promise.all([
        fetch("/api/weekly-performance", { credentials: "include" }),
        fetch("/api/weekly-benchmarks", { credentials: "include" }),
      ]);
      if (response.status === 401 || benchmarkResponse.status === 401) return window.location.reload();
      if (!response.ok || !benchmarkResponse.ok) throw new Error("Unable to load weekly performance data.");
      const [data, benchmarkData] = await Promise.all([response.json(), benchmarkResponse.json()]);
      if (!Array.isArray(data)) throw new Error("Invalid weekly performance data.");
      const mergedData = mergeWeeklyRevenueBenchmarks(data, benchmarkData);
      const mergedGuestWeeks = mergeWeeklyGuestBenchmarks(weeklyGuestData, benchmarkData);
      setWeeklyRevenueData(mergedData);
      setGuestWeeks(mergedGuestWeeks);
      const latestCombinedWeek = [...mergedGuestWeeks].reverse().find((week) => week.available && findRevenueWeek(week, mergedData));
      setSelectedWeekId(latestCombinedWeek?.id || latestWeekId);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { loadWeeklyData(); }, []);

  const selectedGuestWeek = guestWeeks.find((week) => week.id === selectedWeekId) || null;
  const selectedRevenueWeek = findRevenueWeek(selectedGuestWeek, weeklyRevenueData) || null;
  const currentYear = selectedRevenueWeek?.currentYear || weeklyGuestMeta.currentYear;
  const comparisonYear = selectedRevenueWeek?.comparisonYear || weeklyGuestMeta.comparisonYear;
  const revenueTotals = useMemo(() => getWeekTotals(selectedRevenueWeek), [selectedRevenueWeek]);
  const currentGuests = selectedGuestWeek?.currentCovers == null ? null : Number(selectedGuestWeek.currentCovers);
  const comparisonGuests = selectedGuestWeek?.comparisonCovers == null ? null : Number(selectedGuestWeek.comparisonCovers);
  const hasCurrentData = Boolean(selectedGuestWeek?.available && selectedRevenueWeek?.days?.some((row) => row.currentRevenue != null));
  const hasBenchmark = Boolean(comparisonGuests != null && selectedRevenueWeek?.days?.some((row) => row.comparisonRevenue != null));
  const currentSpending = hasCurrentData && currentGuests > 0 ? revenueTotals.current / currentGuests : null;
  const comparisonSpending = hasBenchmark && !selectedRevenueWeek?.partialBenchmark && comparisonGuests > 0 ? revenueTotals.comparison / comparisonGuests : null;
  const revenueChange = hasCurrentData ? percentageChange(revenueTotals.current, revenueTotals.comparison) : null;
  const guestChange = hasCurrentData ? percentageChange(currentGuests, comparisonGuests) : null;
  const spendingChange = currentSpending != null && comparisonSpending != null
    ? percentageChange(currentSpending, comparisonSpending)
    : null;
  const insight = hasCurrentData
    ? buildGrowthInsight(revenueChange, guestChange, spendingChange)
    : {
      label: "Benchmark ready",
      text: hasBenchmark
        ? `${comparisonYear} benchmark: ${selectedRevenueWeek?.partialBenchmark ? "partial " : ""}${money.format(revenueTotals.comparison)} revenue, ${number.format(comparisonGuests)} guests${comparisonSpending == null ? "" : ` and ${money.format(comparisonSpending)} spending per guest`}. ${currentYear} results will appear after the week is completed.`
        : "The previous-year revenue and guest benchmark is not available for this week.",
    };

  const combinedRows = useMemo(() => (selectedGuestWeek?.days || []).map((guestRow) => {
    const revenueRow = (selectedRevenueWeek?.days || []).find((row) => row.day === guestRow.day || row.currentDate === guestRow.currentDate);
    const currentRevenue = revenueRow?.currentRevenue == null ? null : Number(revenueRow.currentRevenue);
    const comparisonRevenue = revenueRow?.comparisonRevenue == null ? null : Number(revenueRow.comparisonRevenue);
    const currentDayGuests = guestRow.currentCovers == null ? null : Number(guestRow.currentCovers);
    const comparisonDayGuests = guestRow.comparisonCovers == null ? null : Number(guestRow.comparisonCovers);

    return {
      day: guestRow.day,
      currentDate: guestRow.currentDate,
      comparisonDate: guestRow.comparisonDate,
      currentRevenue,
      comparisonRevenue,
      currentGuests: currentDayGuests,
      comparisonGuests: comparisonDayGuests,
      currentSpending: currentRevenue != null && currentDayGuests > 0 ? currentRevenue / currentDayGuests : null,
      comparisonSpending: comparisonRevenue != null && comparisonDayGuests > 0 ? comparisonRevenue / comparisonDayGuests : null,
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
          <span className="weekly-week-picker__legend"><i className="weekly-week-picker__dot weekly-week-picker__dot--up" />Revenue positive <i className="weekly-week-picker__dot weekly-week-picker__dot--down" />Revenue negative <i className="weekly-week-picker__dot weekly-week-picker__dot--benchmark" />2025 benchmark</span>
        </div>
        <div className="weekly-week-grid">
          {guestWeeks.map((guestWeek) => {
            const revenueWeek = findRevenueWeek(guestWeek, weeklyRevenueData);
            const totals = getWeekTotals(revenueWeek);
            const hasCurrentWeekData = Boolean(guestWeek.available && revenueWeek?.days?.some((row) => row.currentRevenue != null));
            const hasBenchmarkData = Boolean(guestWeek.comparisonCovers != null && revenueWeek?.days?.some((row) => row.comparisonRevenue != null));
            const hasData = hasCurrentWeekData || hasBenchmarkData;
            const isDisabled = Number(guestWeek.weekNumber) >= 34 || !hasData;
            const change = hasCurrentWeekData ? percentageChange(totals.current, totals.comparison) : null;
            const direction = !hasCurrentWeekData && hasBenchmarkData ? "benchmark" : change == null ? "empty" : change > 0 ? "up" : change < 0 ? "down" : "neutral";
            const isSelected = guestWeek.id === selectedWeekId;
            const resultLabel = !hasCurrentWeekData && hasBenchmarkData
              ? `${money.format(totals.comparison)} revenue and ${number.format(guestWeek.comparisonCovers)} guest benchmark from 2025`
              : change == null ? "Combined data not available" : `${signedPercentage(change)} revenue year on year`;
            const accessibleLabel = `W${String(guestWeek.weekNumber).padStart(2, "0")}, ${rangeLabel(guestWeek)}, ${resultLabel}`;

            return (
              <button
                type="button"
                className={`weekly-week-button weekly-week-button--${direction} ${isSelected ? "weekly-week-button--selected" : ""}`}
                key={guestWeek.id}
                disabled={isDisabled}
                aria-label={accessibleLabel}
                aria-pressed={isSelected}
                title={accessibleLabel}
                onClick={() => setSelectedWeekId(guestWeek.id)}
              >
                <span>W{String(guestWeek.weekNumber).padStart(2, "0")}</span>
                <small>{!hasCurrentWeekData && hasBenchmarkData ? "2025" : change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`}</small>
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
        {hasCurrentData ? <>
          <KpiCard icon={Euro} label={`${currentYear} Revenue`} value={money.format(revenueTotals.current)} note={`${signedPercentage(revenueChange)} vs ${comparisonYear}`} change={revenueChange} />
          <KpiCard icon={Users} label={`${currentYear} Guests`} value={number.format(currentGuests)} note={`${signedPercentage(guestChange)} vs ${comparisonYear}`} change={guestChange} />
          <KpiCard icon={Euro} label="Average Guest Spending" value={currentSpending == null ? "—" : money.format(currentSpending)} note={`${comparisonYear}: ${comparisonSpending == null ? "—" : money.format(comparisonSpending)} · ${signedPercentage(spendingChange)}`} change={spendingChange} />
        </> : <>
          <KpiCard icon={Euro} label={`${comparisonYear} Revenue Benchmark`} value={hasBenchmark ? money.format(revenueTotals.comparison) : "—"} note={selectedRevenueWeek?.partialBenchmark ? "Partial — one source day is not recorded" : "Thursday to Monday benchmark"} />
          <KpiCard icon={Users} label={`${comparisonYear} Guest Benchmark`} value={comparisonGuests == null ? "—" : number.format(comparisonGuests)} note="OpenTable seated covers" />
          <KpiCard icon={Euro} label={`${comparisonYear} Average Guest Spending`} value={comparisonSpending == null ? "—" : money.format(comparisonSpending)} note={comparisonSpending == null ? "Unavailable because the revenue benchmark is partial" : "Benchmark revenue ÷ benchmark guests"} />
          <KpiCard icon={CalendarDays} label={`${currentYear} Results`} value="Pending" note="Comparison activates after this week is completed" />
        </>}
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
                  <td>{row.currentRevenue == null ? "Pending" : money.format(row.currentRevenue)}</td><td>{row.currentGuests == null ? "Pending" : number.format(row.currentGuests)}</td><td>{row.currentSpending == null ? "—" : money.format(row.currentSpending)}</td>
                  <td>{row.comparisonRevenue == null ? "Not recorded" : money.format(row.comparisonRevenue)}</td><td>{row.comparisonGuests == null ? "—" : number.format(row.comparisonGuests)}</td><td>{row.comparisonSpending == null ? "—" : money.format(row.comparisonSpending)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="source-note"><strong>Sources:</strong> General Ledger weekly sales revenue and OpenTable seated covers, aggregated without guest personal information. <strong>Week definition:</strong> Thursday through the following Monday; future weeks show aligned {comparisonYear} revenue, guest and spending benchmarks until {currentYear} results become available. W36 and W39 have one unrecorded revenue day and are marked partial.</div>
    </div>
  );
}
