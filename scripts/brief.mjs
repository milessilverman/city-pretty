// Print a county's decision brief from the data already in the repository. No AI, no network.
//   node scripts/brief.mjs 48453            plain text
//   node scripts/brief.mjs 48453 --json     the JSON the Invest view and the AI advisor read
//   node scripts/brief.mjs 48453 --area 484530023271   pick the neighborhood (block group) to detail
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const E = require("../src/engines/investmentDecisionEngine.js");
const data = (f) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));

const args = process.argv.slice(2);
const fips = args.find((a) => /^\d{5}$/.test(a));
const asJson = args.includes("--json");
const areaArg = args.includes("--area") ? args[args.indexOf("--area") + 1] : null;
if (!fips) { console.error("Usage: node scripts/brief.mjs <5-digit county FIPS> [--json] [--area <block group id>]"); process.exit(1); }
const bundlePath = path.join(root, `counties/bundle_${fips}.json.gz`);
if (!fs.existsSync(bundlePath)) { console.error(`No county file for ${fips} (counties/bundle_${fips}.json.gz)`); process.exit(1); }

const bundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(bundlePath)).toString("utf8"));
const camel = (r) => ({ ...r, cost_per_mile: r.cost_per_mile ?? (r.cost_per_mile_usd_millions != null ? r.cost_per_mile_usd_millions * 1e6 : null) });
const ctx = {
  backtest: data("neighborhood_score_backtest.json"),
  underusedSites: data("underused_sites.json"),
  costBenchmarks: (data("transit_cost_benchmarks.json").rows || []).map(camel),
  valueEffects: data("transit_value_effects.json").rows || [],
};
let brief = E.buildDecisionBrief(bundle, { top: 5 }, ctx);
const area = areaArg || brief.topNeighborhoods?.[0]?.id;
if (area) brief = E.buildDecisionBrief(bundle, { top: 5, blockGroupId: area }, ctx);

if (asJson) { console.log(JSON.stringify(brief, null, 2)); process.exit(0); }

const money = (v) => (v == null ? "not on file" : "$" + Math.round(v).toLocaleString("en-US"));
const fig = (f) => (f && f.value != null ? `${typeof f.value === "number" && /USD/.test(f.unit || "") ? money(f.value) : f.value} [${f.basis}]` : "not on file");
const out = [];
out.push(`DECISION BRIEF: ${brief.county?.name} (${fips})`, "");
out.push("How far to trust this:");
for (const c of brief.caveats || []) out.push("  - " + c);
out.push("", "WHERE (cheapest for what they have, within this county)");
(brief.topNeighborhoods || []).forEach((n, i) => out.push(`  ${i + 1}. ${n.name}${n.city ? ", " + n.city : ""}  confidence ${n.confidence}  ${n.reason}  [${n.id}]`));
if (brief.topNeighborhoodsNote) out.push("  " + brief.topNeighborhoodsNote);
const nb = brief.neighborhood;
if (nb) {
  out.push("", `WHAT TO BUILD in ${nb.ranking?.name || area}`);
  for (const p of nb.housingPlays || []) out.push(`  - ${p.label}: cost ${fig(p.cost)}, value added ${fig(p.valueAdded)}; legal: ${p.legal}`);
  for (const b of (nb.build || []).slice(0, 8)) out.push(`  - ${b.project || b.name}: cost ${fig(b.cost)}, value per $1 ${fig(b.valuePerDollar)}, evidence ${b.evidence?.tier || "unknown"}`);
  out.push("", "PROPERTIES TO REDEVELOP near it");
  if (!(nb.places || []).length) out.push("  none on file for this area");
  for (const s of nb.places || []) out.push(`  - ${s.name} (${s.kind}), ${s.acres ?? "?"} acres`);
}
const countySites = ctx.underusedSites.filter((s) => s.countyFips === fips);
out.push("", `Sites on file in the county: ${countySites.length}`);
for (const s of countySites.slice(0, 10)) out.push(`  - ${s.name} (${s.kind}), ${s.acres ?? "?"} acres, checked: ${s.verification?.status || "no"}`);
const t = brief.transit;
if (t) {
  out.push("", `TRANSIT for ${t.name || "this area"}: ${t.verdict}${t.scale ? ", scale: " + t.scale : ""}`);
  if (t.verdictMeaning) out.push("  " + t.verdictMeaning);
  for (const r of t.reasons || []) out.push("  - " + r);
}
if ((brief.missing || []).length) { out.push("", "MISSING DATA"); for (const m of brief.missing) out.push("  - " + m); }
console.log(out.join("\n"));
