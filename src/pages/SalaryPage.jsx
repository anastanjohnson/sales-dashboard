import { Banknote, ChefHat, Users, WalletCards } from "lucide-react";
import { salaryData } from "../data/salaryData";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const percent = (salary, revenue) => (revenue ? (salary / revenue) * 100 : 0);

function PercentCell({ value, type }) {
  const warning = type === "kitchen" ? value >= 18 : value >= 17;
  return (
    <td className={`salary-percent ${warning ? "salary-percent--warning" : "salary-percent--good"}`}>
      {value.toFixed(2)}%
    </td>
  );
}

export default function SalaryPage() {
  const completedRows = salaryData.filter((row) => row.kitchenSalary || row.serviceSalary);
  const totals = completedRows.reduce(
    (sum, row) => ({
      revenue: sum.revenue + row.revenue,
      kitchen: sum.kitchen + row.kitchenSalary,
      service: sum.service + row.serviceSalary,
    }),
    { revenue: 0, kitchen: 0, service: 0 },
  );

  return (
    <div className="dashboard salary-page">
      <div className="dashboard__header salary-page__header">
        <div>
          <span className="eyebrow">Salary management</span>
          <h1>Sales & Salary</h1>
          <p className="dashboard__subtitle">Monthly salary costs compared with restaurant revenue.</p>
        </div>
      </div>

      <div className="stat-grid salary-summary">
        <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">Total Revenue</span><span className="stat-card__icon"><Banknote size={16} /></span></div><div className="stat-card__value">{currency.format(totals.revenue)}</div></div>
        <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">Kitchen Salary</span><span className="stat-card__icon"><ChefHat size={16} /></span></div><div className="stat-card__value">{currency.format(totals.kitchen)}</div><div className="stat-card__delta stat-card__delta--neutral">{percent(totals.kitchen, totals.revenue).toFixed(2)}% of revenue</div></div>
        <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">Service Salary</span><span className="stat-card__icon"><Users size={16} /></span></div><div className="stat-card__value">{currency.format(totals.service)}</div><div className="stat-card__delta stat-card__delta--neutral">{percent(totals.service, totals.revenue).toFixed(2)}% of revenue</div></div>
        <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">Total Salary Share</span><span className="stat-card__icon"><WalletCards size={16} /></span></div><div className="stat-card__value">{percent(totals.kitchen + totals.service, totals.revenue).toFixed(2)}%</div></div>
      </div>

      <div className="panel salary-panel">
        <div className="panel__head salary-panel__head">
          <div><h3>Saily Food Service GmbH — Salary Calculation</h3><p>Revenue and departmental salary costs by month</p></div>
          <div className="salary-legend"><span><i className="legend-dot legend-dot--good" />Normal</span><span><i className="legend-dot legend-dot--warning" />High percentage</span></div>
        </div>
        <div className="table-wrap">
          <table className="salary-table">
            <thead><tr><th>Month</th><th>Revenue</th><th>Kitchen Salary</th><th>Kitchen %</th><th>Service Salary</th><th>Service %</th></tr></thead>
            <tbody>
              {salaryData.map((row, index) => {
                const kitchenPct = percent(row.kitchenSalary, row.revenue);
                const servicePct = percent(row.serviceSalary, row.revenue);
                return <tr key={`${row.month}-${index}`}><td className="salary-table__month">{row.month}</td><td>{currency.format(row.revenue)}</td><td>{currency.format(row.kitchenSalary)}</td><PercentCell value={kitchenPct} type="kitchen" /><td>{currency.format(row.serviceSalary)}</td><PercentCell value={servicePct} type="service" /></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
