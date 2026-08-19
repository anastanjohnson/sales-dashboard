import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Table2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const shortCurrency = (value) => `€${Math.round(value / 1000)}k`;
const monthLabel = (row) => `${row.month} ${row.year}`;
const monthOrder = [
  { short: "Jan", full: "January" },
  { short: "Feb", full: "February" },
  { short: "Mar", full: "March" },
  { short: "Apr", full: "April" },
  { short: "May", full: "May" },
  { short: "Jun", full: "June" },
  { short: "Jul", full: "July" },
  { short: "Aug", full: "August" },
  { short: "Sep", full: "September" },
  { short: "Oct", full: "October" },
  { short: "Nov", full: "November" },
  { short: "Dec", full: "December" },
];

export default function SalaryPage() {
  const [salaryData, setSalaryData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [department, setDepartment] = useState("All");
  const [view, setView] = useState("chart");
  const [status, setStatus] = useState("loading");

  const loadSalaryData = async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/salary", { credentials: "include" });
      if (response.status === 401) return window.location.reload();
      if (!response.ok) throw new Error("Unable to load salary data.");
      const data = await response.json();
      setSalaryData(data);
      setSelectedMonth(Math.max(0, data.length - 1));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { loadSalaryData(); }, []);

  const monthData = salaryData[selectedMonth];
  const visibleEmployees = useMemo(() => {
    if (!monthData) return [];
    return monthData.employees.filter((employee) => department === "All" || employee.department === department);
  }, [monthData, department]);

  const totals = useMemo(() => {
    if (!monthData) return { kitchen: 0, service: 0, total: 0 };
    const kitchen = monthData.employees.filter((employee) => employee.department === "Kitchen").reduce((sum, employee) => sum + employee.salary, 0);
    const service = monthData.employees.filter((employee) => employee.department === "Service").reduce((sum, employee) => sum + employee.salary, 0);
    return { kitchen, service, total: kitchen + service };
  }, [monthData]);

  if (status === "loading") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Loading secure salary data…</h3></div></div></div>;
  if (status === "error" || !monthData) return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Salary data could not be loaded.</h3><button className="btn btn--ghost" onClick={loadSalaryData}>Try again</button></div></div></div>;

  const reset = () => { setSelectedMonth(salaryData.length - 1); setDepartment("All"); setView("chart"); };

  return (
    <div className="dashboard salary-page">
      <div className="dashboard__header">
        <div><h1>Salary</h1><p className="dashboard__subtitle">Protected employee salary data from the 2026 monthly worksheets.</p></div>
        <div className="dashboard__header-actions"><button className="btn btn--ghost" onClick={reset}><RefreshCw size={15} />Reset</button></div>
      </div>

      <div className="salary-month-picker" role="group" aria-label="Select salary month">
        {monthOrder.map(({ short, full }) => {
          const dataIndex = salaryData.findIndex((row) => row.year === 2026 && String(row.month).slice(0, 3).toLowerCase() === short.toLowerCase());
          const available = dataIndex >= 0;
          const selected = available && selectedMonth === dataIndex;
          return <button type="button" key={short} className={`salary-month-button ${selected ? "salary-month-button--active" : ""}`} disabled={!available} aria-pressed={selected} title={available ? `${full} 2026` : `${full} 2026 — no data yet`} onClick={() => setSelectedMonth(dataIndex)}>{short}</button>;
        })}
      </div>

      <div className="toolbar salary-toolbar">
        <div className="metric-switch salary-department-switch" role="group" aria-label="Filter by department">
          {["All", "Kitchen", "Service"].map((option) => <button type="button" key={option} className={department === option ? "active" : ""} aria-pressed={department === option} onClick={() => setDepartment(option)}>{option}</button>)}
        </div>
        <div className="toolbar__controls">
          <button className={`select-btn ${view === "chart" ? "select-btn--active" : ""}`} onClick={() => setView("chart")}><BarChart3 size={14} />Bar Chart</button>
          <button className={`select-btn ${view === "table" ? "select-btn--active" : ""}`} onClick={() => setView("table")}><Table2 size={14} />Table</button>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card__label">Total Salary</div><div className="stat-card__value">{currency.format(totals.total)}</div></div>
        <div className="stat-card"><div className="stat-card__label">Kitchen Salary</div><div className="stat-card__value">{currency.format(totals.kitchen)}</div></div>
        <div className="stat-card"><div className="stat-card__label">Service Salary</div><div className="stat-card__value">{currency.format(totals.service)}</div></div>
      </div>
      <div className="panel salary-panel">
        <div className="panel__head salary-panel__head"><div><h3>Employee Salaries</h3><p>{monthLabel(monthData)} · {department === "All" ? "All departments" : department}</p></div></div>
        {view === "chart" ? <div className="salary-chart"><ResponsiveContainer width="100%" height={420}><BarChart data={visibleEmployees} margin={{ top: 16, right: 18, left: 4, bottom: 82 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" /><XAxis dataKey="name" interval={0} angle={-42} textAnchor="end" height={90} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 11 }} /><YAxis tickFormatter={shortCurrency} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={52} /><Tooltip formatter={(value) => [currency.format(value), "Salary"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} /><Bar dataKey="salary" name="Salary" radius={[4, 4, 0, 0]} maxBarSize={38}>{visibleEmployees.map((employee) => <Cell key={`${employee.department}-${employee.name}`} fill={employee.department === "Kitchen" ? "var(--series-1)" : "var(--series-2)"} />)}</Bar>
        </BarChart></ResponsiveContainer></div> : <div className="table-wrap"><table className="salary-table"><thead><tr><th>Employee</th><th>Department</th><th>Salary</th></tr></thead><tbody>{visibleEmployees.map((employee) => <tr key={`${employee.department}-${employee.name}`}><td className="salary-table__month">{employee.name}</td><td>{employee.department}</td><td>{currency.format(employee.salary)}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
