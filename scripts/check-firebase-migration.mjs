import assert from 'node:assert/strict';
const expected = 'https://wwidrvwkfltwrexzxvyl.supabase.co/functions/v1/dashboard-api';
assert.equal(process.env.VITE_DASHBOARD_API_URL, expected, 'Set VITE_DASHBOARD_API_URL to the approved Supabase API before building Firebase');
for (const [path, status] of [['/health', 200], ['/api/salary', 401], ['/api/salary-payments', 401]]) {
  const response = await fetch(expected + path, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, status, `${path}: unexpected API status`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
}
console.log('Supabase API is healthy and protected. Firebase deployment checks passed.');
