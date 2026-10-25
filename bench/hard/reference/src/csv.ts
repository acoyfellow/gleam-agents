export function parseCsv(text: string): string[][] {
  if (text === "") return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let quoted = false;
  let afterQuote = false;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; afterQuote = true; i += 1; continue;
      }
      field += c; i += 1; continue;
    }
    if (c === ",") { row.push(field); field = ""; afterQuote = false; i += 1; continue; }
    if (c === "\r" && text[i + 1] === "\n") { row.push(field); rows.push(row); row = []; field = ""; afterQuote = false; i += 2; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; afterQuote = false; i += 1; continue; }
    if (afterQuote) throw new SyntaxError(`csv: unexpected ${JSON.stringify(c)} after a closing quote`);
    if (c === '"') {
      if (field !== "") throw new SyntaxError("csv: quote inside an unquoted field");
      quoted = true; i += 1; continue;
    }
    field += c; i += 1;
  }
  if (quoted) throw new SyntaxError("csv: unterminated quoted field");
  const last = text.endsWith("\n");
  if (!last) { row.push(field); rows.push(row); }
  return rows;
}
