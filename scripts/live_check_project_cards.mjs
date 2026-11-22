// Live check of the Invest view's "Courses of action" section on the real page (real network for parcels; NOT part of CI).
//
// Opens, through the page's own click paths: a Los Angeles lot in a single-family zone inside the City of Los Angeles
// (houseAt on a point of the page's own zoning layer), Miami-Dade (a county whose valuation model passed) with a lot,
// and Travis County (a stop city of the Austin - San Antonio corridor); then types a budget. For each it records what the
// section shows, checks that no value from a display_allowed: false row (the internal-only branch) is in the page or the
// advisor brief, and saves screenshots.
//
// Usage: LIVE_PORT=9151 NODE_USE_ENV_PROXY=1 node scripts/live_check_project_cards.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8898);
const outDir = process.argv[2] || path.join(root, "data/backtests");
fs.mkdirSync(outDir, { recursive: true });
const result = { run_on: new Date().toISOString(), port: PORT, places: {} };

async function waitPage(page) {
  await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
  await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
}
async function toInvest(page) {
  await page.click("#view-switch [data-view=invest]");
  await page.waitForSelector("#iv-courses .pc-card, #iv-courses .pc-fit", { timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector("#iv-courses .iv-loading"), null, { timeout: 60000 });
}
async function section(page) {
  return page.evaluate(() => {
    const st = (window).cpInvest.courses;
    const cards = (st.cards && st.cards.cards) || [];
    const internal = cards.flatMap((c) => c.internal_only.estimates.filter((e) => e.computed).flatMap((e) => [e.low, e.high]));
    const html = document.querySelector("#invest").innerHTML, text = document.querySelector("#invest").innerText;
    const brief = JSON.stringify((window).InvestmentDecisionEngine.briefForAdvisor((window).__cpDecisionBrief));
    const fmt = (v) => "$" + Math.round(v).toLocaleString("en-US");
    return {
      fit: (document.querySelector("#pc-fit") || {}).innerText || null,
      cards: cards.map((c) => ({ subject: c.subject.kind + ": " + c.subject.name,
        courses: c.courses.map((x) => ({ course: x.label, cost: x.cost ? [Math.round(x.cost.low.value), Math.round(x.cost.high.value), x.cost.label] : x.costWhy, income: x.income ? [x.income.perUnitMonthly.low.value, x.income.perUnitMonthly.high.value] : x.incomeWhy, value: x.value ? [x.value.low.value, x.value.high.value] : x.valueWhy, uplift: x.transitUplift ? x.transitUplift.bands.map((b) => b.band + " " + b.average.value + "% (" + (b.range ? b.range.low.value + " to " + b.range.high.value : "") + ")") : null })),
        notAssessed: c.notAssessed.map((n) => n.label + ": " + n.missing[0]) })),
      internalComputed: internal.length,
      internalInPage: internal.filter((v) => html.includes(String(v)) || text.includes(fmt(v))).length,
      internalInBrief: internal.filter((v) => brief.includes(String(v))).length,
      briefHasCards: /project-cards-for-advisor@1/.test(brief), briefChars: brief.length,
      badText: (text.match(/\bnull\b|NaN|undefined/g) || []).length,
    };
  });
}
async function shot(page, name) {
  const el = page.locator("#iv-courses");
  await el.scrollIntoViewIfNeeded();
  const f = path.join(outDir, `project_cards_${name}.png`);
  await el.screenshot({ path: f });
  return f;
}
async function openFirstCard(page, kind) {
  await page.evaluate((k) => { const d = document.querySelector(`#iv-courses .pc-card[data-pc-subject="${k}"]`); if (d) d.open = true; }, kind);
}

const server = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
try {
  // ---- Los Angeles: a real lot in a single-family zone of the City of Los Angeles, through houseAt
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await waitPage(page);
    const pt = await page.evaluate(() => {
      const ev = (s) => (0, eval)(s), Z = ev("D").layers.zoning, zCell = ev("zCell"), zoneAt = ev("zoneAt");
      for (const k of Object.keys(Z.cells)) for (const z of zCell(k)) {
        if (!/^R1-1$/.test(z.zone) || z.cat !== "single-family" || !/^Los Angeles$/.test(z.juris || "") || !z.rings || !z.rings[0]) continue;
        const r = z.rings[0], c = { lat: r.reduce((s, q) => s + q[0], 0) / r.length, lng: r.reduce((s, q) => s + q[1], 0) / r.length };
        const hit = zoneAt(c);
        if (hit && hit.zone === z.zone && hit.juris === "Los Angeles") return c;
      }
      return null;
    });
    result.places.la_point = pt;
    if (pt) {
      await page.evaluate((p) => (0, eval)("houseAt")(p), pt);
      await page.waitForFunction(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); return !!ah && !!ah.a && !!ah.st && ah.st.rDone && ah.st.osmDone; }, null, { timeout: 90000 }).catch(() => {});
      result.places.la_lot = await page.evaluate(() => { const ah = (0, eval)("activeHouse"); return ah && ah.a ? { address: ah.a.SitusFullAddress || null, zone: ((0, eval)("zoneAt")(ah.ll) || {}).zone, valuation: ah.valuation ? { v: ah.valuation.estimatedValue, m: ah.valuation.valuationMethod } : null } : null; });
    }
    await toInvest(page);
    await openFirstCard(page, "lot"); await openFirstCard(page, "site");
    result.places.los_angeles = await section(page);
    result.places.los_angeles.screenshot = await shot(page, "los_angeles");
    // budget change
    await page.fill("#pc-budget-in", "150000");
    await page.click("[data-pc=budget]");
    await page.waitForFunction(() => /\$150,000/.test((document.querySelector("#pc-fit") || {}).innerText || ""), null, { timeout: 20000 });
    result.places.los_angeles_budget = { fit: await page.locator("#pc-fit").innerText(), screenshot: path.join(outDir, "project_cards_budget.png") };
    await page.locator("#pc-fit").screenshot({ path: result.places.los_angeles_budget.screenshot });
    result.places.los_angeles.errors = errors;
    await page.close();
  }
  // ---- Miami-Dade (valuation model passed) and Travis (stop city)
  for (const [key, fips, lotPt] of [["miami_dade", "12086", { lat: 25.7489, lng: -80.2366 }], ["travis", "48453", null]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await waitPage(page);
    await page.evaluate((f) => (window).openCounty(f), fips);
    await page.waitForFunction((f) => (window).D_OC?.meta?.fips === f && (window).activeCounty === "oc", fips, { timeout: 120000 });
    if (lotPt) {
      await page.evaluate((p) => (0, eval)("houseAt")(p), lotPt);
      await page.waitForFunction(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); return !!ah && !!ah.a && !!ah.valuation; }, null, { timeout: 90000 }).catch(() => {});
      result.places[key + "_lot"] = await page.evaluate(() => { const ah = (0, eval)("activeHouse"); return ah && ah.a ? { attrs: Object.keys(ah.a).length, valuation: ah.valuation ? { v: ah.valuation.estimatedValue, m: ah.valuation.valuationMethod, why: ah.valuation.withheldReason } : null } : null; });
    }
    await toInvest(page);
    await openFirstCard(page, "neighborhood"); await openFirstCard(page, "stop_area"); await openFirstCard(page, "lot");
    result.places[key] = await section(page);
    result.places[key].screenshot = await shot(page, key);
    result.places[key].errors = errors;
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const f = path.join(outDir, `live_check_project_cards_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(f, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
console.log("wrote " + f);
