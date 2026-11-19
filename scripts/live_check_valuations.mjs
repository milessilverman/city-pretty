// Live end-to-end check (real network, NOT part of CI): for every county reported as showing a back-tested home-value
// estimate, open real homes on the served page through the page's own click path (houseAt) and record what the
// house panel actually shows: a model estimate, a recorded sale / base-year value, or a withheld reason.
//
// Why: Queens, Staten Island and Hillsborough were reported "shown" while the live page always withheld them, because
// the tests fed fields straight to the model and skipped the live parcel lookup.
//
// Usage: NODE_USE_ENV_PROXY=1 node scripts/live_check_valuations.mjs [fips ...] [--old-sale]   (writes data/backtests/live_check_<date>.json;
//        --old-sale: Florida homes whose last sale is before 2025, written to live_check_<date>_old_sale.json)
// Homes come from each county's saved back-test sales (fit window, i.e. older sales, so the model path is exercised);
// a point inside each parcel comes from the county's parcel service geometry.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8899);
const N = Number(process.env.LIVE_N || 5);
// "point": a click on the map where no lot is drawn (the page reads the parcel itself). "drawn lot": a click on a lot the
// map has drawn, which carries only the registry's first 8 fields (how most clicks at street zoom arrive). LA: point only.
const MODES = (process.env.LIVE_MODES || "point,drawn lot").split(",").map((s) => s.trim()).filter(Boolean);
const UA = { "User-Agent": "city-pretty-live-check/1.0" };

const DAY = "2026-11-16";
const COUNTIES = {
  "06037": { name: "Los Angeles", file: `la_resets_2022-2024_${DAY}.json.gz`, la: true },
  "11001": { name: "Washington DC", layer: "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/40", where: (id) => `SSL='${id}'` },
  "36081": { name: "Queens", layer: "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0", where: (id) => `BBL=${Number(id)}` },
  "36085": { name: "Staten Island", layer: "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0", where: (id) => `BBL=${Number(id)}` },
  "53033": { name: "King County", layer: "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0", where: (id) => `FIPS_NR='033' AND ORIG_PARCEL_ID='${id}'` },
  ...Object.fromEntries([["12057", "Hillsborough"], ["12086", "Miami-Dade"], ["12011", "Broward"], ["12031", "Duval"], ["12095", "Orange FL"], ["12099", "Palm Beach"], ["12103", "Pinellas"]]
    .map(([f, n]) => [f, { name: n, layer: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0", where: (id) => `PARCEL_ID='${id}'` }])),
};
const LA_LAYER = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0";

async function getJson(url, timeoutMs = 60000) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
  return null;
}

const inRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inRings = (rings, x, y) => rings.reduce((c, r) => (inRing(r, x, y) ? !c : c), false);
function interiorPoint(rings) {
  const pts = rings[0];
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  if (inRings(rings, cx, cy)) return [cx, cy];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let k = 3; k <= 30; k += 3) for (let i = 1; i < k; i++) for (let j = 1; j < k; j++) {
    const x = x0 + ((x1 - x0) * i) / k, y = y0 + ((y1 - y0) * j) / k;
    if (inRings(rings, x, y)) return [x, y];
  }
  return null;
}

async function countyAt(lat, lng) {
  const u = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/82/query?" +
    new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "GEOID", returnGeometry: "false", f: "json" });
  const d = await getJson(u);
  return d && d.features && d.features[0] ? d.features[0].attributes.GEOID : null;
}

function rowsFor(fips) {
  const c = COUNTIES[fips];
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "data/backtests", c.file || `sales_${fips}_${DAY}.json.gz`))));
  if (c.la) return d.records.filter((r) => +r.SQFTmain1 > 400 && r.UseCode === "0100").map((r) => ({ id: r.AIN, date: r.Roll_LandBaseYear }));
  return d.rows.filter((r) => r.sqft && r.yb).map((r) => ({ id: r.id, date: r.date, bg: r.bg || null }));
}

