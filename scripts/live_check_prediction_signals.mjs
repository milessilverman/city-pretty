// Live check of the price-prediction test panel and the per-area trends in the Invest view (real page, NOT part of CI).
//
// For each county it opens the real page, switches to Invest, opens "How this was tested" and every listed area's
// details, and checks against the committed files, read independently here:
//   - the panel says the prediction was tested and is not shown (app/data/neighborhood_prediction_holdout.json has
//     decision.pass false), and shows one table row per method and horizon with the stored top-decile numbers;
//   - no area shows a forecast; each listed area's trends equal its tract's row in app/data/neighborhood_signals/<st>.json
//     (price change 2020-25 and 2024-25, jobs 2024, jobs change, county permits 2021-2025) or say Not on file;
//   - no console or page errors, and no "null", "NaN" or "undefined" in the text.
// Usage: LIVE_PORT=9291 SHOT_DIR=/path node scripts/live_check_prediction_signals.mjs [fips ...]
//        (defaults: 48453 Travis TX, 17031 Cook IL, 26163 Wayne MI)  Writes data/backtests/live_check_prediction_signals_<date>.json
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8897);
const SHOT = process.env.SHOT_DIR || null;
const fipsList = process.argv.slice(2).length ? process.argv.slice(2) : ["48453", "17031", "26163"];
const J = (f) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));
const summary = J("neighborhood_prediction_holdout.json");
const n1 = (x) => (x >= 0 ? "+" : "") + x.toFixed(1);
const pct = (x) => (x >= 0 ? "+" : "") + x.toFixed(1) + "%";

const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const out = [];
let failures = 0;
try {
  for (const fips of fipsList) {
    const sig = J(`neighborhood_signals/${fips.slice(0, 2)}.json`);
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
    await page.waitForSelector("#iv-where", { timeout: 90000 });
    await page.waitForFunction(() => !document.querySelector(".iv-signals") || ![...document.querySelectorAll(".iv-signals")].some((x) => /loading/.test(x.textContent)), null, { timeout: 60000 }).catch(() => {});
    // late files (station sites, the signal file) re-render the view once or twice; wait until the page is quiet
    await page.evaluate(() => new Promise((res) => { let t; const o = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, 1500); }); const done = () => { o.disconnect(); res(); }; o.observe(document.body, { childList: true, subtree: true }); t = setTimeout(done, 1500); }));
    await page.evaluate(() => document.querySelectorAll("#iv-where details, .iv-head details").forEach((d) => (d.open = true)));
    const got = await page.evaluate(() => ({
      panel: document.querySelector("#iv-predtest")?.innerText || "",
      rows: [...document.querySelectorAll("#iv-predtest tbody tr")].map((r) => [...r.cells].map((c) => c.innerText)),
      areas: [...document.querySelectorAll("#iv-where .iv-signals")].map((b) => ({ tract: b.getAttribute("data-tract"), text: b.innerText })),
      where: document.querySelector("#iv-where")?.innerText || "",
    }));
    const checks = [];
    checks.push({ what: "panel says tested, not shown", ok: summary.decision.pass === false && /tested, not shown/.test(got.panel) && /did not beat/.test(got.panel) });
    const want = [];
    for (const h of ["3", "5"]) for (const m of summary.results[h].methods) want.push([`${h} years`, m.label, `${n1(m.top_decile)} (${n1(m.top_decile_ci95[0])} to ${n1(m.top_decile_ci95[1])})`]);
    const rowOk = want.every((w) => got.rows.some((r) => r[0] === w[0] && r[1] === w[1] && r[2] === w[2]));
    checks.push({ what: `table rows (${want.length} expected, ${got.rows.length} shown) match the stored numbers`, ok: rowOk && got.rows.length === want.length });
    checks.push({ what: "no forecast wording in the areas", ok: !/predicted|forecast range|will rise/i.test(got.where.replace(/not a forecast/gi, "")) });
    let areaBad = 0;
    for (const a of got.areas) {
      const row = sig.tracts[a.tract];
      const expect = [];
      if (row) {
        expect.push(row[0] != null ? `2020 to 2025: ${pct(row[0])}` : "2020 to 2025: Not on file");
        expect.push(row[1] != null ? `2024 to 2025: ${pct(row[1])}` : "2024 to 2025: Not on file");
        expect.push(row[2] != null ? `2024: ${row[2].toLocaleString("en-US")}` : "2024: Not on file");
        expect.push(row[3] != null ? `2022 to 2024: ${pct(row[3])}` : "2022 to 2024: Not on file");
      } else expect.push("Not on file");
      const per = sig.counties[fips];
      if (per) expect.push(`2021: ${per[0] == null ? "-" : per[0].toLocaleString("en-US")}`, `2025: ${per[4] == null ? "-" : per[4].toLocaleString("en-US")}`);
      const miss = expect.filter((e) => !a.text.includes(e));
      if (miss.length) areaBad++;
      checks.push({ what: `area tract ${a.tract}`, ok: !miss.length, missing: miss });
    }
    checks.push({ what: `areas with trends shown: ${got.areas.length}`, ok: got.areas.length > 0 });
    if (SHOT) {
      fs.mkdirSync(SHOT, { recursive: true });
      await page.locator("#iv-predtest").screenshot({ path: path.join(SHOT, `predtest_${fips}.png`) });
      const first = page.locator("#iv-where .iv-signals").first();
      if (await first.count()) await first.screenshot({ path: path.join(SHOT, `signals_${fips}.png`) });
    }
    const real = errors.filter((e) => !/crash_(gaps|counts)\/\d+\.json/.test(e) && !/^Failed to load resource: the server responded with a status of 404/.test(e));
    const text = got.panel + " " + got.areas.map((a) => a.text).join(" ");
    const bad = checks.some((c) => !c.ok) || real.length || /\bnull\b|NaN|undefined/.test(text);
    if (bad) failures++;
    out.push({ fips, checks, errors: real, ok: !bad });
    console.log(fips, bad ? "FAIL" : "ok", JSON.stringify(checks.filter((c) => !c.ok)), `areas ${got.areas.length}`, real.length ? "ERRORS " + real.slice(0, 2).join(" | ") : "no errors");
    await page.close();
  }
} finally {
  await browser.close();
  srv.kill();
}
const dir = path.join(root, "data/backtests");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `live_check_prediction_signals_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(file, JSON.stringify({ checked: new Date().toISOString(), counties: out, failures }, null, 1));
console.log("wrote", path.relative(root, file), "failures", failures);
process.exit(failures ? 1 : 0);
