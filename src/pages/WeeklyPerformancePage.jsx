import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Euro, Table2, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

const dateLabel = (value) => value ? shortDate.format(new Date(`${value}T12:00:00`)) : "—";
const rangeLabel = (week) => week ? `${dateLabel(week.startDate)} – ${dateLabel(week.endDate)}` : "Thursday – Monday";
const percentageChange = (current, previous) => previous > 0 ? ((current - previous) / previous) * 100 : null;

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
      const response = await fetch("/api/weekly-performance", { credentials: "include" });
      if (response.status === 401) return window.location.reload();
      if (!response.ok) throw new Error("Unable to load weekly performance data.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid weekly performance data.");
      setWeeklyData(data);
      setSelectedWeekId(data.at(-1)?.id || "");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { loadWeeklyData(); }, []);

  const selectedWeek = weeklyData.find((week) => week.id === selectedWeekId) || weeklyData.at(-1) || null;
  const rows = selectedWeek?.days || [];
  const hasData = rows.length > 0;
  const currentYear = selectedWeek?.currentYear || 2026;
  const comparisonYear = selectedWeek?.comparisonYear || 2025;

  const totals = useMemo(() => rows.reduce((result, row) => ({
    current: result.current + (Number(row.currentRevenue) || 0),
    comparison: result.comparison + (Number(row.comparisonRevenue) || 0),
  }), { current: 0, comparison: 0 }), [rows]);

  const difference = totals.current - totals.comparison;
  const change = hasData ? percentageChange(totals.current, totals.comparison) : null;

  if (status === "loading") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Loading weekly performance data…</h3></div></div></div>;
  if (status === "error") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Weekly performance data could not be loaded.</h3><button className="btn btn--ghost" onClick={loadWeeklyData}>Try again</button></div></div></div>;

  return (
    <div className="dashboard weekly-performance-page">
      <div className="dashboard__header">
        <div><h1>Weekly Performance</h1><p className="dashboard__subtitle">Sales comparison for each Thursday-to-Monday operating week.</p></div>
      </div>

      <div className="toolbar weekly-toolbar">
        <label className="weekly-week-control">
          <CalendarDays size={15} />
          <span>Week</span>
          <select value={selectedWeekId} onChange={(event) => setSelectedWeekId(event.target.value)} disabled={!weeklyData.length}>
            {!weeklyData.length && <option value="">Waiting for weekly data</option>}
            {weeklyData.map((week) => <option value={week.id} key={week.id}>{rangeLabel(week)}</option>)}
          </select>
        </label>
        <div className="toolbar__controls">
          <button className={`select-btn ${view === "chart" ? "select-btn--active" : ""}`} onClick={() => setView("chart")}><BarChart3 size={14} />Bar Chart</button>
          <button className={`select-btn ${view === "table" ? "select-btn--active" : ""}`} onClick={() => setView("table")}><Table2 size={14} />Table</button>
        </div>
      </div>

      <div className="stat-grid weekly-summary">
        <KpiCard icon={Euro} label={`${currentYear} Total Sales Revenue`} value={hasData ? money.format(totals.current) : "—"} note={hasData ? rangeLabel(selectedWeek) : "Waiting for weekly sales data"} />
        <KpiCard icon={CalendarDays} label={`${comparisonYear} Same Weekdays`} value={hasData ? money.format(totals.comparison) : "—"} note={hasData ? "Thursday to Monday comparison" : "Waiting for comparison data"} />
        <KpiCard icon={difference >= 0 ? TrendingUp : TrendingDown} label="Revenue Difference" value={hasData ? money.format(difference) : "—"} note={hasData ? `${currentYear} minus ${comparisonYear}` : "Calculated when data is added"} />
        <KpiCard icon={change != null && change < 0 ? TrendingDown : TrendingUp} label="Year-on-Year Change" value={change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} note="Compared with the same weekdays" change={change} />
      </div>

      <div className="panel weekly-panel">
        <div className="panel__head sales-panel__head">
          <div><h3>Total Sales Revenue Comparison</h3><p>{rangeLabel(selectedWeek)} · Thursday to Monday · {currentYear} vs {comparisonYear}</p></div>
        </div>

        {!hasData ? (
          <div className="weekly-empty">
            <CalendarDays size={30} />
            <h4>Weekly comparison is ready</h4>
            <p>Send the Thursday-to-Monday sales figures for 2026 and the matching weekdays in 2025 to populate this page.</p>
          </div>
        ) : view === "chart" ? (
          <div className="sales-chart">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={rows} margin={{ top: 12, right: 18, left: 4, bottom: 8 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis tickFormatter={compactMoney.format} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={58} />
                <Tooltip content={<WeeklyTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
                <Legend verticalAlign="top" align="right" height={34} iconType="circle" iconSize={8} />
                <Bar dataKey="comparisonRevenue" name={String(comparisonYear)} fill="var(--series-1)" radius={[5, 5, 0, 0]} maxBarSize={38} />
                <Bar dataKey="currentRevenue" name={String(currentYear)} fill="var(--series-2)" radius={[5, 5, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="weekly-table">
              <thead><tr><th>Day</th><th>{currentYear} Date</th><th>{currentYear} Revenue</th><th>{comparisonYear} Date</th><th>{comparisonYear} Revenue</th><th>Difference</th></tr></thead>
              <tbody>{rows.map((row) => {
                const rowDifference = (Number(row.currentRevenue) || 0) - (Number(row.comparisonRevenue) || 0);
                return <tr key={`${row.day}-${row.currentDate}`}><td>{row.day}</td><td>{dateLabel(row.currentDate)}</td><td>{money.format(row.currentRevenue)}</td><td>{dateLabel(row.comparisonDate)}</td><td>{money.format(row.comparisonRevenue)}</td><td className={rowDifference >= 0 ? "sales-change--up" : "sales-change--down"}>{money.format(rowDifference)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="source-note"><strong>Week definition:</strong> Thursday through the following Monday. The 2025 comparison is aligned to the same weekdays.</div>
    </div>
  );
}