// Florida homes whose last sale is before 2025 (so the page shows the model estimate, not a recorded sale), picked
// straight from the statewide layer: single-family (DOR_UC 001), living area and year built present, and no sale on
// the roll. On this layer (2026 roll) SALE_YR1 is only ever 0, 2025 or 2026 (checked on 1,000 Broward rows, 16 Nov),
// so SALE_YR1=0 means no sale since 1 Jan 2025. Any WHERE on SALE_YR1 is refused by the service (HTTP 400), and small
// resultRecordCount values hang, so pages of 1,000 rows are fetched and filtered here.
const FL_DOR_CO = { "12011": 16, "12095": 58, "12057": 39, "12086": 23, "12031": 26, "12099": 60, "12103": 62 };
const FL_BOXES = {
  "12011": [[-80.21, 26.01, "Hollywood"], [-80.25, 26.10, "Plantation"], [-80.27, 26.26, "Coral Springs"], [-80.31, 26.00, "Pembroke Pines"], [-80.13, 26.23, "Pompano Beach"]],
  "12095": [[-81.40, 28.52, "Orlando"], [-81.35, 28.59, "Winter Park"], [-81.51, 28.67, "Apopka"], [-81.55, 28.56, "Ocoee"], [-81.27, 28.55, "east Orange"]],
};
async function oldSalePointsFor(fips) {
  const co = FL_DOR_CO[fips];
  if (!co) throw new Error(`--old-sale: no DOR county number for ${fips}`);
  // One home from each of several small boxes spread across the county (city centers picked by hand; every pick is still
  // checked to be in the county with the Census county layer). County-wide paged queries (resultOffset) time out on
  // this layer for Broward; a box with a spatial filter returns in ~15 s.
  const boxes = FL_BOXES[fips];
  if (!boxes) throw new Error(`--old-sale: no sample boxes for ${fips}`);
  const out = [];
  for (const [bx, by, label] of boxes.slice(0, N)) {
    const q = { where: `CO_NO=${co} AND DOR_UC='001'`, geometry: `${bx},${by},${bx + 0.01},${by + 0.01}`, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "PARCEL_ID,SALE_YR1,SALE_YR2,TOT_LVG_AR,ACT_YR_BLT", returnGeometry: "true", outSR: "4326", resultRecordCount: "1000", f: "json" };
    const d = await getJson(`${COUNTIES[fips].layer}/query?` + new URLSearchParams(q), 180000);
    const rows = (d && d.features) || [];
    const feats = rows.filter((f) => f.geometry && f.geometry.rings && !f.attributes.SALE_YR1 && !f.attributes.SALE_YR2 && f.attributes.TOT_LVG_AR > 0 && f.attributes.ACT_YR_BLT > 0);
    console.error(`   ${fips} ${label}: ${feats.length} of ${rows.length} single-family rows have no sale since 2025`);
    for (const f of feats.slice(0, 20)) {
      const p = interiorPoint(f.geometry.rings);
      if (!p || (await countyAt(p[1], p[0])) !== fips) continue;
      out.push({ id: f.attributes.PARCEL_ID, lat: p[1], lng: p[0], sales_file_bg: null, last_sale_year: "before 2025 (no sale on the 2026 roll)" });
      break;
    }
  }
  return out;
}

async function pointsFor(fips) {
  if (process.argv.includes("--old-sale")) return oldSalePointsFor(fips);
  const c = COUNTIES[fips];
  const rows = rowsFor(fips).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  // spread picks across the oldest third (fit window), deterministic
  const pool = rows.slice(0, Math.max(N * 20, Math.floor(rows.length / 3)));
  const out = [];
  for (let i = 0; i < pool.length && out.length < N; i += Math.max(1, Math.floor(pool.length / (N * 4)))) {
    const id = pool[i].id;
    const layer = c.la ? LA_LAYER : c.layer, where = c.la ? `AIN='${id}'` : c.where(id);
    const d = await getJson(`${layer}/query?` + new URLSearchParams({ where, outFields: "*", returnGeometry: "true", outSR: "4326", f: "json" }));
    const feats = (d && d.features) || [];
    for (const f of feats) {
      if (!f.geometry || !f.geometry.rings) continue;
      const p = interiorPoint(f.geometry.rings);
      if (!p) continue;
      const cty = await countyAt(p[1], p[0]);
      if (cty !== fips) continue;
      out.push({ id, lat: p[1], lng: p[0], sales_file_bg: pool[i].bg || null });
      break;
    }
  }
  return out;
}

function serve() {
  const p = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
  return p;
}

