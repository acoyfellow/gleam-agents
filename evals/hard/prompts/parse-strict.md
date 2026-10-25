# Parse money strings strictly

Imported price lists contain messy strings; bad ones must be rejected, not guessed.

Acceptance:
- parse keeps its signature and accepts what it accepted before
- parse also accepts a leading + sign and thousands separators in groups of exactly three digits: parse("1,234.50") is money(123450)
- parse rejects with a SyntaxError: empty or whitespace-only strings, "1,23.00", "1,2345", ".5", "5.", "1e3", "--1", "1.234", and any string with inner spaces
- parse("-0") and parse("-0.00") are money(0) with cents exactly 0, not -0
- parseCatalog keeps working: a catalog price never contains a thousands separator, because the comma separates fields

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

