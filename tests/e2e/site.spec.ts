// Browser checks against the page served locally (scripts/serve.mjs). They avoid live third-party services where
// possible: the AI Worker is mocked, and the parcel checks call the page's own functions with fixed records.
import { expect, test, type Page } from "@playwright/test";

async function openPage(page: Page, path = "", { welcome = false } = {}) {
  const errors: string[] = [];
  if (!welcome) await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  return errors;
}

test("loads Los Angeles County without script errors", async ({ page }) => {
  const errors = await openPage(page);
  await expect(page.locator("#panel")).toContainText("BLOCK GROUP");
  await expect(page.locator("header h1")).not.toContainText("706");
  await expect(page.locator("#county-pick-label")).toHaveText("Los Angeles County, CA");
  expect(errors).toEqual([]);
});

test("does not download Orange County until it is opened", async ({ page }) => {
  let ocRequested = false;
  page.on("request", (r) => { if (r.url().includes("bundle-oc")) ocRequested = true; });
  await openPage(page);
  await page.waitForTimeout(2_000);
  expect(ocRequested).toBe(false);
  await page.click("#county-pick-btn");
  await page.fill("#county-q", "orange county ca");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as any).activeCounty === "oc", null, { timeout: 60_000 });
  await expect(page.locator("header h1")).toContainText("Orange County");
  await expect(page.locator("#county-pick-label")).toHaveText("Orange County, CA");
});

test("county picker lists and searches every county, LA and Orange County included", async ({ page }) => {
  await openPage(page);
  const { withData, lotsOnly } = await page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>("script.county-bundle")];
    return { withData: els.filter((e) => e.dataset.coverage !== "lots").length, lotsOnly: els.filter((e) => e.dataset.coverage === "lots").length };
  });
  await page.click("#county-pick-btn");
  await expect(page.locator("#county-pick-foot")).toHaveText(`${withData} counties with data · ${lotsOnly} with property lines only`);
  await expect(page.locator("#county-list .pick-tag", { hasText: "lot lines only" })).toHaveCount(lotsOnly);
  await page.fill("#county-q", "los angeles");
  await expect(page.locator("#county-list li[role=option]")).toContainText(["Los Angeles County, CA"]);
  await page.fill("#county-q", "district columbia");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "11001", null, { timeout: 60_000 });
  await expect(page.locator("#county-pick-label")).toHaveText("District of Columbia, DC");
  await page.click("#county-pick-btn");
  await page.fill("#county-q", "los angeles");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as any).activeCounty === "la", null, { timeout: 60_000 });
  await expect(page.locator("#county-pick-label")).toHaveText("Los Angeles County, CA");
});

test("welcome card shows once, and Surprise me flies somewhere new", async ({ page }) => {
  await openPage(page, "", { welcome: true });
  await expect(page.locator("#welcome")).toBeVisible();
  const before = await page.evaluate(() => (window as any).selected);
  await page.locator("#welcome").getByText("Surprise me").click();
  await expect(page.locator("#welcome")).toBeHidden();
  await page.waitForFunction((b) => (window as any).selected && (window as any).selected !== b, before, { timeout: 15_000 });
  await page.reload();
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  await expect(page.locator("#welcome")).toBeHidden();
});

test("withholds home values the model cannot support", async ({ page }) => {
  await openPage(page);
  const r = await page.evaluate(() => {
    const vc = (window as any).valuationCheck ?? (globalThis as any).valuationCheck;
    return {
      whiteHouse: vc({ UseType: "unknown", Roll_LandValue: 1189552600, Roll_ImpValue: 31176660 }, 774801, 1210000),
      office: vc({ UseType: "non-residential", UseDescription: "Office building" }, 9000, 900000),
      underRoll: vc({ UseType: "residential", Roll_TotalValue: 3000000 }, 6000, 1000000),
      house: vc({ UseType: "residential", UseDescription: "Single family residence", Roll_TotalValue: 450000 }, 6000, 1100000),
    };
  });
  expect(r.whiteHouse.ok).toBe(false);
  expect(r.office.ok).toBe(false);
  expect(r.underRoll.ok).toBe(false);
  expect(r.house.ok).toBe(true);
});

test("a numeric or blank use code is unknown, not commercial", async ({ page }) => {
  await openPage(page);
  const r = await page.evaluate(() => {
    const f = (window as any).parcelUseType ?? (globalThis as any).parcelUseType;
    return [f(""), f("0100"), f("SINGLE FAMILY"), f("Commercial retail")];
  });
  expect(r).toEqual(["unknown", "unknown", "residential", "non-residential"]);
});

test("names a block group after a label outside it as 'Near …'", async ({ page }) => {
  await openPage(page);
  await page.evaluate(() => (window as any).openCounty("11001"));
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "11001", null, { timeout: 60_000 });
  const name = await page.evaluate(() => (window as any).D_OC.features.find((f: any) => f.properties.id === "110019800001")?.properties.n);
  expect(name).toBe("Near The Wharf");
});

test("AI advisor says it is not connected and sends nothing", async ({ page }) => {
  let sent = false;
  page.on("request", (r) => { if (r.url().includes("/api/ai")) sent = true; });
  await openPage(page);
  await page.click("#btn-ai-header");
  await expect(page.locator("#ai-status-indicator")).toHaveText(/Not connected/);
  await page.fill("#ai-user-input", "What is the best investment here?");
  await page.press("#ai-user-input", "Enter");
  await expect(page.locator("#ai-chat-history")).toContainText("isn't connected yet");
  await expect(page.locator("#ai-chat-history")).not.toContainText("VERDICT");
  expect(sent).toBe(false);
});

test("AI advisor shows a Worker reply as text, not HTML", async ({ page }) => {
  await page.route("**/app/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.CITY_PRETTY_CONFIG = { workerUrl: "https://worker.test" };' }));
  await page.route("https://worker.test/api/health", (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"status":"ok","ai_advisor_ready":true}' }));
  let body: any = null;
  await page.route("https://worker.test/api/ai", (r) => {
    body = JSON.parse(r.request().postData() || "{}");
    return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, text: "**Trees** first.\n- <img src=x onerror=alert(1)>" }) });
  });
  await openPage(page);
  await page.click("#btn-ai-header");
  await expect(page.locator("#ai-status-indicator")).toHaveText(/Connected/);
  await page.fill("#ai-user-input", "Best investment?");
  await page.press("#ai-user-input", "Enter");
  await expect(page.locator("#ai-chat-history")).toContainText("Trees first.");
  await expect(page.locator("#ai-chat-history img")).toHaveCount(0);
  expect(Object.keys(body).sort()).toEqual(["context", "history", "promptKey", "question"]);
  expect(JSON.stringify(body)).not.toMatch(/systemPrompt|apiKey/);
});

test("fits a phone screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await openPage(page);
  const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth, mapTop: document.querySelector("#map")!.getBoundingClientRect().top }));
  expect(r.scroll).toBeLessThanOrEqual(r.width);
  expect(r.mapTop).toBeLessThan(420);
  await expect(page.locator("#metric")).toBeAttached();
  await expect(page.locator("#county-pick-btn")).toBeVisible();
  await expect(page.locator("#btn-ai-header")).toBeVisible();
  await ctx.close();
});

test("shows no emoji on the main screen or in the menus", async ({ page }) => {
  await openPage(page);
  await page.click("#tools-menu summary");
  const hits = await page.evaluate(() => {
    const re = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2714}\u{2716}\u{2718}-\u{27BF}\u{2B50}\u{2139}\u{231A}-\u{23FF}\u{FE0F}]/u;
    const out: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode.textContent || ""; if (re.test(t)) out.push(t.trim().slice(0, 60)); }
    return out;
  });
  expect(hits).toEqual([]);
});

test("header is one slim row on a laptop screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page);
  const h = await page.evaluate(() => document.querySelector("header.top")!.getBoundingClientRect().height);
  expect(h).toBeLessThan(70);
});

