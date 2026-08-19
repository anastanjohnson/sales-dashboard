const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (date) => date.toISOString().slice(0, 10);

export const percentageChange = (current, previous) =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

export const getIsoWeekNumber = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  const isoDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - isoDay);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
};

export const getWeekRange = (year, weekNumber) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4IsoDay = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4IsoDay - 1) + (weekNumber - 1) * 7);

  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const followingMonday = new Date(thursday);
  followingMonday.setUTCDate(thursday.getUTCDate() + 4);

  return { startDate: toDateKey(thursday), endDate: toDateKey(followingMonday) };
};

export const getWeekTotals = (week) =>
  (week?.days || []).reduce(
    (totals, row) => ({
      current: totals.current + (Number(row.currentRevenue) || 0),
      comparison: totals.comparison + (Number(row.comparisonRevenue) || 0),
    }),
    { current: 0, comparison: 0 },
  );

export const buildWeekSlots = (weeklyData, reportingYear = 2026, count = 52) => {
  const weeksByNumber = new Map();

  weeklyData.forEach((week, index) => {
    const explicitNumber = Number(week.weekNumber);
    const derivedNumber = getIsoWeekNumber(week.startDate);
    const weekNumber = Number.isInteger(explicitNumber) && explicitNumber > 0
      ? explicitNumber
      : derivedNumber || index + 1;

    if (weekNumber >= 1 && weekNumber <= count && !weeksByNumber.has(weekNumber)) {
      weeksByNumber.set(weekNumber, week);
    }
  });

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const week = weeksByNumber.get(number) || null;
    const generatedRange = getWeekRange(reportingYear, number);
    const totals = getWeekTotals(week);
    const hasData = Boolean(week?.days?.length);

    return {
      number,
      label: `W${String(number).padStart(2, "0")}`,
      week,
      startDate: week?.startDate || generatedRange.startDate,
      endDate: week?.endDate || generatedRange.endDate,
      change: hasData ? percentageChange(totals.current, totals.comparison) : null,
      hasData,
    };
  });
};
