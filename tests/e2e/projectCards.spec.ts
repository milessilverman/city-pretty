// Invest view, Courses of action (project cards: src/engines/projectCardEngine.js, rendered by app/invest.js). Lots are
// fixed test inputs placed through the page's own state (activeHouse), as in site.spec.ts; no live parcel service.
import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const root = path.join(__dirname, "../..");
const costs = JSON.parse(fs.readFileSync(path.join(root, "app/data/building_costs.json"), "utf8")).rows;
const vms = JSON.parse(fs.readFileSync(path.join(root, "app/data/county_valuation_models.json"), "utf8")).counties;
const money = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

async function openPage(page: Page) {
  const errors: string[] = [];
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  return errors;
}
async function openCounty(page: Page, fips: string) {
  await page.evaluate((f) => (window as any).openCounty(f), fips);
  await page.waitForFunction((f) => (window as any).D_OC?.meta?.fips === f && (window as any).activeCounty === "oc", fips, { timeout: 90_000 });
}
async function toInvest(page: Page) {
  await page.click("#view-switch [data-view=invest]");
  await expect(page.locator("#iv-courses .pc-fit")).toBeVisible({ timeout: 60_000 });
}
async function openAllCourses(page: Page) {
  await page.evaluate(() => document.querySelectorAll("#iv-courses details").forEach((d) => ((d as HTMLDetailsElement).open = true)));
}
// rule checks on what the section shows: every figure carries a basis tag and a source; no internal-only value is in the
// page or in the advisor brief; no null / NaN / undefined text
async function honesty(page: Page) {
  return page.evaluate(() => {
    const sec = document.querySelector("#iv-courses")!;
    const untagged: string[] = [];
    sec.querySelectorAll(".pc-fig").forEach((f) => {
      const scope = f.closest("tr") || f.parentElement!;
      if (!scope.querySelector(".iv-basis") || !scope.querySelector(".iv-src")) untagged.push((f.textContent || "").trim());
    });
    const st = (window as any).cpInvest.courses;
    const internal = ((st.cards && st.cards.cards) || []).flatMap((c: any) => c.internal_only.estimates.filter((e: any) => e.computed).flatMap((e: any) => [e.low, e.high]));
    const html = sec.innerHTML, text = (sec as HTMLElement).innerText;
    const brief = JSON.stringify((window as any).InvestmentDecisionEngine.briefForAdvisor((window as any).__cpDecisionBrief));
    const fmt = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
    return { untagged, internalN: internal.length, internalShown: internal.filter((v: number) => html.includes(String(v)) || text.includes(fmt(v)) || brief.includes(String(v))),
      internalKey: /internal_only/.test(brief) || /internal_only/.test(html), briefLen: brief.length, briefHasCards: /project-cards-for-advisor@1/.test(brief), bad: (text.match(/\bnull\b|NaN|undefined/g) || []) };
  });
}

