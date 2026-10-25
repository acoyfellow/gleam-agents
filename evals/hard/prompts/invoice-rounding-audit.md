# Invoice totals that always add up

Auditors found invoices whose line totals do not add up to the subtotal after discounts.

Acceptance:
- Invoice gains discountedLines: Money[], one per line: each line total less its share of the discount
- The discount shares are allocated by line total and always sum exactly to the invoice discount
- Leftover cents go to the lines with the largest fractional remainders; ties go to the earlier line
- Every other Invoice field and buildInvoice's signature are unchanged

Files you will most likely change: src/invoice.ts, test/invoice.test.ts

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

