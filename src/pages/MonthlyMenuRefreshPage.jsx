import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Circle, Clock3, Flame, Info, LockKeyhole, Pencil, RefreshCw, Save, Search, Utensils } from "lucide-react";
import { apiFetch } from "../api.js";
import { getSpecialMenu } from "../../supabase/functions/dashboard-api/menu-calendar.js";
import { formatBerlinDateTimeInput, getCountdownParts, parseBerlinDateTimeInput } from "../menuRefresh/dateTime.js";
import { getMenuRowStatus } from "../menuRefresh/rowStatus.js";
import "./MonthlyMenuRefreshPage.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DIETS = { vegetarian: "Vegetarian", vegan: "Vegan", "non-veg": "Non-veg", "not-specified": "Type not specified" };
const STATUS_ICONS = { done: CheckCircle2, "in-progress": Clock3, ready: Save, unsaved: Pencil, "not-started": Circle };
const STATUS_HELP = {
  done: "Saved replacement. You can edit the name and save again.",
  "in-progress": "Choose a current food and enter its replacement.",
  ready: "Replacement entered. Save changes to mark it Done.",
  unsaved: "This saved replacement has changes that have not been saved.",
  "not-started": "No food change started.",
};
const sortIds = (ids) => [...ids].sort().join("|");
const normalizedRows = (data) => Array.from({ length: data.targetCount }, (_, index) => ({
  currentItemId: data.rows?.[index]?.currentItemId || "",
  newFoodName: data.rows?.[index]?.newFoodName || "",
}));
const filtersFromData = (data) => {
  const items = new Map((data?.catalog || []).map((item) => [item.id, item]));
  return normalizedRows(data).map((row) => {
    const item = items.get(row.currentItemId);
    return { category: item?.category || "", subcategory: item?.subcategory || "" };
  });
};
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
  return <div className="menu-refresh__guidance">
    <small>Based on current dish</small>
    <div className="menu-refresh__guidance-line">
      <span className={`menu-refresh__diet menu-refresh__diet--${item.diet}`}>{DIETS[item.diet] || "Type not specified"}</span>
      <span className="menu-refresh__spice"><Flame size={14} aria-hidden="true" />Spice: {item.spiceLevel == null ? "Not specified" : `${item.spiceLevel}/5`}</span>
    </div>
    {item.hasVariants && <small>Menu item has variants.</small>}
  </div>;
}

function RowStatus({ status }) {
  const Icon = STATUS_ICONS[status.key] || Circle;
  return <span className={`menu-refresh__row-status menu-refresh__row-status--${status.key}`} title={STATUS_HELP[status.key]}><Icon size={13} aria-hidden="true" />{status.label}</span>;
}

