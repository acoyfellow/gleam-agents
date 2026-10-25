import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../src/core/money.ts";
import { addToCart, emptyCart } from "../../src/cart.ts";
import { buildInvoice } from "../../src/invoice.ts";
import { salesReport } from "../../src/report.ts";

const usd = (n: string) => buildInvoice(n, addToCart(emptyCart(), { sku: "A", name: "A", price: money(1000) }), "OR");
const eur = (n: string) => buildInvoice(n, addToCart(emptyCart("EUR"), { sku: "B", name: "B", price: money(2000, "EUR") }), "OR");

test("report: one currency unchanged", () => {
  assert.equal(salesReport([usd("I1"), usd("I2")]), "I1 OR 15.99\nI2 OR 15.99\nTOTAL 31.98");
});

test("report: mixed currencies, blocks in first-seen order", () => {
  assert.equal(salesReport([eur("E1"), usd("U1"), eur("E2")]), "E1 OR 25.99\nE2 OR 25.99\nTOTAL EUR 51.98\n\nU1 OR 15.99\nTOTAL USD 15.99");
});

test("report: empty", () => {
  assert.equal(salesReport([]), "TOTAL 0.00");
});
