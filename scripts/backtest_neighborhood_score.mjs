#!/usr/bin/env node
/**
 * Neighborhood score back-test.
 *
 * Question: using only what was observable at the start of a 5-year window, which neighborhood (Census tract)
 * signals predicted house-price appreciation RELATIVE TO THE REST OF THE SAME COUNTY over the next 5 years?
 *
 * Outcome   FHFA annual tract House Price Index (developmental, repeat-sales, 2020 tract codes)
 *           https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv
 * Features  ACS 5-year estimates on 2010 tract codes, from the Census Bureau's bulk files on www2.census.gov
 *           (api.census.gov now answers "Missing Key" without a key):
 *             ACS 2010-2014: sequence files  .../summary_file/2014/data/5_year_seq_by_state/<State>/Tracts_Block_Groups_Only/
 *             ACS 2015-2019: table files     .../summary_file/2019/prototype/5YRData/acsdt5y2019-<table>.dat
 *           Land area: Census Gazetteer 2019 (2010 tracts) and 2020 (2020 tracts).
 * Join      a tract is kept only if its code exists in both the 2010 and 2020 tract lists and its land area
 *           differs by < 5% (boundary essentially unchanged), so ACS (2010 codes) and FHFA (2020 codes) describe
 *           the same place.
 * Timing    ACS 20xx 5-year estimates are released in December of the following year, so a window "starting" with
 *           ACS ending year E is observed at E+1: momentum = HPI(E+1)/HPI(E-4), outcome = HPI(E+6)/HPI(E+1).
 *             P1: ACS 2010-2014 -> outcome 2015 -> 2020
 *             P2: ACS 2015-2019 -> outcome 2020 -> 2025
 * Scoring   within each county, Spearman rank correlation of each signal with the relative outcome, and the
 *           top-quintile-minus-bottom-quintile spread. Uncertainty: bootstrap over counties (seeded, 2000 draws).
 *           A composite (ridge regression on within-county percentile ranks) is evaluated out of sample:
 *           fit on one period, test on the other; and fit on half the counties in one period, test on the
 *           other half in the other period. Baselines: momentum only, "cheapest tracts" only.
 *
 * Usage     node scripts/backtest_neighborhood_score.mjs --cache <download dir> [--counties 50] [--out app/data/neighborhood_score_backtest.json]
 * Needs     curl and unzip on PATH (downloads go through curl so the environment's HTTPS proxy is honoured).
 */

import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith("--") ? a.concat([[x.slice(2), arr[i + 1]]]) : a), []));
const CACHE = path.resolve(args.cache || path.join(os.tmpdir(), "city-pretty-backtest"));
const N_COUNTIES = +(args.counties || 50);
const OUT = path.resolve(ROOT, args.out || "app/data/neighborhood_score_backtest.json");
const RETRIEVED = args.date || new Date().toISOString().slice(0, 10);
fs.mkdirSync(CACHE, { recursive: true });

const URLS = {
  fhfa: "https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv",
  fhfaPage: "https://www.fhfa.gov/data/hpi/datasets",
  gaz2010: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2019_Gazetteer/2019_Gaz_tracts_national.zip",
  gaz2020: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_tracts_national.zip",
  acs2019: t => `https://www2.census.gov/programs-surveys/acs/summary_file/2019/prototype/5YRData/acsdt5y2019-${t}.dat`,
  acs2014Seq: (dir, st, seq) => `https://www2.census.gov/programs-surveys/acs/summary_file/2014/data/5_year_seq_by_state/${dir}/Tracts_Block_Groups_Only/20145${st}${seq}000.zip`,
  acs2014Geo: (dir, st) => `https://www2.census.gov/programs-surveys/acs/summary_file/2014/data/5_year_seq_by_state/${dir}/Tracts_Block_Groups_Only/g20145${st}.csv`,
  acs2014Lookup: "https://www2.census.gov/programs-surveys/acs/summary_file/2014/documentation/user_tools/ACS_5yr_Seq_Table_Number_Lookup.txt",
};