test("Explore mode explains ideas and neighborhoods without the map, and hands off to the map", async ({ page }) => {
  const errors = await openPage(page);
  await page.click("#view-switch [data-view=explore]");
  await expect(page.locator("#map")).toBeHidden();
  await expect(page.locator(".ex-title")).toHaveText("What could make Los Angeles County better?");
  // every idea card has a plain explanation
  const cards = page.locator(".ex-grid .ex-card");
  expect(await cards.count()).toBeGreaterThan(20);
  expect(await page.locator(".ex-grid .ex-card-plain:empty").count()).toBe(0);
  // ideas whose effect could not be sourced (e.g. street trees: its LA regression cannot be reproduced) are not offered
  await expect(page.locator(".ex-grid [data-ex-idea=street_trees]")).toHaveCount(0);
  // one idea, explained (traffic calming: effect and cost both verified in the 16 Nov 2026 audit)
  await page.click(".ex-grid [data-ex-idea=traffic_calming]");
  await expect(page.locator(".ex-detail h2")).toHaveText("Speed humps and traffic calming");
  await expect(page.locator(".ex-detail")).toContainText("Sourced inputs");
  await expect(page.locator(".ex-detail")).toContainText("Who decides");
  await expect(page.locator(".ex-rank li").first()).toBeVisible();
  // a neighborhood's story, then the same place on the map
  await page.click(".ex-rank [data-ex-area] >> nth=0");
  await expect(page.locator(".ex-short")).toContainText("every $1 spent adds about");
  const id = await page.locator(".ex-short [data-ex-map]").getAttribute("data-ex-map");
  await page.click(".ex-short [data-ex-map]");
  await expect(page.locator("#map")).toBeVisible();
  await page.waitForFunction((want) => (window as any).location.hash.includes("bg=" + want), id, { timeout: 20_000 });
  await expect(page.locator("#panel")).toContainText(id!);
  // the choice is remembered on the next visit
  await page.click("#view-switch [data-view=explore]");
  await page.reload();
  await expect(page.locator(".ex-title")).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("parcel and neighborhood panels render without invented figures", async ({ page }) => {
  const errors = await openPage(page);
  // A neighborhood (block group) panel: the first block group in the loaded county.
  await page.evaluate(() => { const w = window as any; const id = w.D.bgs.features[0].properties.id; w.select(id, false); });
  const panel = await page.locator("#panel").innerText();
  for (const bad of ["Synergy Simulator", "15.6%", "$1.62M", "+54%", "Private Dev IRR"]) expect(panel).not.toContain(bad);

  // A house panel from fixed records (no live services): zoning on file, a recent sale, no imagery dates.
  // LA has a real back-test (app/data/valuation_backtest_benchmarks.json); wait for it to load.
  await page.waitForFunction(() => (window as any).valuationBacktestFor && (window as any).valuationBacktestFor("06037"));
  const html = await page.evaluate(() => {
    const w = window as any;
    const box = document.createElement("div");
    document.body.appendChild(box);
    const a = { AIN: "0000000000", SitusFullAddress: "1 Test St", UseType: "Residential", UseDescription: "Single Family Residence", ZoneCode: "R1-1",
      Roll_LandValue: 400000, Roll_ImpValue: 150000, Roll_LandBaseYear: 2012, YearBuilt1: 1955, SQFTmain1: 1500, Bedrooms1: 3, Bathrooms1: 2,
      LastSalePrice: 1050000, LastSaleDate: "20260315" };
    const ll = { lat: 34.05, lng: -118.30 };
    const st = { osm: null, R: null, osmDone: true, rDone: true, manualStories: null };
    w.activeHouse = { box, a, lot: 6000, ll, st, tok: 1 };
    w.renderHouse(box, a, 6000, ll, st);
    return box.innerText;
  });
  // LA: a recorded 2026 sale is shown as the figure, labelled as a recorded sale.
  expect(html).toContain("Recorded sale price, 2026");
  // LA: a home without a recent transfer gets the back-tested model's estimate with its tested error; a home missing
  // an input the model needs gets no estimate and the reason.
  await page.waitForFunction(() => (0, eval)("typeof LA_NEIGHBORHOOD_VALUES !== 'undefined' && LA_NEIGHBORHOOD_VALUES !== null"));
  const la = await page.evaluate(() => {
    const w = window as any, ev = (s: string) => (0, eval)(s);
    const N = ev("LA_NEIGHBORHOOD_VALUES");
    const bg = Object.keys(N.bg).find((k) => N.bg[k][0] >= 20)!;
    const a = { AIN: "0000000001", UseType: "Residential", UseDescription: "Single Family Residence", Roll_LandValue: 90000, Roll_ImpValue: 60000,
      Roll_LandBaseYear: "1998", Roll_ImpBaseYear: "1998", YearBuilt1: "1952", EffectiveYear1: "1960", SQFTmain1: 1400, Bedrooms1: 3, Bathrooms1: 2, QualityClass1: "D6B", "Shape.STArea()": 6000 };
    const ok = w.publishValuation({ estimatedValue: 1, livingSqft: 1400 }, "06037", { rollBaseYear: 1998, rollTotal: 150000, attributes: a, lot: 6000, bg });
    const miss = w.publishValuation({ estimatedValue: 1 }, "06037", { rollBaseYear: 1998, rollTotal: 150000, attributes: { ...a, QualityClass1: "" }, lot: 6000, bg });
    return { ok, miss, nbr: N.bg[bg] };
  });
  expect(la.ok.estimatedValue).toBeGreaterThan(100000);
  expect(la.ok.estimatedValue).not.toBe(1); // never the generic estimate passed in
  expect(la.ok.confidenceRating).toMatch(/^Back-tested estimate: off by a median of 10\.4% on [\d,]+ LA homes that changed hands in 2025–26/);
  expect(la.miss.estimatedValue).toBeNull();
  expect(la.miss.withheldReason).toContain("quality class");
  // A county with no back-test shows no model estimate, only the closest sourced figure and the reason.
  const other = await page.evaluate(() => (window as any).publishValuation({ estimatedValue: 500000, confidenceRating: "Unvalidated estimate — no back-test against sales yet" }, "48453", { neighborhoodHv: 412300 }));
  expect(other.estimatedValue).toBeNull();
  expect(other.withheldReason).toContain("no back-test against recorded sales in this county");
  expect(other.withheldReason).toContain("$412,300");
  expect(other.withheldReason).toMatch(/Census ACS/);
  // A county whose back-test failed (Philadelphia: 18.7% median error, over the 15% cap) withholds with its numbers.
  const phl = await page.evaluate(() => (window as any).publishValuation({ estimatedValue: 250000 }, "42101", { neighborhoodHv: 230000 }));
  expect(phl.estimatedValue).toBeNull();
  expect(phl.withheldReason).toContain("Philadelphia County");
  expect(phl.withheldReason).toContain("18.7%");
  // Upgrade table rows are unsourced City Pretty estimates: listed by name, no cost/value/return/profit
  // (docs/audit/catalog-coverage-round2.md).
  expect(html).toContain("cost and value not sourced yet");
  for (const bad of ["Net Profit", "Return / $1", "All-In Cost", "Upgrades that pay back", "Best bet for this home", "(Compliant)", "Exempt (0 spaces)"]) {
    expect(html).not.toContain(bad);
  }
  for (const bad of ["High Precision", "RSMeans", "Verified Current Imagery", "Return per $1", "Estimated Net Equity", "± ", "Saves $", "Projected 25-year"]) {
    expect(html).not.toContain(bad);
  }
  expect(errors).toEqual([]);
});

// Verification gate (docs/audit/bundle-catalog-audit.md, app/data/intervention_verification.json): unverified
// interventions never show a dollar or $-per-$1 figure and are never the best bet.
test("block-group panel shows no numbers for unverified interventions and never picks one as best bet", async ({ page }) => {
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(eval("INTERVENTION_VERIFICATION")); } catch (e) { return false; } }, null, { timeout: 30_000 });
  const res = await page.evaluate(() => {
    const w = window as any;
    const ev = (s: string) => (0, eval)(s);
    const D = ev("D"), ivStatus = ev("ivStatus"), ivAllows = ev("ivAllows"), select = ev("select");
    // a block group whose rows include an unverified value item with a return of at least $1 per $1 before the gate
    const f = D.bgs.features.find((x: any) => {
      const d = D.details[x.properties.id]; if (!d || !d.r) return false;
      return d.r.some((a: any) => ivStatus(a[0]) === "unverified" && a[8] >= 1 && D.catalog[a[0]] && D.catalog[a[0]].kind === "value");
    });
    const id = f.properties.id, d = D.details[id], m = d.m || {};
    select(id, false);
    const panel = document.querySelector("#panel") as HTMLElement;
    const unverifiedNames = d.r.filter((a: any) => !ivAllows(a[0], m)).map((a: any) => D.catalog[a[0]] && D.catalog[a[0]].name).filter(Boolean);
    const cards = [...panel.querySelectorAll(".rec")].map((c) => ({ name: (c.querySelector(".nm") as HTMLElement)?.textContent || "", text: (c as HTMLElement).innerText }));
    const best = panel.querySelector("[data-best-bet]")?.getAttribute("data-best-bet") || "";
    const other = [...panel.querySelectorAll("[data-other-ideas] li")].map((li) => li.textContent || "");
    return {
      id, best, bestStatus: best ? ivStatus(best) : null,
      leaked: cards.filter((c) => unverifiedNames.includes(c.name)).map((c) => c.name),
      otherHasNumbers: other.some((t) => /\$\s?\d/.test(t)),
      otherListsUnverified: unverifiedNames.some((n: string) => other.some((t) => t.startsWith(n))),
      profitShown: /Profit potential:/.test(panel.innerText),
      mapBestUnverified: D.bgs.features.filter((x: any) => x.properties.t && ivStatus(x.properties.t) === "unverified").length,
    };
  });
  expect(res.leaked).toEqual([]);
  expect(res.bestStatus === null || res.bestStatus !== "unverified").toBe(true);
  expect(res.otherListsUnverified).toBe(true);
  expect(res.otherHasNumbers).toBe(false);
  expect(res.profitShown).toBe(false);
  expect(res.mapBestUnverified).toBe(0);
  expect(errors).toEqual([]);
});

test("a non-LA county's best bets and panels are verification-gated (Travis County, TX)", async ({ page }) => {
  await openPage(page);
  await page.click("#county-pick-btn");
  await page.fill("#county-q", "travis");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "48453", null, { timeout: 60_000 });
  const res = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    const D_OC = ev("D_OC"), ivStatus = ev("ivStatus"), select = ev("select");
    const feats = D_OC.features;
    const badMap = feats.filter((f: any) => f.properties.t && ivStatus(f.properties.t) === "unverified").length;
    const id = feats[0].properties.id;
    select(id, false);
    const t = (document.querySelector("#panel") as HTMLElement).innerText;
    return { badMap, localSales: /local sales estimate/.test(t), gradeChipAlone: /\bevidence [A-DU]\b/.test(t) };
  });
  expect(res.badMap).toBe(0);
  expect(res.localSales).toBe(false);
  expect(res.gradeChipAlone).toBe(false);
});

test("median rent is shown to the dollar, not rounded to thousands (Travis County block group)", async ({ page }) => {
  // The live panel check (16 Nov 2026) found a $2,356 Census median rent shown as "$2k/mo".
  const errors = await openPage(page);
  await page.evaluate(() => (0, eval)("openCounty")("48453"));
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "48453", null, { timeout: 60_000 });
  const r = await page.evaluate(() => {
    const D_OC = (window as any).D_OC;
    const id = D_OC.features.map((f: any) => f.properties.id).find((i: string) => { const m = (D_OC.details[i] || {}).m || {}; return m.rent && m.rent % 1000 > 100 && m.rent % 1000 < 900; });
    (0, eval)("select")(id, false);
    return { rent: D_OC.details[id].m.rent, text: (document.querySelector("#panel") as HTMLElement).textContent!.replace(/\s+/g, " ") };
  });
  expect(r.text).toContain(`Median rent$${Math.round(r.rent).toLocaleString("en-US")}/mo`);
  expect(r.text).not.toMatch(/Median rent\$\d+k\/mo/);
  expect(errors).toEqual([]);
});

test("house panel shows live public records with links, from the agencies (responses mocked from real captures)", async ({ page }) => {
  const fx = (n: string) => require("fs").readFileSync(require("path").join(__dirname, "../fixtures/sources", n), "utf8");
  const serve = (body: string) => (route: any) => route.fulfill({ status: 200, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
  await page.route(/tigerweb\.geo\.census\.gov\/.*MapServer\/10\/query/, serve(fx("tiger_bg_austin.json")));
  await page.route(/tigerweb\.geo\.census\.gov\/.*MapServer\/82\/query/, serve(fx("tiger_county_austin.json")));
  await page.route(/hazards\.fema\.gov\/.*NFHL\/MapServer\/28\/query/, serve(fx("fema_flood_austin.json")));
  await page.route(/epqs\.nationalmap\.gov/, serve(fx("usgs_elev_austin.json")));
  const errors = await openPage(page);
  await page.waitForFunction(() => !!(window as any).CityPrettyFacts);
  const text = await page.evaluate(async () => {
    const w = window as any;
    const box = document.createElement("div");
    document.body.appendChild(box);
    const a = { AIN: "0000000000", SitusFullAddress: "811 E 41st St", UseType: "Residential", UseDescription: "Single Family Residence", Roll_LandValue: 400000, Roll_ImpValue: 150000, Roll_LandBaseYear: 2012, YearBuilt1: 1955, SQFTmain1: 1500 };
    const ll = { lat: 30.3005, lng: -97.724 };
    const st = { osm: null, R: null, osmDone: true, rDone: true, manualStories: null };
    w.activeHouse = { box, a, lot: 6000, ll, st, tok: 1 };
    w.renderHouse(box, a, 6000, ll, st);
    for (let i = 0; i < 50 && !box.querySelector("[data-live-facts]"); i++) await new Promise((r) => setTimeout(r, 100));
    const el = box.querySelector("[data-live-facts]") as HTMLElement | null;
    return el ? { text: el.innerText, links: [...el.querySelectorAll("a")].map((x) => (x as HTMLAnchorElement).href) } : null;
  });
  expect(text).not.toBeNull();
  expect(text!.text).toContain("Travis County");
  expect(text!.text).toContain("2 bed $1,817");   // HUD FY2027, from the page's county file
  expect(text!.text).toContain("Zone AE");
  expect(text!.links.some((l) => l.includes("hazards.fema.gov"))).toBe(true);
  expect(errors).toEqual([]);
});

test("tax-increment section: California computes from the roll; Texas shows no dollar figure without local rates", async ({ page }) => {
  const errors = await openPage(page);
  const la = await page.evaluate(() => {
    const w = window as any;
    const id = w.D.bgs.features.find((f: any) => ((w.D.details[f.properties.id] || {}).m || {}).e)?.properties.id || w.D.bgs.features[0].properties.id;
    w.select(id, false);
    const t = (document.querySelector("#panel") as HTMLElement).textContent || "";   // the calculator sits in a closed <details>
    return { t, out: (document.querySelector("#e-out") as HTMLElement | null)?.textContent || "" };
  });
  expect(la.t).toContain("EIFD calculator");
  expect(la.out).toMatch(/Bond capacity|Not computed/);
  for (const bad of ["AAA Muni", "High Velocity", "Rate Lock-in", "estimated as 55% of market value", "Tax shares are placeholders"]) expect(la.t).not.toContain(bad);

  await page.click("#county-pick-btn");
  await page.fill("#county-q", "travis");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "48453", null, { timeout: 60_000 });
  const tx = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    ev("select")(ev("D_OC").features[0].properties.id, false);
    return (document.querySelector("#panel") as HTMLElement).textContent || "";
  });
  // Texas's five state rules were confirmed in round 3 (docs/audit/laws-finance-audit.md); local rates and pledge
  // shares are still not on file, so there is still no dollar figure.
  expect(tx).toMatch(/Not computed: Texas's state rules are confirmed, but local tax rates and pledge shares are not on file/);
  expect(tx).not.toMatch(/Bond capacity\s*\$/);
  expect(errors).toEqual([]);
});

