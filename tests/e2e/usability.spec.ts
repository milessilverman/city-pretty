// Usability checks (docs/audit/usability-2026-11-20.md). One test per fix, and one per journey asserting the outcome is
// reachable within the number of steps recorded in that audit. A "step" is a click, a tap or an Enter key press;
// typing into a focused box is not counted. No live third-party service is used: every request that leaves this
// machine is blocked, and the geocoder and the AI Worker are answered here.
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
test.use({ viewport: { width: 1440, height: 900 } });   // the laptop size the journeys were measured at
const ARC = /geocode\.arcgis\.com\/.*findAddressCandidates/;

type Cand = { address: string; location: { x: number; y: number }; score: number; attributes: Record<string, unknown> };
async function openPage(page: Page, { geocode = [] as Cand[], worker = false } = {}) {
  const errors: string[] = [];
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  page.on("pageerror", (e) => errors.push(e.message));
  // Later routes win in Playwright, so the block-everything rule goes first.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  await page.route(ARC, (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ candidates: geocode }) }));
  await page.route("**/app/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: `window.CITY_PRETTY_CONFIG = { workerUrl: "${worker ? "https://worker.test" : ""}" };` }));
  if (worker) {
    await page.route("https://worker.test/api/health", (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"status":"ok","ai_advisor_ready":true}' }));
    await page.route("https://worker.test/api/ai", (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, text: "Stub reply for the test." }) }));
  }
  await page.goto("");
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  return errors;
}
const ev = <T,>(page: Page, expr: string) => page.evaluate((x) => (0, eval)(x), expr) as Promise<T>;
/** counts the clicks, taps and Enter presses a journey takes */
class Steps {
  n = 0;
  constructor(private page: Page) {}
  async click(sel: string) { this.n++; await this.page.locator(sel).first().click(); }
  async enter() { this.n++; await this.page.keyboard.press("Enter"); }
  /** click the search box (1 step), type, press Enter (1 step) */
  async search(text: string) { await this.click("#q"); await this.page.locator("#q").fill(text); await this.enter(); }
}
const selectedName = (page: Page) => page.locator("#panel-name").innerText();
/** a point inside the block group that is open, as [lng, lat] (the middle of its first ring's bounding box may fall outside, so a vertex is nudged inward) */
const pointInside = (page: Page, id: string) => page.evaluate((bg) => {
  const f = (0, eval)("byId").get(bg), inF = (0, eval)("pointInFeature"), L = (window as any).L;
  const c = L.geoJSON(f).getBounds().getCenter();
  if (inF(f, c.lng, c.lat)) return [c.lng, c.lat];
  const b = L.geoJSON(f).getBounds();
  for (let i = 1; i < 40; i++) for (let j = 1; j < 40; j++) { const x = b.getWest() + (b.getEast() - b.getWest()) * i / 40, y = b.getSouth() + (b.getNorth() - b.getSouth()) * j / 40; if (inF(f, x, y)) return [x, y]; }
  return [c.lng, c.lat];
}, id) as Promise<[number, number]>;
const idByName = (page: Page, name: string) => page.evaluate((n) => (0, eval)("D").meta.search[n], name) as Promise<string>;

// ------------------------------------------------------------------ fixes

test("the first click after a search is not swallowed, and the panel is not redrawn under it", async ({ page }) => {
  const errors = await openPage(page);
  const s = new Steps(page);
  await s.search("Silver Lake");
  await expect(page.locator("#panel-name")).toHaveText("Silver Lake");
  // Leaving the search box used to re-run the search (a "change" event): the panel was rebuilt between mouse-down and
  // mouse-up, so this click did nothing.
  await page.locator("#btn-compare-panel").click();
  expect(await ev<string[]>(page, "compareList")).toHaveLength(1);
  await expect(page.locator("#btn-compare-panel")).toHaveText(/In comparison/);
  expect(errors).toEqual([]);
});

