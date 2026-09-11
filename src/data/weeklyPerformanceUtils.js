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
      comparison: totals.comparison + (week?.partial && row.currentRevenue == null ? 0 : Number(row.comparisonRevenue) || 0),
    }),
    { current: 0, comparison: 0 },
  );

// Apply verified ledger days while retaining historical weeks and benchmarks.
export const mergeDailyRevenue = (weeklyData, benchmarkData, records) => {
  const merged = weeklyData.map((week) => ({ ...week, days: (week.days || []).map((day) => ({ ...day })) }));
  if (!records.length) return merged;
  const asOf = records.map((row) => row.date).sort().at(-1);
  const touched = new Set();
  for (const record of records) {
    const date = new Date(`${record.date}T12:00:00Z`);
    if (Number.isNaN(date.getTime()) || !Number.isFinite(record.revenue)) throw new Error("Invalid daily revenue record");
    // Monday belongs to the reporting week that began the preceding Thursday.
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 3) % 7));
    const startDate = toDateKey(date);
    const weekNumber = getIsoWeekNumber(startDate);
    const currentYear = date.getUTCFullYear();
    let week = merged.find((row) => row.startDate === startDate);
    if (!week) {
      const benchmark = (benchmarkData?.weeks || []).find((row) => row.startDate === startDate);
      const comparison = getWeekRange(currentYear - 1, weekNumber);
      const days = Array.from({ length: 5 }, (_, index) => {
        const currentDate = toDateKey(new Date(date.getTime() + index * DAY_MS));
        const previousDate = toDateKey(new Date(new Date(`${comparison.startDate}T12:00:00Z`).getTime() + index * DAY_MS));
        const previous = benchmark?.days?.find((row) => row.currentDate === currentDate);
        return { day: ["Thursday", "Friday", "Saturday", "Sunday", "Monday"][index], currentDate, comparisonDate: previous?.comparisonDate || previousDate, currentRevenue: null, comparisonRevenue: previous?.comparisonRevenue ?? null };
      });
      week = { ...benchmark, id: benchmark?.id || `${currentYear}-W${String(weekNumber).padStart(2, "0")}`, weekNumber, currentYear, comparisonYear: currentYear - 1, ...getWeekRange(currentYear, weekNumber), days };
      merged.push(week);
    }
    const day = week.days.find((row) => row.currentDate === record.date);
    if (!day) throw new Error(`Revenue date is outside the reporting window: ${record.date}`);
    day.currentRevenue = record.revenue;
    week.benchmarkOnly = false;
    touched.add(week);
  }
  for (const week of touched) {
    week.asOf = asOf < week.endDate ? asOf : week.endDate;
    week.partial = week.days.some((day) => day.currentRevenue == null);
    week.partialBenchmark = week.days.some((day) => day.comparisonRevenue == null);
  }
  return merged.sort((a, b) => a.startDate.localeCompare(b.startDate));
};

const getWeekNumber = (week) => Number(week?.weekNumber)
  || Number(String(week?.id || "").match(/W(\d{1,2})$/)?.[1])
  || getIsoWeekNumber(week?.startDate);

const toRevenueBenchmark = (week) => ({
  ...week,
  currentYear: 2026,
  comparisonYear: 2025,
  benchmarkOnly: true,
  partialBenchmark: week.days.some((row) => row.comparisonRevenue == null),
  days: week.days.map((row) => ({
    day: row.day,
    currentDate: row.currentDate,
    comparisonDate: row.comparisonDate,
    currentRevenue: null,
    comparisonRevenue: row.comparisonRevenue,
  })),
});

const toGuestBenchmark = (week) => ({
  ...week,
  available: false,
  benchmarkAvailable: true,
  currentCovers: null,
  comparisonCovers: week.days.reduce((sum, row) => sum + (Number(row.comparisonCovers) || 0), 0),
  difference: null,
  yoy: null,
  days: week.days.map((row) => ({
    day: row.day,
    currentDate: row.currentDate,
    comparisonDate: row.comparisonDate,
    currentCovers: null,
    comparisonCovers: row.comparisonCovers,
  })),
});

