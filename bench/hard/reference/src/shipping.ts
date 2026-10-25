import type { Money } from "./core/money.ts";
import { money } from "./core/money.ts";

/** Flat shipping by region, in cents. */
export const SHIPPING_CENTS: Readonly<Record<string, number>> = { CA: 599, NY: 699, TX: 649, OR: 599 };

/** Shipping to `region` in `currency`. Throws a RangeError for a region the shop does not ship to. */
export function shippingFor(region: string, currency: string = "USD"): Money {
  const cents = SHIPPING_CENTS[region];
  if (cents === undefined) throw new RangeError(`shipping: no shipping to region ${region}`);
  return money(cents, currency);
}

export function shippingByWeight(grams: number, region: string, currency: string = "USD"): Money {
  if (!Number.isInteger(grams) || grams < 0) throw new RangeError(`shipping: bad weight ${grams}`);
  const base = shippingFor(region, currency);
  const extra = grams <= 500 ? 0 : Math.ceil((grams - 500) / 500);
  return money(base.cents + extra * 250, currency);
}
