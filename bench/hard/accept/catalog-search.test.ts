import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCatalog, searchCatalog } from "../../src/catalog.ts";

const catalog = parseCatalog(["T2,Iced tea,3", "T1,Green tea,4", "C1,Café au lait,5", "C2,Cafe crème,6", "P1,Teapot (blue),30", "P0,Tea pot,25"].join("\n"));
const skus = (q: string) => searchCatalog(catalog, q).map((p) => p.sku);

test("search: case and accents ignored", () => {
  assert.deepEqual(skus("cafe"), ["C1", "C2"]);
  assert.deepEqual(skus("CRÈME"), ["C2"]);
});

test("search: every word, any order, sorted by position then name then sku", () => {
  assert.deepEqual(skus("tea"), ["P0", "P1", "T2", "T1"]);
  assert.deepEqual(skus("tea green"), ["T1"]);
  assert.deepEqual(skus("pot tea"), ["P1", "P0"]);
});

test("search: empty query", () => {
  assert.deepEqual(skus(""), []);
  assert.deepEqual(skus("   "), []);
});
