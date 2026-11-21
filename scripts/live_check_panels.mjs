// Live end-to-end check of every sourced panel feature other than home values (real network, NOT part of CI).
//
// Why: the valuation work showed features that pass unit tests can still be broken on the live page (8 of 12 counties
// were). For 2 counties per Census division plus LA and Orange County, this opens real parcels through the page's own
// click path (houseAt) and selects their block group (select()), then checks what the page shows against each source,
// fetched independently here:
//   HUD Fair Market Rent row  -> app/data/hud_fair_market_rents.json for the county TIGERweb puts the point in
//   FEMA flood zone, USGS elevation -> re-queried from FEMA NFHL and USGS EPQS
//   Census area row           -> TIGERweb county and block group for the point
//   crash text / comparison   -> app/data/crash_counts/<fips>.json and crash_gaps/<fips>.json
//   state housing laws        -> only that state's records from app/data/statutes.json; no hardcoded "by right" claims
//   neighborhood figures      -> the county data file (+ bundle_corrections.json); LA home value -> la_neighborhood_values.json
//   tree canopy               -> app/data/tree_equity_2025/<fips>.json (or the 2021 value, labelled 2021, where absent)
//   console errors            -> none
//
// Usage: NODE_USE_ENV_PROXY=1 node scripts/live_check_panels.mjs [fips ...]   (writes data/backtests/live_check_panels_<date>[_$LIVE_SHARD].json)
//        node scripts/live_check_panels.mjs --recheck-fema <result.json ...>   (re-opens "Not available" FEMA/USGS rows alone)
// Env: LIVE_PORT (default 8897), LIVE_N points per county (default 3), LIVE_SHARD output suffix.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8897);
const PER = Number(process.env.LIVE_N || 3);
const UA = { "User-Agent": "city-pretty-live-check/1.0" };
const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer";

