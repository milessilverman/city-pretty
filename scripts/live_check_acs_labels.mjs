// Live check: on the real page, a block group whose ACS rent or home value is the tract's median (the block group's own is
// suppressed by the Census) shows that value with the tract label, and a block group with its own figure shows none.
// Each value shown is compared with the Census Bureau's ACS 2020-24 summary files, read here separately from the page.
//
// Usage: NODE_USE_ENV_PROXY=1 node scripts/live_check_acs_labels.mjs <acs cache dir> [fips ...]
//   (the cache dir holds acsdt5y2024-b25077.dat and acsdt5y2024-b25064.dat, as scripts/build_acs_fallback_flags.py leaves them)
// Env: LIVE_PORT (default 8869), LIVE_N block groups per kind per county (default 3).
// Writes data/backtests/live_check_acs_labels_<date>.json.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8869), N = Number(process.env.LIVE_N || 3);
const [cache, ...want] = process.argv.slice(2);
if (!cache) { console.error("usage: live_check_acs_labels.mjs <acs cache dir> [fips ...]"); process.exit(2); }
const LABEL = "tract median; the block group's is suppressed by the Census";
const FLAGS = JSON.parse(fs.readFileSync(path.join(root, "app/data/acs_fallback_flags.json"), "utf8")).counties;

function readTable(t, prefix) {
  const bg = new Map(), tract = new Map();
  for (const line of fs.readFileSync(path.join(cache, `acsdt5y2024-${t}.dat`), "utf8").split("\n")) {
    const [g, v] = line.split("|");
    if (!g) continue;
    if (g.startsWith("1500000US" + prefix)) bg.set(g.slice(9), +v);
    else if (g.startsWith("1400000US" + prefix)) tract.set(g.slice(9), +v);
  }
  return { bg, tract };
}
const fmt = (v) => "$" + Math.round(v).toLocaleString("en-US");

const counties = want.length ? want : ["02020", "17031"];
const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
const out = { ran_on: new Date().toISOString(), script: "scripts/live_check_acs_labels.mjs", label: LABEL, counties: {} };
let fail = 0;
try {
  for (const fips of counties) {
    const R = { rent: readTable("b25064", fips), hv: readTable("b25077", fips) };
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
    await page.waitForFunction((f) => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f), fips, { timeout: 180000 });
    await page.waitForFunction(() => { try { return !!(0, eval)("ACS_FALLBACK_FLAGS"); } catch { return false; } }, null, { timeout: 60000 });
    const ids = await page.evaluate(() => window.D_OC.features.map((f) => f.properties.id));
    const F = FLAGS[fips] || {};
    const tractRent = (F.rent_tract || []).map((s) => fips + s).filter((id) => ids.includes(id));
    const ownRent = ids.filter((id) => { const b = R.rent.bg.get(id); return b > 0 && b < 3501 && !(F.rent_tract || []).includes(id.slice(5)); });
    const pick = (a) => a.filter((_, i) => i % Math.max(1, Math.floor(a.length / N)) === 0).slice(0, N);
    const rows = [];
    for (const [kind, list] of [["tract", pick(tractRent)], ["own", pick(ownRent)]]) {
      for (const id of list) {
        const t = await page.evaluate((id) => { (0, eval)("select")(id, false); return document.querySelector("#panel").innerText; }, id);
        const census = kind === "tract" ? R.rent.tract.get(id.slice(0, 11)) : R.rent.bg.get(id);
        const bgPublished = R.rent.bg.get(id);
        const shown = t.includes(fmt(census));
        const labeled = new RegExp(fmt(census).replace(/[$]/g, "\\$") + "[\\s\\S]{0,80}" + LABEL.replace(/[.*+?^${}()|[\]\\']/g, "\\$&")).test(t);
        const anyLabel = t.includes(LABEL);
        const ok = kind === "tract" ? (bgPublished < 0 && shown && labeled) : (shown && !labeled);
        if (!ok) fail++;
        rows.push({ id, kind, census_bg: bgPublished, census_value: census, shown, labeled, any_label_in_panel: anyLabel, ok });
        console.log(fips, id, kind, "rent", fmt(census), ok ? "OK" : JSON.stringify({ shown, labeled, bgPublished }));
      }
    }
    out.counties[fips] = { rows, page_errors: errors };
    if (errors.length) { fail++; console.log(fips, "page errors", errors); }
    await page.close();
  }
} finally {
  await browser.close();
  srv.kill();
}
const file = path.join(root, "data/backtests", `live_check_acs_labels_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(fail ? `${fail} failed` : "all ok", "; wrote", file);
process.exit(fail ? 1 : 0);
