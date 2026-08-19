import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Euro, Table2, TrendingDown, TrendingUp, UserPlus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { weeklyGuestData, weeklyGuestMeta } from "../data/weeklyGuestData";
import { getIsoWeekNumber, getWeekTotals, mergeWeeklyGuestBenchmarks, mergeWeeklyRevenueBenchmarks } from "../data/weeklyPerformanceUtils";

const number = new Intl.NumberFormat("de-DE");
const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const latestWeekId = weeklyGuestData.filter((week) => week.available).at(-1)?.id || "";

const dateLabel = (value) => value ? shortDate.format(new Date(`${value}T12:00:00`)) : "—";
const rangeLabel = (week) => week ? `${dateLabel(week.startDate)} – ${dateLabel(week.endDate)}` : "Thursday – Monday";

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

function GuestTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{label}</div>
      {payload.map((item) => (
        <div className="chart-tooltip__row" key={item.name}>
          <span className="chart-tooltip__swatch" style={{ background: item.color }} />
          <span className="chart-tooltip__name">{item.name}</span>
          <span className="chart-tooltip__value">{number.format(item.value)} guests</span>
        </div>
      ))}
    </div>
  );
}

export default function WeeklyGuestCountPage() {
  const [selectedWeekId, setSelectedWeekId] = useState(latestWeekId);
  const [view, setView] = useState("chart");
  const [guestWeeks, setGuestWeeks] = useState(weeklyGuestData);
  const [weeklyRevenueData, setWeeklyRevenueData] = useState([]);
  const [revenueStatus, setRevenueStatus] = useState("loading");
  const selectedWeek = guestWeeks.find((week) => week.id === selectedWeekId) || guestWeeks.find((week) => week.available);
  const rows = selectedWeek?.days || [];
  const hasCurrentData = Boolean(selectedWeek?.available);
  const hasBenchmark = Boolean(selectedWeek?.comparisonCovers != null);
  const difference = hasCurrentData ? selectedWeek?.difference ?? 0 : null;
  const change = hasCurrentData ? selectedWeek?.yoy ?? null : null;
  const selectedRevenueWeek = weeklyRevenueData.find((week) => {
    const revenueWeekNumber = Number(week.weekNumber) || getIsoWeekNumber(week.startDate);
    return week.id === selectedWeekId
      || week.startDate === selectedWeek?.startDate
      || revenueWeekNumber === selectedWeek?.weekNumber;
  });
  const revenueTotals = useMemo(() => getWeekTotals(selectedRevenueWeek), [selectedRevenueWeek]);
  const averageGuestSpending = selectedRevenueWeek && selectedWeek?.currentCovers > 0
    ? revenueTotals.current / selectedWeek.currentCovers
    : null;
  const benchmarkGuestSpending = selectedRevenueWeek && !selectedRevenueWeek.partialBenchmark && selectedWeek?.comparisonCovers > 0
    ? revenueTotals.comparison / selectedWeek.comparisonCovers
    : null;

  useEffect(() => {
    Promise.all([
      fetch("/api/weekly-performance", { credentials: "include" }),
      fetch("/api/weekly-benchmarks", { credentials: "include" }),
    ])
      .then(async ([response, benchmarkResponse]) => {
        if (response.status === 401 || benchmarkResponse.status === 401) return window.location.reload();
        if (!response.ok || !benchmarkResponse.ok) throw new Error("Unable to load weekly benchmark data.");
        return Promise.all([response.json(), benchmarkResponse.json()]);
      })
      .then(([data, benchmarkData]) => {
        setWeeklyRevenueData(mergeWeeklyRevenueBenchmarks(Array.isArray(data) ? data : [], benchmarkData));
        setGuestWeeks(mergeWeeklyGuestBenchmarks(weeklyGuestData, benchmarkData));
        setRevenueStatus("ready");
      })
      .catch(() => {
        setWeeklyRevenueData([]);
        setGuestWeeks(weeklyGuestData);
        setRevenueStatus("error");
      });
  }, []);

  return (
    <div className="dashboard weekly-performance-page">
      <div className="dashboard__header">
        <div><h1>Weekly Guest Count</h1><p className="dashboard__subtitle">OpenTable seated-cover comparison for each Thursday-to-Monday operating week.</p></div>
      </div>

      <div className="weekly-week-picker" aria-label="Select a guest-count reporting week">
        <div className="weekly-week-picker__head">
          <span><CalendarDays size={15} />Select week</span>
          <span className="weekly-week-picker__legend"><i className="weekly-week-picker__dot weekly-week-picker__dot--up" />Positive <i className="weekly-week-picker__dot weekly-week-picker__dot--down" />Negative <i className="weekly-week-picker__dot weekly-week-picker__dot--benchmark" />2025 benchmark</span>
        </div>
        <div className="weekly-week-grid">
          {guestWeeks.map((week) => {
            const direction = !week.available && week.benchmarkAvailable ? "benchmark" : !week.available ? "empty" : week.yoy > 0 ? "up" : week.yoy < 0 ? "down" : "neutral";
            const isSelected = week.id === selectedWeekId;
            const resultLabel = !week.available && week.benchmarkAvailable
              ? `${number.format(week.comparisonCovers)} guest benchmark from 2025`
              : !week.available ? "No data yet" : `${week.yoy >= 0 ? "+" : ""}${week.yoy.toFixed(1)}% year on year`;
            const accessibleLabel = `W${String(week.weekNumber).padStart(2, "0")}, ${rangeLabel(week)}, ${resultLabel}`;

            return (
              <button
                type="button"
                className={`weekly-week-button weekly-week-button--${direction} ${isSelected ? "weekly-week-button--selected" : ""}`}
                key={week.id}
                disabled={!week.available && !week.benchmarkAvailable}
                aria-label={accessibleLabel}
                aria-pressed={isSelected}
                title={accessibleLabel}
                onClick={() => setSelectedWeekId(week.id)}
              >
                <span>W{String(week.weekNumber).padStart(2, "0")}</span>
                <small>{!week.available && week.benchmarkAvailable ? "2025" : week.available ? `${week.yoy >= 0 ? "+" : ""}${week.yoy.toFixed(0)}%` : "—"}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="toolbar weekly-toolbar weekly-view-toolbar">
        <div className="weekly-selected-range"><CalendarDays size={15} /><span>{rangeLabel(selectedWeek)}</span></div>
        <div className="toolbar__controls">
          <button className={`select-btn ${view === "chart" ? "select-btn--active" : ""}`} onClick={() => setView("chart")}><BarChart3 size={14} />Bar Chart</button>
          <button className={`select-btn ${view === "table" ? "select-btn--active" : ""}`} onClick={() => setView("table")}><Table2 size={14} />Table</button>
        </div>
      </div>

      <div className="stat-grid weekly-summary">
        <KpiCard icon={Users} label={`${weeklyGuestMeta.currentYear} Guest Count`} value={hasCurrentData ? number.format(selectedWeek.currentCovers) : "Pending"} note={hasCurrentData ? rangeLabel(selectedWeek) : "Available after this week is completed"} />
        <KpiCard icon={CalendarDays} label={`${weeklyGuestMeta.comparisonYear} Same Weekdays`} value={hasBenchmark ? number.format(selectedWeek.comparisonCovers) : "—"} note={hasBenchmark ? "Thursday to Monday benchmark" : "Waiting for comparison data"} />
        <KpiCard icon={difference != null && difference >= 0 ? UserPlus : TrendingDown} label="Guest Difference" value={difference == null ? "Pending" : `${difference >= 0 ? "+" : ""}${number.format(difference)}${change == null ? "" : ` (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`}`} note={difference == null ? `Calculated when ${weeklyGuestMeta.currentYear} data is available` : `${weeklyGuestMeta.currentYear} minus ${weeklyGuestMeta.comparisonYear}`} />
        <KpiCard icon={Euro} label={hasCurrentData ? "Average Guest Spending" : `${weeklyGuestMeta.comparisonYear} Benchmark Spending`} value={hasCurrentData ? averageGuestSpending == null ? "—" : money.format(averageGuestSpending) : benchmarkGuestSpending == null ? "—" : money.format(benchmarkGuestSpending)} note={hasCurrentData && selectedRevenueWeek ? `${money.format(revenueTotals.current)} revenue ÷ ${number.format(selectedWeek.currentCovers)} guests` : !hasCurrentData && benchmarkGuestSpending != null ? `${money.format(revenueTotals.comparison)} revenue ÷ ${number.format(selectedWeek.comparisonCovers)} guests` : revenueStatus === "loading" ? "Loading weekly sales revenue…" : selectedRevenueWeek?.partialBenchmark ? "Revenue benchmark is partial for this week" : "Weekly Performance revenue is not available for this week"} />
      </div>

      <div className="panel weekly-panel">
        <div className="panel__head sales-panel__head">
          <div><h3>Guest Count Comparison</h3><p>{rangeLabel(selectedWeek)} · Thursday to Monday · {weeklyGuestMeta.currentYear} vs {weeklyGuestMeta.comparisonYear}</p></div>
        </div>

        {view === "chart" ? (
          <div className="sales-chart">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={rows} margin={{ top: 12, right: 18, left: 4, bottom: 8 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis allowDecimals={false} tickFormatter={number.format} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={48} />
                <Tooltip content={<GuestTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
                <Legend verticalAlign="top" align="right" height={34} iconType="circle" iconSize={8} />
                <Bar dataKey="comparisonCovers" name={String(weeklyGuestMeta.comparisonYear)} fill="var(--series-1)" radius={[5, 5, 0, 0]} maxBarSize={38} />
                <Bar dataKey="currentCovers" name={String(weeklyGuestMeta.currentYear)} fill="var(--series-2)" radius={[5, 5, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="weekly-table">
              <thead><tr><th>Day</th><th>{weeklyGuestMeta.currentYear} Date</th><th>{weeklyGuestMeta.currentYear} Guests</th><th>{weeklyGuestMeta.comparisonYear} Date</th><th>{weeklyGuestMeta.comparisonYear} Guests</th><th>Difference</th></tr></thead>
              <tbody>{rows.map((row) => {
                const rowDifference = row.currentCovers != null && row.comparisonCovers != null
                  ? row.currentCovers - row.comparisonCovers
                  : null;
                return <tr key={`${row.day}-${row.currentDate}`}><td>{row.day}</td><td>{dateLabel(row.currentDate)}</td><td>{row.currentCovers == null ? "Pending" : number.format(row.currentCovers)}</td><td>{dateLabel(row.comparisonDate)}</td><td>{row.comparisonCovers == null ? "—" : number.format(row.comparisonCovers)}</td><td className={rowDifference == null ? "sales-change--neutral" : rowDifference >= 0 ? "sales-change--up" : "sales-change--down"}>{rowDifference == null ? "—" : `${rowDifference >= 0 ? "+" : ""}${number.format(rowDifference)}`}</td></tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="source-note"><strong>Source:</strong> OpenTable seated covers, aggregated without guest personal information. <strong>Week definition:</strong> Thursday through the following Monday; future weeks show the aligned 2025 guest benchmark until 2026 results become available. Current data through 17 Aug 2026.</div>
    </div>
  );
}
