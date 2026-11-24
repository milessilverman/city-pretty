// Platform pilot results page: every number on it must come from app/data/platform_pilot_la.json.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("app/data/platform_pilot_la.json", "utf8"));
const S = data.summary;
const fmt = (n: number) => n.toLocaleString("en-US");

test("platform page matches the pilot file and has no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("app/platform.html");
  await expect(page.getByTestId("banner")).toBeVisible({ timeout: 30_000 });

  const bs = S.evaluations.byStatus;
  await expect(page.getByTestId("count-total")).toHaveText(fmt(S.evaluations.total));
  await expect(page.getByTestId("count-viable")).toHaveText(fmt(bs.viable));
  await expect(page.getByTestId("count-needs-info")).toHaveText(fmt(bs.needs_info));
  await expect(page.getByTestId("count-rejected")).toHaveText(fmt(bs.rejected));
  await expect(page.getByTestId("count-not-evaluated")).toHaveText(fmt(bs.not_evaluated));

  const category = data.sampleOpportunities[0].categoryId;
  await page.getByTestId("filter-category").selectOption(category);
  const cats = page.locator('[data-testid="opportunities-row"] td[data-category]');
  const n = await cats.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBe(data.sampleOpportunities.filter((o: any) => o.categoryId === category).length);
  for (let i = 0; i < n; i++) await expect(cats.nth(i)).toHaveAttribute("data-category", category);

  if (bs.rejected === 0) {
    await expect(page.getByTestId("rejected-section")).toContainText("None rejected: nothing was rejected because nothing could be fully assessed");
  }
  await expect(page.getByTestId("limits-list").locator("li")).toHaveCount(S.limits.length);
  expect(errors).toEqual([]);
});