test("suggestions list the open county's neighborhoods first, and a mouse click on one opens it", async ({ page }) => {
  const errors = await openPage(page, { geocode: [{ address: "Echo, Oregon", location: { x: -119.19, y: 45.74 }, score: 100, attributes: { Addr_type: "Locality" } }] });
  await page.locator("#q").click();
  // Focusing the box loads Orange County in the background; its names used to replace Los Angeles County's in this list.
  await page.waitForFunction(() => { try { return !!((0, eval)("D_OC") || {}).search; } catch (e) { return false; } }, null, { timeout: 60_000 });
  await page.locator("#q").pressSequentially("echo p", { delay: 10 });
  const box = page.locator("#addr-results");
  await expect(box).toContainText("Neighborhoods in Los Angeles County");
  await expect(box.locator("button.addr-item").first()).toHaveText("Echo Park");
  await box.locator("button.addr-item").first().hover();   // hovering used to throw inside Leaflet (closeTooltip with no tooltip)
  await box.locator("button.addr-item").first().click();
  await expect(page.locator("#panel-name")).toHaveText("Echo Park");
  await expect(page.locator("#match-note")).toContainText("Echo Park");
  expect(await ev<string>(page, "activeFips()")).toBe("06037");
  await page.waitForTimeout(600);
  await expect(page.locator("#addr-results")).toHaveCount(0);   // the list does not come back over the result
  expect(errors).toEqual([]);
});

test("Enter on part of a name opens the best match and the panel says what was matched", async ({ page }) => {
  await openPage(page);
  const s = new Steps(page);
  await s.search("silver");
  await expect(page.locator("#panel-name")).toHaveText("Silver Lake");
  await expect(page.locator("#match-note")).toHaveText(/Matched the name .Silver Lake.\./);
  await expect(page.locator("#q")).toHaveValue("Silver Lake");
  const ranks = await ev<number[]>(page, "rankNameMatches('lake', 5).map(m => m.rank)");
  expect(ranks.length).toBeGreaterThan(1);
  expect(ranks).toEqual([...ranks].sort((x, y) => x - y));   // best kind of match first
  expect(await ev<unknown>(page, "bestNameMatch('zz')")).toBeNull();
});

test("the panel says when a name covers many map areas, and counts them from the map itself", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Silver Lake");
  const n = await page.evaluate(() => (0, eval)("allFeatures()").filter((f: any) => f.properties.n === "Silver Lake" && f.properties.c === "Los Angeles").length);
  expect(n).toBeGreaterThan(1);
  await expect(page.locator("#area-note")).toContainText(`One of ${n} areas on this map named Silver Lake`);
  await expect(page.locator("#area-note")).toContainText("not for the whole neighborhood");
});

test("a ZIP code opens the area at its center and no lot; an address opens the area and its lot", async ({ page }) => {
  await openPage(page);
  const id = await idByName(page, "Echo Park");
  const [x, y] = await pointInside(page, id);
  await page.route(ARC, (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ candidates: [{ address: "90026, Los Angeles, California", location: { x, y }, score: 100, attributes: { Addr_type: "Postal", Subregion: "Los Angeles County", Region: "California" } }] }) }));
  const s = new Steps(page);
  await s.search("90026");
  await expect(page.locator("#match-note")).toContainText("Matched ZIP code");
  await expect(page.locator("#match-note")).toContainText("covers more than one area");
  expect(await ev<string>(page, "selected")).toBe(id);
  await page.waitForTimeout(500);
  await expect(page.locator("#house")).toHaveCount(0);                     // it used to open whichever lot sat at the ZIP's center
  expect(await ev<number>(page, "map.getZoom()")).toBeLessThanOrEqual(15);  // and zoom to a single lot (17.5)
  expect(s.n).toBe(2);
});

test("a place with no data leaves the map and the county where they were, and says so", async ({ page }) => {
  await openPage(page, { geocode: [{ address: "Nowhere, Oklahoma", location: { x: -98.44228, y: 35.15923 }, score: 100, attributes: { Addr_type: "Locality", Subregion: "Caddo County", Region: "Oklahoma" } }] });
  const before = await page.evaluate(() => { const m = (0, eval)("map"); return { sel: (0, eval)("selected"), c: [m.getCenter().lat, m.getCenter().lng], z: m.getZoom() }; });
  await new Steps(page).search("zzqqxx nowhere 99");
  await expect(page.locator("#toast")).toContainText("has no data for that place");
  await expect(page.locator("#toast")).toContainText("Still showing Los Angeles County");
  const after = await page.evaluate(() => { const m = (0, eval)("map"); return { sel: (0, eval)("selected"), c: [m.getCenter().lat, m.getCenter().lng], z: m.getZoom() }; });
  expect(after).toEqual(before);
  await expect(page.locator("#panel-name")).toBeVisible();   // the panel used to be replaced by "No parcel found at this point"
});

