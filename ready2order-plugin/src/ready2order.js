const DEFAULT_API_BASE_URL = "https://api.ready2order.com/v1";
const PAGE_SIZE = 255;
const MAX_PAGES = 40;

export class Ready2OrderError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "Ready2OrderError";
    this.status = status;
  }
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isLiveInvoice(invoice) {
  return !invoice?.invoice_testMode && !invoice?.invoice_deleted_at;
}

function timestampDate(timestamp) {
  const match = String(timestamp ?? "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "unknown";
}

function assertDateRange(dateFrom, dateTo) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dateFrom) || !datePattern.test(dateTo)) {
    throw new Ready2OrderError("Dates must use YYYY-MM-DD format.", 400);
  }

  const from = new Date(`${dateFrom}T00:00:00Z`);
  const to = new Date(`${dateTo}T00:00:00Z`);
  if (to < from) {
    throw new Ready2OrderError("date_to must be on or after date_from.", 400);
  }

  const days = Math.floor((to - from) / 86_400_000) + 1;
  if (days > 366) {
    throw new Ready2OrderError("A single statistics request may cover at most 366 days.", 400);
  }
}

async function apiRequest(path, accountToken, query = {}) {
  const baseUrl = process.env.READY2ORDER_API_BASE_URL || DEFAULT_API_BASE_URL;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accountToken}`,
      },
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new Ready2OrderError(`ready2order could not be reached: ${error.message}`, 502);
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    const safeMessage = message.slice(0, 300).replace(/[\r\n]+/g, " ");
    throw new Ready2OrderError(
      `ready2order returned HTTP ${response.status}${safeMessage ? `: ${safeMessage}` : ""}`,
      response.status,
    );
  }

  return response.json();
}

export async function listInvoices(accountToken, {
  dateFrom,
  dateTo,
  items = false,
  payments = false,
} = {}) {
  assertDateRange(dateFrom, dateTo);

  const invoices = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = await apiRequest("document/invoice", accountToken, {
      offset,
      limit: PAGE_SIZE,
      dateField: "bill",
      dateFrom,
      dateTo,
      testMode: false,
      items,
      payments,
    });

    const batch = Array.isArray(payload) ? payload : payload?.invoices;
    if (!Array.isArray(batch)) {
      throw new Ready2OrderError("ready2order returned an unexpected invoice response.", 502);
    }

    invoices.push(...batch.filter(isLiveInvoice));
    const total = number(payload?.count);
    offset += batch.length;

    if (batch.length < PAGE_SIZE || (total > 0 && offset >= total)) {
      break;
    }
  }

  return invoices;
}

export function summarizeInvoices(invoices, dateFrom, dateTo) {
  const grossSales = invoices.reduce((sum, invoice) => sum + number(invoice.invoice_total), 0);
  const netSales = invoices.reduce((sum, invoice) => sum + number(invoice.invoice_totalNet), 0);
  const vat = invoices.reduce((sum, invoice) => sum + number(invoice.invoice_totalVat), 0);
  const tips = invoices.reduce((sum, invoice) => sum + number(invoice.invoice_totalTip), 0);
  const billCount = invoices.length;

  return {
    date_from: dateFrom,
    date_to: dateTo,
    currency: "EUR",
    gross_sales: round(grossSales),
    net_sales: round(netSales),
    vat: round(vat),
    tips: round(tips),
    bill_count: billCount,
    average_bill: round(billCount ? grossSales / billCount : 0),
  };
}

export function dailySales(invoices, dateFrom, dateTo) {
  const daily = new Map();
  for (const invoice of invoices) {
    const date = timestampDate(invoice.invoice_timestamp);
    const current = daily.get(date) || { date, gross_sales: 0, tips: 0, bill_count: 0 };
    current.gross_sales += number(invoice.invoice_total);
    current.tips += number(invoice.invoice_totalTip);
    current.bill_count += 1;
    daily.set(date, current);
  }

  return {
    date_from: dateFrom,
    date_to: dateTo,
    currency: "EUR",
    days: [...daily.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        ...day,
        gross_sales: round(day.gross_sales),
        tips: round(day.tips),
        average_bill: round(day.bill_count ? day.gross_sales / day.bill_count : 0),
      })),
  };
}

function invoiceItems(invoices) {
  return invoices.flatMap((invoice) => Array.isArray(invoice.items) ? invoice.items : []);
}

export function topProducts(invoices, limit = 10) {
  const products = new Map();
  for (const item of invoiceItems(invoices)) {
    const id = String(item.product_id ?? item.item_name ?? "unknown");
    const current = products.get(id) || {
      product_id: item.product_id ?? null,
      product_name: item.item_name || "Unknown product",
      category: item.productgroup_name || "Uncategorized",
      quantity: 0,
      gross_sales: 0,
    };
    const quantity = number(item.item_quantity ?? item.item_qty);
    current.quantity += item.item_retour ? -Math.abs(quantity) : quantity;
    current.gross_sales += number(item.item_total);
    products.set(id, current);
  }

  return [...products.values()]
    .map((product) => ({
      ...product,
      quantity: round(product.quantity),
      gross_sales: round(product.gross_sales),
    }))
    .sort((a, b) => b.quantity - a.quantity || b.gross_sales - a.gross_sales)
    .slice(0, limit);
}

export function categorySales(invoices) {
  const categories = new Map();
  for (const item of invoiceItems(invoices)) {
    const category = item.productgroup_name || "Uncategorized";
    const current = categories.get(category) || {
      category,
      quantity: 0,
      gross_sales: 0,
    };
    const quantity = number(item.item_quantity ?? item.item_qty);
    current.quantity += item.item_retour ? -Math.abs(quantity) : quantity;
    current.gross_sales += number(item.item_total);
    categories.set(category, current);
  }

  return [...categories.values()]
    .map((category) => ({
      ...category,
      quantity: round(category.quantity),
      gross_sales: round(category.gross_sales),
    }))
    .sort((a, b) => b.gross_sales - a.gross_sales);
}

export function paymentBreakdown(invoices) {
  const methods = new Map();
  for (const invoice of invoices) {
    const payments = Array.isArray(invoice.payment)
      ? invoice.payment
      : Array.isArray(invoice.payments)
        ? invoice.payments
        : [];

    if (!payments.length) {
      const name = `Payment method ${invoice.paymentMethod_id ?? "unknown"}`;
      methods.set(name, (methods.get(name) || 0) + number(invoice.invoice_total));
      continue;
    }

    for (const payment of payments) {
      const name = payment.billPayment_name || "Unknown payment method";
      methods.set(name, (methods.get(name) || 0) + number(payment.billPayment_value));
    }
  }

  return [...methods.entries()]
    .map(([payment_method, gross_sales]) => ({ payment_method, gross_sales: round(gross_sales) }))
    .sort((a, b) => b.gross_sales - a.gross_sales);
}

export function staffSales(invoices) {
  const staff = new Map();
  for (const invoice of invoices) {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (!items.length) {
      const name = `User ${invoice.user_id ?? "unknown"}`;
      const current = staff.get(name) || { staff_member: name, gross_sales: 0, quantity: 0 };
      current.gross_sales += number(invoice.invoice_total);
      staff.set(name, current);
      continue;
    }

    for (const item of items) {
      const name = item.user_name || `User ${item.user_id ?? invoice.user_id ?? "unknown"}`;
      const current = staff.get(name) || { staff_member: name, gross_sales: 0, quantity: 0 };
      const quantity = number(item.item_quantity ?? item.item_qty);
      current.quantity += item.item_retour ? -Math.abs(quantity) : quantity;
      current.gross_sales += number(item.item_total);
      staff.set(name, current);
    }
  }

  return [...staff.values()]
    .map((member) => ({
      ...member,
      gross_sales: round(member.gross_sales),
      quantity: round(member.quantity),
    }))
    .sort((a, b) => b.gross_sales - a.gross_sales);
}

export function percentageChange(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return round(((current - previous) / previous) * 100);
}
