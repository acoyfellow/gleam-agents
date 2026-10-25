# Stack discounts with a cap

Marketing wants a coupon and a loyalty discount on one order, but never more than half off.

Acceptance:
- src/discount.ts exports stackDiscounts(subtotal: Money, discounts: Discount[]): Money, the total amount off
- Percent discounts apply in order, each to what is left after the previous ones, rounded half away from zero at each step
- Fixed discounts apply after every percent discount, in the order given
- The total off never exceeds half of the subtotal, rounded down to a whole cent, and never makes the result negative
- An empty list is zero off

Files you will most likely change: src/discount.ts, test/discount.test.ts

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

