/**
 * Investment Decision Engine (browser global and CommonJS module; the one copy, loaded by index.html and the tests)
 *
 * Turns a county bundle plus the measured back-test (app/data/neighborhood_score_backtest.json) into ranked,
 * traceable decisions: which neighborhoods, what to build there, what to add to one house, whether transit
 * should be built and at what scale. Pure functions: no network, no file reads. Every table is passed in.
 *
 * Rules: a missing input gives null and a `missing` list, never a default number. Every output number is
 * { value, unit, source, basis } with basis "measured" | "modelled" | "assumed".
 * An improvement idea carries figures only when app/data/intervention_verification.json (ctx.verification) allows it,
 * with the same rule and the same sourced-effect override as the map panel (ivAllows / ivRow in app/app.js; the unit
 * tests run both on the same rows). Without that table every idea is listed by name only.
 * Legality comes from the statute engine (evaluateByRightHousing, app/data/statutes.json passed as ctx.laws); when it
 * does not confirm a law, the answer is "not determined" with its reason.
 *
 * Loading: index.html loads src/engines/investmentDecisionEngine.js after app/app.js (it uses app.js's global
 * evaluateByRightHousing). Everything is wrapped in one function so no names leak; the API is
 * window.InvestmentDecisionEngine. In Node: require() it.
 */
