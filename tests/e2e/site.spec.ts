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
  // A county with no back-test keeps the "unvalidated" label.
  const other = await page.evaluate(() => (window as any).publishValuation({ estimatedValue: 500000, confidenceRating: "Unvalidated estimate — no back-test against sales yet" }, "48453", {}));
  expect(other.estimatedValue).toBe(500000);
  expect(other.confidenceRating).toContain("Unvalidated estimate");
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

test("house panel shows live public records with links, from the agencies (responses mocked from real captures)", async ({ page }) => {
  const fx = (n: string) => require("fs").readFileSync(require("path").join(__dirname, "../fixtures/sources", n), "utf8");
  const serve = (body: string) => (route: any) => route.fulfill({ status: 200, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
  await page.route(/tigerweb\.geo\.census\.gov\/.*MapServer\/10\/query/, serve(fx("tiger_bg_austin.json")));
  await page.route(/tigerweb\.geo\.census\.gov\/.*MapServer\/82\/query/, serve(fx("tiger_county_austin.json")));
  await page.route(/Fair_Market_Rents\/FeatureServer\/0\/query/, serve(fx("hud_fmr_austin.json")));
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
  expect(text!.text).toContain("2 bed $1,852");
  expect(text!.text).toContain("Zone AE");
  expect(text!.links.some((l) => l.includes("hazards.fema.gov"))).toBe(true);
  expect(errors).toEqual([]);
});

test("tax-increment section: California computes from the roll; Texas says which rules are unverified", async ({ page }) => {
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
  expect(tx).toMatch(/Not computed: Texas tax rules not verified yet \(/);
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
    ev("CRASH_COUNTS")["06037"] = { [id]: [4, 2, 37], _meta: { crashes: 100, with_coordinates: 74, source: "CHP California Crash Reporting System (CCRS)", years: [2023, 2025] } };
    return ev("whyFix")("12 pedestrian or bike crashes recorded");
  });
  expect(out).toContain("37 crashes recorded inside this block group or on its boundary streets");
  expect(out).toContain("4 involving a pedestrian or cyclist");
  expect(out).toContain("only the 74% of this county's crashes that have coordinates");
  expect(out).not.toContain("12 ");
  expect(errors).toEqual([]);
});