// Directory names on www2.census.gov (a wrong name fails the download, so these are checked on every run).
const STATE_DIR = { AL: "Alabama", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", DC: "DistrictOfColumbia", DE: "Delaware", FL: "Florida", GA: "Georgia", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "NewHampshire", NJ: "NewJersey", NM: "NewMexico", NY: "NewYork", NC: "NorthCarolina", ND: "NorthDakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "RhodeIsland", SC: "SouthCarolina", SD: "SouthDakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "WestVirginia", WI: "Wisconsin", WY: "Wyoming" };

// ACS cells used. Each is [table, line]; lines are checked against the 2014 sequence lookup at run time.
const CELLS = {
  pop: ["B01003", 1], workers: ["B08301", 1], transit_commuters: ["B08301", 10], inc: ["B19013", 1],
  units: ["B25001", 1], occ_total: ["B25002", 1], vacant: ["B25002", 3], ten_total: ["B25003", 1], owner: ["B25003", 2],
  struct_total: ["B25024", 1], sf_detached: ["B25024", 2], sf_attached: ["B25024", 3], yb: ["B25035", 1],
  veh_total: ["B25044", 1], owner_noveh: ["B25044", 3], renter_noveh: ["B25044", 10], rent: ["B25064", 1], hv: ["B25077", 1],
};
const EXPECTED_LINE_TITLES = { "B08301:10": /^Public transportation/, "B25002:3": /^Vacant/, "B25003:2": /^Owner occupied/, "B25024:2": /^1, detached/, "B25024:3": /^1, attached/, "B25044:3": /^No vehicle/, "B25044:10": /^No vehicle/ };

// ---------------------------------------------------------------- download helpers
function download(url, name) {
  const dest = path.join(CACHE, name || path.basename(new URL(url).pathname));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execFileSync("curl", ["-sSL", "--fail", "--retry", "2", "-o", dest + ".part", url], { stdio: ["ignore", "ignore", "pipe"] });
      fs.renameSync(dest + ".part", dest);
      return dest;
    } catch (e) {
      if (attempt === 3) throw new Error(`download failed: ${url}: ${e.stderr || e.message}`);
    }
  }
}
const unzipText = (zip, pattern) => execFileSync("unzip", ["-p", zip, pattern], { maxBuffer: 1 << 30 }).toString("latin1");
async function eachLine(file, fn) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "latin1" }), crlfDelay: Infinity });
  for await (const line of rl) fn(line);
}

// ---------------------------------------------------------------- statistics helpers
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function ranks(xs) { // average ranks, 1..n
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; }
  return r;
}
function pearson(a, b) { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : null; }
const spearman = (a, b) => pearson(ranks(a), ranks(b));
const median = xs => { const s = xs.slice().sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const quantile = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); if (!s.length) return null; const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); };
function quintileSpread(signal, y) { // mean y of top fifth minus bottom fifth by signal (log points)
  const idx = signal.map((v, i) => i).sort((a, b) => signal[a] - signal[b]);
  const k = Math.floor(idx.length / 5); if (k < 3) return null;
  return mean(idx.slice(-k).map(i => y[i])) - mean(idx.slice(0, k).map(i => y[i]));
}
function quintileMeans(signal, y) {
  const idx = signal.map((v, i) => i).sort((a, b) => signal[a] - signal[b]);
  const n = idx.length, out = [];
  for (let q = 0; q < 5; q++) { const part = idx.slice(Math.floor(q * n / 5), Math.floor((q + 1) * n / 5)); out.push(mean(part.map(i => y[i]))); }
  return out;
}
function bootstrapMean(values, seed, draws = 2000) {
  const v = values.filter(x => x != null && isFinite(x)); if (v.length < 3) return { mean: v.length ? mean(v) : null, ci90: [null, null], n: v.length };
  const rnd = mulberry32(seed), ms = [];
  for (let d = 0; d < draws; d++) { let s = 0; for (let i = 0; i < v.length; i++) s += v[Math.floor(rnd() * v.length)]; ms.push(s / v.length); }
  return { mean: mean(v), ci90: [quantile(ms, 0.05), quantile(ms, 0.95)], n: v.length };
}
const pct = logPts => logPts == null ? null : +(100 * (Math.exp(logPts) - 1)).toFixed(2);
const r3 = x => x == null ? null : +x.toFixed(3);

// ridge regression y ~ X (no intercept; X and y centred within county)
function ridge(X, y, lambda) {
  const p = X[0].length, A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) for (let j = 0; j < p; j++) { b[j] += X[i][j] * y[i]; for (let k = 0; k < p; k++) A[j][k] += X[i][j] * X[i][k]; }
  for (let j = 0; j < p; j++) A[j][j] += lambda * X.length;
  // Gauss-Jordan
  const M = A.map((row, i) => row.concat([b[i]]));
  for (let c = 0; c < p; c++) { let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r; [M[c], M[piv]] = [M[piv], M[c]]; const d = M[c][c]; if (!d) continue; for (let k = c; k <= p; k++) M[c][k] /= d; for (let r = 0; r < p; r++) if (r !== c) { const f = M[r][c]; for (let k = c; k <= p; k++) M[r][k] -= f * M[c][k]; } }
  return M.map(row => row[p]);
}

// ---------------------------------------------------------------- 1. counties
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "counties/manifest.json"), "utf8"));
const COUNTIES = manifest.counties
  .filter(c => !c.fips.startsWith("09") && STATE_DIR[c.state]) // Connecticut's 2022 planning regions have no 2010 tract codes
  .sort((a, b) => b.block_groups - a.block_groups).slice(0, N_COUNTIES)
  .map(c => ({ fips: c.fips, name: c.name, state: c.state }));
