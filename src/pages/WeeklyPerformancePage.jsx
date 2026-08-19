import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChartLine, Euro, Table2, TrendingDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildWeekSlots, getWeekTotals, mergeWeeklyRevenueBenchmarks, percentageChange } from "../data/weeklyPerformanceUtils";

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

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

function WeeklyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{label}</div>
      {payload.map((item) => (
        <div className="chart-tooltip__row" key={item.name}>
          <span className="chart-tooltip__swatch" style={{ background: item.color }} />
          <span className="chart-tooltip__name">{item.name}</span>
          <span className="chart-tooltip__value">{money.format(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function WeeklyPerformancePage() {
  const [weeklyData, setWeeklyData] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState("");
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
      setWeeklyData(mergeWeeklyRevenueBenchmarks(data, benchmarkData));
      setSelectedWeekId(data.at(-1)?.id || "");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { loadWeeklyData(); }, []);

  const selectedWeek = weeklyData.find((week) => week.id === selectedWeekId)
    || weeklyData.filter((week) => !week.benchmarkOnly).at(-1)
    || null;
  const rows = selectedWeek?.days || [];
  const hasCurrentData = rows.some((row) => row.currentRevenue != null);
  const hasBenchmark = rows.some((row) => row.comparisonRevenue != null);
  const hasData = hasCurrentData || hasBenchmark;
  const currentYear = selectedWeek?.currentYear || 2026;
  const comparisonYear = selectedWeek?.comparisonYear || 2025;

  const totals = useMemo(() => getWeekTotals(selectedWeek), [selectedWeek]);
  const weekSlots = useMemo(() => buildWeekSlots(weeklyData, currentYear), [weeklyData, currentYear]);

  const difference = hasCurrentData && hasBenchmark ? totals.current - totals.comparison : null;
  const change = hasCurrentData && hasBenchmark ? percentageChange(totals.current, totals.comparison) : null;

  if (status === "loading") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Loading weekly performance data…</h3></div></div></div>;
  if (status === "error") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Weekly performance data could not be loaded.</h3><button className="btn btn--ghost" onClick={loadWeeklyData}>Try again</button></div></div></div>;

  return (
    <div className="dashboard weekly-performance-page">
      <div className="dashboard__header">
        <div><h1>Weekly Performance</h1><p className="dashboard__subtitle">Sales comparison for each Thursday-to-Monday operating week.</p></div>
      </div>

      <div className="weekly-week-picker" aria-label="Select a reporting week">
        <div className="weekly-week-picker__head">
          <span><CalendarDays size={15} />Select week</span>
          <span className="weekly-week-picker__legend"><i className="weekly-week-picker__dot weekly-week-picker__dot--up" />Positive <i className="weekly-week-picker__dot weekly-week-picker__dot--down" />Negative <i className="weekly-week-picker__dot weekly-week-picker__dot--benchmark" />2025 benchmark</span>
        </div>
        <div className="weekly-week-grid">
          {weekSlots.map((slot) => {
            const direction = !slot.hasCurrentData && slot.hasBenchmark ? "benchmark" : slot.change == null ? "empty" : slot.change > 0 ? "up" : slot.change < 0 ? "down" : "neutral";
            const isSelected = slot.week?.id === selectedWeekId;
            const slotTotals = getWeekTotals(slot.week);
            const resultLabel = !slot.hasCurrentData && slot.hasBenchmark
              ? `${money.format(slotTotals.comparison)} benchmark from 2025`
              : slot.change == null ? "No data yet" : `${slot.change >= 0 ? "+" : ""}${slot.change.toFixed(1)}% year on year`;
            const accessibleLabel = `${slot.label}, ${rangeLabel(slot)}, ${resultLabel}`;

            return (
              <button
                type="button"
                className={`weekly-week-button weekly-week-button--${direction} ${isSelected ? "weekly-week-button--selected" : ""}`}
                key={slot.number}
                disabled={!slot.hasData}
                aria-label={accessibleLabel}
                aria-pressed={isSelected}
                title={accessibleLabel}
                onClick={() => slot.week && setSelectedWeekId(slot.week.id)}
              >
                <span>{slot.label}</span>
                <small>{!slot.hasCurrentData && slot.hasBenchmark ? "2025" : slot.change == null ? "—" : `${slot.change >= 0 ? "+" : ""}${slot.change.toFixed(0)}%`}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="toolbar weekly-toolbar weekly-view-toolbar">
        <div className="weekly-selected-range"><CalendarDays size={15} /><span>{rangeLabel(selectedWeek)}</span></div>
        <div className="toolbar__controls">
          <button className={`select-btn ${view === "chart" ? "select-btn--active" : ""}`} onClick={() => setView("chart")}><ChartLine size={14} />Line Chart</button>
          <button className={`select-btn ${view === "table" ? "select-btn--active" : ""}`} onClick={() => setView("table")}><Table2 size={14} />Table</button>
        </div>
      </div>

      <div className="stat-grid weekly-summary">
        <KpiCard icon={Euro} label={`${currentYear} Total Sales Revenue`} value={hasCurrentData ? money.format(totals.current) : "Pending"} note={hasCurrentData ? rangeLabel(selectedWeek) : "Available after this week is completed"} />
        <KpiCard icon={CalendarDays} label={`${comparisonYear} Same Weekdays`} value={hasBenchmark ? money.format(totals.comparison) : "—"} note={selectedWeek?.partialBenchmark ? "Partial benchmark — one source day is not recorded" : hasBenchmark ? "Thursday to Monday benchmark" : "Waiting for comparison data"} />
        <KpiCard icon={difference != null && difference >= 0 ? TrendingUp : TrendingDown} label="Revenue Difference" value={difference == null ? "Pending" : money.format(difference)} note={difference == null ? `Calculated when ${currentYear} data is available` : `${currentYear} minus ${comparisonYear}`} />
        <KpiCard icon={change != null && change < 0 ? TrendingDown : TrendingUp} label="Year-on-Year Change" value={change == null ? "Pending" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} note={change == null ? "2025 benchmark is ready" : "Compared with the same weekdays"} change={change} />
      </div>

      <div className="panel weekly-panel">
        <div className="panel__head sales-panel__head">
          <div><h3>Total Sales Revenue Comparison</h3><p>{rangeLabel(selectedWeek)} · Thursday to Monday · {currentYear} vs {comparisonYear}</p></div>
        </div>

        {!hasData ? (
          <div className="weekly-empty">
            <CalendarDays size={30} />
            <h4>Weekly comparison is ready</h4>
            <p>The 2025 benchmark and the current-year sales figures are not available for this week.</p>
          </div>
        ) : view === "chart" ? (
          <div className="sales-chart">
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={rows} margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis domain={[0, "auto"]} tickFormatter={compactMoney.format} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={58} />
                <Tooltip content={<WeeklyTooltip />} cursor={{ stroke: "var(--grid)", strokeWidth: 1 }} />
                <Legend verticalAlign="top" align="right" height={34} iconType="circle" iconSize={8} />
                <Line type="monotone" dataKey="comparisonRevenue" name={String(comparisonYear)} stroke="var(--series-1)" strokeWidth={3} dot={{ r: 4, fill: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} />
                <Line type="monotone" dataKey="currentRevenue" name={String(currentYear)} stroke="var(--series-2)" strokeWidth={3} dot={{ r: 4, fill: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="weekly-table">
              <thead><tr><th>Day</th><th>{currentYear} Date</th><th>{currentYear} Revenue</th><th>{comparisonYear} Date</th><th>{comparisonYear} Revenue</th><th>Difference</th></tr></thead>
              <tbody>{rows.map((row) => {
                const rowDifference = row.currentRevenue != null && row.comparisonRevenue != null
                  ? Number(row.currentRevenue) - Number(row.comparisonRevenue)
                  : null;
                return <tr key={`${row.day}-${row.currentDate}`}><td>{row.day}</td><td>{dateLabel(row.currentDate)}</td><td>{row.currentRevenue == null ? "Pending" : money.format(row.currentRevenue)}</td><td>{dateLabel(row.comparisonDate)}</td><td>{row.comparisonRevenue == null ? "Not recorded" : money.format(row.comparisonRevenue)}</td><td className={rowDifference == null ? "sales-change--neutral" : rowDifference >= 0 ? "sales-change--up" : "sales-change--down"}>{rowDifference == null ? "—" : money.format(rowDifference)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="source-note"><strong>Week definition:</strong> Thursday through the following Monday. Future weeks show the aligned 2025 General Ledger benchmark until 2026 results become available. W36 and W39 have one unrecorded 2025 revenue day and are marked partial.</div>
    </div>
  );
}
