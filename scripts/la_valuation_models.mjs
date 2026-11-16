#!/usr/bin/env node
// Develops and tests home-value candidates for LA County on public Assessor base-year resets.
//
//   node scripts/la_valuation_models.mjs dev     model choice: statistics from 2022-23 resets, scored on 2024 resets
//   node scripts/la_valuation_models.mjs final   the one test: statistics from 2022-24, scored on 2025-26 resets
//
// No peeking: "dev" never reads the 2025-26 test file; "final" writes its result to
// data/backtests/la_model_test_<date>.json and refuses to run again if that file exists (delete it deliberately).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { errorMetrics, groupedMetrics, priceBand, passesGate } from "./lib/backtestMetrics.mjs";
import { filterReason, loadLA, parseQuality, readGz } from "./lib/laParcels.mjs";
import { candidates, fitRegression, leakageCount, neighborhoodStats, regressionPredictor, FEATURE_NAMES, MIN_BG, MIN_TRACT } from "./lib/laValuationModels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TRAIN = path.join(ROOT, "data/backtests/la_resets_2022-2024_2026-11-16.json.gz");
export const TEST = path.join(ROOT, "data/backtests/la_sample_2026-11-16.json.gz");
const FINAL_OUT = path.join(ROOT, "data/backtests/la_model_test_2026-11-16.json");

export function rowsFrom(LA, file, years, newBuildYearFor) {
  const excluded = {};
  const rows = [];
  for (const a of readGz(file).records) {
    const why = filterReason(a, years, newBuildYearFor(+a.Roll_LandBaseYear));
    if (why) { excluded[why] = (excluded[why] || 0) + 1; continue; }
    const bg = LA.bgAt(+a.CENTER_LON, +a.CENTER_LAT);
    if (!bg) { excluded["outside every LA block group"] = (excluded["outside every LA block group"] || 0) + 1; continue; }
    const q = parseQuality(a.QualityClass1);
    rows.push({
      ain: a.AIN, bg, tract: bg.slice(0, 11), year: +a.Roll_LandBaseYear, value: +a.Roll_LandValue + +a.Roll_ImpValue,
      sqft: +a.SQFTmain1, lot: Math.round(+a["Shape.STArea()"] || 0), yb: +a.YearBuilt1, eff: +a.EffectiveYear1,
      beds: a.Bedrooms1 == null ? null : +a.Bedrooms1, baths: a.Bathrooms1 == null ? null : +a.Bathrooms1, quality: q.quality,
      oldHv: +(LA.m.get(bg) || {}).hv || null,
    });
  }
  return { rows, excluded };
}

function score(label, est, rows) {
  const pairs = rows.map((r) => ({ est: est(r), target: r.value }));
  const withBand = rows.map((r, i) => ({ ...pairs[i], band: priceBand(r.value) }));
  return { label, overall: errorMetrics(pairs), by_price_band: groupedMetrics(withBand, (x) => x.band, (x) => x, 30).groups };
}

// The regression is fit on the statistics rows themselves, with cross-fitted neighborhood features (no home in its
// own statistics), then applied to the evaluation rows with statistics from all statistics rows.
function run(statsRows, evalRows) {
  const stats = neighborhoodStats(statsRows);
  const reg = fitRegression(statsRows);
  return {
    leakage_test_homes_in_their_own_statistics: leakageCount(stats, evalRows),
    regression: { features: FEATURE_NAMES, coef: reg.coef.map((c) => +c.toFixed(5)), fit_rows: reg.n, residual_sd_log: +reg.residual_sd.toFixed(4) },
    candidates: [
      score("neighborhood_median", candidates.neighborhood_median(stats), evalRows),
      score("neighborhood_ppsf_x_sqft", candidates.neighborhood_ppsf_x_sqft(stats), evalRows),
      score("regression", regressionPredictor(stats, reg), evalRows),
      score("old_bundle_typical_value (untraceable m.hv, for reference)", (r) => r.oldHv, evalRows),
    ],
  };
}

async function main() {
  const mode = process.argv[2];
  if (!["dev", "final"].includes(mode)) { console.error("usage: dev | final"); process.exit(2); }
  const LA = loadLA(ROOT);
  // Training: a reset in year y can be new construction finished in y or y-1, so homes built/rebuilt from y-1 on are out.
  const train = rowsFrom(LA, TRAIN, [2022, 2023, 2024], (y) => y - 1);
  if (mode === "dev") {
    const s = train.rows.filter((r) => r.year <= 2023), e = train.rows.filter((r) => r.year === 2024);
    // Regression fit on 2023 homes with 2022 statistics (one year earlier), then applied to 2024 with 2022-23 stats.
    const res = run(s, e);
    console.log(JSON.stringify({ mode, train_rows: train.rows.length, excluded: train.excluded, stats_rows: s.length, eval_rows: e.length, min_bg: MIN_BG, min_tract: MIN_TRACT, ...res }, null, 1));
    return;
  }
  if (fs.existsSync(FINAL_OUT)) { console.error(`${FINAL_OUT} exists: the final test has already been run.`); process.exit(3); }
  const test = rowsFrom(LA, TEST, [2025, 2026], () => 2024); // same filters as scripts/backtest_la_valuation.mjs
  const trainAins = new Set(train.rows.map((r) => r.ain));
  // Final: statistics from all training years; regression fit on 2024 homes with 2022-23 statistics (as in dev).
  const res = run(train.rows, test.rows);
  const base = res.candidates[0].overall;
  for (const c of res.candidates) c.gate = passesGate(c.overall, c.label === "neighborhood_median" ? null : base);
  const out = { mode, run_on: new Date().toISOString(), train_rows: train.rows.length, train_excluded: train.excluded, test_rows: test.rows.length, test_excluded: test.excluded, test_ains_also_in_training: test.rows.filter((r) => trainAins.has(r.ain)).length, min_bg: MIN_BG, min_tract: MIN_TRACT, ...res };
  fs.writeFileSync(FINAL_OUT, JSON.stringify(out, null, 1) + "\n");
  console.log(JSON.stringify(out, null, 1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
