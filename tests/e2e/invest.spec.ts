// Invest view: the decision brief for a county. A mid-size county (Travis County, TX) is opened through the page's own
// loader; no live third-party service is needed.
import { expect, test, type Page } from "@playwright/test";

const TRAVIS = "48453";

async function openPage(page: Page) {
  const errors: string[] = [];
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  return errors;
}
async function openInvest(page: Page, fips = TRAVIS) {
  await page.evaluate((f) => (window as any).openCounty(f), fips);
  await page.waitForFunction((f) => (window as any).D_OC?.meta?.fips === f && (window as any).activeCounty === "oc", fips, { timeout: 90_000 });
  await page.click("#view-switch [data-view=invest]");
  await expect(page.locator(".iv-card")).toHaveCount(5, { timeout: 60_000 });
}
async function badWords(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const w = document.createTreeWalker(document.querySelector("#invest")!, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode.textContent || "";
      if (/\bnull\b|NaN|undefined/.test(t)) out.push(t.trim().slice(0, 80));
    }
    return out;
  });
}

async function openAll(page: Page) {
  await page.evaluate(() => document.querySelectorAll("#invest details").forEach((d) => ((d as HTMLDetailsElement).open = true)));
}

test("Invest view renders the five sections for a mid-size county, with no null, NaN or undefined text", async ({ page }) => {
  const errors = await openPage(page);
  await openInvest(page);
  await expect(page.locator("#map")).toBeHidden();
  for (const id of ["iv-where", "iv-build", "iv-sites", "iv-house", "iv-transit"]) await expect(page.locator("#" + id)).toBeVisible();
  await expect(page.locator(".iv-title")).toContainText("Travis County");
  // plain-words bottom line, one line per question, no statistics jargon
  await expect(page.locator("#iv-bottom li")).toHaveCount(5);
  const bl = await page.locator("#iv-bottom").innerText();
  expect(bl).not.toMatch(/correlation|rho|quintile|percentile/i);
  expect(await page.locator("#iv-where .iv-hood").count()).toBeGreaterThanOrEqual(3);
  expect(await page.locator("#iv-where .iv-hood").count()).toBeLessThanOrEqual(5);
  await expect(page.locator("#iv-where .iv-grade").first()).toContainText("Confidence");
  await expect(page.locator("#iv-house")).toContainText("lot");
  await expect(page.locator("#iv-transit")).toContainText("Rules used");
  // the test details (rank correlation etc.) live in the "How this was tested" panel
  await expect(page.locator(".iv-honest")).toBeHidden();
  await page.locator(".iv-tested > summary").click();
  await expect(page.locator(".iv-honest")).toContainText(/ranking|back-tested/i);
  // sticky nav reaches every section
  await page.click(".iv-nav [data-iv-jump=iv-transit]");
  await expect(page.locator("#iv-transit")).toBeVisible();
  // the brief is stashed for the advisor, and copying it works
  const brief = await page.evaluate(() => (window as any).__cpDecisionBrief);
  expect(brief.schema).toBe("city-pretty/decision-brief@1");
  await page.evaluate(() => navigator.clipboard.writeText = async () => {});
  await page.click("[data-iv=copy]");
  await expect(page.locator("#iv-copy-l")).toHaveText("Copied");
  expect(await badWords(page)).toEqual([]);
  await openAll(page);
  await expect(page.locator("#iv-where .iv-basis").first()).toBeVisible();
  await expect(page.locator("#iv-where .iv-hood.sel")).toHaveCount(1);
  expect(await badWords(page)).toEqual([]);
  await page.click("[data-iv-budget='4']");
  await openAll(page);
  expect(await badWords(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("display ranks start at 1 and run in order; Show 10 lists more; selecting updates Build", async ({ page }) => {
  await openPage(page);
  await openInvest(page);
  const ranks = async () => (await page.locator("#iv-where .iv-rank").allInnerTexts()).map(Number);
  const r5 = await ranks();
  expect(r5[0]).toBe(1);
  expect(r5).toEqual(r5.map((_, i) => i + 1));
  const more = page.locator("[data-iv=more-hoods]");
  if (await more.count()) { await more.click(); expect((await ranks()).length).toBeGreaterThan(r5.length); }
  const rows = page.locator("#iv-where .iv-hood");
  if ((await rows.count()) > 1) {
    const id = await rows.nth(1).getAttribute("data-hood");
    const name = (await rows.nth(1).locator(".iv-hood-name b").innerText()).trim();
    await rows.nth(1).locator("[data-iv-hood]").click();
    await expect(page.locator(`#iv-where .iv-hood.sel`)).toHaveAttribute("data-hood", id!);
    await expect(page.locator("#iv-build .iv-lede")).toContainText(name.slice(0, 20));
  }
});

test("default page is short: under 5,000 px for Travis County at 1280x900", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await openPage(page);
  await openInvest(page);
  await page.waitForTimeout(500);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(h).toBeLessThan(5000);
  await ctx.close();
});

test("changing the budget changes which plays are listed", async ({ page }) => {
  await openPage(page);
  await openInvest(page);
  await page.click("[data-iv-budget='0']");
  const small = await page.locator("#invest .iv-play").count();
  await page.click("[data-iv-budget='4']");
  const big = await page.locator("#invest .iv-play").count();
  expect(big).toBeGreaterThan(small);
  // Travis County has no underused site on this base (the hand-typed Austin golf course and parking lot were removed as
  // fabricated, tests/unit/provenance.test.ts), so the card says none are listed instead of inventing one.
  await expect(page.locator("#iv-sites")).toContainText("No underused sites have been measured");
  expect(await badWords(page)).toEqual([]);
  // the local project table has no length or cost, so the light-rail project is listed without a cost figure
  await expect(page.locator("#iv-transit")).toContainText("Project Connect");
  await expect(page.locator("#iv-transit")).toContainText("not in the project table");
  await page.click("[data-iv-budget='0']");
  await expect(page.locator("#iv-transit .iv-gated")).toBeVisible();
});

test("ideas the data audit did not confirm are listed by name with no figures, as on the map panel", async ({ page }) => {
  await openPage(page);
  await openInvest(page);
  await page.click("[data-iv-budget='4']");
  await openAll(page);
  const st = await page.evaluate(() => {
    const m = (window as any).cpInvest.state.model, ver = (window as any).cpInvest.state.data.verification;
    return { withheld: m.rec.withheld.map((w: any) => w.id), shown: m.rec.ideas.map((x: any) => [x.id, ver[x.id] && ver[x.id].status]) };
  });
  expect(st.withheld.length).toBeGreaterThan(0);
  for (const [, s] of st.shown) expect(["verified", "partially_verified"]).toContain(s);
  await expect(page.locator("#iv-build .iv-nofgroup")).toContainText("could not be confirmed against a source");
});

test("See on map leaves Invest and selects that neighborhood; Map and Explore still switch", async ({ page }) => {
  await openPage(page);
  await openInvest(page);
  const id = await page.locator("#iv-where [data-iv-map]").first().getAttribute("data-iv-map");
  await page.locator("#iv-where [data-iv-map]").first().click();
  await expect(page.locator("#map")).toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/invest-mode/);
  await page.waitForFunction((want) => (window as any).location.hash.includes("bg=" + want), id, { timeout: 20_000 });
  await page.click("#view-switch [data-view=invest]");
  await expect(page.locator(".iv-card")).toHaveCount(5);
  await page.click("#view-switch [data-view=explore]");
  await expect(page.locator("body")).not.toHaveClass(/invest-mode/);
  await expect(page.locator(".ex-title")).toBeVisible();
});

test("a county with no neighborhood data says so instead of guessing", async ({ page }) => {
  await openPage(page);
  // Alaska's Yukon-Koyukuk: property lines only in the county list when no bundle is built
  const lots = await page.evaluate(() => { const e = [...document.querySelectorAll<HTMLElement>("script.county-bundle")].find((x) => x.dataset.coverage === "lots"); return e ? e.dataset.fips : null; });
  test.skip(!lots, "every county has a bundle in this build");
  await page.evaluate((f) => (window as any).openCounty(f), lots);
  await page.waitForTimeout(3000);
  await page.click("#view-switch [data-view=invest]");
  await expect(page.locator(".iv-title")).toContainText("No brief");
  expect(await badWords(page)).toEqual([]);
});

test("Invest view fits a phone screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await openPage(page);
  await openInvest(page);
  const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(r.scroll).toBeLessThanOrEqual(r.width);
  await expect(page.locator("#view-switch [data-view=invest]")).toBeVisible();
  await page.click("[data-iv-budget='4']");
  await openAll(page);
  const r2 = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(r2.scroll).toBeLessThanOrEqual(r2.width);
  expect(await badWords(page)).toEqual([]);
  await ctx.close();
});