(function () {
"use strict";

const _ideEvalHousing = (typeof evaluateByRightHousing !== "undefined")
  ? evaluateByRightHousing
  : ((typeof require !== "undefined") ? require("./statutoryZoningEngine").evaluateByRightHousing : null);

const DECISION_ENGINE_VERSION = "1.0.0";

// ---------------------------------------------------------------- cited thresholds (fetched 2026-11-18)
const TRANSIT_THRESHOLDS = {
  tcqsm_density: {
    source: {
      title: "TCRP Report 165, Transit Capacity and Quality of Service Manual, 3rd Edition, Chapter 3, Exhibit 3-8 (sources: Pushkarev and Zupan; Institute of Transportation Engineers; Moore et al.)",
      url: "https://onlinepubs.trb.org/onlinepubs/tcrp/tcrp_rpt_165ch-03.pdf",
      retrieved_via: "https://web.archive.org/web/2024id_/https://onlinepubs.trb.org/onlinepubs/tcrp/tcrp_rpt_165ch-03.pdf",
      retrieved: "2026-11-18",
      quote: "Local bus, 1 bus/h 4.5 dwelling units/net acre 5-8 million ft2 | Local bus, 2 bus/h 7 dwelling units/net acre 8-20 million ft2 | Local bus, 6 bus/h 15 dwelling units/net acre 20-50 million ft2 | Light rail, 5-min peak headway 9 dwelling units/net acre in 25-100 mi2 corridor 35-50 million ft2 (20 million ft2 if 100% at-grade) | Rapid transit, 5-min peak headway 12 dwelling units/net acre in 100-150 mi2 corridor >50 million ft2 | Commuter rail, 20 trains/day 1-2 dwelling units/net acre >100 million ft2. Note: Assumes 20 h/weekday service span, 33% fare box recovery.",
      quote_gross_net: "Gross acres, which represent total land area, including that used for streets or not developed, can be approximated by multiplying net acres by a factor of 1.5.",
    },
    gross_to_net_factor: 1.5,
    rows: [
      { mode: "bus_frequency", label: "Local bus, 1 bus/h", buses_per_hour: 1, du_per_net_acre: 4.5, cbd_million_sqft: [5, 8] },
      { mode: "bus_frequency", label: "Local bus, 2 bus/h", buses_per_hour: 2, du_per_net_acre: 7, cbd_million_sqft: [8, 20] },
      { mode: "bus_frequency", label: "Local bus, 6 bus/h", buses_per_hour: 6, du_per_net_acre: 15, cbd_million_sqft: [20, 50] },
      { mode: "light_rail", label: "Light rail, 5-min peak headway", du_per_net_acre: 9, corridor_sq_mi: [25, 100], cbd_million_sqft: [35, 50], cbd_million_sqft_if_all_at_grade: 20 },
      { mode: "heavy_rail", label: "Rapid transit, 5-min peak headway", du_per_net_acre: 12, corridor_sq_mi: [100, 150], cbd_million_sqft_min: 50 },
      { mode: "commuter_rail", label: "Commuter rail, 20 trains/day", du_per_net_acre: [1, 2], cbd_million_sqft_min: 100 },
    ],
  },
  fta_cig: {
    source: {
      title: "FTA Capital Investment Grants Final Policy Guidance, November 2025",
      url: "https://www.transit.dot.gov/sites/fta.dot.gov/files/2025-11/CIG-Policy-Guidance-November-2025.pdf",
      retrieved_via: "https://web.archive.org/web/2025id_/https://www.transit.dot.gov/sites/fta.dot.gov/files/2025-11/CIG-Policy-Guidance-November-2025.pdf",
      retrieved: "2026-11-18",
      quote_land_use: "High >= 15,000 | Medium-High 9,600 - 14,999 | Medium 5,760 - 9,599 | Medium-Low 2,560 - 5,759 | Low <= 2,559 (average population density, persons/square mile); High >= 220,000 | Medium-High 140,000-219,999 | Medium 70,000-139,999 | Medium-Low 40,000-69,999 | Low <= 39,999 (employment served by system)",
      quote_cost_effectiveness: "Cost Effectiveness Breakpoints (for use in 2025): High < $8.00 | Medium-High Between $8.00 and $9.99 | Medium Between $10.00 and $19.99 | Medium-Low Between $20.00 and $34.99 | Low > $35.00",
      quote_warrants: "< $60 million and 2,100 Transit Riders | $60 - $120 million and 4,200 Transit Riders | $120 - $210 million and 6,300 Transit Riders | $210 - $300 million and 8,400 Transit Riders | $300 - $600 million and 10,500 Transit Riders | > $600 million not eligible for warrants",
      quote_new_starts: "New Starts projects must be new fixed guideway projects or extensions to existing fixed guideway systems [Section 5309(a)(5)] that have a total estimated capital cost of $400 million or more or that are seeking $150 million or more in CIG program funds.",
      quote_brt: "Short headway service on weekdays consists of either (a) fifteen-minute maximum headways throughout the day or (b) ten-minute maximum headways during peak periods and twenty-minute maximum headways at all other times.",
      quote_cost_per_trip: "the cost effectiveness measure is computed as the annualized capital cost plus annual O&M cost of the project divided by the annual number of forecasted trips on the project.",
    },
    population_density_per_sq_mi: [
      { rating: "High", min: 15000 }, { rating: "Medium-High", min: 9600 }, { rating: "Medium", min: 5760 }, { rating: "Medium-Low", min: 2560 }, { rating: "Low", min: 0 },
    ],
    employment_served: [
      { rating: "High", min: 220000 }, { rating: "Medium-High", min: 140000 }, { rating: "Medium", min: 70000 }, { rating: "Medium-Low", min: 40000 }, { rating: "Low", min: 0 },
    ],
    cost_per_trip_usd_2025: [
      { rating: "High", max_exclusive: 8 }, { rating: "Medium-High", max_exclusive: 10 }, { rating: "Medium", max_exclusive: 20 }, { rating: "Medium-Low", max_exclusive: 35 }, { rating: "Low", max_exclusive: Infinity },
    ],
    warrants: [
      { max_capital_musd: 60, min_existing_riders: 2100 }, { max_capital_musd: 120, min_existing_riders: 4200 }, { max_capital_musd: 210, min_existing_riders: 6300 },
      { max_capital_musd: 300, min_existing_riders: 8400 }, { max_capital_musd: 600, min_existing_riders: 10500 },
    ],
    new_starts_min_capital_musd: 400,
    brt_max_peak_headway_min: 10, brt_max_offpeak_headway_min: 20, brt_max_allday_headway_min: 15,
  },
  fra_hsr: {
    source: {
      title: "Congressional Research Service R42584, The Development of High Speed Rail in the United States: Issues and Recent Events (quoting FRA's definition)",
      url: "https://www.everycrsreport.com/reports/R42584.html",
      retrieved: "2026-11-18",
      quote: "FRA has defined high speed rail as service \"that is time-competitive with air and/or auto for travel markets in the approximate range of 100 to 500 miles.",
    },
    distance_miles: [100, 500],
  },
};

const RATING_ORDER = ["Low", "Medium-Low", "Medium", "Medium-High", "High"];
const GRADES = ["A", "B", "C", "D"];
const MODE_ORDER = ["bus_frequency", "brt", "light_rail", "heavy_rail", "commuter_rail", "hsr"];
const MODE_ALIASES = {
  bus: "bus_frequency", bus_frequency: "bus_frequency", local_bus: "bus_frequency", frequent_bus: "bus_frequency",
  brt: "brt", bus_rapid_transit: "brt",
  light_rail: "light_rail", lrt: "light_rail", streetcar: "light_rail", tram: "light_rail",
  heavy_rail: "heavy_rail", subway: "heavy_rail", metro: "heavy_rail", rapid_transit: "heavy_rail",
  commuter_rail: "commuter_rail", regional_rail: "commuter_rail", regional: "commuter_rail",
  hsr: "hsr", high_speed_rail: "hsr", intercity_rail: "hsr",
};

// ---------------------------------------------------------------- small helpers
function tv(value, unit, source, basis) {
  const ok = value != null && typeof value === "number" && isFinite(value);
  return { value: ok ? value : null, unit, source: source || null, basis: ok ? basis : null };
}
const num = x => (x != null && typeof x === "number" && isFinite(x)) ? x : null;
const round = (x, d) => x == null ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
const normMode = m => MODE_ALIASES[String(m || "").toLowerCase().replace(/[\s-]+/g, "_")] || null;
function medianOf(xs) { const s = xs.slice().sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; }
function percentileRanks(values) { // values: array of numbers (no nulls); returns (rank-0.5)/n in (0,1), ties averaged
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const r = (i + j) / 2 + 0.5; for (let k = i; k <= j; k++) out[idx[k][1]] = r / values.length; i = j + 1; }
  return out;
}
const fmtUsd = v => v == null ? "unknown" : "$" + (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : Math.round(v).toLocaleString("en-US"));
const fmtPct = (v, d = 1) => v == null ? "unknown" : (v > 0 ? "+" : "") + v.toFixed(d) + "%";
const downgrade = (g, n = 1) => GRADES[Math.min(GRADES.length - 1, GRADES.indexOf(g) + n)];

// The neighborhood features the back-test can score from a bundle block group (field m of details[geoid]).
const FEATURE_FROM_BUNDLE = {
  log_value: m => (num(m.hv) && m.hv > 0) ? Math.log(m.hv) : null,
  rent_to_value: m => (num(m.rent) && num(m.hv) && m.hv > 0) ? (12 * m.rent) / m.hv : null,
  log_income: m => (num(m.inc) && m.inc > 0) ? Math.log(m.inc) : null,
  value_to_income: m => (num(m.hv) && num(m.inc) && m.inc > 0) ? m.hv / m.inc : null,
  renter_share: m => num(m.own) != null ? 1 - m.own / 100 : null,
  year_built: m => num(m.yb),
  single_family: m => num(m.sf) != null ? m.sf / 100 : null,
  no_vehicle: m => num(m.nocar) != null ? m.nocar / 100 : null,
  log_unit_density: m => (num(m.homes) && num(m.acres) && m.acres > 0 && m.homes > 0) ? Math.log(m.homes / (m.acres / 640)) : null,
};
const FEATURE_INPUTS = { log_value: ["hv"], rent_to_value: ["rent", "hv"], log_income: ["inc"], value_to_income: ["hv", "inc"], renter_share: ["own"], year_built: ["yb"], single_family: ["sf"], no_vehicle: ["nocar"], log_unit_density: ["homes", "acres"] };

function backtestModel(backtest) {
  if (!backtest || !backtest.engine_model || !Array.isArray(backtest.engine_model.weights)) return null;
  const weights = backtest.engine_model.weights.filter(w => w.supported && num(w.weight) != null && w.weight !== 0 && FEATURE_FROM_BUNDLE[w.signal]);
  return { weights, role: (backtest.verdict && backtest.verdict.engine_role) || "screen", backtest };
}
function quintileHistory(backtest, q) { // q: 1..5 (5 = highest score)
  const t = backtest && backtest.engine_model && backtest.engine_model.score_quintile_relative_change_pct;
  if (!t) return null;
  const p2 = t.P2_fit_on_P1 ? num(t.P2_fit_on_P1[q - 1]) : null, p1 = t.P1_fit_on_P2 ? num(t.P1_fit_on_P2[q - 1]) : null;
  return {
    "2020_2025": tv(p2, "% vs county median tract, 5 years", "FHFA tract HPI; back-test weights fitted on 2015-2020 only", "measured"),
    "2015_2020": tv(p1, "% vs county median tract, 5 years", "FHFA tract HPI; back-test weights fitted on 2020-2025 only", "measured"),
  };
}
function countyEvidence(backtest, fips) {
  const row = backtest && Array.isArray(backtest.per_metro) ? backtest.per_metro.find(r => r.fips === fips) : null;
  if (!row || (row.engine_rho_P1 == null && row.engine_rho_P2 == null)) return { inSample: false, row: row || null };
  return { inSample: true, row };
}
// Screening checks on the inputs (not back-tested; thresholds are this engine's assumptions and are named in the text).
const DATA_CHECKS = { maxRentToValue: 0.25, minOwnerHomes: 30 };
function dataFlags(m, vals) {
  const f = [];
  if (vals && vals.rent_to_value != null && vals.rent_to_value > DATA_CHECKS.maxRentToValue) f.push(`a year's rent is ${(vals.rent_to_value * 100).toFixed(0)}% of the median home value (over the engine's ${DATA_CHECKS.maxRentToValue * 100}% check): the value may reflect mobile homes, land-only sales or very few owner homes`);
  const owners = num(m.homes) != null && num(m.own) != null ? m.homes * m.own / 100 : null;
  if (owners != null && owners < DATA_CHECKS.minOwnerHomes) f.push(`about ${Math.round(owners)} owner-occupied homes (under the engine's ${DATA_CHECKS.minOwnerHomes}-home check), so the median value has a wide margin of error`);
  return f;
}
function gradeFromEvidence(model, ev) {
  // A is reserved for a score that beat both baselines out of sample; the back-test found none.
  let g = model.role === "predictor" ? "A" : "B";
  const reasons = [model.role === "predictor" ? "score beat the momentum and cheapest-tract baselines out of sample" : "score did not beat the cheapest-tract baseline out of sample, so it is a screen (best grade B)"];
  if (!ev.inSample) { g = downgrade(g); reasons.push("this county was not in the back-test sample"); }
  else {
    const r1 = ev.row.engine_rho_P1, r2 = ev.row.engine_rho_P2;
    if ((r2 != null && r2 <= 0) || (r1 != null && r1 <= 0)) { g = "D"; reasons.push(`in this county the score's rank correlation with later price growth was ${r1 == null ? "n/a" : r1} (2015-20) and ${r2 == null ? "n/a" : r2} (2020-25): it failed here at least once`); }
    else if ((r2 != null && r2 < 0.2) || (r1 != null && r1 < 0.2)) { g = downgrade(g); reasons.push(`in this county the rank correlation was weak (${r1} in 2015-20, ${r2} in 2020-25)`); }
    else reasons.push(`in this county the rank correlation was ${r1} (2015-20) and ${r2} (2020-25)`);
  }
  return { grade: g, reasons };
}

// ---------------------------------------------------------------- 1. neighborhoods
/**
 * rankNeighborhoods(countyBundle, opts)
 *   countyBundle: a decoded counties/bundle_<fips>.json.gz (needs .details and .meta)
 *   opts.backtest: the parsed app/data/neighborhood_score_backtest.json (required)
 *   opts.limit (default all), opts.minHomes (default 0)
 */
function rankNeighborhoods(countyBundle, opts) {
  opts = opts || {};
  const missing = [];
  if (!countyBundle || !countyBundle.details) missing.push("countyBundle.details");
  const model = backtestModel(opts.backtest);
  if (!model) missing.push("opts.backtest (app/data/neighborhood_score_backtest.json)");
  if (missing.length) return { role: null, ranked: [], unscored: [], missing };
  const fips = (countyBundle.meta && countyBundle.meta.fips) || null;
  const acs = (countyBundle.meta && countyBundle.meta.acs) || "Census ACS 5-year";
  const ids = Object.keys(countyBundle.details).sort();
  const feats = model.weights.map(w => w.signal);
  const rows = [], unscored = [];
  for (const id of ids) {
    const d = countyBundle.details[id] || {}, m = d.m || {};
    if (opts.minHomes && !(num(m.homes) >= opts.minHomes)) continue;
    const vals = {}, miss = [];
    for (const s of feats) { const v = FEATURE_FROM_BUNDLE[s](m); vals[s] = v; if (v == null) for (const f of FEATURE_INPUTS[s]) if (num(m[f]) == null && !miss.includes(f)) miss.push(f); }
    if (miss.length) unscored.push({ id, name: m.n || null, city: m.c || null, score: null, missing: miss });
    else rows.push({ id, m, vals });
  }
  const pct = {};
  for (const s of feats) { const p = percentileRanks(rows.map(r => r.vals[s])); rows.forEach((r, i) => { (pct[r.id] = pct[r.id] || {})[s] = p[i]; }); }
  const ev = countyEvidence(model.backtest, fips);
  const gradeBase = gradeFromEvidence(model, ev);
  for (const r of rows) {
    r.raw = model.weights.reduce((a, w) => a + w.weight * (pct[r.id][w.signal] - 0.5), 0);
  }
  const scorePct = percentileRanks(rows.map(r => r.raw));
  rows.forEach((r, i) => { r.scorePct = scorePct[i]; });
  rows.sort((a, b) => b.raw - a.raw || (a.id < b.id ? -1 : 1));
  const src = f => `${acs} (bundle field ${f}), counties/bundle_${fips}.json.gz`;
  const ranked = rows.map((r, i) => {
    const m = r.m, q = Math.min(5, Math.floor(r.scorePct * 5) + 1);
    const components = model.weights.map(w => ({
      signal: w.signal, label: w.label,
      input: tv(r.vals[w.signal], w.signal === "rent_to_value" ? "annual rent / value" : w.signal === "value_to_income" ? "value / income" : "log", src(w.bundle_field), "measured"),
      countyPercentile: tv(round(pct[r.id][w.signal] * 100, 1), "percentile within county", "computed from the bundle", "measured"),
      weight: tv(w.weight, "log points of 5-yr relative price change per full percentile span", "app/data/neighborhood_score_backtest.json engine_model.weights", "measured"),
      contribution: round(w.weight * (pct[r.id][w.signal] - 0.5), 4),
    }));
    let grade = gradeBase.grade; const gradeReasons = gradeBase.reasons.slice();
    if (/tract/i.test(m.hvs || "")) { grade = downgrade(grade); gradeReasons.push("home value is the surrounding tract's median, not this block group's"); }
    const flags = dataFlags(m, r.vals);
    if (flags.length) { grade = "D"; gradeReasons.push("data check: " + flags.join("; ")); }
    const reasons = [];
    const vp = pct[r.id].log_value, rv = pct[r.id].rent_to_value, ip = pct[r.id].log_income;
    if (vp != null) reasons.push(`Typical home value ${fmtUsd(m.hv)}: ${vp <= 0.5 ? "cheaper than " + Math.round((1 - vp) * 100) + "%" : "dearer than " + Math.round(vp * 100) + "%"} of block groups in the county.`);
    if (rv != null) reasons.push(`Rent is ${(r.vals.rent_to_value * 100).toFixed(1)}% of home value a year, higher than in ${Math.round(rv * 100)}% of block groups.`);
    if (ip != null) reasons.push(`Median household income ${fmtUsd(m.inc)} (${Math.round(ip * 100)}th percentile in the county).`);
    const hist = quintileHistory(model.backtest, q);
    if (hist && hist["2020_2025"].value != null) reasons.push(`In the back-test, tracts in this score fifth (${q} of 5) went on to gain ${fmtPct(hist["2020_2025"].value)} vs their county's median tract over 2020-25 and ${fmtPct(hist["2015_2020"].value)} over 2015-20 (averages; individual tracts varied widely).`);
    reasons.push(model.role === "screen" ? "This is a relative-value screen (cheap for its county, high rent for its price), not a forecast; it did no better than simply picking the cheapest tracts." : "Score beat simple baselines in the back-test.");
    return {
      rank: i + 1, id: r.id, name: m.n || null, city: m.c || null,
      score: tv(round(r.scorePct * 100, 1), "percentile within county (100 = strongest relative-value signal)", "investmentDecisionEngine.rankNeighborhoods", "modelled"),
      scoreQuintile: q,
      historicalRelativeChange: hist,
      components,
      confidence: { grade, reasons: gradeReasons },
      dataFlags: flags,
      reasons,
      missing: [],
    };
  });
  const limit = opts.limit ? Math.max(0, opts.limit | 0) : ranked.length;
  return {
    role: model.role,
    county: { fips, name: (countyBundle.meta && countyBundle.meta.county) || null, acs },
    method: "Within-county percentile of each back-test-supported bundle field, weighted by app/data/neighborhood_score_backtest.json engine_model.weights; score = percentile of the weighted sum.",
    countyEvidence: ev.row,
    ranked: ranked.slice(0, limit),
    rankedCount: ranked.length,
    unscored,
    missing: [],
  };
}

// ---------------------------------------------------------------- 2. what to build in a neighborhood
const REC_KEYS = ["id", "project", "homes", "cost", "capex", "land", "om", "value", "vpd", "pct", "why", "qol"];
const EVIDENCE_RANK = { "borrowed study": 0, assumed: 1 };
const IV_FILE = "app/data/intervention_verification.json";
const ivUsable = st => st === "verified" || st === "partially_verified";
// May an idea show figures for a block group with metrics m? Same rule as ivAllows in app/app.js.
function ideaAllowed(id, m, verification, fips) {
  const r = verification && verification[id];
  if (!r || !ivUsable(r.status)) return false;
  const cond = r.applies_if;
  if (cond && cond.median_household_income_below != null) {
    const inc = m && m.inc != null ? +m.inc : NaN;
    if (!(inc < cond.median_household_income_below)) return false;
  }
  if (cond && Array.isArray(cond.state_fips_in)) {
    if (!cond.state_fips_in.includes(String(fips || "").slice(0, 2))) return false;
  }
  return true;
}
// A bundle row with the sourced-effect override applied. Same arithmetic as ivRow in app/app.js.
function sourcedRow(a, verification) {
  if (!Array.isArray(a)) return a;
  const r = verification && verification[a[0]], o = r && r.sourced_effect;
  if (o && +o.value_per_dollar > 0 && +a[3] > 0) {
    const b = a.slice();
    b[7] = Math.round(+a[3] * +o.value_per_dollar);
    b[8] = +o.value_per_dollar;
    b._sourced = o;
    return b;
  }
  if (!o || !(+o.pct > 0) || !(+a[9] > 0)) return a;
  const capexSwap = +o.capex > 0 && +o.replaces_capex > 0;
  if (+a[9] === +o.pct && !capexSwap) return a;
  const b = a.slice(), f = +o.pct / +a[9];
  b[7] = Math.round(+a[7] * f);
  if (capexSwap) {
    const oldCapex = +a[4] > 0 ? +a[4] : +o.replaces_capex;
    b[3] = Math.max(0, Math.round(+a[3] - oldCapex + +o.capex));
    b[4] = +o.capex;
  }
  b[8] = +b[3] ? Math.round((b[7] / +b[3]) * 1000) / 1000 : 0;
  b[9] = +o.pct;
  b._sourced = o;
  return b;
}
// Evidence tier from the verification audit. The catalog's own A-D grade is carried as `grade` (the build's own rating)
// and never raises the tier: the grade-A "local sales estimate" could not be reproduced (docs/audit/bundle-catalog-audit.md).
function evidenceFor(id, catalog, verification) {
  const c = catalog && catalog[id];
  if (!c) return { grade: null, tier: "assumed", verification: null, sources: [], note: "no catalog entry passed in ctx.catalog" };
  const g = c.grade && c.grade !== "none" ? c.grade : null, sources = Array.isArray(c.sources) ? c.sources : [];
  const r = verification ? verification[id] : null, st = r && r.status ? r.status : (verification ? "unverified" : null);
  const base = { grade: g, verification: st, sources, caveat: c.caveat || null, evidenceNote: r && r.evidence ? String(r.evidence) : null };
  if (!verification) return Object.assign(base, { tier: "assumed", note: `verification table (${IV_FILE}) not loaded, so no figure is shown` });
  if (st === "verified") return Object.assign(base, { tier: "borrowed study", note: "effect size and cost found in their cited sources (studies from elsewhere); the model that applies them here has not been checked against real outcomes" + (r.caution ? "; caution: " + r.caution : "") });
  if (st === "partially_verified") return Object.assign(base, { tier: "borrowed study", note: "partly verified: " + (r.partial_reason || (r.effect === "checked" ? "cost not re-checked" : r.cost === "checked" ? "effect not confirmed" : "effect and cost not re-checked")) });
  return Object.assign(base, { tier: "assumed", note: "effect size or cost could not be confirmed against a source" });
}
/**
 * recommendForNeighborhood(blockGroup, ctx)
 *   blockGroup: { id, m, r } (details[geoid] of a bundle plus its id; r = the bundle's raw rows)
 *   ctx.catalog: the idea catalog (D.catalog from the LA bundle); ctx.countyFips
 *   ctx.verification: app/data/intervention_verification.json (without it no idea carries figures)
 *   ctx.underusedSites: rows of app/data/underused_sites.json (optional); ctx.sites: sites_<fips> entries for this block group (optional)
 */
function recommendForNeighborhood(blockGroup, ctx) {
  ctx = ctx || {};
  const missing = [];
  if (!blockGroup || !blockGroup.m) return { id: blockGroup && blockGroup.id || null, ideas: [], withheld: [], housingPlays: [], missing: ["blockGroup.m"] };
  if (!ctx.catalog) missing.push("ctx.catalog (idea names, kinds and sources)");
  if (!ctx.verification) missing.push(`ctx.verification (${IV_FILE}); until it is loaded no idea shows a figure`);
  const fips = ctx.countyFips || (blockGroup.id ? String(blockGroup.id).slice(0, 5) : null);
  const bsrc = `counties/bundle_${fips}.json.gz details.r (pipeline estimate)`;
  const m = blockGroup.m;
  const withheld = [];
  const ideas = [];
  for (const a0 of (blockGroup.r || [])) {
    const id0 = Array.isArray(a0) ? a0[0] : a0 && a0.id;
    const c = (ctx.catalog && ctx.catalog[id0]) || null;
    if (!c) continue;   // the map panel drops rows the catalog does not know (gateRecs)
    const ev = evidenceFor(id0, ctx.catalog, ctx.verification);
    if (!ideaAllowed(id0, m, ctx.verification, fips)) {
      if (!withheld.some(w => w.id === id0)) {
        const rv = ctx.verification && ctx.verification[id0];
        withheld.push({ id: id0, name: c.name || id0, kind: c.kind || null, verification: ev.verification,
          reason: !ctx.verification ? `verification table (${IV_FILE}) not loaded` : rv && ivUsable(rv.status) ? `the study it relies on does not apply here (applies_if in ${IV_FILE})` : `effect size or cost could not be confirmed against a source (${IV_FILE})` });
      }
      continue;
    }
    const a = sourcedRow(a0, ctx.verification);
    const r = Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]]));
    const kind = c.kind || null;
    const returns = kind === "value" || kind === "owner" || kind === "regional";
    const vsrc = a._sourced ? `${bsrc}, value rescaled to the sourced effect in ${IV_FILE}` : bsrc;
    ideas.push({
      id: r.id, name: c.name || r.id, kind, project: r.project || null, why: r.why || null,
      homesReached: tv(num(r.homes), "homes", bsrc, "modelled"),
      cost: tv(num(r.cost), "USD (build + land + 10-yr upkeep)", bsrc, "modelled"),
      valueAdded: tv(returns ? num(r.value) : null, "USD of nearby home value", vsrc, "modelled"),
      valuePerDollar: tv(returns ? num(r.vpd) : null, "USD of home value per USD spent", vsrc, "modelled"),
      priceLiftPct: tv(returns ? num(r.pct) : null, "% per reached home", a._sourced ? IV_FILE : (ev.sources[0] || bsrc), "modelled"),
      evidence: ev,
      missing: returns && num(r.vpd) == null ? ["value per dollar"] : [],
    });
  }
  const byReturn = ideas.filter(x => x.valuePerDollar.value != null).sort((a, b) => b.valuePerDollar.value - a.valuePerDollar.value || (a.id < b.id ? -1 : 1));
  const pays = x => (x.valuePerDollar.value != null && x.valuePerDollar.value >= 1) ? 0 : 1;
  const gradeRank = x => { const i = GRADES.indexOf(x.evidence.grade); return i < 0 ? 9 : i; };
  const ranked = ideas.slice().sort((a, b) => (EVIDENCE_RANK[a.evidence.tier] - EVIDENCE_RANK[b.evidence.tier]) || (pays(a) - pays(b)) || (gradeRank(a) - gradeRank(b)) || ((b.valuePerDollar.value ?? -1) - (a.valuePerDollar.value ?? -1)) || (a.id < b.id ? -1 : 1));

  // housing plays
  const plays = [];
  const adu = ideas.find(x => x.id === "adu");
  const aduHeld = withheld.find(x => x.id === "adu");
  plays.push({
    play: "adu", label: "Backyard home (ADU) on a typical lot here",
    available: adu || aduHeld ? "pipeline found single-family lots" : "not determined", legal: "not determined at block-group level: depends on each parcel's zoning (open a lot on the map)",
    cost: adu ? adu.cost : tv(null, "USD", null, null), valueAdded: adu ? adu.valueAdded : tv(null, "USD", null, null), valuePerDollar: adu ? adu.valuePerDollar : tv(null, "USD per USD", null, null),
    evidence: adu ? adu.evidence : { tier: "assumed", grade: null, verification: aduHeld ? aduHeld.verification : null, sources: [] },
    missing: adu ? [] : [aduHeld ? "ADU figures withheld: " + aduHeld.reason : "bundle ADU row"],
  });
  plays.push({ play: "lot_split", label: "Split a lot into two parcels", available: "not determined", legal: "not determined at block-group level: needs the parcel's zoning code and state law (open a lot on the map)", cost: tv(null, "USD", null, null), valueAdded: tv(null, "USD", null, null), valuePerDollar: tv(null, "USD per USD", null, null), evidence: { tier: "assumed", grade: null, sources: [] }, missing: ["parcel zoning", "lot-split sale comps"] });
  plays.push({ play: "small_multifamily", label: "Small apartment building (2-19 homes)", available: "not determined", legal: "not determined: needs parcel zoning", cost: tv(null, "USD", null, null), valueAdded: tv(null, "USD", null, null), valuePerDollar: tv(null, "USD per USD", null, null), evidence: { tier: "assumed", grade: null, sources: [] }, missing: ["construction cost per sq ft for the region (app/data/unit_costs.json lists public-works items only)", "rents or sale prices of new small buildings"] });
  // A site's model-output fields (verification.unverified_fields) carry no figure; the record's own note says why.
  const siteNum = (s, f, unit, src, basis) => {
    const v = s.verification || {};
    if ((v.unverified_fields || []).some(u => String(u).split(/[\s(]/)[0] === f)) return Object.assign(tv(null, unit, src, null), { withheld: String((v.model_output_fields && v.model_output_fields[f]) || "listed as unverified in the site record") });
    return tv(num(s[f]), unit, src, basis);
  };
  const sites = (ctx.underusedSites || []).filter(s => s && s.blockGroupId === blockGroup.id).map(s => ({
    id: s.id, name: s.name || null, kind: s.kind || null, acres: siteNum(s, "acres", "acres", s.sourceUrl || "app/data/underused_sites.json", "measured"),
    potentialHomes: siteNum(s, "potentialHomes", "homes", "app/data/underused_sites.json", "modelled"), margin: siteNum(s, "margin", "USD", "app/data/underused_sites.json", "modelled"),
    zoning: s.zoningCategory || null, distanceToRailMeters: siteNum(s, "distanceToRailMeters", "m", "app/data/underused_sites.json", "measured"),
    verification: (s.verification && s.verification.status) || "unverified",
  })).sort((a, b) => (b.acres.value ?? -Infinity) - (a.acres.value ?? -Infinity) || (a.id < b.id ? -1 : 1));
  plays.push({ play: "underused_site_conversion", label: "Build homes on an underused site (parking lot, golf course, vacant lot)", available: sites.length ? `${sites.length} site(s) listed` : (ctx.underusedSites ? "none listed in this block group" : "not determined"), legal: "depends on each site's zoning", sites, evidence: { tier: sites.length ? "borrowed study" : "assumed", grade: null, sources: sites.length ? ["app/data/underused_sites.json"] : [] }, missing: ctx.underusedSites ? [] : ["ctx.underusedSites"] });
  const placeSites = (ctx.sites || []).map(s => ({ type: s.t, idea: s.p, name: s.nm || s.street || s.dest || null, cost: Array.isArray(s.cost) ? { low: tv(num(s.cost[0]), "USD", "counties/sites bundle", "modelled"), high: tv(num(s.cost[1]), "USD", "counties/sites bundle", "modelled") } : null }));

  return {
    id: blockGroup.id || null, name: m.n || null, city: m.c || null,
    ideas: ranked, byReturn: byReturn.map(x => x.id), withheld, housingPlays: plays, places: placeSites,
    ordering: "ideas that passed the verification audit, sorted by evidence tier, then those returning at least $1 per $1, then the catalog's own grade (A-D), then value per dollar; byReturn sorts by value per dollar alone; withheld lists the rest by name, with no figures",
    caveats: [
      "Costs and value gains are the pipeline's estimates; an idea shows them only where the data audit confirmed its effect size or cost against a source (app/data/intervention_verification.json). The model that applies them here has not been checked against real outcomes.",
      "Effect sizes come from studies in other places, not from sales in this county.",
      "Value gains are for nearby homes in total, not cash to whoever pays.",
    ],
    missing,
  };
}

