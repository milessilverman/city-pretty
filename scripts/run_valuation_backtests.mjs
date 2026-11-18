#!/usr/bin/env node
/**
 * Valuation back-test against REAL recorded sales (replaces the 15 Nov 2026 version, which "tested" the model on
 * five hand-typed sales per county).
 *
 *   node scripts/run_valuation_backtests.mjs            # fetch (cached), back-test, write the benchmarks file
 *   BACKTEST_CACHE=/some/dir node scripts/...           # where downloads are cached (default: $TMPDIR/city-pretty-backtest-cache)
 *   BACKTEST_MAX_SALES=8000 ...                          # deterministic sample cap per county (after the sale filters)
 *   BACKTEST_COUNTIES=17031,53033 ...                    # run a subset
 *
 * For every county:
 *   1. download recorded sales, assessment rolls, building characteristics and parcel locations from the county's
 *      own open-data service (URLs below; nothing is typed in),
 *   2. keep arm's-length single-family sales (each filter is listed with its drop count in the output),
 *   3. build the engine's input ONLY from information available before the sale:
 *        - the assessment roll chosen by selectPreSaleAssessment() (leakage guard; per-county rule below),
 *        - the parcel's previous recorded sale (selectPriorSale(): strictly earlier, different document),
 *        - building/lot characteristics, and the block group's ACS figures from the county bundle,
 *   4. split sales by PARCEL into a calibration half and an evaluation half (parcelSplit()); everything reported is
 *      measured on the evaluation half only; anything fitted (baseline ratio, engine calibration) uses only the
 *      calibration half,
 *   5. compare the engine with two naive baselines:
 *        A. pre-sale assessor value x the county's median sale/assessment ratio (ratio from the calibration half),
 *        B. prior sale price x FHFA all-transactions HPI change for the county's metro division.
 *
 * Output: app/data/valuation_backtest_benchmarks.json (one entry per county that was actually tested; counties not
 * listed have NOT been back-tested) and docs/VALUATION-BACKTEST.md carries the narrative.
 */

import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VBE = require("../src/engines/valuationBacktestEngine.js");
const PVE = require("../src/engines/propertyValuationEngine.js");
const zlib = require("zlib");

const CACHE = process.env.BACKTEST_CACHE || path.join(os.tmpdir(), "city-pretty-backtest-cache");
const MAX_SALES = +(process.env.BACKTEST_MAX_SALES || 8000);
const ONLY = (process.env.BACKTEST_COUNTIES || "").split(",").map(s => s.trim()).filter(Boolean);
const OUT_FILE = path.join(ROOT, "app/data/valuation_backtest_benchmarks.json");
const DETAIL_FILE = path.join(CACHE, `backtest_detail_${ONLY.length ? ONLY.join("_") : "all"}.json`);
const WINDOW = { start: "2025-01-01", end: "2026-09-30" };
const RETRIEVED = new Date().toISOString().slice(0, 10);
const MAX_EXAMPLES = 20;

fs.mkdirSync(path.join(CACHE, "http"), { recursive: true });
const log = (...a) => console.error("[backtest]", ...a);

/* ------------------------------------------------------------------ */
/* HTTP with on-disk cache (curl honours the environment's proxy/CA)   */
/* ------------------------------------------------------------------ */

function cacheFile(key, ext = "json") {
  return path.join(CACHE, "http", crypto.createHash("sha1").update(key).digest("hex") + "." + ext);
}

function curlTo(url, file, { timeout = 900, postData = null } = {}) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  const args = ["-sS", "-f", "-L", "--retry", "4", "--retry-delay", "5", "--retry-all-errors", "-m", String(timeout), "-o", file + ".part"];
  if (postData) args.push("--data-urlencode", postData);
  args.push(url);
  execFileSync("curl", args, { stdio: ["ignore", "ignore", "inherit"] });
  fs.renameSync(file + ".part", file);
  return file;
}

function getJson(url, { postData = null, timeout } = {}) {
  const f = cacheFile(url + (postData ? "\n" + postData : ""));
  curlTo(url, f, { postData, timeout });
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

/** Socrata SODA query, all pages. params: {$select,$where,$order} */
function socrata(domain, id, params, pageSize = 50000) {
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const q = new URLSearchParams({ ...params, $limit: String(pageSize), $offset: String(offset) });
    if (!params.$order) q.set("$order", ":id");
    const rows = getJson(`https://${domain}/resource/${id}.json?${q.toString()}`);
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function chunks(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }
const sq = s => "'" + String(s).replace(/'/g, "''") + "'";
const num = v => (v === null || v === undefined || v === "" || !Number.isFinite(+v)) ? null : +v;
const pos = v => { const n = num(v); return n != null && n > 0 ? n : null; };

/* ------------------------------------------------------------------ */
/* CSV streaming (King County extracts are quoted CSV)                 */
/* ------------------------------------------------------------------ */

function parseCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function streamCsv(file, onRow, { encoding = "latin1" } = {}) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding }), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!line) continue;
    const f = parseCsvLine(line);
    if (!header) { header = f.map(h => h.trim()); continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (f[i] ?? "").trim();
    onRow(row);
  }
}

function unzipTo(zipFile, dir) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) return dir;
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("unzip", ["-o", "-q", zipFile, "-d", dir], { stdio: "inherit" });
  return dir;
}

/* ------------------------------------------------------------------ */
/* County bundle: block-group polygons + ACS neighborhood record        */
/* ------------------------------------------------------------------ */

function loadBundle(fips) {
  const f = path.join(ROOT, "counties", `bundle_${fips}.json.gz`);
  if (!fs.existsSync(f)) return null;
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString("utf8"));
  const polys = [];
  for (const ft of d.features || []) {
    const g = ft.geometry; if (!g) continue;
    const rings = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of rings) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of poly[0]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      polys.push({ id: ft.properties.id, poly, minX, minY, maxX, maxY });
    }
  }
  const CELL = 0.02; const grid = new Map();
  polys.forEach((p, i) => {
    for (let gx = Math.floor(p.minX / CELL); gx <= Math.floor(p.maxX / CELL); gx++)
      for (let gy = Math.floor(p.minY / CELL); gy <= Math.floor(p.maxY / CELL); gy++) {
        const k = gx + "," + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i);
      }
  });
  const inRing = (x, y, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  };
  return {
    acs: d.meta && d.meta.acs,
    details: d.details || {},
    blockGroupAt(lon, lat) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      const cand = grid.get(Math.floor(lon / CELL) + "," + Math.floor(lat / CELL)) || [];
      for (const i of cand) {
        const p = polys[i];
        if (lon < p.minX || lon > p.maxX || lat < p.minY || lat > p.maxY) continue;
        if (!inRing(lon, lat, p.poly[0])) continue;
        let hole = false;
        for (let h = 1; h < p.poly.length; h++) if (inRing(lon, lat, p.poly[h])) { hole = true; break; }
        if (!hole) return p.id;
      }
      return null;
    }
  };
}

/* ------------------------------------------------------------------ */
/* FHFA all-transactions HPI by metro division (quarterly)             */
/* ------------------------------------------------------------------ */

