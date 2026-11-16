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
// Which parcel attributes the page supplies for each model input, per county (only counties whose model can run on
// the page). DC: the page's parcel layer gives the SSL; app.js then reads the residential CAMA record by SSL and
// attaches CAMA_* fields (enrichDcCama). Same fields the back-test used (scripts/backtests/pull_dc.py).
const INPUT_MAPS = {
  "11001": { sqft: "CAMA_GBA", lot: "CAMA_LANDAREA", yb: "CAMA_AYB", beds: "CAMA_BEDRM", baths: "CAMA_BATHRM", half_baths: "CAMA_HF_BATHRM",
             source: "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/25 (RESIDENTIAL (CAMA)), by SSL" },
};
// NYC boroughs: the page's parcel layer is MapPLUTO (26v2, same release and values as the PLUTO the back-test joined;
// checked 16 Nov on BBL 4099020104). Same four fields the test used (scripts/backtests/pull_nyc.py).
for (const f of ["36005", "36047", "36061", "36081", "36085"]) {
  INPUT_MAPS[f] = { sqft: "BldgArea", lot: "LotArea", yb: "YearBuilt", units: "UnitsRes",
    source: "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0 (NYC MapPLUTO 26v2)" };
}
// Florida: the page's parcel layer is the statewide cadastral service built from DOR's tax roll; it held the 2026
// roll on 16 Nov (ASMNT_YR 2026), the same roll as the NAL file the test used. Field names are the service's
// (truncated: TOT_LVG_AR = NAL TOT_LVG_AREA, NO_RES_UNT = NO_RES_UNTS). The just value is used only from the tested roll.
INPUT_MAPS["12057"] = { sqft: "TOT_LVG_AR", lot: "LND_SQFOOT", yb: "ACT_YR_BLT", units: "NO_RES_UNT", av: "JV", av_year: "ASMNT_YR", av_vintage: 2026,
  require: { DOR_UC: "001" }, require_label: "single-family homes (Florida DOR use code 001)",
  source: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0 (Florida statewide parcels, 2026 roll)" };
// Other Florida counties: same DOR roll, same statewide layer. Where the page's own parcel service for the county is
// something else (Miami-Dade: a county zoning layer), the page reads the inputs from the statewide layer at the
// parcel's point (input_layer; app.js enrichFromInputLayer).
const FL_STATEWIDE = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0";
for (const f of ["12086", "12011", "12031", "12095", "12099", "12103"]) {
  INPUT_MAPS[f] = Object.assign({}, INPUT_MAPS["12057"], f === "12086" ? {
    input_layer: { url: FL_STATEWIDE, by: "point", fields: ["PARCEL_ID", "DOR_UC", "JV", "ASMNT_YR", "ACT_YR_BLT", "LND_SQFOOT", "NO_RES_UNT", "TOT_LVG_AR"] },
  } : {});
}
// King County WA: the page's own King service is the county zoning layer (PIN and zoning only). The model needs the
// tax-year-2026 appraised land + improvements value, which the Washington statewide parcel layer carries as
// VALUE_LAND + VALUE_BLDG (no roll-year field). The page reads it by PIN and computes only while
// scripts/backtests/check_king_statewide_values.py found it equal to the Assessor's tax-year-2026 value for >= 98% of a
// sample, within the last 120 days (input_check below, copied from data/backtests/king_statewide_value_check.json).
INPUT_MAPS["53033"] = {
  av: "WA_AV",
  input_layer: { url: "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0", by: "field",
    key_from: "PIN", key_to: "ORIG_PARCEL_ID", where_extra: "FIPS_NR='033'", fields: ["ORIG_PARCEL_ID", "VALUE_LAND", "VALUE_BLDG"],
    derive: { WA_AV: ["VALUE_LAND", "VALUE_BLDG"] } },
  source: "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0 (Washington statewide parcels; VALUE_LAND + VALUE_BLDG, checked against the King Assessor's tax-year-2026 values)",
};
const INPUT_CHECKS = {};
const kingCheckFile = path.join(ROOT, "data/backtests/king_statewide_value_check.json");
if (fs.existsSync(kingCheckFile)) {
  const k = JSON.parse(fs.readFileSync(kingCheckFile, "utf8"));
  INPUT_CHECKS["53033"] = { checked_on: k.checked_on, sampled: k.sampled, matched: k.matched, match_rate: k.match_rate, min_rate: 0.98, max_age_days: 120,
    script: "scripts/backtests/check_king_statewide_values.py", file: "data/backtests/king_statewide_value_check.json" };
}
// Counties whose model passed but whose page parcel layer lacks an input: the page withholds with this reason.
const PAGE_INPUTS_MISSING = {
  "53033": "this page's King County parcel layer (the county zoning layer) has only the parcel number and zoning, not the tax-year-2026 assessed value the model needs. The Washington statewide parcel layer has that value but no roll-year field, so the page couldn't confirm it is the tested roll.",
};
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
  if (t.gate && t.gate.pass) models.counties[fips] = { county_name: t.county_name, tested: { mdape: t.model.mdape, n: t.model.n, share_within_20pct: t.model.share_within_20pct, by_price_band: t.by_price_band, run_on: t.run_on.slice(0, 10) }, model: t.page_model, stats: t.page_stats, input_map: INPUT_MAPS[fips] || null,
    ...(INPUT_CHECKS[fips] ? { input_check: INPUT_CHECKS[fips] } : {}),
    ...(INPUT_MAPS[fips] ? {} : { page_inputs_missing: PAGE_INPUTS_MISSING[fips] || null }) };
  else delete models.counties[fips];
  if (t.gate && t.gate.pass && !INPUT_MAPS[fips]) console.log(`  ${fips}: passed, but the page has no input map, so it will still withhold (inputs not available on the page)`);
  console.log(`${fips} ${t.county_name}: ${t.gate.pass ? "PASS" : "FAIL"} (${(t.model.mdape * 100).toFixed(1)}%)`);
}
fs.writeFileSync(BENCH, JSON.stringify(bench, null, 1));
fs.writeFileSync(MODELS, JSON.stringify(models));