const COUNTY_SET = new Set(COUNTIES.map(c => c.fips));
console.error(`counties: ${COUNTIES.length}`);

// ---------------------------------------------------------------- 2. geography (unchanged tracts)
function gazetteer(zip) {
  const out = new Map();
  for (const line of unzipText(zip, "*.txt").split(/\r?\n/).slice(1)) {
    const f = line.split("\t"); if (f.length < 5) continue;
    out.set(f[1].trim(), { aland: +f[2], sqmi: +f[4] });
  }
  return out;
}
const g10 = gazetteer(download(URLS.gaz2010, "gaz2010_tracts.zip"));
const g20 = gazetteer(download(URLS.gaz2020, "gaz2020_tracts.zip"));
const STABLE = new Map(); let stableAll = 0, codeBoth = 0;
for (const [geoid, a] of g10) {
  const b = g20.get(geoid); if (!b) continue; codeBoth++;
  if (a.aland > 0 && Math.abs(b.aland / a.aland - 1) < 0.05) { stableAll++; if (COUNTY_SET.has(geoid.slice(0, 5))) STABLE.set(geoid, a); }
}
console.error(`tracts: 2010=${g10.size} 2020=${g20.size} same code=${codeBoth} stable(<5% land change)=${stableAll}; in sample counties=${STABLE.size}`);

// ---------------------------------------------------------------- 3. FHFA tract HPI
const HPI = new Map();
{
  const file = download(URLS.fhfa, "hpi_at_tract.csv");
  let header = null;
  await eachLine(file, line => {
    if (!header) { header = line.split(","); if (header.join(",") !== "tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000") throw new Error("FHFA layout changed: " + line); return; }
    const f = line.split(","); const t = f[0]; if (!STABLE.has(t)) return;
    const v = parseFloat(f[4]); if (!isFinite(v)) return;
    if (!HPI.has(t)) HPI.set(t, {}); HPI.get(t)[+f[2]] = v;
  });
}
console.error(`FHFA tracts with HPI in sample: ${HPI.size}`);

// ---------------------------------------------------------------- 4. ACS 2015-2019 (table files)
const ACS = { 2019: new Map(), 2014: new Map() };
const neg = v => (v == null || !isFinite(v) || v < 0) ? null : v; // Census annotation codes are negative
{
  const tables = [...new Set(Object.values(CELLS).map(c => c[0]))];
  for (const t of tables) {
    const file = download(URLS.acs2019(t.toLowerCase()), `acsdt5y2019-${t.toLowerCase()}.dat`);
    let cols = null;
    await eachLine(file, line => {
      if (!cols) { cols = line.split("|"); return; }
      if (!line.startsWith("1400000US")) return;
      const f = line.split("|"); const geoid = f[0].slice(9); if (!STABLE.has(geoid)) return;
      const row = ACS[2019].get(geoid) || {}; ACS[2019].set(geoid, row);
      for (const [k, [tab, ln]] of Object.entries(CELLS)) if (tab === t) { const ci = cols.indexOf(`${t}_E${String(ln).padStart(3, "0")}`); if (ci < 0) throw new Error(`missing ${t} line ${ln}`); row[k] = neg(parseFloat(f[ci])); }
    });
  }
}
console.error(`ACS 2019 tracts: ${ACS[2019].size}`);

// ---------------------------------------------------------------- 5. ACS 2010-2014 (sequence files)
const lookupCheck = [];
{
  const lk = fs.readFileSync(download(URLS.acs2014Lookup, "ACS_5yr_Seq_Table_Number_Lookup_2014.txt"), "latin1").split(/\r?\n/);
  const start = {}, titles = {};
  for (const line of lk) {
    const f = line.match(/("([^"]*)"|[^,]*)(,|$)/g).map(s => s.replace(/,$/, "").replace(/^"|"$/g, ""));
    if (f[0] !== "ACSSF") continue;
    if (f[4] && f[4].trim() && !f[3].trim()) start[f[1]] = { seq: f[2], pos: +f[4] };
    if (f[3] && f[3].trim()) titles[`${f[1]}:${+f[3]}`] = f[7];
  }
  for (const [key, re] of Object.entries(EXPECTED_LINE_TITLES)) { const ok = re.test(titles[key] || ""); lookupCheck.push({ cell: key, title: titles[key] || null, ok }); if (!ok) throw new Error(`2014 lookup line title mismatch ${key}: ${titles[key]}`); }
  const states = [...new Set(COUNTIES.map(c => c.state))];
  const seqs = [...new Set(Object.values(CELLS).map(c => start[c[0]].seq))];
  for (const st of states) {
    const dir = STATE_DIR[st], s = st.toLowerCase();
    const geo = fs.readFileSync(download(URLS.acs2014Geo(dir, s), `g20145${s}.csv`), "latin1").split(/\r?\n/);
    const logrec = new Map();
    for (const line of geo) { const m = line.match(/^ACSSF,[A-Z]{2},140,00,(\d{7}),.*14000US(\d{11})/); if (m && STABLE.has(m[2])) logrec.set(m[1], m[2]); }
    for (const seq of seqs) {
      const zip = download(URLS.acs2014Seq(dir, s, seq), `20145${s}${seq}000.zip`);
      for (const line of unzipText(zip, `e20145${s}${seq}000.txt`).split(/\r?\n/)) {
        const f = line.split(","); const geoid = logrec.get(f[5]); if (!geoid) continue;
        const row = ACS[2014].get(geoid) || {}; ACS[2014].set(geoid, row);
        for (const [k, [tab, ln]] of Object.entries(CELLS)) if (start[tab].seq === seq) { const v = f[start[tab].pos - 1 + ln - 1]; row[k] = (v === "" || v === ".") ? null : neg(parseFloat(v)); }
      }
    }
    console.error(`ACS 2014 ${st}: ${logrec.size} stable tracts`);
  }
}
console.error(`ACS 2014 tracts: ${ACS[2014].size}`);

