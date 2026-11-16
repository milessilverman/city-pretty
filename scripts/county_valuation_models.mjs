// Develops and tests home-value candidates for one county on recorded arm's-length sales.
//   node scripts/county_valuation_models.mjs <fips> dev     fit on the "fit" window, compare candidates on "dev"
//   node scripts/county_valuation_models.mjs <fips> final   the one test: refit the locked spec on fit+dev, score on "test"
// Windows, sales file and the locked choice live in scripts/backtests/county_config.json (committed before "final").
// "final" writes data/backtests/county_model_test_<fips>.json and refuses to run again if it exists.
//
// Leakage rules: neighborhood statistics never include the home being estimated (cross-fitting while fitting; only
// earlier windows when scoring). The assessor's value may be used for a scored sale only if it was set before the
// sale (av_date < sale date). Fit rows may use an assessor value set after their sale: that can only weaken the model
// on the clean test, never flatter it.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { errorMetrics, groupedMetrics, priceBand, passesGate } from "./lib/backtestMetrics.mjs";
import { neighborhoodStats, fitRegression, fitAssessorRatio, predictor, leakageCount, statsForPage, FEATURE_SETS } from "./lib/countyValuationModels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = path.join(ROOT, "scripts/backtests/county_config.json");
const [fips, mode] = process.argv.slice(2);
const cfgAll = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
const cfg = cfgAll[fips];
if (!cfg || !["dev", "final"].includes(mode)) { console.error("usage: <fips> dev|final (fips must be in county_config.json)"); process.exit(2); }

const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, cfg.sales_file))).toString());
const inWin = (r, [a, b]) => r.date >= a && r.date <= b;
const rows = data.rows;
const fit = rows.filter((r) => inWin(r, cfg.fit)), dev = rows.filter((r) => inWin(r, cfg.dev)), test = rows.filter((r) => inWin(r, cfg.test));

function fitAll(fitRows) {
  return {
    neighborhood_median: { spec: "neighborhood_median" },
    neighborhood_ppsf_x_sqft: { spec: "neighborhood_ppsf_x_sqft" },
    assessor_ratio: fitAssessorRatio(fitRows, { allowAvAnyDate: true }),
    // Room-based models only where the sales carry bedrooms (NYC's do not: PLUTO has no rooms). features() would
    // otherwise read a missing bedroom count as 0, because null >= 0 is true in JavaScript.
    ...(fitRows.some((r) => r.beds != null) ? {
      regression: fitRegression("regression", fitRows),
      regression_with_assessor: fitRegression("regression_with_assessor", fitRows, { allowAvAnyDate: true }),
    } : {}),
    // Only where the rows carry a unit count and no rooms. NYC (PLUTO, no assessor value): regression_pluto.
    // Elsewhere (Florida's roll): the same inputs as regression_no_rooms, alone and with the assessor's value.
    ...(fitRows.some((r) => r.units != null) && !fitRows.some((r) => r.av > 0) ? { regression_pluto: fitRegression("regression_pluto", fitRows) } : {}),
    ...(fitRows.some((r) => r.units != null) && fitRows.some((r) => r.av > 0) ? {
      regression_no_rooms: fitRegression("regression_no_rooms", fitRows),
      regression_no_rooms_with_assessor: fitRegression("regression_no_rooms_with_assessor", fitRows, { allowAvAnyDate: true }),
    } : {}),
  };
}
function score(models, stats, evalRows) {
  const out = {};
  for (const [name, m] of Object.entries(models)) {
    const p = predictor(m, stats);
    out[name] = errorMetrics(evalRows.map((r) => ({ est: p(r), target: r.price })));
  }
  return out;
}

// A scored home's own earlier sales are removed from the rows behind the statistics and the fit (repeat sales would
// otherwise put the home in its own neighborhood figure).
const without = (rs, scored) => { const ids = new Set(scored.map((r) => r.id)); return rs.filter((r) => !ids.has(r.id)); };

if (mode === "dev") {
  const stats = neighborhoodStats(without(fit, dev));
  const models = fitAll(fit);
  const res = score(models, stats, dev);
  console.log(JSON.stringify({ fips, mode, fit_rows: fit.length, dev_rows: dev.length, leakage: leakageCount(stats, dev), candidates: res }, null, 1));
} else {
  const OUT = path.join(ROOT, `data/backtests/county_model_test_${fips}.json`);
  if (fs.existsSync(OUT)) { console.error(`${OUT} exists: the final test has already been run.`); process.exit(3); }
  if (!cfg.locked || !cfg.locked.spec) { console.error("lock a spec in county_config.json (and commit it) before the final test"); process.exit(4); }
  const prior = without(rows.filter((r) => r.date < cfg.test[0] && (inWin(r, cfg.fit) || inWin(r, cfg.dev))), test);
  const stats = neighborhoodStats(prior);
  const models = fitAll(prior);
  const res = score(models, stats, test);
  const chosen = models[cfg.locked.spec];
  const p = predictor(chosen, stats);
  const pairs = test.map((r) => ({ est: p(r), target: r.price, r }));
  const model = errorMetrics(pairs);
  const baseline = res.neighborhood_median;
  const gate = passesGate(model, baseline);
  const bands = groupedMetrics(pairs.filter((x) => x.est > 0), (x) => priceBand(x.target), (x) => x, 30);
  const out = {
    fips, county_name: data.county_name, mode, run_on: new Date().toISOString(), sales_file: cfg.sales_file, sources: data.sources, filters: data.filters,
    windows: { fit: cfg.fit, dev: cfg.dev, test: cfg.test }, locked: cfg.locked,
    prior_rows: prior.length, test_rows: test.length,
    test_homes_in_their_own_statistics: leakageCount(stats, test),
    test_rows_with_assessor_value_set_after_sale: test.filter((r) => r.av > 0 && !(r.av_date < r.date)).length,
    candidates: res, model, baseline_neighborhood_median: baseline, beats_baseline: model.mdape < baseline.mdape, gate,
    by_price_band: Object.fromEntries(Object.entries(bands.groups).map(([k, v]) => [k, v])),
    page_model: chosen.coef ? { spec: chosen.spec, coef: chosen.coef, feature_names: FEATURE_SETS[chosen.spec], n_fit: chosen.n } : chosen,
    page_stats: statsForPage(stats),
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(JSON.stringify({ ...out, page_stats: `${Object.keys(out.page_stats.bg).length} block groups, ${Object.keys(out.page_stats.tract).length} tracts` }, null, 1));
}