// 2 counties per Census division (with a county data file and a parcel service), plus LA and Orange County.
const COUNTIES = {
  "06037": "Los Angeles CA", "06059": "Orange CA",
  "23005": "Cumberland ME (New England)", "09110": "Capitol Planning Region CT (New England)",
  "42003": "Allegheny PA (Middle Atlantic)", "34013": "Essex NJ (Middle Atlantic)",
  "17031": "Cook IL (East North Central)", "18057": "Hamilton IN (East North Central)",
  "19113": "Linn IA (West North Central)", "20209": "Wyandotte KS (West North Central)",
  "51059": "Fairfax VA (South Atlantic)", "37183": "Wake NC (South Atlantic)",
  "47037": "Davidson TN (East South Central)", "01073": "Jefferson AL (East South Central)",
  "48453": "Travis TX (West South Central)", "05119": "Pulaski AR (West South Central)",
  "49035": "Salt Lake UT (Mountain)", "04013": "Maricopa AZ (Mountain)",
  "06073": "San Diego CA (Pacific)", "41051": "Multnomah OR (Pacific)",
};
// Every state (a missing entry made the law check compare against "undefined"; found 17 Nov 2026 on King County WA).
const STATE = {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR"};
// Law claims that are not read from app/data/statutes.json and assert a right without checking its conditions.
const HARDCODED_LAW = [/WA HB 1110 allows/, /Oregon HB 2001 permits/, /Austin HOME Initiative authorizes/, /municipal infill schedule/, /Fannie Mae \/ FHA/, /HB 1337 allows up to two/, /Live Local Act & local infill standards allow/, /Fee-simple lot split allowed/, /Unit subdivision authorized under WA HB 1337/, /raised foundation qualifies/, /connections qualify for/];

const load = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const loadIf = (rel) => (fs.existsSync(path.join(root, rel)) ? load(rel) : null);
const HUD = Object.fromEntries(load("app/data/hud_fair_market_rents.json").records.map((r) => [r.fips, r]));
const STATUTES = load("app/data/statutes.json");
const CORR = (loadIf("app/data/bundle_corrections.json") || {}).block_groups || {};
const LANV = load("app/data/la_neighborhood_values.json");
// Census ACS code for a top-coded median gross rent (table B25064). Fetched 21 Nov 2026 from
// https://www2.census.gov/programs-surveys/acs/tech_docs/jam_values/2024_Jam_Values.xlsx, "Median - Jam Values", row
// "Gross Rent", upper interval: meaning "$3,500 or more", character value "3,500+", numeric value (API and Summary File) "3501".
const ACS_RENT_TOP = 3501;
const SERVICES = load("app/data/parcel_services.json").services;

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (r.ok) { const t = await r.text(); try { return JSON.parse(t); } catch { return null; } }
    } catch {}
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}
const pq = (lat, lng, outFields) => new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields, returnGeometry: "false", f: "json" });
async function tigerAt(lat, lng) {
  const [c, b] = await Promise.all([getJson(`${TIGER}/82/query?${pq(lat, lng, "GEOID,NAME")}`), getJson(`${TIGER}/10/query?${pq(lat, lng, "GEOID")}`)]);
  return { county: c && c.features && c.features[0] ? c.features[0].attributes : null, bg: b && b.features && b.features[0] ? b.features[0].attributes.GEOID : null };
}
async function bgPoint(geoid) {
  const d = await getJson(`${TIGER}/10/query?` + new URLSearchParams({ where: `GEOID='${geoid}'`, outFields: "INTPTLAT,INTPTLON", returnGeometry: "false", f: "json" }));
  const a = d && d.features && d.features[0] && d.features[0].attributes;
  return a ? { lat: +a.INTPTLAT, lng: +a.INTPTLON } : null;
}
async function fema(lat, lng) {
  const d = await getJson(`https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${pq(lat, lng, "FLD_ZONE,ZONE_SUBTY,SFHA_TF")}`);
  if (!d) return { error: true };
  const f = d.features && d.features[0];
  return f ? { zone: f.attributes.FLD_ZONE } : { zone: null };
}
async function usgs(lat, lng) {
  const d = await getJson("https://epqs.nationalmap.gov/v1/json?" + new URLSearchParams({ x: String(lng), y: String(lat), units: "Feet", wkid: "4326" }));
  const v = d ? Number(d.value) : NaN;
  return Number.isFinite(v) && v > -100000 ? Math.round(v) : null;
}

const inRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inRings = (rings, x, y) => rings.reduce((c, r) => (inRing(r, x, y) ? !c : c), false);
function interior(rings) {
  const pts = rings[0];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const c = [(x0 + x1) / 2, (y0 + y1) / 2];
  if (inRings(rings, c[0], c[1])) return c;
  for (let k = 3; k <= 21; k += 3) for (let i = 1; i < k; i++) for (let j = 1; j < k; j++) {
    const x = x0 + ((x1 - x0) * i) / k, y = y0 + ((y1 - y0) * j) / k;
    if (inRings(rings, x, y)) return [x, y];
  }
  return null;
}
function servicesFor(fips) {
  const st = fips.slice(0, 2);
  return [...SERVICES.filter((s) => (s.counties || []).includes(fips)), ...SERVICES.filter((s) => !(s.counties || []).length && s.states.includes(st))];
}
// A real parcel inside the block group near its interior point (residential-looking first).
async function parcelPointIn(fips, bg) {
  const c = await bgPoint(bg);
  if (!c) return null;
  for (const s of servicesFor(fips)) {
    for (const pad of [0.0012, 0.003]) {
      const env = `${c.lng - pad},${c.lat - pad},${c.lng + pad},${c.lat + pad}`;
      const d = await getJson(`${s.url}/query?` + new URLSearchParams({ geometry: env, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "*", returnGeometry: "true", outSR: "4326", f: "json" }), 2);
      const feats = ((d && d.features) || []).filter((f) => f.geometry && f.geometry.rings);
      if (!feats.length) continue;
      const res = (f) => /resid|single|sfr|dwelling|^r-?1/i.test(Object.values(f.attributes || {}).filter((v) => typeof v === "string").join(" "));
      const dist = (f) => { const p = interior(f.geometry.rings); return p ? (p[0] - c.lng) ** 2 + (p[1] - c.lat) ** 2 : 1e9; };
      const cand = feats.sort((a, b) => (res(b) - res(a)) || (dist(a) - dist(b))).slice(0, 6);
      for (const f of cand) {
        const p = interior(f.geometry.rings);
        if (!p) continue;
        const t = await tigerAt(p[1], p[0]);
        if (t.bg === bg) return { lat: p[1], lng: p[0], service: s.name, residential_hint: res(f) };
      }
    }
  }
  return { lat: c.lat, lng: c.lng, service: null, note: "no parcel found near the block group's interior point; clicked the interior point" };
}

