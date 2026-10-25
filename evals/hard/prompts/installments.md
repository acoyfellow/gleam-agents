# Pay in installments

Checkout offers monthly payments with interest.

Acceptance:
- src/installments.ts exports installments(total: Money, months: number, aprPercent: number): Array<{ payment, interest, principal, balance }> of Money
- Monthly rate is apr/12; the standard payment is the annuity payment rounded half away from zero; with zero interest it is the total divided by months rounded down
- Each month: interest is the balance times the monthly rate, rounded half away from zero; principal is payment minus interest; the last month pays the whole remaining balance plus its interest
- Principals sum exactly to the total and the final balance is zero
- Throws a RangeError for months that are not an integer from 1 to 360, a negative or non-finite rate, or a total that is not positive

Files you will most likely change: src/installments.ts, test/installments.test.ts

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

