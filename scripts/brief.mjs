// Print a county's decision brief from the data already in the repository. No AI, no network.
//   node scripts/brief.mjs 48453            plain text
//   node scripts/brief.mjs 48453 --json     the JSON the Invest view and the AI advisor read
//   node scripts/brief.mjs 48453 --area 484530023271   pick the neighborhood (block group) to detail
//   node scripts/brief.mjs 48453 --budget 800000    also fit the courses of action to a budget
//   node scripts/brief.mjs 48453 --internal         also print, to the terminal only, the offline estimate computed from the internal
//                                                   cost table (data/internal/, rows the publisher does not allow us to display)
// Uses the same tables as the Invest view: the idea catalog from the LA bundle, the verification audit
// (intervention_verification.json: only audited ideas carry figures), state laws, unit costs, valuation models and the
// California bundle corrections the page applies. Los Angeles County (06037) is packed differently and is not supported.
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
const internalMode = args.includes("--internal");
if (internalMode && asJson) { console.error("--internal prints to the terminal only; it cannot be combined with --json."); process.exit(1); }
const areaArg = args.includes("--area") ? args[args.indexOf("--area") + 1] : null;
if (!fips) { console.error("Usage: node scripts/brief.mjs <5-digit county FIPS> [--json] [--area <block group id>]"); process.exit(1); }
const bundlePath = path.join(root, `counties/bundle_${fips}.json.gz`);
if (fips === "06037") { console.error("Los Angeles County is packed in app/data/bundle-la.b64.txt and details-la.json chunks; this script reads counties/bundle_<fips>.json.gz only."); process.exit(1); }
if (!fs.existsSync(bundlePath)) { console.error(`No county file for ${fips} (counties/bundle_${fips}.json.gz)`); process.exit(1); }

const bundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(bundlePath)).toString("utf8"));
// The same fill-ins the page applies on load (applyBundleCorrections in app/app.js): blanks only, never overwrites.
const fixes = (data("bundle_corrections.json").block_groups) || {};
for (const id in fixes) {
  const d = bundle.details && bundle.details[id];
  if (!d) continue;
  const m = d.m || d, c = fixes[id];
  if (c.hv != null && m.hv == null) { m.hv = c.hv; m.hvs = c.hvs; }
  if (c.rent != null && m.rent == null) { m.rent = c.rent; m.rent_s = c.rent_s; }
}
const la = JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(root, "app/data/bundle-la.b64.txt"), "utf8").trim(), "base64")).toString("utf8"));
// Same conversion as the Invest view (engineCosts / engineEffects in app/invest.js)
const costRows = (data("transit_cost_benchmarks.json").rows || []).filter((r) => r && Number.isFinite(r.cost_per_mile_usd_millions)).map((r) => ({ mode: r.mode, cost_per_mile: r.cost_per_mile_usd_millions * 1e6, year: r.dollar_year || null, source_url: r.source_url || null }));
const effectMode = (l) => { const t = String(l || "").toLowerCase(); return /light rail/.test(t) ? "light_rail" : /heavy rail|metro/.test(t) ? "heavy_rail" : /commuter/.test(t) ? "commuter_rail" : /bus rapid|brt/.test(t) ? "brt" : "all_rail"; };
const ctx = {
  backtest: data("neighborhood_score_backtest.json"),
  prediction: data("neighborhood_prediction.json"),
  catalog: la.catalog,
  verification: data("intervention_verification.json"),
  underusedSites: data("underused_sites.json"),
  costBenchmarks: costRows,
  valueEffects: (data("transit_value_effects.json").rows || []).filter((r) => r && Number.isFinite(r.effect_pct)).map((r) => ({ mode: effectMode(r.mode), distance_band: r.distance_band, effect_pct: r.effect_pct, source_url: r.source_url || null })),
  laws: data("statutes.json"),
  unitCosts: data("unit_costs.json"),
  valuationModels: data("county_valuation_models.json"),
};
let brief = E.buildDecisionBrief(bundle, { top: 5 }, ctx);
const area = areaArg || brief.topNeighborhoods?.[0]?.id;
if (area) brief = E.buildDecisionBrief(bundle, { top: 5, blockGroupId: area }, ctx);

