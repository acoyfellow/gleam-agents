import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

const docsDir = new URL("../../docs/", import.meta.url).pathname;
const order = ["index", "catalog", "plans", "scope", "graders", "pi", "roadmap"];
const files = readdirSync(docsDir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const slugs = [...order.filter((s) => files.includes(s)), ...files.filter((s) => !order.includes(s)).sort()];

const docs = slugs.map((slug) => {
  const markdown = readFileSync(join(docsDir, `${slug}.md`), "utf8");
  const title = (markdown.match(/^# (.+)$/m)?.[1] ?? slug).trim();
  const html = marked.parse(markdown, { async: false }).replace(/href="\/docs\/index"/g, 'href="/docs"');
  return { slug, title, markdown, html };
});

const out = `export const DOCS = ${JSON.stringify(docs)} as const;\n`;
writeFileSync(new URL("../src/docs.generated.ts", import.meta.url), out);
console.log(`docs: ${docs.length} pages`);
