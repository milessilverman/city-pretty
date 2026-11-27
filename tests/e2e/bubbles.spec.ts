// Effect-area bubbles: rings come only from the evidence file. The file is intercepted and replaced with a synthetic fixture
// (FIXTURE: not real data; fake study at example.invalid) so this test does not depend on the research.
import { expect, test, type Page } from "@playwright/test";
import { makeQuantity } from "../../src/platform/schema/quantity.js";
import { selectRecord, ringSummary } from "../../src/platform/pilot/distanceEffects.js";

const QUOTE0 = "FIXTURE quote for the near band.";
const QUOTE1 = "FIXTURE quote for the far band.";
const FIXTURE = {
  schemaVersion: 1, retrieved: "2026-01-01",
  records: [{
    id: "fixture-1", improvementKey: "traffic_calming", target: "residential_property_value", direction: "positive",
    bands: [
      { inner: 0, outer: 300, unit: "m", effectPct: 5, lowPct: 3, highPct: 7, quoteIndex: 0 },
      { inner: 300, outer: 900, unit: "m", effectPct: 2, lowPct: 1, highPct: 3, quoteIndex: 1 },
    ],
    distanceBasis: "straight_line", studyArea: "Fixture City (synthetic)", propertyType: "single-family homes (synthetic)",
    study: { citation: "Fixture Author (2000). A Synthetic Study.", doi: null, url: "https://example.invalid/study", retrieved: "2026-01-01", type: "hedonic" },
    quotes: [QUOTE0, QUOTE1], transferability: "FIXTURE transferability sentence.", status: "verified", notRepresented: ["FIXTURE not-represented item"],
  }],
};

async function openPage(page: Page, body: unknown) {
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  await page.route("**/impact_distance_effects.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  if (!(await page.evaluate(() => !!(window as any).CPBubbles?.ringLayers))) await page.addScriptTag({ type: "module", url: "/city-pretty/app/bubbles.js" });
  await page.waitForFunction(() => !!(window as any).CPBubbles?.ringLayers);
  return errors;
}

// Two real, touching block groups from the loaded bundle and a site on a vertex they share.
async function twoBlockGroups(page: Page) {
  return page.evaluate(() => {
    const feats = (window as any).D.bgs.features as any[];
    const ring = (f: any) => (f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]);
    const key = (c: number[]) => c[0] + "," + c[1];
    for (let i = 0; i < feats.length; i++) {
      const a = ring(feats[i]);
      const set = new Set(a.map(key));
      for (let j = i + 1; j < Math.min(feats.length, i + 400); j++) {
        const shared = ring(feats[j]).find((c: number[]) => set.has(key(c)));
        if (shared && feats[i].properties.h > 0 && feats[j].properties.h > 0) return { features: [feats[i], feats[j]], site: shared };
      }
    }
    return null;
  });
}

test("rings drawn from the cited record: circles, panel text, homes within bounds, summary equals Node", async ({ page }) => {
  const errors = await openPage(page, FIXTURE);
  const pick = await twoBlockGroups(page);
  expect(pick).not.toBeNull();
  const site = { key: "traffic_calming", name: "Speed humps", geometry: { type: "Point", coordinates: pick!.site }, blockGroupId: pick!.features[0].properties.id, label: "FIXTURE street" };
  const summary = await page.evaluate(([s, f]) => (window as any).CPBubbles.show({ map: (window as any).map, site: s, context: { blockGroups: f, projects: null, otherRecommendations: [] } }), [site, pick!.features] as const);
  expect(summary).not.toBeNull();
  expect(await page.evaluate(() => (window as any).CPBubbles.ringLayers().length)).toBe(2);
  const panel = page.locator(".cp-bubbles-panel");
  await expect(panel).toContainText("Fixture Author (2000). A Synthetic Study.");
  await expect(panel).toContainText(QUOTE0);
  await expect(panel).toContainText(QUOTE1);
  await expect(panel).toContainText("FIXTURE transferability sentence.");
  await expect(panel).toContainText("FIXTURE not-represented item");
  await expect(panel).toContainText("project data not loaded for this county");
  await expect(panel.locator('a[href="https://example.invalid/study"]')).toHaveCount(1);

  const homes = summary.bands.map((b: any) => b.homesEstimated.value);
  for (const h of homes) expect(typeof h).toBe("number");
  const total = pick!.features.reduce((t: number, f: any) => t + f.properties.h, 0);
  expect(homes.reduce((a: number, b: number) => a + b, 0)).toBeLessThanOrEqual(total + 1e-6);

  // Same inputs through ringSummary in Node
  const mk = (v: number, unit: string) => makeQuantity({ value: v, low: v, high: v, unit, status: "estimated", source: { title: "t", url: "https://example.invalid/x", retrieved: "2026-01-01" }, jurisdiction: "j", effectiveDate: "2026-01-01" });
  const node: any = ringSummary({
    record: selectRecord(FIXTURE.records, "traffic_calming").record as any, site: site.geometry as any, siteKey: "traffic_calming", samplesPerBlockGroup: summary.samplesPerBlockGroup,
    blockGroups: pick!.features.map((f: any) => ({ id: String(f.properties.id), homes: mk(f.properties.h, "homes"), medianHomeValue: typeof f.properties.hv === "number" ? mk(f.properties.hv, "USD") : null, polygon: f.geometry })),
  });
  const nums = (s: any) => s.bands.map((b: any) => [b.kind, b.innerM, b.outerM, b.homesEstimated.value, b.homesEstimated.low, b.homesEstimated.high, b.valueEffect.value, b.valueEffect.low, b.valueEffect.high]);
  expect(nums(summary)).toEqual(nums(node));
  expect(errors).toEqual([]);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: process.env.BUBBLES_SHOT || "test-results/bubbles-1280.png" });
  await page.evaluate(() => (window as any).CPBubbles.clear());
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).CPBubbles.ringLayers().length)).toBe(0);
});