// Courses of action (src/engines/projectCardEngine.js): the selected area, the county's measured sites and each planned-rail
// stop city, built from the same tables as the Invest view's section (pcSubjects / pcCtx in app/invest.js). Only
// display-allowed cost rows are passed, so no internal-only estimate is computed unless --internal loads data/internal/ below.
const P = require("../src/engines/projectCardEngine.js");
const CSA = require("../src/engines/corridorStopAreas.js");
const ST = { "06": "CA", "12": "FL", "48": "TX" }[fips.slice(0, 2)] || (data("hud_fair_market_rents.json").records.find((r) => r.fips === fips) || {}).state_code || null;
const pctx = { laws: ctx.laws, buildingCosts: data("building_costs.json").rows,
  internalBuildingCosts: internalMode ? JSON.parse(fs.readFileSync(path.join(root, "data/internal/building_costs_internal.json"), "utf8")).rows : [], fundingRules: data("housing_funding_rules.json"), incomeLimits: data("hud_income_limits.json"),
  fmr: data("hud_fair_market_rents.json"), valuationModels: ctx.valuationModels, valuationBenchmarks: data("valuation_backtest_benchmarks.json"), transitEffects: data("transit_value_effects.json"), corridors: data("intercity_transit_corridors.json") };
const bgRow = (id) => { const m = (bundle.details[id] || {}).m || {}; return { id, hv: Number.isFinite(m.hv) ? m.hv : null, hvSource: m.hvs || "Census ACS 5-year median home value" }; };
const stopCards = [];
for (const c of pctx.corridors) {
  for (const r of CSA.stopAreasForCounty(c, bundle, fips, 1)) {
    if (!r.ok || !r.stop.coordinate_basis || stopCards.some((s) => s.c === c.id && s.city === r.stop.city)) continue;
    stopCards.push({ c: c.id, city: r.stop.city, subject: { kind: "stop_area", id: r.stop.id, name: `Around the ${r.stop.city} stop city (${c.name})`, countyFips: fips, stateCode: ST, city: r.stop.city, blockGroups: r.areas.map((a) => bgRow(a.id)),
      nearStops: [{ corridorId: c.id, corridorName: c.name, corridorType: c.corridor_type || null, corridorStatus: (c.verification && c.verification.status) || "unverified", stopId: r.stop.id, stopCity: r.stop.city, miles: null, coordinateBasis: r.stop.coordinate_basis }],
      sitesNearby: ctx.underusedSites.filter((s) => s.countyFips === fips && r.areas.some((a) => a.id === s.blockGroupId)).length } });
  }
}
const subjects = [];
if (area && bundle.details[area]) subjects.push({ kind: "neighborhood", id: area, name: bundle.details[area].m.n || area, countyFips: fips, stateCode: ST, city: bundle.details[area].m.c || null, blockGroups: [bgRow(area)] });
for (const s of ctx.underusedSites.filter((x) => x.countyFips === fips).sort((a, b) => (b.acres || 0) - (a.acres || 0)).slice(0, 6)) subjects.push({ kind: "site", id: s.id, name: s.name, siteKind: s.kind, countyFips: fips, stateCode: ST, city: s.cityName || null, acres: Number.isFinite(s.acres) ? { value: s.acres, source: s.sourceUrl } : null, parcel: { parcel_id: s.id, state_code: ST, county_fips: fips, base_zoning_code: s.baseZoning || null, municipality_name: s.cityName || null, is_commercial_or_mixed_use: /commercial/.test(s.zoningCategory || ""), is_multifamily_residential: s.zoningCategory === "multifamily", is_single_family_residential: s.zoningCategory === "single-family", exclusions: {}, lot_sqft: Number.isFinite(s.acres) ? s.acres * 43560 : null } });
for (const s of stopCards) subjects.push(s.subject);
const cards = subjects.map((s) => P.buildProjectCard(s, pctx));
brief.projectCards = P.cardsForAdvisor(cards, Math.min(6000, 19500 - JSON.stringify(E.briefForAdvisor(brief)).length));
const budgetArg = args.includes("--budget") ? Number(args[args.indexOf("--budget") + 1]) : null;

if (asJson) { console.log(JSON.stringify(brief, null, 2)); process.exit(0); }

