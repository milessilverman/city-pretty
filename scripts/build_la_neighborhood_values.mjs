#!/usr/bin/env node
// Builds app/data/la_neighborhood_values.json: traceable typical home values for LA County block groups, plus the
// tested home-value model's coefficients.
//
// Source: LA County Assessor's public parcel layer. Single-family parcels (use code 0100, one unit) whose land and
// improvement base years are equal and 2022-2026 carry their transfer value (Prop 13 proxy for the sale price; legal
// basis and caveats in scripts/lib/laParcels.mjs). Raw pulls, with every query, are in data/backtests/:
//   la_resets_2022-2024_2026-11-16.json.gz  (base years 2022-24)
//   la_sample_2026-11-16.json.gz            (base years 2025-26)
// Per block group: median value, median $/sqft, n, base-year span. A block group with fewer than MIN_BG homes uses
// its tract (MIN_TRACT homes); otherwise no value.
//
// The model coefficients are copied from the one final test (data/backtests/la_model_test_2026-11-16.json, written
// by `node scripts/la_valuation_models.mjs final`), so the page ships exactly what was tested. That test used
// statistics from 2022-24 resets to estimate 2025-26 resets; the page uses statistics from 2022-26 (fresher, but not
// the exact configuration tested; noted in the file).
//
// Usage: node scripts/build_la_neighborhood_values.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYER, LEGAL_BASIS, loadLA, readGz } from "./lib/laParcels.mjs";
import { neighborhoodStats, FEATURE_NAMES, MIN_BG, MIN_TRACT } from "./lib/laValuationModels.mjs";
import { rowsFrom, TEST, TRAIN } from "./la_valuation_models.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "app/data/la_neighborhood_values.json");
const FINAL = path.join(ROOT, "data/backtests/la_model_test_2026-11-16.json");

const LA = loadLA(ROOT);
const a = rowsFrom(LA, TRAIN, [2022, 2023, 2024], (y) => y - 1);
const b = rowsFrom(LA, TEST, [2025, 2026], (y) => y - 1);
const rows = [...a.rows, ...b.rows];
const stats = neighborhoodStats(rows);
const pack = (m) => Object.fromEntries([...m].sort(([x], [y]) => x.localeCompare(y)).map(([k, s]) => [k, [s.n, Math.round(s.median), Math.round(s.ppsf * 100) / 100, s.y0, s.y1]]));

const final = JSON.parse(fs.readFileSync(FINAL, "utf8"));
const reg = final.candidates.find((c) => c.label === "regression");
const base = final.candidates.find((c) => c.label === "neighborhood_median");
if (JSON.stringify(final.regression.features) !== JSON.stringify(FEATURE_NAMES)) throw new Error("feature list changed since the final test; re-test before shipping");

const readMeta = (f) => { const d = readGz(f); return { file: path.relative(ROOT, f), pulled: d.pulled, queries: d.queries }; };
const out = {
  _source: {
    dataset: "LA County block-group typical home values from Assessor base-year resets",
    publisher: "Los Angeles County Assessor (public parcel layer)",
    service: LAYER,
    method: `Single-family parcels (UseCode 0100, Units1 = 1) whose land and improvement base years are equal and in 2022-2026, on the 2026 roll, assigned to 2020 block groups by their centroid (CENTER_LAT/LON) inside the block-group polygons of app/data/bundle-la.b64.txt. Excluded: homes built or rebuilt (effective year) in or after the year before their base year (possible new-construction reassessments), land under $50k or improvements under $20k, living area under 400 sq ft, total over $20M. Per block group: median of land + improvement value, median value per living sq ft, count and base-year span. Block groups with fewer than ${MIN_BG} homes fall back to their tract (at least ${MIN_TRACT} homes), else no value.`,
    legal_basis: LEGAL_BASIS,
    proxy_caveats: [
      "A base-year reset is a proxy for a sale: some are non-sale changes in ownership reassessed at the Assessor's appraisal (e.g. Prop 19 transfers).",
      "Values are on the 2026 roll, so older base years include annual inflation factors of up to 2% a year.",
    ],
    pulls: [readMeta(TRAIN), readMeta(TEST)],
    rows_used: rows.length,
    excluded: { "2022-24": a.excluded, "2025-26": b.excluded },
    script: "scripts/build_la_neighborhood_values.mjs",
    built: new Date().toISOString().slice(0, 10),
    format: "bg / tract: GEOID -> [homes, median value $, median $ per living sq ft, first base year, last base year]",
  },
  min_bg: MIN_BG,
  min_tract: MIN_TRACT,
  model: {
    name: "la_assessor_resets_regression",
    description: "Least squares on log value with cross-fitted neighborhood features (a home is never in its own neighborhood statistics while fitting), intercept shifted by the median residual so it targets the typical home.",
    features: FEATURE_NAMES,
    coef: final.regression.coef,
    fit_rows: final.regression.fit_rows,
    tested: {
      file: path.relative(ROOT, FINAL),
      run_on: final.run_on,
      protocol: "Model chosen on 2024 resets using statistics from 2022-23 (dev); locked; then tested once on 2025-26 resets using statistics from 2022-24. No test home appears in the training data or in its own neighborhood statistics.",
      overall: reg.overall,
      by_price_band: reg.by_price_band,
      baseline_neighborhood_median: base.overall,
      gate: reg.gate,
    },
    production_note: "The page applies these coefficients with neighborhood statistics from 2022-26 resets (the file's bg/tract tables), one year fresher than the tested configuration.",
  },
  bg: pack(stats.bg),
  tract: pack(stats.tract),
  verification: {
    status: "verified",
    method: "Machine-built from the saved public-record pulls (every query is listed in _source.pulls); re-run the script to reproduce.",
    checked_on: new Date().toISOString().slice(0, 10),
    evidence: `${rows.length} homes; ${stats.bg.size} block groups and ${stats.tract.size} tracts with at least one home`,
    notes: "Verified means the medians are computed from the public records as stated; the base-year values remain a proxy for sale prices.",
  },
};
fs.writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`wrote ${OUT}: ${rows.length} homes, ${stats.bg.size} block groups, ${stats.tract.size} tracts`);

