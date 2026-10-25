import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../src/core/money.ts";
import { addToCart, emptyCart } from "../../src/cart.ts";
import { buildInvoice } from "../../src/invoice.ts";
import { three } from "./fixtures.ts";

test("audit: discounted lines sum to subtotal less discount", () => {
  const inv = three();
  const total = inv.discountedLines.reduce((s, m) => s + m.cents, 0);
  assert.equal(total, inv.subtotal.cents - inv.discount.cents);
  assert.equal(inv.discountedLines.length, inv.lines.length);
});

test("audit: largest remainders, ties to the earlier line", () => {
  const inv = three();
  assert.deepEqual(inv.discountedLines, [money(810), money(2699), money(899)]);
  const even = buildInvoice("E", addToCart(addToCart(addToCart(emptyCart(), { sku: "X", name: "X", price: money(100) }), { sku: "Y", name: "Y", price: money(100) }), { sku: "Z", name: "Z", price: money(100) }), "OR", { kind: "fixed", amount: money(100) });
  assert.deepEqual(even.discountedLines, [money(66), money(67), money(67)]);
});

test("audit: no discount means lines unchanged", () => {
  const inv = buildInvoice("N", addToCart(emptyCart(), { sku: "X", name: "X", price: money(250) }, 2), "OR");
  assert.deepEqual(inv.discountedLines, [money(500)]);
});
