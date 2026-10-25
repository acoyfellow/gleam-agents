# Format negative amounts in currencies without a symbol

Reports in CHF and JPY print negative amounts wrongly today.

Acceptance:
- format keeps its signature
- For a currency with no symbol, a negative amount is written with the minus before the number: format(money(-1234, "CHF")) is "-12.34 CHF"
- A currency named in a new exported MINOR_UNITS table with 0 minor units is written with no decimals: format(money(1234, "JPY")) is "1234 JPY" and format(money(-5, "JPY")) is "-5 JPY"
- MINOR_UNITS lists at least JPY: 0 and KRW: 0; every other currency keeps two decimals
- Existing USD, EUR and GBP output is unchanged

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

