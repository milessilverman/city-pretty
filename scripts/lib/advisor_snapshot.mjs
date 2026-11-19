// Builds, in Node, the page-data "snapshot" that app/advisor-scripts.js answers from, using the same files the page
// loads (county bundle, app/data tables) and the same decision engine. Used by the unit tests and by the offline
// scripted-layer eval (npm run eval:advisor -- --scripted). The page builds its snapshot from the live page instead
// (pageSnapshot in app/advisor-scripts.js); this copy differs only where Node has no page helper:
//   - the crash line is a plain rendering of the crash-count file (the page uses crashTextFor, with more caveats);
//   - the back-test honesty line is a short version of honest() in app/invest.js.
// Lot facts are test fixtures passed by the caller, never read from a real parcel here.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const E = require(path.join(root, "src/engines/investmentDecisionEngine.js"));
const read = rel => fs.readFileSync(path.join(root, rel));
const json = rel => JSON.parse(read(rel).toString("utf8"));
const isNum = v => typeof v === "number" && isFinite(v);

let _tables = null;
export function tables() {
  if (_tables) return _tables;
  const la = JSON.parse(zlib.gunzipSync(Buffer.from(read("app/data/bundle-la.b64.txt").toString("utf8").trim(), "base64")).toString("utf8"));
  const cost = json("app/data/transit_cost_benchmarks.json"), eff = json("app/data/transit_value_effects.json");
  const effectMode = l => { const t = String(l || "").toLowerCase(); return /light rail/.test(t) ? "light_rail" : /heavy rail|metro/.test(t) ? "heavy_rail" : /commuter/.test(t) ? "commuter_rail" : /bus rapid|brt/.test(t) ? "brt" : "all_rail"; };
  const vm = json("app/data/county_valuation_models.json");
  _tables = {
    catalog: la.catalog,
    backtest: json("app/data/neighborhood_score_backtest.json"),
    verification: json("app/data/intervention_verification.json"),
    laws: json("app/data/statutes.json"),
    unitCosts: json("app/data/unit_costs.json"),
    valuationModels: vm && vm.counties ? vm : null,
    sites: json("app/data/underused_sites.json"),
    hud: json("app/data/hud_fair_market_rents.json"),
    // the same conversions as engineCosts / engineEffects in app/invest.js
    costBenchmarks: (cost.rows || []).filter(r => r && isNum(r.cost_per_mile_usd_millions)).map(r => ({ mode: r.mode, cost_per_mile: r.cost_per_mile_usd_millions * 1e6, year: r.dollar_year || null, source_url: r.source_url || null })),
    valueEffects: (eff.rows || []).filter(r => r && isNum(r.effect_pct)).map(r => ({ mode: effectMode(r.mode), distance_band: r.distance_band, effect_pct: r.effect_pct, source_url: r.source_url || null })),
  };
  return _tables;
}
const _bundles = {};
export function bundle(fips) {
  if (!_bundles[fips]) _bundles[fips] = JSON.parse(zlib.gunzipSync(read(`counties/bundle_${fips}.json.gz`)).toString("utf8"));
  return _bundles[fips];
}

function honestText(bt, fips, name) {
  const row = (bt.per_metro || []).find(r => r.fips === fips);
  if (!row || (row.engine_rho_P1 == null && row.engine_rho_P2 == null)) return `Not back-tested here: ${name} was not one of the ${bt.sample && bt.sample.counties} counties tested, so treat these as places to investigate, not a forecast.`;
  return `Back-test rank correlation in ${name}: ${row.engine_rho_P2} in 2020-25, ${row.engine_rho_P1} in 2015-20. A screen for relative value, not a forecast of prices.`;
}

