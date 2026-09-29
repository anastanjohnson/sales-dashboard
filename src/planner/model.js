export const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const day = value => new Date(`${value}T00:00:00Z`);
export const dateKey = value => value.toISOString().slice(0,10);
export const addDays = (value, n) => dateKey(new Date(+day(value) + n * 86400000));
export const weekday = value => (day(value).getUTCDay()+6)%7;
export const monday = value => addDays(value,-weekday(value));
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const clock = n => `${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const minutes = value => Number(value.split(':')[0])*60+Number(value.split(':')[1]);
export const timeLabel = s => `${clock(s.start)} – ${clock(s.end)}${s.nextDay?' (+1 day)':''}`;
export const duration = s => s.end+(s.nextDay?1440:0)-s.start;
export const inWeek = (p,w) => p.slots.filter(s=>monday(s.date)===w).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
export const locked = (p,w) => !!p.published[w]&&!p.editing.includes(w);
export const closed = d => [1,2].includes(weekday(d));
export const standardPresets = [[660,1020],[720,1020],[960,1320],[1020,1320]].map(([start,end])=>({start,end,nextDay:false,breakMinutes:0,role:''}));
export function normalizePlan(p) {
 if(p.version!==3||!Array.isArray(p.staff)||!Array.isArray(p.slots)||!p.published) throw Error('Unsupported planner data. Open the original planner to update it first.');
 return {...p,timeOff:p.timeOff||[],presets:p.presets||standardPresets,editing:p.editing||[],preparedWeeks:p.preparedWeeks||[...new Set(p.slots.map(s=>monday(s.date)))]};
}
const span = s => [+day(s.date)+s.start*60000,+day(s.date)+(s.end+(s.nextDay?1440:0))*60000];
export const overlaps = (a,b) => {const [a0,a1]=span(a),[b0,b1]=span(b);return a0<b1&&b0<a1;};
export function detailsProblem(s) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Number.isFinite(+day(s.date))||dateKey(day(s.date))!==s.date) return 'Choose a valid date.';
 if(![s.start,s.end,s.breakMinutes].every(Number.isInteger)||s.start<0||s.start>=1440||s.end<0||s.end>=1440||duration(s)<=0||duration(s)>=1440) return 'End must follow start. Use Ends next day for overnight shifts shorter than 24 hours.';
 if(s.breakMinutes<0||s.breakMinutes>=duration(s))return 'Break must be shorter than the shift.';
 return '';
}
export function assignmentProblem(p,s,staffId,staffTimeOff=[]) {
 if(!p.staff.some(x=>x.id===staffId))return 'Staff member no longer exists.';
 if(closed(s.date))return 'Restaurant closed on Tuesdays and Wednesdays.';
 if([...p.timeOff,...staffTimeOff].some(x=>x.staffId===staffId&&overlaps(s,x)))return 'Unavailable during these hours.';
 const occupied=[...p.slots,...Object.entries(p.published).filter(([w])=>w!==monday(s.date)&&p.editing.includes(w)).flatMap(([,v])=>v.slots)];
 if(occupied.some(x=>x.id!==s.id&&x.staffId===staffId&&overlaps(s,x)))return 'Already assigned to an overlapping shift.';
 return '';
}
export function saveSlot(p,s,staffTimeOff=[]) {
 const old=p.slots.find(x=>x.id===s.id),w=monday(s.date);
 if(locked(p,w)||(old&&locked(p,monday(old.date))))throw Error('Create a draft before editing a published week.');
 if(old&&monday(old.date)!==w)throw Error('Move shifts within the same week.');
 if(closed(s.date))throw Error('Restaurant closed on Tuesdays and Wednesdays.');
 const error=detailsProblem(s)||(s.staffId&&assignmentProblem(p,s,s.staffId,staffTimeOff));if(error)throw Error(error);
 const {start,end,nextDay,breakMinutes,role}=s,preset={start,end,nextDay,breakMinutes,role};
 return {...p,slots:[...p.slots.filter(x=>x.id!==s.id),s],presets:[...new Map([...p.presets,preset].map(x=>[JSON.stringify(x),x])).values()]};
}
export function removeSlot(p,s) {if(locked(p,monday(s.date)))throw Error('Create a draft before removing a published shift.');return {...p,slots:p.slots.filter(x=>x.id!==s.id)};}
export function template(w) {return Array.from({length:7},(_,i)=>i===1||i===2?[]:(i>=5?[[660,1020],[720,1020],[1020,1320],[1020,1320],[1020,1320]]:[[960,1320],[1020,1320],[1020,1320]]).map(([start,end],j)=>({id:`template-${addDays(w,i)}-${j}`,date:addDays(w,i),start,end,nextDay:false,staffId:null,breakMinutes:0,role:'',notes:''}))).flat();}
export function prepareWeek(p,w) {
 if(p.preparedWeeks.includes(w)||p.published[w])return p;
 const prev=Object.values(p.published).filter(x=>x.week<w).sort((a,b)=>b.week.localeCompare(a.week))[0];
 const slots=prev?prev.slots.filter(x=>!closed(x.date)).map((s,i)=>({...s,id:`repeat-${w}-${i}`,date:addDays(w,weekday(s.date)),staffId:p.staff.some(x=>x.id===s.staffId)?s.staffId:null})):template(w);
 return {...p,slots:[...p.slots.filter(s=>monday(s.date)!==w),...slots],preparedWeeks:[...p.preparedWeeks,w]};
}
export function publish(p,w,staffTimeOff=[],now=new Date()) {
 const slots=inWeek(p,w);if(!slots.length)throw Error('Add shifts before publishing.');
 if(slots.some(s=>!s.staffId))throw Error('Assign all shifts before publishing.');
 for(const s of slots){const error=detailsProblem(s)||assignmentProblem(p,s,s.staffId,staffTimeOff);if(error)throw Error(`${s.date} ${timeLabel(s)}: ${error}`);}
 return {...p,published:{...p.published,[w]:{week:w,slots:structuredClone(slots),names:Object.fromEntries(p.staff.map(s=>[s.id,s.name])),publishedAt:now.toISOString(),revision:(p.published[w]?.revision||0)+1,previous:p.published[w]?structuredClone({slots:p.published[w].slots,names:p.published[w].names,revision:p.published[w].revision}):null}},editing:p.editing.filter(x=>x!==w)};
}
export function availability(p,staffId,date,start,end,available) {
 if(!p.staff.some(s=>s.id===staffId))throw Error('Choose a staff member.');
 if(start<0||start>=1440||end<=start||end>2880)throw Error('Choose a valid unavailable interval.');
 const ranges=end>1440?[{date,start,end:1440},{date:addDays(date,1),start:0,end:end-1440}]:[{date,start,end}];
 let next=[...p.timeOff];
 for(const r of ranges){next=next.flatMap(x=>x.staffId!==staffId||x.date!==r.date||x.end<=r.start||r.end<=x.start?[x]:[...(x.start<r.start?[{...x,end:r.start}]:[]),...(x.end>r.end?[{...x,start:r.end}]:[])]);if(!available)next.push({...r,staffId});}
 return {...p,timeOff:next};
}
export function monthlyHours(p,id,month) {
 const from=+day(`${month}-01`),d=day(`${month}-01`);d.setUTCMonth(d.getUTCMonth()+1);const to=+d;
 const effective=[...p.slots.filter(s=>!locked(p,monday(s.date))),...Object.entries(p.published).filter(([w])=>!p.editing.includes(w)).flatMap(([,v])=>v.slots)];
 return effective.filter(s=>s.staffId===id).reduce((n,s)=>{const [a,b]=span(s);return n+Math.max(0,Math.min(b,to)-Math.max(a,from))/3600000*(duration(s)-s.breakMinutes)/duration(s);},0);
}
export function rosterText(p) {return `STAFF PLAN · ${p.week} – ${addDays(p.week,6)}\n${versionLabel(p.revision)}\n`+p.slots.map(s=>`${s.date} · ${timeLabel(s)} · ${p.names[s.staffId]||'Unassigned'}${s.role?' · '+s.role:''}${s.breakMinutes?' · Break '+s.breakMinutes+' min':''}${s.notes?'\n'+s.notes:''}`).join('\n');}

export function setAvailability(p,staffTimeOff,staffId,date,start,end,available) {
 let next=availability(p,staffId,date,start,end,available);const clear=[];
 if(!available)return {plan:next,clear};
 const from=+day(date)+start*60000,to=+day(date)+end*60000;
 for(const off of staffTimeOff.filter(x=>x.staffId===staffId)){
  const a=+day(off.date)+off.start*60000,b=+day(off.date)+off.end*60000;
  if(a>=to||b<=from)continue;
  clear.push({staffId,date:off.date});
  if(a<from)next=availability(next,staffId,off.date,off.start,Math.min(1440,(from-+day(off.date))/60000),false);
  if(to<b)next=availability(next,staffId,off.date,Math.max(0,(to-+day(off.date))/60000),off.end,false);
 }
 return {plan:next,clear};
}

export const versionLabel = revision => `Published Version ${String(revision).padStart(2,'0')}`;
export function publicationChanges(snapshot) {
 const previous=snapshot?.previous;
 if(!previous)return {available:false,added:[],changed:[],removed:[]};
 const old=new Map(previous.slots.map(s=>[s.id,s])),current=new Map(snapshot.slots.map(s=>[s.id,s]));
 const fields=['date','start','end','nextDay','breakMinutes','role','notes','staffId'];
 return {available:true,added:snapshot.slots.filter(s=>!old.has(s.id)),changed:snapshot.slots.filter(s=>old.has(s.id)&&(fields.some(k=>(s[k]??'')!==(old.get(s.id)[k]??''))||(snapshot.names[s.staffId]||'')!==(previous.names[old.get(s.id).staffId]||''))).map(after=>({before:old.get(after.id),after})),removed:previous.slots.filter(s=>!current.has(s.id))};
}
