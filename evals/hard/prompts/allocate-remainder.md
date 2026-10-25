# Split an amount by weights without losing a cent

Gift splits and refunds divide one amount between several parties by weight.

Acceptance:
- src/core/money.ts exports allocate(m: Money, weights: number[]): Money[]
- The parts always sum exactly to m, in m's currency
- Leftover cents go one each to the parts with the largest fractional remainders; ties go to the earlier part
- Works for negative amounts the same way, mirrored
- Throws a RangeError for an empty weights list, a negative weight, or weights that sum to zero

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

