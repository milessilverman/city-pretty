// Draw-your-own-area: the panel for a fixed polygon in central Los Angeles must match what the engine returned.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectBlockGroups } from "../../src/platform/boundary/index.js";

const money = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
const perDollar = (v: number) => "$" + v.toFixed(2);

test("a drawn area lists block groups and ranked improvements from the engine", async ({ page }) => {
  const errors: string[] = [];
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/bubbles/.test(m.text() + m.location().url)) errors.push(m.text()); });
  await page.goto("");
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  await page.waitForFunction(() => !!(window as any).CPBoundary && !!document.querySelector(".cp-boundary-ctl") && (window as any).D?.bgs?.features?.length > 0, null, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Draw an area" })).toBeVisible();

  // Read three real block-group features from the bundle: the first one and its two nearest neighbours by centroid.
  const { features, latlngs } = await page.evaluate(() => {
    const feats = (window as any).D.bgs.features;
    const bb = (f: any) => { const c = f.geometry.coordinates[0]; const xs = c.map((p: number[]) => p[0]), ys = c.map((p: number[]) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    const cen = (f: any) => { const b = bb(f); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
    const home = feats.find((f: any) => f.properties.id === "060372044201") || feats[0];
    const hc = cen(home);
    const near = feats.filter((f: any) => f !== home).map((f: any) => ({ f, d: Math.hypot(cen(f)[0] - hc[0], cen(f)[1] - hc[1]) })).sort((a: any, b: any) => a.d - b.d).slice(0, 2).map((x: any) => x.f);
    const cs = [home, ...near].map(cen);
    const hb = bb(home), pad = (hb[2] - hb[0]) / 2;
    const x0 = Math.min(...cs.map((c) => c[0])) - pad, x1 = Math.max(...cs.map((c) => c[0])) + pad, y0 = Math.min(...cs.map((c) => c[1])) - pad, y1 = Math.max(...cs.map((c) => c[1])) + pad;
    return { features: feats, latlngs: [[y0, x0], [y0, x1], [y1, x1], [y1, x0]] };
  });

  await page.evaluate((ll) => (window as any).CPBoundary.finish(ll.map(([lat, lng]: number[]) => ({ lat, lng }))), latlngs);
  await expect(page.locator("#cp-boundary-panel")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#cp-boundary-panel .cp-b-imp").first()).toBeVisible({ timeout: 60_000 });
  const text = await page.locator("#cp-boundary-panel").innerText();
  expect(text).toContain("Your area");
  expect(text).toContain("not parcel-level");

  // Block-group count equals an independent Node recomputation from the same bundle.
  const ring = latlngs.map(([lat, lng]: number[]) => [lng, lat] as [number, number]);
  const expected = selectBlockGroups(ring, features).filter((s) => s.inside !== "outside");
  expect(expected.length).toBeGreaterThan(0);
  const res = await page.evaluate(() => {
    const r = (window as any).CPBoundary.lastResult;
    return { ids: r.selection.map((s: any) => s.id), perBlockGroup: r.perBlockGroup, improvements: r.aggregate.improvements, message: r.message || null };
  });
  expect(res.message).toBeNull();
  expect(res.ids.sort()).toEqual(expected.map((s) => s.id).sort());
  expect(text).toContain(`${expected.length} block group`);
  expect(await page.locator("#cp-boundary-panel .cp-b-imp").count()).toBeGreaterThanOrEqual(1);

  // Every dollar figure in the panel is an engine figure, or the sum of engine figures the aggregate reports.
  const allowed = new Set<string>();
  for (const b of res.perBlockGroup) for (const i of (b.rec && b.rec.ideas) || []) {
    for (const f of [i.cost, i.valueAdded]) if (f && f.value != null) allowed.add(money(f.value));
    if (i.valuePerDollar && i.valuePerDollar.value != null) allowed.add(perDollar(i.valuePerDollar.value));
  }
  for (const imp of res.improvements) {
    const sum = (field: string) => {
      const xs = res.perBlockGroup.filter((b: any) => b.inside === "centroid_inside" && b.rec).map((b: any) => (b.rec.ideas.find((i: any) => i.id === imp.key) || {})[field]).filter((f: any) => f && f.value != null).map((f: any) => f.value);
      return xs.length ? xs.reduce((a: number, b: number) => a + b, 0) : null;
    };
    expect(imp.cost.value).toBe(sum("cost"));
    expect(imp.valueAdded.value).toBe(sum("valueAdded"));
    for (const t of [imp.cost, imp.valueAdded]) if (t.value != null) allowed.add(money(t.value));
  }
  const shown = text.match(/\$[\d,]+(\.\d+)?/g) || [];
  for (const d of shown) expect(allowed.has(d), `${d} is not an engine figure`).toBe(true);

  // Withheld ideas are listed by name with a reason and no number.
  const held = res.improvements.filter((i: any) => i.blockGroups === 0);
  for (const h of held) {
    const li = page.locator("#cp-boundary-panel li", { hasText: h.name }).last();
    await expect(li).toContainText(h.withheldIn.reasons[0].reason);
    expect(await li.innerText()).not.toContain("$");
  }
  expect(errors).toEqual([]);

  await page.getByRole("button", { name: "Clear" }).first().click();
  await expect(page.locator("#cp-boundary-panel")).toBeHidden();
});

// ---- real end-to-end: draw around a real located site, open its effect area, no request interception
const evidence = JSON.parse(readFileSync("app/data/impact_distance_effects.json", "utf8")).records;

async function openAndDraw(page: any, keys: string[]) {
  const errors: string[] = [];
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  page.on("pageerror", (e: Error) => errors.push(e.message));
  page.on("console", (m: any) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("");
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  await page.waitForFunction(() => !!(window as any).CPBoundary && !!(window as any).CPBubbles && !!document.querySelector(".cp-boundary-ctl") && (window as any).D?.bgs?.features?.length > 0, null, { timeout: 60_000 });
  const pick = await page.evaluate(async (ks: string[]) => {
    const w: any = window;
    await w.eval("loadSites()");
    const S = w.eval("SITES").sites;
    for (const k of ks) for (const f of w.D.bgs.features) {
      if (!f.properties.id.startsWith("06037")) continue;
      const rec = (S[f.properties.id] || []).find((r: any) => r.p === k && Array.isArray(r.pt));
      if (!rec) continue;
      const c = f.geometry.coordinates[0], xs = c.map((p: number[]) => p[0]), ys = c.map((p: number[]) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      return { key: k, pt: rec.pt, latlngs: [[y0, x0], [y0, x1], [y1, x1], [y1, x0]] };
    }
    return null;
  }, keys);
  return { errors, pick };
}

test("Show effect area for a located site with a cited study draws rings and shows only that study's figures", async ({ page }) => {
  const { errors, pick } = await openAndDraw(page, ["pocket_park", "corridor_trail"]);
  expect(pick, "no pocket_park or corridor_trail site with a point in the Los Angeles site data").not.toBeNull();
  await page.evaluate((ll: number[][]) => (window as any).CPBoundary.finish(ll.map(([lat, lng]) => ({ lat, lng }))), pick.latlngs);
  await expect(page.locator("#cp-boundary-panel")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => !!(window as any).CPBoundary.lastResult, null, { timeout: 60_000 });
  const btn = page.locator(`#cp-boundary-panel button[data-act="effect"][data-key="${pick.key}"]`).first();
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.locator(".cp-bubbles-panel")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).CPBubbles.ringLayers().length)).toBeGreaterThan(0);

  const rec = evidence.find((r: any) => r.improvementKey === pick.key && r.status === "verified");
  expect(rec).toBeTruthy();
  const panelText = await page.locator(".cp-bubbles-panel").innerText();
  expect(panelText).toContain(rec.study.citation);
  const allowed = new Set<number>();
  for (const b of rec.bands) for (const v of [b.effectPct, b.lowPct, b.highPct]) if (typeof v === "number") allowed.add(Math.abs(v));
  const cells = await page.locator(".cp-bubbles-panel table tbody tr td:nth-child(2)").allInnerTexts();
  expect(cells.length).toBeGreaterThan(0);
  for (const c of cells) for (const m of c.match(/\d+(?:\.\d+)?%/g) || []) expect(allowed.has(parseFloat(m)), `${m} is not a band value of ${rec.id}`).toBe(true);
  const bubbles = await page.evaluate(() => { const l = (window as any).CPBubbles.last; return { table: document.querySelector(".cp-bubbles-panel table")?.textContent || "", n: l && l.summary && l.summary.bands.length }; });
  console.log("BUBBLES " + pick.key + " " + rec.study.citation + " | bands " + bubbles.n + " | " + bubbles.table.replace(/\s+/g, " ").slice(0, 700));
  expect(errors).toEqual([]);

  await page.getByRole("button", { name: "Clear" }).first().click();
  expect(await page.evaluate(() => (window as any).CPBubbles.ringLayers().length)).toBe(0);
});

test("Show effect area for an improvement with no cited study says so and draws no rings", async ({ page }) => {
  const { errors, pick } = await openAndDraw(page, ["traffic_calming", "crosswalks"]);
  test.skip(!pick, "no traffic_calming or crosswalks site with a point in the Los Angeles site data");
  await page.evaluate((ll: number[][]) => (window as any).CPBoundary.finish(ll.map(([lat, lng]) => ({ lat, lng }))), pick.latlngs);
  await expect(page.locator("#cp-boundary-panel")).toBeVisible({ timeout: 60_000 });
  const btn = page.locator(`#cp-boundary-panel button[data-act="effect"][data-key="${pick.key}"]`).first();
  await expect(btn).toBeVisible({ timeout: 60_000 });
  await btn.click();
  await expect(page.locator(".cp-bubbles-panel")).toContainText("No cited study", { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).CPBubbles.ringLayers().length)).toBe(0);
  expect(errors).toEqual([]);
});
