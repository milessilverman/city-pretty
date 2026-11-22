// Measure what the project cards say for every station-area redevelopment site on file.
//   node scripts/measure_site_cards.mjs <label>        writes data/backtests/site_cards_measure_<label>.json and .md
// Builds one card per site in app/data/station_sites/<fips>.json with the inputs the page passes (pcSubjects / pcCtx in
// app/invest.js): display-allowed cost rows only, no internal rows. For each course of action it counts which rows are
// filled (size, cost, public money, income, value, and the place facts) and, for each unfilled row, the reason string,
// then ranks the reasons by number of sites and by county. No network.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
// ENGINE=<path> measures another copy of the engine (the "before" run used the engine as it was at the start of the job)
const P = require(process.env.ENGINE || "../src/engines/projectCardEngine.js");
const SS = require("../src/engines/stationSites.js");
const data = (f) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));
const opt = (f) => (fs.existsSync(path.join(root, "app/data", f)) ? data(f) : null);
const label = process.argv[2] || "run";

// state postal code from the county FIPS (Census state FIPS codes; the page uses activeState())
const ST = { "04": "AZ", "06": "CA", "08": "CO", "11": "DC", "12": "FL", "13": "GA", "17": "IL", "18": "IN", "22": "LA", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "29": "MO", "32": "NV", "34": "NJ", "36": "NY", "37": "NC", "39": "OH", "41": "OR", "42": "PA", "47": "TN", "48": "TX", "53": "WA", "55": "WI" };
const ctx = { laws: data("statutes.json"), buildingCosts: data("building_costs.json").rows, fundingRules: data("housing_funding_rules.json"), incomeLimits: data("hud_income_limits.json"),
  fmr: data("hud_fair_market_rents.json"), valuationModels: data("county_valuation_models.json"), valuationBenchmarks: data("valuation_backtest_benchmarks.json"),
  transitEffects: data("transit_value_effects.json"), corridors: data("intercity_transit_corridors.json"),
  qctDda: opt("hud_qct_dda.json") || undefined, mtspLimits: opt("hud_mtsp_income_limits.json") || undefined };

