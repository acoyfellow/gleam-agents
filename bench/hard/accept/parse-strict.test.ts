import { test } from "node:test";
import assert from "node:assert/strict";
import { money, parse } from "../../src/core/money.ts";
import { parseCatalog } from "../../src/catalog.ts";

test("parse: what worked before still works", () => {
  assert.deepEqual(parse("12.34"), money(1234));
  assert.deepEqual(parse("-0.5"), money(-50));
  assert.deepEqual(parse("7", "EUR"), money(700, "EUR"));
  assert.deepEqual(parse("  3.10 "), money(310));
});

test("parse: plus sign and thousands groups", () => {
  assert.deepEqual(parse("+4.20"), money(420));
  assert.deepEqual(parse("1,234.50"), money(123450));
  assert.deepEqual(parse("12,345,678"), money(1234567800));
  assert.deepEqual(parse("-1,000"), money(-100000));
});

test("parse: strict rejections", () => {
  for (const bad of ["", "   ", "1,23.00", "1,2345", ".5", "5.", "1e3", "--1", "1.234", "1 000", "12 .5", "+-1", ",123", "1,,234"]) {
    assert.throws(() => parse(bad), SyntaxError, `should reject ${JSON.stringify(bad)}`);
  }
});

test("parse: negative zero is plain zero", () => {
  assert.equal(Object.is(parse("-0").cents, 0), true);
  assert.equal(Object.is(parse("-0.00").cents, 0), true);
});

test("parse: catalogs still load", () => {
  const c = parseCatalog("A,Apple,1.50\nB,Bread,2");
  assert.deepEqual(c.get("A")?.price, money(150));
});
