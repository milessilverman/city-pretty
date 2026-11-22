// Live check (not CI): the place rows of the station-site project cards on the real page (Invest view, "Courses of
// action"): HUD QCT / DDA status and the 130% basis, the county's declared permit value per new home, the tax-credit rent
// ceilings and HUD Fair Market Rents. For each county it opens Invest, waits for the station sites and their tract file,
// opens the first two station-site cards, records the rows' text, checks that no "NaN", "undefined" or "null" appears,
// and that every dollar figure in the place rows is one of the card's own sourced figures; saves screenshots.
//
// Usage: LIVE_PORT=9241 NODE_USE_ENV_PROXY=1 node scripts/live_check_site_cards.mjs [outDir] [key:fips,...]
//   (default los_angeles:06037 (the page's opening county), travis:48453, cook:17031)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8898);
const outDir = process.argv[2] || path.join(root, "data/backtests");
const places = (process.argv[3] || "los_angeles:06037,travis:48453,cook:17031").split(",").map((s) => s.split(":"));
fs.mkdirSync(outDir, { recursive: true });
const result = { run_on: new Date().toISOString(), port: PORT, places: {} };

const server = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
try {
  for (const [key, fips] of places) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    if (fips !== "06037") {
      await page.evaluate((f) => (window).openCounty(f), fips);
      await page.waitForFunction((f) => (window).D_OC?.meta?.fips === f && (window).activeCounty === "oc", fips, { timeout: 120000 });
    }
    await page.click("#view-switch [data-view=invest]");
    await page.waitForSelector("#iv-courses .pc-card, #iv-courses .pc-fit", { timeout: 90000 });
    await page.click("[data-iv-budget='4']").catch(() => {});
    const ok = await page.waitForFunction(() => {
      const st = (window).cpInvest && (window).cpInvest.courses, cards = (st && st.cards && st.cards.cards) || [];
      return cards.some((c) => c.subject.kind === "site" && /^ss:/.test(c.subject.id) && (c.placeFacts || []).some((p) => p.id === "qct_dda" && p.status !== "not on file"));
    }, null, { timeout: 90000 }).then(() => true).catch(() => false);
    await page.evaluate(() => { document.querySelectorAll("#iv-courses .pc-card[data-pc-subject=site]").forEach((c, i) => { if (i < 2) c.open = true; }); });
    const info = await page.evaluate(() => {
      const st = (window).cpInvest.courses, cards = (st.cards && st.cards.cards) || [];
      const els = [...document.querySelectorAll("#iv-courses .pc-card[data-pc-subject=site]")];
      const out = [];
      cards.filter((c) => c.subject.kind === "site").forEach((c, i) => {
        const el = els[i], placeEl = el ? el.querySelector(".pc-place") : null, text = placeEl ? placeEl.innerText : "";
        // every dollar amount in the place rows must be one of the card's own figures (rounded as the page rounds)
        const own = new Set();
        for (const p of c.placeFacts || []) {
          for (const r of [p.range, p.at50]) if (r) { own.add(Math.round(r.low.value)); own.add(Math.round(r.high.value)); }
          for (const y of p.rows || []) own.add(y.value);
          if (p.limits) for (const v of p.limits.il60.concat(p.limits.il50)) own.add(v);
          if (p.id === "fmr" && p.detail) for (const m of p.detail.matchAll(/\$([\d,]+)/g)) own.add(+m[1].replace(/,/g, ""));
        }
        const dollars = [...text.matchAll(/\$([\d,]+)/g)].map((m) => +m[1].replace(/,/g, ""));
        const strays = dollars.filter((v) => !own.has(v));
        if (i < 6) out.push({ id: c.subject.id, name: c.subject.name, open: !!(el && el.open), place: c.subject && c.placeFacts ? c.placeFacts.map((p) => p.id === "qct_dda" ? { id: p.id, status: p.status, boost: p.boost, tract: p.tract, zcta: p.zcta, years: (p.years || []).map((y) => y.year + ": QCT " + y.qct + ", DDA " + y.dda) } : { id: p.id, range: p.range ? [Math.round(p.range.low.value), Math.round(p.range.high.value), p.range.basis, p.range.source] : null, why: p.why }) : null,
          dollarsShown: dollars.length, dollarsNotOnTheCard: strays, badText: (text.match(/\bnull\b|NaN|undefined/g) || []).length, text: text.slice(0, 1800) });
      });
      const all = document.querySelector("#iv-courses") ? document.querySelector("#iv-courses").innerText : "";
      return { county: ((window).D_OC && (window).D_OC.meta && (window).D_OC.meta.county) || "Los Angeles (opening county)", siteCards: cards.filter((c) => c.subject.kind === "site").length, stationSiteCards: cards.filter((c) => /^ss:/.test(c.subject.id || "")).length, cards: out,
        sectionBadText: (all.match(/\bnull\b|NaN|undefined/g) || []).length };
    });
    const cardEl = page.locator("#iv-courses .pc-card[data-pc-subject=site]").first();
    if (await cardEl.count()) { await cardEl.scrollIntoViewIfNeeded(); info.screenshot = path.join(outDir, `site_cards_${key}.png`); await cardEl.screenshot({ path: info.screenshot }); }
    const placeEl = page.locator("#iv-courses .pc-card[data-pc-subject=site] .pc-place").first();
    if (await placeEl.count()) { info.placeScreenshot = path.join(outDir, `site_cards_${key}_place.png`); await placeEl.screenshot({ path: info.placeScreenshot }); }
    info.errors = errors; info.placeRowsShown = ok;
    result.places[key] = Object.assign({ fips }, info);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const f = path.join(outDir, `live_check_site_cards_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(f, JSON.stringify(result, null, 1));
for (const [k, v] of Object.entries(result.places)) console.log(k, JSON.stringify({ shown: v.placeRowsShown, siteCards: v.siteCards, stationSiteCards: v.stationSiteCards, sectionBadText: v.sectionBadText, errors: v.errors, cards: v.cards.slice(0, 2).map((c) => ({ id: c.id, open: c.open, bad: c.badText, strays: c.dollarsNotOnTheCard, dollars: c.dollarsShown, place: c.place })) }, null, 1));
console.log("wrote " + f);
