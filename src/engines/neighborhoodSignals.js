/**
 * Neighbourhood signals and the hold-out prediction test (browser global and CommonJS module). Pure functions: no
 * network, no file reads.
 *
 * Two inputs, both built by scripts/predict2/ (docs/audit/prediction-2026-11-23.md):
 * - a state signal file app/data/neighborhood_signals/<state fips>.json: per 2020 tract, the FHFA price index change
 *   2020-2025 and 2024-2025, LODES jobs located in the tract in 2024 and the change 2022-2024; per county, housing
 *   units authorised by building permits 2021-2025. These are facts about the past, not a forecast.
 * - app/data/neighborhood_prediction_holdout.json: what was tested (a model predicting which tracts rise most, tested on
 *   metros it never saw, against five simple baselines) and whether it passed the rule written before the test.
 * A prediction is shown only when that file says the rule was passed; otherwise the caller states that it was tested
 * and did not beat the baselines.
 */
(function () {
"use strict";

const TRACT_COLS = ["price5y", "price1y", "jobs2024", "jobs2y"];

function tractOfBlockGroup(id) {
  const s = String(id || "");
  return /^\d{12}$/.test(s) ? s.slice(0, 11) : /^\d{11}$/.test(s) ? s : null;
}

function srcByName(doc, re) {
  const list = (doc && doc._source && doc._source.sources) || [];
  return list.find(s => re.test(s.name || "")) || null;
}

/**
 * Signals for one block group (or tract). Every value is { value, unit, why, source }: value null comes with the reason.
 * countyFips: 5-digit county of the area (permits are by county).
 */
function signalsForArea(doc, areaId, countyFips) {
  const tract = tractOfBlockGroup(areaId);
  const fhfa = srcByName(doc, /FHFA/), lodes = srcByName(doc, /LODES/), bps = srcByName(doc, /Building Permits/);
  const out = { ok: false, tract, forecast: false, price5y: null, price1y: null, jobs2024: null, jobs2y: null, permits: null };
  if (!doc || !doc.tracts) { out.why = "the signal file for this state did not load"; return out; }
  if (!tract) { out.why = "not a Census block group or tract code"; return out; }
  const row = doc.tracts[tract];
  const cell = (i, unit, src, why) => ({ value: row && row[i] != null ? row[i] : null, unit, source: src, why: row && row[i] != null ? null : why });
  out.ok = true;
  out.price5y = cell(0, "% change in the FHFA tract price index, 2020 to 2025", fhfa, row ? "FHFA publishes no 2020 or 2025 index value for this tract" : "this tract is not in FHFA's tract index");
  out.price1y = cell(1, "% change in the FHFA tract price index, 2024 to 2025", fhfa, row ? "FHFA publishes no 2024 or 2025 index value for this tract" : "this tract is not in FHFA's tract index");
  const unpub = Array.isArray(doc.lodes_not_published) ? doc.lodes_not_published : [];
  const miss = ys => `the Census Bureau has not published a LODES file for this state for ${ys.join(" and ")}`;
  out.jobs2024 = cell(2, "jobs located in the tract, 2024", lodes, unpub.includes(2024) ? miss([2024]) : "this tract is not in the signal file");
  const un2 = [2022, 2024].filter(y => unpub.includes(y));
  out.jobs2y = cell(3, "% change in jobs located in the tract, 2022 to 2024", lodes,
    un2.length ? miss(un2) : row ? "fewer than 50 jobs in the tract in 2022, too few to read as a trend" : "this tract is not in the signal file");
  const c = countyFips || tract.slice(0, 5);
  const p = doc.counties && doc.counties[c];
  if (p && p.length) {
    const first = (doc._source && doc._source.columns && doc._source.columns.counties) || [];
    const years = first.map(s => Number((String(s).match(/(\d{4})$/) || [])[1]));
    const series = p.map((u, i) => ({ year: years[i] || null, units: u }));
    const a = series[0], b = series[series.length - 1];
    const change = a && b && a.units > 0 && b.units != null ? Math.round(1000 * (b.units / a.units - 1)) / 10 : null;
    out.permits = { county: c, series, change: { value: change, unit: a && b ? `% change in units authorised, ${a.year} to ${b.year}` : "", source: bps,
      why: change == null ? "no permits in the first year, or a year missing" : null }, source: bps, why: null };
  } else {
    out.permits = { county: c, series: [], change: { value: null, why: "this county has no row in the Building Permits Survey county file" }, source: bps, why: "no county row" };
  }
  return out;
}

/**
 * The tested verdict, for display. Returns { shown, headline, rows, limits, tested } where rows are the hold-out
 * numbers per method and horizon (points = 100 x log change; top-decile = average of the 10% of tracts picked).
 */
function predictionVerdict(summary) {
  if (!summary || !summary.decision || !summary.results) {
    return { shown: false, headline: "The prediction test results did not load, so no prediction is shown.", rows: [], limits: [], tested: null };
  }
  const pass = summary.decision.pass === true;
  const rows = [];
  for (const h of Object.keys(summary.results).sort()) {
    const r = summary.results[h];
    for (const m of r.methods || []) rows.push({ horizon: Number(h), method: m.label, kind: m.kind, topDecile: m.top_decile, ci95: m.top_decile_ci95, spearman: m.spearman });
  }
  const headline = pass
    ? summary.headline_pass || "The model beat every baseline on metros it never saw."
    : summary.headline_fail || "Tested on metros it never saw, the prediction did not beat simple baselines, so no forecast is shown.";
  return { shown: pass, headline, rows, limits: summary.limits || [], tested: summary.tested || null, failed: summary.decision.failed_conditions || [] };
}

const api = { tractOfBlockGroup, signalsForArea, predictionVerdict, TRACT_COLS };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.NeighborhoodSignals = api;
})();
