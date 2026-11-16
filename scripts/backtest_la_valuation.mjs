#!/usr/bin/env node
// Back-test of the page's GENERIC home-value estimate for Los Angeles County, against recent Prop 13 base-year resets.
// History: this estimate failed (16 Nov 2026) and LA now uses a separately tested model (scripts/la_valuation_models.mjs).
// This script still measures the generic estimate and records it as counties["06037"].previous_page_model.
//
// Why this target: LA County's public parcel layer has no sale prices. Under Prop 13 (Cal. Rev. & Tax. Code §110.1),
// a change in ownership resets a property's base-year value to its full cash value, normally the purchase price, and
// the roll then rises by at most 2% a year. So a single-family parcel whose land AND improvement base years are both
// 2025 or 2026 carries (about) its 2025/2026 transfer value on the 2026 roll. This is a PROXY for a sale price:
//   - some resets are not sales (e.g. family transfers reassessed under Prop 19, at the assessor's appraisal),
//   - 2025 base-year values on the 2026 roll include one inflation factor (at most 2%),
//   - new construction also sets base years; we exclude homes built or effectively rebuilt in or after 2024.
//
// What is tested: the page's own estimatePropertyMarketValue(), loaded verbatim from app/app.js and run with the
// parcel's roll values and base years withheld, i.e. the estimate the page gives a home that has NOT recently sold.
// For LA that is the neighborhood model anchored on the block group's typical value (D.details[bg].m.hv).
// Baseline: the block group's typical value alone.
//
// Usage: NODE_USE_ENV_PROXY=1 node scripts/backtest_la_valuation.mjs [--refetch]
//   Re-uses data/backtests/la_sample_<date>.json.gz if present (so results are reproducible); --refetch pulls again.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { errorMetrics, groupedMetrics, priceBand, passesGate } from "./lib/backtestMetrics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LAYER = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0";
const FIELDS = ["OBJECTID", "AIN", "UseCode", "UseType", "UseDescription", "Roll_Year", "Roll_LandValue", "Roll_ImpValue",
  "Roll_LandBaseYear", "Roll_ImpBaseYear", "YearBuilt1", "EffectiveYear1", "SQFTmain1", "Units1", "Bedrooms1",
  "Bathrooms1", "QualityClass1", "SitusCity", "CENTER_LAT", "CENTER_LON", "Shape.STArea()"];
const TARGET_BASE_YEARS = ["2025", "2026"]; // after the 2022-24 window the neighborhood values were built from
const SAMPLE_DATE = "2026-11-16";
const SAMPLE = path.join(ROOT, "data", "backtests", `la_sample_${SAMPLE_DATE}.json.gz`);
const OUT = path.join(ROOT, "app", "data", "valuation_backtest_benchmarks.json");

// ---------- 1. Pull (or reuse) the sample ----------
async function getJson(url, tries = 5) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "city-pretty-backtest/1.0" }, signal: AbortSignal.timeout(60000) });
      const d = await r.json();
      if (d.error) throw new Error(JSON.stringify(d.error));
      return d;
    } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 1500 * 2 ** i));
    }
  }
}

async function pull() {
  const queries = [];
  const records = [];
  for (const y of TARGET_BASE_YEARS) {
    const where = `Roll_LandBaseYear='${y}' AND Roll_ImpBaseYear='${y}' AND UseCode='0100'`;
    const countUrl = `${LAYER}/query?` + new URLSearchParams({ where, returnCountOnly: "true", f: "json" });
    const { count } = await getJson(countUrl);
    for (let off = 0; off < count; off += 1000) {
      const url = `${LAYER}/query?` + new URLSearchParams({
        where, outFields: FIELDS.join(","), orderByFields: "OBJECTID", resultOffset: String(off),
        resultRecordCount: "1000", returnGeometry: "false", f: "json",
      });
      const d = await getJson(url);
      for (const f of d.features) records.push(f.attributes);
      process.stderr.write(`\rbase year ${y}: ${Math.min(off + 1000, count)}/${count}`);
    }
    process.stderr.write("\n");
    queries.push({ base_year: y, where, count, url_pattern: `${LAYER}/query?where=${encodeURIComponent(where)}&outFields=...&orderByFields=OBJECTID&resultOffset=<0,1000,...>&resultRecordCount=1000&f=json` });
  }
  const sample = { source: LAYER, publisher: "Los Angeles County Assessor (public parcel layer)", pulled: new Date().toISOString(), queries, fields: FIELDS, records };
  fs.mkdirSync(path.dirname(SAMPLE), { recursive: true });
  fs.writeFileSync(SAMPLE, zlib.gzipSync(JSON.stringify(sample)));
  return sample;
}

