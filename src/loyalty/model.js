export const MONTH_PERIODS = ['Beginning · 1–10', 'Middle · 11–20', 'End · 21–month end'];
export const DAY_TYPES = ['Weekday · Mon–Thu', 'Weekend · Fri–Sun'];
export const TIME_SLOTS = ['Before 12:00', '12:00–14:59', '15:00–17:59', '18:00–20:59', '21:00 onward'];
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
  return TIME_SLOTS[hour < 12 ? 0 : hour < 15 ? 1 : hour < 18 ? 2 : hour < 21 ? 3 : 4];
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
export function preference(visits, field) {
  if (!visits.length) return 'Pending history';
  const counts = new Map();
  visits.forEach(v => counts.set(v[field], (counts.get(v[field]) || 0) + 1));
  const max = Math.max(...counts.values());
  return [...counts].filter(([,n]) => n === max).map(([label]) => label).join(' / ');
}
export function guestSummary(guest, now = new Date()) {
  const visits = normalizeVisits(guest.visits, now);
  const latest = visits[0] || null, previous = visits[1] || null;
  const gapDays = latest && previous ? Math.round((Date.parse(latest.date) - Date.parse(previous.date)) / 86400000) : null;
  const daysSinceVisit = latest ? Math.round((Date.parse(berlinToday(now)) - Date.parse(latest.date)) / 86400000) : null;
  return { ...guest, visits, latest, previous, gapDays, daysSinceVisit,
    period: preference(visits, 'period'), dayType: preference(visits, 'dayType'), slot: preference(visits, 'slot') };
}