test("LA crash text uses the rebuilt counts, states the boundary rule and the coordinate gap", async ({ page }) => {
  const errors = await openPage(page);
  const out = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    const w = window as any;
    const id = w.D.bgs.features[0].properties.id;
    w.select(id, false);
    ev("CRASH_COUNTS")["06037"] = { [id]: [4, 2, 37], _meta: { crashes: 100, with_coordinates: 74, source: "CHP California Crash Reporting System (CCRS)", years: [2023, 2025], script: "scripts/build_crash_counts_ca.py" } };
    return ev("whyFix")("12 pedestrian or bike crashes recorded");
  });
  expect(out).toContain("37 crashes recorded inside this block group or on its boundary streets");
  expect(out).toContain("4 involving a pedestrian or cyclist");
  expect(out).toContain("only the 74% of this county's crashes that have coordinates");
  expect(out).not.toContain("12 ");
  // A state map-service source (Tennessee): its own noun, and the unlocated-crash caveat even though every returned row has a location.
  const tn = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    ev("CRASH_COUNTS")["47037"] = { "470370101001": [1, 2, 9], _meta: { crashes: 50, with_coordinates: 50, source: "Tennessee TITAN injury crash records", years: [2022, 2024], fields: ["pedestrian or bicycle crashes", "killed or seriously injured crashes", "injury or fatal crashes"], script: "scripts/build_state_crash_counts.py" } };
    return ev("crashTextFor")("47037", "470370101001");
  });
  expect(tn).toContain("9 injury or fatal crashes recorded");
  expect(tn).toContain("without a location are not counted");
  expect(errors).toEqual([]);
});

test("a sourced-effect override rescales the value and shows its citation (street lighting, LA)", async ({ page }) => {
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("INTERVENTION_VERIFICATION"); } catch { return false; } }, null, { timeout: 30_000 });
  const res = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    // its street_lighting row was built with +1.358% and survives the crash recompute (060371242041's row is now dropped:
    // with complete CCRS counts it no longer has the 3 pedestrian/cyclist crashes the row requires)
    const id = "060374013113";
    ev("select")(id, false);
    const panel = document.querySelector("#panel") as HTMLElement;
    const row = (ev("D").details[id].r || []).find((a: any) => a[0] === "street_lighting");
    return { html: panel.innerHTML, raw: row, adj: ev("ivRow")(row) };
  });
  expect(res.raw[9]).toBe(1.358);
  expect(res.adj[9]).toBe(0.6);
  expect(res.adj[7]).toBe(Math.round((res.raw[7] * 0.6) / 1.358));
  expect(res.html).toContain('data-sourced-effect="street_lighting"');
  expect(res.html).toContain("Pope &amp; Pope");
  expect(errors).toEqual([]);
});

test("round-4 overrides: EV hub effect and construction cost, and school bonds at $1.50 per $1 (LA rows)", async ({ page }) => {
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("INTERVENTION_VERIFICATION"); } catch { return false; } }, null, { timeout: 30_000 });
  const res = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    const id = "060372044201";   // has an ev_hub row (+1.0%, $800,000 capex) and a school_bond row (+3.0%)
    ev("select")(id, false);
    const rows = ev("D").details[id].r || [];
    const evr = rows.find((a: any) => a[0] === "ev_hub"), sb = rows.find((a: any) => a[0] === "school_bond");
    return { evr, evAdj: ev("ivRow")(evr), sb, sbAdj: ev("ivRow")(sb) };
  });
  // EV: value scaled 3.3/1.0; cost swaps the $800,000 capex for the sourced $1,777,000 (upkeep and land kept)
  expect(res.evAdj[7]).toBe(Math.round(res.evr[7] * 3.3 / res.evr[9]));
  expect(res.evAdj[3]).toBe(res.evr[3] - res.evr[4] + 1777000);
  expect(res.evAdj[8]).toBeCloseTo(res.evAdj[7] / res.evAdj[3], 3);
  // School bond: value = $1.50 per $1 of its own cost
  expect(res.sbAdj[7]).toBe(Math.round(res.sb[3] * 1.5));
  expect(res.sbAdj[8]).toBe(1.5);
  expect(errors).toEqual([]);
});

test("California blanks are filled with the Census tract value, labelled as such (bundle_corrections.json)", async ({ page }) => {
  const errors = await openPage(page);
  const r = await page.evaluate(async () => {
    const ev = (s: string) => (0, eval)(s);
    const B: any = { details: { "060014087005": { m: { hv: null, rent: 1500 } }, "060014041012": { m: { hv: 1286100, hvs: "block group" } } } };
    await ev("applyBundleCorrections")(B);
    return { filled: B.details["060014087005"].m, kept: B.details["060014041012"].m };
  });
  expect(r.filled.hv).toBe(699900);
  expect(r.filled.hvs).toMatch(/surrounding Census tract/);
  expect(r.filled.rent).toBe(1500);          // an existing value is never overwritten
  expect(r.kept.hv).toBe(1286100);
  expect(errors).toEqual([]);
});

test("crash comparisons use the rebuilt counts in a California and a Pennsylvania county, never the old ranking", async ({ page }) => {
  const errors = await openPage(page);
  // Los Angeles (CCRS; complete pedestrian/cyclist count since round 4, from the Parties and injured-persons tables):
  // 060372046001's old text said 134 such crashes.
  const la = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    ev("select")("060372046001", false);
    return (document.querySelector("#panel") as HTMLElement).textContent || "";   // the gap list can sit in a closed section
  });
  expect(la).toContain("inside this block group or on its boundary streets (CHP CCRS 2023–2025");
  expect(la).not.toContain("undercounts pedestrian and cyclist crashes");   // no longer a lower bound
  expect(la).not.toContain("crashes that injured someone walking or biking on record here");

  // Allegheny County, PA: 420035153001's old text said 12 crashes over 2017-2023.
  await page.click("#county-pick-btn");
  await page.fill("#county-q", "allegheny");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "42003", null, { timeout: 60_000 });
  const pa = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    ev("select")("420035153001", false);
    const d = ev("D_OC").details;
    return {
      text: (document.querySelector("#panel") as HTMLElement).textContent || "",
      // a block group whose rebuilt 2021-2023 count no longer qualifies for traffic calming
      dropped: (d["420035162002"].r || []).some((r: any) => r[0] === "traffic_calming"),
    };
  });
  expect(pa.text).toContain("4 crashes involving a pedestrian or cyclist inside this block group or on its boundary streets");
  expect(pa.text).not.toContain("crashes injured people walking or biking here");
  expect(pa.dropped).toBe(false);
  expect(errors).toEqual([]);
});

test("a county with crash data but no recomputed comparison shows a withheld note, not the old ranking", async ({ page }) => {
  const errors = await openPage(page);
  const r = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    const det: any = { a: { m: { gp: { g: [["pedbike", "9", "2", 0.9, "protected_bike", "9 crashes injured people walking or biking here (similar neighborhoods: 2).", 1]], s: [] } }, r: [] } };
    ev("applyCrashGaps")(det, null);
    return det.a.m.gp;
  });
  expect(r.g).toEqual([]);
  expect(r.pedbike_withheld).toBe(true);
  expect(errors).toEqual([]);
});

test("DC: the page computes exactly the back-tested model, and shows its tested error", async ({ page }) => {
  const fs = require("fs"), path = require("path"), zlib = require("zlib");
  const root = path.join(__dirname, "../..");
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/backtests/county_config.json"), "utf8"))["11001"];
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, cfg.sales_file))).toString());
  const rows = data.rows.filter((r: any) => r.date >= cfg.test[0] && r.date <= cfg.test[1]).slice(0, 120);
  // @ts-ignore plain ES module
  const M = await import("../../scripts/lib/countyValuationModels.mjs");
  const C = JSON.parse(fs.readFileSync(path.join(root, "app/data/county_valuation_models.json"), "utf8")).counties["11001"];
  const toMap = (o: any) => new Map(Object.entries(o).map(([k, v]: any) => [k, { n: v[0], median: v[1], ppsf: v[2], d0: v[3], d1: v[4], ids: new Set() }]));
  const p = M.predictor(C.model, { bg: toMap(C.stats.bg), tract: toMap(C.stats.tract) });
  const expected = rows.map((r: any) => p(r));
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS") && !!(0, eval)("VALUATION_BACKTEST_BENCHMARKS"); } catch { return false; } }, null, { timeout: 30_000 });
  const attrs = (r: any) => ({ CAMA_GBA: r.sqft, CAMA_LANDAREA: r.lot, CAMA_AYB: r.yb, CAMA_BEDRM: r.beds, CAMA_BATHRM: Math.floor(r.baths), CAMA_HF_BATHRM: (r.baths % 1) ? 1 : 0 });
  const got = await page.evaluate((rs: any[]) => rs.map((x) => {
    const e = (0, eval)("countyModelEstimate")("11001", x.a, x.bg);
    return e.raw || null;
  }), rows.map((r: any) => ({ a: attrs(r), bg: r.bg })));
  let compared = 0;
  rows.forEach((r: any, i: number) => {
    if (expected[i] == null) { expect(got[i]).toBeNull(); return; }
    expect(Math.abs(got[i] / expected[i] - 1)).toBeLessThan(1e-9);
    compared++;
  });
  expect(compared).toBeGreaterThan(80);
  // published wording: the estimate carries its tested error
  const shown = await page.evaluate((x: any) => (window as any).publishValuation({ estimatedValue: 1, livingSqft: x.sqft }, "11001", { attributes: x.a, bg: x.bg }),
    { a: attrs(rows[0]), bg: rows[0].bg, sqft: rows[0].sqft });
  expect(shown.estimatedValue).toBeGreaterThan(10000);
  expect(shown.confidenceRating).toMatch(/^Back-tested estimate: off by a median of 10\.7% on [\d,]+ District of Columbia sales/);
  // Cook County failed its back-test: withheld with its numbers
  const cook = await page.evaluate(() => (window as any).publishValuation({ estimatedValue: 300000 }, "17031", {}));
  expect(cook.estimatedValue).toBeNull();
  expect(cook.withheldReason).toContain("18.6%");
  expect(errors).toEqual([]);
});

test("NYC: Queens and Staten Island compute exactly the back-tested PLUTO model; Brooklyn, Bronx and Manhattan are withheld", async ({ page }) => {
  const fs = require("fs"), path = require("path"), zlib = require("zlib");
  const root = path.join(__dirname, "../..");
  // @ts-ignore plain ES module
  const M = await import("../../scripts/lib/countyValuationModels.mjs");
  const allModels = JSON.parse(fs.readFileSync(path.join(root, "app/data/county_valuation_models.json"), "utf8")).counties;
  const toMap = (o: any) => new Map(Object.entries(o).map(([k, v]: any) => [k, { n: v[0], median: v[1], ppsf: v[2], d0: v[3], d1: v[4], ids: new Set() }]));
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS") && !!(0, eval)("VALUATION_BACKTEST_BENCHMARKS"); } catch { return false; } }, null, { timeout: 30_000 });
  for (const fips of ["36081", "36085"]) {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/backtests/county_config.json"), "utf8"))[fips];
    const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, cfg.sales_file))).toString());
    const rows = data.rows.filter((r: any) => r.date >= cfg.test[0] && r.date <= cfg.test[1]).slice(0, 150);
    const C = allModels[fips];
    const p = M.predictor(C.model, { bg: toMap(C.stats.bg), tract: toMap(C.stats.tract) });
    const expected = rows.map((r: any) => p(r));
    // MapPLUTO field names, exactly as the page's parcel layer returns them
    const attrs = (r: any) => ({ BldgArea: r.sqft, LotArea: r.lot, YearBuilt: r.yb, UnitsRes: r.units });
    const got = await page.evaluate(([f, rs]: any) => rs.map((x: any) => (0, eval)("countyModelEstimate")(f, x.a, x.bg).raw || null), [fips, rows.map((r: any) => ({ a: attrs(r), bg: r.bg }))]);
    let compared = 0;
    rows.forEach((r: any, i: number) => {
      if (expected[i] == null) { expect(got[i]).toBeNull(); return; }
      expect(Math.abs(got[i] / expected[i] - 1)).toBeLessThan(1e-9);
      compared++;
    });
    expect(compared).toBeGreaterThan(100);
  }
  const si = await page.evaluate(() => (window as any).publishValuation({ estimatedValue: 1, livingSqft: 1500 }, "36085", { attributes: { BldgArea: 1500, LotArea: 4000, YearBuilt: 1975, UnitsRes: 1 }, bg: Object.keys((0, eval)("COUNTY_VALUATION_MODELS").counties["36085"].stats.bg)[0] }));
  expect(si.estimatedValue).toBeGreaterThan(10000);
  expect(si.confidenceRating).toMatch(/^Back-tested estimate: off by a median of 13\.1% on [\d,]+ Richmond County/);
  // A three-family lot is outside what was tested: withheld with the reason
  const three = await page.evaluate(() => (window as any).countyModelEstimate("36085", { BldgArea: 2500, LotArea: 3000, YearBuilt: 1960, UnitsRes: 3 }, null));
  expect(three.value).toBeNull();
  expect(three.reason).toMatch(/one- or two-family/);
  for (const [f, pct] of [["36047", "18.1%"], ["36005", "17.9%"]]) {   // Bronx 0.1785: the page rounds half up
    const w = await page.evaluate((x: string) => (window as any).publishValuation({ estimatedValue: 500000 }, x, {}), f);
    expect(w.estimatedValue).toBeNull();
    expect(w.withheldReason).toContain(pct);
  }
  const mn = await page.evaluate(() => (window as any).publishValuation({ estimatedValue: 500000 }, "36061", {}));
  expect(mn.estimatedValue).toBeNull();
  expect(errors).toEqual([]);
});

