import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../src/core/money.ts";
import { creditLines } from "../../src/credit.ts";
import { three } from "./fixtures.ts";

test("credit: every line refunds exactly the total", () => {
  const inv = three();
  assert.deepEqual(creditLines(inv, ["TEA", "POT", "CUP"]), inv.total);
});

test("credit: one line gets its share of discount and tax, no shipping", () => {
  const inv = three();
  const tea = creditLines(inv, ["TEA"]);
  assert.ok(tea.cents > 0 && tea.cents < inv.total.cents);
  assert.deepEqual(tea, money(869));
  assert.deepEqual(creditLines(inv, ["POT"]), money(2895));
});

test("credit: unknown sku throws naming it", () => {
  assert.throws(() => creditLines(three(), ["NOPE"]), (e: unknown) => e instanceof RangeError && /NOPE/.test(String((e as Error).message)));
});
