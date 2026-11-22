// Live check of "Riders, fares and the gap" in the Invest view's Transit card (real page, NOT part of CI).
//
// For each county it opens the real page, switches to Invest, opens every detail of the Transit card and reads each
// riders block. Independently, it recomputes every line in Node from the committed tables with the same engine
// (src/engines/transitDemandEngine.js) and checks that the page shows the same weekday riders, fare revenue, operating
// cost, gap and capital ranges, the same mode that fits, and no console or page errors. Screenshots of the card go to
// SHOT_DIR (default: none).
// Usage: LIVE_PORT=9141 SHOT_DIR=/path node scripts/live_check_transit_demand.mjs [fips ...]
//        (defaults: 48453 Travis TX, 17031 Cook IL, 48187 Guadalupe TX)  Writes data/backtests/live_check_transit_demand_<date>.json
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const T = require("../src/engines/transitDemandEngine.js");
const IDE = require("../src/engines/investmentDecisionEngine.js");
const PORT = Number(process.env.LIVE_PORT || 8897);
const SHOT = process.env.SHOT_DIR || null;
const fipsList = process.argv.slice(2).length ? process.argv.slice(2) : ["48453", "17031", "48187"];
const J = (f) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));
const files = { pipelines: J("transit_pipelines.json"), corridors: J("intercity_transit_corridors.json"), stops: J("transit_demand_stops.json") };
const tables = { model: J("transit_demand_model.json"), operating: J("transit_operating_benchmarks.json"), costRows: J("transit_cost_benchmarks.json").rows, funding: J("funding_programs.json"), thresholds: IDE.TRANSIT_THRESHOLDS };
const usd = (v) => Math.abs(v) >= 1e9 ? "$" + (v / 1e9).toFixed(1) + "B" : Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + Math.round(v).toLocaleString("en-US");
const cnt = (v) => Math.round(v).toLocaleString("en-US");

const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const out = [];
let failures = 0;
try {
  for (const fips of fipsList) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
    await page.waitForFunction((f) => window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f, fips, { timeout: 240000 });
    await page.click("#view-switch [data-view=invest]");
    await page.waitForSelector("#iv-transit", { timeout: 90000 });
    await page.evaluate(() => { const b = document.querySelector("[data-iv-budget='4']"); if (b) b.click(); });
    await page.waitForSelector("#iv-transit .iv-demand", { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll("#iv-transit details").forEach((d) => (d.open = true)));
    const blocks = await page.evaluate(() => [...document.querySelectorAll("#iv-transit .iv-demand")].map((b) => ({ id: b.getAttribute("data-line"), text: b.innerText })));
    const checks = [];
    for (const L of T.linesForCounty(fips, files, (c) => (typeof c.route_length_miles === "number" && !/^(unverified|could_not_check|corridor_not_confirmed)$/.test((c.verification || {}).status || "unverified") &&!(c.verification.unverified_fields || []).some((u) => String(u).split(/[\s(]/)[0] === "route_length_miles")) ? c.route_length_miles : null)) {
      const b = blocks.find((x) => x.id === L.id);
      const area = T.lineArea(L.stops) || {};
      const ev = L.kind === "pipeline" ? IDE.evaluateTransit(Object.assign({ name: L.name, lengthMiles: L.lengthMiles, mode: L.mode === "streetcar" ? "light_rail" : L.mode, demand: L }, area), { demandEngine: T, demandTables: tables }) : null;
      const sup = ev && ev.density.homesPerNetAcre.value != null ? ev.density.supports.map((s) => s.mode).concat(ev.density.supports.some((s) => s.buses_per_hour >= 6) ? ["brt"] : []) : null;
      const e = T.evaluateLine(L, tables, sup), p = e.proposed;
      const want = [];
      if (p && p.riders.weekday) want.push(`${cnt(p.riders.weekday.low)} to ${cnt(p.riders.weekday.high)} boardings a day`);
      for (const k of ["fareRevenue", "operatingCost", "operatingGap", "capitalCost"]) if (p && p[k]) want.push(`${usd(p[k].low)} to ${usd(p[k].high)}`);
      if (ev && ev.modeFit && ev.modeFit.fit) want.push(T.MODE_LABEL[ev.modeFit.fit]);
      const missingOnPage = b ? want.filter((w) => !b.text.includes(w)) : want;
      checks.push({ line: L.name, kind: L.kind, onPage: !!b, expected: want, missingOnPage, fit: ev && ev.modeFit ? ev.modeFit.fit : null, ok: !!b && !missingOnPage.length });
    }
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.locator("#iv-transit").screenshot({ path: path.join(SHOT, `transit_${fips}.png`) }); }
    const real = errors.filter((e) => !/crash_(gaps|counts)\/\d+\.json/.test(e) && !/^Failed to load resource: the server responded with a status of 404/.test(e));
    const bad = !checks.length || checks.some((c) => !c.ok) || real.length || /\bnull\b|NaN|undefined/.test(blocks.map((b) => b.text).join(" "));
    if (bad) failures++;
    out.push({ fips, lines: checks, errors: real, ok: !bad });
    console.log(fips, JSON.stringify(checks.map((c) => [c.line.slice(0, 40), c.ok ? "ok" : "DIFF " + c.missingOnPage.join(" | "), c.fit])), real.length ? "ERRORS " + real.slice(0, 2).join(" | ") : "no errors");
    await page.close();
  }
} finally {
  await browser.close();
  srv.kill();
}
const dir = path.join(root, "data/backtests");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `live_check_transit_demand_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(file, JSON.stringify({ ran: new Date().toISOString(), results: out }, null, 1));
console.log(failures ? `${failures} county check(s) differ` : "all checks agree", "->", path.relative(root, file));
process.exit(failures ? 1 : 0);
