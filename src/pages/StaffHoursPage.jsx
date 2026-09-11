import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clock3, RefreshCw, Table2, TriangleAlert, Users } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEFAULT_HOURS_LIMIT = 43;
const STAFF_HOURS_LIMITS = {
  fawad: null,
  dina: 10,
  thikalya: 14,
  kirushalani: 14,
  suman: 14,
};

function getHoursLimit(name) {
  const normalizedName = String(name || "").trim().toLowerCase();
  const matchedName = Object.keys(STAFF_HOURS_LIMITS).find((staffName) => normalizedName.includes(staffName));
  return matchedName ? STAFF_HOURS_LIMITS[matchedName] : DEFAULT_HOURS_LIMIT;
}
const hours = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function StaffHoursPage() {
  const [staffHoursData, setStaffHoursData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [view, setView] = useState("chart");
  const [status, setStatus] = useState("loading");

  const loadData = async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/staff-hours", { credentials: "include" });
      if (response.status === 401) return window.location.reload();
      if (!response.ok) throw new Error("Unable to load staff hours.");
      const data = await response.json();
      setStaffHoursData(data);
      setSelectedMonth(Math.max(0, data.length - 1));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { loadData(); }, []);

  const monthData = staffHoursData[selectedMonth];
  const staff = useMemo(() => (monthData?.employees || [])
    .map((employee) => {
      const workingHours = Math.max(0, Number(employee.workingHours) || 0);
      const hoursLimit = getHoursLimit(employee.name);
      return {
        ...employee,
        workingHours,
        hoursLimit,
        regularHours: hoursLimit == null ? workingHours : Math.min(workingHours, hoursLimit),
        extraHours: hoursLimit == null ? 0 : Math.max(0, workingHours - hoursLimit),
        remainingTo43: hoursLimit === DEFAULT_HOURS_LIMIT ? Math.max(0, DEFAULT_HOURS_LIMIT - workingHours) : 0,
      };
    })
    .sort((a, b) => {
      const workedDifference = b.workingHours - a.workingHours;
      if (workedDifference !== 0) return workedDifference;
      const aLimit = a.hoursLimit == null ? Number.POSITIVE_INFINITY : a.hoursLimit;
      const bLimit = b.hoursLimit == null ? Number.POSITIVE_INFINITY : b.hoursLimit;
      const limitDifference = bLimit - aLimit;
      if (limitDifference !== 0) return limitDifference;
      return String(a.name).localeCompare(String(b.name));
    }), [monthData]);

  const maxChartHours = useMemo(() => Math.max(DEFAULT_HOURS_LIMIT, ...staff.map((employee) => Math.max(employee.workingHours, employee.hoursLimit || 0))), [staff]);

  const summary = useMemo(() => ({
    totalHours: staff.reduce((sum, employee) => sum + employee.workingHours, 0),
    extraHours: staff.reduce((sum, employee) => sum + employee.extraHours, 0),
    aboveTarget: staff.filter((employee) => employee.extraHours > 0).length,
  }), [staff]);

  if (status === "loading") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Loading staff hours…</h3></div></div></div>;
  if (status === "error" || !staffHoursData.length) return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Staff hours could not be loaded.</h3><button className="btn btn--ghost" onClick={loadData}>Try again</button></div></div></div>;

  return (
    <div className="dashboard staff-hours-page">
      <div className="dashboard__header">
        <div><h1>Staff Hours</h1><p className="dashboard__subtitle">Monthly hours worked by Service staff, with time above each employee’s limit highlighted.</p></div>
        <div className="dashboard__header-actions"><button className="btn btn--ghost" onClick={loadData}><RefreshCw size={15} />Refresh</button></div>
      </div>

      <div className="salary-month-picker" role="group" aria-label="Select staff hours month">
        {MONTHS.map((month) => {
          const dataIndex = staffHoursData.findIndex((row) => row.year === 2026 && String(row.month).slice(0, 3).toLowerCase() === month.toLowerCase());
          const available = dataIndex >= 0;
          const selected = available && selectedMonth === dataIndex;
          return <button type="button" key={month} className={"salary-month-button " + (selected ? "salary-month-button--active" : "")} disabled={!available} aria-pressed={selected} onClick={() => setSelectedMonth(dataIndex)}>{month}</button>;
        })}
      </div>

      <div className="toolbar">
        <div className="staff-hours-threshold"><Clock3 size={15} /><span>Monthly limits: <strong>Fawad unlimited · Dina 10 h · Thikalya, Kirushalani & Suman 14 h · Others 43 h</strong></span></div>
        <div className="toolbar__controls">
          <button className={"select-btn " + (view === "chart" ? "select-btn--active" : "")} onClick={() => setView("chart")}><BarChart3 size={14} />Bar Chart</button>
          <button className={"select-btn " + (view === "table" ? "select-btn--active" : "")} onClick={() => setView("table")}><Table2 size={14} />Table</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">Service Staff</span><span className="stat-card__icon"><Users size={16} /></span></div><div className="stat-card__value">{staff.length}</div><div className="sales-kpi-note">{monthData.month} {monthData.year}</div></div>
        <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">Total Worked Hours</span><span className="stat-card__icon"><Clock3 size={16} /></span></div><div className="stat-card__value">{hours.format(summary.totalHours)} h</div><div className="sales-kpi-note">All Service staff</div></div>
        <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">Above Individual Limits</span><span className="stat-card__icon"><TriangleAlert size={16} /></span></div><div className="stat-card__value">{summary.aboveTarget}</div><div className="sales-kpi-note">Staff members above their limit</div></div>
        <div className="stat-card"><div className="stat-card__head"><span className="stat-card__label">Total Extra Hours</span><span className="stat-card__icon"><Clock3 size={16} /></span></div><div className="stat-card__value staff-hours-extra">{hours.format(summary.extraHours)} h</div><div className="sales-kpi-note">Combined hours above individual limits</div></div>
      </div>

      <div className="panel staff-hours-panel">
        <div className="panel__head salary-panel__head"><div><h3>Monthly Service Staff Hours</h3><p>{monthData.month} {monthData.year} · Sorted by worked hours, highest to lowest · Red sections show hours above each employee’s limit</p></div></div>
        {view === "chart" ? (
          <div className="staff-hours-horizontal" role="img" aria-label="Service staff worked hours and monthly limits">
            <div className="staff-hours-horizontal__legend">
              <span><i className="staff-hours-horizontal__key staff-hours-horizontal__key--worked" />Within limit</span>
              <span><i className="staff-hours-horizontal__key staff-hours-horizontal__key--extra" />Above limit</span>
              <span><i className="staff-hours-horizontal__key staff-hours-horizontal__key--remaining" />Remaining to 43 h</span>
            </div>
            <div className="staff-hours-horizontal__rows">
              {staff.map((employee) => {
                const regularWidth = (employee.regularHours / maxChartHours) * 100;
                const extraWidth = (employee.extraHours / maxChartHours) * 100;
                const remainingWidth = (employee.remainingTo43 / maxChartHours) * 100;
                return (
                  <div className="staff-hours-horizontal__row" key={employee.name}>
                    <div className="staff-hours-horizontal__name">{employee.name}</div>
                    <div className="staff-hours-horizontal__track" aria-label={`${employee.name}: ${hours.format(employee.workingHours)} hours worked; ${employee.hoursLimit == null ? "no limit" : `${hours.format(employee.hoursLimit)} hour limit`}`}>
                      <span className="staff-hours-horizontal__worked" style={{ width: `${regularWidth}%` }} />
                      {employee.extraHours > 0 && <span className="staff-hours-horizontal__extra" style={{ width: `${extraWidth}%` }} />}
                      {employee.remainingTo43 > 0 && <span className="staff-hours-horizontal__remaining" style={{ width: `${remainingWidth}%` }} />}
                    </div>
                    <div className="staff-hours-horizontal__value">
                      <strong>{hours.format(employee.workingHours)} h</strong>
                      <span>{employee.hoursLimit == null ? "No limit" : `Limit ${hours.format(employee.hoursLimit)} h`}</span>
                      {employee.extraHours > 0 && <em>+{hours.format(employee.extraHours)} h</em>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="table-wrap"><table className="staff-hours-table"><thead><tr><th>Employee</th><th>Worked Hours</th><th>Monthly Limit</th><th>Extra Hours</th><th>Status</th></tr></thead><tbody>{staff.map((employee) => <tr key={employee.name}><td className="salary-table__month">{employee.name}</td><td>{hours.format(employee.workingHours)} h</td><td>{employee.hoursLimit == null ? "No limit" : `${hours.format(employee.hoursLimit)} h`}</td><td className={employee.extraHours > 0 ? "staff-hours-extra" : ""}>{employee.extraHours > 0 ? "+" : ""}{hours.format(employee.extraHours)} h</td><td><span className={"status-pill " + (employee.extraHours > 0 ? "status-pill--over" : "")}>{employee.hoursLimit == null ? "No limit" : employee.extraHours > 0 ? `Above ${hours.format(employee.hoursLimit)} h` : `Within ${hours.format(employee.hoursLimit)} h`}</span></td></tr>)}</tbody></table></div>
        )}
      </div>
      <div className="source-note"><strong>Source:</strong> {monthData.source || "Authorized 2026 monthly salary worksheets"}.{monthData.asOf && ` Data through ${monthData.asOf}${monthData.partial ? " · Partial month" : ""}.`} Salary and tips are not used in this page.</div>
    </div>
  );
}