// County files kept only in R2 (counties/.r2-only.txt): read the local copy when this machine has one (the build
// machine), else download the R2 copy the page itself loads.
const R2_ONLY = new Set((loadText("counties/.r2-only.txt") || "").split("\n").map((l) => l.trim()).filter(Boolean));
function loadText(rel) { return fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : null; }
async function countyFile(fips) {
  if (fips === "06037") return null;
  if (fips === "06059") {
    const b64 = fs.readFileSync(path.join(root, "app/data/bundle-oc.b64.txt"), "utf8").trim();
    return JSON.parse(zlib.gunzipSync(Buffer.from(b64, "base64")));
  }
  const rel = `counties/bundle_${fips}.json.gz`;
  if (R2_ONLY.has(`bundle_${fips}.json.gz`) && !fs.existsSync(path.join(root, rel))) {
    const r = await fetch(load("app/data/county_hosts.json").r2.base.replace(/\/?$/, "/") + rel, { headers: UA });
    if (!r.ok) throw new Error(`R2-only county file ${rel}: HTTP ${r.status}`);
    return JSON.parse(zlib.gunzipSync(Buffer.from(await r.arrayBuffer())));
  }
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, rel))));
}

function hudExpected(fips) {
  const r = HUD[fips];
  if (!r) return null;
  if (r.two_bed_2br == null && Array.isArray(r.two_bed_range)) return r.two_bed_range;
  return r.two_bed_2br;
}

// Refuse a port something else already answers on: a server left by another checkout would be tested instead of this
// one (happened 16 Nov 2026: a run on a busy port checked an older app.js).
async function serve() {
  const busy = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
  if (busy) throw new Error(`port ${PORT} is already in use; set LIVE_PORT to a free port`);
  return spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
}

