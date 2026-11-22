// Invest view, Transit card: "Riders, fares and the gap" (src/engines/transitDemandEngine.js) for a county with a
// local project (Travis County, TX: Austin light rail) and a county with only a corridor stop (Guadalupe County, TX).
import { expect, test, type Page } from "@playwright/test";

async function openInvest(page: Page, fips: string) {
  const errors: string[] = [];
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  await page.evaluate((f) => (window as any).openCounty(f), fips);
  await page.waitForFunction((f) => (window as any).D_OC?.meta?.fips === f && (window as any).activeCounty === "oc", fips, { timeout: 90_000 });
  await page.click("#view-switch [data-view=invest]");
  await expect(page.locator(".iv-card")).toHaveCount(5, { timeout: 60_000 });
  await page.click("[data-iv-budget='4']");
  await page.evaluate(() => document.querySelectorAll("#iv-transit details").forEach((d) => ((d as HTMLDetailsElement).open = true)));
  return errors;
}
const noBadWords = async (page: Page) => expect(await page.locator("#iv-transit .iv-demand").allInnerTexts().then((t) => t.join(" "))).not.toMatch(/\bnull\b|NaN|undefined/);

test("pipeline: the Austin light rail shows the mode that fits, riders as a range with the test, money ranges and what is not on file", async ({ page }) => {
  const errors = await openInvest(page, "48453");
  const block = page.locator("#iv-transit .iv-demand").filter({ hasText: "Mode that fits" }).first();
  await expect(block).toBeVisible();
  await expect(block).toContainText("Riders, fares and the gap");
  await expect(block).toContainText(/Mode that fits\s+\S/);
  await expect(block).toContainText(/[\d,]+ to [\d,]+ boardings a day/);
  await expect(block).toContainText(/tested on \d+ stations in \d+ systems, typical error \d+%/);
  for (const label of ["Fare revenue", "Operating cost", "Gap (cost minus fares)", "Capital cost"]) await expect(block).toContainText(label);
  await expect(block).toContainText(/\$[\d.]+M to \$[\d.]+M a year/);
  // the per-stop table: people and jobs within half a mile and a boardings range per stop; sites are not chosen
  await expect(block.locator(".iv-stoptable tbody tr")).toHaveCount(6);
  await expect(block).toContainText("Station sites are not chosen in the documents");
  // funding: programmes listed with their rule, no invented share
  await expect(block).toContainText("FTA Capital Investment Grants (New Starts)");
  await expect(block).toContainText("share not on file");
  await expect(block).toContainText("Not on file");
  // light-rail station model did not beat the people + jobs baseline in its test: the page says so
  await expect(block).toContainText("did not order light rail stations better");
  // what the page shows is what the advisor gets
  const lines = await page.evaluate(() => (window as any).InvestmentDecisionEngine.briefForAdvisor((window as any).__cpDecisionBrief).transitLines);
  expect(lines.length).toBeGreaterThan(0);
  expect(lines[0].name).toContain("Austin Light Rail");
  await noBadWords(page);
  expect(errors).toEqual([]);
});

test("corridor stop: Guadalupe County's corridor ranks its stops and says why fares and costs are not on file", async ({ page }) => {
  const errors = await openInvest(page, "48187");
  const block = page.locator("#iv-transit .iv-demand").first();
  await expect(block).toBeVisible();
  await expect(block).toContainText("The commuter-rail station model is used to rank this corridor's stops");
  await expect(block.locator(".iv-stoptable tbody tr").first()).toBeVisible();
  await expect(block).toContainText("Each stop is the Census internal point of its city");
  await expect(block).toContainText(/NTD does not cover Amtrak/);
  await noBadWords(page);
  expect(errors.filter((e) => !/crash_/.test(e))).toEqual([]);
});