// The subject the page builds for a station site (pcSubjects in app/invest.js), plus the fields the page now passes.
function subjectFor(s, st) {
  const uf = ((s.verification && s.verification.unverified_fields) || []).map((u) => String(u).split(/[\s(]/)[0]);
  const acresOk = Number.isFinite(s.acres) && !uf.includes("acres");
  const railOk = Number.isFinite(s.distanceToRailMeters) && !uf.includes("distanceToRailMeters");
  return { kind: "site", id: s.id, name: s.name, siteKind: s.kindLabel || s.kind || null, countyFips: s.countyFips, stateCode: st, city: s.cityName || null,
    acres: acresOk ? { value: s.acres, source: s.sourceUrl } : null, railStationMi: railOk ? s.distanceToRailMeters / 1609.344 : null, nearStops: [], place: s.place || null,
    parcel: { parcel_id: s.id, state_code: st, county_fips: s.countyFips, base_zoning_code: s.baseZoning || null, municipality_name: s.cityName || null, is_commercial_or_mixed_use: false, is_single_family_residential: false, is_multifamily_residential: false, exclusions: {}, lot_sqft: acresOk ? s.acres * 43560 : null } };
}
const key = (t) => String(t || "(no reason given)").replace(/\$?\d[\d,.]*/g, "#").replace(/\(([^()]*)\)/g, (m) => (/#/.test(m) || m.length > 40 ? "(…)" : m)).replace(/county #/g, "county #").slice(0, 260);

const files = fs.readdirSync(path.join(root, "app/data/station_sites")).filter((f) => /^\d{5}\.json$/.test(f)).sort();
const rows = ["size", "cost", "publicMoney", "income", "value"];
const T = { sites: 0, counties: 0, courses: {}, notAssessed: {}, place: {}, anyCost: 0, anyMoneyApplies: 0, anyMoneyKnown: 0, anyIncome: 0, nothing: 0, nothingWhy: {}, byCounty: {} };
const bump = (o, k, fips) => { o[k] = o[k] || { sites: 0, counties: {} }; o[k].sites++; o[k].counties[fips] = (o[k].counties[fips] || 0) + 1; };
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(root, "app/data/station_sites", f), "utf8"));
  const fips = doc.fips, st = ST[fips.slice(0, 2)] || doc.state || null;
  const sites = SS.normalize(doc);
  const placesFile = path.join(root, "app/data/station_site_places", f);
  if (SS.attachPlaces && fs.existsSync(placesFile)) SS.attachPlaces(sites, JSON.parse(fs.readFileSync(placesFile, "utf8")));
  T.counties++;
  const C = (T.byCounty[fips] = { name: doc.county, sites: sites.length, cost: 0, moneyApplies: 0, moneyKnown: 0, income: 0, nothing: 0 });
  for (const s of sites) {
    T.sites++;
    const card = P.buildProjectCard(subjectFor(s, st), ctx);
    let hasCost = false, hasMoney = false, hasMoneyKnown = false, hasIncome = false;
    for (const x of card.courses) {
      const id = x.course + (x.affordable ? "+affordable" : "");
      const c = (T.courses[id] = T.courses[id] || { assessed: 0, filled: Object.fromEntries(rows.map((r) => [r, 0])), why: Object.fromEntries(rows.map((r) => [r, {}])) });
      c.assessed++;
      const filled = { size: !!(x.size && (x.size.units || x.size.sqft || x.size.area)), cost: !!x.cost, publicMoney: x.publicMoney.some((p) => p.status === "applies" || p.status === "computed"), income: !!x.income, value: !!x.value };
      const why = { size: x.sizeWhy || (x.missing || []).filter((t) => /^Size/.test(t)).join(" | "), cost: x.costWhy, publicMoney: x.publicMoney.length ? x.publicMoney.map((p) => p.programme + ": " + p.status).join(" | ") : "no programme listed", income: x.incomeWhy, value: x.valueWhy };
      for (const r of rows) { if (filled[r]) c.filled[r]++; else bump(c.why[r], key(why[r]), fips); }
      hasCost = hasCost || filled.cost; hasMoney = hasMoney || filled.publicMoney; hasIncome = hasIncome || filled.income;
    }
    for (const n of card.notAssessed) bump(T.notAssessed[n.id] = T.notAssessed[n.id] || {}, key(n.missing[0]), fips);
    // place facts (card-level rows that do not depend on a course): filled or the reason
    for (const pf of (card.placeFacts || [])) {
      const k = pf.id;
      T.place[k] = T.place[k] || { filled: 0, why: {} };
      if (pf.value != null || pf.range || pf.status === "known") T.place[k].filled++; else bump(T.place[k].why, key(pf.why), fips);
      if ((k === "rent_limits" || k === "fmr") && pf.range) hasIncome = true;
      if (k === "qct_dda" && pf.boost === "applies") hasMoney = true;
      if (k === "qct_dda" && pf.boost) hasMoneyKnown = true;
      if (k === "cost" && pf.range) hasCost = true;
    }
    if (hasCost) { T.anyCost++; C.cost++; }
    if (hasMoney) { T.anyMoneyApplies++; C.moneyApplies++; }
    if (hasMoney || hasMoneyKnown) { T.anyMoneyKnown++; C.moneyKnown++; }
    if (hasIncome) { T.anyIncome++; C.income++; }
    if (!hasCost && !hasMoney && !hasIncome) { T.nothing++; C.nothing++; const r = key(card.notAssessed[0] ? card.notAssessed[0].missing[0] : "no course assessed"); bump(T.nothingWhy, r, fips); }
  }
}
// rank
const rank = (o) => Object.entries(o).map(([k, v]) => ({ reason: k, sites: v.sites, counties: Object.keys(v.counties).length, topCounties: Object.entries(v.counties).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => f + ":" + n).join(", ") })).sort((a, b) => b.sites - a.sites);
const blockers = {};
for (const [id, c] of Object.entries(T.courses)) for (const r of rows) for (const [k, v] of Object.entries(c.why[r])) { const b = (blockers[r + ": " + k] = blockers[r + ": " + k] || { sites: 0, counties: {} }); b.sites += v.sites; for (const [f, n] of Object.entries(v.counties)) b.counties[f] = (b.counties[f] || 0) + n; }
for (const [id, o] of Object.entries(T.notAssessed)) for (const [k, v] of Object.entries(o)) { const b = (blockers["course not assessed (" + id + "): " + k] = { sites: v.sites, counties: v.counties }); }
const out = { label, built: new Date().toISOString().slice(0, 10), script: "scripts/measure_site_cards.mjs", inputs: "the page's displayable inputs only (pcSubjects / pcCtx in app/invest.js); no data/internal rows",
  sites: T.sites, counties: T.counties, sitesWithCostRange: T.anyCost, sitesWithPublicMoneyThatApplies: T.anyMoneyApplies, sitesWhereTheLocationRuleIsKnown: T.anyMoneyKnown, sitesWithIncomeRange: T.anyIncome, sitesWithNothing: T.nothing,
  nothingBy: rank(T.nothingWhy), courses: Object.fromEntries(Object.entries(T.courses).map(([k, c]) => [k, { assessed: c.assessed, filled: c.filled, why: Object.fromEntries(rows.map((r) => [r, rank(c.why[r])])) }])),
  notAssessed: Object.fromEntries(Object.entries(T.notAssessed).map(([k, o]) => [k, rank(o)])),
  placeFacts: Object.fromEntries(Object.entries(T.place).map(([k, p]) => [k, { filled: p.filled, why: rank(p.why) }])),
  blockersRanked: rank(blockers).slice(0, 40), byCounty: T.byCounty };
