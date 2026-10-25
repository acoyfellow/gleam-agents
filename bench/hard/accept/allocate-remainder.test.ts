import { test } from "node:test";
import assert from "node:assert/strict";
import { allocate, money } from "../../src/core/money.ts";

const cents = (xs: { cents: number }[]) => xs.map((x) => x.cents);

test("allocate: parts sum exactly and leftovers go to largest remainders", () => {
  assert.deepEqual(cents(allocate(money(100), [1, 1, 1])), [34, 33, 33]);
  assert.deepEqual(cents(allocate(money(5), [3, 7])), [2, 3]);
  assert.deepEqual(cents(allocate(money(10), [1, 2, 3])), [2, 3, 5]);
  assert.deepEqual(cents(allocate(money(1), [1, 1])), [1, 0]);
  assert.deepEqual(cents(allocate(money(7), [0, 1, 1])), [0, 4, 3]);
  const parts = allocate(money(99999, "EUR"), [3, 5, 11, 13]);
  assert.equal(parts.reduce((s, p) => s + p.cents, 0), 99999);
  assert.ok(parts.every((p) => p.currency === "EUR"));
});

test("allocate: negative amounts mirror positive ones", () => {
  assert.deepEqual(cents(allocate(money(-100), [1, 1, 1])), [-34, -33, -33]);
  assert.deepEqual(cents(allocate(money(-5), [3, 7])), [-2, -3]);
});

test("allocate: bad weights throw a RangeError", () => {
  assert.throws(() => allocate(money(10), []), RangeError);
  assert.throws(() => allocate(money(10), [1, -1, 2]), RangeError);
  assert.throws(() => allocate(money(10), [0, 0]), RangeError);
});
