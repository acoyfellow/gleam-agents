import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../src/core/money.ts";
import { shippingByWeight } from "../../src/shipping.ts";

test("weight: bands of 500 g", () => {
  assert.deepEqual(shippingByWeight(0, "CA"), money(599));
  assert.deepEqual(shippingByWeight(500, "CA"), money(599));
  assert.deepEqual(shippingByWeight(501, "CA"), money(849));
  assert.deepEqual(shippingByWeight(1000, "NY"), money(949));
  assert.deepEqual(shippingByWeight(1001, "NY"), money(1199));
  assert.deepEqual(shippingByWeight(2600, "TX", "EUR"), money(1899, "EUR"));
});

test("weight: bad input", () => {
  assert.throws(() => shippingByWeight(-1, "CA"), RangeError);
  assert.throws(() => shippingByWeight(1.5, "CA"), RangeError);
  assert.throws(() => shippingByWeight(100, "ZZ"), RangeError);
});
