import type { Money } from "./core/money.ts";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const under1000 = (n: number): string => {
  const parts: string[] = [];
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} hundred`); n %= 100; }
  if (n >= 20) parts.push(n % 10 ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : TENS[Math.floor(n / 10)]);
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
};

const words = (n: number): string => {
  if (n === 0) return "zero";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000), thousands = Math.floor((n % 1_000_000) / 1000), rest = n % 1000;
  if (millions) parts.push(`${under1000(millions)} million`);
  if (thousands) parts.push(`${under1000(thousands)} thousand`);
  if (rest) parts.push(under1000(rest));
  return parts.join(" ");
};

export function toWords(m: Money): string {
  if (m.currency !== "USD") throw new RangeError(`words: only USD, not ${m.currency}`);
  const abs = Math.abs(m.cents);
  if (abs > 99_999_999_999) throw new RangeError("words: amount too large");
  const dollars = Math.floor(abs / 100), cents = abs % 100;
  let out = `${words(dollars)} ${dollars === 1 ? "dollar" : "dollars"}`;
  if (cents) out += ` and ${words(cents)} ${cents === 1 ? "cent" : "cents"}`;
  return m.cents < 0 ? `minus ${out}` : out;
}
