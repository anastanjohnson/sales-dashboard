import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Users, CalendarDays, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { apiFetch } from '../api.js';
import { MONTH_PERIODS, DAY_TYPES, TIME_SLOTS, guestSummary, distribution, matchesVisitFilters, dinerTotals } from '../loyalty/model.js';
import './LoyaltyGuestTrackingPage.css';
import LoyaltyVisitorChart from './LoyaltyVisitorChart.jsx';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDate = date => date ? dateFormat.format(new Date(`${date}T12:00:00Z`)) : '—';
const stamp = visit => visit ? `${formatDate(visit.date)} · ${visit.time || 'Time unknown'}` : 'No recorded scan';
const number = new Intl.NumberFormat('en-GB');
const pieColors = ['var(--series-1)', 'var(--series-2)', 'var(--series-3, #e0ad4e)', 'var(--series-4, #e97870)', 'var(--series-5, #559fdb)'];
const percentage = (count,total) => `${total ? (count/total*100).toFixed(1) : '0.0'}%`;
function Pattern({ title, values, note }) {
  const total = values.reduce((sum,v)=>sum+v.count,0);
  const slices = values.map((v,i)=>({...v,color:pieColors[i%pieColors.length]})).filter(v=>v.count>0);
  return <section className="loyalty-pattern loyalty-pie"><h2>{title}</h2>
    {total ? <ResponsiveContainer width="100%" height={220}><PieChart accessibilityLayer><Pie data={slices} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={72} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} labelLine={{stroke:'var(--text-muted)'}} label={({cx,cy,midAngle,outerRadius,value})=>{const angle=-midAngle*Math.PI/180;const x=cx+(outerRadius+20)*Math.cos(angle),y=cy+(outerRadius+20)*Math.sin(angle);return <text x={x} y={y} fill="var(--text-primary)" textAnchor={x>cx?'start':'end'} dominantBaseline="central" fontSize={12} fontWeight={700}>{percentage(value,total)}</text>;}}>{slices.map(v=><Cell key={v.label} fill={v.color}/>)}</Pie><Tooltip formatter={(value,name)=>[`${value} visits · ${percentage(value,total)}`,name]} contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text-primary)'}}/></PieChart></ResponsiveContainer> : <p className="loyalty-empty">No eligible scan times in this selection.</p>}
    <ul className="loyalty-pie-legend">{values.map((v,i)=><li key={v.label}><span className="loyalty-pie-dot" style={{background:pieColors[i%pieColors.length]}}/><span>{v.label}</span><strong>{percentage(v.count,total)}</strong><small>{v.count} visits</small></li>)}</ul>
    {note && <p className="loyalty-pie-note">{note}</p>}
  </section>;
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
  const guests = useMemo(() => (data?.guests || []).map(g => guestSummary(g)).filter(g => g.visits.length > 0),[data]);
  const months = useMemo(() => [...new Set(guests.flatMap(g => g.visits.map(v => v.date.slice(0,7))))].sort().reverse(),[guests]);
  const filtered = useMemo(() => guests.filter(g => {
    if (query && !`${g.name} ${g.passCode} ${g.phone || ''} ${g.email || ''}`.toLowerCase().includes(query.toLowerCase().trim())) return false;
    if (history === 'matched' && !g.previous) return false;
    if (history === 'pending' && g.previous) return false;
    return g.countedVisits.some(v => matchesVisitFilters(v, {month, period, dayType, slot}));
  }).sort((a,b) => (b.latest?.date || '').localeCompare(a.latest?.date || '') || a.name.localeCompare(b.name)),[guests,query,month,period,dayType,slot,history]);
  const selectedVisits = filtered.flatMap(g => g.countedVisits.filter(v => matchesVisitFilters(v, {month, period, dayType, slot})));
  const diners = dinerTotals(selectedVisits);
  const matched = guests.filter(g=>g.previous).length;
  const pages = Math.max(1,Math.ceil(filtered.length/25));
  return <div className="dashboard loyalty-tracking">
    <div className="dashboard__header"><div><h1>Loyalty Guest Tracking</h1><p className="dashboard__subtitle">Tracking from 10 October 2026 at 12:33, including that scan.</p></div>
      <button className="btn btn--ghost" onClick={load} disabled={loading}><RefreshCw size={15}/>{loading ? 'Loading…':'Refresh'}</button></div>
    <div className="loyalty-source"><span>Guest list: <a href="https://loyalty.karikaala.de/staff" target="_blank" rel="noreferrer">ARASAVAI <ExternalLink size={12}/></a> · Scans: staff terminal · Previous visit: OpenTable History</span>
      <span>{data?.updatedAt ? `Imported ${new Date(data.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/Berlin'})}`:'Waiting for first import'}</span></div>
    {error && <p className="loyalty-message" role="alert">{error}</p>}
    {data && <>
      {data.connectionPending && <p className="loyalty-message" role="status">The tracking tab is ready. Connecting the loyalty scan records to this dashboard is awaiting approval. Visit history and patterns will appear after the connection is enabled.</p>}
      <div className="loyalty-stats">{[
        [Users,'Loyalty guests',number.format(guests.length),'Passes with recorded scans'],
        [CalendarDays,'OpenTable history matched',number.format(matched),`${number.format(guests.length-matched)} awaiting previous visit`],
        [CalendarDays,'Visits in selection',number.format(selectedVisits.length),'Each guest counted once per month'],
        [Users,'Total diners',diners.pendingVisits ? `${number.format(diners.total)} verified` : number.format(diners.total),`${diners.matchedVisits} of ${selectedVisits.length} visits matched${diners.pendingVisits ? ` · ${diners.pendingVisits} pending` : ''} · Includes companions`],
      ].map(([Icon,label,value,note])=><section key={label}><Icon size={18}/><span>{label}</span><strong>{data.connectionPending ? '—' : value}</strong><small>{note}</small></section>)}</div>
      {matched < guests.length && <p className="loyalty-message">A previous OpenTable visit is available for {number.format(matched)} of {number.format(guests.length)} guests. Unmatched history does not mean the guest has never visited.</p>}
      <LoyaltyVisitorChart guests={guests}/>
      <div className="loyalty-filters">
        <label className="loyalty-search"><span><Search size={14}/>Find guest</span><input placeholder="Name, phone, email or pass code" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label><span>Month</span><select value={month} onChange={e=>setMonth(e.target.value)}><option value="">All months</option>{months.map(m=><option key={m}>{m}</option>)}</select></label>
        <label><span>Part of month</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="">All periods</option>{MONTH_PERIODS.map(v=><option key={v}>{v}</option>)}</select></label>
        <label><span>Day</span><select value={dayType} onChange={e=>setDayType(e.target.value)}><option value="">All days</option>{DAY_TYPES.map(v=><option key={v}>{v}</option>)}</select></label>
        <label><span>Visiting time</span><select value={slot} onChange={e=>setSlot(e.target.value)}><option value="">All times</option>{[...TIME_SLOTS,'Time unknown','Time needs verification'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label><span>History</span><select value={history} onChange={e=>setHistory(e.target.value)}><option value="all">All guests</option><option value="matched">With visit history</option><option value="pending">Pending history</option></select></label>
      </div>
      <div className="loyalty-patterns">
        <Pattern title="Part of month" values={distribution(selectedVisits,'period',MONTH_PERIODS)}/>
        <Pattern title="Weekday or weekend" values={distribution(selectedVisits,'dayType',DAY_TYPES)}/>
        <Pattern title="Visiting time slots" values={distribution(selectedVisits,'slot',TIME_SLOTS)} note={`${selectedVisits.filter(v=>!TIME_SLOTS.includes(v.slot)).length} monthly visits excluded: first scan before 12:00 or time unknown. Percentages use only first monthly scans from 12:00 onward. Weekend opening: 12:00. Scan times may differ from arrival times.`}/>
      </div>
      <section className="loyalty-list"><div className="loyalty-list-head"><h2>Guest scan history</h2><span>{number.format(filtered.length)} guests · Previous visits come from OpenTable History, including dates before tracking began</span></div>
        <div className="loyalty-table-wrap"><table><thead><tr><th>Guest / Pass</th><th>Latest loyalty scan</th><th>Previous visit · OpenTable</th><th>Counted visits</th><th>Diners · OpenTable</th><th title="Calendar days between the latest loyalty scan date and the previous OpenTable visit date">Days between visits</th><th>Usual month period</th><th>Usual day</th><th>Usual time</th><th>History</th></tr></thead>
          <tbody>{filtered.slice(page*25,(page+1)*25).map(g=><GuestRow key={g.id || g.passCode} guest={g} countedVisits={g.countedVisits.filter(v=>matchesVisitFilters(v,{month,period,dayType,slot}))} open={expanded === g.passCode} onToggle={()=>setExpanded(expanded === g.passCode ? null:g.passCode)}/>)}</tbody></table></div>
        {!filtered.length && <p className="loyalty-empty">{guests.length ? 'No guests match these filters.':'No loyalty guest list has been imported yet.'}</p>}
        <div className="loyalty-pagination"><span>Page {page+1} of {pages}</span><button className="btn btn--ghost" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="btn btn--ghost" disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>Next</button></div>
      </section>
      <p className="loyalty-footnote">Total diners includes the loyalty guest and companions from verified OpenTable party sizes for counted visits. Shared reservations count once; unmatched visits are pending, not zero. Each guest counts once per calendar month, using their first eligible scan for visit totals, charts and patterns. Repeat scans remain in the expanded history only. Tracking starts on 10 October 2026 at 12:33, including that scan. Previous visit uses the latest completed OpenTable visit before the latest scan date, including history before 10 October. Scan time may differ from arrival time. Days between visits is the difference between the two displayed visit dates (latest loyalty scan minus previous OpenTable visit). A tie shows both preferences. Refresh reloads the latest imported records; this is not an automatic connection to the loyalty app.</p>
    </>}
  </div>;
}
function GuestRow({guest:g,countedVisits,open,onToggle}) {
  const diners = dinerTotals(countedVisits);
  return <><tr><td><strong>{g.name}</strong><small>{g.passCode}</small></td><td>{stamp(g.latest)}{g.latest && <small>{g.daysSinceVisit} days ago</small>}</td><td>{g.previous ? stamp(g.previous):'Not yet matched'}{g.previous && <small>OpenTable · Finished visit</small>}</td><td>{countedVisits.length || '—'}</td><td>{diners.matchedVisits ? `${diners.total}${diners.pendingVisits ? ' verified' : ''}` : 'Not yet verified'}{diners.pendingVisits > 0 && <small>{diners.pendingVisits} pending</small>}</td><td>{g.gapDays == null ? '—':`${g.gapDays} ${g.gapDays === 1 ? 'day' : 'days'}`}</td><td>{g.period}</td><td>{g.dayType}</td><td>{g.slot}</td><td><button className="loyalty-detail" onClick={onToggle} aria-expanded={open} aria-label={`Visit history for ${g.name}`}>{open ? <ChevronUp size={15}/>:<ChevronDown size={15}/>}</button></td></tr>
    {open && <tr className="loyalty-expanded"><td colSpan={10}><div className="loyalty-guest-detail"><h3>{g.name} · Loyalty scans & previous visit</h3><p>All original scans are retained here. Only the first scan in each calendar month counts in the report.</p><p>{g.phone || 'No phone recorded'} · {g.passCode}</p>
      <p><strong>Previous visit · OpenTable History:</strong> {g.previous ? stamp(g.previous) : 'Not yet matched'}</p>{g.previous && <p>Matched by pass code and phone. This completed visit can be earlier than the loyalty tracking start date.</p>}
      {g.visits.length ? <ol>{g.visits.map((v,i)=><li key={v.id || `${v.date}-${v.time}`}><strong>{stamp(v)}</strong><span>{v.period} · {v.dayType} · {v.slot}{v.cashier ? ` · Scanned by ${v.cashier}` : ''}</span>{i===0 && <small>Latest recorded scan</small>}</li>)}</ol>:<p>No scans have been imported for this pass yet.</p>}
      {g.reservationReport && <><h3>Completed OpenTable bookings · 2026</h3><ol>{g.reservationReport.visits.map(v=><li key={v.reservationId}><strong>{stamp(v)}</strong><span>{v.size} diners · {v.size-1} additional · Finished</span></li>)}</ol></>}
      {g.openTableProfileUrl && <a href={g.openTableProfileUrl} target="_blank" rel="noreferrer">Open guest in OpenTable <ExternalLink size={12}/></a>}
    </div></td></tr>}</>;
}
