import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Users, CalendarDays, Clock3, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { apiFetch } from '../api.js';
import { MONTH_PERIODS, DAY_TYPES, TIME_SLOTS, guestSummary, distribution } from '../loyalty/model.js';
import './LoyaltyGuestTrackingPage.css';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDate = date => date ? dateFormat.format(new Date(`${date}T12:00:00Z`)) : '—';
const stamp = visit => visit ? `${formatDate(visit.date)} · ${visit.time || 'Time unknown'}` : 'No recorded scan';
const number = new Intl.NumberFormat('en-GB');
function Pattern({ title, values, total }) {
  return <section className="loyalty-pattern"><h2>{title}</h2>{values.map(({label,count}) => <div className="loyalty-bar" key={label}>
    <div><span>{label}</span><strong>{count} <small>({total ? Math.round(count / total * 100) : 0}%)</small></strong></div>
    <progress max={Math.max(total,1)} value={count} aria-label={label} />
  </div>)}</section>;
}
export default function LoyaltyGuestTrackingPage() {
  const [data, setData] = useState(null), [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [query,setQuery] = useState(''), [month,setMonth] = useState(''), [period,setPeriod] = useState(''), [dayType,setDayType] = useState(''), [slot,setSlot] = useState('');
  const [history,setHistory] = useState('all'), [expanded,setExpanded] = useState(null), [page,setPage] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch('/api/loyalty-tracking', { credentials:'include' });
      if (response.status === 404) { setData({ guests: [], connectionPending: true }); return; }
      if (!response.ok) throw new Error(response.status === 401 ? 'Please sign in again to view loyalty guests.' : 'Loyalty records could not be loaded. Please try again.');
      const result = await response.json();
      if (!Array.isArray(result.guests)) throw new Error('The loyalty data format could not be read.');
      setData(result);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { load(); },[load]);
  useEffect(() => { setPage(0); setExpanded(null); },[query,month,period,dayType,slot,history]);
  const guests = useMemo(() => (data?.guests || []).map(g => guestSummary(g)),[data]);
  const months = useMemo(() => [...new Set(guests.flatMap(g => g.visits.map(v => v.date.slice(0,7))))].sort().reverse(),[guests]);
  const filtered = useMemo(() => guests.filter(g => {
    if (query && !`${g.name} ${g.passCode} ${g.phone || ''} ${g.email || ''}`.toLowerCase().includes(query.toLowerCase().trim())) return false;
    if (history === 'matched' && !g.visits.length) return false;
    if (history === 'pending' && g.visits.length) return false;
    return !(month || period || dayType || slot) || g.visits.some(v => (!month || v.date.startsWith(month)) && (!period || v.period === period) && (!dayType || v.dayType === dayType) && (!slot || v.slot === slot));
  }).sort((a,b) => (b.latest?.date || '').localeCompare(a.latest?.date || '') || a.name.localeCompare(b.name)),[guests,query,month,period,dayType,slot,history]);
  const selectedVisits = filtered.flatMap(g => g.visits.filter(v => (!month || v.date.startsWith(month)) && (!period || v.period === period) && (!dayType || v.dayType === dayType) && (!slot || v.slot === slot)));
  const matched = guests.filter(g=>g.visits.length).length;
  const pages = Math.max(1,Math.ceil(filtered.length/25));
  return <div className="dashboard loyalty-tracking">
    <div className="dashboard__header"><div><h1>Loyalty Guest Tracking</h1><p className="dashboard__subtitle">Track scanned loyalty passes, return visits and visiting habits.</p></div>
      <button className="btn btn--ghost" onClick={load} disabled={loading}><RefreshCw size={15}/>{loading ? 'Loading…':'Refresh'}</button></div>
    <div className="loyalty-source"><span>Guest list: <a href="https://loyalty.karikaala.de/staff" target="_blank" rel="noreferrer">ARASAVAI <ExternalLink size={12}/></a> · Source: staff scan log · Times as displayed in staff terminal</span>
      <span>{data?.updatedAt ? `Imported ${new Date(data.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/Berlin'})}`:'Waiting for first import'}</span></div>
    {error && <p className="loyalty-message" role="alert">{error}</p>}
    {data && <>
      {data.connectionPending && <p className="loyalty-message" role="status">The tracking tab is ready. Connecting the loyalty scan records to this dashboard is awaiting approval. Visit history and patterns will appear after the connection is enabled.</p>}
      <div className="loyalty-stats">{[
        [Users,'Loyalty guests',number.format(guests.length),'Passes with recorded scans'],
        [CalendarDays,'With scan history',number.format(matched),`${number.format(guests.length-matched)} without recorded scans`],
        [CalendarDays,'Visits in selection',number.format(selectedVisits.length),'Recorded loyalty scans'],
        [Clock3,'Returning guests',number.format(filtered.filter(g=>g.visits.length>1).length),'2+ recorded scans'],
      ].map(([Icon,label,value,note])=><section key={label}><Icon size={18}/><span>{label}</span><strong>{data.connectionPending ? '—' : value}</strong><small>{note}</small></section>)}</div>
      {matched < guests.length && <p className="loyalty-message">Scan history is available for {number.format(matched)} of {number.format(guests.length)} guests. Pending scan history does not mean the guest has never visited.</p>}
      <div className="loyalty-filters">
        <label className="loyalty-search"><span><Search size={14}/>Find guest</span><input placeholder="Name, phone, email or pass code" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label><span>Month</span><select value={month} onChange={e=>setMonth(e.target.value)}><option value="">All months</option>{months.map(m=><option key={m}>{m}</option>)}</select></label>
        <label><span>Part of month</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="">All periods</option>{MONTH_PERIODS.map(v=><option key={v}>{v}</option>)}</select></label>
        <label><span>Day</span><select value={dayType} onChange={e=>setDayType(e.target.value)}><option value="">All days</option>{DAY_TYPES.map(v=><option key={v}>{v}</option>)}</select></label>
        <label><span>Visiting time</span><select value={slot} onChange={e=>setSlot(e.target.value)}><option value="">All times</option>{[...TIME_SLOTS,'Time unknown'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label><span>History</span><select value={history} onChange={e=>setHistory(e.target.value)}><option value="all">All guests</option><option value="matched">With visit history</option><option value="pending">Pending history</option></select></label>
      </div>
      <div className="loyalty-patterns">
        <Pattern title="Part of month" values={distribution(selectedVisits,'period',MONTH_PERIODS)} total={selectedVisits.length}/>
        <Pattern title="Weekday or weekend" values={distribution(selectedVisits,'dayType',DAY_TYPES)} total={selectedVisits.length}/>
        <Pattern title="Visiting time slots" values={distribution(selectedVisits,'slot',[...TIME_SLOTS,'Time unknown'])} total={selectedVisits.length}/>
      </div>
      <section className="loyalty-list"><div className="loyalty-list-head"><h2>Guest scan history</h2><span>{number.format(filtered.length)} guests · Latest and previous visits use all recorded history</span></div>
        <div className="loyalty-table-wrap"><table><thead><tr><th>Guest / Pass</th><th>Latest visit</th><th>Previous visit</th><th>Visits</th><th>Return gap</th><th>Usual month period</th><th>Usual day</th><th>Usual time</th><th>History</th></tr></thead>
          <tbody>{filtered.slice(page*25,(page+1)*25).map(g=><GuestRow key={g.id || g.passCode} guest={g} open={expanded === g.passCode} onToggle={()=>setExpanded(expanded === g.passCode ? null:g.passCode)}/>)}</tbody></table></div>
        {!filtered.length && <p className="loyalty-empty">{guests.length ? 'No guests match these filters.':'No loyalty guest list has been imported yet.'}</p>}
        <div className="loyalty-pagination"><span>Page {page+1} of {pages}</span><button className="btn btn--ghost" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="btn btn--ghost" disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>Next</button></div>
      </section>
      <p className="loyalty-footnote">Patterns use recorded loyalty scans from the staff terminal. Scan time may differ from arrival time. A tie shows both preferences. Refresh reloads the latest imported records; this is not an automatic connection to the loyalty app.</p>
    </>}
  </div>;
}
function GuestRow({guest:g,open,onToggle}) {
  return <><tr><td><strong>{g.name}</strong><small>{g.passCode}</small></td><td>{stamp(g.latest)}{g.latest && <small>{g.daysSinceVisit} days ago</small>}</td><td>{g.previous ? stamp(g.previous):'—'}</td><td>{g.visits.length || '—'}</td><td>{g.gapDays == null ? '—':`${g.gapDays} days`}</td><td>{g.period}</td><td>{g.dayType}</td><td>{g.slot}</td><td><button className="loyalty-detail" onClick={onToggle} aria-expanded={open} aria-label={`Visit history for ${g.name}`}>{open ? <ChevronUp size={15}/>:<ChevronDown size={15}/>}</button></td></tr>
    {open && <tr className="loyalty-expanded"><td colSpan={9}><div className="loyalty-guest-detail"><h3>{g.name} · Recorded scans</h3><p>{g.phone || 'No phone recorded'} · {g.passCode}</p>
      {g.visits.length ? <ol>{g.visits.map((v,i)=><li key={v.id || `${v.date}-${v.time}`}><strong>{stamp(v)}</strong><span>{v.period} · {v.dayType} · {v.slot}{v.cashier ? ` · Scanned by ${v.cashier}` : ''}</span>{i===0 && <small>Latest recorded scan</small>}</li>)}</ol>:<p>No scans have been imported for this pass yet.</p>}
      {g.openTableProfileUrl && <a href={g.openTableProfileUrl} target="_blank" rel="noreferrer">Open guest in OpenTable <ExternalLink size={12}/></a>}
    </div></td></tr>}</>;
}
