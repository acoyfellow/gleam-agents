# Credit an invoice line by line

Partial returns must credit only some lines, with the right share of discount, tax and shipping.

Acceptance:
- src/credit.ts exports creditLines(invoice: Invoice, skus: string[]): Money, the amount to refund for returning every unit of those lines
- The refund is those lines' totals, less their share of the invoice discount by line total, plus the tax on that discounted amount at the invoice's region rate
- Shipping is refunded only when every line is returned
- Returning every line refunds exactly the invoice total
- An unknown sku throws a RangeError naming it

Files you will most likely change: src/credit.ts, test/credit.test.ts

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

