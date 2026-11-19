// Compare every named function in src/engines/*.js and src/adapters/*.js with the same-named function inlined in
// app/app.js (the page runs app.js's copies; the unit tests import the src/*.js files).
// Usage: node scripts/check_engine_copies.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app/app.js"), "utf8");

// Source text of a top-level `function NAME(` declaration, through its matching closing brace.
export function grabFunction(src, name) {
  const re = new RegExp("^(async )?function " + name + "\\(", "m");
  const m = re.exec(src);
  if (!m) return null;
  let i = src.indexOf("{", m.index), depth = 0, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
  }
  return null;
}

// Source text of a top-level `const|let|var NAME =` declaration, through the `;` that ends it at bracket depth 0.
export function grabConst(src, name) {
  const re = new RegExp("^(const|let|var) " + name + " = ", "m");
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 0, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); continue; }
    if ("{[(".includes(c)) depth++;
    else if ("}])".includes(c)) depth--;
    else if (c === ";" && depth === 0) return src.slice(m.index, i + 1);
  }
  return null;
}

const stripComments = (s) => s.split("\n").map((l) => l.replace(/\s*\/\/.*$/, "").trimEnd()).filter((l) => l.trim()).join("\n");

// Every top-level function and constant in src/engines/*.js and src/adapters/*.js, compared with app/app.js.
export function compareEngineCopies() {
  const rows = [];
  for (const dir of ["src/engines", "src/adapters"]) {
    for (const f of fs.readdirSync(path.join(root, dir)).filter((x) => x.endsWith(".js")).sort()) {
      const src = fs.readFileSync(path.join(root, dir, f), "utf8");
      const items = [
        ...[...src.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)\(/gm)].map((m) => ["function", m[1]]),
        ...[...src.matchAll(/^(?:const|let|var) ([A-Za-z0-9_]+) = /gm)].map((m) => ["const", m[1]]),
      ];
      for (const [kind, n] of items) {
        const grab = kind === "function" ? grabFunction : grabConst;
        const a = grab(app, n), b = grab(src, n);
        rows.push({
          file: `${dir}/${f}`, kind, name: n, in_app: !!a,
          identical: a ? a === b : null,
          same_ignoring_comments: a ? stripComments(a) === stripComments(b) : null,
          app_lines: a ? a.split("\n").length : 0, js_lines: b ? b.split("\n").length : 0,
        });
      }
    }
  }
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rows = compareEngineCopies();
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) console.log(`${r.file} ${r.kind} ${r.name}: ${!r.in_app ? "not in app.js" : r.identical ? "identical" : r.same_ignoring_comments ? "differs in comments only" : "DIFFERS"} (app ${r.app_lines} / js ${r.js_lines} lines)`);
}
