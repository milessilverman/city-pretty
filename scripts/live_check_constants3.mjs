// Live check for the round-3 page-constants fixes (docs/audit/appjs-constants-round3.md), on the real page with live
// data: the neighborhood panel shows no "Joint Value Created" or displacement index, the map metric menu has no
// displacement option, and on real house clicks (points from a live_check_panels run) "How is this estimated?" lists
// only recorded facts, with none of the removed premiums or the "calibrated" claim.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/live_check_constants3.mjs <live_check_panels json> [fips ...]
// Env: LIVE_PORT (default 8870). Writes data/backtests/live_check_constants3_<date>.json
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8870);
const [pointsFile, ...want] = process.argv.slice(2);
if (!pointsFile) { console.error("usage: live_check_constants3.mjs <live_check_panels json> [fips ...]"); process.exit(2); }
const PTS = JSON.parse(fs.readFileSync(pointsFile, "utf8"));
const RES = PTS.results || PTS;
const BANNED = /Site Land Value|Calibrated against county assessor|Lot Premium|Pool Premium|Age Factor|which we index to 2026|Joint Value Created|Renter Displacement Sensitivity Index/;

const busy = (p) => new Promise((r) => { const s = net.connect(p, "127.0.0.1"); s.on("connect", () => { s.destroy(); r(true); }); s.on("error", () => r(false)); });
if (await busy(PORT)) { console.error(`port ${PORT} is in use; set LIVE_PORT`); process.exit(2); }
const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore", env: process.env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
const out = { ran_on: new Date().toISOString(), script: "scripts/live_check_constants3.mjs", counties: {} };
let fails = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
  await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 180000 });
  out.metric_option_present = await page.evaluate(() => !!document.querySelector('#metric option[value="displacement"]'));
  if (out.metric_option_present) fails++;
  for (const fips of (want.length ? want : Object.keys(RES))) {
    const rec = { neighborhood: null, houses: [] };
    out.counties[fips] = rec;
    if (fips !== "06037") {
      await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
      await page.waitForFunction((f) => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f) || false, fips, { timeout: 180000 }).catch(() => {});
    } else {
      await page.evaluate(() => (0, eval)("switchCounty")("la"));
      await page.waitForTimeout(3000);
    }
    rec.neighborhood = await page.evaluate((F) => {
      const ev = (s) => (0, eval)(s);
      // a county opened with openCounty keeps its block groups in D_OC (bgs.features or features); LA's are in D
      const oc = window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === F ? window.D_OC : null;
      const src = oc || ev("D");
      const ids = ((src.bgs && src.bgs.features) || src.features || []).map((f) => f.properties.id).filter((id) => String(id).startsWith(F)).slice(0, 400);
      for (const id of ids) {
        try { ev("select")(id, false); } catch (e) { continue; }
        const t = document.querySelector("#panel")?.innerText || "";
        if (/Paying projects/.test(t)) return { bg: id, has_tiles: true, not_modeled_tile: /Home value created together/.test(t), banned: (t.match(/Joint Value Created|Renter Displacement Sensitivity Index|neighborhood lift/g) || []) };
      }
      return { bg: null, has_tiles: false, checked: ids.length };
    }, fips);
    if (rec.neighborhood.has_tiles && (rec.neighborhood.banned.length || !rec.neighborhood.not_modeled_tile)) fails++;
    for (const p of ((RES[fips] || {}).points || [])) {
      await page.evaluate((ll) => (0, eval)("houseAt")(ll), { lat: p.lat, lng: p.lng });
      await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && !b.querySelector(".house-loading") && /Estimated market value|Couldn't get this lot|No public parcel service/.test(b.innerText); }, null, { timeout: 60000 }).catch(() => {});
      const h = await page.evaluate(() => document.querySelector("#house")?.innerHTML || "");
      const row = { bg: p.bg, lat: p.lat, lng: p.lng, estimate_block: /data-valuation-inputs/.test(h), recorded_facts: /Recorded facts for this lot/.test(h), banned: (h.match(BANNED) || []).slice(0, 3) };
      row.ok = !row.banned.length && (!row.estimate_block || row.recorded_facts);
      if (!row.ok) fails++;
      rec.houses.push(row);
      console.log(fips, p.bg, row.estimate_block ? "estimate shown" : "no estimate block", row.ok ? "OK" : "FAIL " + JSON.stringify(row.banned));
    }
    console.log(fips, "neighborhood", JSON.stringify(rec.neighborhood));
  }
  out.page_errors = errors;
  if (errors.length) fails++;
} finally {
  await browser.close();
  srv.kill();
}
out.fails = fails;
const file = path.join(root, `data/backtests/live_check_constants3_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(fails ? `${fails} failed` : "all ok", "; metric option present:", out.metric_option_present, "; wrote", file);
