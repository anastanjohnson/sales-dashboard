import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, RefreshCw, Save, Trash2, UserPlus, WalletCards } from "lucide-react";

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const keyFor = (row) => `${row.year}::${row.month}::${row.department}::${row.employeeName}`;

export default function SalaryPaymentPage({ canEnterSalary = false }) {
  const [salaryData, setSalaryData] = useState([]);
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [payments, setPayments] = useState({});
  const [selectedMonth, setSelectedMonth] = useState("");
  const [newMonth, setNewMonth] = useState("");
  const [openingMonth, setOpeningMonth] = useState(false);
  const [department, setDepartment] = useState("All");
  const [pageStatus, setPageStatus] = useState("loading");
  const [rowStatus, setRowStatus] = useState({});
  const [entryEmployee, setEntryEmployee] = useState("");
  const [entrySalary, setEntrySalary] = useState("");
  const [entryTips, setEntryTips] = useState("");
  const [entryStatus, setEntryStatus] = useState("idle");
  const [salaryEdit, setSalaryEdit] = useState(null);
  const [salaryEditMessage, setSalaryEditMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setPageStatus("loading");
    setError("");
    try {
      const [salaryResponse, paymentResponse, staffResponse] = await Promise.all([
        fetch("/api/salary-payment-source", { credentials: "include" }),
        fetch("/api/salary-payments", { credentials: "include" }),
        canEnterSalary ? fetch("/api/salary-payment-staff", { credentials: "include" }) : Promise.resolve(null),
      ]);
      const responses = [salaryResponse, paymentResponse, staffResponse].filter(Boolean);
      if (responses.some((response) => response.status === 401)) return window.location.reload();
      if (responses.some((response) => !response.ok)) throw new Error("Unable to load salary payment data.");
      const [salary, paymentRows, staff] = await Promise.all([
        salaryResponse.json(),
        paymentResponse.json(),
        staffResponse ? staffResponse.json() : Promise.resolve([]),
      ]);
      const periods = salary
        .filter((row) => Number(row.year) === 2026)
        .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
      const paymentMap = Object.fromEntries(paymentRows.map((row) => [keyFor(row), {
        paidAmount: row.paidAmount == null ? "" : String(row.paidAmount),
        paidDate: row.paidDate || "",
        locked: Boolean(row.locked || (row.paidAmount != null && row.paidDate)),
      }]));
      setSalaryData(periods);
      setStaffDirectory(Array.isArray(staff) ? staff : []);
      setPayments(paymentMap);
      setSelectedMonth((current) => periods.some((period) => period.month === current) ? current : periods.at(-1)?.month || "");
      setPageStatus("ready");
    } catch (loadError) {
      setError(loadError.message);
      setPageStatus("error");
    }
  }, [canEnterSalary]);

  useEffect(() => { loadData(); }, [loadData]);

  const periods = useMemo(() => [...salaryData].sort((a, b) =>
    Number(a.year) - Number(b.year) || monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
  ), [salaryData]);
  const selectedPeriod = periods.find((row) => row.month === selectedMonth);
  const unopenedMonths = monthOrder.filter((month) => !periods.some((period) => period.month === month));
  const openMonth = async (event) => {
    event.preventDefault();
    if (!canEnterSalary || !newMonth || openingMonth || salaryEdit) return;
    setOpeningMonth(true);
    setError("");
    try {
      const response = await fetch("/api/salary-months", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2026, month: newMonth }),
      });
      if (response.status === 401) return window.location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to open month.");
      await loadData();
      setSelectedMonth(result.month);
      setNewMonth("");
      setEntryEmployee("");
      setEntrySalary("");
      setEntryTips("");
      setEntryStatus("idle");
      setDepartment("All");
    } catch (error) { setError(error.message); }
    finally { setOpeningMonth(false); }
  };
  const staffOptions = useMemo(() => staffDirectory.map((employee) => ({
    ...employee,
    key: `${employee.department}::${String(employee.name).trim().toLowerCase()}`,
  })), [staffDirectory]);
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
    setPayments((current) => ({ ...current, [key]: { paidAmount: "", paidDate: "", ...current[key], [field]: value, locked: false } }));
    setRowStatus((current) => ({ ...current, [key]: "dirty" }));
  };

  const startSalaryEdit = (row) => {
    if (!canEnterSalary || salaryEdit || entryStatus === "saving" || openingMonth || Object.values(rowStatus).includes("deleting")) return;
    setSalaryEdit({ key: keyFor(row), salary: String(row.salary), tips: String(row.tips), saving: false });
    setSalaryEditMessage("");
    setError("");
  };

  const saveSalaryEdit = async (event, row) => {
    event.preventDefault();
    if (!canEnterSalary || salaryEdit?.key !== keyFor(row) || salaryEdit.saving) return;
    const { salary, tips } = salaryEdit;
    if ([salary, tips].some((value) => value.trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1000000)) {
      setError("Salary and Tips must be valid non-negative amounts.");
      return;
    }
    setSalaryEdit((current) => ({ ...current, saving: true }));
    setError("");
    try {
      const response = await fetch("/api/salary-entry", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: row.year, month: row.month, employeeName: row.employeeName, department: row.department, salary, tips }),
      });
      if (response.status === 401) return window.location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save the salary changes.");
      setSalaryData((current) => current.map((period) =>
        Number(period.year) === Number(row.year) && period.month === row.month
          ? { ...period, employees: period.employees.map((employee) =>
            employee.name === row.employeeName && employee.department === row.department
              ? { ...employee, salary: result.salary, tips: result.tips }
              : employee) }
          : period));
      if (entryEmployee === `${row.department}::${row.employeeName.trim().toLowerCase()}`) {
        setEntrySalary(String(result.salary));
        setEntryTips(String(result.tips));
        setEntryStatus("saved");
      }
      setSalaryEdit(null);
      setSalaryEditMessage("Salary and tips saved.");
    } catch (saveError) {
      setError(saveError.message);
      setSalaryEdit((current) => current ? { ...current, saving: false } : null);
    }
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
        locked: Boolean(result.locked || (result.paidAmount != null && result.paidDate)),
      } }));
      setRowStatus((current) => ({ ...current, [key]: "saved" }));
    } catch (saveError) {
      setError(saveError.message);
      setRowStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`Delete the salary and tips entry for ${row.employeeName} in ${row.month} ${row.year}?`)) return;
    const key = keyFor(row);
    setRowStatus((current) => ({ ...current, [key]: "deleting" }));
    setError("");
    try {
      const response = await fetch("/api/salary-entry", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (response.status === 401) return window.location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete the salary entry.");
      if (entryEmployee === `${row.department}::${row.employeeName.trim().toLowerCase()}`) {
        setEntrySalary("");
        setEntryTips("");
        setEntryStatus("idle");
      }
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
      setRowStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setRowStatus((current) => {
        if (current[key] !== "deleting") return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
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
    if (!canEnterSalary || salaryEdit || entryStatus === "saving") return;
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
        <button className="btn btn--ghost" onClick={loadData} disabled={Boolean(salaryEdit)}><RefreshCw size={15} />Refresh</button>
      </div>

      <div className="salary-month-picker" role="group" aria-label="Select salary payment month">
        {periods.map((period) => <button type="button" key={`${period.year}-${period.month}`} className={`salary-month-button ${selectedMonth === period.month ? "salary-month-button--active" : ""}`} aria-pressed={selectedMonth === period.month} onClick={() => setSelectedMonth(period.month)} disabled={Boolean(salaryEdit)}>{period.month.slice(0, 3)}</button>)}
      </div>

      {canEnterSalary && unopenedMonths.length > 0 && <form className="panel salary-entry-panel" onSubmit={openMonth}>
        <div className="salary-entry-panel__head"><h3>Open new salary month · 2026</h3></div>
        <div className="salary-entry-grid">
          <label><span>Month</span><select value={newMonth} onChange={(event) => setNewMonth(event.target.value)} required disabled={openingMonth}><option value="">Select month</option>{unopenedMonths.map((month) => <option key={month} value={month}>{month}</option>)}</select></label>
          <button className="salary-payment-save salary-entry-save" type="submit" disabled={!newMonth || openingMonth || Boolean(salaryEdit)}>{openingMonth ? "Opening…" : "Open month"}</button>
        </div>
      </form>}

      {canEnterSalary && <form className="panel salary-entry-panel" onSubmit={saveSalaryEntry}>
        <div className="salary-entry-panel__head"><div><h3><UserPlus size={17} /> Enter {selectedMonth} Salary</h3><p>Select a staff member, then enter the salary and tips. Saving updates this page and the main Salary page.</p></div></div>
        <div className="salary-entry-grid">
          <label><span>Name</span><select value={entryEmployee} onChange={(event) => selectEntryEmployee(event.target.value)} required><option value="">Select staff member</option>{staffOptions.map((employee) => <option key={employee.key} value={employee.key}>{employee.name} · {employee.department}</option>)}</select></label>
          <label><span>Department</span><input value={selectedStaff?.department || ""} placeholder="Selected automatically" readOnly /></label>
          <label><span>Salary</span><div className="salary-entry-money"><span>€</span><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={entrySalary} onChange={(event) => { setEntrySalary(event.target.value); setEntryStatus("idle"); }} required /></div></label>
          <label><span>Tips</span><div className="salary-entry-money"><span>€</span><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={entryTips} onChange={(event) => { setEntryTips(event.target.value); setEntryStatus("idle"); }} required /></div></label>
          <button className={`salary-payment-save salary-entry-save ${entryStatus === "saved" ? "salary-payment-save--saved" : ""}`} type="submit" disabled={entryStatus === "saving" || Boolean(salaryEdit)}>{entryStatus === "saved" ? <><Check size={15} />Saved</> : <><Save size={15} />{entryStatus === "saving" ? "Saving…" : "Save salary"}</>}</button>
        </div>
      </form>}

      <div className="stat-grid salary-payment-summary">
        <div className="stat-card"><div className="stat-card__label">Revenue</div><div className="stat-card__value">{currency.format(Number(selectedPeriod?.revenue) || 0)}</div><div className="sales-kpi-note">{selectedMonth} 2026</div></div>
        <div className="stat-card"><div className="stat-card__label">Tips</div><div className="stat-card__value">{currency.format(Number(selectedPeriod?.totalTips) || totals.tips)}</div><div className="sales-kpi-note">Monthly restaurant tips</div></div>
        <div className="stat-card"><div className="stat-card__label">Salary in Cash</div><div className="stat-card__value">{currency.format(totals.salary)}</div><div className="sales-kpi-note">Selected employees</div></div>
        <div className="stat-card"><div className="stat-card__label">Payable Total</div><div className="stat-card__value">{currency.format(totals.total)}</div><div className="sales-kpi-note">Cash salary + allocated tips</div></div>
      </div>

      <div className="panel salary-payment-panel">
        <div className="salary-panel__head">
          <div><h3><WalletCards size={17} /> Saily Food Service GmbH · Salary {selectedMonth} 2026</h3><p>{canEnterSalary ? "Use Edit to change salary and tips, then Save salary to update the total." : "Salary in Cash · Enter the paid amount and payment date for each employee."}</p></div>
          <div className="metric-switch salary-department-switch" role="group" aria-label="Filter salary payments by department">
            {["All", "Kitchen", "Service"].map((option) => <button type="button" key={option} className={department === option ? "active" : ""} onClick={() => setDepartment(option)} disabled={Boolean(salaryEdit)}>{option}</button>)}
          </div>
        </div>
        {error && <div className="salary-payment-error" role="alert">{error}</div>}
        {salaryEditMessage && <div className="salary-payment-notice" role="status">{salaryEditMessage}</div>}
        <div className="table-wrap">
          <table className="salary-payment-table">
            <thead><tr><th>Name</th><th>Salary</th><th>Tips</th><th className="salary-payment-table__total">Total</th><th>Paid Amount</th><th>Paid Date</th><th>Actions</th></tr></thead>
            <tbody>{rows.map((row) => {
              const key = keyFor(row);
              const values = payments[key] || { paidAmount: "", paidDate: "" };
              const status = rowStatus[key];
              const locked = Boolean(values.locked || status === "saved");
              const complete = values.paidAmount !== "" && Boolean(values.paidDate);
              const busy = status === "saving" || status === "deleting";
              const editing = canEnterSalary && salaryEdit?.key === key;
              const editFormId = `salary-edit-${encodeURIComponent(key)}`;
              return <tr key={key}>
                <td className="salary-payment-table__employee"><span>{row.employeeName}</span><small>{row.department}</small></td>
                {["salary", "tips"].map((field) => <td key={field}>{editing
                  ? <div className="salary-payment-amount salary-payment-edit-amount"><span>€</span><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" form={editFormId} aria-label={`${field === "salary" ? "Salary" : "Tips"} for ${row.employeeName}`} value={salaryEdit[field]} onChange={(event) => setSalaryEdit((current) => ({ ...current, [field]: event.target.value }))} disabled={salaryEdit.saving} autoFocus={field === "salary"} required /></div>
                  : currency.format(row[field])}</td>)}
                <td className="salary-payment-table__total">{currency.format(row.salary + row.tips)}</td>
                <td><div className={`salary-payment-amount ${locked ? "salary-payment-field--locked" : ""}`}><span>€</span><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" aria-label={`Paid Amount for ${row.employeeName}`} value={values.paidAmount} onChange={(event) => updateField(row, "paidAmount", event.target.value)} disabled={locked || busy || editing} required /></div></td>
                <td><input className={`salary-payment-date ${locked ? "salary-payment-field--locked" : ""}`} type="date" aria-label={`Paid Date for ${row.employeeName}`} value={values.paidDate} onChange={(event) => updateField(row, "paidDate", event.target.value)} disabled={locked || busy || editing} required /></td>
                <td>{editing ? <form id={editFormId} className="salary-payment-actions" onSubmit={(event) => saveSalaryEdit(event, row)}>
                  <button type="submit" className="salary-payment-save" disabled={salaryEdit.saving}><Save size={15} />{salaryEdit.saving ? "Saving…" : "Save salary"}</button>
                  <button type="button" className="salary-payment-edit" onClick={() => { setSalaryEdit(null); setError(""); }} disabled={salaryEdit.saving}>Cancel</button>
                </form> : <div className="salary-payment-actions"><button type="button" className={`salary-payment-save ${locked ? "salary-payment-save--saved" : ""}`} onClick={() => saveRow(row)} disabled={busy || locked || !complete} aria-label={`Save payment for ${row.employeeName}`}>{locked ? <><Check size={15} />Saved</> : <><Save size={15} />{status === "saving" ? "Saving…" : "Save"}</>}</button>{canEnterSalary && <>
                  <button type="button" className="salary-payment-edit" onClick={() => startSalaryEdit(row)} disabled={busy || Boolean(salaryEdit) || entryStatus === "saving" || openingMonth || Object.values(rowStatus).includes("deleting")} aria-label={`Edit salary and tips for ${row.employeeName}`}><Pencil size={15} />Edit</button>
                  <button type="button" className="salary-payment-delete" onClick={() => deleteRow(row)} disabled={busy || Boolean(salaryEdit)} aria-label={`Delete salary entry for ${row.employeeName}`}><Trash2 size={15} />{status === "deleting" ? "Deleting…" : "Delete"}</button>
                </>}</div>}</td>
              </tr>;
            })}</tbody>
            <tfoot><tr><td colSpan="3">Total</td><td className="salary-payment-table__total">{currency.format(totals.total)}</td><td colSpan="3" /></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
