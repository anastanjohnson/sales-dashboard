// Scan dates use the staff terminal's displayed calendar date.
const dateAt = date => new Date(`${date}T12:00:00Z`);
const iso = date => date.toISOString().slice(0, 10);
export function attendanceRange(date, view = 'month') {
  const start = dateAt(date), end = dateAt(date);
  if (view === 'week') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    end.setTime(+start); end.setUTCDate(end.getUTCDate() + 6);
  } else if (view === 'month') {
    start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0);
  }
  return { start: iso(start), end: iso(end) };
}
export function shiftAttendanceDate(date, view, direction) {
  const d = dateAt(date);
  if (view === 'month') { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + direction); }
  else d.setUTCDate(d.getUTCDate() + direction * (view === 'week' ? 7 : 1));
  return iso(d);
}
export function attendanceSummary(guests, date, view) {
  const range = attendanceRange(date, view), days = new Map(), guestsInPeriod = new Set();
  for (const d = dateAt(range.start); iso(d) <= range.end; d.setUTCDate(d.getUTCDate() + 1)) days.set(iso(d), { date: iso(d), guests: new Set(), scans: 0 });
  let scans = 0;
  for (const guest of guests) for (const visit of guest.visits) {
    const row = days.get(visit.date);
    if (!row) continue;
    row.guests.add(guest.passCode); row.scans++; scans++;
    guestsInPeriod.add(guest.passCode);
  }
  return { ...range, guests: guestsInPeriod.size, scans, days: [...days.values()].map(row => ({ ...row, guests: row.guests.size })) };
}