// ---------------------------------------------------------------- 3. one house
const EXPANSIONS = [
  { id: "adu", label: "Backyard home (ADU)", sizeKey: "aduSqft" },
  { id: "added_bedroom", label: "Add a bedroom", sizeKey: "bedroomSqft" },
  { id: "added_bathroom", label: "Add a bathroom", sizeKey: "bathroomSqft" },
  { id: "second_storey", label: "Add a second storey", sizeKey: "secondStoreySqft" },
  { id: "lot_split", label: "Split the lot", sizeKey: null },
];
// A cost row the engine may use: an injected { low, high, unit } row, or an app/data/unit_costs.json row
// ({ unit_price, unit: "SF" | "EA" ... }) that is confirmed and verified or partly verified. Other units (SY, LF, mile)
// do not price a house addition and are skipped.
function costRow(x) {
  if (!x) return null;
  if (num(x.low) != null || num(x.high) != null) return x;
  if (num(x.unit_price) == null || x.status !== "confirmed" || !ivUsable(x.verification && x.verification.status)) return null;
  const unit = x.unit === "SF" ? "USD/sqft" : x.unit === "EA" ? "USD/each" : null;
  return unit ? Object.assign({}, x, { low: x.unit_price, high: x.unit_price, unit }) : null;
}
function pickRow(rows, item, state, county) {
  const r = (rows || []).filter(x => x && x.item === item).map(costRow).filter(Boolean);
  return r.find(x => x.county_fips && x.county_fips === county) || r.find(x => x.state === state) || r.find(x => x.state === "US" || x.region === "national") || null;
}
function valueRow(rows, item, state, county) {
  const r = (rows || []).filter(x => x && x.item === item);
  return r.find(x => x.county_fips && x.county_fips === county) || r.find(x => x.state === state) || r.find(x => x.state === "US" || x.region === "national") || null;
}
const lawById = (laws, id) => (Array.isArray(laws) ? laws : []).find(l => l && l.id === id) || null;
/**
 * recommendForParcel(parcelFacts, ctx)
 *   parcelFacts: { parcel_id, state_code, county_fips, base_zoning_code, municipality_pop, county_pop,
 *                  is_single_family_residential, is_commercial_or_mixed_use, dist_to_heavy_rail_mi, dist_to_frequent_bus_or_brt_mi,
 *                  exclusions, marketValue, livingSqft, lotSqft, stories }
 *   ctx.laws: app/data/statutes.json (passed to the statute engine; in the browser it falls back to the page's copy)
 *   ctx.unitCosts: injected [{ item, state|county_fips, low, high, unit: "USD/sqft"|"USD/each", source_url, year }] or
 *                  app/data/unit_costs.json rows (only confirmed, verified or partly verified SF/EA rows are used)
 *   ctx.valueCoefficients: [{ item, state|county_fips, value_per_sqft | pct_of_value | value_each, source_url, year }]
 *   ctx.valuationModels: app/data/county_valuation_models.json (read only to say why it is not used for additions)
 *   ctx.sizes: { aduSqft, bedroomSqft, bathroomSqft, secondStoreySqft } (sq ft to price; none assumed)
 *   ctx.neighborhood: { medianHomeValue, ceilingValue? }; ctx.overCapRatio (optional threshold; default none)
 *   ctx.zoningEngine: override for evaluateByRightHousing (tests)
 */
