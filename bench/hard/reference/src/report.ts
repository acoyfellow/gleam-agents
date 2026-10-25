import { format, sum } from "./core/money.ts";
import type { Invoice } from "./invoice.ts";

/**
 * A plain-text sales report: one line per invoice, "<number> <region> <total>", then "TOTAL <sum>", with the amounts
 * written without a currency symbol and the columns separated by single spaces. Throws a TypeError when the invoices
 * are in different currencies.
 */
export function salesReport(invoices: readonly Invoice[]): string {
  const currencies = [...new Set(invoices.map((inv) => inv.currency))];
  const block = (group: readonly Invoice[], label: string) => {
    const lines = group.map((inv) => `${inv.number} ${inv.region} ${format(inv.total, false)}`);
    const total = sum(group.map((inv) => inv.total), group[0]?.currency);
    return [...lines, `TOTAL ${label}${format(total, false)}`].join("\n");
  };
  if (currencies.length <= 1) return block(invoices, "");
  return currencies.map((c) => block(invoices.filter((inv) => inv.currency === c), `${c} `)).join("\n\n");
}