test("Hillsborough FL: the page computes exactly the back-tested model from the statewide parcel fields, only on the 2026 roll and use code 001", async ({ page }) => {
  const fs = require("fs"), path = require("path"), zlib = require("zlib");
  const root = path.join(__dirname, "../..");
  // @ts-ignore plain ES module
  const M = await import("../../scripts/lib/countyValuationModels.mjs");
  const C = JSON.parse(fs.readFileSync(path.join(root, "app/data/county_valuation_models.json"), "utf8")).counties["12057"];
  const toMap = (o: any) => new Map(Object.entries(o).map(([k, v]: any) => [k, { n: v[0], median: v[1], ppsf: v[2], d0: v[3], d1: v[4], ids: new Set() }]));
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS") && !!(0, eval)("VALUATION_BACKTEST_BENCHMARKS"); } catch { return false; } }, null, { timeout: 30_000 });
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/backtests/county_config.json"), "utf8"))["12057"];
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, cfg.sales_file))).toString());
  const rows = data.rows.filter((r: any) => r.date >= cfg.test[0] && r.date <= cfg.test[1]).slice(0, 200);
  const p = M.predictor(C.model, { bg: toMap(C.stats.bg), tract: toMap(C.stats.tract) });
  const expected = rows.map((r: any) => p(r));
  // Florida statewide cadastral field names, exactly as the page's parcel layer returns them
  const attrs = (r: any) => ({ TOT_LVG_AR: r.sqft, LND_SQFOOT: r.lot, ACT_YR_BLT: r.yb, NO_RES_UNT: r.units, JV: r.av, ASMNT_YR: 2026, DOR_UC: "001" });
  const got = await page.evaluate((rs: any) => rs.map((x: any) => (0, eval)("countyModelEstimate")("12057", x.a, x.bg).raw || null), rows.map((r: any) => ({ a: attrs(r), bg: r.bg })));
  let compared = 0;
  rows.forEach((r: any, i: number) => {
    if (expected[i] == null) { expect(got[i]).toBeNull(); return; }
    expect(Math.abs(got[i] / expected[i] - 1)).toBeLessThan(1e-9);
    compared++;
  });
  expect(compared).toBeGreaterThan(150);
  const bg = Object.keys(C.stats.bg)[0];
  const base = { TOT_LVG_AR: 1800, LND_SQFOOT: 7500, ACT_YR_BLT: 1995, NO_RES_UNT: 1, JV: 350000, ASMNT_YR: 2026, DOR_UC: "001" };
  const v = await page.evaluate(([a, b]: any) => (window as any).publishValuation({ estimatedValue: 1, livingSqft: 1800 }, "12057", { attributes: a, bg: b }), [base, bg]);
  expect(v.estimatedValue).toBeGreaterThan(10000);
  expect(v.confidenceRating).toMatch(/^Back-tested estimate: off by a median of 9\.7% on [\d,]+ Hillsborough County/);
  // A just value from another roll, or a parcel that isn't a single-family home, is outside what was tested
  const oldRoll = await page.evaluate(([a, b]: any) => (window as any).countyModelEstimate("12057", { ...a, ASMNT_YR: 2025 }, b), [base, bg]);
  expect(oldRoll.value).toBeNull();
  expect(oldRoll.reason).toMatch(/2026 roll/);
  const condo = await page.evaluate(([a, b]: any) => (window as any).countyModelEstimate("12057", { ...a, DOR_UC: "004" }, b), [base, bg]);
  expect(condo.value).toBeNull();
  expect(condo.reason).toMatch(/use code 001/);
  expect(errors).toEqual([]);
});

test("King County: the page computes exactly the tested model from the WA statewide value, and withholds without it; Allegheny failed and is withheld", async ({ page }) => {
  const fs = require("fs"), path = require("path"), zlib = require("zlib");
  const root = path.join(__dirname, "../..");
  // @ts-ignore plain ES module
  const M = await import("../../scripts/lib/countyValuationModels.mjs");
  const C = JSON.parse(fs.readFileSync(path.join(root, "app/data/county_valuation_models.json"), "utf8")).counties["53033"];
  const toMap = (o: any) => new Map(Object.entries(o).map(([k, v]: any) => [k, { n: v[0], median: v[1], ppsf: v[2], d0: v[3], d1: v[4], ids: new Set() }]));
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS") && !!(0, eval)("VALUATION_BACKTEST_BENCHMARKS"); } catch { return false; } }, null, { timeout: 30_000 });
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/backtests/county_config.json"), "utf8"))["53033"];
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, cfg.sales_file))).toString());
  const rows = data.rows.filter((r: any) => r.date >= cfg.test[0] && r.date <= cfg.test[1] && r.av > 0).slice(0, 200);
  const p = M.predictor(C.model, { bg: toMap(C.stats.bg), tract: toMap(C.stats.tract) });
  const got = await page.evaluate((rs: any) => rs.map((x: any) => (0, eval)("countyModelEstimate")("53033", x.a, x.bg).raw || null), rows.map((r: any) => ({ a: { PIN: r.id, WA_AV: r.av }, bg: r.bg })));
  let compared = 0;
  rows.forEach((r: any, i: number) => {
    const e = p({ ...r, av_date: "2000-01-01" });
    if (e == null) { expect(got[i]).toBeNull(); return; }
    expect(Math.abs(got[i] / e - 1)).toBeLessThan(1e-9);
    compared++;
  });
  expect(compared).toBeGreaterThan(150);
  const bg = Object.keys(C.stats.bg)[0];
  const shown = await page.evaluate((b) => (window as any).publishValuation({ estimatedValue: 1, livingSqft: 2000 }, "53033", { attributes: { PIN: "x", WA_AV: 850000 }, bg: b }), bg);
  expect(shown.estimatedValue).toBeGreaterThan(10000);
  expect(shown.confidenceRating).toMatch(/off by a median of 8\.8% on [\d,]+ King County/);
  const king = await page.evaluate(() => (window as any).publishValuation({ estimatedValue: 900000, livingSqft: 2000 }, "53033", { attributes: { PIN: "8682250170", ZONING: "R6" }, bg: "530330001001" }));
  expect(king.estimatedValue).toBeNull();
  expect(king.withheldReason).toMatch(/appraised value/);
  // A stale or failing statewide-layer check stops the estimate.
  const stale = await page.evaluate((b) => { const C = (0, eval)("COUNTY_VALUATION_MODELS").counties["53033"]; const k = C.input_check; C.input_check = { ...k, checked_on: "2025-01-01" };
    const r = (0, eval)("countyModelEstimate")("53033", { WA_AV: 850000 }, b); C.input_check = k; return r; }, bg);
  expect(stale.value).toBeNull();
  expect(stale.reason).toMatch(/re-run scripts\/backtests\/check_king_statewide_values\.py/);
  const al = await page.evaluate(() => (window as any).publishValuation({ estimatedValue: 300000 }, "42003", {}));
  expect(al.estimatedValue).toBeNull();
  expect(al.withheldReason).toContain("16.3%");
  expect(errors).toEqual([]);
});

test("San Francisco crash text uses DataSF's counts: injury crashes, measured located share, lower-bound note", async ({ page }) => {
  const fs = require("fs"), path = require("path");
  const sf = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/crash_counts/06075.json"), "utf8"));
  const bg = Object.keys(sf).find((k) => k !== "_meta" && sf[k][2] > 0) as string;
  const errors = await openPage(page);
  const out = await page.evaluate(([data, id]: any) => {
    const ev = (s: string) => (0, eval)(s);
    ev("CRASH_COUNTS")["06075"] = data;
    return ev("crashTextFor")("06075", id);
  }, [sf, bg]);
  expect(out).toContain(`${sf[bg][2]} injury or fatal crashes recorded inside this block group or on its boundary streets`);
  expect(out).toContain("only the 96% of this source's crashes that have a location can be placed");
  expect(out).toContain("lower bound");
  expect(errors).toEqual([]);
});

test("current Tree Equity canopy gap replaces the 2021 value, is labelled with its release, and withholds the old comparison", async ({ page }) => {
  const fs = require("fs"), path = require("path");
  const te = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/tree_equity_2025/48453.json"), "utf8"));
  const bg = Object.keys(te).find((k) => k !== "_meta" && te[k][0] != null) as string;
  const errors = await openPage(page);
  const r = await page.evaluate(([data, id]: any) => {
    const ev = (s: string) => (0, eval)(s);
    const det: any = { [id]: { m: { tg: 0, ht: 1.5, gp: { g: [], s: [["canopy", "0 pts below goal", "21 pts below goal"]] } }, r: [] } };
    ev("applyTreeEquity")(det, data);
    const m = det[id].m;
    return { m, html: ev("gapSection")({ n: "x", c: "y" }, m) };
  }, [te, bg]);
  expect(r.m.tg).toBe(te[bg][0]);
  expect(r.m.tg_2021).toBe(0);
  expect(r.m.ht).toBe(1.5); // heat untouched
  expect(r.m.tg_src).toMatch(/^Tree Equity Score 20(25|26) release \(file dated 20(25|26)-\d{2}-\d{2}\), 2020 block groups$/);
  expect(r.m.gp.s).toEqual([]);
  expect(r.html).toContain("data-canopy-withheld");
  expect(r.html).not.toContain("0 pts below goal");
  expect(errors).toEqual([]);
});

test("live parcel path: the service's own fields survive normalization, and an input layer is merged (Miami-Dade, King)", async ({ page }) => {
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS"); } catch { return false; } }, null, { timeout: 30_000 });
  // Florida statewide fields as the service returns them; before 16 Nov they were dropped by normalizeParcelFeature.
  const flAttrs = { PARCEL_ID: "1", PHY_ADDR1: "1 TEST ST", DOR_UC: "001", JV: 400000, ASMNT_YR: 2026, ACT_YR_BLT: 1990, LND_SQFOOT: 6000, NO_RES_UNT: 1, TOT_LVG_AR: 1700 };
  const r = await page.evaluate((a) => {
    const ev = (s: string) => (0, eval)(s);
    const p = ev("normalizeParcelFeature")({ attributes: a, geometry: null }, { lat: 27.95, lng: -82.46 }, { name: "Florida Statewide Parcels", fields: [] });
    const C = ev("COUNTY_VALUATION_MODELS").counties["12057"];
    return { kept: ["TOT_LVG_AR", "LND_SQFOOT", "ACT_YR_BLT", "NO_RES_UNT", "ASMNT_YR", "DOR_UC"].every((k) => p.attributes[k] === (a as any)[k]), est: ev("countyModelEstimate")("12057", p.attributes, Object.keys(C.stats.bg)[0]) };
  }, flAttrs);
  expect(r.kept).toBe(true);
  expect(r.est.value).toBeGreaterThan(10000);
  // King: the WA statewide layer read by PIN; WA_AV = VALUE_LAND + VALUE_BLDG.
  await page.route(/Current_Parcels\/FeatureServer\/0\/query/, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ features: [{ attributes: { ORIG_PARCEL_ID: "8682250170", VALUE_LAND: 500000, VALUE_BLDG: 350000 } }] }) }));
  const king = await page.evaluate(async () => {
    const parcel: any = { attributes: { PIN: "8682250170" } };
    await (0, eval)("enrichFromInputLayer")(parcel, { lat: 47.6, lng: -122.3 }, "53033");
    return parcel.attributes;
  });
  expect(king.WA_AV).toBe(850000);
  expect(king.INPUT_LAYER_SOURCE).toMatch(/Current_Parcels/);
  // Miami-Dade: the Florida statewide layer at the point.
  await page.route(/Florida_Statewide_Cadastral\/FeatureServer\/0\/query/, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ features: [{ attributes: flAttrs }] }) }));
  const md = await page.evaluate(async () => {
    const parcel: any = { attributes: { ZONING: "RU-1" } };
    await (0, eval)("enrichFromInputLayer")(parcel, { lat: 25.76, lng: -80.19 }, "12086");
    return parcel.attributes;
  });
  expect(md.TOT_LVG_AR).toBe(1700);
  expect(md.ASMNT_YR).toBe(2026);
  expect(errors).toEqual([]);
});