function recommendForParcel(parcelFacts, ctx) {
  ctx = ctx || {};
  const p = parcelFacts || {};
  const missing = [];
  const zoningFn = ctx.zoningEngine || _ideEvalHousing;
  let zoning = null;
  const zoningKnown = !!(p.base_zoning_code && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(String(p.base_zoning_code).trim()));
  if (!zoningKnown) missing.push("base_zoning_code");
  if (zoningKnown && zoningFn) {
    const ex = Object.assign({ historic_district_hpoz: false, coastal_commission_or_sma: false, fema_100yr_floodway: false, calfire_or_state_vhfhsz: false, airport_noise_or_runway_zone: false, williamson_or_ag_preserve: false, public_or_tribal_land: false, everglades_or_wekiva_or_trpa: false, population_threshold_ineligible: false }, p.exclusions || {});
    try {
      zoning = zoningFn(Object.assign({}, p, { exclusions: ex, municipality_pop: num(p.municipality_pop), county_pop: num(p.county_pop), dist_to_heavy_rail_mi: num(p.dist_to_heavy_rail_mi), dist_to_frequent_bus_or_brt_mi: num(p.dist_to_frequent_bus_or_brt_mi), lot_sqft: num(p.lot_sqft != null ? p.lot_sqft : p.lotSqft) }), ctx.laws);
    } catch (e) { zoning = null; }
  }
  const statutes = zoning ? zoning.applicable_statutes || [] : [];
  const notConfirmed = zoning ? (zoning.not_confirmed || []).concat(zoning.excluded_by_site || []) : [];   // both carry the engine's reason
  const lawsLoaded = !!(zoning && zoning.laws_loaded !== false);
  // "allowed by state law" only for a law the statute engine applied to this parcel; otherwise not determined, with
  // the engine's own reason for any law of that kind it could not confirm.
  const allowed = s => {
    const rec = lawById(ctx.laws, s.id);
    return { status: "allowed by state law", citation: s.citation, statute_id: s.id || null, statute_url: s.statute_url || null, verification_status: s.verification_status || null, checked: rec ? (rec.last_verified || (rec.verification && rec.verification.checked_on) || null) : null, unconfirmed_fields: s.unconfirmed_fields || [] };
  };
  const heldWhy = (re, fallback) => { const n = notConfirmed.filter(x => re.test(String(x.id) + " " + String(x.name))); return n.length ? n.map(x => `${x.name}: ${x.reason}`).join(" ") : fallback; };
  const legalFor = id => {
    if (!zoningKnown) return { status: "not determined", why: "zoning code unknown" };
    if (!zoning) return { status: "not determined", why: "statute engine not available" };
    if (!lawsLoaded) return { status: "not determined", why: "state law table (app/data/statutes.json) not loaded" };
    if (id === "lot_split") { const s = statutes.find(x => /lot split/i.test(x.citation)); return s ? allowed(s) : { status: "not determined", why: heldWhy(/lot.?split/i, "no state lot-split law on file applies to this parcel; local subdivision rules decide") }; }
    if (id === "adu") {
      const s = p.is_single_family_residential ? (statutes.find(x => /(^|_)adu(_|$)/i.test(String(x.id))) || statutes.find(x => num(x.max_units_by_right) != null && x.max_units_by_right >= 2)) : null;
      return s ? allowed(s) : { status: "not determined", why: heldWhy(/(^|_)adu(_|$)|\bADU\b/i, p.is_single_family_residential ? "no state ADU law on file applies to this parcel; local ADU rules decide" : "the lot is not recorded as single-family, so state ADU laws on file were not applied") };
    }
    return { status: "not determined", why: "set by local height, floor-area and setback rules; no local rule table is loaded" };
  };
  const costItems = [...new Set((ctx.unitCosts || []).map(x => x && x.item).filter(Boolean))];
  const vm = ctx.valuationModels && ctx.valuationModels.counties ? ctx.valuationModels.counties[p.county_fips] : null;
  const mv = num(p.marketValue), sizes = ctx.sizes || {};
  const items = EXPANSIONS.map(e => {
    const miss = [];
    const legal = legalFor(e.id);
    const size = e.sizeKey ? num(sizes[e.sizeKey]) : null;
    const uc = pickRow(ctx.unitCosts, e.id, p.state_code, p.county_fips);
    let costLow = null, costHigh = null, costSrc = uc ? uc.source_url || null : null;
    if (!uc) miss.push(`no sourced cost for "${e.label}" in ${p.state_code || "this state"}` + (costItems.length ? ` (app/data/unit_costs.json lists public-works items only: ${costItems.slice(0, 6).join(", ").replace(/_/g, " ")})` : " (app/data/unit_costs.json not passed in)"));
    else if (uc.unit === "USD/sqft") { if (size == null) miss.push(`ctx.sizes.${e.sizeKey}`); else { costLow = num(uc.low) != null ? uc.low * size : null; costHigh = num(uc.high) != null ? uc.high * size : null; } }
    else { costLow = num(uc.low); costHigh = num(uc.high); }
    const vc = valueRow(ctx.valueCoefficients, e.id, p.state_code, p.county_fips);
    let value = null; const vSrc = vc ? vc.source_url || null : null;
    if (!vc) miss.push(vm && vm.tested && num(vm.tested.mdape) != null
      ? `no sourced value for "${e.label}": this county's home-value model (app/data/county_valuation_models.json, median error ${Math.round(vm.tested.mdape * 1000) / 10}% on recorded sales) was tested on whole-home prices, not on what an addition adds, so it is not used here`
      : `no sourced value for "${e.label}" (needs a local sales study of what it adds)`);
    else if (num(vc.value_per_sqft) != null) { if (size == null) miss.push(`ctx.sizes.${e.sizeKey}`); else value = vc.value_per_sqft * size; }
    else if (num(vc.pct_of_value) != null) { if (mv == null) miss.push("marketValue"); else value = mv * vc.pct_of_value / 100; }
    else if (num(vc.value_each) != null) value = vc.value_each;
    const costMid = costLow != null && costHigh != null ? (costLow + costHigh) / 2 : null;
    const net = value != null && costMid != null ? value - costMid : null;
    // over-capitalisation
    const nb = ctx.neighborhood || {};
    let overCap = { status: "not determined", missing: [] };
    const post = mv != null && value != null ? mv + value : null;
    const postIfCost = mv != null && costHigh != null ? mv + costHigh : null;
    if (num(nb.ceilingValue) != null && (post != null || postIfCost != null)) {
      const v = post != null ? post : postIfCost;
      overCap = { status: v > nb.ceilingValue ? "over-capitalises" : "within ceiling", postProjectValue: tv(v, "USD", post != null ? "marketValue + valueAdded" : "marketValue + high cost (if fully recovered)", post != null ? "modelled" : "assumed"), ceiling: tv(nb.ceilingValue, "USD", nb.ceilingSource || "ctx.neighborhood.ceilingValue", "measured") };
    } else if (num(nb.medianHomeValue) != null && (post != null || postIfCost != null)) {
      const v = post != null ? post : postIfCost;
      const ratio = v / nb.medianHomeValue;
      const thr = num(ctx.overCapRatio);
      overCap = { status: thr == null ? "not determined" : (ratio > thr ? "likely over-capitalises" : "within range"), ratioToNeighborhoodMedian: tv(round(ratio, 2), "x neighborhood median value", nb.medianSource || "block-group median (Census ACS)", post != null ? "modelled" : "assumed"), threshold: tv(thr, "x median", "ctx.overCapRatio (caller's assumption)", "assumed"), missing: thr == null ? ["ctx.overCapRatio or ctx.neighborhood.ceilingValue (e.g. top-decile sale price)"] : [] };
    } else overCap.missing = ["marketValue", "cost or value", "neighborhood ceiling or median"].filter((k, i) => i === 0 ? mv == null : i === 1 ? (value == null && costHigh == null) : (num(nb.ceilingValue) == null && num(nb.medianHomeValue) == null));
    return {
      expansion: e.id, label: e.label, legal,
      cost: { low: tv(costLow, "USD", costSrc, "measured"), high: tv(costHigh, "USD", costSrc, "measured") },
      valueAdded: tv(value, "USD", vSrc, "measured"),
      netValue: tv(net, "USD", "valueAdded - midpoint cost", "modelled"),
      overCapitalisation: overCap,
      missing: miss,
    };
  });
  const ranked = items.slice().sort((a, b) => ((b.netValue.value ?? -Infinity) - (a.netValue.value ?? -Infinity)) || (EXPANSIONS.findIndex(e => e.id === a.expansion) - EXPANSIONS.findIndex(e => e.id === b.expansion)));
  return {
    parcelId: p.parcel_id || null,
    zoning: zoning ? { base_zoning_code: zoning.base_zoning_code, laws_loaded: lawsLoaded, statutes: statutes.map(s => s.citation), not_confirmed: notConfirmed.map(x => `${x.name}: ${x.reason}`), net_by_right_feasible: zoning.net_by_right_feasible, note: "statutes from app/data/statutes.json via the statute engine (evaluateByRightHousing); only laws whose text was checked can apply" } : null,
    expansions: ranked,
    caveats: ["No cost or value is filled in unless a sourced table row is passed in; app/data/unit_costs.json has no house-addition costs and no sourced value of an addition is on file yet.", "A state law marked as allowing something here is a screen, not a permit: the city or county decides."],
    missing,
  };
}

