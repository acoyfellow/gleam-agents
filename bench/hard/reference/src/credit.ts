import type { Money } from "./core/money.ts";
import { money, percentOf } from "./core/money.ts";
import type { Invoice } from "./invoice.ts";
import { TAX_RATES } from "./tax.ts";

export function creditLines(invoice: Invoice, skus: string[]): Money {
  for (const sku of skus) if (!invoice.lines.some((l) => l.sku === sku)) throw new RangeError(`credit: no line ${sku}`);
  const chosen = new Set(skus);
  if (invoice.lines.every((l) => chosen.has(l.sku))) return invoice.total;
  const idx = invoice.lines.map((l, i) => (chosen.has(l.sku) ? i : -1)).filter((i) => i >= 0);
  const net = idx.reduce((s, i) => s + invoice.discountedLines[i].cents, 0);
  const tax = percentOf(money(net, invoice.currency), TAX_RATES[invoice.region] ?? 0).cents;
  return money(net + tax, invoice.currency);
}
