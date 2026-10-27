export const MONTH_PERIODS = ['Beginning · 1–10', 'Middle · 11–20', 'End · 21–month end'];
export const DAY_TYPES = ['Weekday · Mon–Thu', 'Weekend · Fri–Sun'];
export const TIME_SLOTS = ['12:00–14:59', '15:00–17:59', '18:00–20:59', '21:00 onward'];
// Inclusive boundary in the staff terminal's displayed date and time.
export const TRACKING_START = '2026-10-10T12:33';
const completedStatuses = new Set(['scanned', 'completed', 'seated', 'finished', 'paid', 'left', 'abgeschlossen', 'platziert']);
export function visitPeriod(date) {
  const day = Number(date.slice(8, 10));
  return MONTH_PERIODS[day <= 10 ? 0 : day <= 20 ? 1 : 2];
}
export function visitDayType(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return DAY_TYPES[day === 0 || day >= 5 ? 1 : 0];
}
export function visitSlot(time) {
  if (!/^\d{2}:\d{2}$/.test(time || '')) return 'Time unknown';
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return 'Time needs verification';
  return TIME_SLOTS[hour < 15 ? 0 : hour < 18 ? 1 : hour < 21 ? 2 : 3];
}
export function berlinToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function normalizeVisits(visits = [], now = new Date()) {
  const today = berlinToday(now);
  const seen = new Set();
  return visits.filter(v => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date || '')) return false;
    const parsed = new Date(`${v.date}T12:00:00Z`);
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== v.date || v.date > today) return false;
    if (!completedStatuses.has(String(v.status || '').trim().toLowerCase())) return false;
    if (v.time != null && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time))) return false;
    if (`${v.date}T${v.time || '00:00'}` < TRACKING_START) return false;
    const key = v.id || `${v.date}::${v.time || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(v => ({ ...v, period: visitPeriod(v.date), dayType: visitDayType(v.date), slot: visitSlot(v.time) }))
    .sort((a,b) => `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`));
}
export function distribution(visits, field, labels) {
  return labels.map(label => ({ label, count: visits.filter(v => v[field] === label).length }));
}
// Choose the first eligible scan before applying report filters, so a later
// repeat cannot become another counted visit in a different week or time slot.
export function monthlyVisits(visits = []) {
  const months = new Map();
  for (const visit of visits) {
    const month = visit.date.slice(0, 7), first = months.get(month);
    if (!first || `${visit.date}T${visit.time || '00:00'}` < `${first.date}T${first.time || '00:00'}`) months.set(month, visit);
  }
  return [...months.values()].sort((a,b) => a.date.localeCompare(b.date));
}
export function matchesVisitFilters(visit, {month = '', period = '', dayType = '', slot = ''} = {}) {
  return (!month || visit.date.startsWith(month)) && (!period || visit.period === period)
    && (!dayType || visit.dayType === dayType) && (!slot || visit.slot === slot);
}
export function preference(visits, field) {
  if (!visits.length) return 'Pending history';
  const counts = new Map();
  visits.forEach(v => counts.set(v[field], (counts.get(v[field]) || 0) + 1));
  const max = Math.max(...counts.values());
  return [...counts].filter(([,n]) => n === max).map(([label]) => label).join(' / ');
}
export function guestSummary(guest, now = new Date()) {
  const visits = normalizeVisits(guest.visits, now);
  const countedVisits = monthlyVisits(visits);
  const latest = visits[0] || null, previousScan = visits[1] || null;
  // Scan cutoff defines this report's loyalty cohort, not OpenTable history.
  const previous = previousOpenTableVisit(guest, latest);
  const gapDays = latest && previous ? Math.round((Date.parse(latest.date) - Date.parse(previous.date)) / 86400000) : null;
  const daysSinceVisit = latest ? Math.round((Date.parse(berlinToday(now)) - Date.parse(latest.date)) / 86400000) : null;
  return { ...guest, visits, countedVisits, latest, previousScan, previous, gapDays, daysSinceVisit,
    period: preference(countedVisits, 'period'), dayType: preference(countedVisits, 'dayType'), slot: preference(countedVisits, 'slot') };
}
export function previousOpenTableVisit(guest, latestScan) {
  const history = guest.openTableHistory;
  if (!latestScan || !history || history.matchedPassCode !== guest.passCode) return null;
  return (history.visits || []).filter(v => {
    if (!['finished', 'completed'].includes(String(v.status || '').toLowerCase())) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date || '') || v.date >= latestScan.date) return false;
    const date = new Date(`${v.date}T12:00:00Z`);
    return Number.isFinite(+date) && date.toISOString().slice(0,10) === v.date
      && (v.time == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time));
  }).sort((a,b) => `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`))[0] || null;
}
