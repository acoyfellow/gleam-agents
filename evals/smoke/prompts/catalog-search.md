# Search the catalog

The shop needs a search box over product names.

Acceptance:
- src/catalog.ts exports searchCatalog(catalog: ReadonlyMap<string, Product>, query: string): Product[]
- Matches are case-insensitive and ignore accents: "cafe" finds "Café"
- Every word of the query must appear in the name, in any order
- Results are sorted by how early the first query word appears in the folded name, then by the folded name (lower case, accents removed), then by sku
- An empty or whitespace-only query returns an empty list

Files to change: src/catalog.ts, test/catalog.test.ts

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

