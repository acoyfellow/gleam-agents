# Shipping by weight band

Flat shipping loses money on heavy orders.

Acceptance:
- src/shipping.ts exports shippingByWeight(grams: number, region: string, currency?: string): Money
- Up to and including 500 g costs the flat rate shippingFor gives; each started further 500 g adds 250 cents
- 0 grams is the flat rate; a negative or non-integer weight throws a RangeError
- An unknown region throws as shippingFor does

Files you will most likely change: src/shipping.ts, test/shipping.test.ts

Conventions:

- Erasable TypeScript only: no `enum`, no `namespace`, no constructor parameter properties. Node strips the types and
  runs the file, with nothing installed and no build step.
- Relative imports name the `.ts` file (`import { add } from "./core/money.ts"`). Import types with `import type`.
- Amounts are `Money` from `src/core/money.ts`: integer cents and a currency. Build them with `money(cents, currency)`
  and do arithmetic with the module's functions, never on floats.
- Tests use `node:test` and `node:assert/strict` and live in `test/<name>.test.ts`; `node --test` runs them all.
  Compare amounts with `assert.deepEqual(actual, money(...))`.
- Every existing test must keep passing. When a function in `src/core/money.ts` changes, every caller and test of it
  must keep working; a function this intent does not mention keeps its signature and behavior.