async function main() {
  const want = process.argv.slice(2).filter((a) => /^\d{5}$/.test(a));
  const list = want.length ? want : Object.keys(COUNTIES);
  const srv = await serve();
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const out = {};
  try {
    for (const fips of list) {
      const st = STATE[fips.slice(0, 2)];
      const rec = { county: COUNTIES[fips], state: st, points: [], checks: {}, errors: [] };
      out[fips] = rec;
      const page = await browser.newPage();
      page.on("pageerror", (e) => rec.errors.push("pageerror: " + e.message.slice(0, 200)));
      // console errors: script errors fail the check; a resource the browser could not load (an agency that did not
      // answer, a blocked cross-origin reply) is listed separately, since the page then says "not available".
      rec.network_errors = [];
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text().slice(0, 200);
        if (/Failed to load resource|Access to fetch at|net::ERR_/.test(t)) rec.network_errors.push(t);
        else rec.errors.push("console: " + t);
      });
      // where the county's data file actually came from (R2's r2.dev address or this site's counties/ path)
      rec.bundle_requests = [];
      page.on("response", (r) => { if (/bundle_\d{5}\.json\.gz/.test(r.url())) rec.bundle_requests.push(`${r.request().method()} ${r.status()} ${r.url()}`); });
      await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
      await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
      await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
      if (fips !== "06037") {
        await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
        await page.waitForFunction((f) => { const w = window; return (w.D_OC && w.D_OC.meta && w.D_OC.meta.fips === f) || false; }, fips, { timeout: 180000 }).catch(() => {});
      }
      // block groups: spread across the county's list, homes > 0
      const bgs = await page.evaluate(([f, n]) => {
        const ev = (s) => (0, eval)(s);
        const src = f === "06037" ? ev("D") : window.D_OC;
        const ids = ((src && (src.bgs ? src.bgs.features : src.features)) || []).map((x) => x.properties.id).filter((id) => id && id.startsWith(f));
        const step = Math.max(1, Math.floor(ids.length / (n * 3 + 1)));
        const pick = [];
        // start at the first block group when there are too few to skip one (a borough with 1-9 block groups)
        for (let i = ids.length > n * 3 ? step : 0; i < ids.length && pick.length < n * 3; i += step) pick.push(ids[i]);
        return pick;
      }, [fips, PER]);
      const file = await countyFile(fips);
      const cc = loadIf(`app/data/crash_counts/${fips}.json`), cg = loadIf(`app/data/crash_gaps/${fips}.json`), te = loadIf(`app/data/tree_equity_2025/${fips}.json`);
      for (const bg of bgs) {
        if (rec.points.length >= PER) break;
        const fileM = file ? ((file.details[bg] || {}).m || file.details[bg] || null) : null;
        if (file && (!fileM || !fileM.homes)) continue;
        const pt = await parcelPointIn(fips, bg);
        if (!pt) continue;
        const P = { bg, lat: +pt.lat.toFixed(6), lng: +pt.lng.toFixed(6), service: pt.service, note: pt.note || null, checks: {} };
        rec.points.push(P);
        const C = P.checks;
        const ok = (k, pass, detail) => { C[k] = { pass, detail }; };
        // ---- block-group panel
        await page.evaluate((id) => (0, eval)("select")(id, false), bg);
        await page.waitForTimeout(2500);
        const panel = await page.evaluate(() => { const p = document.querySelector("#panel"); return p ? p.textContent.replace(/\s+/g, " ") : ""; });
        const fmt = (v) => page.evaluate((x) => (0, eval)("fmt$")(x), v);
        // neighborhood figures
        if (fips === "06037") {
          const nv = LANV.bg[bg] || (LANV.tract || {})[bg.slice(0, 11)];
          const exp = nv ? await fmt(nv[1]) : null;
          ok("neighborhood", exp ? panel.includes(`Typical home value${exp}`) || panel.includes(`Typical home value ${exp}`) : /Typical home value\s*–/.test(panel),
            `home value expected ${exp || "none"} (la_neighborhood_values.json); rent/homes not independently checked for LA`);
        } else {
          const m = Object.assign({}, fileM);
          if (m.hv == null && CORR[bg] && CORR[bg].hv != null) m.hv = CORR[bg].hv;
          if (m.rent == null && CORR[bg] && CORR[bg].rent != null) m.rent = CORR[bg].rent;
          // Rent to the dollar, formatted here (not with the page's own formatter). 3501 is not a dollar figure: it is the
          // Census code for a median gross rent of "$3,500 or more" (ACS_RENT_TOP above), so the page must show that wording; 100 or less is the bottom-code, "$100 or less".
          const eRent = !m.rent ? "–" : m.rent === ACS_RENT_TOP ? "$3,500 or more/mo" : m.rent <= 100 ? "$100 or less/mo" : "$" + Math.round(m.rent).toLocaleString("en-US") + "/mo";
          const eHv = await fmt(m.hv);
          const eHomes = await page.evaluate((x) => (0, eval)("fmtN")(x), m.homes);
          // A top-coded rent: the page shows "$N or more/mo" (its ACS top-code rule), which matches when the file's value is at
          // least N. Found 20 Nov 2026 on Travis block group 484530010004, where this check expected the stored top-code to the dollar.
          const top = panel.match(/Median rent\$([\d,]+) or more\/mo/);
          const rentOk = top ? (m.rent != null && m.rent >= Number(top[1].replace(/,/g, ""))) : panel.includes(`Median rent${eRent}`);
          const pass = panel.includes(`Typical home value${eHv}`) && rentOk && panel.includes(`Homes${eHomes}`);
          ok("neighborhood", pass, `expected home value ${eHv}, rent ${eRent}${top ? " (page shows the top-code: " + top[0].replace("Median rent", "") + ")" : ""}, homes ${eHomes}` + (pass ? "" : " | panel: " + (panel.match(/Typical home value.{0,140}/) || [""])[0]));
        }
        // tree canopy (details table is in a <details>; textContent includes it)
        const teV = te && Array.isArray(te[bg]) && te[bg][0] != null ? Math.round(te[bg][0]) : null;
        const canopyM = panel.match(/Canopy gap to goal \(([^)]*?(?:\([^)]*\))?[^)]*)\)\s*(-?\d+) pts/);
        if (teV != null) ok("canopy", !!canopyM && +canopyM[2] === teV && /release/.test(canopyM[1]), `expected ${teV} pts (current release); page: ${canopyM ? canopyM[2] + " pts, " + canopyM[1] : "row not found"}`);
        else ok("canopy", !canopyM || /2021/.test(canopyM[1]), `no current-release value; page: ${canopyM ? canopyM[2] + " pts, " + canopyM[1] : "row not shown"}`);
        // canopy box over the map: the block group's own Tree Equity goal (tc_goal), never a hand-typed target
        const hud = await page.evaluate(() => ({ gap: (document.querySelector("#canopy-hud-gap") || {}).textContent || "", heat: (document.querySelector("#canopy-hud-heat") || {}).textContent || "",
          hood: (document.querySelector("#canopy-hud-hood") || {}).textContent || "" }));
        const teRow = te && Array.isArray(te[bg]) ? te[bg] : null;
        const expHud = teRow && teRow[0] != null && teRow[2] != null ? (teRow[0] > 0 ? `${teRow[0]} pts below its ${teRow[2]}% goal` : `At or above its ${teRow[2]}% goal`) : null;
        const noInvented = !/EPA|Eco-Norm|CEC Zone|Ecoregion/.test(hud.gap + hud.heat + hud.hood);
        ok("canopy_hud", noInvented && (expHud ? hud.gap === expHud : !/% goal/.test(hud.gap)), `expected ${expHud || "no goal figure"}; box: "${hud.gap}" / "${hud.heat}"`);
        // crash comparison
        const a = cg && cg.bg ? cg.bg[bg] : null;
        if (cc) {
          const cnt = Array.isArray(cc[bg]) ? cc[bg] : null;
          const wantGap = a && a.p && a.p[3] === "g";
          const shownN = (v) => (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1));   // 1/k counts show one decimal
          const gapTxt = wantGap ? `${shownN(a.p[0])} ${a.p[0] === 1 ? "crash" : "crashes"} involving a pedestrian or cyclist inside this block group` : null;
          const oldTxt = /\d+ pedestrian\/bike crash|fatal\/severe and \d+ pedestrian\/bike/.test(panel);
          const ksiRow = panel.match(/Crashes with someone killed or seriously injured, inside or on boundary streets\s*(\d[\d,]*(?:\.\d)?)/);
          const ksiOk = !cnt || !ksiRow || +ksiRow[1].replace(/,/g, "") === +shownN(cnt[1]).replace(/,/g, "");
          ok("crash", (!wantGap || panel.includes(gapTxt)) && !oldTxt && ksiOk,
            `counts ${cnt ? JSON.stringify(cnt) : "none for this block group"}; comparison ${a && a.p ? JSON.stringify(a.p) : "none"}` +
            (wantGap && !panel.includes(gapTxt) ? " | gap text missing" : "") + (oldTxt ? " | old unrewritten crash text shown" : "") + (!ksiOk ? ` | KSI row ${ksiRow[1]} != ${cnt[1]}` : ""));
        } else {
          const rebuiltTxt = /inside this block group or on its boundary streets/.test(panel);
          ok("crash", !rebuiltTxt, `no crash data for this county; page ${rebuiltTxt ? "SHOWS rebuilt crash text" : "shows no rebuilt crash text"}`);
        }
        // state laws in the block-group panel: only this state's records
        const lawsBlock = (panel.match(/Housing laws & rights:(.*?)(?:What this area|Underused land|$)/) || [, ""])[1];
        const shown = STATUTES.filter((r) => lawsBlock.includes(r.short_name || r.bill_number || r.id));
        const wrong = shown.filter((r) => r.state_code !== st).map((r) => r.id);
        const mine = STATUTES.filter((r) => r.state_code === st);
        const missing = mine.filter((r) => !lawsBlock.includes(r.short_name || r.bill_number || r.id)).map((r) => r.id);
        // ---- house panel
        await page.evaluate((ll) => (0, eval)("houseAt")(ll), { lat: P.lat, lng: P.lng });
        await page.waitForFunction(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); const box = document.querySelector("#house");
          return box && !box.querySelector(".house-loading") && (!ah || (ah.st && ah.st.rDone && ah.st.osmDone)); }, null, { timeout: 45000 }).catch(() => {});
        await page.waitForFunction(() => { const b = document.querySelector("#house"); return !b || !!b.querySelector("[data-live-facts]") || /Right-of-Way|did not answer|Couldn.t get this lot|No public parcel service/i.test(b.textContent); }, null, { timeout: 40000 }).catch(() => {});
        const grab = () => page.evaluate(() => {
          const b = document.querySelector("#house"), lf = b && b.querySelector("[data-live-facts]");
          return { house: b ? b.textContent.replace(/\s+/g, " ") : "", facts: lf ? [...lf.querySelectorAll(":scope > div")].map((d) => d.textContent.replace(/\s+/g, " ").trim()) : null,
            items: b ? [...b.querySelectorAll("ul.small > li")].map((li) => li.textContent.replace(/\s+/g, " ").trim()).filter((t) => t.includes(" — ")) : [] };
        });
        let { house, facts, items } = await grab();
        if (facts && facts.some((x) => /Not available \((Failed to fetch|timeout|HTTP)/i.test(x))) {
          // one retry: an agency that did not answer the browser is a transient miss, not a wrong value
          P.retried = facts.filter((x) => /Not available/.test(x)).map((x) => x.slice(0, 80));
          await page.evaluate((ll) => (0, eval)("houseAt")(ll), { lat: P.lat, lng: P.lng });
          await page.waitForTimeout(1500);
          await page.waitForFunction(() => { const b = document.querySelector("#house"); return !b || !!b.querySelector("[data-live-facts]") || /Right-of-Way|did not answer/i.test(b.textContent); }, null, { timeout: 40000 }).catch(() => {});
          ({ house, facts, items } = await grab());
        }
        P.house_checks = items;
        P.house_status = facts ? "house panel with live records" : /No public parcel service/i.test(house) ? "no parcel service for this county" : /No parcel found at this point|Right-of-Way/i.test(house) ? "no parcel at point" : /did not answer|Couldn.t get this lot/i.test(house) ? "parcel service did not answer" : "no house panel";
        const hard = HARDCODED_LAW.filter((re) => re.test(house)).map(String);
        // the house checks may name only this state's records
        const houseOther = STATUTES.filter((r) => r.state_code !== st && house.includes(r.short_name)).map((r) => r.id);
        // a lot whose use the service doesn't record must not be called non-residential (the label is "<service> parcel")
        const unknownAsNonRes = items.some((x) => / parcel, so residential homeowner checks do not apply/.test(x));
        ok("laws", !wrong.length && !missing.length && !hard.length && !houseOther.length && !unknownAsNonRes,
          `panel lists ${shown.length} record(s) for ${st}` + (wrong.length ? ` | OTHER-STATE records: ${wrong.join(", ")}` : "") + (missing.length ? ` | missing: ${missing.join(", ")}` : "") +
          (hard.length ? ` | hardcoded law claims in house panel: ${hard.join(" ; ")}` : "") + (houseOther.length ? ` | house panel names other-state records: ${houseOther.join(", ")}` : "") +
          (unknownAsNonRes ? " | unrecorded use shown as non-residential" : ""));
        const t = await tigerAt(P.lat, P.lng);
        if (facts) {
          const row = (label) => facts.find((x) => x.startsWith(label + ":") || x.startsWith(label + " ("));
          // Census area
          const ca = row("Census area");
          ok("census_area", !!(ca && t.county && t.bg && ca.includes(t.county.NAME) && ca.includes(t.bg)), `TIGERweb ${t.county ? t.county.NAME : "?"} · ${t.bg}; page "${ca || "row missing"}"`);
          // HUD
          const hr = row("HUD Fair Market Rent");
          const eh = t.county ? hudExpected(t.county.GEOID) : null;
          const hudOk = !!hr && (Array.isArray(eh) ? (eh[0] === eh[1] ? hr.includes(`2 bed $${eh[0].toLocaleString("en-US")}`) : hr.includes(`$${eh[0].toLocaleString("en-US")}–$${eh[1].toLocaleString("en-US")}`)) : eh != null && hr.includes(`2 bed $${eh.toLocaleString("en-US")}`));
          ok("hud", hudOk, `expected 2BR ${JSON.stringify(eh)} for ${t.county ? t.county.GEOID : "?"}; page "${(hr || "row missing").slice(0, 160)}"`);
          // FEMA
          const fr = row("FEMA flood zone");
          const fz = await fema(P.lat, P.lng);
          ok("fema", fz.error ? null : fz.zone ? !!fr && fr.includes(`Zone ${fz.zone}`) : !!fr && /No effective FEMA flood map|Not available/.test(fr), `FEMA now: ${fz.error ? "did not answer" : fz.zone || "unmapped"}; page "${(fr || "row missing").slice(0, 120)}"`);
          // USGS
          const er = row("Ground elevation");
          const ev = await usgs(P.lat, P.lng);
          ok("usgs", ev == null ? null : !!er && er.includes(`${ev.toLocaleString("en-US")} ft`), `USGS now: ${ev == null ? "no answer" : ev + " ft"}; page "${(er || "row missing").slice(0, 80)}"`);
        } else {
          for (const k of ["census_area", "hud", "fema", "usgs"]) ok(k, null, `not shown: ${P.house_status}`);
        }
        console.error(`${fips} ${bg} [${P.house_status}] ` + Object.entries(C).map(([k, v]) => `${k}:${v.pass === null ? "n/a" : v.pass ? "ok" : "FAIL"}`).join(" "));
        for (const [k, v] of Object.entries(C)) if (v.pass === false) console.error(`    ${k}: ${v.detail}`);
      }
      const keys = ["census_area", "hud", "fema", "usgs", "crash", "laws", "neighborhood", "canopy", "canopy_hud"];
      for (const k of keys) {
        const v = rec.points.map((p) => p.checks[k] && p.checks[k].pass);
        rec.checks[k] = v.some((x) => x === false) ? "fail" : v.some((x) => x === true) ? "pass" : "n/a";
      }
      rec.checks.console = rec.errors.length ? "fail" : "pass";
      await page.close();
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  const file = path.join(root, `data/backtests/live_check_panels_${new Date().toISOString().slice(0, 10)}${process.env.LIVE_SHARD ? "_" + process.env.LIVE_SHARD : ""}.json`);
  fs.writeFileSync(file, JSON.stringify({ ran_on: new Date().toISOString(), script: "scripts/live_check_panels.mjs", results: out }, null, 1));
  console.error("wrote", file);
}