test("Los Angeles: an opened lot's ADU course is priced from the LA permit medians; SB 9 could not be assessed; sites get cards; a typed budget lists what fits", async ({ page }) => {
  const errors = await openPage(page);
  // a point inside an R1-1 polygon of the City of Los Angeles on the page's own zoning layer
  const ll = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s), Z = ev("D").layers.zoning, zCell = ev("zCell"), zoneAt = ev("zoneAt");
    for (const k of Object.keys(Z.cells)) for (const z of zCell(k)) {
      if (z.zone !== "R1-1" || z.juris !== "Los Angeles" || !z.rings || !z.rings[0]) continue;
      const r = z.rings[0], c = { lat: r.reduce((s: number, q: number[]) => s + q[0], 0) / r.length, lng: r.reduce((s: number, q: number[]) => s + q[1], 0) / r.length };
      const hit = zoneAt(c);
      if (hit && hit.zone === "R1-1" && hit.juris === "Los Angeles") return c;
    }
    return null;
  });
  expect(ll).toBeTruthy();
  await page.evaluate((p) => {
    const w = window as any, box = document.createElement("div");
    const a = { AIN: "0000000000", SitusFullAddress: "1 TEST ST (fixture lot)", UseType: "Residential", UseDescription: "Single Family Residence", ZoneCode: "R1-1" };
    const st = { osm: null, R: { fema: { sfha: false }, fire: { vh: false }, hpoz: { ok: true, v: [] }, hcm: { ok: true, v: [] }, hc: { ok: true, v: [] } }, osmDone: true, rDone: true };
    w.activeHouse = { box, a, lot: 6000, ll: p, st, tok: 1 };   // a var global of app/app.js
  }, ll);
  await toInvest(page);
  const lot = page.locator('#iv-courses .pc-card[data-pc-subject="lot"]');
  await expect(lot).toHaveCount(1);
  await lot.locator(":scope > summary").click();
  const sq = costs.find((r: any) => r.display_allowed && /^New-construction ADU.*per sq ft$/.test(r.item) && r.year === 2025);
  const pu = costs.find((r: any) => r.display_allowed && /^New-construction ADU.*per unit$/.test(r.item) && r.year === 2025);
  const size = +String(pu.unit).match(/median size (\d+) sq ft/)![1];
  const adu = lot.locator('[data-pc-course="adu"]');
  await expect(adu).toContainText(`${money(sq.range[0] * size)} to ${money(sq.range[1] * size)}`);
  await expect(adu).toContainText("declared permit valuations");
  await expect(adu).toContainText("payment standards");
  await expect(lot.locator(".pc-na")).toContainText("Split or add units under state law");
  await expect(lot.locator(".pc-na")).toContainText(/SB 9.*not been confirmed against the statute text/);
  // a course that could not be assessed shows no figure
  expect(await lot.locator(".pc-na .pc-fig").count()).toBe(0);
  // the measured sites get cards, and a site never gets an ADU course
  expect(await page.locator('#iv-courses .pc-card[data-pc-subject="site"]').count()).toBeGreaterThan(0);
  expect(await page.locator('#iv-courses .pc-card[data-pc-subject="site"] [data-pc-course="adu"]').count()).toBe(0);
  await openAllCourses(page);
  const h = await honesty(page);
  expect(h.untagged).toEqual([]);
  expect(h.internalN).toBeGreaterThan(0);   // the internal estimate exists in memory ...
  expect(h.internalShown).toEqual([]);      // ... and is nowhere on the page or in the advisor brief
  expect(h.internalKey).toBe(false);
  expect(h.briefHasCards).toBe(true);
  expect(h.briefLen).toBeLessThanOrEqual(20000);
  expect(h.bad).toEqual([]);
  // budget: a typed amount
  await page.fill("#pc-budget-in", "150000");
  await page.click("[data-pc=budget]");
  await expect(page.locator("#pc-fit")).toContainText("With $150,000");
  await expect(page.locator("#pc-fit .pc-fitlist")).toContainText("Add a backyard home (ADU)");
  const fit = await page.locator("#pc-fit").innerText();
  await page.fill("#pc-budget-in", "50000");
  await page.click("[data-pc=budget]");
  await expect(page.locator("#pc-fit")).toContainText("With $50,000");
  expect(await page.locator("#pc-fit").innerText()).not.toBe(fit);
  await expect(page.locator("#pc-fit")).not.toContainText("Add a backyard home (ADU)");
  // the preset buttons take over again
  await page.click("[data-iv-budget='4']");
  await expect(page.locator("#pc-fit")).toContainText("With no upper limit");
  expect(errors).toEqual([]);
});

