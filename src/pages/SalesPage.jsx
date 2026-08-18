import { useMemo, useState } from "react";
import { BarChart3, Calendar, Euro, ReceiptText, RefreshCw, Table2, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { salesData } from "../data/salesData";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 0 });
const label = (row) => `${row.month} ${row.year}`;
const fullLabel = (row) => `${row.monthName} ${row.year}`;
const delta = (current, previous) => previous ? ((current - previous) / previous) * 100 : null;
const availableYears = [2025, 2026];

function KpiCard({ icon: Icon, label: title, value, note }) {
  return <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">{title}</span><span className="stat-card__icon"><Icon size={16} /></span></div><div className="stat-card__value">{value}</div><div className="sales-kpi-note">{note}</div></div>;
}

function Change({ value }) {
  if (value === null) return <span className="sales-change sales-change--neutral">—</span>;
  const up = value >= 0;
  return <span className={`sales-change ${up ? "sales-change--up" : "sales-change--down"}`}>{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{up ? "+" : ""}{value.toFixed(1)}%</span>;
}

export default function SalesPage() {
  const [selectedYears, setSelectedYears] = useState(availableYears);
  const [metric, setMetric] = useState("revenue");
  const [view, setView] = useState("chart");

  const rows = useMemo(() => salesData.filter((row) => selectedYears.includes(row.year)).map((row) => {
    const previous = salesData.find((item) => item.year === row.year - 1 && item.month === row.month);
    return { ...row, yoy: previous ? delta(row.revenue, previous.revenue) : null };
  }), [selectedYears]);
  const completeRows = rows.filter((row) => !row.partial);
  const totals = rows.reduce((sum, row) => ({ revenue: sum.revenue + row.revenue, tips: sum.tips + row.tips }), { revenue: 0, tips: 0 });
  const averageMonthlyRevenue = completeRows.length
    ? completeRows.reduce((sum, row) => sum + row.revenue, 0) / completeRows.length
    : 0;
  const bestMonth = completeRows.reduce((best, row) => !best || row.revenue > best.revenue ? row : best, null);
  const latest = rows.at(-1);
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const metricConfig = {
    revenue: { label: "Revenue", formatter: money.format, short: compactMoney.format, color: "var(--series-1)" },
    tips: { label: "Tips", formatter: money.format, short: compactMoney.format, color: "var(--series-2)" },
  }[metric];
  const comparisonData = monthOrder
    .map((month) => {
      const year2025 = rows.find((row) => row.year === 2025 && row.month === month);
      const year2026 = rows.find((row) => row.year === 2026 && row.month === month);
      return {
        month,
        2025: year2025?.[metric] ?? null,
        2026: year2026?.[metric] ?? null,
        partial2026: Boolean(year2026?.partial),
      };
    })
    .filter((row) => row[2025] !== null || row[2026] !== null);

  const toggleYear = (year) => setSelectedYears((current) => {
    if (current.includes(year)) return current.length === 1 ? current : current.filter((item) => item !== year);
    return [...current, year].sort();
  });
  const reset = () => { setSelectedYears(availableYears); setMetric("revenue"); };

  return <div className="dashboard sales-page">
    <div className="dashboard__header"><div><h1>Sales</h1><p className="dashboard__subtitle">Monthly sales performance from the General Ledger.</p></div><div className="dashboard__header-actions"><button className="btn btn--ghost" onClick={reset}><RefreshCw size={15} />Refresh</button></div></div>

    <div className="toolbar sales-toolbar"><div className="metric-switch sales-year-switch" aria-label="Select sales years"><Calendar size={14} />{availableYears.map((year) => <button key={year} type="button" className={selectedYears.includes(year) ? "active" : ""} aria-pressed={selectedYears.includes(year)} onClick={() => toggleYear(year)}>{year}</button>)}</div><div className="toolbar__controls"><button className={`select-btn ${view === "chart" ? "select-btn--active" : ""}`} onClick={() => setView("chart")}><BarChart3 size={14} />Bar Chart</button><button className={`select-btn ${view === "table" ? "select-btn--active" : ""}`} onClick={() => setView("table")}><Table2 size={14} />Table</button></div></div>

    <div className="stat-grid sales-summary"><KpiCard icon={Euro} label="Total Revenue" value={money.format(totals.revenue)} note={`${rows.length} selected months`} /><KpiCard icon={BarChart3} label="Average Monthly Revenue" value={money.format(averageMonthlyRevenue)} note={`${completeRows.length} completed months`} /><KpiCard icon={ReceiptText} label="Tips" value={money.format(totals.tips)} note={`${((totals.tips / Math.max(totals.revenue, 1)) * 100).toFixed(1)}% of revenue`} /><KpiCard icon={TrendingUp} label="Best Full Month" value={bestMonth ? money.format(bestMonth.revenue) : "—"} note={bestMonth ? fullLabel(bestMonth) : "No complete month selected"} /></div>

    <div className="panel sales-panel"><div className="panel__head sales-panel__head"><div><h3>{metricConfig.label} Trend</h3></div><div className="metric-switch"><button className={metric === "revenue" ? "active" : ""} onClick={() => setMetric("revenue")}>Revenue</button><button className={metric === "tips" ? "active" : ""} onClick={() => setMetric("tips")}>Tips</button></div></div>
      {view === "chart" ? <div className="sales-chart"><ResponsiveContainer width="100%" height={360}><BarChart data={comparisonData} margin={{ top: 12, right: 18, left: 4, bottom: 8 }} barGap={4}><CartesianGrid vertical={false} stroke="var(--grid)" /><XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} /><YAxis tickFormatter={metricConfig.short} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={58} /><Tooltip formatter={(value, year, item) => [metricConfig.formatter(value), `${year}${year === "2026" && item.payload.partial2026 ? " (MTD)" : ""}`]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} /><Legend verticalAlign="top" align="right" height={34} iconType="circle" iconSize={8} />{selectedYears.includes(2025) && <Bar dataKey="2025" name="2025" fill="var(--series-1)" radius={[5, 5, 0, 0]} maxBarSize={32} />}{selectedYears.includes(2026) && <Bar dataKey="2026" name="2026" fill="var(--series-2)" radius={[5, 5, 0, 0]} maxBarSize={32} />}</BarChart></ResponsiveContainer></div> : <div className="table-wrap"><table className="sales-table"><thead><tr><th>Month</th><th>Revenue</th><th>Orders</th><th>Average Order</th><th>Tips</th><th>YoY Revenue</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={label(row)}><td>{fullLabel(row)}</td><td>{money.format(row.revenue)}</td><td>{row.orders.toLocaleString()}</td><td>{money.format(row.averageOrder)}</td><td>{money.format(row.tips)}</td><td><Change value={row.yoy} /></td><td>{row.partial ? <span className="status-pill status-pill--partial">Partial{row.asOf ? ` · ${row.asOf}` : ""}</span> : <span className="status-pill">Complete</span>}</td></tr>)}</tbody></table></div>}
    </div>

    {latest?.partial && <div className="source-note"><strong>{fullLabel(latest)} is month-to-date.</strong> The General Ledger contains data through {latest.asOf || "the latest recorded date"}; it is excluded from the “Average Monthly Revenue” and “Best Full Month” KPIs.</div>}
  </div>;
}