// ---------------------------------------------------------------- 6. features
// Signals. "bundle" = the same quantity exists for every block group in counties/bundle_*.json.gz (field in brackets),
// so the engine can use it today. Others were tested for evidence only.
const SIGNALS = {
  momentum_5y:       { label: "Prior 5-year price change (FHFA tract HPI)", bundle: null },
  log_value:         { label: "Median home value (log)", bundle: "hv" },
  rent_to_value:     { label: "Annual median rent / median home value", bundle: "rent/hv" },
  log_income:        { label: "Median household income (log)", bundle: "inc" },
  value_to_income:   { label: "Median home value / median household income", bundle: "hv/inc" },
  renter_share:      { label: "Share of households renting", bundle: "own" },
  year_built:        { label: "Median year structure built", bundle: "yb" },
  single_family:     { label: "Share of homes in 1-unit buildings", bundle: "sf" },
  no_vehicle:        { label: "Share of households with no vehicle", bundle: "nocar" },
  log_unit_density:  { label: "Housing units per square mile of land (log)", bundle: "homes/acres" },
  vacancy:           { label: "Vacant share of housing units", bundle: null },
  transit_commute:   { label: "Share of workers commuting by public transport", bundle: null },
};
function features(a, hpi, E) {
  const h0 = hpi[E - 4], h1 = hpi[E + 1], h2 = hpi[E + 6];
  const ok = x => x != null && isFinite(x);
  const f = {
    momentum_5y: ok(h0) && ok(h1) && h0 > 0 ? Math.log(h1 / h0) : null,
    log_value: ok(a.hv) && a.hv > 0 ? Math.log(a.hv) : null,
    rent_to_value: ok(a.rent) && ok(a.hv) && a.hv > 0 ? (12 * a.rent) / a.hv : null,
    log_income: ok(a.inc) && a.inc > 0 ? Math.log(a.inc) : null,
    value_to_income: ok(a.hv) && ok(a.inc) && a.inc > 0 ? a.hv / a.inc : null,
    renter_share: ok(a.owner) && a.ten_total > 0 ? 1 - a.owner / a.ten_total : null,
    year_built: ok(a.yb) && a.yb > 1900 ? a.yb : null,
    single_family: a.struct_total > 0 ? ((a.sf_detached || 0) + (a.sf_attached || 0)) / a.struct_total : null,
    no_vehicle: a.veh_total > 0 ? ((a.owner_noveh || 0) + (a.renter_noveh || 0)) / a.veh_total : null,
    log_unit_density: null,
    vacancy: a.occ_total > 0 && ok(a.vacant) ? a.vacant / a.occ_total : null,
    transit_commute: a.workers > 0 && ok(a.transit_commuters) ? a.transit_commuters / a.workers : null,
  };
  return { f, y: ok(h1) && ok(h2) && h1 > 0 ? Math.log(h2 / h1) : null };
}
const PERIODS = [
  { id: "P1", acs: 2014, acsLabel: "ACS 2010-2014 5-year", observed: 2015, outcome: [2015, 2020], momentum: [2010, 2015] },
  { id: "P2", acs: 2019, acsLabel: "ACS 2015-2019 5-year", observed: 2020, outcome: [2020, 2025], momentum: [2015, 2020] },
];
const MIN_TRACTS = 20;
const DATA = {}; // period -> county -> rows
for (const P of PERIODS) {
  DATA[P.id] = {};
  for (const [geoid, a] of ACS[P.acs]) {
    const hpi = HPI.get(geoid); if (!hpi) continue;
    const { f, y } = features(a, hpi, P.acs); if (y == null) continue;
    const g = STABLE.get(geoid); f.log_unit_density = a.units > 0 && g.sqmi > 0 ? Math.log(a.units / g.sqmi) : null;
    const c = geoid.slice(0, 5); (DATA[P.id][c] = DATA[P.id][c] || []).push({ geoid, f, yRaw: y });
  }
  for (const c of Object.keys(DATA[P.id])) {
    const rows = DATA[P.id][c];
    if (rows.length < MIN_TRACTS) { delete DATA[P.id][c]; continue; }
    const m = median(rows.map(r => r.yRaw)); rows.forEach(r => { r.y = r.yRaw - m; });
    const mm = median(rows.map(r => r.f.momentum_5y).filter(v => v != null)); rows.forEach(r => { if (r.f.momentum_5y != null) r.f.momentum_5y -= mm; });
  }
}