const FHFA_METRO_URL = "https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_metro.csv";
let FHFA = null;
function fhfa() {
  if (FHFA) return FHFA;
  const f = cacheFile(FHFA_METRO_URL, "csv");
  curlTo(FHFA_METRO_URL, f);
  FHFA = new Map();
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const c = parseCsvLine(line);
    const code = c[1], yr = +c[2], q = +c[3], idx = +c[4];
    if (!code || !yr || !q || !Number.isFinite(idx)) continue;
    FHFA.set(`${code}|${yr}|${q}`, idx);
  }
  return FHFA;
}
const quarterOf = d => ({ y: +d.slice(0, 4), q: Math.floor((+d.slice(5, 7) - 1) / 3) + 1 });
/**
 * Index level usable on `date`: the latest quarter that ENDED at least `lagDays` before the date (FHFA publishes a
 * quarter some weeks after it ends; 90 days is a conservative assumed lag, not a published schedule). For a prior
 * sale we use the quarter containing the sale (lag 0).
 */
function hpiAt(msad, date, lagDays) {
  const H = fhfa();
  const t = Date.parse(date.slice(0, 10) + "T00:00:00Z") - lagDays * 86400000;
  let { y, q } = quarterOf(new Date(t).toISOString().slice(0, 10));
  if (lagDays > 0) { q -= 1; if (q === 0) { q = 4; y -= 1; } } // the quarter containing t has not ended yet
  for (let k = 0; k < 8; k++) {
    const v = H.get(`${msad}|${y}|${q}`);
    if (v != null) return v;
    q -= 1; if (q === 0) { q = 4; y -= 1; }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Shared sale filters                                                 */
/* ------------------------------------------------------------------ */

const inWindow = d => d && d >= WINDOW.start && d <= WINDOW.end;
const sampleKey = s => VBE.fnv1a(`sample:${s.parcelId}:${s.docId}`);
function deterministicSample(sales, n) {
  if (sales.length <= n) return sales;
  return [...sales].sort((a, b) => sampleKey(a) - sampleKey(b)).slice(0, n);
}
/** Collapses records of the same document (or same parcel+date+price) to one. */
function dedupe(sales) {
  const seen = new Set(); const out = [];
  for (const s of sales) {
    const k = `${s.parcelId}|${s.saleDate}|${s.salePrice}`;
    if (seen.has(k)) continue; seen.add(k); out.push(s);
  }
  return out;
}

/* ================================================================== */
/* County adapters. Each returns { meta, sales[] } where a sale is:     */
/*   { parcelId, docId, saleDate, salePrice, rolls[], rollRule,         */
/*     chars{livingSqft,lotSqft,beds,baths,yearBuilt,stories,quality},  */
/*     lon, lat, history[] }                                            */
/* ================================================================== */

/* ------------------------------ Cook County, IL ------------------------------ */
async function cookCounty() {
  const D = "datacatalog.cookcountyil.gov";
  // Classes whose 2025 improvement-characteristic records are >= 99% char_use = "Single-Family" (queried from
  // x54s-btds grouped by class, char_use on 2026-11-18): 202-210, 234, 278, 295.
  const SFR_CLASSES = ["202", "203", "204", "205", "206", "207", "208", "209", "210", "234", "278", "295"];
  const raw = socrata(D, "wvhk-k5uv", {
    $select: "pin,class,sale_date,sale_price,doc_no,deed_type,is_multisale,num_parcels_sale,sale_filter_same_sale_within_365,sale_filter_less_than_10k,sale_filter_deed_type",
    $where: `sale_date between '${WINDOW.start}T00:00:00' and '${WINDOW.end}T23:59:59'`
  });
  log("cook raw sales", raw.length);
  const rows = raw.map(r => ({
    parcelId: r.pin, docId: r.doc_no, saleDate: String(r.sale_date).slice(0, 10), salePrice: num(r.sale_price), r
  }));
  const pre = VBE.applySaleFilters(rows, [
    { id: "class_single_family", description: "Assessor class 202-210, 234, 278 or 295 (classes whose improvement records are >= 99% 'Single-Family')", test: s => SFR_CLASSES.includes(s.r.class) },
    { id: "price_10k", description: "Sale price >= $10,000 and not flagged by the Assessor's sale_filter_less_than_10k", test: s => s.salePrice >= 10000 && !s.r.sale_filter_less_than_10k },
    { id: "deed_type", description: "Warranty or Trustee deed and not flagged by the Assessor's sale_filter_deed_type (drops quit-claim, executor, 'Other' and similar)", test: s => ["Warranty", "Trustee"].includes(s.r.deed_type) && !s.r.sale_filter_deed_type },
    { id: "single_parcel", description: "Not a multi-parcel sale (is_multisale false, num_parcels_sale = 1)", test: s => !s.r.is_multisale && +s.r.num_parcels_sale === 1 },
    { id: "not_resale_within_365", description: "Not flagged sale_filter_same_sale_within_365 (same parcel sold again within a year)", test: s => !s.r.sale_filter_same_sale_within_365 }
  ]);
  const sample = deterministicSample(dedupe(pre.kept), MAX_SALES);
  const pins = [...new Set(sample.map(s => s.parcelId))];
  log("cook after pre-filters", pre.kept.length, "sampled", sample.length);

  const rollsBy = new Map(), charsBy = new Map(), locBy = new Map(), histBy = new Map();
  for (const ch of chunks(pins, 250)) {
    const inList = ch.map(sq).join(",");
    for (const r of socrata(D, "uzyt-m557", { $select: "pin,year,mailed_tot,mailed_land,mailed_bldg", $where: `pin in (${inList}) and year >= 2022` })) {
      if (!rollsBy.has(r.pin)) rollsBy.set(r.pin, []);
      rollsBy.get(r.pin).push({ year: +r.year, total: pos(r.mailed_tot), land: num(r.mailed_land), bldg: num(r.mailed_bldg), stage: "mailed (assessor first-pass, before Board of Review appeals)" });
    }
    for (const r of socrata(D, "x54s-btds", { $select: "pin,year,char_use,pin_num_cards,char_bldg_sf,char_land_sf,char_beds,char_fbath,char_hbath,char_yrblt,char_cnst_qlty", $where: `pin in (${inList}) and year >= '2022'` })) {
      if (!charsBy.has(r.pin)) charsBy.set(r.pin, []);
      charsBy.get(r.pin).push(r);
    }
    for (const r of socrata(D, "pabr-t5kh", { $select: "pin,lat,lon", $where: `pin in (${inList})` })) locBy.set(r.pin, r);
    for (const r of socrata(D, "wvhk-k5uv", { $select: "pin,sale_date,sale_price,doc_no,deed_type,is_multisale,sale_filter_deed_type,sale_filter_less_than_10k", $where: `pin in (${inList})` })) {
      if (r.is_multisale || r.sale_filter_deed_type || r.sale_filter_less_than_10k) continue;
      if (!histBy.has(r.pin)) histBy.set(r.pin, []);
      histBy.get(r.pin).push({ price: num(r.sale_price), date: String(r.sale_date).slice(0, 10), docId: r.doc_no });
    }
  }
  const sales = sample.map(s => {
    const saleYear = +s.saleDate.slice(0, 4);
    // characteristics from the latest roll year before the sale year (same leakage rule as the values)
    const chs = (charsBy.get(s.parcelId) || []).filter(c => Math.floor(+c.year) <= saleYear - 1).sort((a, b) => +b.year - +a.year);
    const c = chs[0] || null;
    const loc = locBy.get(s.parcelId) || {};
    const fb = num(c && c.char_fbath), hb = num(c && c.char_hbath);
    return {
      parcelId: s.parcelId, docId: s.docId, saleDate: s.saleDate, salePrice: s.salePrice,
      rolls: rollsBy.get(s.parcelId) || [],
      charRow: c,
      chars: c ? {
        livingSqft: pos(c.char_bldg_sf), lotSqft: pos(c.char_land_sf), beds: num(c.char_beds),
        baths: fb != null ? fb + 0.5 * (hb || 0) : null, yearBuilt: pos(c.char_yrblt), quality: c.char_cnst_qlty || null
      } : {},
      lon: num(loc.lon), lat: num(loc.lat),
      history: histBy.get(s.parcelId) || []
    };
  });
  return {
    meta: {
      fips: "17031", name: "Cook County", state: "IL", msad: "16984",
      source_dataset: "Cook County Assessor's Office open data: Parcel Sales (wvhk-k5uv), Assessed Values (uzyt-m557), Residential Single and Multi-Family Improvement Characteristics (x54s-btds), Parcel Universe (pabr-t5kh)",
      source_url: "https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json",
      source_urls: ["https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json", "https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json", "https://datacatalog.cookcountyil.gov/resource/x54s-btds.json", "https://datacatalog.cookcountyil.gov/resource/pabr-t5kh.json"],
      roll_rule: { maxYearOffset: 1 },
      roll_rule_text: "Assessor 'mailed' (first-pass, pre-appeal) values of an assessment year strictly before the sale's calendar year. Cook's model for year Y is built from earlier sales, and the mailed value precedes any appeal that could cite the sale.",
      roll_kind: "assessed value (Cook residential assessments are a fraction of market value; the engine multiplies)",
      raw_count: raw.length,
      filters: pre.report,
      pre_kept: pre.kept.length,
      post_filters: [
        { id: "single_family_record", description: "Improvement record for the roll year before the sale says char_use 'Single-Family' with exactly one building card", test: s => s.charRow && s.charRow.char_use === "Single-Family" && +s.charRow.pin_num_cards === 1 }
      ]
    },
    sales
  };
}

/* ------------------------------ King County, WA ------------------------------ */
async function kingCounty() {
  const base = "https://aqua.kingcounty.gov/extranet/assessor/";
  const dl = name => {
    const zip = path.join(CACHE, `king_${name.replace(/ /g, "_")}.zip`);
    curlTo(base + encodeURIComponent(name) + ".zip", zip, { timeout: 3600 });
    return unzipTo(zip, zip.replace(/\.zip$/, ""));
  };
  const salesDir = dl("Real Property Sales"), parcelDir = dl("Parcel"), resDir = dl("Residential Building"), lookupDir = dl("Lookup");

  // Decode lookup codes from the county's own lookup table (EXTR_LookUp.csv), so filters cite the published text.
  const lookup = {};
  await streamCsv(path.join(lookupDir, "EXTR_LookUp.csv"), r => { (lookup[r.LUType] = lookup[r.LUType] || {})[r.LUItem] = r.LUDescription; });
  const expect = (t, item, text) => {
    if (((lookup[t] || {})[item] || "").toUpperCase() !== text.toUpperCase())
      throw new Error(`King lookup ${t}/${item} is '${(lookup[t] || {})[item]}', expected '${text}'; re-check the filter codes`);
  };
  // LUType of each sales field identified by matching code ranges; asserted against the published descriptions.
  expect("2", "6", "RESIDENTIAL");                  // PrincipalUse
  expect("4", "8", "Res-Improved property");        // PropertyClass
  expect("5", "1", "None");                         // SaleReason
  expect("6", "2", "Warranty Deed");                // SaleInstrument
  expect("6", "3", "Statutory Warranty Deed");
  expect("102", "2", "Single Family(Res Use/Zone)"); // PresentUse (parcel)

  const all = []; const exciseCount = new Map();
  await streamCsv(path.join(salesDir, "EXTR_RPSale.csv"), r => {
    exciseCount.set(r.ExciseTaxNbr, (exciseCount.get(r.ExciseTaxNbr) || 0) + 1);
    const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(r.DocumentDate); if (!m) return;
    const date = `${m[3]}-${m[1]}-${m[2]}`;
    const price = num(r.SalePrice);
    all.push({ pin: r.Major + r.Minor, date, price, excise: r.ExciseTaxNbr, use: r.PrincipalUse, cls: r.PropertyClass, instr: r.SaleInstrument, reason: r.SaleReason, warn: (r.SaleWarning || "").trim() });
  });
  log("king sales rows", all.length);
  const histBy = new Map();
  for (const s of all) {
    if (!(s.price >= 10000) || s.use !== "6" || exciseCount.get(s.excise) !== 1) continue;
    if (!histBy.has(s.pin)) histBy.set(s.pin, []);
    histBy.get(s.pin).push({ price: s.price, date: s.date, docId: s.excise });
  }
  const rows = all.filter(s => inWindow(s.date)).map(s => ({ parcelId: s.pin, docId: s.excise, saleDate: s.date, salePrice: s.price, r: s }));
  const pre = VBE.applySaleFilters(rows, [
    { id: "price_10k", description: "Sale price >= $10,000", test: s => s.salePrice >= 10000 },
    { id: "principal_use_residential", description: "PrincipalUse = 6 'RESIDENTIAL' and PropertyClass = 8 'Res-Improved property'", test: s => s.r.use === "6" && s.r.cls === "8" },
    { id: "deed_type", description: "SaleInstrument 2 'Warranty Deed' or 3 'Statutory Warranty Deed'", test: s => s.r.instr === "2" || s.r.instr === "3" },
    { id: "sale_reason_none", description: "SaleReason 1 'None' (drops trust, estate, divorce, foreclosure, quit-claim gift and other non-market reasons)", test: s => s.r.reason === "1" },
    { id: "no_sale_warning", description: "No SaleWarning code at all (the Assessor's own flags: related party, multi-parcel, non-representative, short sale, bank resale, etc.)", test: s => !s.r.warn },
    { id: "single_parcel", description: "Excise tax affidavit covers one parcel only", test: s => exciseCount.get(s.docId) === 1 }
  ]);
  const sample = deterministicSample(dedupe(pre.kept), MAX_SALES);
  const pinSet = new Set(sample.map(s => s.parcelId));
  log("king after pre-filters", pre.kept.length, "sampled", sample.length);

  const parcel = new Map();
  await streamCsv(path.join(parcelDir, "EXTR_Parcel.csv"), r => { const p = r.Major + r.Minor; if (pinSet.has(p)) parcel.set(p, { use: r.PresentUse, lot: num(r.SqFtLot), propType: r.PropType }); });
  const bldgs = new Map();
  await streamCsv(path.join(resDir, "EXTR_ResBldg.csv"), r => { const p = r.Major + r.Minor; if (pinSet.has(p)) { if (!bldgs.has(p)) bldgs.set(p, []); bldgs.get(p).push(r); } });

  // Value history: 3+ GB; stream once and keep only sampled parcels, tax years >= 2022. Cached as JSON.
  const vhCache = path.join(CACHE, `king_value_history_${crypto.createHash("sha1").update([...pinSet].sort().join(",")).digest("hex").slice(0, 12)}.json`);
  let vh;
  if (fs.existsSync(vhCache)) vh = JSON.parse(fs.readFileSync(vhCache, "utf8"));
  else {
    const vhDir = dl("Value History");
    vh = {};
    await streamCsv(path.join(vhDir, "EXTR_ValueHistory_V.csv"), r => {
      const p = r.Major + r.Minor; if (!pinSet.has(p) || +r.TaxYr < 2022) return;
      (vh[p] = vh[p] || []).push({ year: +r.TaxYr, total: pos((num(r.ApprLandVal) || 0) + (num(r.ApprImpsVal) || 0)), land: num(r.ApprLandVal), bldg: num(r.ApprImpsVal), changeDate: (r.ChangeDate || "").slice(0, 10) || null, stage: r.Reason });
    });
    fs.writeFileSync(vhCache, JSON.stringify(vh));
  }

  // Parcel centroids (vertex mean of the outer ring) from the county parcel layer, for the block-group lookup.
  const loc = new Map();
  for (const ch of chunks([...pinSet], 100)) {
    const url = "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_Parcels/MapServer/0/query";
    const body = `where=PIN in (${ch.map(sq).join(",")})`;
    const j = getJson(`${url}?outFields=PIN&returnGeometry=true&outSR=4326&f=json&geometryPrecision=6`, { postData: body });
    for (const f of j.features || []) {
      const ring = f.geometry && f.geometry.rings && f.geometry.rings[0]; if (!ring || !ring.length) continue;
      let x = 0, y = 0; for (const [a, b] of ring) { x += a; y += b; }
      loc.set(f.attributes.PIN, { lon: x / ring.length, lat: y / ring.length });
    }
  }

  const sales = sample.map(s => {
    const p = parcel.get(s.parcelId) || {};
    const bs = bldgs.get(s.parcelId) || [];
    const b = bs.length === 1 ? bs[0] : null;
    const l = loc.get(s.parcelId) || {};
    const baths = b ? (num(b.BathFullCount) || 0) + 0.75 * (num(b.Bath3qtrCount) || 0) + 0.5 * (num(b.BathHalfCount) || 0) : null;
    return {
      parcelId: s.parcelId, docId: s.docId, saleDate: s.saleDate, salePrice: s.salePrice,
      parcelRow: p, bldgCount: bs.length, bldgRow: b,
      rolls: vh[s.parcelId] || [],
      chars: b ? { livingSqft: pos(b.SqFtTotLiving), lotSqft: pos(p.lot), beds: num(b.Bedrooms), baths: baths || null, yearBuilt: pos(b.YrBuilt), stories: pos(b.Stories) } : { lotSqft: pos(p.lot) },
      lon: l.lon, lat: l.lat,
      history: histBy.get(s.parcelId) || []
    };
  });
  return {
    meta: {
      fips: "53033", name: "King County", state: "WA", msad: "42644",
      source_dataset: "King County Department of Assessments data download: Real Property Sales (EXTR_RPSale), Parcel (EXTR_Parcel), Residential Building (EXTR_ResBldg), Value History (EXTR_ValueHistory_V), Lookup (EXTR_LookUp); parcel shapes from gismaps.kingcounty.gov KingCo_Parcels",
      source_url: "https://aqua.kingcounty.gov/extranet/assessor/Real%20Property%20Sales.zip",
      source_urls: ["https://aqua.kingcounty.gov/extranet/assessor/Real%20Property%20Sales.zip", "https://aqua.kingcounty.gov/extranet/assessor/Value%20History.zip", "https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip", "https://aqua.kingcounty.gov/extranet/assessor/Parcel.zip", "https://aqua.kingcounty.gov/extranet/assessor/Lookup.zip", "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_Parcels/MapServer/0"],
      roll_rule: { maxYearOffset: 0, requireChangeDateBefore: true },
      roll_rule_text: "Appraised land + improvement value from the value history, tax year no later than the sale year AND with a ChangeDate strictly before the sale date (the value had been set before the sale happened).",
      roll_kind: "appraised market value",
      raw_count: rows.length,
      filters: pre.report,
      pre_kept: pre.kept.length,
      post_filters: [
        { id: "present_use_single_family", description: "Parcel PresentUse = 2 'Single Family(Res Use/Zone)'", test: s => s.parcelRow && s.parcelRow.use === "2" },
        { id: "one_dwelling", description: "Exactly one residential building record with one living unit", test: s => s.bldgCount === 1 && +s.bldgRow.NbrLivingUnits === 1 }
      ]
    },
    sales
  };
}

/* ------------------------------ Philadelphia, PA ------------------------------ */
function carto(q) {
  const j = getJson("https://phl.carto.com/api/v2/sql", { postData: "q=" + q, timeout: 900 });
  if (j.error) throw new Error("carto: " + JSON.stringify(j.error));
  return j.rows;
}
async function philadelphia() {
  const page = 20000; const raw = [];
  for (let off = 0; ; off += page) {
    const rows = carto(`SELECT r.document_id, r.opa_account_num, r.document_type, to_char(r.document_date,'YYYY-MM-DD') AS document_date, r.total_consideration, r.property_count, r.grantors, r.grantees,
        o.category_code, o.total_livable_area, o.total_area, o.number_of_bedrooms, o.number_of_bathrooms, o.year_built, o.number_stories, o.quality_grade, ST_X(o.the_geom) AS lon, ST_Y(o.the_geom) AS lat
      FROM rtt_summary r LEFT JOIN opa_properties_public o ON o.parcel_number = r.opa_account_num
      WHERE r.document_type ILIKE '%DEED%' AND r.document_date >= '${WINDOW.start}' AND r.document_date < '${WINDOW.end}'::date + 1
      ORDER BY r.document_id LIMIT ${page} OFFSET ${off}`);
    raw.push(...rows);
    if (rows.length < page) break;
  }
  log("philly raw deeds", raw.length);
  const firstWord = s => String(s || "").split(";").map(x => x.trim().split(/\s+/)[0]).filter(w => w && w.length >= 3);
  const INSTITUTION = /SHERIFF|CITY OF PHILADELPHIA|LAND BANK|REDEVELOPMENT AUTH|HOUSING AUTH|FEDERAL NATIONAL|FEDERAL HOME LOAN|SECRETARY OF HOUSING|HOUSING AND URBAN|MORTGAGE|BANK\b|TRUSTEE|ESTATE OF|EXECUT/i;
  const rows = raw.map(r => ({ parcelId: r.opa_account_num, docId: String(r.document_id), saleDate: r.document_date, salePrice: num(r.total_consideration), r }));
  const docCount = new Map();
  for (const s of rows) { const k = s.parcelId + "|" + s.saleDate; docCount.set(k, (docCount.get(k) || 0) + 1); }
  const pre = VBE.applySaleFilters(rows, [
    { id: "deed_type", description: "Document type exactly 'DEED' (drops sheriff's deeds, land-bank deeds, 'MISCELLANEOUS DEED' and other deed types)", test: s => s.r.document_type === "DEED" },
    { id: "has_account", description: "Deed is matched to an OPA account", test: s => !!s.parcelId },
    { id: "single_parcel", description: "property_count = 1 (one property on the deed)", test: s => +s.r.property_count === 1 },
    { id: "price_10k", description: "Total consideration >= $10,000 (drops $1 / nominal transfers)", test: s => s.salePrice >= 10000 },
    { id: "single_family", description: "OPA category_code 1 'SINGLE FAMILY'", test: s => s.r.category_code === "1" },
    { id: "parties", description: "Name screen: no government, sheriff, land bank, lender, trustee or estate party, and grantor/grantee do not share a first name-token (surname in OPA's LAST FIRST order) - a heuristic for family transfers", test: s => !INSTITUTION.test(s.r.grantors || "") && !INSTITUTION.test(s.r.grantees || "") && !firstWord(s.r.grantors).some(w => firstWord(s.r.grantees).includes(w)) },
    { id: "one_deed_that_day", description: "Only one deed recorded for the account on that date", test: s => docCount.get(s.parcelId + "|" + s.saleDate) === 1 }
  ]);
  const sample = deterministicSample(dedupe(pre.kept), MAX_SALES);
  const accts = [...new Set(sample.map(s => s.parcelId))];
  log("philly after pre-filters", pre.kept.length, "sampled", sample.length);
  const rollsBy = new Map(), histBy = new Map();
  for (const ch of chunks(accts, 500)) {
    const inList = ch.map(sq).join(",");
    for (const r of carto(`SELECT parcel_number, year, market_value, taxable_land, exempt_land, taxable_building, exempt_building FROM assessments WHERE parcel_number IN (${inList}) AND year::int >= 2022`)) {
      if (!rollsBy.has(r.parcel_number)) rollsBy.set(r.parcel_number, []);
      rollsBy.get(r.parcel_number).push({ year: +r.year, total: pos(r.market_value), land: (num(r.taxable_land) || 0) + (num(r.exempt_land) || 0), bldg: (num(r.taxable_building) || 0) + (num(r.exempt_building) || 0), stage: "certified market value" });
    }
    for (const r of carto(`SELECT opa_account_num, document_id, to_char(document_date,'YYYY-MM-DD') AS d, total_consideration FROM rtt_summary WHERE opa_account_num IN (${inList}) AND document_type = 'DEED' AND property_count = 1 AND total_consideration >= 10000`)) {
      if (!histBy.has(r.opa_account_num)) histBy.set(r.opa_account_num, []);
      histBy.get(r.opa_account_num).push({ price: num(r.total_consideration), date: r.d, docId: String(r.document_id) });
    }
  }
  const sales = sample.map(s => ({
    parcelId: s.parcelId, docId: s.docId, saleDate: s.saleDate, salePrice: s.salePrice,
    rolls: rollsBy.get(s.parcelId) || [],
    chars: {
      livingSqft: pos(s.r.total_livable_area), lotSqft: pos(s.r.total_area), beds: pos(s.r.number_of_bedrooms),
      baths: pos(s.r.number_of_bathrooms), yearBuilt: pos(s.r.year_built), stories: pos(s.r.number_stories), quality: s.r.quality_grade || null
    },
    lon: num(s.r.lon), lat: num(s.r.lat),
    history: histBy.get(s.parcelId) || []
  }));
  return {
    meta: {
      fips: "42101", name: "Philadelphia County", state: "PA", msad: "37964",
      source_dataset: "City of Philadelphia open data (CARTO SQL API): Real Estate Transfers rtt_summary, OPA property assessments history (assessments), OPA properties (opa_properties_public)",
      source_url: "https://phl.carto.com/api/v2/sql?q=SELECT+*+FROM+rtt_summary+LIMIT+1",
      source_urls: ["https://phl.carto.com/api/v2/sql (table rtt_summary)", "https://phl.carto.com/api/v2/sql (table assessments)", "https://phl.carto.com/api/v2/sql (table opa_properties_public)"],
      roll_rule: { maxYearOffset: 1 },
      roll_rule_text: "OPA certified market value for a tax year strictly before the sale's calendar year (no change dates are published, so the roll of the sale's own year is never used).",
      roll_kind: "certified market value",
      raw_count: raw.length,
      filters: pre.report,
      pre_kept: pre.kept.length,
      post_filters: [],
      caveats: ["Building characteristics (living area, bedrooms, year built) are OPA's current record, not a snapshot from before the sale; a renovation after the sale would leak into the hedonic part of the engine."]
    },
    sales
  };
}

/* ------------------------------ New York City boroughs ------------------------------ */
async function nycBorough(boro, fips, name) {
  const D = "data.cityofnewyork.us";
  const sel = "borough,block,lot,building_class_category,residential_units,commercial_units,total_units,sale_price,sale_date";
  const annual = socrata(D, "w2pb-icbu", { $select: sel, $where: `borough='${boro}' AND sale_date between '${WINDOW.start}T00:00:00' and '2025-12-31T23:59:59'` });
  const rolling = socrata(D, "usep-8jbt", { $select: sel, $where: `borough='${boro}' AND sale_date between '2026-01-01T00:00:00' and '${WINDOW.end}T23:59:59'` });
  const bbl = r => `${boro}${String(+r.block).padStart(5, "0")}${String(+r.lot).padStart(4, "0")}`;
  const raw = [...annual, ...rolling].map(r => ({ parcelId: bbl(r), docId: `${bbl(r)}:${String(r.sale_date).slice(0, 10)}:${r.sale_price}`, saleDate: String(r.sale_date).slice(0, 10), salePrice: num(String(r.sale_price || "").replace(/,/g, "")), r }));
  log("nyc", boro, "raw", raw.length);
  const multiKey = s => `${s.r.block}|${s.saleDate}|${s.salePrice}`;
  const multi = new Map(); for (const s of raw) multi.set(multiKey(s), (multi.get(multiKey(s)) || 0) + 1);
  const pre = VBE.applySaleFilters(raw, [
    { id: "one_family", description: "Building class category '01 ONE FAMILY DWELLINGS' at time of sale", test: s => /^01 ONE FAMILY/.test(s.r.building_class_category || "") },
    { id: "one_unit", description: "residential_units = 1 and commercial_units = 0", test: s => +String(s.r.residential_units || "0").replace(/,/g, "") === 1 && +String(s.r.commercial_units || "0").replace(/,/g, "") === 0 },
    { id: "price_10k", description: "Sale price >= $10,000 (DOF: $0 sales are transfers without cash consideration, e.g. between family members)", test: s => s.salePrice >= 10000 },
    { id: "single_lot", description: "No other lot on the same block sold the same day for the same total price (multi-lot sale)", test: s => multi.get(multiKey(s)) === 1 }
  ]);
  const sample = deterministicSample(dedupe(pre.kept), MAX_SALES);
  const bbls = [...new Set(sample.map(s => s.parcelId))];
  log("nyc", boro, "after pre-filters", pre.kept.length, "sampled", sample.length);
  const rollsBy = new Map(), locBy = new Map(), histBy = new Map();
  for (const ch of chunks(bbls, 250)) {
    const inList = ch.map(sq).join(",");
    for (const r of socrata(D, "8y4t-faws", { $select: "parid,year,period,finmkttot,finmktland,gross_sqft,land_area,yrbuilt,bld_story,bldg_class,units", $where: `parid in (${inList}) and year >= '2022'` })) {
      if (!rollsBy.has(r.parid)) rollsBy.set(r.parid, []);
      rollsBy.get(r.parid).push({ year: +r.year, total: pos(r.finmkttot), land: num(r.finmktland), bldg: (pos(r.finmkttot) != null && num(r.finmktland) != null) ? +r.finmkttot - +r.finmktland : null, stage: "final market value", row: r });
    }
    for (const r of socrata(D, "64uk-42ks", { $select: "bbl,latitude,longitude", $where: `bbl in (${ch.join(",")})` })) locBy.set(String(Math.round(+r.bbl)), r);
    for (const r of socrata(D, "w2pb-icbu", { $select: "bbl,sale_price,sale_date,building_class_category", $where: `bbl in (${inList}) and sale_price > 10000` })) {
      const k = String(r.bbl); if (!histBy.has(k)) histBy.set(k, []);
      histBy.get(k).push({ price: num(r.sale_price), date: String(r.sale_date).slice(0, 10), docId: `${k}:${String(r.sale_date).slice(0, 10)}:${r.sale_price}` });
    }
  }
  const sales = sample.map(s => {
    const saleYear = +s.saleDate.slice(0, 4);
    const rolls = rollsBy.get(s.parcelId) || [];
    // NYC publishes several records per lot and year (periods); keep the latest period for each year.
    const byYear = new Map();
    for (const r of rolls) { const cur = byYear.get(r.year); if (!cur || (+r.row.period || 0) > (+cur.row.period || 0)) byYear.set(r.year, r); }
    const rl = [...byYear.values()];
    const charRoll = rl.filter(r => r.year <= saleYear - 1).sort((a, b) => b.year - a.year)[0];
    const c = charRoll ? charRoll.row : null;
    const loc = locBy.get(s.parcelId) || {};
    return {
      parcelId: s.parcelId, docId: s.docId, saleDate: s.saleDate, salePrice: s.salePrice,
      rolls: rl.map(({ row, ...r }) => r),
      chars: c ? { livingSqft: pos(c.gross_sqft), lotSqft: pos(c.land_area), yearBuilt: pos(c.yrbuilt), stories: pos(c.bld_story) } : {},
      lon: num(loc.longitude), lat: num(loc.latitude),
      history: (histBy.get(s.parcelId) || []).concat(raw.filter(x => x.parcelId === s.parcelId && x.salePrice >= 10000).map(x => ({ price: x.salePrice, date: x.saleDate, docId: x.docId })))
    };
  });
  return {
    meta: {
      fips, name, state: "NY", msad: "35614",
      source_dataset: "NYC Department of Finance: Citywide Annualized Calendar Sales (w2pb-icbu) and Rolling Calendar Sales (usep-8jbt); Property Valuation and Assessment Data Tax Classes 1-4 (8y4t-faws); Department of City Planning PLUTO (64uk-42ks) for lot coordinates",
      source_url: "https://data.cityofnewyork.us/resource/w2pb-icbu.json",
      source_urls: ["https://data.cityofnewyork.us/resource/w2pb-icbu.json", "https://data.cityofnewyork.us/resource/usep-8jbt.json", "https://data.cityofnewyork.us/resource/8y4t-faws.json", "https://data.cityofnewyork.us/resource/64uk-42ks.json"],
      roll_rule: { maxYearOffset: 1 },
      roll_rule_text: "DOF final market value (FINMKTTOT) from a roll year label strictly before the sale's calendar year (the roll for the sale's own year is never used, whatever its publication date).",
      roll_kind: "DOF market value",
      raw_count: raw.length,
      filters: pre.report,
      pre_kept: pre.kept.length,
      post_filters: [],
      caveats: ["NYC sales files carry no deed-type or arm's-length flag; transfers between related parties for more than $10,000 remain in the sample.", "Prior sales only go back to 2016 (first year of the annualized sales dataset queried)."]
    },
    sales
  };
}

/* ================================================================== */
/* Engine input + evaluation                                           */
/* ================================================================== */

/** Maps the pre-sale roll into the attribute names the engine's state paths read. */
function engineAttributes(state, roll, chars) {
  const a = {};
  if (chars.livingSqft != null) a.LIVING_AREA = chars.livingSqft;
  if (chars.yearBuilt != null) a.YearBuilt = chars.yearBuilt;
  if (chars.beds != null) a.BEDROOMS = chars.beds;
  if (chars.baths != null) a.BATHROOMS = chars.baths;
  if (chars.quality) a.QualityClass = chars.quality;
  a.UseDescription = "Single Family Residential";
  if (!roll) return a;
  if (state === "IL") { a.Roll_LandValue = roll.land; a.Roll_ImpValue = roll.bldg; a.Roll_TotalValue = roll.total; }
  else if (state === "WA") a.AppraisedValue = roll.total;
  else if (state === "PA") a.MarketValue = roll.total;
  else if (state === "NY") a.MARKET_VALUE = roll.total;
  else a.MARKET_VALUE = roll.total;
  return a;
}

function engineInput(meta, s, bundle, extra = {}) {
  const facts = {};
  if (s.chars.livingSqft != null) facts.bldg = s.chars.livingSqft;
  if (s.chars.beds != null) facts.beds = s.chars.beds;
  if (s.chars.baths != null) facts.baths = s.chars.baths;
  if (s.chars.yearBuilt != null) facts.yb = s.chars.yearBuilt;
  if (s.chars.stories != null) facts.stories = s.chars.stories;
  const nb = s.bg && bundle && bundle.details[s.bg] ? bundle.details[s.bg].m : {};
  const input = {
    attributes: engineAttributes(meta.state, s.roll, s.chars),
    neighborhood: nb,
    stateCode: meta.state,
    facts,
    salesInfo: s.prior ? { price: s.prior.price, date: s.prior.date, year: s.prior.year, ...(extra.calibration && s.hpiRatio ? { hpiRatio: s.hpiRatio } : {}) } : null,
    ...extra
  };
  if (s.chars.lotSqft != null) input.lotSqft = s.chars.lotSqft;
  return input;
}

/** Short label for the engine's path: which inputs it blended. */
function methodPath(res) {
  const parts = [];
  if (res.saleCompEst) parts.push("prior sale");
  if (res.assessorMarketEst) parts.push("assessor");
  parts.push("hedonic");
  return parts.join(" + ");
}

function evaluateCounty(meta, salesIn) {
  const bundle = loadBundle(meta.fips);
  // post-join filters, then the leakage guard
  const post = VBE.applySaleFilters(salesIn, meta.post_filters || []);
  for (const s of post.kept) {
    s.roll = VBE.selectPreSaleAssessment(s.rolls, s.saleDate, meta.roll_rule);
    s.prior = VBE.selectPriorSale(s.history, { date: s.saleDate, docId: s.docId }, { minDaysBefore: 1, minPrice: 10000 });
    s.bg = bundle ? bundle.blockGroupAt(s.lon, s.lat) : null;
    s.split = VBE.parcelSplit(s.parcelId);
  }
  const guard = VBE.applySaleFilters(post.kept, [
    { id: "pre_sale_roll", description: "A pre-sale assessment exists under the leakage rule: " + meta.roll_rule_text, test: s => !!s.roll },
    { id: "located", description: "Parcel located inside one of the county bundle's block groups", test: s => !!s.bg },
    { id: "price_25k", description: "Sale price >= $25,000 (the floor runCountyValuationBacktest scores; keeps engine and baselines on the same sales)", test: s => s.salePrice >= 25000 }
  ]);
  const usable = guard.kept;
  const cal = usable.filter(s => s.split === "calibration");
  const ev = usable.filter(s => s.split === "evaluation");

  // Baseline A ratio from the calibration half only
  const ratio = VBE.median(cal.map(s => s.salePrice / s.roll.total));
  // Engine calibration factor (calibration half only): median(sale / shipped-engine estimate)
  for (const s of usable) {
    const res = PVE.estimatePropertyMarketValue(engineInput(meta, s, bundle));
    s.engine = res.estimatedValue > 0 ? res.estimatedValue : null;
    s.engineMethod = methodPath(res);
    s.engineMethodFull = res.valuationMethod;
    s.engineAssessorEst = res.assessorMarketEst;
    s.engineSaleEst = res.saleCompEst;
    s.engineHedonic = res.hedonicEst;
    s.baseA = s.roll.total * ratio;
    if (s.prior) {
      const h0 = hpiAt(meta.msad, s.prior.date, 0), h1 = hpiAt(meta.msad, s.saleDate, 90);
      s.hpiRatio = (h0 && h1) ? h1 / h0 : null;
      s.baseB = s.hpiRatio ? s.prior.price * s.hpiRatio : null;
    } else { s.hpiRatio = null; s.baseB = null; }
  }
  const calib = VBE.median(cal.filter(s => s.engine).map(s => s.salePrice / s.engine));

  // County calibration for the engine, fitted on the calibration half only:
  //   assessorRatio = median(sale / pre-sale roll value); hedonicScale = median(sale / hedonic estimate);
  //   blend weights proportional to 1 / MdAPE^2 of each calibrated component on the calibration half.
  const hedonicScale = VBE.median(cal.filter(s => s.engineHedonic > 0).map(s => s.salePrice / s.engineHedonic));
  const mdapeOf = arr => VBE.median(arr.map(([p, e]) => Math.abs(e - p) / p));
  const eA = mdapeOf(cal.map(s => [s.salePrice, s.roll.total * ratio]));
  const eP = mdapeOf(cal.filter(s => s.baseB).map(s => [s.salePrice, s.baseB]));
  const eH = mdapeOf(cal.filter(s => s.engineHedonic > 0).map(s => [s.salePrice, s.engineHedonic * hedonicScale]));
  const inv = e => (e > 0 ? 1 / (e * e) : 0);
  const tot = inv(eA) + inv(eP) + inv(eH);
  const r4 = v => Math.round(v * 10000) / 10000;
  const calibration = {
    assessorRatio: r4(ratio), hedonicScale: r4(hedonicScale),
    weights: { assessor: r4(inv(eA) / tot), priorSale: r4(inv(eP) / tot), hedonic: r4(inv(eH) / tot) },
    component_mdape_on_calibration_half: { assessor: r4(eA), priorSale: r4(eP), hedonic: r4(eH) },
    fitted_on: `calibration half (${cal.length} sales, disjoint parcels from the evaluation half)`
  };
  for (const s of usable) {
    const res = PVE.estimatePropertyMarketValue(engineInput(meta, s, bundle, { calibration }));
    s.engineCal = res.estimatedValue > 0 ? res.estimatedValue : null;
    s.engineCalMethod = methodPath(res);
  }
  return { meta, bundle, post, guard, usable, cal, ev, ratio, calib, calibration };
}

function pct(v) { return v == null ? "n/a" : (v * 100).toFixed(1) + "%"; }

/* ================================================================== */
/* Main                                                                */
/* ================================================================== */

const ADAPTERS = [
  ["17031", cookCounty],
  ["53033", kingCounty],
  ["42101", philadelphia],
  ["36081", () => nycBorough("4", "36081", "Queens County")],
  ["36085", () => nycBorough("5", "36085", "Richmond County")],
  ["36047", () => nycBorough("3", "36047", "Kings County")]
];

async function main() {
  const out = {};
  const detail = {};
  for (const [fips, fn] of ADAPTERS) {
    if (ONLY.length && !ONLY.includes(fips)) continue;
    let res;
    try {
      const { meta, sales } = await fn();
      res = evaluateCounty(meta, sales);
      if (meta.pre_kept == null) throw new Error("adapter did not report pre_kept");
    } catch (e) {
      log(`county ${fips} FAILED: ${e.message}`);
      continue;
    }
    const { meta, ev, cal, usable, ratio, calib, post, guard } = res;
    const salesCount = res.post.kept.length + res.post.report.reduce((n, f) => n + f.dropped, 0);
    const sumEngine = VBE.summarizeErrors(ev.map(s => ({ price: s.salePrice, estimate: s.engine, method: s.engineMethod })));
    const sumEngineCal = VBE.summarizeErrors(ev.map(s => ({ price: s.salePrice, estimate: s.engine ? s.engine * calib : null, method: s.engineMethod })));
    const sumCal = VBE.summarizeErrors(ev.map(s => ({ price: s.salePrice, estimate: s.engineCal, method: s.engineCalMethod })));
    const sumA = VBE.summarizeErrors(ev.map(s => ({ price: s.salePrice, estimate: s.baseA })));
    const evB = ev.filter(s => s.baseB);
    const sumB = VBE.summarizeErrors(evB.map(s => ({ price: s.salePrice, estimate: s.baseB })));
    const sumEngineOnB = VBE.summarizeErrors(evB.map(s => ({ price: s.salePrice, estimate: s.engine })));
    if (sumEngine.sampleCount < 500) { log(`county ${fips}: only ${sumEngine.sampleCount} evaluation sales; not written`); continue; }

    // Status from the engine as shipped, via the same engine function the page relies on.
    const facts = ev.map(s => ({
      parcelId: s.parcelId, salePrice: s.salePrice, saleDate: s.saleDate, isArmsLength: true,
      countyFips: meta.fips, countyName: meta.name, stateCode: meta.state, attributes: {},
      valuationInput: engineInput(meta, s, res.bundle)
    }));
    const summary = VBE.runCountyValuationBacktest(facts, {
      countyFips: meta.fips, countyName: meta.name, stateCode: meta.state, sourceUrl: meta.source_url, lastVerified: RETRIEVED, maxEvaluations: MAX_EXAMPLES
    });
    // Example evaluations: deterministic, spread over the sample (not cherry-picked)
    const ordered = [...ev].sort((a, b) => VBE.fnv1a("ex:" + a.parcelId) - VBE.fnv1a("ex:" + b.parcelId)).slice(0, MAX_EXAMPLES);
    summary.evaluations = ordered.map(s => ({
      parcelId: s.parcelId, salePrice: s.salePrice, saleDate: s.saleDate, estimatedValue: s.engine,
      dollarError: s.engine - s.salePrice, percentageError: Math.round((s.engine - s.salePrice) / s.salePrice * 10000) / 10000,
      absPercentageError: Math.round(Math.abs(s.engine - s.salePrice) / s.salePrice * 10000) / 10000,
      valuationMethod: s.engineMethodFull, within5Pct: Math.abs(s.engine - s.salePrice) / s.salePrice <= 0.05,
      within10Pct: Math.abs(s.engine - s.salePrice) / s.salePrice <= 0.10, within20Pct: Math.abs(s.engine - s.salePrice) / s.salePrice <= 0.20,
      preSaleAssessment: { year: s.roll.year, value: s.roll.total }, priorSale: s.prior
    }));
    const beats = sumEngine.mdape != null && sumA.mdape != null ? sumEngine.mdape < sumA.mdape : null;
    out[meta.fips] = {
      ...summary,
      methodPaths: sumEngine.methods,
      source_url: meta.source_url,
      source_urls: meta.source_urls,
      source_dataset: meta.source_dataset,
      retrieved: RETRIEVED,
      sale_window: { start: WINDOW.start, end: WINDOW.end, first_sale: usable.map(s => s.saleDate).sort()[0], last_sale: usable.map(s => s.saleDate).sort().slice(-1)[0] },
      leakage_rule: meta.roll_rule_text,
      assessment_kind: meta.roll_kind,
      neighborhood_data: res.bundle ? `County bundle block-group record (${res.bundle.acs || "ACS"}), located by point-in-polygon` : null,
      filters: [
        { id: "window", description: `Sale date ${WINDOW.start} to ${WINDOW.end}`, kept: meta.raw_count },
        ...meta.filters,
        { id: "deterministic_sample", description: `Duplicate records of one sale collapsed; if more than ${MAX_SALES} sales remain, the ${MAX_SALES} with the lowest FNV-1a hash of parcel+document are kept`, dropped: meta.pre_kept - salesCount },
        ...post.report,
        ...guard.report
      ],
      sample: {
        usable: usable.length, calibration: cal.length, evaluation: ev.length,
        split: "by parcel (FNV-1a hash of the parcel id); every metric below is on the evaluation half",
        with_prior_sale: ev.filter(s => s.prior).length,
        with_neighborhood_hv: ev.filter(s => res.bundle && res.bundle.details[s.bg] && res.bundle.details[s.bg].m && res.bundle.details[s.bg].m.hv).length
      },
      baseline: {
        assessor_ratio: {
          description: "Pre-sale assessor value x median(sale price / pre-sale assessor value) of the calibration half",
          ratio: Math.round(ratio * 10000) / 10000,
          ...sumA
        },
        prior_sale_hpi: {
          description: `Prior recorded sale x FHFA all-transactions HPI change for metro division ${meta.msad} (index at the prior sale's quarter -> latest quarter ended >= 90 days before the sale)`,
          source_url: FHFA_METRO_URL,
          coverage: Math.round(evB.length / ev.length * 1000) / 1000,
          ...sumB,
          engine_on_same_sales: { sampleCount: sumEngineOnB.sampleCount, mdape: sumEngineOnB.mdape, shareWithin10Pct: sumEngineOnB.shareWithin10Pct, medianBiasPct: sumEngineOnB.medianBiasPct }
        },
        engine_beats_assessor_ratio: beats
      },
      engine_calibrated: {
        description: "Same engine with the county calibration below passed in (calibration input): assessor value x county ratio, prior sale x FHFA metro HPI, hedonic x county scale, blended with weights from each component's calibration-half error. Fitted on the calibration half; measured on the evaluation half.",
        calibration: res.calibration,
        ...sumCal,
        engine_calibrated_beats_assessor_ratio: sumCal.mdape != null && sumA.mdape != null ? sumCal.mdape < sumA.mdape : null
      },
      engine_with_county_scale: {
        description: "Shipped engine output x one county-wide scale factor fitted on the calibration half (median sale / estimate). Shows how much of the error is a level bias.",
        factor: Math.round(calib * 10000) / 10000,
        ...sumEngineCal
      }
    };
    detail[meta.fips] = ev.map(s => ({ p: s.parcelId, d: s.saleDate, price: s.salePrice, roll: s.roll, prior: s.prior, bg: s.bg, chars: s.chars, engine: s.engine, method: s.engineMethodFull, aEst: s.engineAssessorEst, sEst: s.engineSaleEst, hEst: s.engineHedonic, baseA: s.baseA, baseB: s.baseB }))
      .concat(cal.map(s => ({ cal: 1, p: s.parcelId, d: s.saleDate, price: s.salePrice, roll: s.roll, prior: s.prior, bg: s.bg, chars: s.chars, engine: s.engine, method: s.engineMethodFull, aEst: s.engineAssessorEst, sEst: s.engineSaleEst, hEst: s.engineHedonic, baseA: s.baseA, baseB: s.baseB })));
    log(`${meta.fips} ${meta.name}: eval n=${ev.length} engine MdAPE ${pct(sumEngine.mdape)} (bias ${pct(sumEngine.medianBiasPct)}, w10 ${pct(sumEngine.shareWithin10Pct)}) | assessor x ${ratio.toFixed(3)}: ${pct(sumA.mdape)} (w10 ${pct(sumA.shareWithin10Pct)}) | prior x HPI n=${sumB.sampleCount}: ${pct(sumB.mdape)} vs engine on same ${pct(sumEngineOnB.mdape)} | engine x ${calib.toFixed(3)}: ${pct(sumEngineCal.mdape)} | engine calibrated: ${pct(sumCal.mdape)} (w10 ${pct(sumCal.shareWithin10Pct)}, bias ${pct(sumCal.medianBiasPct)}) w=${JSON.stringify(res.calibration.weights)}`);
  }
  fs.writeFileSync(DETAIL_FILE, JSON.stringify(detail));
  if (process.env.BACKTEST_DRY_RUN) { log("dry run; benchmarks file not written"); return; }
  if (ONLY.length && fs.existsSync(OUT_FILE)) {
    // partial run: merge into the existing REAL results only (entries without source_dataset are dropped)
    const prev = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
    for (const [k, v] of Object.entries(prev)) if (!out[k] && v && v.source_dataset && v.retrieved) out[k] = v;
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
  log("wrote", OUT_FILE, Object.keys(out));
}

main().catch(e => { console.error(e); process.exit(1); });
