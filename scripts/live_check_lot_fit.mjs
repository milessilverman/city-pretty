// Live check of the "what fits on this lot" zoning rows (real network, NOT part of CI).
//
// For real one- and two-family lots in New York City (sampled from MapPLUTO, the page's own parcel service), this opens
// the page, clicks each lot through the page's own click path (houseAt) and checks what the house panel says against
// what is fetched here independently:
//   zoning district, lot area, frontage, floor area -> MapPLUTO, queried directly for the same point
//   housing types, minimum lot, FAR, height, ADU     -> the Zoning Resolution section pages, re-fetched now: each rule's
//                                                       quote (or table row) must still appear in its section's text
//   parcel use                                       -> "One & Two Family Buildings" (PLUTO LandUse 01)
// Outside NYC it opens one lot per listed county and checks the panel says the standards are not on file, with the reason.
//
// Usage: NODE_USE_ENV_PROXY=1 node scripts/live_check_lot_fit.mjs   (writes data/backtests/live_check_lot_fit_<date>.json)
// Env: LIVE_PORT (default 8899).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8899);
const UA = { "User-Agent": "city-pretty-live-check/1.0" };
const PLUTO = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0";
const ZS = JSON.parse(fs.readFileSync(path.join(root, "app/data/zoning_standards.json"), "utf8"));
const NYC = ZS.jurisdictions.find((j) => j.id === "nyc");
const fmtN = (v) => Math.round(v).toLocaleString("en-US");

// Small boxes in low-density neighborhoods of each borough (2 lots each, different districts where the box has them).
const BOXES = [
  { fips: "36081", name: "Queens (Hollis Hills / Bayside)", box: [-73.77, 40.73, -73.75, 40.745] },
  { fips: "36085", name: "Staten Island (Westerleigh / Todt Hill)", box: [-74.14, 40.60, -74.10, 40.62] },
  { fips: "36047", name: "Brooklyn (Marine Park / Midwood)", box: [-73.95, 40.605, -73.92, 40.625] },
  { fips: "36005", name: "Bronx (Riverdale / Throggs Neck)", box: [-73.915, 40.885, -73.895, 40.90] },
];
const OTHER = [
  { fips: "48453", name: "Travis TX, 809 Park Blvd (Austin: code on Municode, withheld)", lat: 30.301426, lng: -97.722411 },
  { fips: "01073", name: "Jefferson AL (no standards read)", lat: 33.4877, lng: -86.7697 },
];

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.ok) return await r.json(); } catch {}
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}
async function getText(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (city-pretty live check)" }, signal: AbortSignal.timeout(90000) }); if (r.ok) return await r.text(); } catch {}
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
  return null;
}
const flat = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&ldquo;|&#8220;/g, "“").replace(/&rdquo;|&#8221;/g, "”").replace(/&#8211;|&ndash;/g, "–").replace(/\s+/g, " ").replace(/ ([,.;:)])/g, "$1");

async function sampleLots(b) {
  const q = new URLSearchParams({ where: "LandUse='01' AND (ZoneDist1 LIKE 'R1%' OR ZoneDist1 LIKE 'R2%' OR ZoneDist1 LIKE 'R3%' OR ZoneDist1 LIKE 'R4%' OR ZoneDist1 LIKE 'R5%')",
    geometry: b.box.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "BBL,Address,ZoneDist1,LotArea,LotFront,BldgArea,UnitsRes", returnGeometry: "true", outSR: "4326", resultRecordCount: "200", f: "json" });
  const d = await getJson(`${PLUTO}/query?${q}`);
  const feats = (d && d.features || []).filter((f) => f.geometry && f.geometry.rings && NYC.districts[f.attributes.ZoneDist1]);
  const byDist = {};
  for (const f of feats) (byDist[f.attributes.ZoneDist1] ||= []).push(f);
  const picks = Object.values(byDist).map((fs_) => fs_[Math.floor(fs_.length / 2)]).slice(0, 2);
  return picks.map((f) => {
    const r = f.geometry.rings[0], n = r.length - 1;
    return { lat: r.slice(0, n).reduce((s, p) => s + p[1], 0) / n, lng: r.slice(0, n).reduce((s, p) => s + p[0], 0) / n, pluto_sample: f.attributes };
  });
}
async function plutoAt(lat, lng) {
  const d = await getJson(`${PLUTO}/query?` + new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "BBL,Address,LandUse,ZoneDist1,LotArea,LotFront,BldgArea,UnitsRes", returnGeometry: "false", f: "json" }));
  return d && d.features && d.features[0] ? d.features[0].attributes : null;
}

