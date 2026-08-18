import { useState } from "react";
import {
    RefreshCw,
    Filter,
    Download,
    DollarSign,
    FileText,
    BarChart2,
    Calendar,
    Table as TableIcon,
} from "lucide-react";
import StatCard from "../components/StatCard";
import SalesChart from "../components/SalesChart";
import SalaryPage from "./SalaryPage";
import {
    salesByDay,
    stats,
    categoryBreakdown,
    topItems,
    dateRangeLabel,
} from "../data/mockData";

const TABS = ["Daily Report", "Sales", "Inventory", "Customer"];

export default function Dashboard({ activePage, salaryData }) {
    const [activeTab, setActiveTab] = useState("Sales");
    const [showTable, setShowTable] = useState(false);

  if (activePage === "sales-salary") return <SalaryPage salaryData={salaryData} />;

  return (
      <div className="dashboard">
            <div className="dashboard__header">
                    <div>
                              <h1>KARIKAALA - Overall Performance</h1>
                              <p className="dashboard__subtitle">Analyze restaurant data and generate insights.</p>
                    </div>
                    <div className="dashboard__header-actions">
                              <button className="btn btn--ghost">
                                          <RefreshCw size={15} />
                                          Refresh
                              </button>
                              <button className="btn btn--ghost">
                                          <Filter size={15} />
                                          Filter
                              </button>
                    </div>
            </div>
      <div className="toolbar">
            <div className="tabs">
              {TABS.map((tab) => (
                          <button
                                          key={tab}
                                          className={`tabs__item ${activeTab === tab ? "tabs__item--active" : ""}`}
                                          onClick={() => setActiveTab(tab)}
                                        >
                            {tab}
                          </button>
                        ))}
            </div>
            <div className="toolbar__controls">
                      <button className="select-btn">
                                  <Calendar size={14} />
                        {dateRangeLabel}
                      </button>
                      <button className="select-btn">
                                  <BarChart2 size={14} />
                                  Bar Chart
                      </button>
                      <button
                                    className="select-btn"
                                    onClick={() => setShowTable((v) => !v)}
                                    aria-pressed={showTable}
                                  >
                                  <TableIcon size={14} />
                        {showTable ? "Chart" : "Table"}
                      </button>
            </div>
    </div>
    
      <div className="stat-grid">    
          <StatCard
            icon={DollarSign}
            label="Total Sales"
            value={`$${stats.totalSales.value.toLocaleString()}`}
          deltaPct={stats.totalSales.deltaPct}
          direction={stats.totalSales.direction}
        />
        <StatCard
          icon={FileText}
          label="Orders"
          value={stats.orders.value.toLocaleString()}
          deltaPct={stats.orders.deltaPct}
          direction={stats.orders.direction}
        />
        <StatCard
          icon={BarChart2}
          label="Average Order"
          value={`$${stats.avgOrder.value.toFixed(2)}`}
          deltaPct={stats.avgOrder.deltaPct}
          direction={stats.avgOrder.direction}
        />
          </div>



      <div className="panel">
                  <div className="panel__head">
                            <h3>Sales Performance</h3>
                  </div>
        {showTable ? (
                    <div className="table-wrap">
                      <table>
                                    <thead>
                                                    <tr>
                                                                      <th>Day</th>
                                                                      <th>Sales</th>
                                                                      <th>Orders</th>
                                                    </tr>
                                    </thead>
                                    <tbody>
                                      {salesByDay.map((row) => (
                                          <tr key={row.day}>
                                                              <td>{row.day}</td>
                                                              <td>${row.sales.toLocaleString()}</td>
                                                              <td>{row.orders}</td>
                                          </tr>
                                      ))}
                                    </tbody>
                      </table>
                    </div>
                  ) : (
                    <SalesChart data={salesByDay} />
                  )}
</div>

      <div className="panel-row">
          <div className="panel panel--half">
                    <div className="panel__head">
                                <h3>Revenue by Category</h3>
                    </div>
                    <ul className="bar-list">
                      {categoryBreakdown.map((cat) => {
                          const max = Math.max(...categoryBreakdown.map((c) => c.value));
                          const pct = Math.round((cat.value / max) * 100);
                          return (
                                            <li key={cat.name} className="bar-list__row">
                                                              <span className="bar-list__label">{cat.name}</span>
                                                              <div className="bar-list__track">
                                                                                  <div className="bar-list__fill" style={{ width: `${pct}%` }} />
                                                              </div>
                                                              <span className="bar-list__value">${cat.value.toLocaleString()}</span>
                                            </li>
                                          );
          })}
                    </ul>
          </div>
  
          <div className="panel panel--half">
                    <div className="panel__head">
                                <h3>Top Menu Items</h3>
                    </div>
                    <div className="table-wrap">
                                <table>
                                              <thead>
                                                              <tr>
                                                                                <th>Item</th>
                                                                                <th>Orders</th>
                                                                                <th>Revenue</th>
                                                              </tr>
                                              </thead>
                                              <tbody>
                                                {topItems.map((item) => (
                    <tr key={item.name}>
                                        <td>{item.name}</td>
                                        <td>{item.orders}</td>
                                        <td>${item.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                                              </tbody>
                                </table>
                    </div>
          </div>
  </div>
</div>
    );
    }