// ---------------------------------------------------------------- 4. transit
function rateMin(rows, v) { if (v == null) return null; for (const r of rows) if (v >= r.min) return r.rating; return null; }
function rateCostPerTrip(v) { if (v == null) return null; for (const r of TRANSIT_THRESHOLDS.fta_cig.cost_per_trip_usd_2025) if (v < r.max_exclusive) return r.rating; return "Low"; }
/**
 * evaluateTransit(corridorOrArea, ctx)
 *   corridorOrArea: { name, lengthMiles, householdsPerGrossAcre | dwellingUnitsPerNetAcre, stationAreaPopDensityPerSqMi,
 *     employmentServed, cbdMillionSqft, allAtGrade, currentBusesPerHour, existingCorridorRiders (weekday),
 *     annualTrips, annualizedCapitalCostUsd, annualOperatingCostUsd, capitalCostUsd, intercityDistanceMiles, mode? }
 *   ctx.costBenchmarks: rows { mode, cost_per_mile, year, source_url } (app/data/transit_cost_benchmarks.json)
 *   ctx.valueEffects: rows { mode, distance_band, effect_pct, source_url } (app/data/transit_value_effects.json)
 */
function evaluateTransit(corridorOrArea, ctx) {
  ctx = ctx || {};
  const a = corridorOrArea || {};
  const T = TRANSIT_THRESHOLDS, missing = [];
  const dsrc = `${T.tcqsm_density.source.title}; ${T.tcqsm_density.source.url}`;
  let duNet = num(a.dwellingUnitsPerNetAcre), duBasis = "measured", duSrc = a.densitySource || "caller";
  if (duNet == null && num(a.householdsPerGrossAcre) != null) { duNet = a.householdsPerGrossAcre * T.tcqsm_density.gross_to_net_factor; duBasis = "modelled"; duSrc = `${a.densitySource || "caller"} gross density x ${T.tcqsm_density.gross_to_net_factor} (TCQSM gross-to-net factor)`; }
  if (duNet == null) missing.push("dwellingUnitsPerNetAcre or householdsPerGrossAcre");
  const cbd = num(a.cbdMillionSqft);
  // density screen: which modes the residential density supports (TCQSM Exhibit 3-8)
  const supports = [];
  if (duNet != null) {
    for (const r of T.tcqsm_density.rows) {
      const need = Array.isArray(r.du_per_net_acre) ? r.du_per_net_acre[0] : r.du_per_net_acre;
      if (duNet < need) continue;
      let cbdOk = null;
      if (r.mode !== "bus_frequency") {
        const cbdNeed = r.mode === "light_rail" ? (a.allAtGrade ? r.cbd_million_sqft_if_all_at_grade : r.cbd_million_sqft[0]) : r.cbd_million_sqft_min;
        cbdOk = cbd == null ? null : cbd >= cbdNeed;
      }
      supports.push({ mode: r.mode, label: r.label, densityNeeded: need, buses_per_hour: r.buses_per_hour || null, cbdOk });
    }
  }
  const busRows = supports.filter(s => s.mode === "bus_frequency");
  const railRows = supports.filter(s => s.mode !== "bus_frequency");
  if (railRows.length && cbd == null) missing.push("cbdMillionSqft (downtown office/commercial floor area) for rail modes");
  const railOk = railRows.filter(s => s.cbdOk === true);
  // FTA CIG land-use rating
  const popRating = rateMin(T.fta_cig.population_density_per_sq_mi, num(a.stationAreaPopDensityPerSqMi));
  const jobRating = rateMin(T.fta_cig.employment_served, num(a.employmentServed));
  // cost
  const mode0 = normMode(a.mode);
  const bench = (ctx.costBenchmarks || []).map(r => Object.assign({}, r, { _mode: normMode(r.mode) })).filter(r => r._mode && num(r.cost_per_mile) != null);
  const costByMode = {};
  for (const mo of MODE_ORDER) {
    const rows = bench.filter(r => r._mode === mo);
    if (!rows.length) continue;
    const med = medianOf(rows.map(r => r.cost_per_mile));
    costByMode[mo] = { costPerMile: tv(med, "USD per mile (median of benchmark rows)", rows.map(r => r.source_url).filter(Boolean).join(" ; ") || "ctx.costBenchmarks", "measured"), rows: rows.length, years: [...new Set(rows.map(r => r.year))].sort(), capital: tv(num(a.lengthMiles) != null ? med * a.lengthMiles : null, "USD", "benchmark median x lengthMiles", "modelled") };
  }
  // cost per trip (FTA definition) when the caller supplies the annualised cost and trips
  const annCost = num(a.annualizedCapitalCostUsd) != null && num(a.annualOperatingCostUsd) != null ? a.annualizedCapitalCostUsd + a.annualOperatingCostUsd : null;
  const cpt = annCost != null && num(a.annualTrips) ? annCost / a.annualTrips : null;
  if (cpt == null) missing.push("annualizedCapitalCostUsd + annualOperatingCostUsd + annualTrips (for FTA cost per trip)");
  const ceRating = rateCostPerTrip(cpt);
  // warrants
  const cap = num(a.capitalCostUsd) != null ? a.capitalCostUsd : (mode0 && costByMode[mode0] ? costByMode[mode0].capital.value : null);
  let warrant = null;
  if (cap != null && num(a.existingCorridorRiders) != null) {
    const w = T.fta_cig.warrants.find(x => cap / 1e6 < x.max_capital_musd);
    warrant = w ? { eligible: a.existingCorridorRiders >= w.min_existing_riders, capitalBandMusd: w.max_capital_musd, ridersNeeded: w.min_existing_riders } : { eligible: false, why: "capital cost above the highest warrant band" };
  }
  // HSR distance band
  const dist = num(a.intercityDistanceMiles);
  const hsr = dist == null ? null : { inBand: dist >= T.fra_hsr.distance_miles[0] && dist <= T.fra_hsr.distance_miles[1], band: T.fra_hsr.distance_miles };
  // scale decision. Urban scale ladder: bus frequency -> BRT -> light rail -> heavy rail. Commuter rail and HSR
  // serve other markets and are reported beside it, not on it.
  let scale = null, verdict = "not_enough_data", proposedModeSupported = null;
  const why = [];
  const alsoSupported = [];
  if (duNet != null) {
    const urbanRail = railOk.filter(s => s.mode === "light_rail" || s.mode === "heavy_rail");
    const topRail = urbanRail.length ? urbanRail.reduce((b, s) => MODE_ORDER.indexOf(s.mode) > MODE_ORDER.indexOf(b.mode) ? s : b) : null;
    const topBus = busRows.length ? busRows[busRows.length - 1] : null;
    if (topRail) { scale = topRail.mode; why.push(`Density ${round(duNet, 1)} homes per net acre and ${cbd}M sq ft downtown meet the "${topRail.label}" guideline (${topRail.densityNeeded} homes/net acre).`); }
    else if (topBus) {
      // FTA's BRT headway rule (10-minute peak) equals the 6 bus/h row, so that row is read as BRT-capable.
      scale = topBus.buses_per_hour >= 6 ? "brt" : "bus_frequency";
      why.push(`Density ${round(duNet, 1)} homes per net acre supports "${topBus.label}" (needs ${topBus.densityNeeded}).`);
      if (scale === "brt") why.push("That is a 10-minute peak bus, the headway FTA requires of BRT; BRT also needs dedicated lanes, branded stations and 14-hour weekday service.");
      if (railRows.some(s => s.mode !== "commuter_rail") && cbd == null) why.push("The rail density guideline is met, but downtown floor area was not given, so rail was not tested.");
    } else { why.push(`Density ${round(duNet, 1)} homes per net acre is below the 1-bus-an-hour guideline (4.5).`); }
    const cr = railRows.find(s => s.mode === "commuter_rail");
    if (cr) { if (cr.cbdOk === true) alsoSupported.push("commuter_rail"); else if (cr.cbdOk == null) why.push("Commuter rail (1-2 homes/net acre) also needs over 100 million sq ft downtown; not given."); }
    if (num(a.currentBusesPerHour) != null && topBus && !topRail) {
      if (a.currentBusesPerHour < topBus.buses_per_hour) why.push(`Current service is ${a.currentBusesPerHour} buses/hr, below the ${topBus.buses_per_hour}/hr this density supports: raise frequency first.`);
      else why.push(`Current service (${a.currentBusesPerHour} buses/hr) already meets what this density supports.`);
    }
    if (mode0 === "commuter_rail") proposedModeSupported = cr ? (cr.cbdOk == null ? null : cr.cbdOk) : false;
    else if (mode0 && mode0 !== "hsr") {
      const row = railRows.find(s => s.mode === mode0);
      proposedModeSupported = (scale != null && MODE_ORDER.indexOf(mode0) <= MODE_ORDER.indexOf(scale)) ? true : (row && row.cbdOk == null ? null : false);
    }
    if (mode0 && proposedModeSupported === false) why.push(`The proposed ${mode0.replace(/_/g, " ")} is larger than this density supports.`);
    if (ceRating) why.push(`Cost per trip $${cpt.toFixed(2)} rates ${ceRating} on FTA's 2025 breakpoints.`);
    const ceBad = ceRating === "Low" || ceRating === "Medium-Low";
    if (mode0) {
      if (proposedModeSupported === false || ceBad) verdict = "do_not_build";
      else if (proposedModeSupported == null) verdict = "not_enough_data";
      else verdict = ceRating ? "build" : "screen_only";
    } else verdict = scale ? "screen_only" : ((cr && cr.cbdOk == null) ? "not_enough_data" : "do_not_build");
  }
  if (mode0 === "hsr") {
    proposedModeSupported = hsr ? hsr.inBand : null;
    const bad = ceRating === "Low" || ceRating === "Medium-Low";
    verdict = !hsr ? "not_enough_data" : (!hsr.inBand || bad) ? "do_not_build" : (ceRating ? "build" : "screen_only");
    if (!hsr) missing.push("intercityDistanceMiles");
  }
  if (hsr) why.push(hsr.inBand ? `Trip of ${dist} miles is inside FRA's 100-500 mile high-speed rail market.` : `Trip of ${dist} miles is outside FRA's 100-500 mile high-speed rail market.`);
  const effects = (ctx.valueEffects || []).filter(r => scale && normMode(r.mode) === scale).map(r => ({ mode: r.mode, distanceBand: r.distance_band, effect: tv(num(r.effect_pct), "% home value", r.source_url || "ctx.valueEffects", "measured") }));
  return {
    name: a.name || null,
    verdict, scale, proposedMode: mode0, proposedModeSupported, alsoSupported,
    verdictMeaning: { build: "the proposed mode is within what density supports and its cost per trip rates Medium or better", do_not_build: "the proposal is larger than density supports, density is below every guideline, or cost per trip rates Medium-Low/Low", screen_only: "density supports this scale; no proposal or no cost per trip, so no build decision", not_enough_data: "a needed input (density, downtown floor area or trip distance) is missing" }[verdict],
    density: { homesPerNetAcre: tv(round(duNet, 2), "dwelling units per net acre", duSrc, duBasis), supports, threshold: dsrc },
    ftaLandUse: { populationDensityRating: popRating, employmentRating: jobRating, source: T.fta_cig.source.url },
    costEffectiveness: { costPerTrip: tv(cpt == null ? null : round(cpt, 2), "USD per trip", "caller's annualised cost / annual trips", "modelled"), rating: ceRating, breakpoints: T.fta_cig.source.quote_cost_effectiveness },
    capitalCost: tv(cap, "USD", num(a.capitalCostUsd) != null ? "caller" : (mode0 && costByMode[mode0] ? costByMode[mode0].capital.source : null), num(a.capitalCostUsd) != null ? "measured" : "modelled"),
    costByMode, warrant, hsr, valueEffects: effects,
    reasons: why,
    sources: [T.tcqsm_density.source.url, T.fta_cig.source.url, T.fra_hsr.source.url],
    missing,
  };
}