// opts: { fips, bg?: block-group id or "default" or null, lot?: { facts (statute-engine parcel facts), address, flood, lastSale, livingSqft, assessorValue } }
export function nodeSnapshot(opts) {
  const T = tables();
  const fips = opts.fips;
  const hudRec = (T.hud.records || []).find(r => r.fips === fips && r.verification && r.verification.status === "verified") || null;
  const snap = { county: { fips, name: null, state: null }, thresholds: E.TRANSIT_THRESHOLDS, hood: null, lot: null, hud: null, brief: null, honest: null, sites: [], acsLabel: "Census ACS 5-year" };
  if (hudRec) snap.hud = { area: hudRec.metro_or_county_name || hudRec.county_name, zip: null, br: [hudRec.zero_bed_eff, hudRec.one_bed_1br, hudRec.two_bed_2br, hudRec.three_bed_3br, hudRec.four_bed_4br], source: `HUD Fair Market Rents FY${hudRec.fiscal_year} (HUD FMR API, pulled ${(T.hud._source && T.hud._source.retrieved) || ""})`, url: (String(hudRec.verification.evidence || "").match(/https?:\/\/\S+/) || [null])[0] };
  snap.sites = T.sites.filter(s => s && s.countyFips === fips).sort((a, b) => (b.acres || 0) - (a.acres || 0))
    .map(s => Object.assign({}, s, { displayName: s.name || ((s.kind ? s.kind.replace(/^./, c => c.toUpperCase()) : "Site") + (s.neighborhoodName ? " in " + s.neighborhoodName : "")) }));
  if (fips === "06037") { snap.county.name = "Los Angeles County"; snap.county.state = "CA"; return snap; }
  const B = bundle(fips);
  snap.county.name = (B.meta && B.meta.county) || fips;
  snap.acsLabel = B.meta && B.meta.acs ? `Census ${B.meta.acs}` : snap.acsLabel;
  snap.honest = { text: honestText(T.backtest, fips, snap.county.name) };
  const bg = opts.bg === "default" ? B.meta.default_bg : opts.bg || null;
  if (bg && B.details[bg]) {
    const m = B.details[bg].m;
    let crash = null;
    const cpath = `app/data/crash_counts/${fips}.json`;
    if (fs.existsSync(path.join(root, cpath))) {
      const cc = json(cpath), c = cc[bg];
      if (Array.isArray(c)) { const n = x => Number.isInteger(+x) ? String(x) : (+x).toFixed(1); crash = { text: `${n(c[2])} crashes recorded inside this block group or on its boundary streets: ${n(c[0])} involving a pedestrian or cyclist, ${n(c[1])} with someone killed or seriously injured` }; }
    } else if (m.ksi != null) crash = { older: +m.ksi };
    const tg = m.tg != null && !isNaN(+m.tg) ? +m.tg : null;
    snap.hood = { id: bg, name: m.n || null, city: m.c || null, preliminary: false, hv: isNum(m.hv) ? m.hv : null, hvNote: null, hvSource: m.hvs || null, rent: isNum(m.rent) ? m.rent : null, rentNote: null, inc: isNum(m.inc) ? m.inc : null, pop: isNum(m.pop) ? m.pop : null,
      canopy: tg != null ? { gap: tg, gapText: tg <= 0 ? "No gap to its goal" : `${tg} pts below its goal`, now: null, src: m.tg_src || "Tree Equity Score 2021 release" } : null, crash };
  }
  if (opts.lot) {
    const L = opts.lot;
    snap.lot = { address: L.address || null, zoning: L.facts ? L.facts.base_zoning_code : null, zoningSource: "test fixture", flood: L.flood || null, floodChecked: L.flood !== undefined, lastSale: L.lastSale || null, livingSqft: L.livingSqft || null, assessorValue: L.assessorValue || null };
  }
  const ctx = { backtest: T.backtest, catalog: T.catalog, verification: T.verification, underusedSites: T.sites, sites: null, costBenchmarks: T.costBenchmarks, valueEffects: T.valueEffects, laws: T.laws, unitCosts: T.unitCosts, valuationModels: T.valuationModels };
  snap.brief = E.buildDecisionBrief(B, { blockGroupId: bg && B.details[bg] ? bg : null, parcel: opts.lot ? opts.lot.facts : null, top: 10 }, ctx);
  return snap;
}

// Fixture lots (test inputs only; not real parcels)
export const FIXTURE_LOTS = {
  travis_sf: { address: "Fixture lot A (test input)", facts: { parcel_id: "FIXTURE-A", state_code: "TX", county_fips: "48453", base_zoning_code: "SF-3", municipality_pop: null, county_pop: null, is_commercial_or_mixed_use: false, is_single_family_residential: true, dist_to_heavy_rail_mi: null, dist_to_frequent_bus_or_brt_mi: null, exclusions: { historic_district_hpoz: false, fema_100yr_floodway: false, calfire_or_state_vhfhsz: null }, lot_sqft: 7000 },
    flood: { zone: "AE", label: "Zone AE (100-year Special Flood Hazard Area; mandatory flood insurance requirement)", sfha: true }, lastSale: { price: 500000, date: "2020-01-01" }, livingSqft: 1250, assessorValue: null },
  sutter_sf: { address: "Fixture lot B (test input)", facts: { parcel_id: "FIXTURE-B", state_code: "CA", county_fips: "06101", base_zoning_code: "R-1", municipality_pop: null, county_pop: null, is_commercial_or_mixed_use: false, is_single_family_residential: true, dist_to_heavy_rail_mi: null, dist_to_frequent_bus_or_brt_mi: null, exclusions: { historic_district_hpoz: false, fema_100yr_floodway: false, calfire_or_state_vhfhsz: false }, lot_sqft: 6000 },
    flood: null, lastSale: null, livingSqft: null, assessorValue: 300000 },
  nozone: { address: "Fixture lot C (test input)", facts: { parcel_id: "FIXTURE-C", state_code: "TX", county_fips: "48453", base_zoning_code: null, is_single_family_residential: false, is_commercial_or_mixed_use: false, exclusions: {}, lot_sqft: null }, flood: undefined },
};