for (const fips of ["12086", "12011", "12031", "12095", "12099", "12103"]) {
  test(`${fips}: the page computes exactly the back-tested Florida model`, async ({ page }) => {
    const fs = require("fs"), path = require("path"), zlib = require("zlib");
    const root = path.join(__dirname, "../..");
    // @ts-ignore plain ES module
    const M = await import("../../scripts/lib/countyValuationModels.mjs");
    const C = JSON.parse(fs.readFileSync(path.join(root, "app/data/county_valuation_models.json"), "utf8")).counties[fips];
    const toMap = (o: any) => new Map(Object.entries(o).map(([k, v]: any) => [k, { n: v[0], median: v[1], ppsf: v[2], d0: v[3], d1: v[4], ids: new Set() }]));
    const errors = await openPage(page);
    await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS"); } catch { return false; } }, null, { timeout: 30_000 });
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/backtests/county_config.json"), "utf8"))[fips];
    const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, cfg.sales_file))).toString());
    const rows = data.rows.filter((r: any) => r.date >= cfg.test[0] && r.date <= cfg.test[1]).slice(0, 200);
    const p = M.predictor(C.model, { bg: toMap(C.stats.bg), tract: toMap(C.stats.tract) });
    const attrs = (r: any) => ({ TOT_LVG_AR: r.sqft, LND_SQFOOT: r.lot, ACT_YR_BLT: r.yb, NO_RES_UNT: r.units, JV: r.av, ASMNT_YR: 2026, DOR_UC: "001" });
    const got = await page.evaluate(([f, rs]: any) => rs.map((x: any) => (0, eval)("countyModelEstimate")(f, x.a, x.bg).raw || null), [fips, rows.map((r: any) => ({ a: attrs(r), bg: r.bg }))]);
    let compared = 0;
    rows.forEach((r: any, i: number) => {
      const e = p(r);
      if (e == null) { expect(got[i]).toBeNull(); return; }
      expect(Math.abs(got[i] / e - 1)).toBeLessThan(1e-9);
      compared++;
    });
    expect(compared).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  });
}

test("house block group: a feature without geometry doesn't stop the search (every non-LA house used to get the selected block group)", async ({ page }) => {
  const errors = await openPage(page);
  const r = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    const w = window as any;
    const f0 = w.D.bgs.features.find((f: any) => f.geometry && f.geometry.type === "Polygon");
    const ring = f0.geometry.coordinates[0];
    let pt: any = null;
    const xs = ring.map((p: any) => p[0]), ys = ring.map((p: any) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (let i = 1; i < 20 && !pt; i++) for (let j = 1; j < 20 && !pt; j++) {
      const x = x0 + ((x1 - x0) * i) / 20, y = y0 + ((y1 - y0) * j) / 20;
      if (ev("pointInFeature")(f0, x, y)) pt = { lng: x, lat: y };
    }
    w.D.bgs.features.unshift({ type: "Feature", properties: { id: "BAD" }, geometry: null });
    const got = ev("houseBlockGroup")(pt);
    w.D.bgs.features.shift();
    return { want: f0.properties.id, got };
  });
  expect(r.got).toBe(r.want);
  expect(errors).toEqual([]);
});

test("national parcel lookup survives a layer that rejects the model's fields (DC's parcel layer lacks the CAMA fields)", async ({ page }) => {
  const errors = await openPage(page);
  const ring = [[-77.0842, 38.9075], [-77.0838, 38.9075], [-77.0838, 38.9078], [-77.0842, 38.9078], [-77.0842, 38.9075]];
  await page.route(/Property_and_Land_WebMercator\/MapServer\/40\/query/, (route: any) => {
    const u = decodeURIComponent(route.request().url());
    const body = /CAMA_/.test(u)
      ? { error: { code: 400, message: "Failed to execute query.", details: [] } }
      : { features: [{ attributes: { SSL: "1356    0035", PREMISEADD: "1 TEST ST NW" }, geometry: { rings: [ring] } }] };
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } });
  });
  await page.route(/Property_and_Land_WebMercator\/MapServer\/25\/query/, (route: any) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ features: [] }) }));
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS"); } catch { return false; } }, null, { timeout: 30_000 });
  const r = await page.evaluate(async () => {
    const ev = (s: string) => (0, eval)(s);
    const w = window as any;
    const realFips = w.activeFips;
    w.activeFips = () => "11001";   // pretend DC is active without downloading its data file
    try { const f = await ev("fetchParcel")({ lat: 38.90765, lng: -77.0840 }); return f ? f.attributes.SSL : null; }
    finally { w.activeFips = realFips; }
  });
  expect(r).toBe("1356    0035");
  expect(errors).toEqual([]);
});

test("Florida parcel lookup: no record cap (the statewide layer fails capped queries) and a cold answer slower than 5 s still counts", async ({ page }) => {
  const errors = await openPage(page);
  const ring = [[-80.2631, 26.3374], [-80.2626, 26.3374], [-80.2626, 26.3378], [-80.2631, 26.3378], [-80.2631, 26.3374]];
  const seen: string[] = [];
  await page.route(/Florida_Statewide_Cadastral\/FeatureServer\/0\/query/, async (route: any) => {
    const u = decodeURIComponent(route.request().url());
    seen.push(u);
    // The real layer takes ~55 s and then answers "Invalid query parameters" when resultRecordCount is set.
    const body = /resultRecordCount/.test(u)
      ? { error: { code: 400, message: "Cannot perform query. Invalid query parameters.", details: [] } }
      : { features: [{ attributes: { PARCEL_ID: "474128011420", DOR_UC: "001", JV: 900000, PHY_ADDR1: "1 TEST ST" }, geometry: { rings: [ring] } }] };
    if (seen.length === 1) await new Promise((r) => setTimeout(r, 6500));   // a cold first query, as measured live (7-9 s)
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } });
  });
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS"); } catch { return false; } }, null, { timeout: 30_000 });
  const r = await page.evaluate(async () => {
    const ev = (s: string) => (0, eval)(s);
    const w = window as any;
    const realFips = w.activeFips;
    w.activeFips = () => "12011";   // pretend Broward is active without downloading its data file
    try { const f = await ev("fetchParcel")({ lat: 26.3376, lng: -80.26286 }); return f ? f.attributes.PARCEL_ID : null; }
    finally { w.activeFips = realFips; }
  });
  expect(r).toBe("474128011420");
  expect(seen.every((u) => !/resultRecordCount/.test(u))).toBe(true);
  // the model's block group comes from the roll's CENSUS_BK, so the page must ask for it
  expect(seen.some((u) => /outFields=[^&]*CENSUS_BK/.test(u))).toBe(true);
  expect(errors).toEqual([]);
});

test("Florida estimates use the roll's CENSUS_BK block group (2010 vintage, as tested), never the map's 2020 one", async ({ page }) => {
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS"); } catch { return false; } }, null, { timeout: 30_000 });
  const r = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    const mbg = ev("modelBlockGroup");
    const C = ev("COUNTY_VALUATION_MODELS").counties;
    // Miami-Dade home 3022060602410: 2010 block group 120860098083 (roll), 2020 block group 120860098122 (map)
    return {
      field: C["12086"].input_map.bg_field,
      fromRoll: mbg("12086", { CENSUS_BK: "120860098083" }, { lat: 25.951574, lng: -80.182431 }),
      missing: mbg("12086", {}, { lat: 25.951574, lng: -80.182431 }),
      allFlorida: ["12011", "12031", "12057", "12086", "12095", "12099", "12103"].every((f) => C[f].input_map.bg_field === "CENSUS_BK"),
      inStats: !!(C["12086"].stats.bg["120860098083"] || C["12086"].stats.tract["12086009808"]),
      notFlorida: C["11001"].input_map.bg_field || null,
    };
  });
  expect(r.field).toBe("CENSUS_BK");
  expect(r.fromRoll).toBe("120860098083");
  expect(r.missing).toBeNull();   // no silent fallback to the 2020 block group
  expect(r.allFlorida).toBe(true);
  expect(r.inStats).toBe(true);   // the 2010 key is the one the model has statistics for
  expect(r.notFlorida).toBeNull();
  expect(errors).toEqual([]);
});

test("King County parcel lookup uses the county's parcel layer (PIN) and reads the model's value from the state layer", async ({ page }) => {
  const errors = await openPage(page);
  const svcUrl = await page.evaluate(() => (0, eval)("parcelSvc")("53033").url);
  expect(svcUrl).toMatch(/KingCo_Parcels\/MapServer\/0$/);   // it used to be a zoning layer with no parcel fields
  const ring = [[-122.3023, 47.5922], [-122.3018, 47.5922], [-122.3018, 47.5925], [-122.3023, 47.5925], [-122.3023, 47.5922]];
  await page.route(/KingCo_Parcels\/MapServer\/0\/query/, (route: any) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ features: [{ attributes: { PIN: "7658600027", MAJOR: "765860", MINOR: "0027" }, geometry: { rings: [ring] } }] }) }));
  let stateWhere = "";
  await page.route(/Current_Parcels\/FeatureServer\/0\/query/, (route: any) => {
    stateWhere = new URL(route.request().url()).searchParams.get("where") || "";
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ features: [{ attributes: { ORIG_PARCEL_ID: "7658600027", VALUE_LAND: 500000, VALUE_BLDG: 303000 } }] }) });
  });
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS"); } catch { return false; } }, null, { timeout: 30_000 });
  const r = await page.evaluate(async () => {
    const ev = (s: string) => (0, eval)(s);
    const w = window as any;
    const realFips = w.activeFips;
    w.activeFips = () => "53033";
    try { const f = await ev("fetchParcel")({ lat: 47.592353, lng: -122.302068 }); return f ? { pin: f.attributes.PIN, av: f.attributes.WA_AV } : null; }
    finally { w.activeFips = realFips; }
  });
  expect(r).toEqual({ pin: "7658600027", av: 803000 });
  expect(stateWhere).toContain("ORIG_PARCEL_ID='7658600027'");
  expect(errors).toEqual([]);
});

test("a parcel service that fails is reported as such, not as a public right-of-way", async ({ page }) => {
  const errors = await openPage(page);
  // Florida's statewide layer fails some areas outright (Palm Beach, 16 Nov 2026); every query here fails.
  await page.route(/Florida_Statewide_Cadastral\/FeatureServer\/0\/query/, (route: any) => route.abort("failed"));
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS"); } catch { return false; } }, null, { timeout: 30_000 });
  const r = await page.evaluate(async () => {
    const ev = (s: string) => (0, eval)(s);
    const w = window as any;
    const realFips = w.activeFips;
    w.activeFips = () => "12099";
    try {
      let thrown = "";
      try { await ev("fetchParcel")({ lat: 26.472115, lng: -80.135857 }); } catch (e: any) { thrown = String(e.message); }
      await ev("houseAt")({ lat: 26.472115, lng: -80.135857 });
      return { thrown, text: (document.querySelector("#house") as HTMLElement).innerText };
    } finally { w.activeFips = realFips; }
  });
  expect(r.thrown).toMatch(/no answer from Florida Statewide Parcels/);
  expect(r.text).toContain("Couldn't get this lot from the parcel service");
  expect(r.text).not.toMatch(/Right-of-Way/);
  expect(errors).toEqual([]);
});