test("switching from one county to another names the new one and clears the old search text", async ({ page }) => {
  await openPage(page);
  await page.locator("#q").fill("Echo Park");
  await page.evaluate(() => (0, eval)("openCounty")("48453"));
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "48453" && !!(0, eval)("selected")?.startsWith("48453"), null, { timeout: 60_000 });
  await expect(page.locator("#county-pick-label")).toHaveText("Travis County, TX");
  await expect(page.locator("#q")).toHaveValue("");
  // With a Travis block group still selected, the header used to keep saying "Travis County, TX" for the next county.
  await page.evaluate(() => (0, eval)("openCounty")("11001"));
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "11001" && !!(0, eval)("selected")?.startsWith("11001"), null, { timeout: 60_000 });
  await expect(page.locator("#county-pick-label")).toHaveText("District of Columbia, DC");
  await expect(page.locator("header h1")).toContainText("District of Columbia");
});

test("the neighborhood panel opens with its numbers: each has a unit and a source or a reason", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Echo Park");
  const id = await ev<string>(page, "selected");
  const m = await page.evaluate((bg) => (0, eval)("D").details[bg].m, id);
  const labels = await page.locator("#glance .tile .k").allInnerTexts();
  expect(labels).toEqual(["Typical home value", "Median rent", "Household income", "Homes", "Violent crime", "Serious crashes", "Buses per hour", "Nearest rail", "Nearest school", "Zoning", "Flood zone", "Heat vs. urban area"]);
  // every tile: a value and a line under it (unit, source, or why it is missing)
  for (const t of await page.locator("#glance .tile").all()) {
    expect((await t.locator(".v").innerText()).trim()).not.toBe("");
    expect((await t.locator(".s").innerText()).trim().length).toBeGreaterThan(8);
  }
  // the figures are the county file's own, formatted by the page's own formatters
  const tile = (k: string) => page.locator("#glance .tile", { has: page.locator(".k", { hasText: new RegExp("^" + k + "$") }) });
  expect(await tile("Median rent").locator(".v").innerText()).toBe(await page.evaluate((v) => (0, eval)("fmtRent")(v), m.rent));
  expect(await tile("Household income").locator(".v").innerText()).toBe(await page.evaluate((v) => (0, eval)("fmt$")(v), m.inc));
  expect(await tile("Nearest rail").locator(".v").innerText()).toBe((m.rm / 1609).toFixed(1) + " mi");
  expect(await tile("Buses per hour").locator(".v").innerText()).toBe(Math.round(m.bt) + "/hr");
  await expect(tile("Median rent").locator(".s")).toContainText("per month");
  await expect(tile("Violent crime").locator(".s")).toContainText("per 1,000 residents, 12 months");
  // crashes: the same count and years as the county's crash file
  const cc = JSON.parse(fs.readFileSync(path.join(root, "app/data/crash_counts/06037.json"), "utf8"));
  await expect(tile("Serious crashes").locator(".s")).toContainText(cc._meta.years.join("–"), { timeout: 15_000 });
  const exp = cc[id][1];
  expect(await tile("Serious crashes").locator(".v").innerText()).toBe(Number.isInteger(exp) ? String(exp) : exp.toFixed(1));
  // all twelve sit above the first group of sections, and the whole summary starts on the first screen
  const g = await page.locator("#glance").boundingBox(), p = await page.locator("#panel").boundingBox();
  expect(g!.y).toBeLessThan(p!.y + p!.height);
  expect(await page.evaluate(() => !!(document.querySelector("#glance")!.compareDocumentPosition(document.querySelector("#panel .verdict")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  // the live checks read these three as label immediately followed by value
  const text = (await page.locator("#panel").textContent())!.replace(/\s+/g, " ");
  expect(text).toContain("Median rent" + await page.evaluate((v) => (0, eval)("fmtRent")(v), m.rent));
  expect(text).toContain("Homes" + Math.round(m.homes).toLocaleString("en-US"));
});

test("a missing figure says 'not on file' and why; zoning never borrows the zones in the map view", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Silver Lake");
  const id = await ev<string>(page, "selected");
  expect(await page.evaluate((bg) => (0, eval)("D").details[bg].m.rent ?? null, id)).toBeNull();
  const tile = (k: string) => page.locator("#glance .tile", { has: page.locator(".k", { hasText: new RegExp("^" + k + "$") }) });
  await expect(tile("Median rent").locator(".v")).toHaveText("–");
  await expect(tile("Median rent").locator(".s")).toHaveText("not on file: no rent figure for this area in the county file");
  await expect(tile("Flood zone").locator(".s")).toContainText("FEMA maps flood zones lot by lot");
  // an area with no zoning shares of its own: the tile stays "not on file" even when zones are loaded on the map
  const html = await page.evaluate(() => {
    (0, eval)("_dynZoneFeats = [{ cat: 'single-family', zone: 'SF-3-NP' }]");
    const out = (0, eval)("glanceHtml")("x", { n: "X", c: "Y" }, { homes: 10 }, true, true);
    (0, eval)("_dynZoneFeats = []");
    return out;
  });
  expect(html).not.toContain("SF-3-NP");
  expect(html).toContain("no zoning shares for this area in the county file");
});

// 22 Nov 2026 (docs/audit/usability-2026-11-20.md): after viewing Austin, a Kent County MD area's Zoning section listed the
// zones loaded for the map view as that area's "Predominant zoning" (SF-3-NP).
test("the Zoning section never shows zones from the map view as the area's own, and a county switch drops them", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Silver Lake");
  const html = await page.evaluate(() => {
    (0, eval)("_dynZoneFeats = [{ cat: 'single-family', zone: 'SF-3-NP' }, { cat: 'single-family', zone: 'SF-3-NP' }]");
    const out = (0, eval)("zoningSection")({ c: "Rock Hall" });
    (0, eval)("_dynZoneFeats = []");
    return out as string;
  });
  expect(html).not.toContain("SF-3-NP");
  expect(html).not.toContain("Predominant zoning");
  expect(html).toContain("Zoning for this area is not on file: the county file has no zoning shares for this area");
  // the same panel in the open page: zones left in the view when the county changes are gone afterwards
  const left = await page.evaluate(() => {
    (0, eval)("_dynZoneFeats = [{ cat: 'single-family', zone: 'SF-3-NP' }]");
    (0, eval)("switchCounty")("la");
    return (0, eval)("_dynZoneFeats.length") as number;
  });
  expect(left).toBe(0);
});

test("the jump row opens a section in one click and names the open area", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Echo Park");
  await expect(page.locator("#panel-jump .pj-name")).toHaveText("Echo Park");
  const zoning = page.locator('#panel details[data-sec="zoning"]');
  expect(await zoning.evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);
  await page.locator('#panel-jump [data-jump="zoning"]').click();
  expect(await zoning.evaluate((d: HTMLDetailsElement) => d.open)).toBe(true);
  const top = await zoning.evaluate((d) => d.getBoundingClientRect().top - document.querySelector("#panel")!.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(0); expect(top).toBeLessThan(120);
  await expect(page.locator("#panel-jump")).toBeInViewport();   // it stays in reach while the panel is scrolled
  await page.locator('#panel-jump [data-jump="profile"]').click();
  await expect(page.locator('#panel details[data-sec="profile"]')).toContainText("Median household income");
  await page.locator("#panel-jump .pj-name").click();
  expect(await page.evaluate(() => document.querySelector("#panel")!.scrollTop)).toBe(0);
  // plain group headings, in this order
  expect(await page.locator("#panel h3.panel-group").allTextContents()).toEqual(["More numbers", "What can be built", "Public projects that could raise values here", "Paying for it, and the data behind this page"]);
});

test("a lot opens right under the header, above the area's numbers; the hint offers to zoom to the lots", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Echo Park");
  await page.locator('#glance [data-jump="flood"]').click();   // "Flood zone: by lot" leads to how to open a lot
  await expect(page.locator("#house")).toContainText("click a single home");
  expect(await page.evaluate(() => !!(document.querySelector("#house")!.compareDocumentPosition(document.querySelector("#glance")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.locator('#house [data-jump="zoomlots"]').click();
  await page.waitForFunction(() => (0, eval)("map").getZoom() >= 17, null, { timeout: 10_000 });
});

test("close buttons, the search box and the suggestion list have names a screen reader can read", async ({ page }) => {
  await openPage(page, { geocode: [] });
  const unnamed = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.textContent!.trim() === "✕" && !b.getAttribute("aria-label")).length);
  expect(unnamed).toBe(0);
  await expect(page.getByLabel(/Search this county: a neighborhood name, a street address or a ZIP code/)).toHaveAttribute("id", "q");
  await page.locator("#q").click();
  await page.locator("#q").pressSequentially("echo", { delay: 10 });
  await expect(page.locator("#addr-results")).toHaveAttribute("aria-label", "Search suggestions");
  // keyboard: arrow to the first suggestion and open it
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await expect(page.locator("#panel-name")).toContainText("Echo");
  // text that carries meaning meets 4.5:1 against the panel (the lightest ink was 3.5:1)
  const ratio = await page.evaluate(() => {
    const lum = (c: string) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((v) => { const x = +v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const el = document.querySelector("#glance .tile .k")!, a = lum(getComputedStyle(el).color), b = lum(getComputedStyle(document.querySelector("#panel")!).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("a long value range wraps inside its card instead of running off the edge", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Silver Lake");
  const over = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#panel .top3-section .rec")].filter((r) => r.scrollWidth > r.clientWidth + 1).length);
  expect(over).toBe(0);
});

test("phone: the search box has its own row, nothing scrolls sideways, and the name button returns to the map", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await openPage(page);
  expect((await page.locator("#q").boundingBox())!.width).toBeGreaterThanOrEqual(330);   // was about 100 px
  for (const v of ["map", "explore", "invest"]) await expect(page.locator(`#view-switch [data-view="${v}"]`)).toBeVisible();
  await page.locator("#q").tap(); await page.locator("#q").fill("Silver Lake"); await page.keyboard.press("Enter");
  await expect(page.locator("#panel-name")).toHaveText("Silver Lake");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.locator('#panel-jump [data-jump="profile"]').tap();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(400);                 // deep in the panel, map out of sight
  await expect(page.locator("#panel-jump .pj-name")).toBeInViewport();                    // the area's name is still on screen
  await page.locator("#panel-jump .pj-name").tap();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator("#map")).toBeInViewport();
  await ctx.close();
});

// ------------------------------------------------------------------ journeys (steps as recorded in the audit)

test("journey a: arrive cold, find a named neighborhood and its numbers in 2 steps", async ({ page }) => {
  const errors = await openPage(page);
  const s = new Steps(page);
  await s.search("Silver Lake");
  await expect(page.locator("#panel-name")).toHaveText("Silver Lake");
  await expect(page.locator("#glance .tile").first()).toBeInViewport();
  expect(s.n).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("journey b: a street address leads to its neighborhood and its lot in 2 steps", async ({ page }) => {
  await openPage(page);
  const id = await idByName(page, "Echo Park");
  const [x, y] = await pointInside(page, id);
  await page.route(ARC, (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ candidates: [{ address: "1 Test St, Los Angeles, California, 90026", location: { x, y }, score: 100, attributes: { Addr_type: "PointAddress", Subregion: "Los Angeles County", Region: "California" } }] }) }));
  const s = new Steps(page);
  await s.search("1 Test St, Los Angeles");
  await expect(page.locator("#match-note")).toContainText("Matched the address");
  expect(await ev<string>(page, "selected")).toBe(id);
  await expect(page.locator("#house")).toContainText("This home", { ignoreCase: true });   // the lot section (its records load from the county's parcel service)
  expect(await page.evaluate(() => !!(document.querySelector("#house")!.compareDocumentPosition(document.querySelector("#glance")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  expect(await ev<number>(page, "map.getZoom()")).toBeGreaterThanOrEqual(17);
  expect(s.n).toBeLessThanOrEqual(2);
});

test("journey c: from a neighborhood, rent, crashes, transit and zoning take 0 steps; the zoning rules take 1; a lot takes 2", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Echo Park");
  const s = new Steps(page);
  const tile = (k: string) => page.locator("#glance .tile", { has: page.locator(".k", { hasText: new RegExp("^" + k + "$") }) });
  for (const k of ["Median rent", "Serious crashes", "Buses per hour", "Nearest rail", "Zoning", "Flood zone"]) await expect(tile(k)).toBeInViewport();   // no scroll, no click
  expect(s.n).toBe(0);
  await s.click('#glance [data-jump="zoning"]');
  await expect(page.locator('#panel details[data-sec="zoning"] .sec-content')).toBeVisible();
  await expect(page.locator('#panel details[data-sec="zoning"]')).toContainText("Housing laws");
  expect(s.n).toBe(1);
  await s.click('#panel-jump [data-jump="home"]');
  await s.click('#house [data-jump="zoomlots"]');
  await page.waitForFunction(() => (0, eval)("map").getZoom() >= 17, null, { timeout: 10_000 });   // lots are clickable from here; the lot's flood zone, zoning and laws come from live services
  expect(s.n).toBe(3);
});

test("journey d: compare two neighborhoods in 6 steps", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Silver Lake");
  const s = new Steps(page);
  await s.click("#btn-compare-panel");
  await s.search("Echo Park");
  await s.click("#btn-compare-panel");
  await expect(page.locator("#btn-compare-open")).toHaveText("View comparison (2)");
  await s.click("#btn-compare-open");
  await expect(page.locator("#compare-modal")).toBeVisible();
  await expect(page.locator("#compare-content")).toContainText("Silver Lake");
  await expect(page.locator("#compare-content")).toContainText("Echo Park");
  expect(s.n).toBeLessThanOrEqual(6);
});

test("journey e: from a neighborhood to what to build there in 1 step, and back to it on the map in 1", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Silver Lake");
  const id = await ev<string>(page, "selected");
  const s = new Steps(page);
  await s.click("#btn-build-here");
  await expect(page.locator("#iv-build .iv-lede")).toContainText("Silver Lake", { timeout: 30_000 });   // it used to show the county's first-ranked area
  await expect(page.locator("#iv-build")).toBeInViewport();
  expect(s.n).toBe(1);
  await s.click("#iv-build-map");
  await expect(page.locator("#map")).toBeInViewport();
  await page.waitForFunction((bg) => (0, eval)("selected") === bg && !document.body.classList.contains("invest-mode"), id);
  await expect(page.locator("#panel-name")).toHaveText("Silver Lake");
  expect(s.n).toBe(2);
});

test("journey f: ask the advisor about the open neighborhood in 2 steps", async ({ page }) => {
  await openPage(page, { worker: true });
  await new Steps(page).search("Echo Park");
  const s = new Steps(page);
  await s.click("#btn-ai-header");
  await expect(page.locator("#ai-advisor-modal")).toContainText("Echo Park");   // the advisor names the area it will answer about
  await page.fill("#ai-user-input", "What is the median rent here?");
  s.n++; await page.press("#ai-user-input", "Enter");
  // A plain data question is answered from the page's own figures (app/advisor-scripts.js), naming the area and its source
  const rent = await page.evaluate(() => (0, eval)("D").details[(0, eval)("selected")].m.rent);
  await expect(page.locator("#ai-chat-history")).toContainText("Median rent, Echo Park");
  await expect(page.locator("#ai-chat-history")).toContainText("$" + Math.round(rent).toLocaleString("en-US"));
  expect(s.n).toBe(2);
});

test("journey g: switch counties mid-task in 2 steps and land on that county's numbers", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Echo Park");
  const s = new Steps(page);
  await s.click("#county-pick-btn");
  await page.fill("#county-q", "travis");
  await s.enter();
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "48453" && !!(0, eval)("selected")?.startsWith("48453"), null, { timeout: 60_000 });
  await expect(page.locator("#county-pick-label")).toHaveText("Travis County, TX");
  await expect(page.locator("#q")).toHaveValue("");
  await expect(page.locator("#glance .tile").first()).toBeInViewport();
  await expect(page.locator("#match-note")).toHaveCount(0);
  expect(s.n).toBe(2);
});

test("Invest: rows use plain words for the kind of project, and every card is in the jump row", async ({ page }) => {
  await openPage(page);
  await new Steps(page).search("Echo Park");
  await page.locator("#btn-build-here").click();
  await expect(page.locator("#iv-build .iv-lede")).toContainText("Echo Park", { timeout: 30_000 });
  const chips = (await page.locator("#iv-build .iv-chip").allTextContents()).map((x) => x.trim());
  expect(chips.length).toBeGreaterThan(0);
  for (const c of chips) expect(["qol", "value", "owner", "policy", "regional"]).not.toContain(c);   // catalog codes, not words
  expect(await page.locator(".iv-nav button").allTextContents()).toEqual(["Where", "Build", "Properties", "This house", "Transit", "Courses of action"]);
  await page.locator('.iv-nav [data-iv-jump="iv-courses"]').click();
  await expect(page.locator("#iv-courses")).toBeInViewport();
});