// ---------------------------------------------------------------- 7. univariate tests
const SIG = Object.keys(SIGNALS);
const perSignal = {};
let seed = 20261118;
for (const s of SIG) {
  perSignal[s] = { label: SIGNALS[s].label, bundle_field: SIGNALS[s].bundle, periods: {} };
  for (const P of PERIODS) {
    const perCounty = [];
    for (const [c, rows] of Object.entries(DATA[P.id])) {
      const rr = rows.filter(r => r.f[s] != null); if (rr.length < MIN_TRACTS) continue;
      const x = rr.map(r => r.f[s]), y = rr.map(r => r.y);
      perCounty.push({ county: c, n: rr.length, rho: spearman(x, y), q5_minus_q1: quintileSpread(x, y) });
    }
    const rho = bootstrapMean(perCounty.map(p => p.rho), seed++), spr = bootstrapMean(perCounty.map(p => p.q5_minus_q1), seed++);
    perSignal[s].periods[P.id] = {
      counties: perCounty.length, tracts: perCounty.reduce((a, p) => a + p.n, 0),
      mean_spearman: r3(rho.mean), spearman_ci90: rho.ci90.map(r3),
      share_counties_positive: r3(perCounty.filter(p => p.rho > 0).length / (perCounty.length || 1)),
      q5_minus_q1_pct: pct(spr.mean), q5_minus_q1_ci90_pct: spr.ci90.map(pct),
      per_county: perCounty.map(p => ({ fips: p.county, n: p.n, rho: r3(p.rho), q5_minus_q1_pct: pct(p.q5_minus_q1) })),
    };
  }
  const a = perSignal[s].periods.P1, b = perSignal[s].periods.P2;
  const sig = p => p && p.spearman_ci90[0] != null && (p.spearman_ci90[0] > 0 || p.spearman_ci90[1] < 0);
  perSignal[s].stable_sign = !!(a && b && a.mean_spearman != null && b.mean_spearman != null && Math.sign(a.mean_spearman) === Math.sign(b.mean_spearman));
  perSignal[s].significant_both_periods = !!(sig(a) && sig(b));
  perSignal[s].supported = perSignal[s].stable_sign && perSignal[s].significant_both_periods;
}

