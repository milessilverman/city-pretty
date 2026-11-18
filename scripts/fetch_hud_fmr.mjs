#!/usr/bin/env node
/**
 * Regenerate app/data/hud_fair_market_rents.json and app/data/hud_safmr/<FIPS>.json
 * from the HUD User FMR API (https://www.huduser.gov/hudapi/public/fmr/...).
 *
 * Usage:
 *   node scripts/fetch_hud_fmr.mjs [--year 2027|latest] [--cache DIR] [--delay MS]
 *
 * - Node 22, no dependencies. Requests are sequential with a small delay; 429/5xx are retried.
 * - Raw API responses are cached under --cache (default: <os tmp>/hud_fmr_cache) so a re-run is cheap.
 * - Node fetch ignores proxies by default: behind an HTTPS proxy run with NODE_USE_ENV_PROXY=1 (and NODE_EXTRA_CA_CERTS).
 * - HUD requires a bearer token. In the Claude container the proxy injects it; elsewhere set HUD_API_TOKEN.
 * - --year latest (default) probes the API for the newest fiscal year it serves (2028, 2027, 2026) and records
 *   the year the response itself reports.
 *
 * Mapping rules (nothing is guessed; rows that cannot be mapped get null rents plus null_reason):
 *   - Normal counties: HUD entity id = <5-digit county FIPS> + "99999".
 *   - New England counties (HUD keys on towns): fetch every town of the county; if all towns resolve to the
 *     same FMR area and values, use them; otherwise null with reason "multiple FMR areas".
 *   - Connecticut planning regions (09110...): HUD's listCounties still lists old counties, but the data
 *     endpoint is keyed <state><planning region><town code> (e.g. 0911001080, whose response says
 *     "Capitol Planning Region, CT"). Town codes come from Census TIGERweb county subdivisions (GEOID); the
 *     response's county_name must match the manifest region name or the row is nulled. Same uniform-or-null rule.
 *   - The EXTRA list (06037, 06059) adds counties absent from counties/manifest.json that consumers already used.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : d; };
const YEAR_ARG = opt("year", "latest");
const CACHE = opt("cache", path.join(os.tmpdir(), "hud_fmr_cache"));
const DELAY = Number(opt("delay", "120"));
const TODAY = opt("today", new Date().toISOString().slice(0, 10));
const BASE = "https://www.huduser.gov/hudapi/public/fmr";
const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/1/query" +
  "?where=STATE%3D%2709%27&outFields=GEOID,NAME,COUNTY&returnGeometry=false&f=json";
const headers = process.env.HUD_API_TOKEN ? { Authorization: `Bearer ${process.env.HUD_API_TOKEN}` } : {};

fs.mkdirSync(path.join(CACHE, "raw"), { recursive: true });
const EXTRA = [["06037", "CA"], ["06059", "CA"]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, cacheFile) {
  const cf = path.join(CACHE, cacheFile);
  if (fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, "utf8"));
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(DELAY);
    let res;
    try { res = await fetch(url, { headers }); } catch (e) { await sleep(1000 * (attempt + 1)); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) return { __error: res.status };
    const text = await res.text();
    let j;
    try { j = JSON.parse(text); } catch { await sleep(1000 * (attempt + 1)); continue; }
    fs.mkdirSync(path.dirname(cf), { recursive: true });
    fs.writeFileSync(cf, text);
    return j;
  }
  throw new Error("giving up on " + url);
}

const fmrUrl = (id, year) => `${BASE}/data/${id}?year=${year}`;
const fmrData = (id, year) => getJson(fmrUrl(id, year), `raw/${year}/${id}.json`);

// Pull the area-level (MSA level) row out of either response shape.
function areaRow(d) {
  const b = d.basicdata;
  const row = Array.isArray(b) ? b.find((r) => r.zip_code === "MSA level") : b;
  if (!row) return null;
  const v = [row["Efficiency"], row["One-Bedroom"], row["Two-Bedroom"], row["Three-Bedroom"], row["Four-Bedroom"]].map(Number);
  if (v.some((x) => !Number.isInteger(x) || x <= 0)) return null;
  const year = Number(d.year ?? row.year);
  return { v, year };
}

async function resolveYear() {
  if (YEAR_ARG !== "latest") return Number(YEAR_ARG);
  for (const y of [2028, 2027, 2026]) {
    const j = await fmrData("0603799999", y);
    if (!j.__error && j.data && areaRow(j.data)?.year === y) return y;
  }
  throw new Error("no FMR year available");
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "counties/manifest.json"), "utf8")).counties.map((m) => ({ fips: m.fips, name: m.name, state: m.state }));
  const outPath = path.join(root, "app/data/hud_fair_market_rents.json");
  // Counties the earlier hand-typed file covered that are not in the manifest (Los Angeles, Orange).
  for (const [fips, state] of EXTRA) if (!manifest.some((m) => m.fips === fips)) manifest.push({ fips, name: fips, state });
  const year = await resolveYear();
  console.log("fiscal year:", year);

  // HUD entity lists per state.
  const entities = []; // {state_code, fips_code, county_name, town_name}
  for (const s of new Set(manifest.map((m) => m.state).filter((x) => x !== "CT"))) {
    const lc = await getJson(`${BASE}/listCounties/${s}`, `listCounties/${s}.json`);
    if (!Array.isArray(lc)) throw new Error("listCounties failed for " + s);
    entities.push(...lc);
  }
  const byCounty = new Map();
  for (const e of entities) {
    const k = e.fips_code.slice(0, 5);
    if (!byCounty.has(k)) byCounty.set(k, []);
    byCounty.get(k).push(e);
  }

  // Connecticut planning region -> HUD town entities.
  const ctRegion = new Map(); // region code (e.g. "110") -> list of 10-digit HUD/GEOID entity ids
  const tiger = await getJson(TIGER, "tiger_ct_cousub.json");
  for (const f of tiger.features || []) {
    const a = f.attributes;
    if (/not defined/i.test(a.NAME)) continue;
    const r = a.COUNTY;
    if (!ctRegion.has(r)) ctRegion.set(r, []);
    ctRegion.get(r).push(a.GEOID);
  }

  const rows = [];
  const safmrDir = path.join(root, "app/data/hud_safmr");
  fs.rmSync(safmrDir, { recursive: true, force: true });
  fs.mkdirSync(safmrDir, { recursive: true });
  let safmrFiles = 0, safmrBytes = 0;

  const mk = (m, extra) => ({
    fips: m.fips, state_code: m.state, metro_or_county_name: null, fiscal_year: year,
    zero_bed_eff: null, one_bed_1br: null, two_bed_2br: null, three_bed_3br: null, four_bed_4br: null,
    source_agency: "U.S. Department of Housing and Urban Development (HUD)",
    source_url: null, retrieved: TODAY, last_verified: TODAY, small_area: false, ...extra,
  });

  for (const m of manifest) {
    let ids;
    if (m.state === "CT") {
      ids = ctRegion.get(m.fips.slice(2)) || [];
      if (!ids.length) { rows.push(mk(m, { metro_or_county_name: m.name, null_reason: "No towns found for this Connecticut planning region in the Census crosswalk" })); continue; }
    } else {
      const list = byCounty.get(m.fips) || [];
      const std = list.find((e) => e.fips_code === m.fips + "99999");
      ids = std ? [std.fips_code] : list.map((e) => e.fips_code);
      if (!ids.length) { rows.push(mk(m, { metro_or_county_name: m.name, null_reason: "County not in HUD listCounties" })); continue; }
    }
    const results = [];
    for (const id of ids) {
      const j = await fmrData(id, year);
      if (j.__error || !j.data) { results.push({ id, err: j.__error || "nodata" }); continue; }
      if (m.state === "CT" && !String(j.data.county_name).startsWith(m.name)) { results.push({ id, err: "region name mismatch: " + j.data.county_name }); continue; }
      const ar = areaRow(j.data);
      results.push({ id, d: j.data, ar });
    }
    const ok = results.filter((r) => r.ar);
    const sig = (r) => r.d.area_name + "|" + r.ar.v.join(",");
    const uniq = new Set(ok.map(sig));
    if (ok.length !== results.length || ok.length === 0) {
      rows.push(mk(m, { metro_or_county_name: m.name, source_url: fmrUrl(ids[0], year), null_reason: `HUD returned no usable rent row for ${results.length - ok.length} of ${results.length} entities` }));
      continue;
    }
    if (uniq.size > 1) {
      rows.push(mk(m, {
        metro_or_county_name: m.name, source_url: fmrUrl(ids[0], year),
        null_reason: `HUD publishes ${uniq.size} different FMR areas/values across the ${ids.length} towns in this ${m.state === "CT" ? "planning region" : "county"}; no single county rent`,
      }));
      continue;
    }
    const r = ok[0];
    if (r.ar.year !== year) throw new Error(`year mismatch for ${r.id}: ${r.ar.year}`);
    const [e0, e1, e2, e3, e4] = r.ar.v;
    const small = Array.isArray(r.d.basicdata);
    rows.push(mk(m, {
      metro_or_county_name: r.d.area_name, zero_bed_eff: e0, one_bed_1br: e1, two_bed_2br: e2, three_bed_3br: e3, four_bed_4br: e4,
      source_url: fmrUrl(r.id, year), small_area: small,
      ...(ids.length > 1 ? { note: `All ${ids.length} HUD town entities in this ${m.state === "CT" ? "planning region" : "county"} resolve to the same FMR area` } : {}),
    }));
    if (small && ids.length === 1) {
      const zips = {};
      for (const z of r.d.basicdata) {
        if (z.zip_code === "MSA level") continue;
        const v = [z["Efficiency"], z["One-Bedroom"], z["Two-Bedroom"], z["Three-Bedroom"], z["Four-Bedroom"]].map(Number);
        if (v.every((x) => Number.isInteger(x) && x > 0)) zips[z.zip_code] = v;
      }
      if (Object.keys(zips).length) {
        const txt = JSON.stringify(zips);
        fs.writeFileSync(path.join(safmrDir, `${m.fips}.json`), txt + "\n");
        safmrFiles++; safmrBytes += txt.length;
      }
    }
    if (rows.length % 50 === 0) console.log(rows.length, "/", manifest.length);
  }

  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2) + "\n");
  const nulls = rows.filter((r) => r.one_bed_1br == null).length;
  console.log(`rows=${rows.length} null=${nulls} small_area=${rows.filter((r) => r.small_area).length} safmrFiles=${safmrFiles} safmrBytes=${safmrBytes}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