test("Miami-Dade (valuation model passed): a neighborhood is priced from recorded sales; an opened lot's estimate gets its tested error band", async ({ page }) => {
  const errors = await openPage(page);
  await openCounty(page, "12086");
  await toInvest(page);
  const C = vms["12086"];
  const bg = await page.evaluate((ids) => { const B = (window as any).D_OC; return ids.find((k: string) => B.details[k]) || null; }, Object.keys(C.stats.bg).filter((k) => C.stats.bg[k][0] >= 5));
  expect(bg).toBeTruthy();
  await page.evaluate((id) => { (window as any).cpInvest.state.hood = id; (window as any).cpInvest.render(); }, bg);
  const hood = page.locator('#iv-courses .pc-card[data-pc-subject="neighborhood"]');
  await hood.locator(":scope > summary").click();
  await expect(hood.locator('[data-pc-course="hold"]')).toContainText(money(C.stats.bg[bg!][1]));
  await expect(hood.locator('[data-pc-course="hold"]')).toContainText("recorded sales");
  await expect(hood.locator('[data-pc-course="hold"]')).toContainText("research prompt 9");
  // a lot with the page's back-tested estimate (fixture value)
  await page.evaluate(() => {
    const w = window as any;
    const h = { box: document.createElement("div"), a: { PARCEL_ID: "FIXTURE", PHY_ADDR1: "2 TEST ST (fixture lot)" }, lot: 6000, ll: { lat: 25.75, lng: -80.24 }, st: { osm: null, R: null, osmDone: true, rDone: true }, tok: 1,
      valuation: { estimatedValue: 600000, valuationMethod: "Miami-Dade County model (back-tested)", backtest: { pass: true }, confidenceRating: "Back-tested estimate" } };
    w.activeHouse = h; w.cpInvest.render();
  });
  const lot = page.locator('#iv-courses .pc-card[data-pc-subject="lot"]');
  await lot.locator(":scope > summary").click();
  const p80 = C.tested.by_price_band["$500k-$1M"].p80_abs_error;
  await expect(lot.locator('[data-pc-course="hold"]')).toContainText(`${money(600000 * (1 - p80))} to ${money(600000 * (1 + p80))}`);
  await expect(lot.locator('[data-pc-course="hold"]')).toContainText("back-tested home-value estimate");
  await openAllCourses(page);
  const h = await honesty(page);
  expect(h.untagged).toEqual([]);
  expect(h.internalShown).toEqual([]);
  expect(h.bad).toEqual([]);
  expect(errors.filter((e) => !/crash_/.test(e))).toEqual([]);
});

test("Travis County: the Austin stop city card shows the measured transit range with its caution, and no cost for building courses", async ({ page }) => {
  const errors = await openPage(page);
  await openCounty(page, "48453");
  await toInvest(page);
  const stop = page.locator('#iv-courses .pc-card[data-pc-subject="stop_area"]');
  await expect(stop).toHaveCount(1);
  await expect(stop.locator(":scope > summary")).toContainText("Austin stop city");
  await expect(stop.locator(":scope > summary")).toContainText("corridor record: unverified");
  await stop.locator(":scope > summary").click();
  const hold = stop.locator('[data-pc-course="hold"]');
  await expect(hold).toContainText("within 1/4 mile of the station");
  await expect(hold).toContainText("commuter rail");
  await expect(hold).toContainText("Debrezion");
  await expect(hold).toContainText("The station site is not chosen");
  // building courses: listed as not assessed, with no cost figure
  await expect(stop.locator(".pc-na")).toContainText("Station-area apartments (conventional)");
  expect(await stop.locator(".pc-na .pc-fig").count()).toBe(0);
  expect(await stop.locator(".pc-course").count()).toBe(1);
  await openAllCourses(page);
  const h = await honesty(page);
  expect(h.untagged).toEqual([]);
  expect(h.bad).toEqual([]);
  expect(h.briefLen).toBeLessThanOrEqual(20000);
  // the preset budget buttons change the fit
  await page.click("[data-iv-budget='0']");
  await expect(page.locator("#pc-fit")).toContainText("With $100,000");
  await page.click("[data-iv-budget='2']");
  await expect(page.locator("#pc-fit")).toContainText("With $2,000,000");
  expect(errors).toEqual([]);
});
