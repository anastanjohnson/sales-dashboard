import test from "node:test";
import assert from "node:assert/strict";
import {
  categorySales,
  dailySales,
  paymentBreakdown,
  percentageChange,
  staffSales,
  summarizeInvoices,
  topProducts,
} from "../src/ready2order.js";

const invoices = [
  {
    invoice_timestamp: "2026-08-18 18:30:00",
    invoice_total: "120.00",
    invoice_totalNet: "100.00",
    invoice_totalVat: "20.00",
    invoice_totalTip: "10.00",
    user_id: 1,
    payment: [{ billPayment_name: "Cash", billPayment_value: "120.00" }],
    items: [
      { product_id: 1, item_name: "CHOZHA", productgroup_name: "Menus", item_quantity: 2, item_total: 110, user_name: "Anu" },
      { product_id: 2, item_name: "Spritz", productgroup_name: "Drinks", item_quantity: 2, item_total: 10, user_name: "Anu" },
    ],
  },
  {
    invoice_timestamp: "2026-08-19 19:00:00",
    invoice_total: 80,
    invoice_totalNet: 70,
    invoice_totalVat: 10,
    invoice_totalTip: 5,
    user_id: 2,
    payment: [{ billPayment_name: "Card", billPayment_value: 80 }],
    items: [
      { product_id: 1, item_name: "CHOZHA", productgroup_name: "Menus", item_quantity: 1, item_total: 55, user_name: "Kabilan" },
      { product_id: 3, item_name: "AYCE", productgroup_name: "Menus", item_quantity: 1, item_total: 25, user_name: "Kabilan" },
    ],
  },
];

test("summarizes invoices", () => {
  assert.deepEqual(summarizeInvoices(invoices, "2026-08-18", "2026-08-19"), {
    date_from: "2026-08-18",
    date_to: "2026-08-19",
    currency: "EUR",
    gross_sales: 200,
    net_sales: 170,
    vat: 30,
    tips: 15,
    bill_count: 2,
    average_bill: 100,
  });
});

test("builds daily, product, category, payment, and staff analytics", () => {
  assert.equal(dailySales(invoices, "2026-08-18", "2026-08-19").days.length, 2);
  assert.equal(topProducts(invoices, 1)[0].product_name, "CHOZHA");
  assert.equal(categorySales(invoices)[0].category, "Menus");
  assert.deepEqual(paymentBreakdown(invoices), [
    { payment_method: "Cash", gross_sales: 120 },
    { payment_method: "Card", gross_sales: 80 },
  ]);
  assert.equal(staffSales(invoices)[0].staff_member, "Anu");
});

test("calculates comparison percentages safely", () => {
  assert.equal(percentageChange(120, 100), 20);
  assert.equal(percentageChange(0, 0), 0);
  assert.equal(percentageChange(10, 0), null);
});
