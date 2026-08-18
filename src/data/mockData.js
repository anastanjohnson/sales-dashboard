// Deterministic mock sales data for the restaurant analytics dashboard.

const DAYS = [
    "Apr 06",
    "Apr 07",
    "Apr 08",
    "Apr 09",
    "Apr 10",
    "Apr 11",
    "Apr 12",
    "Apr 13",
  ];

export const salesByDay = [
  { day: DAYS[0], sales: 3820, orders: 236 },
  { day: DAYS[1], sales: 2410, orders: 188 },
  { day: DAYS[2], sales: 3390, orders: 402 },
  { day: DAYS[3], sales: 2860, orders: 210 },
  { day: DAYS[4], sales: 1920, orders: 150 },
  { day: DAYS[5], sales: 2540, orders: 194 },
  { day: DAYS[6], sales: 4180, orders: 260 },
  { day: DAYS[7], sales: 3130, orders: 205 },
  ];

export const stats = {
    totalSales: { value: 23550, deltaPct: 12.5, direction: "up" },
    orders: { value: 1432, deltaPct: 8.2, direction: "up" },
    avgOrder: { value: 35.45, deltaPct: -2.3, direction: "down" },
};

export const categoryBreakdown = [
  { name: "Mains", value: 9820 },
  { name: "Beverages", value: 5310 },
  { name: "Starters", value: 3980 },
  { name: "Desserts", value: 2640 },
  { name: "Sides", value: 1800 },
  ];

export const topItems = [
  { name: "Grilled Salmon", orders: 214, revenue: 5136 },
  { name: "Truffle Pasta", orders: 189, revenue: 4158 },
  { name: "Classic Burger", orders: 302, revenue: 3624 },
  { name: "Caesar Salad", orders: 176, revenue: 1936 },
  { name: "House Lemonade", orders: 401, revenue: 1604 },
  ];

export const dateRangeLabel = "Apr 06, 2025 – Apr 13, 2025";