test("house checks name only the state's law records on file, assert no unchecked right, and treat an unrecorded use as unknown (live click path)", async ({ page }) => {
  // Found by scripts/live_check_panels.mjs (16 Nov 2026): outside California the checks list asserted rights from
  // hardcoded text ("Austin HOME Initiative authorizes up to 3 units" anywhere in Texas, "municipal infill schedule",
  // "Fannie Mae / FHA accessory housing standards", Florida "Live Local Act ... allow internal apartment conversions"),
  // and a lot whose use the parcel service doesn't record was called non-residential.
  const ring = (lat: number, lng: number) => [[lng - 0.0003, lat - 0.0002], [lng + 0.0003, lat - 0.0002], [lng + 0.0003, lat + 0.0002], [lng - 0.0003, lat + 0.0002], [lng - 0.0003, lat - 0.0002]];
  let travisAttrs: any = {};
  await page.route(/EXTERNAL_tcad_parcel\/FeatureServer\/0\/query/, (route: any) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ features: [{ attributes: travisAttrs, geometry: { rings: [ring(30.3005, -97.724)] } }] }) }));
  await page.route(/jccgis\.jccal\.org\/.*Parcels\/MapServer\/0\/query/, (route: any) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ features: [{ attributes: { PARCELID: "2200001", ADDR_PSPR: "100 TEST AVE", LAND_USE: "SINGLE FAMILY", LIVING_AREA: 1600, LOT_SQFT: 8000 }, geometry: { rings: [ring(33.52, -86.8)] } }] }) }));
  await page.route(/Florida_Statewide_Cadastral\/FeatureServer\/0\/query/, (route: any) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ features: [{ attributes: { PARCEL_ID: "1", PHY_ADDR1: "1 TEST ST", DOR_UC: "001", TOT_LVG_AR: 1800, total_lvg_area: 1800, LND_SQFOOT: 9000, ACT_YR_BLT: 1975 }, geometry: { rings: [ring(26.6, -81.9)] } }] }) }));
  const errors = await openPage(page);
  const houseText = async (fips: string, ll: { lat: number; lng: number }) => {
    await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
    await page.waitForFunction((f) => (window as any).D_OC?.meta?.fips === f, fips, { timeout: 60_000 });
    await page.evaluate((p) => (0, eval)("houseAt")(p), ll);
    await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && !b.querySelector(".house-loading"); }, null, { timeout: 30_000 });
    return page.evaluate(() => (document.querySelector("#house") as HTMLElement).innerText);
  };
  const hardcoded = /Austin HOME Initiative authorizes|municipal infill schedule|Fannie Mae \/ FHA|HB 1110 allows|HB 2001 permits|HB 1337 allows up to two|Live Local Act & local infill standards allow|Fee-simple lot split allowed/;

  travisAttrs = { PROP_ID: 123, situs_address: "811 E 41ST ST", LAND_USE: "SINGLE FAMILY", LIVING_AREA: 1500, LOT_SQFT: 7000 };
  const tx = await houseText("48453", { lat: 30.3005, lng: -97.724 });
  expect(tx).not.toMatch(hardcoded);
  expect(tx).toContain("Duplex, middle housing or lot split");
  expect(tx).toMatch(/state law on file: .*Austin HOME Initiative \(Phase 1 & 2\) \((text checked|partly checked|not confirmed)\)/);
  expect(tx).toContain("applies only where all of its conditions are met");
  expect(tx).not.toContain("4-ft rear/side setbacks");

  // Travis County's real layer has no use field: the use is unknown, not "not residential".
  travisAttrs = { PROP_ID: 124, situs_address: "813 E 41ST ST" };
  const txUnknown = await houseText("48453", { lat: 30.3005, lng: -97.724 });
  expect(txUnknown).toContain("doesn't record this lot's use");
  expect(txUnknown).not.toMatch(/so residential homeowner checks do not apply/);

  const al = await houseText("01073", { lat: 33.52, lng: -86.8 });
  expect(al).not.toMatch(hardcoded);
  expect(al).toContain("no state middle-housing or lot-split law for AL is on file here");

  const fl = await houseText("12071", { lat: 26.6, lng: -81.9 });
  expect(fl).not.toMatch(hardcoded);
  expect(fl).toContain("Interior accessory suite");
  expect(fl).toContain("no state ADU law for FL is on file here");   // the Live Local Act is commercial-zone only
  expect(fl).not.toMatch(/qualify for My Safe Florida Home/);
  expect(errors).toEqual([]);
});

test("clicking a drawn lot in a county with a tested model reads the lot's full record (drawn lots carry few fields)", async ({ page }) => {
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("COUNTY_VALUATION_MODELS"); } catch { return false; } }, null, { timeout: 30_000 });
  const r = await page.evaluate(async () => {
    const ev = (s: string) => (0, eval)(s);
    const w = window as any;
    const realFips = w.activeFips, realFetch = w.fetchParcel;
    const ring = [[-122.3023, 47.5922], [-122.3018, 47.5922], [-122.3018, 47.5925], [-122.3023, 47.5925], [-122.3023, 47.5922]];
    const drawn = { attributes: { PIN: "7658600027" }, geometry: { rings: [ring] } };   // what a drawn lot carries
    const calls: any[] = [];
    const full = { attributes: { PIN: "7658600027", WA_AV: 803000 }, geometry: { rings: [ring] } };
    Object.defineProperty(full, "_fullRecord", { value: true });
    w.fetchParcel = async (ll: any) => { calls.push(ll); return full; };
    try {
      w.activeFips = () => "53033";
      await ev("houseAt")({ lat: 47.59235, lng: -122.30205 }, drawn);
      const king = calls.length;
      // an address search lands on the street, outside the lot: the re-read uses a point inside the lot
      calls.length = 0;
      await ev("houseAt")({ lat: 47.5921, lng: -122.3020 }, drawn);
      const inside = calls.length === 1 && ev("ringsContain")([ring], calls[0]);
      // a county without a tested model keeps the drawn lot as it is
      calls.length = 0;
      w.activeFips = () => "48201";
      await ev("houseAt")({ lat: 47.59235, lng: -122.30205 }, drawn);
      return { king, inside, untested: calls.length };
    } finally { w.activeFips = realFips; w.fetchParcel = realFetch; }
  });
  expect(r.king).toBe(1);
  expect(r.inside).toBe(true);
  expect(r.untested).toBe(0);
  expect(errors).toEqual([]);
});

test("a JSONP answer that arrives after its timeout doesn't throw on the page", async ({ page }) => {
  const errors = await openPage(page);
  await page.route(/late-jsonp-test/, async (route: any) => {
    const cb = new URL(route.request().url()).searchParams.get("callback");
    await new Promise((r) => setTimeout(r, 1200));
    await route.fulfill({ status: 200, contentType: "application/javascript", body: `${cb}({"features":[]});` });
  });
  const r = await page.evaluate(async () => {
    try { await (0, eval)("jsonp")("https://example.invalid/late-jsonp-test?f=json", 300); return "resolved"; }
    catch (e: any) { return String(e.message); }
  });
  expect(r).toBe("JSONP timeout");
  await page.waitForTimeout(2000);   // the late answer has run by now
  expect(errors).toEqual([]);
});

test("what fits on this lot uses the NYC Zoning Resolution read from the code, and says 'not on file' elsewhere (live click path)", async ({ page }) => {
  // app/data/zoning_standards.json (scripts/build_zoning_standards.py): NYC R1-R5 standards parsed from
  // zr.planning.nyc.gov; MapPLUTO's LandUse decoded from the PLUTO data dictionary. Before 16 Nov 2026 every NYC lot
  // showed "doesn't record this lot's use" and no zoning standard; outside LA no standard was on file anywhere.
  const ring = (lat: number, lng: number) => [[lng - 0.0002, lat - 0.0001], [lng + 0.0002, lat - 0.0001], [lng + 0.0002, lat + 0.0001], [lng - 0.0002, lat + 0.0001], [lng - 0.0002, lat - 0.0001]];
  let pluto: any = {};
  await page.route(/MAPPLUTO\/FeatureServer\/0\/query/, (route: any) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ features: [{ attributes: pluto, geometry: { rings: [ring(40.738, -73.762)] } }] }) }));
  let travis: any = { PROP_ID: 1, situs_address: "1 TEST ST" };
  await page.route(/EXTERNAL_tcad_parcel\/FeatureServer\/0\/query/, (route: any) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ features: [{ attributes: travis, geometry: { rings: [ring(30.3014, -97.7224)] } }] }) }));
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("ZONING_STANDARDS") && !!(0, eval)("PARCEL_USE_CODES"); } catch { return false; } }, null, { timeout: 30_000 });
  const houseText = async (fips: string, ll: { lat: number; lng: number }) => {
    await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
    await page.waitForFunction((f) => (window as any).D_OC?.meta?.fips === f, fips, { timeout: 60_000 });
    await page.evaluate((p) => (0, eval)("houseAt")(p), ll);
    await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && !b.querySelector(".house-loading") && /Zoning district|Local zoning standards|Home upgrades/.test(b.innerText); }, null, { timeout: 30_000 });
    return page.evaluate(() => (document.querySelector("#house") as HTMLElement).innerText);
  };

  // A one-family house in R2A on a 6,000 sq ft lot (Queens).
  pluto = { BBL: 4000010001, Borough: "QN", Block: 1, Lot: 1, Address: "1 TEST STREET", LandUse: "01", BldgClass: "A1", ZoneDist1: "R2A", LotArea: 6000, LotFront: 60, BldgArea: 2000, UnitsRes: 1, NumFloors: 1, YearBuilt: 1950 };
  const q = await houseText("36081", { lat: 40.738, lng: -73.762 });
  expect(q).toContain("One & Two Family Buildings (PLUTO Data Dictionary, LandUse 01)");
  expect(q).not.toContain("doesn't record this lot's use");
  expect(q).toContain("Zoning district R2A (New York City Zoning Resolution)");
  expect(q).toContain("limited to single-family detached residences (ZR 22-122)");
  expect(q).toContain("2,850 sq ft and 30 ft wide (ZR 23-11)");
  expect(q).toContain("Up to 4,500 sq ft of floor area on this 6,000 sq ft lot (FAR 0.75, ZR 23-21)");
  expect(q).toContain("no single home may exceed 3,600 sq ft (FAR 0.60)");
  expect(q).toContain("about 2,500 sq ft remain");
  expect(q).toMatch(/Second home \(two-family or more\)\s*—\s*R2A is limited to single-family detached residences/);
  expect(q).toContain("Ancillary dwelling unit (ADU, up to 800 sq ft)");
  expect(q).toContain("and in R2A only inside the Greater Transit Zone");
  expect(q).toContain("At 6,000 sq ft and 60 ft of frontage the lot is at least twice the minimum");
  expect(q).toContain("Height: up to 35 ft, with perimeter walls up to 25 ft (ZR 23-421)");
  expect(q).not.toContain("Duplex, middle housing or lot split");
  expect(q).not.toContain("Local zoning standards");

  // A two-family house in R4B on a small lot (Brooklyn): two-family allowed, 25 ft height, lot too small to split.
  pluto = { BBL: 3000010001, Borough: "BK", Block: 1, Lot: 1, Address: "2 TEST STREET", LandUse: "01", BldgClass: "B1", ZoneDist1: "R4B", LotArea: 2000, LotFront: 20, BldgArea: 1800, UnitsRes: 2, NumFloors: 2, YearBuilt: 1930 };
  const b = await houseText("36047", { lat: 40.738, lng: -73.762 });
  expect(b).toContain("Zoning district R4B");
  expect(b).toContain("A two-family home is an allowed type here");
  expect(b).toContain("Height: up to 25 ft (ZR 23-422)");
  expect(b).toContain("is smaller, which may mean it predates the minimum");
  expect(b).toContain("Two lots would each need at least 2,375 sq ft and 25 ft of width");

  // R6-R10 (ZR 23-22 / 23-432, added 17 Nov 2026): an apartment building in R6 gets the district's floor area with
  // the code's own conditions (never one unconditioned figure), and no house-only rows.
  pluto = { ...pluto, ZoneDist1: "R6", LandUse: "02", UnitsRes: 6 };
  const r6 = await houseText("36047", { lat: 40.738, lng: -73.762 });
  expect(r6).toContain("Zoning district R6 (New York City Zoning Resolution)");
  expect(r6).toContain("every type of residence is permitted in R6 (ZR 22-121)");
  expect(r6).toContain("Floor area ratio, standard residences: 3.00 for zoning lots, or portions thereof, located within 100 feet of a wide street; 2.20 for other lots");
  expect(r6).toContain("For standard residences, up to 4,400 sq ft of floor area on this 2,000 sq ft lot (FAR 2.20, for other lots), or up to 6,000 sq ft (FAR 3.00) for zoning lots, or portions thereof, located within 100 feet of a wide street (ZR 23-22); which applies isn't checked here");
  expect(r6).toContain("Qualifying affordable or senior housing can reach FAR 3.90");
  expect(r6).toContain("an apartment building");
  expect(r6).not.toContain("Second home (two-family or more)");
  expect(r6).not.toContain("Local zoning standards");
  // A one-family house in R7-1: every type allowed; heights by street, from 23-432.
  pluto = { ...pluto, ZoneDist1: "R7-1", LandUse: "01", BldgClass: "A1", UnitsRes: 1, LotArea: 4000, LotFront: 40, BldgArea: 1500, NumFloors: 2 };
  const r71 = await houseText("36005", { lat: 40.738, lng: -73.762 });
  expect(r71).toContain("Zoning district R7-1");
  expect(r71).toContain("Height, standard residences: base 40–75 ft, building up to 85 ft for zoning lots or portions thereof within 100 feet of a wide street; base 40–65 ft, building up to 75 ft for zoning lots or portions thereof on a narrow street");
  expect(r71).toMatch(/Second home \(two-family or more\)\s*—\s*R7-1 permits every type of residence \(ZR 22-121\)/);
  expect(r71).toContain("Split into two lots (by size only)");
  expect(r71).not.toContain("null ft");
  // A district still not encoded (R11) says so; a commercial lot (LandUse 05) gets no home checks.
  pluto = { ...pluto, ZoneDist1: "R11" };
  const r11 = await houseText("36061", { lat: 40.738, lng: -73.762 });
  expect(r11).toMatch(/Local zoning standards\s*—\s*Not on file: New York City's standards are on file only for R1-1/);
  expect(r11).toContain("this lot is R11");
  pluto = { ...pluto, ZoneDist1: "C4-4", LandUse: "05" };
  const c = await houseText("36047", { lat: 40.738, lng: -73.762 });
  expect(c).toContain("This parcel is Commercial & Office Buildings (PLUTO Data Dictionary, LandUse 05)");
  expect(c).not.toContain("Detached ADU");   // "non-residential" used to match /resid/ and get the home checks

  // Outside NYC: Austin's code could not be read (Municode bot check), and the panel says so.
  const tx = await houseText("48453", { lat: 30.3014, lng: -97.7224 });
  expect(tx).toMatch(/Local zoning standards\s*—\s*Not on file: No local zoning standards are on file here\. Austin: .*Municode/);
  // A worded non-residential use from the service is not given home checks either.
  travis = { PROP_ID: 2, situs_address: "2 TEST ST", LAND_USE: "OFFICE BUILDING" };
  const txOffice = await houseText("48453", { lat: 30.3014, lng: -97.7224 });
  expect(txOffice).toContain("This parcel is OFFICE BUILDING, so residential homeowner checks do not apply");
  expect(txOffice).not.toContain("Detached ADU");
  expect(errors).toEqual([]);
});

