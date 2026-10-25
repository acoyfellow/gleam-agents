import type { Money } from "./core/money.ts";
import { money, percentOf, roundHalfAway } from "./core/money.ts";

/** Sales tax rates in percent, by region. */
export const TAX_RATES: Readonly<Record<string, number>> = { CA: 7.25, NY: 4, TX: 6.25, OR: 0 };

/** The sales tax on `amount` in `region`. Throws a RangeError for a region with no rate. */
export function taxFor(amount: Money, region: string): Money {
  const rate = TAX_RATES[region];
  if (rate === undefined) throw new RangeError(`tax: no rate for region ${region}`);
  return percentOf(amount, rate);
}

export function taxIncluded(gross: Money, region: string): Money {
  const rate = TAX_RATES[region];
  if (rate === undefined) throw new RangeError(`tax: no rate for region ${region}`);
  return money(roundHalfAway((gross.cents * rate) / (100 + rate)), gross.currency);
}