const money = (v) => (v == null ? "not on file" : "$" + Math.round(v).toLocaleString("en-US"));
const fig = (f) => (f && f.value != null ? `${/per USD/.test(f.unit || "") ? "$" + f.value.toFixed(2) + " per $1" : typeof f.value === "number" && /USD/.test(f.unit || "") ? money(f.value) : f.value} [${f.basis}]` : "not on file");
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
  for (const b of (nb.build || []).slice(0, 8)) out.push(`  - ${b.name}${b.project ? " (" + b.project + ")" : ""}: cost ${fig(b.cost)}, return ${fig(b.valuePerDollar)}, audit: ${(b.evidence?.verification || "unverified").replace(/_/g, " ")}`);
  if ((nb.withheld || []).length) out.push(`  Listed with no figures (${nb.withheld.length}): ${nb.withheld.map((w) => w.name).join("; ")}. Reason: effect size or cost not confirmed against a source.`);
  out.push("", "PLACES NEAR IT (sites bundle)");
  if (!(nb.places || []).length) out.push("  none on file for this area");
  for (const s of nb.places || []) out.push(`  - ${s.name || s.type}${s.cost ? `: cost ${fig(s.cost.low)} to ${fig(s.cost.high)}` : ""}`);
}
const countySites = ctx.underusedSites.filter((s) => s.countyFips === fips);
out.push("", `Sites on file in the county: ${countySites.length}`);
for (const s of countySites.slice(0, 10)) out.push(`  - ${s.name} (${s.kind}), ${s.acres ?? "acres not on file"} acres, record: ${s.verification?.status || "unverified"}; homes and margin are unverified model estimates, not shown`);
const t = brief.transit;
if (t) {
  out.push("", `TRANSIT for ${t.name || "this area"}: ${t.verdict}${t.scale ? ", scale: " + t.scale : ""}`);
  if (t.verdictMeaning) out.push("  " + t.verdictMeaning);
  for (const r of t.reasons || []) out.push("  - " + r);
}
const rg = (r) => (r ? (r.low.value === r.high.value ? money(r.low.value) : `${money(r.low.value)} to ${money(r.high.value)}`) + ` [${r.basis}]` : null);
out.push("", "COURSES OF ACTION (project cards; ranges, every input sourced: see docs/PROJECT-CARDS.md)");
for (const c of cards) {
  out.push(`  ${c.subject.kind}: ${c.subject.name}`);
  for (const x of c.courses) {
    out.push(`    - ${x.label}: cost ${rg(x.cost) || "not on file (" + x.costWhy + ")"}${x.cost && x.cost.label ? " (" + x.cost.label + ")" : ""}`);
    if (x.income) out.push(`        income ${rg(x.income.perUnitMonthly)} per home per month (${x.income.label})`);
    out.push(`        value ${x.value ? rg(x.value) : x.valueWhy}`);
    if (x.transitUplift) for (const b of x.transitUplift.bands) out.push(`        near ${x.transitUplift.stop.city} stop city, ${b.band}: average ${b.average.value}%, studies ranged ${b.range ? b.range.low.value + "% to " + b.range.high.value + "%" : "not on file"}`);
  }
  for (const n of c.notAssessed) out.push(`    x ${n.label}: could not be assessed: ${n.missing[0]}`);
}
if (budgetArg != null && Number.isFinite(budgetArg)) {
  const f = P.fitToBudget(cards, budgetArg);
  out.push("", `WITH ${money(budgetArg)}: ${f.within.length} fit, ${f.straddle.length} could fit, ${f.over.length} cost more, ${f.uncosted} have no cost on file, ${f.notAssessed} could not be assessed`);
  for (const x of f.within) out.push(`  fits: ${x.label} (${x.subject}): ${rg(x.cost)}`);
  for (const x of f.straddle) out.push(`  could fit: ${x.label} (${x.subject}): ${rg(x.cost)}`);
}
if (internalMode) {
  out.push("", "==== internal estimate: not for display ====", "  Computed offline from data/internal/building_costs_internal.json (ICC Building Valuation Data, whose terms forbid public display).",
    "  Never shown on the page, never sent to the advisor. Do not copy these figures into anything published.");
  let n = 0;
  for (const c of cards) for (const e of c.internal_only.estimates) {
    n++;
    out.push(e.computed ? `  ${c.subject.name}: ${e.course}${e.affordable ? " (affordable share)" : ""}: ${money(e.low)} to ${money(e.high)} hard cost only; ${e.floorArea} sq ft (${e.floorAreaBasis}); ICC ${e.iccGroup} ${e.iccTypes.join("/")} x DoD factor ${e.dodFactorRange.join("-")}`
      : `  ${c.subject.name}: ${e.course}${e.affordable ? " (affordable share)" : ""}: not computed: ${e.why}`);
  }
  if (!n) out.push("  no internal estimates for these subjects");
  out.push("==== end internal estimate ====");
}
if ((brief.missing || []).length) { out.push("", "MISSING DATA"); for (const m of brief.missing) out.push("  - " + m); }
console.log(out.join("\n"));