// ---------------------------------------------------------------- 8. composite, out of sample
const BUNDLE_SIGNALS = SIG.filter(s => SIGNALS[s].bundle);
// within-county percentile (0..1) centred at 0; rows missing any model feature are dropped
function design(rows, feats) {
  const ok = rows.filter(r => feats.every(s => r.f[s] != null)); if (ok.length < MIN_TRACTS) return null;
  const X = ok.map(() => []);
  for (const s of feats) { const rk = ranks(ok.map(r => r.f[s])); rk.forEach((v, i) => X[i].push(v / (ok.length + 1) - 0.5)); }
  return { rows: ok, X, y: ok.map(r => r.y) };
}
// winsorise the outcome for fitting only (FHFA developmental tract indexes have outliers)
function fit(periodIds, countyFilter, feats) {
  const X = [], y = [];
  for (const pid of periodIds) for (const [c, rows] of Object.entries(DATA[pid])) {
    if (!countyFilter(c)) continue; const d = design(rows, feats); if (!d) continue;
    const lo = quantile(d.y, 0.01), hi = quantile(d.y, 0.99);
    d.X.forEach((row, i) => { X.push(row); y.push(Math.min(hi, Math.max(lo, d.y[i]))); });
  }
  return { w: ridge(X, y, 1e-3), n: X.length };
}
function evaluate(pid, countyFilter, feats, w) {
  const per = [], qm = [];
  for (const [c, rows] of Object.entries(DATA[pid])) {
    if (!countyFilter(c)) continue; const d = design(rows, feats); if (!d) continue;
    const pred = d.X.map(row => row.reduce((a, v, j) => a + v * w[j], 0));
    per.push({ county: c, n: d.rows.length, rho: spearman(pred, d.y), spread: quintileSpread(pred, d.y) });
    qm.push(quintileMeans(pred, d.y));
  }
  const rho = bootstrapMean(per.map(p => p.rho), seed++), spr = bootstrapMean(per.map(p => p.spread), seed++);
  return {
    counties: per.length, tracts: per.reduce((a, p) => a + p.n, 0),
    mean_spearman: r3(rho.mean), spearman_ci90: rho.ci90.map(r3), share_counties_positive: r3(per.filter(p => p.rho > 0).length / (per.length || 1)),
    q5_minus_q1_pct: pct(spr.mean), q5_minus_q1_ci90_pct: spr.ci90.map(pct),
    quintile_mean_relative_change_pct: [0, 1, 2, 3, 4].map(q => pct(mean(qm.map(m => m[q]).filter(v => v != null)))),
    per_county: per.map(p => ({ fips: p.county, n: p.n, rho: r3(p.rho), q5_minus_q1_pct: pct(p.spread) })),
  };
}
const foldOf = c => COUNTIES.findIndex(x => x.fips === c) % 2 === 0 ? "A" : "B";
const ALL = () => true;
const MODELS = {
  composite_bundle_fields: BUNDLE_SIGNALS,
  composite_with_momentum: ["momentum_5y", ...BUNDLE_SIGNALS],
  momentum_only: ["momentum_5y"],
  cheapest_only: ["log_value"],
};
const SCHEMES = [
  { id: "fit_P1_test_P2", train: ["P1"], test: "P2", trainF: ALL, testF: ALL },
  { id: "fit_P2_test_P1", train: ["P2"], test: "P1", trainF: ALL, testF: ALL },
  { id: "fit_P1_foldA_test_P2_foldB", train: ["P1"], test: "P2", trainF: c => foldOf(c) === "A", testF: c => foldOf(c) === "B" },
  { id: "fit_P1_foldB_test_P2_foldA", train: ["P1"], test: "P2", trainF: c => foldOf(c) === "B", testF: c => foldOf(c) === "A" },
];
const outOfSample = {};
for (const [mid, feats] of Object.entries(MODELS)) {
  outOfSample[mid] = { features: feats, schemes: {} };
  for (const S of SCHEMES) {
    const { w } = fit(S.train, S.trainF, feats);
    outOfSample[mid].schemes[S.id] = { fitted_weights: Object.fromEntries(feats.map((s, j) => [s, r3(w[j])])), ...evaluate(S.test, S.testF, feats, w) };
  }
}

// ---------------------------------------------------------------- 9. engine weights
// Fit the bundle-field composite on both periods pooled. A feature keeps a non-zero weight only if its univariate
// relation had the same sign in both periods and a 90% bootstrap interval excluding zero in both; otherwise it gets 0
// and is listed as not supported. Weight units: log points of 5-yr relative appreciation per full 0->1 percentile span.
const supportedBundle = BUNDLE_SIGNALS.filter(s => perSignal[s].supported);
const pooled = supportedBundle.length ? fit(["P1", "P2"], ALL, supportedBundle) : { w: [], n: 0 };
const p1only = supportedBundle.length ? fit(["P1"], ALL, supportedBundle) : { w: [] };
const p2only = supportedBundle.length ? fit(["P2"], ALL, supportedBundle) : { w: [] };
const engineWeights = BUNDLE_SIGNALS.map(s => {
  const j = supportedBundle.indexOf(s);
  return {
    signal: s, bundle_field: SIGNALS[s].bundle, label: SIGNALS[s].label,
    weight: j >= 0 ? r3(pooled.w[j]) : 0,
    weight_fit_P1_only: j >= 0 ? r3(p1only.w[j]) : null, weight_fit_P2_only: j >= 0 ? r3(p2only.w[j]) : null,
    supported: j >= 0, assumed: false,
    reason: j >= 0 ? "same sign in both periods, 90% interval excludes zero in both" : (perSignal[s].stable_sign ? "sign stable but interval includes zero in at least one period" : "sign flipped between periods"),
  };
});
// evaluate the final engine model the same strict way (its feature choice used both periods, so this is optimistic)
const engineOOS = supportedBundle.length ? Object.fromEntries(SCHEMES.map(S => { const { w } = fit(S.train, S.trainF, supportedBundle); return [S.id, evaluate(S.test, S.testF, supportedBundle, w)]; })) : null;

// ---------------------------------------------------------------- 10. verdict
const m = (mid, sch) => outOfSample[mid].schemes[sch];
const beats = (a, b) => SCHEMES.every(S => m(a, S.id).spearman_ci90[0] != null && m(a, S.id).mean_spearman > m(b, S.id).mean_spearman);
const ciPositive = mid => SCHEMES.every(S => (m(mid, S.id).spearman_ci90[0] ?? -1) > 0);
const verdict = {
  composite_bundle_beats_momentum_all_schemes: beats("composite_bundle_fields", "momentum_only"),
  composite_bundle_beats_cheapest_all_schemes: beats("composite_bundle_fields", "cheapest_only"),
  composite_bundle_ci_above_zero_all_schemes: ciPositive("composite_bundle_fields"),
  momentum_ci_above_zero_all_schemes: ciPositive("momentum_only"),
  cheapest_ci_above_zero_all_schemes: ciPositive("cheapest_only"),
};
verdict.engine_role = verdict.composite_bundle_ci_above_zero_all_schemes && verdict.composite_bundle_beats_cheapest_all_schemes && verdict.composite_bundle_beats_momentum_all_schemes ? "predictor" : "screen";

