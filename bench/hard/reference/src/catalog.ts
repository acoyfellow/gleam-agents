import type { Money } from "./core/money.ts";
import { parse } from "./core/money.ts";

/** One product the shop sells. */
export interface Product {
  readonly sku: string;
  readonly name: string;
  readonly price: Money;
}

/**
 * A catalog read from lines "SKU,Name,12.34", prices in `currency`. Blank lines and lines starting with # are
 * skipped. Throws a SyntaxError for a line without three fields or with a price that does not parse, and an Error
 * for a SKU listed twice.
 */
export function parseCatalog(text: string, currency: string = "USD"): Map<string, Product> {
  const out = new Map<string, Product>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const fields = line.split(",").map((f) => f.trim());
    const [sku, name, price] = fields;
    if (fields.length !== 3 || !sku || !name || !price) throw new SyntaxError(`catalog: "${line}" is not SKU,Name,price`);
    if (out.has(sku)) throw new Error(`catalog: ${sku} is listed twice`);
    out.set(sku, { sku, name, price: parse(price, currency) });
  }
  return out;
}

/** The product with `sku`. Throws a RangeError when the catalog has none. */
export function product(catalog: ReadonlyMap<string, Product>, sku: string): Product {
  const found = catalog.get(sku);
  if (!found) throw new RangeError(`catalog: no product ${sku}`);
  return found;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function searchCatalog(catalog: ReadonlyMap<string, Product>, query: string): Product[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits = [...catalog.values()].filter((p) => words.every((w) => fold(p.name).includes(w)));
  return hits.sort((x, y) => fold(x.name).indexOf(words[0]) - fold(y.name).indexOf(words[0]) || (fold(x.name) < fold(y.name) ? -1 : fold(x.name) > fold(y.name) ? 1 : 0) || (x.sku < y.sku ? -1 : x.sku > y.sku ? 1 : 0));
}
