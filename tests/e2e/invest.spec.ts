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

test("Invest view renders the five cards for a mid-size county, with no null, NaN or undefined text", async ({ page }) => {
  const errors = await openPage(page);
  await openInvest(page);
  await expect(page.locator("#map")).toBeHidden();
  for (const id of ["iv-where", "iv-build", "iv-sites", "iv-house", "iv-transit"]) await expect(page.locator("#" + id)).toBeVisible();
  await expect(page.locator(".iv-title")).toContainText("Travis County");
  await expect(page.locator(".iv-honest")).toContainText(/ranking|back-tested/i);
  expect(await page.locator("#iv-where .iv-hood").count()).toBeGreaterThan(3);
  await expect(page.locator("#iv-where .iv-grade").first()).toContainText("Confidence");
  await expect(page.locator("#iv-where .iv-basis").first()).toBeVisible();
  await expect(page.locator("#iv-house")).toContainText("lot");
  await expect(page.locator("#iv-transit")).toContainText("Rules used");
  // the brief is stashed for the advisor, and copying it works
  const brief = await page.evaluate(() => (window as any).__cpDecisionBrief);
  expect(brief.schema).toBe("city-pretty/decision-brief@1");
  await page.evaluate(() => navigator.clipboard.writeText = async () => {});
  await page.click("[data-iv=copy]");
  await expect(page.locator("#iv-copy-l")).toHaveText("Copied");
  expect(await badWords(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("changing the budget changes which plays are listed", async ({ page }) => {
  await openPage(page);
  await openInvest(page);
  await page.click("[data-iv-budget='0']");
  const small = await page.locator("#invest .iv-play").count();
  await page.click("[data-iv-budget='4']");
  const big = await page.locator("#invest .iv-play").count();
  expect(big).toBeGreaterThan(small);
  await expect(page.locator("#iv-sites")).toContainText("golf");
  expect(await badWords(page)).toEqual([]);
  await page.click("[data-iv-budget='0']");
  await expect(page.locator("#iv-sites .iv-gated")).toBeVisible();
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
  const r2 = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(r2.scroll).toBeLessThanOrEqual(r2.width);
  expect(await badWords(page)).toEqual([]);
  await ctx.close();
});
