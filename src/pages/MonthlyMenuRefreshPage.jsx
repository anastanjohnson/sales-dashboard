import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Flame, Info, LockKeyhole, RefreshCw, Save, Search, Utensils } from "lucide-react";
import { apiFetch } from "../api.js";
import "./MonthlyMenuRefreshPage.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DIETS = { vegetarian: "Vegetarian", vegan: "Vegan", "non-veg": "Non-veg", "not-specified": "Type not specified" };
const sortIds = (ids) => [...ids].sort().join("|");
const normalizedRows = (data) => Array.from({ length: data.targetCount }, (_, index) => ({
  currentItemId: data.rows?.[index]?.currentItemId || "",
  newFoodName: data.rows?.[index]?.newFoodName || "",
}));
const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
};
const monthTitle = (month) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));

async function request(path, options) {
  const response = await apiFetch(path, { credentials: "include", ...options });
  if (response.status === 401) { window.location.reload(); throw new Error("Please sign in again."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "The menu refresh could not be loaded. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function ChefGuidance({ item }) {
  if (!item) return <span className="menu-refresh__muted">Select a current food to see guidance.</span>;
  const price = Number(item.supplementEur) > 0
    ? `+${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(item.supplementEur)} supplement`
    : item.supplementEur === 0 ? "Included" : item.priceLabel || "Not specified";
  return <div className="menu-refresh__guidance">
    <small>Based on current dish</small>
    <div className="menu-refresh__guidance-line">
      <span className={`menu-refresh__diet menu-refresh__diet--${item.diet}`}>{DIETS[item.diet] || "Type not specified"}</span>
      <span className="menu-refresh__spice"><Flame size={14} aria-hidden="true" />Spice: {item.spiceLevel == null ? "Not specified" : `${item.spiceLevel}/5`}</span>
    </div>
    <span>AYCE: {price}</span>
    {item.hasVariants && <small>Menu item has variants.</small>}
  </div>;
}

export default function MonthlyMenuRefreshPage() {
  const [month, setMonth] = useState(currentMonth);
  const windowStart = currentMonth();
  const planningMonths = useMemo(() => {
    const [year, firstMonth] = windowStart.split("-").map(Number);
    return Array.from({ length: 12 }, (_, offset) => {
      const date = new Date(Date.UTC(year, firstMonth - 1 + offset, 1, 12));
      return { value: date.toISOString().slice(0, 7), label: MONTHS[date.getUTCMonth()], year: date.getUTCFullYear() };
    });
  }, [windowStart]);
  const [snapshot, setSnapshot] = useState(null);
  const [rows, setRows] = useState([]);
  const [target, setTarget] = useState("0");
  const [allowed, setAllowed] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [poolOpen, setPoolOpen] = useState(false);
  const activeMonth = useRef(month);
  activeMonth.current = month;
  const requestNumber = useRef(0);
  const dirty = useRef(false);
  const busy = useRef(false);
  const rowDirty = Boolean(snapshot && JSON.stringify(rows) !== JSON.stringify(normalizedRows(snapshot)));
  const configDirty = Boolean(snapshot?.canConfigure && (String(snapshot.targetCount) !== target || sortIds(snapshot.allowedItemIds || []) !== sortIds(allowed)));
  dirty.current = rowDirty || configDirty;
  busy.current = Boolean(saving);

  useEffect(() => {
    if (month < windowStart && !dirty.current && !busy.current) setMonth(windowStart);
  }, [month, windowStart, rowDirty, configDirty, saving]);

  const accept = useCallback((data, { keepConfiguration = false } = {}) => {
    setSnapshot(data);
    setRows(normalizedRows(data));
    if (!keepConfiguration) { setTarget(String(data.targetCount)); setAllowed(data.allowedItemIds || []); }
  }, []);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet && (dirty.current || busy.current)) return;
    const id = ++requestNumber.current;
    if (!quiet) { setLoading(true); setError(null); }
    try {
      const data = await request(`/api/menu-refresh?month=${encodeURIComponent(month)}`);
      if (id !== requestNumber.current || activeMonth.current !== month || (quiet && (dirty.current || busy.current))) return;
      accept(data);
      setError(null);
    } catch (failure) {
      if (id === requestNumber.current && activeMonth.current === month && !(quiet && dirty.current)) setError(failure);
    } finally {
      if (id === requestNumber.current && activeMonth.current === month) setLoading(false);
    }
  }, [month, accept]);

  useEffect(() => {
    setSnapshot(null); setRows([]); setNotice(""); setSearch(""); setPoolOpen(false);
    load();
    return () => { requestNumber.current += 1; };
  }, [load]);

  useEffect(() => {
    const refresh = () => load({ quiet: true });
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  useEffect(() => {
    const warn = (event) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const changeMonth = (value) => {
    if (value === month || value < windowStart || saving) return;
    if (dirty.current && !window.confirm("Leave this month and discard your unsaved changes?")) return;
    dirty.current = false; setMonth(value);
  };

  const save = async (kind) => {
    if (!snapshot || saving || error?.status === 409) return;
    setSaving(kind); setError(null); setNotice("");
    requestNumber.current += 1;
    try {
      const body = kind === "config"
        ? { month, targetCount: Number(target), allowedItemIds: allowed, version: snapshot.version }
        : { month, rows: rows.map((row) => ({ ...row, currentItemId: row.currentItemId || null })), version: snapshot.version };
      const data = await request(`/api/menu-refresh/${kind === "config" ? "config" : "rows"}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (activeMonth.current !== month) return;
      accept(data, { keepConfiguration: kind === "rows" && configDirty });
      setNotice(kind === "config" ? "Monthly target and chef options saved." : "Food changes saved.");
    } catch (failure) { setError(failure); }
    finally { setSaving(""); }
  };

  const catalog = snapshot?.catalog || [];
  const itemById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const configuredAllowed = new Set(snapshot?.allowedItemIds || []);
  const chefItems = catalog.filter((item) => configuredAllowed.has(item.id));
  const selectedIds = new Set(rows.map((row) => row.currentItemId).filter(Boolean));
  const completed = rows.filter((row) => row.currentItemId && row.newFoodName.trim()).length;
  const numericTarget = Number(target);
  const validTarget = target !== "" && Number.isInteger(numericTarget) && numericTarget >= 0 && numericTarget <= allowed.length;
  const available = chefItems.length;
  const remaining = chefItems.filter((item) => !selectedIds.has(item.id)).length;
  const filteredCatalog = catalog.filter((item) => `${item.name} ${item.category} ${item.subcategory}`.toLowerCase().includes(search.trim().toLowerCase()));
  const checked = new Set(allowed);
  const canConfigure = snapshot?.canConfigure === true;
  const blocked = Boolean(saving) || error?.status === 409;

  const updateRow = (index, patch) => { setNotice(""); setRows((previous) => previous.map((row, i) => i === index ? { ...row, ...patch } : row)); };
  const toggleAllowed = (id) => { setNotice(""); setAllowed((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]); };
  const reloadSaved = () => {
    if (dirty.current && !window.confirm("Reload the saved month and discard your unsaved changes?")) return;
    dirty.current = false; setNotice(""); load();
  };

  return <div className="dashboard menu-refresh">
    <header className="dashboard__header menu-refresh__header">
      <div><h1>Monthly Menu Refresh</h1><p className="dashboard__subtitle">Plan the monthly AYCE menu rotation.</p></div>
      <div className="menu-refresh__header-actions">
        <span className="menu-refresh__period">Current and upcoming months</span>
        <button className="btn btn--ghost" onClick={reloadSaved} disabled={loading || Boolean(saving)} aria-label="Reload saved menu refresh"><RefreshCw size={15} />Refresh</button>
      </div>
    </header>

    <nav className="menu-refresh__months" aria-label="Current and upcoming menu refresh months">{planningMonths.map(({ value, label, year }) => (
      <button type="button" key={value} aria-label={`${label} ${year}`} aria-pressed={value === month} className={value === month ? "is-active" : ""} onClick={() => changeMonth(value)} disabled={Boolean(saving)}><span>{label}</span><small>{year}</small></button>
    ))}</nav>

    {error && <div className="menu-refresh__alert" role="alert"><AlertTriangle size={18} /><div>{error.status === 409 ? "This month was updated in another login. Reload the saved version before making more changes. Your unsaved entries are still visible." : error.message}</div><button type="button" onClick={reloadSaved} disabled={Boolean(saving)}>Reload saved version</button></div>}
    {notice && <div className="menu-refresh__notice" role="status"><Check size={17} />{notice}</div>}
    {loading ? <section className="menu-refresh__card menu-refresh__empty" role="status">Loading menu rotation…</section> : !snapshot ? <section className="menu-refresh__card menu-refresh__empty">Unable to load this month. Use Refresh to try again.</section> : <>
      <section className="menu-refresh__card menu-refresh__rotation">
        <div className="menu-refresh__rotation-top"><div><h2>Menu Rotation</h2><p>{monthTitle(month)}</p></div>
          {canConfigure ? <div className="menu-refresh__target-control">
            <label htmlFor="menu-refresh-target">Items to change</label>
            <input id="menu-refresh-target" type="number" min="0" max={allowed.length} step="1" value={target} onChange={(event) => { setTarget(event.target.value); setNotice(""); }} disabled={blocked} />
            <button type="button" className="btn menu-refresh__primary" onClick={() => save("config")} disabled={blocked || !validTarget || rowDirty || (!configDirty && snapshot.configured)}><Save size={16} />{saving === "config" ? "Saving…" : "Save configuration"}</button>
          </div> : <div className="menu-refresh__static-target"><span>Items to change</span><strong>{snapshot.targetCount}</strong><small><LockKeyhole size={13} />Set by Anastan</small></div>}
        </div>
        <div className="menu-refresh__metrics"><span><Utensils size={16} /><strong>{available}</strong> dishes available to the chef</span><span><strong>{selectedIds.size}</strong> selected</span><span><strong>{remaining}</strong> still available to select</span></div>
        <p className="menu-refresh__rotation-note"><LockKeyhole size={14} />{canConfigure ? "Choose the monthly target and the foods Admin can select. Save the configuration to share it with the chef." : "Anastan sets the monthly target and available dishes. Select the current foods and enter their replacements below."}</p>
        {canConfigure && <div className="menu-refresh__configuration">
          <button type="button" className="menu-refresh__pool-toggle" aria-expanded={poolOpen} aria-controls="menu-refresh-pool" onClick={() => setPoolOpen((value) => !value)}><span>Foods available in the chef’s dropdown <strong>{allowed.length}</strong></span><ChevronDown size={18} className={poolOpen ? "is-open" : ""} /></button>
          {poolOpen && <div id="menu-refresh-pool" className="menu-refresh__pool">
            <p>Select the AYCE dishes the chef is allowed to rotate for {monthTitle(month)}.</p>
            <div className="menu-refresh__pool-tools"><label className="menu-refresh__search"><Search size={16} /><input type="search" aria-label="Search AYCE foods" placeholder="Search food, category or subcategory" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <button type="button" className="btn btn--ghost" disabled={blocked} onClick={() => setAllowed((previous) => [...new Set([...previous, ...filteredCatalog.map((item) => item.id)])])}>Select shown</button>
              <button type="button" className="btn btn--ghost" disabled={blocked} onClick={() => { const visible = new Set(filteredCatalog.map((item) => item.id)); setAllowed((previous) => previous.filter((id) => !visible.has(id))); }}>Clear shown</button>
            </div>
            <div className="menu-refresh__food-pool">{filteredCatalog.map((item) => <label key={item.id} className={`menu-refresh__food-option ${checked.has(item.id) ? "is-checked" : ""}`}><input type="checkbox" checked={checked.has(item.id)} onChange={() => toggleAllowed(item.id)} disabled={blocked} /><span><strong>{item.name}</strong><small>{item.category} / {item.subcategory}</small></span><span className={`menu-refresh__diet menu-refresh__diet--${item.diet}`}>{DIETS[item.diet] || "Not specified"}</span></label>)}{filteredCatalog.length === 0 && <p className="menu-refresh__empty">No matching AYCE foods.</p>}</div>
            <p className="menu-refresh__muted">{allowed.length} of {catalog.length} AYCE foods enabled. Foods already selected in the active rows must stay enabled.</p>
          </div>}
          {!validTarget && <p className="menu-refresh__validation" role="status">Set a whole number from 0 to {allowed.length}. Enable at least as many foods as the target.</p>}
          {rowDirty && <p className="menu-refresh__muted">Save the food changes below before updating the configuration.</p>}
          {configDirty && <p className="menu-refresh__muted">Configuration changes have not yet been shared with Admin.</p>}
        </div>}
      </section>

      <section className="menu-refresh__card menu-refresh__changes">
        <div className="menu-refresh__section-heading"><h2>{monthTitle(month)} changes</h2><span>{completed} of {snapshot.targetCount} replacements entered</span></div>
        {snapshot.targetCount > 0 ? <div className="menu-refresh__table-scroll"><table className="menu-refresh__table"><thead><tr className="menu-refresh__group-head"><th colSpan="4">Current AYCE item</th><th colSpan="2">New menu item</th></tr><tr><th scope="col">#</th><th scope="col">Food name</th><th scope="col">Category</th><th scope="col">Subcategory</th><th scope="col">New food name</th><th scope="col">Chef guidance</th></tr></thead><tbody>{rows.map((row, index) => {
          const item = itemById.get(row.currentItemId);
          return <tr key={index}><td>{String(index + 1).padStart(2, "0")}</td><td><label className="sr-only" htmlFor={`menu-refresh-food-${index}`}>Current food for row {index + 1}</label><select id={`menu-refresh-food-${index}`} value={row.currentItemId} onChange={(event) => updateRow(index, { currentItemId: event.target.value, ...(event.target.value ? {} : { newFoodName: "" }) })} disabled={blocked}><option value="">Select current food</option>{chefItems.filter((candidate) => candidate.id === row.currentItemId || !selectedIds.has(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.subcategory}</option>)}</select></td><td><span className="menu-refresh__autofill">{item?.category || "—"}</span></td><td><span className="menu-refresh__autofill">{item?.subcategory || "—"}</span></td><td><label className="sr-only" htmlFor={`menu-refresh-new-${index}`}>New food name for row {index + 1}</label><input id={`menu-refresh-new-${index}`} type="text" placeholder="Enter new food name" maxLength="160" value={row.newFoodName} onChange={(event) => updateRow(index, { newFoodName: event.target.value })} disabled={blocked || !row.currentItemId} /></td><td><ChefGuidance item={item} /></td></tr>;
        })}</tbody></table></div> : <div className="menu-refresh__empty"><Utensils size={28} /><strong>{snapshot.configured ? "No menu changes planned for this month." : "This month is waiting for Anastan’s configuration."}</strong><p>{canConfigure ? "Set the item count and enable the foods the chef can choose, then save the configuration." : "The chef’s rows will appear when Anastan saves the monthly target and available dishes."}</p></div>}
        <p className="menu-refresh__helper"><Info size={15} />Selecting a food fills its category, subcategory and chef guidance automatically.</p>
        <footer className="menu-refresh__save-bar"><span className={rowDirty ? "" : "menu-refresh__muted"}>{rowDirty ? "Unsaved food changes" : "All food changes saved"}</span><button type="button" className="btn menu-refresh__primary" onClick={() => save("rows")} disabled={blocked || !rowDirty || snapshot.targetCount === 0}><Save size={16} />{saving === "rows" ? "Saving…" : "Save changes"}</button></footer>
      </section>
      <p className="menu-refresh__source">AYCE food reference: <a href="https://karikaala.de/speisekarte/" target="_blank" rel="noreferrer">KARIKAALA website</a>. Dietary and spice guidance describes the current dish; missing ratings remain unspecified.</p>
    </>}
  </div>;
}
