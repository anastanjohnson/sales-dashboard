import test from 'node:test';
import assert from 'node:assert/strict';
import { MONTH_PERIODS, DAY_TYPES, visitPeriod, visitDayType, visitSlot, normalizeVisits, guestSummary } from '../src/loyalty/model.js';
test('month boundaries never overlap',()=>{
  for(const [day,group] of [[1,0],[10,0],[11,1],[20,1],[21,2],[31,2]]) assert.equal(visitPeriod(`2026-10-${String(day).padStart(2,'0')}`),MONTH_PERIODS[group]);
});
test('Thursday is weekday and Friday through Sunday are weekend',()=>{
  assert.equal(visitDayType('2026-10-22'),DAY_TYPES[0]);
  for(const d of ['23','24','25']) assert.equal(visitDayType(`2026-10-${d}`),DAY_TYPES[1]);
  assert.equal(visitDayType('2026-10-26'),DAY_TYPES[0]);
});
test('time boundaries and unknown times',()=>{
  assert.equal(visitSlot('14:59'),'12:00–14:59');assert.equal(visitSlot('15:00'),'15:00–17:59');
  assert.equal(visitSlot('18:00'),'18:00–20:59');assert.equal(visitSlot(null),'Time unknown');
});
test('exclude cancelled, no show, future and invalid visits; deduplicate and sort',()=>{
  const rows=[{id:'a',date:'2026-10-18',time:'18:00',status:'seated'},{id:'a',date:'2026-10-18',time:'18:00',status:'seated'},
    {date:'2026-10-19',status:'cancelled'},{date:'2026-10-19',status:'no-show'},{date:'2026-12-01',status:'completed'},
    {date:'2026-02-30',status:'completed'},{date:'2026-10-20',time:'24:30',status:'completed'},
    {date:'2026-10-11',time:null,status:'completed'}];
  const visits=normalizeVisits(rows,new Date('2026-10-22T12:00:00Z'));assert.equal(visits.length,2);assert.equal(visits[0].date,'2026-10-18');assert.equal(visits[1].slot,'Time unknown');
});
test('latest, previous and gap use full history, without conflating loyalty scans',()=>{
  const g=guestSummary({name:'Test',loyaltyCheckins:20,visits:[{date:'2026-10-11',time:'13:00',status:'scanned'},{date:'2026-10-18',time:'18:00',status:'scanned'}]},new Date('2026-10-22T12:00:00Z'));
  assert.equal(g.latest.date,'2026-10-18');assert.equal(g.previousScan.date,'2026-10-11');assert.equal(g.previous,null);assert.equal(g.gapDays,null);assert.equal(g.daysSinceVisit,4);assert.equal(g.visits.length,2);
});
test('tracking starts inclusively at 10 October 12:33 using staff displayed time',()=>{
  const rows=[['2026-10-09','19:00'],['2026-10-10','12:32'],['2026-10-10',null],['2026-10-10','12:33'],['2026-10-10','15:23'],['2026-10-11',null]]
    .map(([date,time])=>({date,time,status:'scanned'}));
  const visits=normalizeVisits(rows,new Date('2026-10-22T12:00:00Z'));
  assert.equal(visits.length,3);
  assert.equal(visits.at(-1).date,'2026-10-10');assert.equal(visits.at(-1).time,'12:33');
  const g=guestSummary({visits:[{date:'2026-10-09',time:'19:00',status:'scanned'},{date:'2026-10-10',time:'12:33',status:'scanned'}]},new Date('2026-10-22T12:00:00Z'));
  assert.equal(g.visits.length,1);assert.equal(g.previous,null);assert.equal(g.gapDays,null);
});

test('previous visit uses completed matched OpenTable history before the latest scan, including pre-cutoff dates',()=>{
 const guest={passCode:'TEST-1',visits:[{date:'2026-10-19',time:'11:56',status:'scanned'},{date:'2026-10-18',time:'17:42',status:'scanned'}],openTableHistory:{matchedPassCode:'TEST-1',visits:[
 {date:'2026-09-11',time:'18:30',status:'finished'},
 {date:'2026-10-19',time:'18:30',status:'finished'},
 {date:'2026-10-05',time:'18:30',status:'cancelled'},
 {date:'2026-10-10',time:'18:30',status:'no-show'},
 {date:'2026-10-25',time:'18:30',status:'finished'},
 {date:'2026-09-31',time:'18:30',status:'finished'}]}};
 const result=guestSummary(guest,new Date('2026-10-22T12:00:00Z'));
 assert.equal(result.previous.date,'2026-09-11');assert.equal(result.previous.time,'18:30');assert.equal(result.gapDays,38);
 assert.equal(result.previousScan.date,'2026-10-18');assert.equal(result.visits.length,2);
 assert.equal(guestSummary({...guest,openTableHistory:{...guest.openTableHistory,matchedPassCode:'OTHER'}}).previous,null);
});

test('visitor bars group by Monday weeks and month/year with unique pass counts',async()=>{
 const {visitorChart,shiftChartDate}=await import('../src/loyalty/visitorChart.js');
 const guests=[{passCode:'A',visits:[{date:'2026-10-18'},{date:'2026-10-18'},{date:'2026-10-19'}]},{passCode:'B',visits:[{date:'2026-10-19'},{date:'2026-11-01'}]}];
 const daily=visitorChart(guests,'2026-10-19','day');
 assert.equal(daily.start,'2026-10-19');assert.equal(daily.end,'2026-10-25');assert.equal(daily.rows[0].guests,2);assert.equal(daily.rows.length,7);
 const weekly=visitorChart(guests,'2026-10-22','week');
 assert.equal(weekly.guests,2);assert.equal(weekly.scans,4);assert.equal(weekly.rows.find(r=>r.key==='2026-10-12').guests,1);
 assert.equal(weekly.rows.find(r=>r.key==='2026-10-19').guests,2);
 const monthly=visitorChart(guests,'2026-10-22','month');assert.equal(monthly.rows.length,12);assert.equal(monthly.rows[9].guests,2);assert.equal(monthly.rows[10].guests,1);assert.equal(monthly.guests,2);
 assert.equal(shiftChartDate('2026-01-31','week',1),'2026-02-01');assert.equal(shiftChartDate('2026-10-19','day',-1),'2026-10-12');
});

test('pre-opening scans remain in history but are excluded from valid visiting time slots',async()=>{
 const {TIME_SLOTS}=await import('../src/loyalty/model.js');
 assert.equal(visitSlot('11:59'),'Time needs verification');assert.equal(visitSlot('12:00'),'12:00–14:59');
 assert.equal(visitSlot('17:59'),'15:00–17:59');assert.equal(visitSlot('21:00'),'21:00 onward');
 const visits=normalizeVisits([{date:'2026-10-19',time:'11:55',status:'scanned'},{date:'2026-10-18',time:'17:52',status:'scanned'}],new Date('2026-10-22T12:00:00Z'));
 assert.equal(visits.length,2);assert.equal(visits.filter(v=>TIME_SLOTS.includes(v.slot)).length,1);
});
