import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../src/core/money.ts";
import { taxIncluded } from "../../src/tax.ts";

test("tax included: splits the tax back out", () => {
  assert.deepEqual(taxIncluded(money(10725), "CA"), money(725));
  assert.deepEqual(taxIncluded(money(10400), "NY"), money(400));
  assert.deepEqual(taxIncluded(money(999), "TX"), money(59));
  assert.deepEqual(taxIncluded(money(1), "CA"), money(0));
});

test("tax included: zero rate and unknown region", () => {
  assert.deepEqual(taxIncluded(money(5000), "OR"), money(0));
  assert.throws(() => taxIncluded(money(5000), "ZZ"), RangeError);
});
