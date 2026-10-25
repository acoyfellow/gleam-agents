# Tax is a cent short on some orders

Customers in California report that tax on some orders is one cent less than their own calculation. Find and fix the cause in the money core.

Acceptance:
- percentOf(money(200), 7.25) is money(15), and taxFor(money(3000), "CA") is money(218)
- percentOf gives the exactly rounded result (halves away from zero) for every whole number of cents and every rate in TAX_RATES
- percentOf keeps its signature and units: 15 still means 15 percent
- A test in test/money.test.ts covers amounts that used to be a cent short

Files you will most likely change: src/core/money.ts, test/money.test.ts

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