// Round-2 hand-written claims (docs/audit/hardcoded-claims-round2.md). The canopy HUD and the comparison drawer used a
// hand-typed "ecoregion" table (codes like "EPA IV: 85g / CEC Zone 9", per-state canopy targets) and called the 2021
// Tree Equity heat figure "vs. EPA Level IV ecoregion median". They now show the block group's own Tree Equity goal.
test("canopy HUD and comparison drawer show the block group's own Tree Equity goal and heat label, never an invented target (select path, Travis TX)", async ({ page }) => {
  const fs = require("fs"), path = require("path");
  const te = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/tree_equity_2025/48453.json"), "utf8"));
  const errors = await openPage(page);
  const hud0 = await page.evaluate(() => ({ econ: (document.querySelector("#canopy-hud-economic") as HTMLElement).textContent || "",
    heatOpt: (document.querySelector('#metric option[value="heat"]') as HTMLElement).textContent || "" }));
  expect(hud0.econ).toContain("$7,130");
  expect(hud0.econ).toContain("$71 per tree planted");
  expect(hud0.econ).not.toContain("$65–$140");
  expect(hud0.heatOpt).toContain("urban area");
  expect(hud0.heatOpt).not.toContain("EPA");

  await page.evaluate(() => (0, eval)("openCounty")("48453"));
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "48453", null, { timeout: 60_000 });
  const ids: string[] = await page.evaluate(() => (0, eval)("D_OC").features.map((f: any) => f.properties.id));
  const bg = ids.find((id) => te[id] && te[id][0] > 0 && te[id][2] != null) as string;
  expect(bg).toBeTruthy();
  const r = await page.evaluate((id) => {
    const ev = (s: string) => (0, eval)(s);
    ev("select")(id, false);
    const hud = { hood: document.querySelector("#canopy-hud-hood")!.textContent || "", heat: document.querySelector("#canopy-hud-heat")!.textContent || "",
      gap: document.querySelector("#canopy-hud-gap")!.textContent || "" };
    ev("toggleCompare")(id); ev("renderCompareDrawer")();
    return { hud, drawer: (document.querySelector("#compare-content") as HTMLElement).textContent || "" };
  }, bg);
  // The HUD can be updated before the current Tree Equity file arrives; wait for the select after it has.
  if (!r.hud.gap.includes("goal")) await page.waitForTimeout(1500);
  const again = await page.evaluate((id) => { (0, eval)("select")(id, false); return document.querySelector("#canopy-hud-gap")!.textContent || ""; }, bg);
  expect(again).toBe(`${te[bg][0]} pts below its ${te[bg][2]}% goal`);
  for (const t of [r.hud.hood, r.hud.heat, again, r.drawer]) expect(t).not.toMatch(/EPA|Eco-Norm|CEC Zone|Ecoregion/);
  expect(r.drawer).toContain("Tree canopy gap");
  expect(r.drawer).not.toMatch(/Low Risk|Elevated \(/);
  expect(errors).toEqual([]);
});

test("methods panel financing and stormwater text come from sourced records (LA and Travis TX)", async ({ page }) => {
  const errors = await openPage(page);
  await page.waitForFunction(() => { const P = (0, eval)("STATE_FINANCE_PROFILES"); return P && P.TX && P.TX.verification; });
  await page.waitForFunction(() => ((0, eval)("FUNDING_PROGRAMS_DATA") || []).length > 0);
  const la = await page.evaluate(() => { (0, eval)("openMethodsModal")();
    return { fin: document.querySelector("#methods-financing-section")!.textContent || "", water: document.querySelector("#methods-water-section")!.textContent || "" }; });
  expect(la.fin).toMatch(/13,392 tax-rate areas, 99\.99% of net taxable value matched/);
  expect(la.fin).toContain("not re-checked");
  for (const bad of ["AAA muni", "turnover presets", "mortgage lock-in", "about 47%", "certified City of Artesia"]) expect(la.fin).not.toContain(bad);
  expect(la.water).toContain("Chapter 16");
  expect(la.water).toContain("110 points");
  expect(await page.locator('#methods-water-section a[href="https://file.lacounty.gov/SDSInter/bos/supdocs/124293.pdf"]').count()).toBe(1);

  await page.evaluate(() => (0, eval)("closeMethodsModal")());
  await page.evaluate(() => (0, eval)("openCounty")("48453"));
  await page.waitForFunction(() => (window as any).D_OC?.meta?.fips === "48453", null, { timeout: 60_000 });
  const tx = await page.evaluate(() => { (0, eval)("openMethodsModal")();
    return { fin: document.querySelector("#methods-financing-section")!.textContent || "", water: document.querySelector("#methods-water-section")!.textContent || "" }; });
  expect(tx.fin).toContain("TX TIRZ / PID / MUD");
  expect(tx.fin).toContain("No tax-increment amount is computed for TX");
  expect(tx.fin).toContain("Texas Tax Increment Reinvestment Zone");   // the funding program record, with its status
  for (const bad of ["1.30×", "Senate Bill 2", "25-to-30-year", "written by hand"]) expect(tx.fin).not.toContain(bad);
  expect(tx.water).toContain("No checked stormwater funding record");
  expect(tx.water).not.toMatch(/TWDB|BRIC/);
  expect(errors).toEqual([]);
});

test("California house checks state SB 9, ADU sale and fee rules only as the statutes say (live click path, LA)", async ({ page }) => {
  let ll = { lat: 0, lng: 0 }, ring: number[][] = [];
  await page.route(/LACounty_Parcel\/MapServer\/0\/query/, (route: any) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ features: [{ attributes: { AIN: "5000000001", SitusFullAddress: "1 TEST ST LOS ANGELES CA", UseCode: "0100", UseType: "Residential", UseDescription: "Single Family Residence",
      Roll_LandValue: 400000, Roll_ImpValue: 150000, Roll_LandBaseYear: "2012", YearBuilt1: "1952", SQFTmain1: 1500, Bedrooms1: 4, Bathrooms1: 1, Units1: 1 }, geometry: { rings: [ring] } }] }) }));
  const errors = await openPage(page);
  // A point inside a real single-family (R1-1) zoning polygon from the page's own LA zoning layer, so SB 9 is screened.
  const found = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s), Z = ev("D").layers.zoning, zCell = ev("zCell"), zoneAt = ev("zoneAt");
    for (const k of Object.keys(Z.cells)) for (const z of zCell(k)) {
      if (z.zone !== "R1-1" || !z.rings || !z.rings[0]) continue;
      const r = z.rings[0], c = { lat: r.reduce((s: number, q: number[]) => s + q[0], 0) / r.length, lng: r.reduce((s: number, q: number[]) => s + q[1], 0) / r.length };
      const hit = zoneAt(c);
      if (hit && hit.zone === "R1-1" && c.lat > 33.9 && c.lat < 34.2 && c.lng > -118.5 && c.lng < -118.2) return c;
    }
    return null;
  });
  expect(found).toBeTruthy();
  ll = found as { lat: number; lng: number };
  ring = [[ll.lng - 0.0002, ll.lat - 0.00012], [ll.lng + 0.0002, ll.lat - 0.00012], [ll.lng + 0.0002, ll.lat + 0.00012], [ll.lng - 0.0002, ll.lat + 0.00012], [ll.lng - 0.0002, ll.lat - 0.00012]];
  await page.evaluate((p) => (0, eval)("houseAt")(p), ll);
  await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && !b.querySelector(".house-loading") && /SB 9/.test(b.textContent || ""); }, null, { timeout: 60_000 });
  const t = await page.evaluate(() => (document.querySelector("#house") as HTMLElement).innerText);
  expect(t).not.toContain("up to 4 total units");
  expect(t).not.toContain("SB 9 does not apply in designated historic districts");
  expect(t).toMatch(/SB 9 (allows a split into two lots of roughly equal area, each at least 1,200 sq ft and at least 40%|requires the parcel to meet the site conditions|bars a split on a designated)/);
  expect(t).not.toContain("recoups only about 58%");
  expect(t).not.toContain("Not allowed here: an ADU can be rented");
  expect(t).not.toContain("(AB 1154)");
  // The ADU fee rules (shown only where the ADU row is sourced; checked here on the function itself): California
  // cites Gov. Code § 66311.5 and the SAB 2026 rate; other states have no fee rules on file and get no invented fee.
  const fees = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s), fn = ev("getHouseUpgradeCostDetails");
    const ca = fn({ name: "Detached ADU (800 sq ft)", n: "Detached ADU (800 sq ft)", customSqft: 800 }, { yard: 2000, yb: 1960 }, {});
    return { ca: { school: ca.schoolFee, impact: ca.impactFees, unknown: ca.impactFeeUnknown, onFile: ca.feesOnFile, rows: ca.breakdown.map((b: any) => b.cat + " | " + b.desc).join("\n") } };
  });
  expect(fees.ca.school).toBe(Math.round(800 * 5.38));
  expect(fees.ca.impact).toBe(0);
  expect(fees.ca.unknown).toBe(true);
  expect(fees.ca.onFile).toBe(true);
  expect(fees.ca.rows).toContain("Gov. Code § 66311.5(c)");
  expect(fees.ca.rows).not.toMatch(/HB 1337|Live Local Act abatement|Austin HOME infill schedule/);
  expect(errors).toEqual([]);
});

