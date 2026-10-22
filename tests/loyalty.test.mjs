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
  assert.equal(g.latest.date,'2026-10-18');assert.equal(g.previous.date,'2026-10-11');assert.equal(g.gapDays,7);assert.equal(g.daysSinceVisit,4);assert.equal(g.visits.length,2);
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