// a block group as a transit "area" (gross density from the bundle)
function areaFromBlockGroup(id, m) {
  const acres = num(m.acres), homes = num(m.homes);
  return {
    name: `${m.n || id}${m.c ? ", " + m.c : ""}`,
    householdsPerGrossAcre: acres && homes != null && acres > 0 ? homes / acres : null,
    densitySource: "Census ACS homes / block-group land acres (bundle fields homes, acres)",
    stationAreaPopDensityPerSqMi: acres && num(m.pop) != null && acres > 0 ? m.pop / (acres / 640) : null,
    currentBusesPerHour: num(m.bt),
  };
}

// ---------------------------------------------------------------- 5. the brief
/**
 * buildDecisionBrief(county, selection, ctx)
 *   county: decoded county bundle
 *   selection: { blockGroupId?, parcel?, corridor?, top? (default 10) }
 *   ctx: { backtest, catalog, verification, underusedSites, sites, costBenchmarks, valueEffects, laws, unitCosts, valueCoefficients,
 *          valuationModels, sizes, overCapRatio }
 */
function buildDecisionBrief(county, selection, ctx) {
  selection = selection || {}; ctx = ctx || {};
  const top = selection.top || 10;
  const rank = rankNeighborhoods(county, { backtest: ctx.backtest });
  const fips = rank.county ? rank.county.fips : (county && county.meta && county.meta.fips) || null;
  const compact = r => ({ rank: r.rank, id: r.id, name: r.name, city: r.city, score: r.score.value, quintile: r.scoreQuintile, confidence: r.confidence.grade, reason: r.reasons[0] || null, history2020_25: r.historicalRelativeChange ? r.historicalRelativeChange["2020_2025"].value : null });
  const brief = {
    schema: "city-pretty/decision-brief@1", engineVersion: DECISION_ENGINE_VERSION,
    county: rank.county || { fips },
    role: rank.role,
    howToRead: "Every number is {value, unit, source, basis}. basis: measured = read from a cited table; modelled = computed from measured inputs; assumed = no evidence. null means not known.",
    backtest: ctx.backtest ? { headline: ctx.backtest.headline || null, verdict: ctx.backtest.verdict || null, retrieved: ctx.backtest.retrieved || null } : null,
    topNeighborhoods: (rank.ranked || []).filter(r => !r.dataFlags.length).slice(0, top).map(compact),
    topNeighborhoodsNote: "block groups failing a data check (dataFlags) are left out of this list; rankNeighborhoods still returns them, graded D",
    flaggedInTopN: (rank.ranked || []).slice(0, top).filter(r => r.dataFlags.length).length,
    neighborhood: null, parcel: null, transit: null,
    caveats: [],
    missing: rank.missing.slice(),
  };
  const id = selection.blockGroupId || null;
  if (id && county && county.details && county.details[id]) {
    const d = county.details[id];
    const full = (rank.ranked || []).find(r => r.id === id) || (rank.unscored || []).find(r => r.id === id) || null;
    const sitesForBg = ctx.sites && ctx.sites.sites ? ctx.sites.sites[id] : (Array.isArray(ctx.sites) ? ctx.sites : null);
    const rec = recommendForNeighborhood({ id, m: d.m, r: d.r }, { catalog: ctx.catalog, verification: ctx.verification, countyFips: fips, underusedSites: ctx.underusedSites, sites: sitesForBg || [] });
    brief.neighborhood = {
      ranking: full,
      build: rec.ideas.slice(0, 8).map(x => ({ id: x.id, name: x.name, project: x.project, cost: x.cost, valuePerDollar: x.valuePerDollar, evidence: { tier: x.evidence.tier, verification: x.evidence.verification, catalogGrade: x.evidence.grade } })),
      withheld: rec.withheld.map(x => ({ id: x.id, name: x.name, reason: x.reason })),
      housingPlays: rec.housingPlays,
      places: rec.places.slice(0, 10),
      missing: rec.missing,
    };
    if (!selection.corridor) brief.transit = evaluateTransit(areaFromBlockGroup(id, d.m), { costBenchmarks: ctx.costBenchmarks, valueEffects: ctx.valueEffects });
  } else if (id) brief.missing.push(`block group ${id} not in this bundle`);
  if (selection.corridor) brief.transit = evaluateTransit(selection.corridor, { costBenchmarks: ctx.costBenchmarks, valueEffects: ctx.valueEffects });
  if (!brief.transit) brief.transit = { verdict: "not_enough_data", scale: null, missing: ["selection.corridor or selection.blockGroupId"] };
  if (selection.parcel) {
    const nbm = id && county && county.details && county.details[id] ? county.details[id].m : null;
    brief.parcel = recommendForParcel(selection.parcel, { laws: ctx.laws, unitCosts: ctx.unitCosts, valueCoefficients: ctx.valueCoefficients, valuationModels: ctx.valuationModels, sizes: ctx.sizes, overCapRatio: ctx.overCapRatio, neighborhood: Object.assign({ medianHomeValue: nbm ? num(nbm.hv) : null }, ctx.neighborhood || {}) });
  }
  brief.caveats = [
    (() => {
      const bt = ctx.backtest || {}, n = bt.sample ? bt.sample.counties : null;
      const p2 = bt.per_metro_summary && bt.per_metro_summary.engine_P2 ? bt.per_metro_summary.engine_P2.share_positive : null;
      const tail = p2 != null ? ` In 2020-25 it ranked tracts the right way round in ${Math.round(p2 * 100)}% of counties tested.` : "";
      return rank.role === "screen" ? `The neighborhood score is a relative-value screen. In the back-test (${n == null ? "?" : n} large counties, 2015-20 and 2020-25) it did no better than picking the cheapest tracts in the county.${tail}` : `The neighborhood score beat simple baselines in the back-test.${tail}`;
    })(),
    "Scores rank block groups against their own county only; a county-wide boom or bust is not predicted.",
    "Back-tested on tracts whose boundaries did not change 2010-2020; fast-growing new-build areas are under-represented.",
    "Improvement costs and value gains are pipeline estimates, shown only for ideas whose effect size or cost the data audit confirmed against a source; effect sizes come from studies in other places.",
    "Transit verdicts use planning rules of thumb (TCQSM density guidelines, FTA CIG breakpoints); they are not a ridership forecast.",
  ];
  brief.sources = [
    ...((ctx.backtest && ctx.backtest.sources) || []).map(x => ({ name: x.name, url: x.url })),
    { name: TRANSIT_THRESHOLDS.tcqsm_density.source.title, url: TRANSIT_THRESHOLDS.tcqsm_density.source.url },
    { name: TRANSIT_THRESHOLDS.fta_cig.source.title, url: TRANSIT_THRESHOLDS.fta_cig.source.url },
    { name: TRANSIT_THRESHOLDS.fra_hsr.source.title, url: TRANSIT_THRESHOLDS.fra_hsr.source.url },
  ];
  return brief;
}

