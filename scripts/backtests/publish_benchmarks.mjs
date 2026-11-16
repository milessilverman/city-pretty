// Copies each county's one-time test result (data/backtests/county_model_test_<fips>.json) into
// app/data/valuation_backtest_benchmarks.json, which the page reads. A county that failed is published too, so the
// page withholds its estimate with the test's own numbers. Passing counties also get their page model
// (app/data/county_valuation_models.json). Usage: node scripts/backtests/publish_benchmarks.mjs <fips> [...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BENCH = path.join(ROOT, "app/data/valuation_backtest_benchmarks.json");
const MODELS = path.join(ROOT, "app/data/county_valuation_models.json");
const bench = JSON.parse(fs.readFileSync(BENCH, "utf8"));
const models = fs.existsSync(MODELS) ? JSON.parse(fs.readFileSync(MODELS, "utf8")) : { _source: "scripts/backtests/publish_benchmarks.mjs; one entry per county whose model passed its back-test", counties: {} };

for (const fips of process.argv.slice(2)) {
  const file = `data/backtests/county_model_test_${fips}.json`;
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  bench.counties[fips] = {
    _status: "backtest_run",
    countyFips: fips,
    countyName: t.county_name,
    model_name: `county_sales_${t.locked.spec}`,
    run_on: t.run_on.slice(0, 10),
    script: "scripts/county_valuation_models.mjs",
    sample_file: t.sales_file,
    result_file: file,
    target: "Recorded arm's-length sale price",
    sources: t.sources,
    filters: t.filters,
    split: t.windows,
    locked: t.locked,
    what_is_tested: "The locked model, refit on sales before the test window, scored once on later sales. No test sale is in its own neighborhood statistics; an assessor value is used only where it was set before the sale.",
    model: t.model,
    baseline_neighborhood_median: t.baseline_neighborhood_median,
    beats_baseline: t.beats_baseline,
    gate: t.gate,
    by_price_band: t.by_price_band,
    candidates: t.candidates,
    leakage: { test_homes_in_their_own_statistics: t.test_homes_in_their_own_statistics, test_rows_with_assessor_value_set_after_sale_excluded: t.test_rows_with_assessor_value_set_after_sale },
    verification: { status: "verified", method: "Machine back-test on public recorded sales; result reproducible from the committed sales file with scripts/county_valuation_models.mjs.", checked_on: t.run_on.slice(0, 10), evidence: file },
  };
  if (t.gate && t.gate.pass) models.counties[fips] = { county_name: t.county_name, tested: { mdape: t.model.mdape, n: t.model.n, share_within_20pct: t.model.share_within_20pct, by_price_band: t.by_price_band, run_on: t.run_on.slice(0, 10) }, model: t.page_model, stats: t.page_stats, input_map: t.input_map || null };
  else delete models.counties[fips];
  console.log(`${fips} ${t.county_name}: ${t.gate.pass ? "PASS" : "FAIL"} (${(t.model.mdape * 100).toFixed(1)}%)`);
}
fs.writeFileSync(BENCH, JSON.stringify(bench, null, 1));
fs.writeFileSync(MODELS, JSON.stringify(models));