// Re-fetch every section the NYC rules cite and confirm each quote / table row is still in the code's text.
async function verifyQuotes() {
  const pages = {}, out = [];
  const need = (url, what, text) => out.push({ url, what, text });
  const D = NYC.districts;
  for (const [dd, r] of Object.entries(D)) {
    if (r.housing_types.limited_to) need(r.housing_types.url, `${dd} housing types`, r.housing_types.quote);
    need(r.min_lot.url, `${dd} min lot`, r.min_lot.row.split(" | ")[0]);
    need(r.far.url, `${dd} FAR`, r.far.row.split(" | ")[0]);
    need(r.height.url, `${dd} height`, r.height.quote);
  }
  need(NYC.adu.url, "ADU definition", NYC.adu.quote);
  need(NYC.qualifying_residential_site.url, "qualifying residential site", NYC.qualifying_residential_site.quote);
  const seen = new Map();
  for (const o of out) {
    const key = `${o.url}||${o.text}`;
    if (seen.has(key)) continue;
    if (!(o.url in pages)) { const h = await getText(o.url); pages[o.url] = h ? flat(h) : null; }
    const t = pages[o.url];
    // " … " joins sentences that are not adjacent in the code; each part must be there.
    seen.set(key, { url: o.url, what: o.what, found: t == null ? null : o.text.split(" … ").every((part) => t.includes(part)) });
  }
  return [...seen.values()];
}

function expectedNyc(P, lot) {
  const r = NYC.districts[lot.ZoneDist1];
  const exp = [`Zoning district ${lot.ZoneDist1} (New York City Zoning Resolution)`, "One & Two Family Buildings",
    `${fmtN(r.min_lot.area_sqft)} sq ft and ${r.min_lot.width_ft} ft wide (ZR 23-11)`,
    `Height: up to ${r.height.max_height_ft} ft`,
    r.housing_types.limited_to ? `limited to ${r.housing_types.limited_to} (ZR 22-122)` : "no limit on the type of residence",
    `Ancillary dwelling unit (ADU, up to 800 sq ft)`];
  if (lot.LotArea > 0) exp.push(`Up to ${fmtN(r.far.standard * lot.LotArea)} sq ft of floor area on this ${fmtN(lot.LotArea)} sq ft lot (FAR ${r.far.standard.toFixed(2)}, ZR 23-21)`);
  return exp;
}

function serve() { return spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" }); }

async function openHouse(page, fips, ll) {
  await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
  await page.waitForFunction((f) => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f) || false, fips, { timeout: 180000 }).catch(() => {});
  await page.waitForFunction(() => { try { return !!(0, eval)("ZONING_STANDARDS") && !!(0, eval)("PARCEL_USE_CODES"); } catch { return false; } }, null, { timeout: 30000 });
  await page.evaluate((p) => (0, eval)("houseAt")(p), ll);
  await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && /Zoning district|Local zoning standards|Home upgrades|did not answer|Couldn.t get this lot|Right-of-Way/.test(b.innerText); }, null, { timeout: 90000 }).catch(() => {});
  return page.evaluate(() => { const b = document.querySelector("#house"); return b ? b.innerText : ""; });
}

async function main() {
  const srv = serve();
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const results = { ran_on: new Date().toISOString(), script: "scripts/live_check_lot_fit.mjs", nyc: [], other: [], quotes: null };
  try {
    results.quotes = await verifyQuotes();
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    for (const b of process.env.LIVE_ONLY_OTHER === "1" ? [] : BOXES) {
      for (const P of await sampleLots(b)) {
        const lot = await plutoAt(P.lat, P.lng);
        const row = { county: b.fips, area: b.name, lat: +P.lat.toFixed(6), lng: +P.lng.toFixed(6), pluto: lot };
        if (!lot || !NYC.districts[lot.ZoneDist1]) { row.skipped = "point not inside an R1-R5 one/two-family lot when re-queried"; results.nyc.push(row); continue; }
        const text = await openHouse(page, b.fips, { lat: P.lat, lng: P.lng });
        const exp = expectedNyc(P, lot);
        row.missing = exp.filter((e) => !text.includes(e));
        row.ok = row.missing.length === 0;
        row.panel_excerpt = text.split("\n").filter((l) => /Zoning district|Floor area|Second home|Split into two|Ancillary|Height limit|One & Two/.test(l)).join("\n").slice(0, 1500);
        results.nyc.push(row);
        console.log(b.fips, lot.ZoneDist1, lot.Address, row.ok ? "OK" : "MISSING " + JSON.stringify(row.missing));
      }
    }
    for (const o of OTHER) {
      const text = await openHouse(page, o.fips, { lat: o.lat, lng: o.lng });
      const row = { county: o.fips, area: o.name, lat: o.lat, lng: o.lng };
      row.shows_not_on_file = /Local zoning standards\s*Not on file/.test(text) || text.includes("Not on file: ");
      row.unknown_use = /doesn't record this lot's use/.test(text);
      row.excerpt = text.split("\n").filter((l) => /Local zoning|Not on file|Home upgrades|doesn't record/.test(l)).join("\n").slice(0, 800);
      if (!row.excerpt) row.panel_start = text.slice(0, 600);
      results.other.push(row);
      console.log(o.fips, row.shows_not_on_file ? "not-on-file shown" : row.unknown_use ? "use unknown (checks not run)" : "NOT SHOWN");
    }
    results.page_errors = errors;
  } finally {
    await browser.close();
    srv.kill();
  }
  const day = new Date().toISOString().slice(0, 10);
  const out = path.join(root, `data/backtests/live_check_lot_fit_${day}.json`);
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  const q = results.quotes;
  console.log(`quotes found ${q.filter((x) => x.found).length}/${q.length}; nyc ok ${results.nyc.filter((r) => r.ok).length}/${results.nyc.filter((r) => !r.skipped).length}; wrote ${out}`);
}
main();