// The part of the brief the AI advisor gets (the Worker caps it at DECISION_BRIEF_MAX_CHARS in
// src/ai/advisorGroundingContract.ts): every figure keeps its unit, basis and source; per-signal score tables,
// per-mode cost tables and the threshold rows are left out (they are in TRANSIT_THRESHOLDS and the data files).
function briefForAdvisor(brief) {
  if (!brief) return null;
  const f = x => (x && x.value != null) ? { value: x.value, unit: x.unit, basis: x.basis, source: x.source } : null;
  const n = brief.neighborhood, p = brief.parcel, t = brief.transit;
  return {
    schema: brief.schema, engineVersion: brief.engineVersion, county: brief.county, role: brief.role, howToRead: brief.howToRead,
    backtest: brief.backtest ? { headline: brief.backtest.headline, engine_role: brief.backtest.verdict ? brief.backtest.verdict.engine_role || null : null, retrieved: brief.backtest.retrieved } : null,
    topNeighborhoods: brief.topNeighborhoods, topNeighborhoodsNote: brief.topNeighborhoodsNote, flaggedInTopN: brief.flaggedInTopN,
    neighborhood: n ? {
      id: n.ranking ? n.ranking.id : null, name: n.ranking ? n.ranking.name : null,
      confidence: n.ranking && n.ranking.confidence ? n.ranking.confidence : null, reasons: n.ranking && n.ranking.reasons ? n.ranking.reasons : [],
      build: (n.build || []).map(x => ({ id: x.id, name: x.name, project: x.project, cost: f(x.cost), valuePerDollar: f(x.valuePerDollar), evidence: x.evidence })),
      withheld: n.withheld || [],
      housingPlays: (n.housingPlays || []).map(h => ({ play: h.play, label: h.label, available: h.available, legal: h.legal, cost: f(h.cost), valueAdded: f(h.valueAdded), valuePerDollar: f(h.valuePerDollar), sites: (h.sites || []).slice(0, 5).map(s => ({ id: s.id, name: s.name, kind: s.kind, acres: f(s.acres), verification: s.verification, potentialHomesWithheld: s.potentialHomes && s.potentialHomes.withheld ? "model output, listed as unverified" : null })), missing: h.missing })),
      places: (n.places || []).slice(0, 5).map(s => ({ type: s.type, name: s.name, costLow: s.cost ? f(s.cost.low) : null, costHigh: s.cost ? f(s.cost.high) : null })),
      missing: n.missing,
    } : null,
    parcel: p ? { parcelId: p.parcelId, zoning: p.zoning, expansions: (p.expansions || []).map(e => ({ expansion: e.expansion, label: e.label, legal: e.legal, costLow: f(e.cost.low), costHigh: f(e.cost.high), valueAdded: f(e.valueAdded), netValue: f(e.netValue), missing: e.missing })), missing: p.missing } : null,
    transit: t ? { name: t.name || null, verdict: t.verdict, scale: t.scale, verdictMeaning: t.verdictMeaning || null, homesPerNetAcre: t.density ? f(t.density.homesPerNetAcre) : null, reasons: t.reasons || [], missing: t.missing || [] } : null,
    caveats: brief.caveats, missing: brief.missing, sources: brief.sources,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DATA_CHECKS, ideaAllowed, sourcedRow, briefForAdvisor, rankNeighborhoods, recommendForNeighborhood, recommendForParcel, evaluateTransit, buildDecisionBrief, areaFromBlockGroup, percentileRanks, TRANSIT_THRESHOLDS, DECISION_ENGINE_VERSION };
}
if (typeof window !== "undefined") {
  window.InvestmentDecisionEngine = { DATA_CHECKS, ideaAllowed, sourcedRow, briefForAdvisor, rankNeighborhoods, recommendForNeighborhood, recommendForParcel, evaluateTransit, buildDecisionBrief, areaFromBlockGroup, percentileRanks, TRANSIT_THRESHOLDS, DECISION_ENGINE_VERSION };
}
})();
