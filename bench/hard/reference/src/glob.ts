type Token = { kind: "any" } | { kind: "one" } | { kind: "char"; c: string } | { kind: "set"; negate: boolean; items: Array<[string, string]> };

const tokenize = (pattern: string): Token[] => {
  const out: Token[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      if (i + 1 >= pattern.length) throw new SyntaxError("glob: trailing backslash");
      out.push({ kind: "char", c: pattern[++i] });
    } else if (c === "*") out.push({ kind: "any" });
    else if (c === "?") out.push({ kind: "one" });
    else if (c === "[") {
      let j = i + 1;
      const negate = pattern[j] === "!";
      if (negate) j++;
      const start = j;
      if (pattern[j] === "]") j++;
      while (j < pattern.length && pattern[j] !== "]") j++;
      if (j >= pattern.length) { out.push({ kind: "char", c: "[" }); continue; }
      const body = pattern.slice(start, j);
      const items: Array<[string, string]> = [];
      for (let k = 0; k < body.length; k++) {
        if (body[k + 1] === "-" && k + 2 < body.length) { items.push([body[k], body[k + 2]]); k += 2; }
        else items.push([body[k], body[k]]);
      }
      out.push({ kind: "set", negate, items });
      i = j;
    } else out.push({ kind: "char", c });
  }
  return out;
};

const hit = (t: Token, c: string): boolean => {
  if (t.kind === "one") return true;
  if (t.kind === "char") return t.c === c;
  if (t.kind === "set") return t.items.some(([a, b]) => c >= a && c <= b) !== t.negate;
  return false;
};

export function matchSku(pattern: string, sku: string): boolean {
  const tokens = tokenize(pattern);
  let ti = 0, si = 0, starT = -1, starS = 0;
  while (si < sku.length) {
    if (ti < tokens.length && tokens[ti].kind === "any") { starT = ti++; starS = si; }
    else if (ti < tokens.length && hit(tokens[ti], sku[si])) { ti++; si++; }
    else if (starT >= 0) { ti = starT + 1; si = ++starS; }
    else return false;
  }
  while (ti < tokens.length && tokens[ti].kind === "any") ti++;
  return ti === tokens.length;
}