function MenuAvailability({ availableAt, editor = null, dateDirty = false }) {
  const [now, setNow] = useState(Date.now);
  const valid = Boolean(availableAt && Number.isFinite(Date.parse(availableAt)));
  useEffect(() => {
    setNow(Date.now());
    if (!valid) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [availableAt, valid]);
  const countdown = valid ? getCountdownParts(availableAt, now) : null;
  const displayDate = valid ? new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
  }).format(new Date(availableAt)).replace(", ", " · ") : null;
  return <>
    <div className="menu-refresh__summary-date" title="Germany time (Europe/Berlin)">
      {editor || <><span className="menu-refresh__availability-label">Menu Available</span><strong className={valid ? "menu-refresh__availability-date" : "menu-refresh__availability-unset"}>{displayDate || "Not set"}</strong><small className="sr-only">Germany time (Europe/Berlin)</small></>}
    </div>
    <div className="menu-refresh__summary-clock">
      {!valid ? <div className="menu-refresh__countdown-empty"><strong>—</strong><span>Countdown</span></div> : countdown?.isAvailable ? <span className="menu-refresh__available-now"><Check size={17} aria-hidden="true" />Available now</span> : countdown && <div className="menu-refresh__countdown" role="timer" aria-live="off" aria-label="Time until the menu is available">
        {[["Days", countdown.days], ["Hours", countdown.hours], ["Minutes", countdown.minutes], ["Seconds", countdown.seconds]].map(([label, value], index) => <div className="menu-refresh__countdown-part" key={label}><strong>{String(value).padStart(2, "0")}</strong><small>{label}</small>{index < 3 && <span className="menu-refresh__countdown-separator" aria-hidden="true">:</span>}</div>)}
      </div>}
      {dateDirty && <small className="menu-refresh__countdown-note">Save date to update countdown.</small>}
    </div>
  </>;
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
  const [filters, setFilters] = useState([]);
  const [target, setTarget] = useState("0");
  const [availableInput, setAvailableInput] = useState("");
  const [allowed, setAllowed] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [poolOpen, setPoolOpen] = useState(false);
  const specialMenu = getSpecialMenu(month) || (snapshot?.month === month ? snapshot.specialMenu : null);
  const activeMonth = useRef(month);
  activeMonth.current = month;
  const requestNumber = useRef(0);
  const dirty = useRef(false);
  const busy = useRef(false);
  const rowDirty = Boolean(snapshot && JSON.stringify(rows) !== JSON.stringify(normalizedRows(snapshot)));
  const configDirty = Boolean(snapshot?.canConfigure && (String(snapshot.targetCount) !== target || sortIds(snapshot.allowedItemIds || []) !== sortIds(allowed) || formatBerlinDateTimeInput(snapshot.availableAt) !== availableInput));
  const filterDirty = Boolean(snapshot && JSON.stringify(filters) !== JSON.stringify(filtersFromData(snapshot)));
  dirty.current = rowDirty || configDirty || filterDirty;
  busy.current = Boolean(saving);

  useEffect(() => {
    if (month < windowStart && !dirty.current && !busy.current) setMonth(windowStart);
  }, [month, windowStart, rowDirty, configDirty, filterDirty, saving]);

  const accept = useCallback((data, { keepConfiguration = false, keepFilters = false } = {}) => {
    setSnapshot(data);
    setRows(normalizedRows(data));
    setFilters((previous) => {
      const next = filtersFromData(data);
      if (!keepFilters) return next;
      const enabledIds = new Set(data.allowedItemIds || []);
      const enabledItems = (data.catalog || []).filter((item) => enabledIds.has(item.id));
      return next.map((filter, index) => {
        if (filter.category || !previous[index]?.category) return filter;
        const categoryItems = enabledItems.filter((item) => item.category === previous[index].category);
        if (!categoryItems.length) return filter;
        return { category: previous[index].category, subcategory: categoryItems.some((item) => item.subcategory === previous[index].subcategory) ? previous[index].subcategory : "" };
      });
    });
    if (!keepConfiguration) { setTarget(String(data.targetCount)); setAllowed(data.allowedItemIds || []); setAvailableInput(formatBerlinDateTimeInput(data.availableAt)); }
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
    setSnapshot(null); setRows([]); setFilters([]); setAvailableInput(""); setNotice(""); setSearch(""); setPoolOpen(false);
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
    if (!snapshot || specialMenu || snapshot.rotationEnabled === false || saving || error?.status === 409) return;
    setSaving(kind); setError(null); setNotice("");
    requestNumber.current += 1;
    try {
      const body = kind === "config"
        ? { month, targetCount: Number(target), allowedItemIds: allowed, availableAt: availableInput === formatBerlinDateTimeInput(snapshot.availableAt) ? snapshot.availableAt || null : parseBerlinDateTimeInput(availableInput), version: snapshot.version }
        : { month, rows: rows.map((row) => ({ ...row, currentItemId: row.currentItemId || null })), version: snapshot.version };
      const data = await request(`/api/menu-refresh/${kind === "config" ? "config" : "rows"}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (activeMonth.current !== month) return;
      accept(data, { keepConfiguration: kind === "rows" && configDirty, keepFilters: true });
      setNotice(kind === "config" ? "Monthly configuration saved." : "Food changes saved.");
    } catch (failure) { setError(failure); }
    finally { setSaving(""); }
  };

  const catalog = snapshot?.catalog || [];
  const itemById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const configuredAllowed = new Set(snapshot?.allowedItemIds || []);
  const chefItems = catalog.filter((item) => configuredAllowed.has(item.id));
  const categories = [...new Set(chefItems.map((item) => item.category).filter(Boolean))];
  const selectedIds = new Set(rows.map((row) => row.currentItemId).filter(Boolean));
  const savedRows = snapshot ? normalizedRows(snapshot) : [];
  const rowStatuses = rows.map((row, index) => getMenuRowStatus(row, filters[index], savedRows[index]));
  const doneCount = rowStatuses.filter((status) => status.key === "done").length;
  const notStartedCount = rowStatuses.filter((status) => status.key === "not-started").length;
  const inProgressCount = rows.length - doneCount - notStartedCount;
  const numericTarget = Number(target);
  const validTarget = target !== "" && Number.isInteger(numericTarget) && numericTarget >= 0 && numericTarget <= allowed.length;
  const available = chefItems.length;
  const remaining = chefItems.filter((item) => !selectedIds.has(item.id)).length;
  const filteredCatalog = catalog.filter((item) => `${item.name} ${item.category} ${item.subcategory}`.toLowerCase().includes(search.trim().toLowerCase()));
  const checked = new Set(allowed);
  const canConfigure = !specialMenu && snapshot?.canConfigure === true;
  const blocked = Boolean(saving) || error?.status === 409;

  const updateRow = (index, patch) => { setNotice(""); setRows((previous) => previous.map((row, i) => i === index ? { ...row, ...patch } : row)); };
  const updateFilter = (index, field, value) => {
    setFilters((previous) => previous.map((filter, i) => i === index ? { category: field === "category" ? value : filter.category, subcategory: field === "category" ? "" : value } : filter));
    updateRow(index, { currentItemId: "", newFoodName: "" });
  };
  const toggleAllowed = (id) => { setNotice(""); setAllowed((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]); };
  const reloadSaved = () => {
    if (dirty.current && !window.confirm("Reload the saved month and discard your unsaved changes?")) return;
    dirty.current = false; setNotice(""); load();
  };

  return <div className="menu-refresh-layout"><div className={`dashboard menu-refresh${poolOpen ? " menu-refresh--config-open" : ""}`}>
    <header className="dashboard__header menu-refresh__header">
      <div><h1>Monthly Menu Refresh</h1><p className="dashboard__subtitle">Plan the monthly AYCE menu rotation.</p></div>
      <div className="menu-refresh__header-actions">
        <span className="menu-refresh__period">Current and upcoming months</span>
        <button className="btn btn--ghost" onClick={reloadSaved} disabled={loading || Boolean(saving)} aria-label="Reload saved menu refresh"><RefreshCw size={15} />Refresh</button>
      </div>
    </header>

    <nav className="menu-refresh__months" aria-label="Current and upcoming menu refresh months">{planningMonths.map(({ value, label, year }) => {
      const seasonal = getSpecialMenu(value);
      return <button type="button" key={value} aria-label={`${monthTitle(value)}${seasonal ? ` — ${seasonal.title}` : ""}`} title={seasonal?.title || monthTitle(value)} aria-pressed={value === month} className={value === month ? "is-active" : ""} onClick={() => changeMonth(value)} disabled={Boolean(saving)}>{label} {year}</button>;
    })}</nav>

    {error && <div className="menu-refresh__alert" role="alert"><AlertTriangle size={18} /><div>{error.status === 409 ? "This month was updated in another login. Reload the saved version before making more changes. Your unsaved entries are still visible." : error.message}</div><button type="button" onClick={reloadSaved} disabled={Boolean(saving)}>Reload saved version</button></div>}
    {notice && <div className="menu-refresh__notice" role="status"><Check size={17} />{notice}</div>}
    {specialMenu ? <section className="menu-refresh__card menu-refresh__special-card" aria-labelledby="menu-refresh-special-title">
      <div className="menu-refresh__special-icon"><Utensils size={26} aria-hidden="true" /></div>
      <div><span className="menu-refresh__special-kicker">Seasonal menu</span><h2 id="menu-refresh-special-title">{specialMenu.title}</h2><p className="menu-refresh__special-month">{monthTitle(month)}</p><p className="menu-refresh__special-note">Regular menu rotation is paused for this month.</p></div>
    </section> : loading ? <section className="menu-refresh__card menu-refresh__empty" role="status">Loading menu rotation…</section> : !snapshot ? <section className="menu-refresh__card menu-refresh__empty">Unable to load this month. Use Refresh to try again.</section> : <>
      <section className="menu-refresh__rotation" aria-label="Menu Rotation">
        <div className="menu-refresh__rotation-summary">
          <div className="menu-refresh__summary-main">
            <h2>{monthTitle(month)}</h2>
            {canConfigure ? <div className="menu-refresh__target-field"><input id="menu-refresh-target" type="number" min="0" max={allowed.length} step="1" value={target} onChange={(event) => { setTarget(event.target.value); setNotice(""); }} disabled={blocked} /><label htmlFor="menu-refresh-target">items to change</label></div> : <div className="menu-refresh__static-target"><strong>{snapshot.targetCount}</strong><span>items to change</span></div>}
          </div>
          <MenuAvailability availableAt={snapshot.availableAt} dateDirty={canConfigure && availableInput !== formatBerlinDateTimeInput(snapshot.availableAt)} editor={canConfigure ? <div className="menu-refresh__availability-control"><label htmlFor="menu-refresh-available">Menu Available</label><input id="menu-refresh-available" type="datetime-local" step="60" value={availableInput} onChange={(event) => { setAvailableInput(event.target.value); setNotice(""); }} disabled={blocked} aria-describedby="menu-refresh-availability-zone" /><small id="menu-refresh-availability-zone">Berlin time (Europe/Berlin)</small></div> : null} />
        </div>
        <div className="menu-refresh__summary-footer">
          <div className="menu-refresh__metrics"><span title="Dishes available to the chef"><strong>{available}</strong> available</span><span><strong>{selectedIds.size}</strong> selected</span><span title="Dishes still available to select"><strong>{remaining}</strong> remaining</span></div>
          <div className="menu-refresh__summary-footer-actions"><span className="menu-refresh__configured-by"><LockKeyhole size={14} aria-hidden="true" />Set by Anastan</span>{canConfigure && <button type="button" className="btn menu-refresh__primary" onClick={() => save("config")} disabled={blocked || !validTarget || rowDirty || (!configDirty && snapshot.configured)}><Save size={16} />{saving === "config" ? "Saving…" : "Save configuration"}</button>}</div>
        </div>
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
        <div className="menu-refresh__section-heading"><h2>{monthTitle(month)} changes</h2><div className="menu-refresh__status-summary" aria-label={`${doneCount} Done, ${inProgressCount} In progress, ${notStartedCount} Not started`}><span className="menu-refresh__summary-done"><CheckCircle2 size={14} aria-hidden="true" /><strong>{doneCount}</strong> Done</span><span className="menu-refresh__summary-progress"><Clock3 size={14} aria-hidden="true" /><strong>{inProgressCount}</strong> In progress</span><span><Circle size={13} aria-hidden="true" /><strong>{notStartedCount}</strong> Not started</span></div></div>
        {snapshot.targetCount > 0 ? <div className="menu-refresh__table-scroll"><table className="menu-refresh__table" role="table" aria-label={`${monthTitle(month)} food changes`}><colgroup><col className="menu-refresh__column--number" /><col className="menu-refresh__column--category" /><col className="menu-refresh__column--subcategory" /><col className="menu-refresh__column--food" /><col className="menu-refresh__column--new" /><col className="menu-refresh__column--guidance" /></colgroup><thead role="rowgroup"><tr className="menu-refresh__group-head" role="row"><th colSpan="4">Current AYCE item</th><th colSpan="2">New menu item</th></tr><tr role="row"><th scope="col">#</th><th scope="col">Category</th><th scope="col">Subcategory</th><th scope="col">Food name</th><th scope="col">New food name</th><th scope="col">Chef guidance</th></tr></thead><tbody role="rowgroup">{rows.map((row, index) => {
          const item = itemById.get(row.currentItemId);
          const status = rowStatuses[index];
          const filter = filters[index] || { category: item?.category || "", subcategory: item?.subcategory || "" };
          const categoryItems = chefItems.filter((candidate) => candidate.category === filter.category);
          const subcategories = [...new Set(categoryItems.map((candidate) => candidate.subcategory).filter(Boolean))];
          const foodOptions = categoryItems.filter((candidate) => candidate.subcategory === filter.subcategory && (candidate.id === row.currentItemId || !selectedIds.has(candidate.id)));
          return <tr key={index} role="row" className={`${item ? "menu-refresh__row--selected" : ""}${status.key === "done" ? " menu-refresh__row--done" : ""}`}>
            <td role="cell" data-label="Change"><span className="menu-refresh__number-wrap">{String(index + 1).padStart(2, "0")}</span></td>
            <td role="cell" data-label="Category"><label className="sr-only" htmlFor={`menu-refresh-category-${index}`}>Category for row {index + 1}</label><select id={`menu-refresh-category-${index}`} value={filter.category} onChange={(event) => updateFilter(index, "category", event.target.value)} disabled={blocked}><option value="">Choose category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></td>
            <td role="cell" data-label="Subcategory"><label className="sr-only" htmlFor={`menu-refresh-subcategory-${index}`}>Subcategory for row {index + 1}</label><select id={`menu-refresh-subcategory-${index}`} value={filter.subcategory} onChange={(event) => updateFilter(index, "subcategory", event.target.value)} disabled={blocked || !filter.category}><option value="">{filter.category ? "Choose subcategory" : "Choose category first"}</option>{subcategories.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}</select></td>
            <td role="cell" data-label="Current food"><label className="sr-only" htmlFor={`menu-refresh-food-${index}`}>Current food for row {index + 1}</label><select id={`menu-refresh-food-${index}`} value={row.currentItemId} onChange={(event) => updateRow(index, { currentItemId: event.target.value, newFoodName: "" })} disabled={blocked || !filter.category || !filter.subcategory} aria-describedby={filter.category && filter.subcategory ? `menu-refresh-food-count-${index}` : undefined}><option value="">{!filter.category ? "Choose category first" : !filter.subcategory ? "Choose subcategory first" : "Select current food"}</option>{foodOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>{filter.category && filter.subcategory && <small id={`menu-refresh-food-count-${index}`} className="menu-refresh__food-count">{foodOptions.length} {foodOptions.length === 1 ? "food" : "foods"} available</small>}</td>
            <td role="cell" data-label="New food name"><label className="sr-only" htmlFor={`menu-refresh-new-${index}`}>New food name for row {index + 1}</label><input id={`menu-refresh-new-${index}`} type="text" placeholder="Enter new food name" maxLength="160" value={row.newFoodName} onChange={(event) => updateRow(index, { newFoodName: event.target.value })} disabled={blocked || !row.currentItemId} /><RowStatus status={status} /></td>
            <td role="cell" data-label="Chef guidance"><ChefGuidance item={item} /></td>
          </tr>;
        })}</tbody></table></div> : <div className="menu-refresh__empty"><Utensils size={28} /><strong>{snapshot.configured ? "No menu changes planned for this month." : "This month is waiting for Anastan’s configuration."}</strong><p>{canConfigure ? "Set the item count and enable the foods the chef can choose, then save the configuration." : "The chef’s rows will appear when Anastan saves the monthly target and available dishes."}</p></div>}
        <p className="menu-refresh__helper"><Info size={15} />Choose a category, then a subcategory, then the current food. Dietary and spice guidance fills automatically.</p>
        <footer className="menu-refresh__save-bar"><span className={rowDirty ? "" : "menu-refresh__muted"}>{rowDirty ? "Unsaved food changes" : filterDirty ? "Food selection in progress" : "All food changes saved"}</span><button type="button" className="btn menu-refresh__primary" onClick={() => save("rows")} disabled={blocked || !rowDirty || snapshot.targetCount === 0}><Save size={16} />{saving === "rows" ? "Saving…" : "Save changes"}</button></footer>
      </section>
      <p className="menu-refresh__source">AYCE food reference: <a href="https://karikaala.de/speisekarte/" target="_blank" rel="noreferrer">KARIKAALA website</a>. Dietary and spice guidance describes the current dish; missing ratings remain unspecified.</p>
    </>}
  </div></div>;
}