// The page's publishing rule reads valuation_backtest_benchmarks.json. Record the LA model's one test there, with
// every candidate and the earlier page model's result (scripts/backtest_la_valuation.mjs) kept as history.
const BENCH = path.join(ROOT, "app/data/valuation_backtest_benchmarks.json");
const bench = JSON.parse(fs.readFileSync(BENCH, "utf8"));
const prev = bench.counties && bench.counties["06037"];
const previous = prev && (prev.previous_page_model || (prev.model_name ? null : prev));
bench.counties = bench.counties || {};
bench.counties["06037"] = {
  _status: "backtest_run",
  countyFips: "06037",
  countyName: "Los Angeles County",
  model_name: "la_assessor_resets_regression",
  run_on: final.run_on.slice(0, 10),
  script: "scripts/la_valuation_models.mjs final",
  sample_file: "data/backtests/la_sample_2026-11-16.json.gz",
  training_file: "data/backtests/la_resets_2022-2024_2026-11-16.json.gz",
  result_file: path.relative(ROOT, FINAL),
  target: "Prop 13 base-year value of single-family parcels whose land and improvement base years are both 2025 or 2026 (proxy for the transfer price).",
  legal_basis: LEGAL_BASIS,
  split: {
    training: "Base-year 2022-24 resets (neighborhood statistics and model fit; cross-fitted so no home is in its own statistics).",
    development: "Model chosen on 2024 resets using statistics from 2022-23, then locked (commit 290ce39).",
    test: `Run once on ${final.test_rows} base-year 2025-26 resets, with statistics from 2022-24 only. Test homes in training data: ${final.test_ains_also_in_training}; test homes inside their own statistics: ${final.leakage_test_homes_in_their_own_statistics}.`,
  },
  what_is_tested: "The LA model the page uses (coefficients in app/data/la_neighborhood_values.json), applied to homes that had not changed hands in the statistics window.",
  model: reg.overall,
  baseline_neighborhood_median: base.overall,
  beats_baseline: reg.overall.mdape < base.overall.mdape,
  gate: { mdape_cap: 0.15, ...reg.gate },
  by_price_band: reg.by_price_band,
  candidates: final.candidates.map((c) => ({ name: c.label, overall: c.overall, by_price_band: c.by_price_band, gate: c.gate })),
  previous_page_model: previous || null,
  caveats: [
    "Base-year resets are a proxy for sales: some are non-sale transfers reassessed at the Assessor's appraisal (e.g. under Prop 19).",
    "Only single-family use code 0100 was tested; condos, multi-unit and vacant land are not covered.",
    "The page uses statistics from 2022-26 resets, one year fresher than the tested 2022-24 configuration.",
    "Error is larger for homes under $500k and $2M and up (see by_price_band); the page says so for those homes.",
  ],
  verification: {
    status: "verified",
    method: "Machine-run back-test on saved public records; the result file and both pulls are in data/backtests/.",
    checked_on: final.run_on.slice(0, 10),
    evidence: `regression MdAPE ${reg.overall.mdape} on ${reg.overall.n} homes; neighborhood median ${base.overall.mdape}`,
    notes: "Verified means the metrics are computed from the public records as stated; it does not make the proxy a recorded sale.",
  },
};
fs.writeFileSync(BENCH, JSON.stringify(bench, null, 2) + "\n");
console.log(`updated ${BENCH} (06037: ${bench.counties["06037"].model_name}, gate ${bench.counties["06037"].gate.pass})`);
