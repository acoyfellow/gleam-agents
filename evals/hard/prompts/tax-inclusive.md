# Tax-inclusive prices

Some regions show prices with tax already included; invoices must split the tax back out.

Acceptance:
- src/tax.ts exports taxIncluded(gross: Money, region: string): Money, the tax part of a gross price that already contains tax at the region's rate
- net plus taxIncluded is exactly the gross; the tax is rounded half away from zero to a whole cent
- taxIncluded(money(10725), "CA") is money(725)
- A region with a zero rate gives zero; an unknown region throws a RangeError as taxFor does
- taxIncluded(money(999), "TX") is money(59)

Files you will most likely change: src/tax.ts, test/tax.test.ts

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

