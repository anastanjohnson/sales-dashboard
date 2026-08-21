export const repeatGuestData = {
  yearlyRepeatCounts: {
    "2025": { threeOrMore: 110, fiveOrMore: 23, tenOrMore: 3, totalGuests: 3427 },
    "2026": { threeOrMore: 39, fiveOrMore: 6, tenOrMore: 1, totalGuests: 1538 },
  },
  note2026: "2026 figures are partial-year, through mid-August.",
  visitorTypeSplit: [
    { name: "One-time visitors", value: 84.9 },
    { name: "Repeat visitors", value: 15.1 },
  ],
  visitorTypeSplitByYear: {
    "2025": [
      { name: "One-time visitors", value: 81.8 },
      { name: "Repeat visitors", value: 18.2 },
    ],
    "2026": [
      { name: "One-time visitors", value: 72.9 },
      { name: "Repeat visitors", value: 27.1 },
    ],
  },
  oneTimeVisitorByYear: {
    "2025": { oneTimeGuests: 2804, totalGuests: 3427, pct: 81.8 },
    "2026": { oneTimeGuests: 1121, totalGuests: 1538, pct: 72.9 },
  },
  gapBucketPercentages: [
    { name: "Within 30 days", value: 20.6 },
    { name: "31-60 days", value: 13.0 },
    { name: "61-90 days", value: 14.4 },
    { name: "91-180 days", value: 25.8 },
    { name: "180+ days", value: 26.2 },
  ],
  gapBucketPercentagesByYear: {
    "2025": [
      { name: "Within 30 days", value: 25.7 },
      { name: "31-60 days", value: 14.2 },
      { name: "61-90 days", value: 17.3 },
      { name: "91-180 days", value: 27.2 },
      { name: "180+ days", value: 15.6 },
    ],
    "2026": [
      { name: "Within 30 days", value: 15.0 },
      { name: "31-60 days", value: 11.6 },
      { name: "61-90 days", value: 11.3 },
      { name: "91-180 days", value: 24.3 },
      { name: "180+ days", value: 37.7 },
    ],
  },
  visitGapStats: { medianDays: 95, meanDays: 130.8, totalReturnVisitsAnalyzed: 1173, totalGuestsAnalyzed: 4627 },
  visitGapStatsByYear: {
    "2025": { medianDays: 78, meanDays: 97.1, totalReturnVisitsAnalyzed: 614 },
    "2026": { medianDays: 128, meanDays: 167.7, totalReturnVisitsAnalyzed: 559 },
  },
  totalTrackedGuests: 4627,
};

export const repeatGuestLists = {
  "2025": {
    fiveToNine: [
      { name: "Michael Mailänder", lastVisit: "2026-07-05", totalVisits: 8 },
      { name: "Klaus-jürgen Wrede", lastVisit: "2026-07-03", totalVisits: 8 },
      { name: "Sebastian Hoffmann", lastVisit: "2026-08-08", totalVisits: 7 },
      { name: "Veer Singh", lastVisit: "2026-06-20", totalVisits: 7 },
      { name: "Sonja Grützenbach", lastVisit: "2026-08-08", totalVisits: 6 },
      { name: "Karolina Bernhardt", lastVisit: "2026-07-10", totalVisits: 6 },
      { name: "Christiane Mehling", lastVisit: "2026-03-22", totalVisits: 6 },
      { name: "Holger Mengel", lastVisit: "2026-03-21", totalVisits: 6 },
      { name: "Enzo Rosin", lastVisit: "2025-12-26", totalVisits: 6 },
      { name: "Lorena Knoke", lastVisit: "2025-10-11", totalVisits: 6 },
      { name: "Ali Aslan", lastVisit: "2026-08-16", totalVisits: 5 },
      { name: "Lidija Lihovic", lastVisit: "2026-07-19", totalVisits: 5 },
      { name: "Sascha Pelkner", lastVisit: "2026-07-03", totalVisits: 5 },
      { name: "Sangetha Thameskumar", lastVisit: "2026-06-14", totalVisits: 5 },
      { name: "Dominik Braunsteiner", lastVisit: "2026-04-27", totalVisits: 5 },
      { name: "Andrea Becker", lastVisit: "2026-04-23", totalVisits: 5 },
      { name: "Katrin Dohrmann", lastVisit: "2026-03-22", totalVisits: 5 },
      { name: "Sabine Gasch", lastVisit: "2026-03-19", totalVisits: 5 },
      { name: "Yash Jan", lastVisit: "2025-12-13", totalVisits: 5 },
      { name: "Teena Hassan", lastVisit: "2025-11-23", totalVisits: 5 },
    ],
    tenOrMore: [
      { name: "Sebastian Ehrenstein", lastVisit: "2026-05-08", totalVisits: 13 },
      { name: "Steffi Brüggen", lastVisit: "2026-07-10", totalVisits: 12 },
      { name: "Kerstin Çebe", lastVisit: "2026-03-21", totalVisits: 10 },
    ],
  },
  "2026": {
    fiveToNine: [
      { name: "Pradeep Kumar", lastVisit: "2026-08-15", totalVisits: 6 },
      { name: "Balakarthik Palani", lastVisit: "2026-07-11", totalVisits: 6 },
      { name: "Guido Heymann", lastVisit: "2026-08-06", totalVisits: 5 },
      { name: "Stephy Stani", lastVisit: "2026-07-25", totalVisits: 5 },
      { name: "Veer Singh", lastVisit: "2026-06-20", totalVisits: 5 },
    ],
    tenOrMore: [
      { name: "Sebastian Hoffmann", lastVisit: "2026-08-08", totalVisits: 13 },
    ],
  },
};