fs.mkdirSync(path.join(root, "data/backtests"), { recursive: true });
fs.writeFileSync(path.join(root, `data/backtests/site_cards_measure_${label}.json`), JSON.stringify(out, null, 1));
const md = [`# Site cards measured (${label}, ${out.built})`, "", `${out.sites} sites in ${out.counties} counties (app/data/station_sites). Inputs: ${out.inputs}.`, "",
  `| Shows | Sites |`, `|---|---|`, `| a cost range (any course or place row) | ${out.sitesWithCostRange} |`, `| a public-money rule that applies to the site (a programme computed for a course, or the 130% tax-credit basis because the site is in a 2027 QCT or DDA) | ${out.sitesWithPublicMoneyThatApplies} |`, `| the location rule known either way (in or not in a 2027 QCT/DDA) | ${out.sitesWhereTheLocationRuleIsKnown} |`, `| an income range (any course, or the place's tax-credit rent ceilings or Fair Market Rents) | ${out.sitesWithIncomeRange} |`, `| none of the three | ${out.sitesWithNothing} |`, "",
  "## Courses assessed and rows filled", "", "| Course | Assessed | Size | Cost | Public money applies | Income | Value |", "|---|---|---|---|---|---|---|",
  ...Object.entries(out.courses).map(([k, c]) => `| ${k} | ${c.assessed} | ${c.filled.size} | ${c.filled.cost} | ${c.filled.publicMoney} | ${c.filled.income} | ${c.filled.value} |`), "",
  "## Courses not assessed, by reason", "", "| Course | Reason | Sites | Counties | Largest counties |", "|---|---|---|---|---|",
  ...Object.entries(out.notAssessed).flatMap(([k, rs]) => rs.map((r) => `| ${k} | ${r.reason.replace(/\|/g, "/")} | ${r.sites} | ${r.counties} | ${r.topCounties} |`)), "",
  "## Place facts (card rows that do not depend on a course)", "", "| Row | Filled | Unfilled reason | Sites | Counties |", "|---|---|---|---|---|",
  ...Object.entries(out.placeFacts).flatMap(([k, p]) => p.why.length ? p.why.map((r, i) => `| ${i ? "" : k} | ${i ? "" : p.filled} | ${r.reason.replace(/\|/g, "/")} | ${r.sites} | ${r.counties} |`) : [`| ${k} | ${p.filled} | - | 0 | 0 |`]), "",
  "## Blocking reasons ranked (course rows and unassessed courses; a site counts once per course)", "", "| # | Row: reason | Site-courses | Counties | Largest counties |", "|---|---|---|---|---|",
  ...out.blockersRanked.map((r, i) => `| ${i + 1} | ${r.reason.replace(/\|/g, "/")} | ${r.sites} | ${r.counties} | ${r.topCounties} |`), "",
  "## Sites showing nothing, by first reason", "", "| Reason | Sites | Counties |", "|---|---|---|", ...out.nothingBy.map((r) => `| ${r.reason.replace(/\|/g, "/")} | ${r.sites} | ${r.counties} |`), "",
  "## By county", "", "| County | Sites | Cost range | Money rule applies | Location rule known | Income range | Nothing |", "|---|---|---|---|---|---|---|",
  ...Object.entries(out.byCounty).map(([f, c]) => `| ${f} ${c.name} | ${c.sites} | ${c.cost} | ${c.moneyApplies} | ${c.moneyKnown} | ${c.income} | ${c.nothing} |`), ""];
fs.writeFileSync(path.join(root, `data/backtests/site_cards_measure_${label}.md`), md.join("\n"));
console.log(md.slice(0, 40).join("\n"));
