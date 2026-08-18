import { useMemo, useState } from "react";
import { BarChart3, Calendar, Euro, Filter, ReceiptText, RefreshCw, ShoppingBag, Table2, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { salesData } from "../data/salesData";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 0 });
const label = (row) => `${row.month} ${row.year}`;
const fullLabel = (row) => `${row.monthName} ${row.year}`;
const delta = (current, previous) => previous ? ((current - previous) / previous) * 100 : null;

function KpiCard({ icon: Icon, label: title, value, note }) {
  return <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">{title}</span><span className="stat-card__icon"><Icon size={16} /></span></div><div className="stat-card__value">{value}</div><div className="sales-kpi-note">{note}</div></div>;
}

function Change({ value }) {
  if (value === null) return <span className="sales-change sales-change--neutral">—</span>;
  const up = value >= 0;
  return <span className={`sales-change ${up ? "sales-change--up" : "sales-change--down"}`}>{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{up ? "+" : ""}{value.toFixed(1)}%</span>;
}

export default function SalesPage() {
  const [start, setStart] = useState(Math.max(0, salesData.length - 12));
  const [end, setEnd] = useState(salesData.length - 1);
  const [metric, setMetric] = useState("revenue");
  const [view, setView] = useState("chart");
  const [showFilters, setShowFilters] = useState(false);

  const rows = useMemo(() => salesData.slice(start, end + 1).map((row) => {
    const previous = salesData.find((item) => item.year === row.year - 1 && item.month === row.month);
    return { ...row, yoy: previous ? delta(row.revenue, previous.revenue) : null };
  }), [start, end]);
  const completeRows = rows.filter((row) => !row.partial);
  const totals = rows.reduce((sum, row) => ({ revenue: sum.revenue + row.revenue, orders: sum.orders + row.orders, tips: sum.tips + row.tips }), { revenue: 0, orders: 0, tips: 0 });
  const bestMonth = completeRows.reduce((best, row) => !best || row.revenue > best.revenue ? row : best, null);
  const latest = rows.at(-1);
  const rangeLabel = `${fullLabel(salesData[start])} – ${fullLabel(salesData[end])}`;
  const metricConfig = {
    revenue: { label: "Revenue", formatter: money.format, short: compactMoney.format, color: "var(--series-1)" },
    tips: { label: "Tips", formatter: money.format, short: compactMoney.format, color: "var(--series-2)" },
    averageOrder: { label: "Average Order", formatter: money.format, short: (value) => `€${Math.round(value)}`, color: "var(--series-3)" },
  }[metric];

  const reset = () => { setStart(Math.max(0, salesData.length - 12)); setEnd(salesData.length - 1); setMetric("revenue"); setShowFilters(false); };

  return <div className="dashboard sales-page">
    <div className="dashboard__header"><div><h1>Sales</h1><p className="dashboard__subtitle">Monthly sales performance from the General Ledger.</p></div><div className="dashboard__header-actions"><button className="btn btn--ghost" onClick={reset}><RefreshCw size={15} />Refresh</button><button className={`btn btn--ghost ${showFilters ? "btn--selected" : ""}`} onClick={() => setShowFilters((value) => !value)}><Filter size={15} />Filter</button></div></div>

    <div className="toolbar sales-toolbar"><button className="select-btn" onClick={() => setShowFilters(true)}><Calendar size={14} />{rangeLabel}</button><div className="toolbar__controls"><button className={`select-btn ${view === "chart" ? "select-btn--active" : ""}`} onClick={() => setView("chart")}><BarChart3 size={14} />Bar Chart</button><button className={`select-btn ${view === "table" ? "select-btn--active" : ""}`} onClick={() => setView("table")}><Table2 size={14} />Table</button></div></div>

    {showFilters && <div className="salary-filter-panel"><label>From month<select value={start} onChange={(event) => { const value = Number(event.target.value); setStart(value); if (value > end) setEnd(value); }}>{salesData.map((row, index) => <option key={`sales-from-${label(row)}`} value={index}>{fullLabel(row)}</option>)}</select></label><label>To month<select value={end} onChange={(event) => { const value = Number(event.target.value); setEnd(value); if (value < start) setStart(value); }}>{salesData.map((row, index) => <option key={`sales-to-${label(row)}`} value={index}>{fullLabel(row)}</option>)}</select></label><button className="btn btn--accent" onClick={() => setShowFilters(false)}>Apply</button></div>}

    <div className="stat-grid sales-summary"><KpiCard icon={Euro} label="Total Revenue" value={money.format(totals.revenue)} note={`${rows.length} selected months`} /><KpiCard icon={ShoppingBag} label="Total Orders" value={totals.orders.toLocaleString()} note={`${money.format(totals.revenue / Math.max(totals.orders, 1))} weighted average`} /><KpiCard icon={ReceiptText} label="Tips" value={money.format(totals.tips)} note={`${((totals.tips / Math.max(totals.revenue, 1)) * 100).toFixed(1)}% of revenue`} /><KpiCard icon={TrendingUp} label="Best Full Month" value={bestMonth ? money.format(bestMonth.revenue) : "—"} note={bestMonth ? fullLabel(bestMonth) : "No complete month selected"} /></div>

    <div className="panel sales-panel"><div className="panel__head sales-panel__head"><div><h3>{metricConfig.label} Trend</h3><p>{rangeLabel}</p></div><div className="metric-switch"><button className={metric === "revenue" ? "active" : ""} onClick={() => setMetric("revenue")}>Revenue</button><button className={metric === "tips" ? "active" : ""} onClick={() => setMetric("tips")}>Tips</button><button className={metric === "averageOrder" ? "active" : ""} onClick={() => setMetric("averageOrder")}>Avg. Order</button></div></div>
      {view === "chart" ? <div className="sales-chart"><ResponsiveContainer width="100%" height={360}><BarChart data={rows} margin={{ top: 12, right: 18, left: 4, bottom: 8 }}><CartesianGrid vertical={false} stroke="var(--grid)" /><XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} /><YAxis tickFormatter={metricConfig.short} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={58} /><Tooltip formatter={(value) => [metricConfig.formatter(value), metricConfig.label]} labelFormatter={(value, payload) => payload?.[0] ? `${value} ${payload[0].payload.year}${payload[0].payload.partial ? " (partial)" : ""}` : value} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} /><Legend verticalAlign="top" align="right" height={34} iconType="circle" iconSize={8} /><Bar dataKey={metric} name={metricConfig.label} fill={metricConfig.color} radius={[5, 5, 0, 0]} maxBarSize={38} /></BarChart></ResponsiveContainer></div> : <div className="table-wrap"><table className="sales-table"><thead><tr><th>Month</th><th>Revenue</th><th>Orders</th><th>Average Order</th><th>Tips</th><th>YoY Revenue</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={label(row)}><td>{fullLabel(row)}</td><td>{money.format(row.revenue)}</td><td>{row.orders.toLocaleString()}</td><td>{money.format(row.averageOrder)}</td><td>{money.format(row.tips)}</td><td><Change value={row.yoy} /></td><td>{row.partial ? <span className="status-pill status-pill--partial">Partial{row.asOf ? ` · ${row.asOf}` : ""}</span> : <span className="status-pill">Complete</span>}</td></tr>)}</tbody></table></div>}
    </div>

    {latest?.partial && <div className="source-note"><strong>{fullLabel(latest)} is month-to-date.</strong> The General Ledger contains data through {latest.asOf || "the latest recorded date"}; it is excluded from the “Best Full Month” KPI.</div>}
  </div>;
}