test("no record: the no-study sentence, zero circles, no projects or add-alongside lists", async ({ page }) => {
  await openPage(page, { schemaVersion: 1, retrieved: "2026-01-01", records: [] });
  const pick = await twoBlockGroups(page);
  const site = { key: "traffic_calming", name: "Speed humps", geometry: { type: "Point", coordinates: pick!.site }, blockGroupId: "x", label: "FIXTURE street" };
  await page.evaluate(([s, f]) => (window as any).CPBubbles.show({ map: (window as any).map, site: s, context: { blockGroups: f, projects: [], otherRecommendations: [] } }), [site, pick!.features] as const);
  const panel = page.locator(".cp-bubbles-panel");
  await expect(panel).toContainText("No cited study gives a distance for this improvement yet, so no effect area is drawn");
  await expect(panel).not.toContainText("Projects already in this area");
  await expect(panel).not.toContainText("Could be added alongside");
  expect(await page.evaluate(() => (window as any).CPBubbles.ringLayers().length)).toBe(0);
});

test("requires_investigation shows the record's reason; null effectPct and a negative effect render as such", async ({ page }) => {
  const rec = (over: any) => ({ ...FIXTURE.records[0], ...over });
  await openPage(page, { schemaVersion: 1, retrieved: "2026-01-01", records: [
    rec({ id: "ri", improvementKey: "park_upgrade", status: "requires_investigation", reason: "FIXTURE reason: paywalled", bands: [], quotes: [] }),
    rec({ id: "neg", improvementKey: "protected_bike", direction: "negative", bands: [
      { inner: 0, outer: 300, unit: "m", effectPct: -9.7, lowPct: null, highPct: null, quoteIndex: 0 },
      { inner: 300, outer: 900, unit: "m", effectPct: null, lowPct: null, highPct: null, quoteIndex: 1 }] }),
    rec({ id: "nest", improvementKey: "pocket_park", bands: [
      { inner: 0, outer: 0.125, unit: "mile", effectPct: 8, lowPct: null, highPct: null, quoteIndex: 0 },
      { inner: 0, outer: 0.25, unit: "mile", effectPct: 9, lowPct: null, highPct: null, quoteIndex: 1 }] }),
  ] });
  const pick = await twoBlockGroups(page);
  const show = (key: string) => page.evaluate(([k, s, f]: any) => (window as any).CPBubbles.show({ map: (window as any).map, site: { key: k, name: k, geometry: { type: "Point", coordinates: s } }, context: { blockGroups: f } }), [key, pick!.site, pick!.features] as const);
  const panel = page.locator(".cp-bubbles-panel");

  await show("park_upgrade");
  await expect(panel).toContainText("No cited study gives a distance");
  await expect(panel).toContainText("FIXTURE reason: paywalled");

  const neg: any = await show("protected_bike");
  await expect(panel).toContainText("−9.7%");
  await expect(panel).toContainText("No percentage given by the study");
  expect(neg.bands[0].valueEffect.value === null || neg.bands[0].valueEffect.value < 0).toBe(true);
  expect(neg.bands[1].valueEffect.value).toBeNull();
  expect(await page.evaluate(() => (window as any).CPBubbles.ringLayers().length)).toBe(2);

  const nest: any = await show("pocket_park");
  expect(nest.bands.map((b: any) => b.kind)).toEqual(["within", "within"]);
  await expect(panel).toContainText("within 0.125 mile");
  await expect(panel).toContainText("alternative measurements of the same homes, not to be added together");
});
