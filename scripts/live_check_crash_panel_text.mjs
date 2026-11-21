// Reads the crash sentences the real page shows for given block groups (scripts/serve.mjs, real county files), so a
// rebuild of app/data/crash_counts can be seen on the page: the count, the rule text of that county's file, and the
// "killed or seriously injured" row. Not part of CI.
// Usage: LIVE_PORT=9311 node scripts/live_check_crash_panel_text.mjs <block group GEOID> ...
//        (writes data/backtests/live_check_crash_panel_text_<date>[_$LIVE_SHARD].json)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8898);
const bgs = process.argv.slice(2).filter((a) => /^\d{12}$/.test(a));
const server = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
const out = {};
try {
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
  await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
  for (const bg of bgs) {
    const fips = bg.slice(0, 5);
    const loaded = await page.evaluate(() => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips) || null);
    if (loaded !== fips) {
      await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
      await page.waitForFunction((f) => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f) || false, fips, { timeout: 180000 });
    }
    const file = JSON.parse(fs.readFileSync(path.join(root, "app/data/crash_counts", `${fips}.json`), "utf8"));
    await page.evaluate((id) => (0, eval)("select")(id, false), bg);
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => (document.querySelector("#panel")?.textContent || ""));
    const pieces = [];
    for (const re of [/\d[\d,]*(?:\.\d)? (?:injury or fatal )?crash(?:es)? recorded inside this block group or on its boundary streets[^)]*\)[^)]*\)/g,
      /Crashes with someone killed or seriously injured, inside or on boundary streets\s*[\d.,]+/g,
      /[^.;]{0,80}(counts 1\/k in each|older rule)[^)]{0,160}/g]) {
      for (const m of text.matchAll(re)) if (!pieces.includes(m[0].trim())) pieces.push(m[0].trim());
    }
    const shownN = (v) => (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1));   // the page's crashN
    const c = file[bg];
    const want = Array.isArray(c) ? `${shownN(c[2])} ` : null;
    out[bg] = { file_counts: c || null, count_sentence_matches_file: want ? pieces.some((x) => x.startsWith(want) && x.includes(`: ${shownN(c[0])} involving`)) : null, file_weighting: file._meta.weighting || null, shown: pieces,
      rule_1k_shown: /counts 1\/k in each/.test(text), older_rule_shown: /older rule/.test(text) };
    console.log(bg, JSON.stringify(out[bg]).slice(0, 400));
  }
  await browser.close();
} finally {
  server.kill();
}
const f = path.join(root, `data/backtests/live_check_crash_panel_text_${new Date().toISOString().slice(0, 10)}${process.env.LIVE_SHARD ? "_" + process.env.LIVE_SHARD : ""}.json`);
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log("wrote", f);
