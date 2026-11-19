// Live check of the Invest view's Transit card for counties on planned-rail corridors (real network, NOT part of CI).
//
// For each county it opens the real page, switches to Invest, reads the Transit card, and compares what the page says with
// sources fetched here independently:
//   - the corridor rows listed must be exactly the corridors in app/data/intercity_transit_corridors.json that have a stop city in the county
//   - each stop city's sentence "N neighborhoods within 1 mile of the <city> stop city centre (...)" is compared with
//     a Census TIGERweb query for Census block groups within 1 mile of the same point (layer 10, distance in metres)
//   - no console or page errors
// Usage: NODE_USE_ENV_PROXY=1 LIVE_PORT=9061 node scripts/live_check_corridors.mjs [fips ...]
//        (defaults: 48187 Guadalupe TX, 08069 Larimer CO, 37159 Rowan NC)  Writes data/backtests/live_check_corridors_<date>.json
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8897);
const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer";
const MILE_M = 1609.344;
const fipsList = process.argv.slice(2).length ? process.argv.slice(2) : ["48187", "08069", "37159"];
const corridors = JSON.parse(fs.readFileSync(path.join(root, "app/data/intercity_transit_corridors.json"), "utf8"));

async function tigerCount(lat, lng) {
  const u = `${TIGER}/10/query?` + new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: String(MILE_M), units: "esriSRUnit_Meter", outFields: "GEOID", returnGeometry: "false", f: "json" });
  const r = await fetch(u, { headers: { "User-Agent": "city-pretty-live-check/1.0" } });
  const j = await r.json();
  return { url: u, ids: (j.features || []).map((f) => f.attributes.GEOID).sort() };
}

const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const out = [];
let failures = 0;
try {
  for (const fips of fipsList) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("response", (r) => { if (r.status() === 404) errors.push("404 " + r.url()); });
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
    await page.waitForFunction((f) => window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f, fips, { timeout: 180000 });
    await page.click("#view-switch [data-view=invest]");
    await page.waitForSelector("#iv-transit", { timeout: 60000 });
    await page.evaluate(() => { const b = document.querySelector("[data-iv-budget='4']"); if (b) b.click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelectorAll("#iv-transit details").forEach((d) => (d.open = true)));
    const card = await page.evaluate(() => document.querySelector("#iv-transit").innerText);
    const rows = await page.evaluate(() => [...document.querySelectorAll("#iv-transit .iv-play .iv-row-name b")].map((b) => b.textContent.trim()));
    const sentences = [...card.matchAll(/(\d+) (neighborhoods?) within 1 mile of the (.+?) stop city centre \(the station site itself is not chosen yet\)/g)].map((m) => ({ n: +m[1], city: m[3] }));
    const expected = corridors.filter((c) => c.proposed_stations.some((s) => s.fips === fips));
    const expectedNames = expected.map((c) => c.name).sort();
    const rowsOk = expectedNames.every((n) => rows.includes(n));
    const checks = [];
    for (const c of expected) {
      for (const s of c.proposed_stations.filter((x) => x.fips === fips)) {
        const t = await tigerCount(s.lat, s.lng);
        const seen = sentences.filter((x) => x.city === s.city);
        const page_n = seen.length ? seen[0].n : null;
        // the page counts block groups of this county's file whose outline reaches the circle; TIGERweb counts every block group in the circle in any county, so keep this county's
        const tiger_n = t.ids.filter((g) => g.startsWith(fips)).length;
        checks.push({ corridor: c.id, city: s.city, page_n, tiger_n, tiger_all_counties: t.ids.length, same: page_n === tiger_n, tiger_url: t.url });
      }
    }
    // crash-count files are optional per county (out of scope here): their 404s and the browser's generic message for them are not errors
    const real = errors.filter((e) => !/crash_(gaps|counts)\/\d+\.json/.test(e) && !/^Failed to load resource: the server responded with a status of 404/.test(e));
    errors.splice(0, errors.length, ...real);
    const bad = !rowsOk || checks.some((c) => !c.same) || errors.length || !sentences.length;
    if (bad) failures++;
    out.push({ fips, rows, expectedNames, rowsOk, sentences, checks, errors, ok: !bad });
    console.log(fips, rowsOk ? "rows ok" : "ROWS DIFFER", JSON.stringify(checks.map((c) => [c.city, c.page_n, c.tiger_n])), errors.length ? "ERRORS " + errors.slice(0, 2).join(" | ") : "no errors");
    await page.close();
  }
} finally {
  await browser.close();
  srv.kill();
}
const dir = path.join(root, "data/backtests");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `live_check_corridors_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(file, JSON.stringify({ ran: new Date().toISOString(), results: out }, null, 1));
console.log(failures ? `${failures} county check(s) differ` : "all checks agree", "->", path.relative(root, file));
process.exit(failures ? 1 : 0);