// --recheck-fema <result.json ...>: re-open, one at a time, each point where the page said the FEMA row was "Not
// available" (FEMA timed out or dropped the connection while several browsers ran in parallel), and compare again.
// The first result is kept under fema_first.
async function recheckFema(files) {
  const srv = await serve();
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  try {
    for (const f of files) {
      const doc = JSON.parse(fs.readFileSync(f, "utf8"));
      for (const [fips, rec] of Object.entries(doc.results)) {
        for (const P of rec.points) {
          const na = (k) => P.checks[k] && P.checks[k].pass === false && /page "[^"]*Not available/.test(P.checks[k].detail);
          if (!na("fema") && !na("usgs")) continue;
          const page = await browser.newPage();
          await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
          await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
          await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
          if (fips !== "06037") {
            await page.evaluate((x) => (0, eval)("openCounty")(x), fips);
            await page.waitForFunction((x) => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === x) || false, fips, { timeout: 180000 }).catch(() => {});
          }
          await page.evaluate((ll) => (0, eval)("houseAt")(ll), { lat: P.lat, lng: P.lng });
          await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && (!!b.querySelector("[data-live-facts]") || /Right-of-Way|did not answer/i.test(b.textContent)); }, null, { timeout: 60000 }).catch(() => {});
          await page.waitForTimeout(1000);
          const rowOf = (label) => page.evaluate((l) => { const b = document.querySelector("#house [data-live-facts]"); const d = b && [...b.querySelectorAll(":scope > div")].map((x) => x.textContent.replace(/\s+/g, " ").trim()).find((x) => x.startsWith(l)); return d || null; }, label);
          if (na("fema")) {
            const fr = await rowOf("FEMA flood zone");
            const fz = await fema(P.lat, P.lng);
            P.checks.fema_first = P.checks.fema;
            P.checks.fema = { pass: fz.error ? null : fz.zone ? !!fr && fr.includes(`Zone ${fz.zone}`) : !!fr && /No effective FEMA flood map/.test(fr),
              detail: `re-checked alone: FEMA now ${fz.error ? "did not answer" : fz.zone || "unmapped"}; page "${(fr || "row missing").slice(0, 120)}"` };
            console.error(`${fips} ${P.bg} fema recheck: ${P.checks.fema.pass} ${P.checks.fema.detail}`);
          }
          if (na("usgs")) {
            const er = await rowOf("Ground elevation");
            const ev = await usgs(P.lat, P.lng);
            P.checks.usgs_first = P.checks.usgs;
            P.checks.usgs = { pass: ev == null ? null : !!er && er.includes(`${ev.toLocaleString("en-US")} ft`), detail: `re-checked alone: USGS now ${ev == null ? "no answer" : ev + " ft"}; page "${(er || "row missing").slice(0, 80)}"` };
            console.error(`${fips} ${P.bg} usgs recheck: ${P.checks.usgs.pass} ${P.checks.usgs.detail}`);
          }
          await page.close();
        }
        for (const k of ["fema", "usgs"]) {
          const v = rec.points.map((p) => p.checks[k] && p.checks[k].pass);
          rec.checks[k] = v.some((x) => x === false) ? "fail" : v.some((x) => x === true) ? "pass" : "n/a";
        }
      }
      doc.fema_rechecked_on = new Date().toISOString();
      fs.writeFileSync(f, JSON.stringify(doc, null, 1));
    }
  } finally {
    await browser.close();
    srv.kill();
  }
}

if (process.argv[2] === "--recheck-fema") recheckFema(process.argv.slice(3)).catch((e) => { console.error(e); process.exit(1); });
else main().catch((e) => { console.error(e); process.exit(1); });
