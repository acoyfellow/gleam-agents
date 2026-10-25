import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../src/core/money.ts";
import { stackDiscounts } from "../../src/discount.ts";

test("stack: percents compound in order, then fixed", () => {
  assert.deepEqual(stackDiscounts(money(10000), [{ kind: "percent", percent: 10 }, { kind: "percent", percent: 10 }]), money(1900));
  assert.deepEqual(stackDiscounts(money(10000), [{ kind: "fixed", amount: money(500) }, { kind: "percent", percent: 10 }]), money(1500));
  assert.deepEqual(stackDiscounts(money(999), [{ kind: "percent", percent: 15 }]), money(150));
});

test("stack: capped at half, rounded down", () => {
  assert.deepEqual(stackDiscounts(money(10000), [{ kind: "percent", percent: 40 }, { kind: "percent", percent: 40 }]), money(5000));
  assert.deepEqual(stackDiscounts(money(999), [{ kind: "fixed", amount: money(900) }]), money(499));
  assert.deepEqual(stackDiscounts(money(1), [{ kind: "fixed", amount: money(5) }]), money(0));
});

test("stack: empty list is zero off", () => {
  assert.deepEqual(stackDiscounts(money(1234, "EUR"), []), money(0, "EUR"));
});
