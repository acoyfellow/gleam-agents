import type { Money } from "./core/money.ts";
import { money, roundHalfAway } from "./core/money.ts";

export interface Installment {
  readonly payment: Money;
  readonly interest: Money;
  readonly principal: Money;
  readonly balance: Money;
}

export function installments(total: Money, months: number, aprPercent: number): Installment[] {
  if (!Number.isInteger(months) || months < 1 || months > 360) throw new RangeError(`installments: bad months ${months}`);
  if (!(aprPercent >= 0) || !Number.isFinite(aprPercent)) throw new RangeError(`installments: bad rate ${aprPercent}`);
  if (total.cents <= 0) throw new RangeError("installments: total must be positive");
  const r = aprPercent / 100 / 12;
  const payment = r === 0 ? Math.floor(total.cents / months) : roundHalfAway((total.cents * r) / (1 - Math.pow(1 + r, -months)));
  const out: Installment[] = [];
  let balance = total.cents;
  for (let k = 1; k <= months; k++) {
    const interest = roundHalfAway(balance * r);
    const principal = k === months ? balance : payment - interest;
    balance -= principal;
    out.push({ payment: money(principal + interest, total.currency), interest: money(interest, total.currency), principal: money(principal, total.currency), balance: money(balance, total.currency) });
  }
  return out;
}
