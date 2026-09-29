import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../supabase/functions/dashboard-api/app.js';

const password = 'test-password-only';
const salt = '0123456789abcdef0123456789abcdef';
const encoded = salt + ':' + crypto.scryptSync(password, Buffer.from(salt,'hex'),64).toString('hex');
const config = {
  DASHBOARD_USERNAME:'test-admin', DASHBOARD_PASSWORD_HASH:encoded,
  SALARY_PAYMENT_USERNAME:'test-payroll', SALARY_PAYMENT_PASSWORD_HASH:encoded,
  SALARY_DATA_JSON:'[]', SALARY_PAYMENT_DATA_JSON:'[]', STAFF_HOURS_DATA_JSON:'[]',
  WEEKLY_PERFORMANCE_DATA_JSON:'[]', WEEKLY_BENCHMARKS_DATA_JSON:'[]',
};
const origin = 'https://karikaala-sales-dashboard.web.app';
const sessions = new Map(), limits = new Map();
let protectedReads = 0, writes = 0;
const database = { async query(sql, values=[]) {
  if(sql.includes('firebase_rate_limits')) { const n=(limits.get(values[0])||0)+1; limits.set(values[0],n);return {rows:[{attempts:n}]}; }
  if(sql.startsWith('INSERT INTO dashboard_private.firebase_sessions')) { sessions.set(values[0], {role:values[1]});return {rows:[]}; }
  if(sql.startsWith('DELETE FROM dashboard_private.firebase_sessions WHERE token_hash')) {sessions.delete(values[0]);return {rows:[]};}
  if(sql.startsWith('DELETE FROM dashboard_private.firebase_sessions WHERE expires')) return {rows:[]};
  if(sql.includes('FROM dashboard_private.firebase_sessions')) return {rows:sessions.has(values[0])?[sessions.get(values[0])]:[]};
  if(/INSERT|UPDATE|DELETE/.test(sql)) writes++; else protectedReads++;
  return {rows:[]};
}};
const server = createApp(database,config,[origin]).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const url = `http://127.0.0.1:${server.address().port}/dashboard-api`;
async function request(path, {token, body, method='GET', requestOrigin=origin}={}) {
  const headers={'Origin':requestOrigin};
  if(token) headers.Authorization=`Bearer ${token}`;
  if(body) headers['Content-Type']='application/json';
  return fetch(url+path,{method,headers,body:body?JSON.stringify(body):undefined});
}
test.after(()=>server.close());
let admin, payroll;
test('anonymous cannot access any protected report or write route',async()=>{
 for(const path of ['salary','staff-hours','weekly-performance','weekly-guests','weekly-benchmarks','salary-payment-source','salary-payment-staff','salary-payments']) assert.equal((await request('/api/'+path)).status,401);
 for(const [path,method] of [['planner/session','POST'],['salary-entry','PUT'],['salary-entry','DELETE'],['salary-payments','PUT'],['salary-months','POST']]) assert.equal((await request('/api/'+path,{method,body:{}})).status,401);
 assert.equal(protectedReads,0);assert.equal(writes,0);
});
test('CORS rejects unapproved origins and never uses wildcard',async()=>{
 assert.equal((await request('/api/session',{requestOrigin:'https://untrusted.example'})).status,403);
 const r=await request('/api/session',{method:'OPTIONS'}); assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
});
test('existing scrypt login gives separate opaque, revocable sessions',async()=>{
 assert.equal((await request('/api/login',{method:'POST',body:{username:'test-admin',password:'bad'}})).status,401);
 for(const username of ['test-admin','test-payroll']) {
  const r=await request('/api/login',{method:'POST',body:{username,password}});assert.equal(r.status,200);
  const data=await r.json();assert.match(data.token,/^[a-f0-9]{64}$/);
  assert.equal(sessions.has(data.token),false); // plaintext bearer tokens are not stored
  if(username==='test-admin') admin=data.token;else payroll=data.token;
 }
 assert.equal((await request('/api/session',{token:admin})).headers.get('cache-control'),'no-store');
});
test('planner session bridge requires admin and configuration',async()=>{
 assert.equal((await request('/api/planner/session',{token:payroll,method:'POST'})).status,403);
 assert.equal((await request('/api/planner/session',{token:admin,method:'POST'})).status,503);
 assert.equal((await request('/api/planner/session',{token:admin,method:'POST',requestOrigin:'https://evil.example'})).status,403);
});
test('salary-only role cannot read management reports; admin cannot edit salary entries',async()=>{
 const before=protectedReads;
 for(const path of ['salary','staff-hours','weekly-performance','weekly-guests','weekly-benchmarks']) assert.equal((await request('/api/'+path,{token:payroll})).status,403);
 assert.equal(protectedReads,before);
 for(const [path,method] of [['salary-entry','PUT'],['salary-entry','DELETE'],['salary-months','POST']]) assert.equal((await request('/api/'+path,{token:admin,method,body:{}})).status,403);
 assert.equal((await request('/api/salary-payment-staff',{token:payroll})).status,200);
 assert.equal((await request('/api/staff-hours',{token:admin})).status,200);
 assert.equal(writes,0);
});
test('invalid amounts and dates cannot write; tampered sessions cannot authenticate',async()=>{
 assert.equal((await request('/api/salary-entry',{token:payroll,method:'PUT',body:{year:2026,month:'September',salary:-1,tips:0}})).status,400);
 assert.equal((await request('/api/salary-payments',{token:admin,method:'PUT',body:{paidAmount:-1,paidDate:'2026-02-30'}})).status,400);
 assert.equal(writes,0);
 assert.equal((await request('/api/salary',{token:'f'.repeat(64)})).status,401);
});
test('logout invalidates token on the server',async()=>{
 assert.equal((await request('/api/logout',{token:admin,method:'POST'})).status,200);
 assert.equal((await request('/api/salary',{token:admin})).status,401);
});
test('shared login counter limits repeated attempts',async()=>{
 limits.set('login:unknown',8);
 assert.equal((await request('/api/login',{method:'POST',body:{username:'nobody',password}})).status,429);
});