export const mergeDailyGuestRecords = (baseWeeks, updates, benchmarkData, records) => {
  const merged = baseWeeks.map((base) => {
    const update = updates.find((week) => week.id === base.id || Number(week.weekNumber) === Number(base.weekNumber));
    const week = update || base;
    return { ...week, days: (week.days || []).map((day) => ({ ...day })) };
  });
  updates.forEach((week) => {
    if (!merged.some((row) => row.id === week.id || Number(row.weekNumber) === Number(week.weekNumber))) merged.push({ ...week, days: (week.days || []).map((day) => ({ ...day })) });
  });
  const touched = new Set();
  const asOf = records.map((row) => row.date).sort().at(-1);
  for (const record of records) {
    if (![record.currentCovers, record.comparisonCovers].every((value) => Number.isInteger(value) && value >= 0)) throw new Error("Invalid daily cover count");
    const week = merged.find((row) => row.days.some((day) => day.currentDate === record.date));
    if (!week) throw new Error(`No reporting week for covers: ${record.date}`);
    const day = week.days.find((row) => row.currentDate === record.date);
    day.currentCovers = record.currentCovers;
    day.comparisonCovers = record.comparisonCovers;
    touched.add(week);
  }
  for (const week of touched) {
    const benchmark = (benchmarkData?.weeks || []).find((row) => Number(row.weekNumber) === Number(week.weekNumber));
    week.days.forEach((day) => {
      if (day.comparisonCovers == null) day.comparisonCovers = benchmark?.days?.find((row) => row.currentDate === day.currentDate)?.comparisonCovers ?? null;
    });
    const recorded = week.days.filter((day) => day.currentCovers != null);
    week.currentCovers = recorded.reduce((sum, day) => sum + day.currentCovers, 0);
    week.comparisonCovers = recorded.every((day) => day.comparisonCovers != null) ? recorded.reduce((sum, day) => sum + day.comparisonCovers, 0) : null;
    week.available = true;
    week.benchmarkAvailable = week.comparisonCovers != null;
    week.partial = recorded.length < week.days.length;
    week.asOf = asOf < week.endDate ? asOf : week.endDate;
    week.difference = week.comparisonCovers == null ? null : week.currentCovers - week.comparisonCovers;
    week.yoy = percentageChange(week.currentCovers, week.comparisonCovers);
  }
  return merged.sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber));
};

export const hasMatchingGuestDates = (guestWeek, revenueWeek) => {
  const dates = (rows, field) => (rows || []).filter((day) => day[field] != null).map((day) => day.currentDate).sort().join(",");
  const revenueDates = dates(revenueWeek?.days, "currentRevenue");
  return Boolean(guestWeek?.available && revenueDates && revenueDates === dates(guestWeek.days, "currentCovers"));
};

export const mergeWeeklyRevenueBenchmarks = (weeklyData, benchmarkData) => {
  const benchmarks = (benchmarkData?.weeks || []).map(toRevenueBenchmark);
  const existingWeeks = new Set(weeklyData.map(getWeekNumber));
  return [...weeklyData, ...benchmarks.filter((week) => !existingWeeks.has(getWeekNumber(week)))]
    .sort((a, b) => getWeekNumber(a) - getWeekNumber(b));
};

export const mergeWeeklyGuestBenchmarks = (weeklyData, benchmarkData) => {
  const benchmarks = new Map((benchmarkData?.weeks || []).map((week) => [getWeekNumber(week), toGuestBenchmark(week)]));
  return weeklyData.map((week) => {
    if (week.available) return week;
    return benchmarks.get(getWeekNumber(week)) || week;
  });
};

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
    const hasCurrentData = Boolean(week?.days?.some((row) => row.currentRevenue != null));
    const hasBenchmark = Boolean(week?.days?.some((row) => row.comparisonRevenue != null));
    const hasData = hasCurrentData || hasBenchmark;

    return {
      number,
      label: `W${String(number).padStart(2, "0")}`,
      week,
      startDate: week?.startDate || generatedRange.startDate,
      endDate: week?.endDate || generatedRange.endDate,
      change: hasCurrentData && hasBenchmark ? percentageChange(totals.current, totals.comparison) : null,
      hasCurrentData,
      hasBenchmark,
      hasData,
    };
  });
};
