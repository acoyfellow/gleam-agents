# Sales report across currencies

The report throws for mixed currencies; finance wants one block per currency instead.

Acceptance:
- salesReport keeps its signature and its exact output for invoices in one currency
- For mixed currencies it writes one block per currency, in the order each currency first appears, each block its invoice lines then "TOTAL <currency> <sum>"
- Blocks are separated by one empty line
- An empty list gives "TOTAL 0.00"
- The existing test that expects a TypeError for mixed currencies describes the old behavior: change it to the new one

Files you will most likely change: src/report.ts, test/report.test.ts

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

