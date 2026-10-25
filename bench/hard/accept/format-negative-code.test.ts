import { test } from "node:test";
import assert from "node:assert/strict";
import { MINOR_UNITS, format, money } from "../../src/core/money.ts";

test("format: negative amounts in a code-only currency", () => {
  assert.equal(format(money(-1234, "CHF")), "-12.34 CHF");
  assert.equal(format(money(1234, "CHF")), "12.34 CHF");
  assert.equal(format(money(-5, "CHF")), "-0.05 CHF");
});

test("format: zero-decimal currencies", () => {
  assert.equal(MINOR_UNITS.JPY, 0);
  assert.equal(MINOR_UNITS.KRW, 0);
  assert.equal(format(money(1234, "JPY")), "1234 JPY");
  assert.equal(format(money(-5, "JPY")), "-5 JPY");
  assert.equal(format(money(0, "KRW")), "0 KRW");
  assert.equal(format(money(1234, "JPY"), false), "1234");
});

test("format: USD, EUR and GBP unchanged", () => {
  assert.equal(format(money(1234)), "$12.34");
  assert.equal(format(money(-50)), "-$0.50");
  assert.equal(format(money(300, "EUR")), "€3.00");
  assert.equal(format(money(1, "GBP")), "£0.01");
  assert.equal(format(money(-1234), false), "-12.34");
});