async function main() {
  const want = process.argv.slice(2).filter((a) => /^\d{5}$/.test(a));
  const list = want.length ? want : Object.keys(COUNTIES);
  const srv = serve();
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const results = {};
  try {
    for (const fips of list) {
      const pts = await pointsFor(fips);
      results[fips] = { county: COUNTIES[fips].name, points: pts.length, homes: [] };
      console.error(`${fips} ${COUNTIES[fips].name}: ${pts.length} points`);
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
      await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
      await page.waitForFunction(() => (document.querySelector("#loading")?.hidden === true), null, { timeout: 90000 });
      // capture the page's own valuation results
      await page.evaluate(() => {
        const w = window;
        w.__vals = [];
        const orig = w.publishValuation;
        w.publishValuation = function (...args) {
          const r = orig.apply(this, args);
          try {
            // What the county's tested model gives for this house with the page's own inputs, even when a recent recorded
            // sale is shown instead (so a sale-shown home still proves the model path works live).
            let m = null;
            const cme = (0, eval)("typeof countyModelEstimate === 'function' ? countyModelEstimate : null");
            if (cme && args[2] && String(args[1]) !== "06037") { const e = cme(String(args[1]).padStart(5, "0"), args[2].attributes, args[2].bg); m = e ? { value: e.value || null, reason: e.reason || null } : null; }
            w.__vals.push({ fips: args[1], bg: args[2] && args[2].bg || null, model: m, r: JSON.parse(JSON.stringify(r)) });
          } catch (e) {}
          return r;
        };
      });
      if (fips !== "06037") {
        await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
        await page.waitForFunction((f) => { const w = window; return (w.D_OC && w.D_OC.meta && w.D_OC.meta.fips === f) || false; }, fips, { timeout: 120000 }).catch(() => {});
      }
      for (const mode of MODES) for (const pt of pts) {
        if (mode === "drawn lot" && fips === "06037") continue;
        const rec = { id: pt.id, mode, lat: +pt.lat.toFixed(6), lng: +pt.lng.toFixed(6), sales_file_bg: pt.sales_file_bg || null };
        try {
          await page.evaluate(() => { window.__vals = []; });
          if (mode === "drawn lot") {
            // the feature exactly as the page draws it (natLots: the registry's first 8 fields), then a click on it
            const started = await page.evaluate(async (ll) => {
              const ev = (s) => (0, eval)(s);
              const svc = ev("parcelSvc")(ev("activeFips")());
              if (!svc) return "no parcel service";
              const fields = (svc.fields || []).slice(0, 8).map((f) => f[0]).join(",") || "OBJECTID";
              const d = await ev("arcQuery")(svc.url, { geometry: `${ll.lng},${ll.lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
                outFields: fields, returnGeometry: "true", outSR: "4326" }, 20000).catch(() => null);
              const f = d && d.features && d.features.find((g) => g.geometry && g.geometry.rings && ev("ringsContain")(g.geometry.rings, ll));
              if (!f) return d ? "drawn lot not found at point" : "parcel service did not answer (drawing the lot)";
              ev("houseAt")(ll, ev("normalizeParcelFeature")(f, null, svc));
              return "ok";
            }, { lat: pt.lat, lng: pt.lng });
            if (started !== "ok") throw Object.assign(new Error(started), { result: started });
          } else {
            await page.evaluate((ll) => (0, eval)("houseAt")(ll), { lat: pt.lat, lng: pt.lng });
          }
          // wait for the panel to finish its live checks (or 45 s)
          await page.waitForFunction(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); const box = document.querySelector("#house");
            return box && !box.querySelector(".house-loading") && (!ah || (ah.st && ah.st.rDone && ah.st.osmDone)); }, null, { timeout: 45000 }).catch(() => {});
          await page.waitForTimeout(1500);
          const got = await page.evaluate(() => {
            const vals = (window.__vals || []).filter((v) => v && v.r);
            const last = vals[vals.length - 1];
            window.__allbgs = vals.map((v) => v.bg);
            const box = document.querySelector("#house");
            return { val: last ? last.r : null, bg: last ? last.bg : null, model: last ? last.model : null, bgs: [...new Set(vals.map((v) => v.bg))], calls: vals.length, text: box ? box.innerText.replace(/\s+/g, " ").slice(0, 1500) : null };
          });
          const v = got.val;
          if (!v) rec.result = got.text && /Right-of-Way/.test(got.text) ? "no parcel at point (right-of-way)" : got.text && /Couldn.t get this lot from the parcel service/.test(got.text) ? "parcel service did not answer" : "no valuation computed";
          else if (v.estimatedValue && /Recorded sale|Assessed value set at/i.test((v.valuationMethod || "") + " " + (v.confidenceRating || ""))) rec.result = "sourced figure shown (recorded sale / base-year value)";
          else if (v.estimatedValue) rec.result = "model estimate shown";
          else rec.result = "withheld";
          rec.value = v ? v.estimatedValue : null;
          rec.method = v ? v.valuationMethod || null : null;
          rec.rating = v ? v.confidenceRating || null : null;
          rec.withheld_reason = v ? v.withheldReason || null : null;
          rec.model_estimate_same_inputs = got.model;
          rec.page_bg = got.bg;
          rec.page_bgs_all_calls = got.bgs;
          rec.valuation_calls = got.calls;
          rec.address = (got.text || "").match(/This home ([^·]{0,80})/)?.[1]?.trim() || null;
        } catch (e) {
          rec.result = e.result || "error";
          rec.error = String(e.message || e).slice(0, 200);
        }
        results[fips].homes.push(rec);
        const mm = rec.model_estimate_same_inputs;
        if (rec.sales_file_bg && rec.page_bg && rec.sales_file_bg !== rec.page_bg) rec.bg_mismatch = true;
        console.error(`   [${mode}] ${rec.id}: ${rec.result}${rec.value ? " $" + rec.value : ""}${rec.withheld_reason ? " | " + rec.withheld_reason.slice(0, 140) : ""}${mm && rec.result !== "model estimate shown" ? ` [model: ${mm.value ? "$" + mm.value : mm.reason}]` : ""}${rec.bg_mismatch ? ` [BG MISMATCH page ${rec.page_bg} vs sales file ${rec.sales_file_bg}]` : ""}`);
      }
      results[fips].page_errors = errors.slice(0, 5);
      await page.close();
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  const out = path.join(root, `data/backtests/live_check_${new Date().toISOString().slice(0, 10)}${process.argv.includes("--old-sale") ? "_old_sale" : ""}.json`);
  fs.writeFileSync(out, JSON.stringify({ ran_on: new Date().toISOString(), script: "scripts/live_check_valuations.mjs", results }, null, 1));
  console.error("wrote", out);
}

main().catch((e) => { console.error(e); process.exit(1); });
