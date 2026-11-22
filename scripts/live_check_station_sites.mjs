// Live check (not CI): the Invest view's "Properties" card and the project cards' site subjects show station-area sites
// (app/data/station_sites/, src/engines/stationSites.js) on the real page, for three kinds of place:
//   a county with a local project that has stations on file (default Travis, Austin light rail),
//   a county reached through a corridor stop city (default Davidson, Nashville), and
//   a county where the sites come from existing rail stations (default Dallas).
// For each it opens the county, switches to Invest at the largest budget, opens the first station site and its card, records the
// text and the counts, checks that no home count, value-if-built or margin appears on a station site, and saves a screenshot.
//
// Usage: LIVE_PORT=9181 NODE_USE_ENV_PROXY=1 node scripts/live_check_station_sites.mjs [outDir] [fips:key,fips:key,fips:key]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8898);
const outDir = process.argv[2] || path.join(root, "data/backtests");
const places = (process.argv[3] || "48453:pipeline_austin,47037:corridor_nashville,48113:existing_dallas").split(",").map((s) => s.split(":"));
fs.mkdirSync(outDir, { recursive: true });
const result = { run_on: new Date().toISOString(), port: PORT, places: {} };

const server = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
try {
  for (const [fips, key] of places) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    await page.evaluate((f) => (window).openCounty(f), fips);
    await page.waitForFunction((f) => (window).D_OC?.meta?.fips === f && (window).activeCounty === "oc", fips, { timeout: 120000 });
    await page.click("#view-switch [data-view=invest]");
    await page.waitForSelector("#iv-sites", { timeout: 90000 });
    await page.click("[data-iv-budget='4']");   // $50M or more: site-sized and corridor-sized plays are listed
    const ok = await page.waitForFunction(() => /measured from OpenStreetMap and the county parcel record/.test((document.querySelector("#iv-sites") || {}).innerText || ""), null, { timeout: 60000 }).then(() => true).catch(() => false);
    await page.waitForFunction(() => !document.querySelector("#iv-courses .iv-loading"), null, { timeout: 60000 }).catch(() => {});
    if (ok) await page.evaluate(() => { const d = document.querySelector("#iv-sites .iv-row details"); if (d) d.open = true; document.querySelectorAll("#iv-courses .pc-card[data-pc-subject=site]").forEach((c, i) => { if (i < 2) c.open = true; }); });
    const info = await page.evaluate(() => {
      const sites = document.querySelector("#iv-sites"), text = sites ? sites.innerText : "";
      const rows = [...document.querySelectorAll("#iv-sites .iv-row")].map((r) => r.querySelector(".iv-row-name")?.innerText.replace(/\s+/g, " ").trim());
      const st = (window).cpInvest.courses, cards = (st.cards && st.cards.cards) || [];
      const siteCards = cards.filter((c) => c.subject.kind === "site" && /^ss:/.test(c.subject.id));
      const ss = (window).StationSites;
      const fips = (window).D_OC?.meta?.fips;
      const list = (ss && ss.cached(fips)) || [];
      return {
        county: (window).D_OC?.meta?.county, loaded: list.length, total: list.total || null, leftOut: list.leftOut || 0, listedRows: rows.length, firstRows: rows.slice(0, 6),
        note: (text.match(/Includes[^.]*\./) || [null])[0], cardsOnPage: cards.length, stationSiteCards: siteCards.length,
        cardSubjects: siteCards.slice(0, 3).map((c) => ({ id: c.subject.id, name: c.subject.name, acres: c.subject.acres && c.subject.acres.value, railStationMi: c.subject.railStationMi == null ? null : +c.subject.railStationMi.toFixed(2),
          courses: c.courses.map((x) => x.label), notAssessed: c.notAssessed.slice(0, 3).map((n) => n.label + ": " + n.missing[0]) })),
        homesOrMarginOnStationSite: list.some((s) => ["potentialHomes", "margin", "marketLandValue"].some((k) => s[k] != null)),
        text: text.slice(0, 2600), badText: (text.match(/\bnull\b|NaN|undefined/g) || []).length,
      };
    });
    const el = page.locator("#iv-sites");
    await el.scrollIntoViewIfNeeded();
    info.screenshot = path.join(outDir, `station_sites_${key}.png`);
    await el.screenshot({ path: info.screenshot });
    const cardEl = page.locator("#iv-courses .pc-card[data-pc-subject=site]").first();
    if (await cardEl.count()) { await cardEl.scrollIntoViewIfNeeded(); info.cardScreenshot = path.join(outDir, `station_sites_${key}_card.png`); await cardEl.screenshot({ path: info.cardScreenshot }); }
    info.errors = errors; info.shown = ok;
    result.places[key] = Object.assign({ fips }, info);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const f = path.join(outDir, `live_check_station_sites_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(f, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
console.log("wrote " + f);
