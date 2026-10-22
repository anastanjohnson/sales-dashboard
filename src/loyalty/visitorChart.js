const at = date => new Date(`${date}T12:00:00Z`);
const iso = date => date.toISOString().slice(0,10);
const shiftDays = (date, days) => { const d=at(date); d.setUTCDate(d.getUTCDate()+days); return iso(d); };
const monday = date => shiftDays(date,-(at(date).getUTCDay()+6)%7);
export function visitorChart(guests,date,view='day') {
  const year=date.slice(0,4), month=date.slice(0,7), buckets=[];
  let start,end;
  if(view==='month') {
    start=`${year}-01-01`;end=`${year}-12-31`;
    for(let n=1;n<=12;n++) {const key=`${year}-${String(n).padStart(2,'0')}`;buckets.push({key,label:new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(at(`${key}-01`))});}
  } else if(view==='week') {
    start=`${month}-01`;const d=at(start);d.setUTCMonth(d.getUTCMonth()+1,0);end=iso(d);
    for(let key=monday(start);key<=end;key=shiftDays(key,7)) buckets.push({key,label:`${key.slice(8)} ${new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(at(key))}`});
  } else {
    start=monday(date);end=shiftDays(start,6);
    for(let key=start;key<=end;key=shiftDays(key,1))buckets.push({key,label:new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(at(key))});
  }
  const map=new Map(buckets.map(b=>[b.key,{...b,passes:new Set(),scans:0}])),passes=new Set();
  let scans=0;
  for(const guest of guests) for(const visit of guest.visits) {
    if(visit.date<start||visit.date>end)continue;
    const key=view==='month'?visit.date.slice(0,7):view==='week'?monday(visit.date):visit.date;
    const bucket=map.get(key);if(!bucket)continue;
    bucket.passes.add(guest.passCode);bucket.scans++;passes.add(guest.passCode);scans++;
  }
  return {start,end,guests:passes.size,scans,rows:[...map.values()].map(({passes,...b})=>({...b,guests:passes.size}))};
}
export function shiftChartDate(date,view,direction) {
  const d=at(date);
  if(view==='month'){d.setUTCDate(1);d.setUTCFullYear(d.getUTCFullYear()+direction);}
  else if(view==='week'){d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+direction);}
  else d.setUTCDate(d.getUTCDate()+direction*7);
  return iso(d);
}