// ---------- 2. Neighborhood values and block groups from the LA bundle ----------
function loadLA() {
  const bundle = JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(ROOT, "app/data/bundle-la.b64.txt"), "utf8").trim(), "base64")));
  const det = JSON.parse(fs.readFileSync(path.join(ROOT, "app/data/details-la.json"), "utf8"));
  const m = new Map();
  for (const b64 of Object.values(det.chunks)) {
    const chunk = JSON.parse(zlib.gunzipSync(Buffer.from(b64, "base64")));
    for (const [bg, rec] of Object.entries(chunk)) m.set(bg, rec.m || {});
  }
  // Grid index of block-group polygons for point-in-polygon.
  const G = 0.02, grid = new Map();
  const polys = [];
  for (const f of bundle.bgs.features) {
    const g = f.geometry;
    const rings = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of rings) {
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const p = { id: f.properties.id, poly, box: [x0, y0, x1, y1] };
      polys.push(p);
      for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++)
        for (let gy = Math.floor(y0 / G); gy <= Math.floor(y1 / G); gy++) {
          const k = gx + ":" + gy;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(p);
        }
    }
  }
  const inRing = (x, y, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const bgAt = (lng, lat) => {
    for (const p of grid.get(Math.floor(lng / G) + ":" + Math.floor(lat / G)) || []) {
      const [x0, y0, x1, y1] = p.box;
      if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
      if (inRing(lng, lat, p.poly[0]) && !p.poly.slice(1).some((h) => inRing(lng, lat, h))) return p.id;
    }
    return null;
  };
  return { m, bgAt, nBgs: bundle.bgs.features.length };
}

// ---------- 3. The page's own valuation code, loaded verbatim from app/app.js ----------
function loadPageValuation() {
  const js = fs.readFileSync(path.join(ROOT, "app/app.js"), "utf8");
  const start = js.indexOf("const VALUATION_CURRENT_YEAR");
  const fnStart = js.indexOf("function estimatePropertyMarketValue(", start);
  if (start < 0 || fnStart < 0) throw new Error("valuation code not found in app/app.js");
  let i = js.indexOf("{", fnStart), depth = 0;
  for (; i < js.length; i++) {
    if (js[i] === "{") depth++;
    else if (js[i] === "}" && --depth === 0) break;
  }
  const src = js.slice(start, i + 1);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.estimatePropertyMarketValue = estimatePropertyMarketValue; this.VALUATION_STATUS_LABEL = VALUATION_STATUS_LABEL;", ctx);
  return { estimate: ctx.estimatePropertyMarketValue, sourceChars: src.length };
}

// ---------- 4. Filters, holdout run, metrics ----------
function filterReason(a) {
  const y = +a.Roll_LandBaseYear;
  const land = +a.Roll_LandValue || 0, imp = +a.Roll_ImpValue || 0;
  const yb = +a.YearBuilt1 || 0, eff = +a.EffectiveYear1 || 0;
  if (a.Roll_Year !== "2026") return "roll year is not 2026";
  if (+a.Units1 !== 1) return "not exactly one unit";
  if (!yb || yb >= 2024) return "built 2024 or later, or year built missing (could be new construction)";
  if (eff >= 2024) return "effective year 2024 or later (major remodel or rebuild)";
  if (land < 50000 || imp < 20000) return "land under $50k or improvements under $20k (odd or partial value)";
  if (!(+a.SQFTmain1 >= 400)) return "living area missing or under 400 sq ft";
  if (!(a.CENTER_LAT && a.CENTER_LON)) return "no coordinates";
  if (land + imp > 20e6) return "value over $20M";
  if (y !== 2025 && y !== 2026) return "base year outside target";
  return null;
}

