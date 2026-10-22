import { useMemo, useState } from 'react';
import { berlinToday } from '../loyalty/model.js';
import { attendanceSummary, shiftAttendanceDate } from '../loyalty/attendance.js';
const format = date => new Intl.DateTimeFormat('en-GB', { day:'2-digit',month:'short',year:'numeric',timeZone:'UTC' }).format(new Date(`${date}T12:00:00Z`));
export default function LoyaltyAttendance({guests}) {
  const [view,setView] = useState('month'), [date,setDate] = useState(berlinToday);
  const report = useMemo(()=>attendanceSummary(guests,date,view),[guests,date,view]);
  return <section className="loyalty-list loyalty-attendance" aria-label="ARASAVAI visitors">
    <div className="loyalty-list-head"><div><h2>ARASAVAI visitors</h2><p>How many loyalty guests visited by day, week or month.</p></div>
      <div className="loyalty-attendance-views" role="group" aria-label="Visitor view">{[['day','Day'],['week','Week'],['month','Month']].map(([value,label])=><button key={value} className="btn btn--ghost" aria-pressed={view===value} onClick={()=>setView(value)}>{label}</button>)}</div></div>
    <div className="loyalty-attendance-controls"><button className="btn btn--ghost" aria-label={`Previous ${view}`} onClick={()=>setDate(shiftAttendanceDate(date,view,-1))}>Previous</button>
      <label>Choose date<input type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label>
      <button className="btn btn--ghost" aria-label={`Next ${view}`} onClick={()=>setDate(shiftAttendanceDate(date,view,1))}>Next</button>
      <button className="btn btn--ghost" onClick={()=>setDate(berlinToday())}>Today</button>
      <strong>{report.start === report.end ? format(report.start) : `${format(report.start)} – ${format(report.end)}`}</strong></div>
    <div className="loyalty-attendance-totals"><div><strong>{report.guests}</strong><span>Loyalty guests in this {view}</span></div><div><strong>{report.scans}</strong><span>Loyalty scans in this {view}</span></div></div>
    <p className="loyalty-attendance-note">Each pass counts once per selected period. Daily counts count each pass once per date; repeat scans are shown separately. Based on imported scans from 10 October 2026 at 12:33. No recorded scans does not confirm no visits. This section uses all imported loyalty guests.</p>
    <div className="loyalty-table-wrap"><table><thead><tr><th>Date</th><th>Day</th><th>ARASAVAI guests</th><th>Loyalty scans</th></tr></thead><tbody>{report.days.map(row=><tr key={row.date} className={row.guests ? 'loyalty-attendance-active' : ''}><td>{format(row.date)}</td><td>{new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'UTC'}).format(new Date(`${row.date}T12:00:00Z`))}</td><td><strong>{row.guests}</strong></td><td>{row.scans || 'No scans recorded'}</td></tr>)}</tbody></table></div>
  </section>;
}
