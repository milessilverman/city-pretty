import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

// Shared by the guard tests (noInternalRows.test.ts). Rows with display_allowed: false, and the internal tables'
// distinctive values, must never appear in anything the site publishes.

// Five cells of the ICC Building Valuation Data table (February 2026), compared by the test with
// data/internal/building_costs_internal.json, plus two quotes of the internal funding table (a Florida Housing
// hard-cost factor and the equity-price survey sentence).
export const ICC_FIXTURES = [
  { group: "R-2", type: "IA", value: 239.24 },
  { group: "R-3", type: "VB", value: 175.92 },
  { group: "A-1", type: "IIIA", value: 300.49 },
  { group: "S-1", type: "IB", value: 148.59 },
  { group: "R-2", type: "VB", value: 158.18 },
];
export const FUNDING_FIXTURES = [
  "Mid-Rise-ESSC (NC) | 2026/2027 | BMP | 339000",
  "The median housing credit net equity price remains depressed at $0.827",
];

// What is wrong with a file's text, if anything. Empty when it is clean.
export function leaks(text: string): string[] {
  const out: string[] = [];
  if (/"display_allowed"\s*:\s*false/.test(text)) out.push('a row with "display_allowed": false');
  if (/"icc_occupancy_group"|"icc_construction_type"/.test(text)) out.push("an ICC table row (icc_occupancy_group / icc_construction_type)");
  for (const f of ICC_FIXTURES) if (new RegExp(`"value"\\s*:\\s*${String(f.value).replace(".", "\\.")}(?![0-9])`).test(text)) out.push(`ICC cell ${f.group} ${f.type} = ${f.value}`);
  for (const q of FUNDING_FIXTURES) if (text.includes(q)) out.push(`internal funding row quote: ${q}`);
  return out;
}

const TEXT = /\.(json|js|mjs|css|html|txt|md|map|svg)$/i;
export function* walk(dir: string): Generator<string> {
  for (const n of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}
// Every file under dir: text files as they are, .gz files unzipped, .b64.txt packs decoded and unzipped too.
export function scanDir(dir: string): { files: number; found: { file: string; why: string[] }[] } {
  let files = 0;
  const found: { file: string; why: string[] }[] = [];
  const check = (file: string, text: string) => { const why = leaks(text); if (why.length) found.push({ file: path.relative(dir, file), why }); };
  for (const f of walk(dir)) {
    files++;
    if (f.endsWith(".gz")) { try { check(f, zlib.gunzipSync(fs.readFileSync(f)).toString("utf8")); } catch { /* not gzip: skipped */ } continue; }
    if (!TEXT.test(f)) continue;
    const text = fs.readFileSync(f, "utf8");
    check(f, text);
    if (/\.b64\.txt$/.test(f)) { try { check(f + " (decoded)", zlib.gunzipSync(Buffer.from(text.trim(), "base64")).toString("utf8")); } catch { /* not a gzip pack */ } }
  }
  return { files, found };
}