async function main() {
  const sample = fs.existsSync(SAMPLE) && !process.argv.includes("--refetch")
    ? JSON.parse(zlib.gunzipSync(fs.readFileSync(SAMPLE)))
    : await pull();
  const LA = loadLA();
  const page = loadPageValuation();

  const excluded = {};
  const rows = [];
  for (const a of sample.records) {
    const why = filterReason(a);
    if (why) { excluded[why] = (excluded[why] || 0) + 1; continue; }
    const bg = LA.bgAt(+a.CENTER_LON, +a.CENTER_LAT);
    if (!bg) { excluded["outside every LA block group in the bundle"] = (excluded["outside every LA block group in the bundle"] || 0) + 1; continue; }
    const m = LA.m.get(bg) || {};
    const hv = +m.hv || null;
    if (!hv) { excluded["block group has no typical value on file"] = (excluded["block group has no typical value on file"] || 0) + 1; continue; }
    const target = (+a.Roll_LandValue) + (+a.Roll_ImpValue);
    // Holdout: the parcel's roll values and base years are withheld, as for a home that has not recently sold.
    const held = { ...a };
    delete held.Roll_LandValue; delete held.Roll_ImpValue; delete held.Roll_LandBaseYear; delete held.Roll_ImpBaseYear;
    const lot = Math.round(+a["Shape.STArea()"] || 0) || null;
    const v = page.estimate({ attributes: held, lotSqft: lot, neighborhood: m, stateCode: "CA", facts: {}, salesInfo: null });
    rows.push({
      ain: a.AIN, bg, city: (a.SitusCity || "").replace(/\s+CA$/i, "").trim() || null, base_year: +a.Roll_LandBaseYear,
      target, est: v.estimatedValue, method: v.valuationMethod, hv, hv_source: m.hvs || null,
    });
  }

  const model = (r) => ({ est: r.est, target: r.target });
  const base = (r) => ({ est: r.hv, target: r.target });
  const overall = errorMetrics(rows.map(model));
  const baseline = errorMetrics(rows.map(base));
  const gate = passesGate(overall, baseline);
  const hvSrcKey = (r) => (/recorded home sales/.test(r.hv_source || "") ? "typical value from recorded sales in the block group" : r.hv_source ? "typical value estimated from surrounding neighborhood" : "source not recorded");

  const result = {
    _status: "backtest_run",
    countyFips: "06037",
    countyName: "Los Angeles County",
    run_on: new Date().toISOString().slice(0, 10),
    script: "scripts/backtest_la_valuation.mjs",
    sample_file: path.relative(ROOT, SAMPLE),
    target: "Prop 13 base-year value (Roll_LandValue + Roll_ImpValue) of single-family parcels whose land and improvement base years are both 2025 or 2026, on the 2026 roll: a proxy for the 2025/2026 transfer price.",
    legal_basis: {
      text: "Cal. Rev. & Tax. Code §110.1(a)-(b): the base year value is the fair market value on the date a purchase or change in ownership occurs (or new construction is completed). §110(b): on a purchase, full cash value is the purchase price paid, rebuttably presumed so for an arm's-length transaction.",
      sources: ["https://california.public.law/codes/revenue_and_taxation_code_section_110.1", "https://california.public.law/codes/revenue_and_taxation_code_section_110"],
      checked_on: "2026-11-16",
      note: "Read from california.public.law (a reproduction of the code); leginfo.legislature.ca.gov blocked automated access.",
    },
    what_is_tested: "The page's estimatePropertyMarketValue() from app/app.js, run verbatim with the parcel's roll values and base years withheld (the estimate shown for a home that has not recently sold). No pool/garage facts from OpenStreetMap or permits were supplied.",
    baseline: "The block group's typical home value alone (details m.hv).",
    caveats: [
      "Base-year resets are a proxy for sales: some are non-sale transfers reassessed at the assessor's appraisal (e.g. under Prop 19).",
      "2025 base-year values on the 2026 roll include one annual inflation factor (at most 2%).",
      "The block-group typical values were built from 2022-24 data by code that is not in this repository; no price index brings them to 2025-26, so some under-estimation is expected and is part of the measured error.",
      "Only single-family use code 0100 was tested; condos, multi-unit and vacant land are not covered.",
      "The page withholds its estimate when the neighborhood value is $2M or more (a guard written for the Census ACS top-code). In LA the neighborhood value comes from recorded sales, not ACS, so this guard withholds most $2M+ homes; those rows are counted as 'excluded' in the model metrics.",
    ],
    sample: { pulled_records: sample.records.length, tested: rows.length, excluded, queries: sample.queries, pulled_at: sample.pulled },
    model: overall,
    baseline_neighborhood_median: baseline,
    beats_baseline: overall.mdape != null && baseline.mdape != null && overall.mdape < baseline.mdape,
    gate: { mdape_cap: 0.15, ...gate },
    by_price_band: groupedMetrics(rows, (r) => priceBand(r.target), model, 30),
    by_price_band_baseline: groupedMetrics(rows, (r) => priceBand(r.target), base, 30),
    by_base_year: groupedMetrics(rows, (r) => String(r.base_year), model, 30),
    by_neighborhood_value_source: groupedMetrics(rows, hvSrcKey, model, 30),
    by_city_top20: (() => { const g = groupedMetrics(rows, (r) => r.city, model, 100); return { ...g, groups: Object.fromEntries(Object.entries(g.groups).slice(0, 20)) }; })(),
    verification: {
      status: "verified",
      method: "Machine-run back-test: every tested record and every query is in the sample file; re-run the script to reproduce.",
      checked_on: new Date().toISOString().slice(0, 10),
      evidence: `${rows.length} parcels; model MdAPE ${overall.mdape}; baseline MdAPE ${baseline.mdape}`,
      notes: "Verified means the metrics are computed from the public records as stated; it does not make the proxy a recorded sale.",
    },
  };

  // Since the LA model (scripts/la_valuation_models.mjs) replaced the generic estimate for LA, this script's result
  // is kept as history under previous_page_model; the LA entry itself is written by build_la_neighborhood_values.mjs.
  const payload = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {
    _status: "no_backtest_run",
    _note: "Counties not listed under `counties` have no back-test. The 15 Nov 2026 benchmarks were computed on hand-typed, unverified sales and were removed on 16 Nov 2026.",
    counties: {},
  };
  payload.counties = payload.counties || {};
  const la = payload.counties["06037"];
  if (la && la.model_name) la.previous_page_model = result;
  else payload.counties["06037"] = result;
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(JSON.stringify({ tested: rows.length, excluded, model: overall, baseline, gate, by_price_band: result.by_price_band.groups, by_base_year: result.by_base_year.groups, by_hv_source: result.by_neighborhood_value_source.groups, page_code_chars: page.sourceChars }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