// per-metro results. engine_rho_*: Spearman of the engine model's score with the relative outcome in that county,
// with weights fitted on the OTHER period (out of sample in time). cheapest/momentum: univariate Spearman in-period.
const rhoIn = (res, fips) => { const p = res && res.per_county.find(x => x.fips === fips); return p ? p.rho : null; };
const perMetro = COUNTIES.map(c => {
  const e2 = engineOOS ? rhoIn(engineOOS.fit_P1_test_P2, c.fips) : null, e1 = engineOOS ? rhoIn(engineOOS.fit_P2_test_P1, c.fips) : null;
  const sig = (s, pid) => rhoIn(perSignal[s].periods[pid], c.fips);
  return { fips: c.fips, name: `${c.name}, ${c.state}`, tracts_P1: (DATA.P1[c.fips] || []).length, tracts_P2: (DATA.P2[c.fips] || []).length,
    engine_rho_P1: e1, engine_rho_P2: e2,
    engine_hit: [e1, e2].filter(v => v != null).length ? [e1, e2].filter(v => v != null).every(v => v > 0) : null,
    cheapest_rho_P1: sig("log_value", "P1") == null ? null : -sig("log_value", "P1"), cheapest_rho_P2: sig("log_value", "P2") == null ? null : -sig("log_value", "P2"),
    momentum_rho_P1: sig("momentum_5y", "P1"), momentum_rho_P2: sig("momentum_5y", "P2") };
});
const hitRate = key => { const v = perMetro.map(p => p[key]).filter(x => x != null); return { counties: v.length, share_positive: v.length ? r3(v.filter(x => x > 0).length / v.length) : null }; };
const perMetroSummary = { engine_P1: hitRate("engine_rho_P1"), engine_P2: hitRate("engine_rho_P2"), cheapest_P1: hitRate("cheapest_rho_P1"), cheapest_P2: hitRate("cheapest_rho_P2"), momentum_P1: hitRate("momentum_rho_P1"), momentum_P2: hitRate("momentum_rho_P2") };

