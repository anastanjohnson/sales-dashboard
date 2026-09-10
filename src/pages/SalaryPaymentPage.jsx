import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Save, UserPlus, WalletCards } from "lucide-react";

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const keyFor = (row) => `${row.year}::${row.month}::${row.department}::${row.employeeName}`;

export default function SalaryPaymentPage() {
  const [salaryData, setSalaryData] = useState([]);
  const [payments, setPayments] = useState({});
  const [selectedMonth, setSelectedMonth] = useState("");
  const [department, setDepartment] = useState("All");
  const [pageStatus, setPageStatus] = useState("loading");
  const [rowStatus, setRowStatus] = useState({});
  const [entryEmployee, setEntryEmployee] = useState("");
  const [entrySalary, setEntrySalary] = useState("");
  const [entryTips, setEntryTips] = useState("");
  const [entryStatus, setEntryStatus] = useState("idle");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setPageStatus("loading");
    setError("");
    try {
      const [salaryResponse, paymentResponse] = await Promise.all([
        fetch("/api/salary-payment-source", { credentials: "include" }),
        fetch("/api/salary-payments", { credentials: "include" }),
      ]);
      if (salaryResponse.status === 401 || paymentResponse.status === 401) return window.location.reload();
      if (!salaryResponse.ok || !paymentResponse.ok) throw new Error("Unable to load salary payment data.");
      const [salary, paymentRows] = await Promise.all([salaryResponse.json(), paymentResponse.json()]);
      const periods = salary
        .filter((row) => Number(row.year) === 2026)
        .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
      const paymentMap = Object.fromEntries(paymentRows.map((row) => [keyFor(row), {
        paidAmount: row.paidAmount == null ? "" : String(row.paidAmount),
        paidDate: row.paidDate || "",
      }]));
      setSalaryData(periods);
      setPayments(paymentMap);
      setSelectedMonth((current) => current || periods.at(-1)?.month || "");
      setPageStatus("ready");
    } catch (loadError) {
      setError(loadError.message);
      setPageStatus("error");
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const periods = useMemo(() => [...salaryData].sort((a, b) =>
    Number(a.year) - Number(b.year) || monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
  ), [salaryData]);
  const selectedPeriod = periods.find((row) => row.month === selectedMonth);
  const staffOptions = useMemo(() => {
    const employees = new Map();
    [...salaryData].reverse().forEach((period) => (period.employees || []).forEach((employee) => {
      const key = `${employee.department}::${String(employee.name).trim().toLowerCase()}`;
      if (!employees.has(key)) employees.set(key, { name: employee.name, department: employee.department, key });
    }));
    return Array.from(employees.values()).sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
  }, [salaryData]);
  const selectedStaff = staffOptions.find((employee) => employee.key === entryEmployee);
  const rows = useMemo(() => (selectedPeriod?.employees || [])
    .filter((employee) => department === "All" || employee.department === department)
    .map((employee) => ({
      year: selectedPeriod.year,
      month: selectedPeriod.month,
      employeeName: employee.name,
      department: employee.department,
      salary: Number(employee.salary) || 0,
      tips: Number(employee.tips) || 0,
    }))
    .sort((a, b) => a.department.localeCompare(b.department) || a.employeeName.localeCompare(b.employeeName)),
  [selectedPeriod, department]);

  const totals = useMemo(() => rows.reduce((result, row) => ({
    salary: result.salary + row.salary,
    tips: result.tips + row.tips,
    total: result.total + row.salary + row.tips,
  }), { salary: 0, tips: 0, total: 0 }), [rows]);

  const updateField = (row, field, value) => {
    const key = keyFor(row);
    setPayments((current) => ({ ...current, [key]: { paidAmount: "", paidDate: "", ...current[key], [field]: value } }));
    setRowStatus((current) => ({ ...current, [key]: "dirty" }));
  };

  const saveRow = async (row) => {
    const key = keyFor(row);
    const values = payments[key] || { paidAmount: "", paidDate: "" };
    setRowStatus((current) => ({ ...current, [key]: "saving" }));
    setError("");
    try {
      const response = await fetch("/api/salary-payments", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...row, paidAmount: values.paidAmount, paidDate: values.paidDate }),
      });
      if (response.status === 401) return window.location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save the payment.");
      setPayments((current) => ({ ...current, [key]: {
        paidAmount: result.paidAmount == null ? "" : String(result.paidAmount),
        paidDate: result.paidDate || "",
      } }));
      setRowStatus((current) => ({ ...current, [key]: "saved" }));
    } catch (saveError) {
      setError(saveError.message);
      setRowStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const selectEntryEmployee = (value) => {
    setEntryEmployee(value);
    setEntryStatus("idle");
    const employee = staffOptions.find((item) => item.key === value);
    const existing = (selectedPeriod?.employees || []).find((item) =>
      item.department === employee?.department && String(item.name).trim().toLowerCase() === String(employee?.name || "").trim().toLowerCase()
    );
    setEntrySalary(existing?.salary == null ? "" : String(existing.salary));
    setEntryTips(existing?.tips == null ? "" : String(existing.tips));
  };

  const saveSalaryEntry = async (event) => {
    event.preventDefault();
    if (!selectedStaff) return setError("Select a staff member.");
    setEntryStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/salary-entry", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2026, month: selectedMonth, employeeName: selectedStaff.name, department: selectedStaff.department, salary: entrySalary, tips: entryTips }),
      });
      if (response.status === 401) return window.location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save the salary entry.");
      setEntryStatus("saved");
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
      setEntryStatus("error");
    }
  };

  if (pageStatus === "loading") return <div className="dashboard"><div className="panel"><div className="panel__head"><h3>Loading salary payments…</h3></div></div></div>;
  if (pageStatus === "error") return <div className="dashboard"><div className="panel"><div className="panel__head"><div><h3>Salary payments could not be loaded.</h3><p>{error}</p></div><button className="btn btn--ghost" onClick={loadData}>Try again</button></div></div></div>;

  return (
    <div className="dashboard salary-payment-page">
      <div className="dashboard__header">
        <div><h1>Salary Payment</h1><p className="dashboard__subtitle">Enter and save the paid amount and payment date for each employee.</p></div>
        <button className="btn btn--ghost" onClick={loadData}><RefreshCw size={15} />Refresh</button>
      </div>

      <div className="salary-month-picker" role="group" aria-label="Select salary payment month">
        {periods.map((period) => <button type="button" key={`${period.year}-${period.month}`} className={`salary-month-button ${selectedMonth === period.month ? "salary-month-button--active" : ""}`} aria-pressed={selectedMonth === period.month} onClick={() => setSelectedMonth(period.month)}>{period.month.slice(0, 3)}</button>)}
      </div>

      <form className="panel salary-entry-panel" onSubmit={saveSalaryEntry}>
        <div className="salary-entry-panel__head"><div><h3><UserPlus size={17} /> Enter {selectedMonth} Salary</h3><p>Select a staff member, then enter the salary and tips. Saving updates this page and the main Salary page.</p></div></div>
        <div className="salary-entry-grid">
          <label><span>Name</span><select value={entryEmployee} onChange={(event) => selectEntryEmployee(event.target.value)} required><option value="">Select staff member</option>{staffOptions.map((employee) => <option key={employee.key} value={employee.key}>{employee.name} · {employee.department}</option>)}</select></label>
          <label><span>Department</span><input value={selectedStaff?.department || ""} placeholder="Selected automatically" readOnly /></label>
          <label><span>Salary</span><div className="salary-entry-money"><span>€</span><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={entrySalary} onChange={(event) => { setEntrySalary(event.target.value); setEntryStatus("idle"); }} required /></div></label>
          <label><span>Tips</span><div className="salary-entry-money"><span>€</span><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={entryTips} onChange={(event) => { setEntryTips(event.target.value); setEntryStatus("idle"); }} required /></div></label>
          <button className={`salary-payment-save salary-entry-save ${entryStatus === "saved" ? "salary-payment-save--saved" : ""}`} type="submit" disabled={entryStatus === "saving"}>{entryStatus === "saved" ? <><Check size={15} />Saved</> : <><Save size={15} />{entryStatus === "saving" ? "Saving…" : "Save salary"}</>}</button>
        </div>
      </form>

      <div className="stat-grid salary-payment-summary">
        <div className="stat-card"><div className="stat-card__label">Revenue</div><div className="stat-card__value">{currency.format(Number(selectedPeriod?.revenue) || 0)}</div><div className="sales-kpi-note">{selectedMonth} 2026</div></div>
        <div className="stat-card"><div className="stat-card__label">Tips</div><div className="stat-card__value">{currency.format(Number(selectedPeriod?.totalTips) || totals.tips)}</div><div className="sales-kpi-note">Monthly restaurant tips</div></div>
        <div className="stat-card"><div className="stat-card__label">Salary in Cash</div><div className="stat-card__value">{currency.format(totals.salary)}</div><div className="sales-kpi-note">Selected employees</div></div>
        <div className="stat-card"><div className="stat-card__label">Payable Total</div><div className="stat-card__value">{currency.format(totals.total)}</div><div className="sales-kpi-note">Cash salary + allocated tips</div></div>
      </div>

      <div className="panel salary-payment-panel">
        <div className="salary-panel__head">
          <div><h3><WalletCards size={17} /> Saily Food Service GmbH · Salary {selectedMonth} 2026</h3><p>Salary in Cash · Paid Amount and Paid Date are stored in the protected backend database.</p></div>
          <div className="metric-switch salary-department-switch" role="group" aria-label="Filter salary payments by department">
            {["All", "Kitchen", "Service"].map((option) => <button type="button" key={option} className={department === option ? "active" : ""} onClick={() => setDepartment(option)}>{option}</button>)}
          </div>
        </div>
        {error && <div className="salary-payment-error" role="alert">{error}</div>}
        <div className="table-wrap">
          <table className="salary-payment-table">
            <thead><tr><th>Name</th><th>Salary</th><th>Tips</th><th>Total</th><th>Paid Amount</th><th>Paid Date</th><th><span className="sr-only">Save</span></th></tr></thead>
            <tbody>{rows.map((row) => {
              const key = keyFor(row);
              const values = payments[key] || { paidAmount: "", paidDate: "" };
              const status = rowStatus[key];
              return <tr key={key}>
                <td className="salary-payment-table__employee"><span>{row.employeeName}</span><small>{row.department}</small></td><td>{currency.format(row.salary)}</td><td>{currency.format(row.tips)}</td><td className="salary-payment-table__total">{currency.format(row.salary + row.tips)}</td>
                <td><div className="salary-payment-amount"><span>€</span><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" aria-label={`Paid Amount for ${row.employeeName}`} value={values.paidAmount} onChange={(event) => updateField(row, "paidAmount", event.target.value)} /></div></td>
                <td><input className="salary-payment-date" type="date" aria-label={`Paid Date for ${row.employeeName}`} value={values.paidDate} onChange={(event) => updateField(row, "paidDate", event.target.value)} /></td>
                <td><button type="button" className={`salary-payment-save ${status === "saved" ? "salary-payment-save--saved" : ""}`} onClick={() => saveRow(row)} disabled={status === "saving" || status === "saved"} aria-label={`Save payment for ${row.employeeName}`}>{status === "saved" ? <><Check size={15} />Saved</> : <><Save size={15} />{status === "saving" ? "Saving…" : "Save"}</>}</button></td>
              </tr>;
            })}</tbody>
            <tfoot><tr><td colSpan="3">Total</td><td>{currency.format(totals.total)}</td><td colSpan="3" /></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
