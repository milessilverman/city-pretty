// Live check (not CI): station-site zoning on the real page (Invest view, "Courses of action"). For each county it opens
// Invest, waits for the station sites and their zoning file, shows all sites, and opens the first two station-site cards
// plus (where any exist) the first two whose small-multifamily course has a home count. It records each opened card's
// zoning fact, legal basis, homes and cost as the page shows them, checks that no "NaN", "undefined" or "null" appears,
// that every home count and dollar figure shown in the opened cards' building courses is one of the card's own figures,
// and saves screenshots.
//
// Usage: LIVE_PORT=9251 NODE_USE_ENV_PROXY=1 node scripts/live_check_site_zoning.mjs [outDir] [key:fips,...]
//   (default travis:48453, los_angeles:06037, kings:36047, san_diego:06073)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 9251);
const outDir = process.argv[2] || path.join(root, "data/backtests");
const places = (process.argv[3] || "travis:48453,los_angeles:06037,kings:36047,san_diego:06073").split(",").map((s) => s.split(":"));
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
    const zoned = await page.waitForFunction((f) => {
      const SS = (window).StationSites, list = SS && SS.cached(f);
      return !!(list && list.some((s) => s.zoning));
    }, fips, { timeout: 90000 }).then(() => true).catch(() => false);
    // re-render after the zoning file lands, then show every site
    await page.evaluate(() => { const b = document.querySelector("[data-pc=all-sites]"); if (b && !/largest/.test(b.textContent)) b.click(); });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const st = (window).cpInvest.courses, cards = ((st.cards && st.cards.cards) || []).filter((c) => c.subject.kind === "site");
      const els = [...document.querySelectorAll("#iv-courses .pc-card[data-pc-subject=site]")];
      const station = cards.map((c, i) => ({ c, i })).filter((x) => /^ss:/.test(x.c.subject.id || ""));
      const sized = station.filter((x) => x.c.courses.some((k) => k.course !== "hold" && k.size && k.size.units));
      const pick = [...new Set(station.slice(0, 2).concat(sized.slice(0, 2)).map((x) => x.i))];
      const out = [];
      for (const i of pick) {
        const c = cards[i], el = els[i];
        if (!el) continue;
        el.open = true;
        el.querySelectorAll("details").forEach((d) => { d.open = true; });
        const text = el.innerText;
        const own = new Set();
        const add = (r) => { if (r && r.low) { own.add(Math.round(r.low.value)); own.add(Math.round(r.high.value)); } };
        for (const k of c.courses) { add(k.cost); add(k.value); add(k.income && k.income.perUnitMonthly); add(k.income && k.income.at80); add(k.income && k.income.at60); add(k.income && k.income.yearly);
          if (k.size) { add(k.size.units); add(k.size.sqft); add(k.size.area); } add(k.affordableUnits);
          for (const p of k.publicMoney || []) add(p.cap);
          for (const inp of k.inputs || []) { if (inp.value != null) own.add(Math.round(inp.value)); if (inp.range) add(inp.range); for (const m of String(inp.note || "").matchAll(/\$([\d,]+)/g)) own.add(+m[1].replace(/,/g, "")); for (const m of String(inp.text || "").matchAll(/([\d,]+)/g)) own.add(+m[1].replace(/,/g, "")); } }
        for (const p of c.placeFacts || []) { for (const r of [p.range, p.at50]) add(r); for (const y of p.rows || []) { own.add(y.value); own.add(y.homes); } if (p.limits) for (const v of p.limits.il60.concat(p.limits.il50)) own.add(v); if (p.detail) for (const m of p.detail.matchAll(/\$([\d,]+)/g)) own.add(+m[1].replace(/,/g, "")); }
        const dollars = [...text.matchAll(/\$([\d,]+)/g)].map((m) => +m[1].replace(/,/g, ""));
        const homesShown = [...text.matchAll(/([\d,]+)(?: to ([\d,]+))? homes?\b/g)].flatMap((m) => [m[1], m[2]].filter(Boolean).map((v) => +v.replace(/,/g, "")));
        const sm = c.courses.find((k) => k.course === "small_multifamily" && !k.affordable);
        out.push({ id: c.subject.id, name: c.subject.name, open: el.open,
          zoningFact: (text.match(/Zoning\n?[^\n]*/) || [null])[0],
          smallMultifamily: sm ? { legal: sm.legal.basis + (sm.legal.zone ? " " + sm.legal.zone : ""), homes: sm.size && sm.size.units ? [sm.size.units.low.value, sm.size.units.high.value] : null, cost: sm.cost ? [Math.round(sm.cost.low.value), Math.round(sm.cost.high.value)] : null, costWhy: sm.costWhy } : { notAssessed: (c.notAssessed.find((n) => n.id === "small_multifamily") || { missing: [] }).missing[0] },
          dollarsShown: dollars.length, dollarsNotOnTheCard: dollars.filter((v) => !own.has(v)), homesShown, homesNotOnTheCard: homesShown.filter((v) => !own.has(v)),
          badText: (text.match(/\bnull\b|NaN|undefined/g) || []).length });
      }
      const all = document.querySelector("#iv-courses") ? document.querySelector("#iv-courses").innerText : "";
      return { siteCards: cards.length, stationSiteCards: station.length, sizedStationSiteCards: sized.length, opened: out, sectionBadText: (all.match(/\bnull\b|NaN|undefined/g) || []).length, picked: pick };
    });
    info.zoningAttached = zoned;
    // screenshots of the opened cards (the first sized one, else the first)
    const els = page.locator("#iv-courses .pc-card[data-pc-subject=site]");
    for (const [n, i] of info.picked.slice(0, 3).entries()) {
      const el = els.nth(i);
      await el.scrollIntoViewIfNeeded();
      const f = path.join(outDir, `site_zoning_${key}_${n + 1}.png`);
      await el.screenshot({ path: f });
      (info.screenshots = info.screenshots || []).push(f);
    }
    info.errors = errors;
    result.places[key] = Object.assign({ fips }, info);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const f = path.join(outDir, `live_check_site_zoning_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(f, JSON.stringify(result, null, 1));
for (const [k, v] of Object.entries(result.places)) console.log(k, JSON.stringify({ zoned: v.zoningAttached, siteCards: v.siteCards, station: v.stationSiteCards, sized: v.sizedStationSiteCards, bad: v.sectionBadText, errors: v.errors, opened: v.opened }, null, 1));
console.log("wrote " + f);