const out = {
  schema: 1,
  title: "Neighborhood score back-test: what predicted tract house-price growth relative to its own county",
  generated_by: "scripts/backtest_neighborhood_score.mjs",
  retrieved: RETRIEVED,
  question: "Within a county, did tracts that ranked higher on a signal at the start of a 5-year window see more house-price growth than the county's median tract over that window?",
  outcome: { measure: "ln(HPI end / HPI start) for the tract minus the county median of the same, FHFA annual tract HPI (developmental index, not seasonally adjusted)", unit: "log points; reported as % difference", tract_codes: "2020 Census tracts (63,015 of 63,743 FHFA tract codes in the 2019 rows match the 2020 Gazetteer; 46,532 match 2010)" },
  periods: PERIODS.map(P => ({ id: P.id, features: P.acsLabel, observed_year: P.observed, outcome_years: P.outcome, momentum_years: P.momentum })),
  sample: {
    counties: COUNTIES.length, county_list: COUNTIES.map(c => c.fips),
    selection: `largest ${N_COUNTIES} counties by block groups in counties/manifest.json, Connecticut excluded (2022 planning regions have no 2010 tract codes)`,
    tract_join: "tract code present in both the 2010 and 2020 tract lists and land area changed by less than 5%",
    tracts_stable_nationwide: stableAll, tracts_P1: Object.values(DATA.P1).reduce((a, r) => a + r.length, 0), tracts_P2: Object.values(DATA.P2).reduce((a, r) => a + r.length, 0),
    counties_P1: Object.keys(DATA.P1).length, counties_P2: Object.keys(DATA.P2).length, min_tracts_per_county: MIN_TRACTS,
    bias_note: "Tracts that were split or merged in 2020 (usually the fastest-growing ones) are excluded, and FHFA only publishes tracts with enough repeat sales, so new-build areas and thinly traded tracts are under-represented.",
  },
  method: {
    univariate: "Spearman rank correlation per county, averaged over counties; Q5-Q1 = mean relative change of the top fifth of tracts by the signal minus the bottom fifth, averaged over counties; 90% intervals from 2000 bootstrap draws over counties (seeded).",
    composite: "ridge regression (lambda 0.001) of the winsorised (1%/99%) relative outcome on within-county percentile ranks (centred), tested out of sample: on the other period, and on the other half of the counties in the other period.",
    supported_rule: "a signal is supported if its mean Spearman has the same sign in both periods and the 90% interval excludes zero in both.",
  },
  per_signal: perSignal,
  out_of_sample: outOfSample,
  engine_model: {
    features: supportedBundle,
    weights: engineWeights,
    fitted_on: "P1 + P2 pooled, all sample counties",
    rows: pooled.n,
    out_of_sample_check: engineOOS,
    note: "Feature selection used both periods, so engine_model.out_of_sample_check is optimistic; out_of_sample.composite_bundle_fields (all bundle fields, no selection) is the honest figure.",
    score_quintile_relative_change_pct: engineOOS ? { P2_fit_on_P1: engineOOS.fit_P1_test_P2.quintile_mean_relative_change_pct, P1_fit_on_P2: engineOOS.fit_P2_test_P1.quintile_mean_relative_change_pct } : null,
  },
  verdict,
  headline: (() => {
    const lv = perSignal.log_value.periods, mo = perSignal.momentum_5y.periods, ob = outOfSample.composite_bundle_fields.schemes, ch = outOfSample.cheapest_only.schemes;
    return [
      `Cheaper-than-county tracts gained more: Spearman ${-lv.P1.mean_spearman} (2015-20) and ${-lv.P2.mean_spearman} (2020-25); top-vs-bottom-fifth gap ${-lv.P1.q5_minus_q1_pct}% and ${-lv.P2.q5_minus_q1_pct}% over 5 years.`,
      `Prior 5-year price momentum did not carry forward: Spearman ${mo.P1.mean_spearman} (2015-20) and ${mo.P2.mean_spearman} (2020-25).`,
      `A composite of every bundle field, fitted on 2015-20 and tested on 2020-25: Spearman ${ob.fit_P1_test_P2.mean_spearman} (90% ${ob.fit_P1_test_P2.spearman_ci90.join(" to ")}), versus ${ch.fit_P1_test_P2.mean_spearman} for "cheapest tracts" alone.`,
      verdict.engine_role === "screen" ? "No combination beat the cheapest-tracts baseline in every test, so the score is a relative-value screen, not a forecast." : "The composite beat both baselines in every test.",
    ];
  })(),
  per_metro_summary: perMetroSummary,
  per_metro: perMetro,
  lookup_check_2014: lookupCheck,
  sources: [
    { name: "FHFA House Price Index, annual, census tracts (developmental index; not seasonally adjusted)", url: URLS.fhfa, page: URLS.fhfaPage, retrieved: RETRIEVED, fields: "tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000" },
    { name: "Census ACS 2015-2019 5-year, table-based prototype summary files", url: "https://www2.census.gov/programs-surveys/acs/summary_file/2019/prototype/5YRData/", retrieved: RETRIEVED, tables: [...new Set(Object.values(CELLS).map(c => c[0]))] },
    { name: "Census ACS 2010-2014 5-year, sequence summary files by state (tracts and block groups)", url: "https://www2.census.gov/programs-surveys/acs/summary_file/2014/data/5_year_seq_by_state/", lookup: URLS.acs2014Lookup, retrieved: RETRIEVED },
    { name: "Census Gazetteer 2019 tracts (2010 codes)", url: URLS.gaz2010, retrieved: RETRIEVED },
    { name: "Census Gazetteer 2020 tracts", url: URLS.gaz2020, retrieved: RETRIEVED },
  ],
  limitations: [
    "Tract level (bundles are block groups; the engine applies tract-tested relations to block-group values, many of which are tract medians anyway).",
    "Two 5-year windows only (2015-2020, 2020-2025); the second contains the 2020-2022 boom.",
    "Relative to county, not to the CBSA metro; a county-wide boom or bust is not predicted.",
    "FHFA tract HPI is a developmental repeat-sales index; thin tracts are noisy, which biases correlations toward zero.",
    "ACS 5-year medians are 5-year averages with sampling error; a tract median is not a block-group fact.",
    "Says nothing about rents, cash flow, or what a specific improvement adds.",
  ],
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.error(`wrote ${OUT}`);
console.log(JSON.stringify({ verdict, engine_features: supportedBundle, univariate: Object.fromEntries(SIG.map(s => [s, { P1: perSignal[s].periods.P1 && [perSignal[s].periods.P1.mean_spearman, perSignal[s].periods.P1.spearman_ci90, perSignal[s].periods.P1.q5_minus_q1_pct], P2: perSignal[s].periods.P2 && [perSignal[s].periods.P2.mean_spearman, perSignal[s].periods.P2.spearman_ci90, perSignal[s].periods.P2.q5_minus_q1_pct], supported: perSignal[s].supported }])), oos: Object.fromEntries(Object.entries(outOfSample).map(([k, v]) => [k, Object.fromEntries(Object.entries(v.schemes).map(([s, r]) => [s, [r.mean_spearman, r.spearman_ci90, r.q5_minus_q1_pct, r.share_counties_positive]]))])) }, null, 1));
