import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../src/core/money.ts";
import { installments } from "../../src/installments.ts";

const c = (rows: { payment: { cents: number } }[]) => rows.map((r) => r.payment.cents);

test("installments: zero interest splits evenly, last takes the rest", () => {
  const rows = installments(money(1000), 3, 0);
  assert.deepEqual(c(rows), [333, 333, 334]);
  assert.deepEqual(rows.map((r) => r.balance.cents), [667, 334, 0]);
  assert.ok(rows.every((r) => r.interest.cents === 0));
});

test("installments: amortized with interest", () => {
  const rows = installments(money(100000), 12, 12);
  assert.equal(rows[0].payment.cents, 8885);
  assert.equal(rows[0].interest.cents, 1000);
  assert.equal(rows[0].principal.cents, 7885);
  assert.equal(rows.at(-1)?.balance.cents, 0);
  assert.equal(rows.reduce((s, r) => s + r.principal.cents, 0), 100000);
  assert.ok(rows.every((r) => r.payment.cents === r.principal.cents + r.interest.cents));
  assert.equal(rows.at(-1)?.payment.cents, 8884);
});

test("installments: bad input", () => {
  assert.throws(() => installments(money(1000), 0, 5), RangeError);
  assert.throws(() => installments(money(1000), 361, 5), RangeError);
  assert.throws(() => installments(money(1000), 2.5, 5), RangeError);
  assert.throws(() => installments(money(1000), 3, -1), RangeError);
  assert.throws(() => installments(money(0), 3, 5), RangeError);
});
