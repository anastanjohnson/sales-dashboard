import { useMemo } from "react";
import { BarChart3, Calendar, ReceiptText, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { salesData } from "../data/salesData";

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const change = (current, previous) => previous > 0 ? ((current - previous) / previous) * 100 : null;

function SpendingCard({ icon: Icon, label, value, note, delta }) {
  const positive = delta != null && delta >= 0;
  return <div className="stat-card">
    <div className="stat-card__head"><span className="stat-card__label">{label}</span><span className="stat-card__icon"><Icon size={16} /></span></div>
    <div className="stat-card__value">{value}</div>
    <div className={delta == null ? "sales-kpi-note" : `sales-change ${positive ? "sales-change--up" : "sales-change--down"}`}>
      {delta == null ? note : <>{positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{positive ? "+" : ""}{delta.toFixed(1)}% vs 2025</>}
    </div>
  </div>;
}

export default function AverageSpendingPage() {
  const rows = useMemo(() => salesData.filter((row) => row.year === 2026).map((row) => {
    const previous = salesData.find((item) => item.year === 2025 && item.month === row.month);
    return { ...row, previousAverage: previous?.averageOrder ?? null };
  }), []);
  const completeRows = rows.filter((row) => !row.partial);
  const matchedPreviousRows = salesData.filter((row) => row.year === 2025 && completeRows.some((current) => current.month === row.month));
  const currentAverage = completeRows.reduce((sum, row) => sum + row.revenue, 0) / Math.max(completeRows.reduce((sum, row) => sum + row.orders, 0), 1);
  const previousAverage = matchedPreviousRows.reduce((sum, row) => sum + row.revenue, 0) / Math.max(matchedPreviousRows.reduce((sum, row) => sum + row.orders, 0), 1);
  const latest = rows.at(-1);
  const best = completeRows.reduce((winner, row) => !winner || row.averageOrder > winner.averageOrder ? row : winner, null);
  const chartData = rows.map((row) => ({ month: row.month, 2025: row.previousAverage, 2026: row.averageOrder, partial: row.partial }));

  return <div className="dashboard average-spending-page">
    <div className="dashboard__header"><div><h1>Average Spending</h1><p className="dashboard__subtitle">Average order value from the General Ledger.</p></div></div>
    <div className="toolbar"><div className="metric-switch sales-year-switch"><Calendar size={14} /><button type="button" className="active" aria-pressed="true">2026</button></div></div>
    <div className="stat-grid sales-summary">
      <SpendingCard icon={ReceiptText} label="Average Spending" value={money.format(currentAverage)} delta={change(currentAverage, previousAverage)} />
      <SpendingCard icon={BarChart3} label="Latest Month" value={latest ? money.format(latest.averageOrder) : "—"} note={latest ? `${latest.monthName} 2026${latest.partial ? " · month-to-date" : ""}` : "No data"} />
      <SpendingCard icon={TrendingUp} label="Best Full Month" value={best ? money.format(best.averageOrder) : "—"} note={best ? `${best.monthName} 2026` : "No complete month"} />
    </div>
    <div className="panel sales-panel">
      <div className="panel__head sales-panel__head"><div><h3>Average Spending by Month</h3><p>2026 compared with the same months in 2025</p></div></div>
      <div className="sales-chart"><ResponsiveContainer width="100%" height={360}><BarChart data={chartData} margin={{ top: 12, right: 18, left: 4, bottom: 8 }} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis tickFormatter={(value) => `€${value}`} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={58} />
        <Tooltip formatter={(value, year, item) => [money.format(value), `${year}${year === "2026" && item.payload.partial ? " (MTD)" : ""}`]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
        <Legend verticalAlign="top" align="right" height={34} iconType="circle" iconSize={8} />
        <Bar dataKey="2025" name="2025 comparison" fill="var(--series-1)" radius={[5, 5, 0, 0]} maxBarSize={32} />
        <Bar dataKey="2026" name="2026" fill="var(--series-2)" radius={[5, 5, 0, 0]} maxBarSize={32} />
      </BarChart></ResponsiveContainer></div>
    </div>
    {latest?.partial && <div className="source-note"><strong>{latest.monthName} 2026 is month-to-date.</strong> It is shown in the chart but excluded from the completed-month average.</div>}
  </div>;
}
