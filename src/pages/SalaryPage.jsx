import { useMemo, useState } from "react";
import { BarChart3, Calendar, Filter, RefreshCw, Table2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { salaryData } from "../data/salaryData";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const shortCurrency = (value) => `€${Math.round(value / 1000)}k`;
const percent = (salary, revenue) => (revenue ? (salary / revenue) * 100 : 0);
const monthLabel = (row) => `${row.month} ${row.year}`;

function PercentCell({ value, type }) {
  const warning = type === "kitchen" ? value >= 18 : value >= 17;
  return <td className={`salary-percent ${warning ? "salary-percent--warning" : "salary-percent--good"}`}>{value.toFixed(2)}%</td>;
}

export default function SalaryPage() {
  const [startMonth, setStartMonth] = useState(0);
  const [endMonth, setEndMonth] = useState(salaryData.length - 1);
  const [view, setView] = useState("chart");
  const [showFilters, setShowFilters] = useState(false);

  const visibleData = useMemo(() => salaryData.slice(startMonth, endMonth + 1), [startMonth, endMonth]);
  const rangeLabel = `${monthLabel(salaryData[startMonth])} – ${monthLabel(salaryData[endMonth])}`;

  const reset = () => {
    setStartMonth(0);
    setEndMonth(salaryData.length - 1);
    setShowFilters(false);
  };

  return (
    <div className="dashboard salary-page">
      <div className="dashboard__header">
        <div><h1>Salary</h1><p className="dashboard__subtitle">Review kitchen and service salary costs by month.</p></div>
        <div className="dashboard__header-actions">
          <button className="btn btn--ghost" onClick={reset}><RefreshCw size={15} />Refresh</button>
          <button className={`btn btn--ghost ${showFilters ? "btn--selected" : ""}`} onClick={() => setShowFilters((value) => !value)}><Filter size={15} />Filter</button>
        </div>
      </div>

      <div className="toolbar salary-toolbar">
        <button className="select-btn" onClick={() => setShowFilters(true)}><Calendar size={14} />{rangeLabel}</button>
        <div className="toolbar__controls">
          <button className={`select-btn ${view === "chart" ? "select-btn--active" : ""}`} onClick={() => setView("chart")}><BarChart3 size={14} />Bar Chart</button>
          <button className={`select-btn ${view === "table" ? "select-btn--active" : ""}`} onClick={() => setView("table")}><Table2 size={14} />Table</button>
        </div>
      </div>

      {showFilters && <div className="salary-filter-panel">
        <label>From month<select value={startMonth} onChange={(event) => { const value = Number(event.target.value); setStartMonth(value); if (value > endMonth) setEndMonth(value); }}>{salaryData.map((row, index) => <option key={`from-${monthLabel(row)}`} value={index}>{monthLabel(row)}</option>)}</select></label>
        <label>To month<select value={endMonth} onChange={(event) => { const value = Number(event.target.value); setEndMonth(value); if (value < startMonth) setStartMonth(value); }}>{salaryData.map((row, index) => <option key={`to-${monthLabel(row)}`} value={index}>{monthLabel(row)}</option>)}</select></label>
        <button className="btn btn--accent" onClick={() => setShowFilters(false)}>Apply</button>
      </div>}

      <div className="panel salary-panel">
        <div className="panel__head salary-panel__head"><div><h3>Monthly Salary</h3><p>{rangeLabel}</p></div></div>
        {view === "chart" ? <div className="salary-chart">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={visibleData} margin={{ top: 16, right: 18, left: 4, bottom: 8 }} barGap={5}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis tickFormatter={shortCurrency} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={52} />
              <Tooltip formatter={(value, name) => [currency.format(value), name]} labelFormatter={(label, payload) => payload?.[0] ? `${label} ${payload[0].payload.year}` : label} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
              <Legend verticalAlign="top" align="right" height={36} iconType="circle" iconSize={8} />
              <Bar dataKey="kitchenSalary" name="Kitchen Salary" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="serviceSalary" name="Service Salary" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div> : <div className="table-wrap">
          <table className="salary-table"><thead><tr><th>Month</th><th>Revenue</th><th>Kitchen Salary</th><th>Kitchen %</th><th>Service Salary</th><th>Service %</th></tr></thead><tbody>
            {visibleData.map((row) => <tr key={monthLabel(row)}><td className="salary-table__month">{monthLabel(row)}</td><td>{currency.format(row.revenue)}</td><td>{currency.format(row.kitchenSalary)}</td><PercentCell value={percent(row.kitchenSalary, row.revenue)} type="kitchen" /><td>{currency.format(row.serviceSalary)}</td><PercentCell value={percent(row.serviceSalary, row.revenue)} type="service" /></tr>)}
          </tbody></table>
        </div>}
      </div>
    </div>
  );
}
