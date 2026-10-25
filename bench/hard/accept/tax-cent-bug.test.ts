import { test } from "node:test";
import assert from "node:assert/strict";
import { money, percentOf } from "../../src/core/money.ts";
import { TAX_RATES, taxFor } from "../../src/tax.ts";

const exact = (cents: number, rate: number) => {
  const x = (cents * rate * 100) / 10000;
  return x < 0 ? -Math.round(-x) : Math.round(x);
};

test("tax: the cents that used to be short", () => {
  assert.deepEqual(percentOf(money(200), 7.25), money(15));
  assert.deepEqual(taxFor(money(3000), "CA"), money(218));
  assert.deepEqual(taxFor(money(6600), "CA"), money(479));
  assert.deepEqual(percentOf(money(-200), 7.25), money(-15));
});

test("tax: exact for every cent amount and every rate", () => {
  for (const rate of Object.values(TAX_RATES)) {
    for (let c = 0; c <= 20000; c++) assert.equal(percentOf(money(c), rate).cents, exact(c, rate), `${c} at ${rate}%`);
  }
  assert.deepEqual(percentOf(money(1000), 15), money(150));
});