test("neighborhood panel lists no unchecked funding programs and states the EIFD protest rule from the statute (LA select path)", async ({ page }) => {
  const errors = await openPage(page);
  const t = await page.evaluate(() => {
    const w = window as any;
    const id = w.D.bgs.features.find((f: any) => ((w.D.details[f.properties.id] || {}).m || {}).e)?.properties.id || w.D.bgs.features[0].properties.id;
    w.select(id, false);
    return (document.querySelector("#panel") as HTMLElement).textContent || "";
  });
  expect(t).not.toContain("Non-Private Funding");
  expect(t).not.toMatch(/No vote is needed to form one|fail only on a 50% protest|Since AB 116 \(2019\) EIFD bonds need no public vote/);
  expect(t).toContain("25–50% sends it to an election");
  expect(errors).toEqual([]);
});

// DC (11 DCMR Subtitle D and U, read from dcregs.dc.gov) and Nashville (the Assessor's LUDesc). DC's parcel layer has
// no zone field: the page reads the zone from DC's zoning map at the clicked point. Before 16 Nov 2026 DC and Nashville
// lots showed "doesn't record this lot's use" and no zoning standard.
test("what fits on this lot reads DC's zone at the point and applies 11 DCMR; DC and Nashville uses come from the publishers' tables (live click path)", async ({ page }) => {
  test.setTimeout(300_000);   // eight lots through the full click path
  const ring = (lat: number, lng: number) => [[lng - 0.0002, lat - 0.0001], [lng + 0.0002, lat - 0.0001], [lng + 0.0002, lat + 0.0001], [lng - 0.0002, lat + 0.0001], [lng - 0.0002, lat - 0.0001]];
  const json = (route: any, body: any) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  let dcParcel: any = {}, dcZone = "R-1B", gba: number | null = 2400, zoneCalls = 0;
  await page.route(/Property_and_Land_WebMercator\/MapServer\/40\/query/, (route: any) => json(route, { features: [{ attributes: dcParcel, geometry: { rings: [ring(38.9655, -77.0705)] } }] }));
  await page.route(/Property_and_Land_WebMercator\/MapServer\/25\/query/, (route: any) => json(route, { features: gba == null ? [] : [{ attributes: { SSL: dcParcel.SSL, GBA: gba, LANDAREA: dcParcel.LANDAREA, AYB: 1930, BEDRM: 3, BATHRM: 2, HF_BATHRM: 0, NUM_UNITS: 1 } }] }));
  await page.route(/Planning_Landuse_and_Zoning_WebMercator\/MapServer\/32\/query/, (route: any) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get("geometryType") === "esriGeometryPoint" && u.searchParams.get("outFields") === "ZONING") zoneCalls++;
    return json(route, { features: [{ attributes: { ZONING: dcZone, ZONE_DESCRIPTION: "test" }, geometry: { rings: [ring(38.9655, -77.0705)] } }] });
  });
  let nash: any = {};
  await page.route(/Parcels_view\/FeatureServer\/0\/query/, (route: any) => json(route, { features: [{ attributes: nash, geometry: { rings: [ring(36.13, -86.79)] } }] }));
  const errors = await openPage(page);
  await page.waitForFunction(() => { try { return !!(0, eval)("ZONING_STANDARDS") && !!(0, eval)("PARCEL_USE_CODES"); } catch { return false; } }, null, { timeout: 30_000 });
  const houseText = async (fips: string, ll: { lat: number; lng: number }) => {
    await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
    await page.waitForFunction((f) => (window as any).D_OC?.meta?.fips === f, fips, { timeout: 60_000 });
    await page.evaluate(() => { try { (0, eval)("houseCache").clear(); } catch (e) {} });
    await page.evaluate((p) => (0, eval)("houseAt")(p), ll);
    await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && !b.querySelector(".house-loading") && /Zoning district|Local zoning standards|Home upgrades/.test(b.innerText); }, null, { timeout: 30_000 });
    return page.evaluate(() => (document.querySelector("#house") as HTMLElement).innerText);
  };
  const dcAt = { lat: 38.9655, lng: -77.0705 };

  // A detached house in R-1B on a 6,000 sq ft lot with 2,400 sq ft of floor area.
  dcParcel = { SSL: "1999    0071", PREMISEADD: "1 TEST AVE NW WASHINGTON DC 20015", USECODE: "012", PROPTYPE: "Residential-Single Family (Det", LANDAREA: 6000, NEWLAND: 600000, NEWIMPR: 900000, NEWTOTAL: 1500000 };
  const r1b = await houseText("11001", dcAt);
  expect(zoneCalls).toBeGreaterThan(0);
  expect(r1b).toContain("Residential-Detached-Single-Family (DC Office of Tax and Revenue USECODE Table");
  expect(r1b).not.toContain("doesn't record this lot's use");
  expect(r1b).toContain("Zoning district R-1B (DC Zoning Regulations of 2016 (11 DCMR))");
  expect(r1b).toContain("The R-1B zone is intended to provide for areas predominantly developed with detached houses on moderately sized lots.");
  expect(r1b).toContain("5,000 sq ft and 50 ft wide (11 DCMR Subtitle D § 202, Table D § 202.1)");
  expect(r1b).toContain("Height: up to 40 ft and 3 stories, not counting a penthouse or rooftop structure (11 DCMR Subtitle D § 203)");
  expect(r1b).toContain("Up to 40% lot occupancy for all other structures (11 DCMR Subtitle D § 210, Table D § 210.1): about 2,400 sq ft of building footprint on this 6,000 sq ft lot");
  expect(r1b).toMatch(/Second home \(two-family or more\)\s*—\s*11 DCMR Subtitle D § 201/);
  expect(r1b).toContain("Two lots would each need at least 5,000 sq ft");
  expect(r1b).toContain("the house needs at least 2,000 sq ft of gross floor area (Table U § 253.7(a)); OTR records 2,400 sq ft");
  expect(r1b).toContain("(about 840 sq ft)");   // 35% of 2,400
  expect(r1b).not.toContain("Detached ADU (backyard home)");   // DC's accessory-apartment rule replaces the generic rows
  expect(r1b).not.toContain("Duplex, middle housing or lot split");
  expect(r1b).not.toContain("Local zoning standards");

  // A row house in R-3 on a small lot: 60% lot occupancy for a single household row building; R-3 has no minimum
  // house size for an accessory apartment.
  dcZone = "R-3"; gba = 1500;
  dcParcel = { ...dcParcel, USECODE: "011", LANDAREA: 1500 };
  const r3 = await houseText("11001", dcAt);
  expect(r3).toContain("Residential-Row-Single-Family");
  expect(r3).toContain("Up to 60% lot occupancy for single household row building");
  expect(r3).toContain("row: 2,000 sq ft and 20 ft wide");
  expect(r3).toContain("this lot (1,500 sq ft) is smaller, and those minimums apply to creating a new lot of record");
  expect(r3).toContain("no minimum house size is listed for this zone");

  // A geographically modified zone (R-3/GT) has its own rules: nothing is applied.
  dcZone = "R-3/GT";
  const gt = await houseText("11001", dcAt);
  expect(gt).toMatch(/Local zoning standards\s*—\s*Not on file: This lot is in R-3\/GT, a geographically modified version of R-3/);
  expect(gt).not.toContain("Zoning district R-3/GT");

  // A condominium unit is residential but not a house on its own lot: no lot checks.
  dcZone = "R-1B";
  dcParcel = { ...dcParcel, USECODE: "016", LANDAREA: 0 };
  const condo = await houseText("11001", dcAt);
  expect(condo).toContain("a unit in a condominium or cooperative");
  expect(condo).not.toContain("Accessory apartment (ADU)");
  expect(condo).not.toContain("Swimming pool");

  // A church (OTR 081) gets no home checks.
  dcParcel = { ...dcParcel, USECODE: "081", LANDAREA: 20000 };
  const church = await houseText("11001", dcAt);
  expect(church).toContain("This parcel is Religious (DC Office of Tax and Revenue USECODE Table, USECODE 081), so residential homeowner checks do not apply");

  // Nashville: the Assessor's LUDesc decides the use; the code couldn't be read (Municode 403) and the panel says so.
  nash = { ParID: 1, PropAddr: "1 TEST AVE", Zoning: "RS7.5", LUDesc: "SINGLE FAMILY", Acres: 0.2, TotlAppr: 400000 };
  const n1 = await houseText("47037", { lat: 36.13, lng: -86.79 });
  expect(n1).toContain("SINGLE FAMILY (Metro Nashville Parcels (Parcels_view))");
  expect(n1).not.toContain("doesn't record this lot's use");
  expect(n1).toMatch(/Local zoning standards\s*—\s*Not on file: No local zoning standards are on file here\. Nashville \/ Davidson County: .*Municode/);
  nash = { ...nash, LUDesc: "DUPLEX" };
  const n2 = await houseText("47037", { lat: 36.13, lng: -86.79 });
  expect(n2).toContain("DUPLEX (Metro Nashville Parcels (Parcels_view))");
  expect(n2).not.toContain("Interior accessory suite");   // a duplex is not a single-family house
  nash = { ...nash, LUDesc: "CHURCH" };
  const n3 = await houseText("47037", { lat: 36.13, lng: -86.79 });
  expect(n3).toContain("This parcel is CHURCH (Metro Nashville Parcels (Parcels_view)), so residential homeowner checks do not apply");
  expect(errors).toEqual([]);
});

// NC OneMap's `saledate` is an ArcGIS date (epoch milliseconds). Before 17 Nov 2026 the normalizer read it as the sale
// price (1727326800000 -> "$1.7 trillion") and as a digit-string date ("1727..." -> year 1727). NYC and DC parcel IDs
// fell back to "Lot Parcel" because their registry entries named no parcel-ID field.
test("parcel normalizer: an ArcGIS date is a date, never a price; NYC and DC show their own parcel IDs", async ({ page }) => {
  const errors = await openPage(page);
  const r = await page.evaluate(() => {
    const ev = (s: string) => (0, eval)(s);
    const norm = ev("normalizeParcelFeature");
    const nc = norm({ attributes: { parno: "5032-41-4749", saledate: 1727326800000, parval: 155637 }, geometry: null }, { lat: 35.78, lng: -78.64 },
      { name: "NC OneMap", apn: undefined, fields: [] }).attributes;
    const svcs = ev("PARCELS87");
    const nycSvc = svcs.find((s: any) => /MAPPLUTO/.test(s.url));
    const dcSvc = svcs.find((s: any) => /Property_and_Land_WebMercator\/MapServer\/40/.test(s.url));
    const ny = norm({ attributes: { BBL: 4036760029, Address: "64-54 212 STREET" }, geometry: null }, { lat: 40.74, lng: -73.77 }, nycSvc).attributes;
    const dc = norm({ attributes: { SSL: "1858    0012", PREMISEADD: "3825 LEGATION ST NW" }, geometry: null }, { lat: 38.96, lng: -77.07 }, dcSvc).attributes;
    return { ncPrice: nc.LastSalePrice, ncDate: nc.LastSaleDate, ncAin: nc.AIN, nyAin: String(ny.AIN), dcAin: dc.AIN };
  });
  expect(r.ncPrice).toBe(0);
  expect(r.ncDate).toBe("20240926");
  expect(r.ncAin).toBe("5032-41-4749");
  expect(r.nyAin).toBe("4036760029");
  expect(r.dcAin).toBe("1858    0012");
  expect(errors).toEqual([]);
});
