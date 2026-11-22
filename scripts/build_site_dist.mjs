// Builds dist-site/: the static files the page needs at runtime, for the site Worker (wrangler.site.toml).
//   node scripts/build_site_dist.mjs
// Explicit allowlist only. County data files counties/bundle_*.json.gz are NOT copied: the page loads them from the
// Cloudflare R2 host in app/data/county_hosts.json. Fails if a required file is missing or a file is over the
// Workers static-assets per-file limit (25 MiB; developers.cloudflare.com/workers/platform/limits, read 19 Nov 2026)
// or the file count passes the free-plan limit (20,000 files per Worker version, same page).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist-site");
const MAX_FILE = 25 * 1024 * 1024;
const MAX_FILES = 20000;

// Copy rules: [file or directory, filter(path inside it) -> boolean]
const RULES = [
  ["index.html", () => true],
  ["app", () => true], // page code, styles, vendor libs, app/data (every county's small files)
  ["src", (f) => f.endsWith(".js")], // engines the page imports (the .ts files are Worker-only)
  ["counties/manifest.json", () => true],
  ["counties", (f) => /^sites_\d{5}\.json\.gz$/.test(f)], // top level only; bundle_*.json.gz stay in R2
  ["docs/DECISION-ENGINE.md", () => true], // linked from the Invest view
];

// Files the page requests at runtime (recorded by loading it for LA, Cook, Travis and Roane TN; Map, Explore, Invest).
const REQUIRED = [
  "index.html", "app/app.css", "app/app.js", "app/config.js", "app/explore.js", "app/facts.js", "app/invest.js",
  "app/vendor/fflate.js", "app/vendor/leaflet-1.9.4.js", "src/engines/investmentDecisionEngine.js", "app/draw-area.js", "src/engines/areaAggregationEngine.js",
  "app/data/county_hosts.json", "app/data/bundle-la.b64.txt", "app/data/details-la.json", "app/data/overlays-la.json",
  "app/data/sites-la.b64.txt", "app/data/statutes.json", "app/data/unit_costs.json", "app/data/research.json",
  "app/data/crash_counts/17031.json", "app/data/crash_gaps/17031.json", "app/data/tree_equity_2025/47135.json",
  "counties/sites_17031.json.gz", "counties/sites_48453.json.gz", "counties/manifest.json", "docs/DECISION-ENGINE.md",
];

function* walk(p) {
  if (statSync(p).isDirectory()) { for (const n of readdirSync(p).sort()) yield* walk(join(p, n)); }
  else yield p;
}
const posix = (p) => p.split("\\").join("/");

rmSync(OUT, { recursive: true, force: true });
let count = 0, bytes = 0;
const problems = [];
for (const [src, keep] of RULES) {
  const abs = join(ROOT, src);
  if (!existsSync(abs)) { problems.push("missing: " + src); continue; }
  const isDir = statSync(abs).isDirectory();
  for (const f of isDir ? walk(abs) : [abs]) {
    const rel = posix(relative(ROOT, f));
    const within = isDir ? posix(relative(abs, f)) : rel;
    if (src === "counties" && within.includes("/")) continue;
    if (!keep(within)) continue;
    const size = statSync(f).size;
    if (size > MAX_FILE) { problems.push(`over 25 MiB: ${rel} (${size} bytes)`); continue; }
    mkdirSync(dirname(join(OUT, rel)), { recursive: true });
    cpSync(f, join(OUT, rel));
    count++; bytes += size;
  }
}
// Rows marked display_allowed: false (the ICC building valuation table, whose terms forbid republishing it, and rows whose
// terms were not checked) are kept in data/internal/, which this build never copies, so they cannot get here. Second line
// of defence, kept on purpose: if one ever lands in a published data file again (a builder script writing it back, a hand
// edit), the build fails instead of quietly shipping or quietly filtering it. tests/unit/noInternalRows.test.ts checks the same.
for (const f of walk(join(OUT, "app"))) {
  if (!f.endsWith(".json")) continue;
  if (/"display_allowed"\s*:\s*false/.test(readFileSync(f, "utf8"))) problems.push(`row(s) marked display_allowed: false in published file ${posix(relative(ROOT, f))}; move them to data/internal/ (scripts/costs/costlib.py dump_split)`);
}
for (const r of REQUIRED) if (!existsSync(join(OUT, r))) problems.push("required file missing from dist-site: " + r);
// Every local script and stylesheet in index.html must be present.
const html = readFileSync(join(ROOT, "index.html"), "utf8");
for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^":#?]+)"/g)) {
  if ((m[1].endsWith(".css") || m[1].endsWith(".js")) && !existsSync(join(OUT, m[1]))) problems.push("index.html references a file not in dist-site: " + m[1]);
}
if (count > MAX_FILES) problems.push(`${count} files is over the free-plan limit of ${MAX_FILES}`);
console.log(`dist-site: ${count} files, ${(bytes / 1048576).toFixed(1)} MiB (${bytes} bytes)`);
if (problems.length) { console.error("FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
