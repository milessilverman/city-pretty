// Draw an area: a rectangle drawn with real mouse clicks over three block groups of a real county (Travis County, TX),
// with the panel's counts checked against a computation made here by a different method from the page's.
// The page clips polygons (Sutherland-Hodgman over the convex parts of the drawn shape). This file never clips: for a
// rectangle aligned with the map it integrates, along each edge of a block group, how far the edge reaches into the
// rectangle (a line integral with the x coordinate clamped to the rectangle), which gives the overlap area exactly.
import { expect, test, type Page } from "@playwright/test";

const TRAVIS = "48453";
const SEED = "484530011022";   // downtown Austin

async function openTravis(page: Page) {
  const errors: string[] = [];
  await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await page.waitForFunction(() => (document.querySelector("#loading") as HTMLElement | null)?.hidden === true, null, { timeout: 60_000 });
  await page.evaluate((f) => { (window as any).openCounty(f); }, TRAVIS);
  await page.waitForFunction((f) => (window as any).D_OC?.meta?.fips === f && (window as any).activeCounty === "oc" && (0, eval)("!_countyLoading"), TRAVIS, { timeout: 90_000 });
  await expect(page.locator("#btn-draw-area")).toBeVisible();
  return errors;
}
type Ring = [number, number][];
// ∫ over the part of edge a->b with y in [y0, y1] of (clamp(x, x0, x1) - x0) dy, exactly (piecewise linear in y)
function edgeIntegral(a: [number, number], b: [number, number], x0: number, y0: number, x1: number, y1: number) {
  if (a[1] === b[1]) return 0;
  const cuts = [a[1], b[1], y0, y1];
  const yAt = (x: number) => a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
  if (a[0] !== b[0]) cuts.push(yAt(x0), yAt(x1));
  const lo = Math.max(Math.min(a[1], b[1]), y0), hi = Math.min(Math.max(a[1], b[1]), y1);
  if (!(hi > lo)) return 0;
  const ys = [...new Set(cuts.filter((y) => y >= lo && y <= hi).concat([lo, hi]))].sort((p, r) => p - r);
  const xAt = (y: number) => a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
  const g = (y: number) => Math.min(Math.max(xAt(y), x0), x1) - x0;
  let s = 0;
  for (let i = 0; i + 1 < ys.length; i++) s += (g(ys[i]) + g(ys[i + 1])) / 2 * (ys[i + 1] - ys[i]);   // exact: g is linear between cuts
  return b[1] > a[1] ? s : -s;
}
const ringArea = (r: Ring) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(s / 2); };
const ringInRect = (r: Ring, x0: number, y0: number, x1: number, y1: number) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += edgeIntegral(r[j], r[i], x0, y0, x1, y1); return Math.abs(s); };
// share of a block group (Polygon or MultiPolygon, holes removed) inside the rectangle; degrees are fine because a
// share is a ratio of areas and the page's projection only rescales the two axes
function shareInRect(geom: any, x0: number, y0: number, x1: number, y1: number) {
  const polys: Ring[][] = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let all = 0, inside = 0;
  for (const [outer, ...holes] of polys) { all += ringArea(outer); inside += ringInRect(outer, x0, y0, x1, y1); for (const h of holes) { all -= ringArea(h); inside -= ringInRect(h, x0, y0, x1, y1); } }
  return all > 0 ? Math.min(1, inside / all) : 0;
}
const feats = (page: Page) => page.evaluate(() => (0, eval)("activeBundle()").features.map((f: any) => ({ id: f.properties.id, geometry: f.geometry })));
const figuresOf = (page: Page, ids: string[]) => page.evaluate((ids) => { const B = (0, eval)("activeBundle()"); return Object.fromEntries(ids.map((id: string) => [id, { pop: B.details[id].m.pop, homes: B.details[id].m.homes, acres: B.details[id].m.acres }])); }, ids);
async function screenOf(page: Page, lonlat: [number, number][]) {
  const pts = await page.evaluate((ll) => ll.map((p: number[]) => { const c = (window as any).map.latLngToContainerPoint([p[1], p[0]]); return [c.x, c.y]; }), lonlat);
  const box = (await page.locator("#map").boundingBox())!;
  return pts.map((p: number[]) => [box.x + p[0], box.y + p[1]]);
}
async function panelDone(page: Page) {
  await page.waitForSelector("#da-panel[data-da-status]:not([data-da-status=working])", { timeout: 60_000 });
  return page.getAttribute("#da-panel", "data-da-status");
}
async function badWords(page: Page) {
  return page.evaluate(() => {
    document.querySelectorAll("#da-panel details").forEach((d) => ((d as HTMLDetailsElement).open = true));
    const out: string[] = [];
    const w = document.createTreeWalker(document.querySelector("#da-panel")!, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode.textContent || ""; if (/\bnull\b|NaN|undefined/.test(t)) out.push(t.trim().slice(0, 80)); }
    return out;
  });
}
// the three block groups nearest the seed, and a box just around them
async function threeAndBox(page: Page) {
  const all = await feats(page);
  const cen = (g: any) => { const r: Ring = (g.type === "Polygon" ? g.coordinates : g.coordinates[0])[0]; return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length]; };
  const c0 = cen(all.find((f: any) => f.id === SEED).geometry);
  const three = all.map((f: any) => ({ f, d: Math.hypot(cen(f.geometry)[0] - c0[0], cen(f.geometry)[1] - c0[1]) })).sort((a: any, b: any) => a.d - b.d).slice(0, 3).map((x: any) => x.f);
  const cs: number[][] = three.flatMap((f: any) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap((p: any) => p[0]));
  const bb = [Math.min(...cs.map((p) => p[0])), Math.min(...cs.map((p) => p[1])), Math.max(...cs.map((p) => p[0])), Math.max(...cs.map((p) => p[1]))];
  const px = (bb[2] - bb[0]) * 0.03, py = (bb[3] - bb[1]) * 0.03;
  return { all, three, box: [bb[0] - px, bb[1] - py, bb[2] + px, bb[3] + py] };
}
async function drawBox(page: Page, box: number[], finish: "first-corner" | "double-click") {
  await page.evaluate((b) => { (window as any).map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { animate: false, padding: [110, 160] }); }, box);
  await page.waitForTimeout(400);
  await page.click("#btn-draw-area");
  await page.click("[data-da-start=polygon]");
  const scr = await screenOf(page, [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]);
  for (let i = 0; i < 4; i++) {
    if (i === 3 && finish === "double-click") await page.mouse.dblclick(scr[i][0], scr[i][1]);
    else await page.mouse.click(scr[i][0], scr[i][1]);
    await page.waitForTimeout(80);
  }
  if (finish === "first-corner") await page.mouse.click(scr[0][0], scr[0][1]);
  return panelDone(page);
}

test("a polygon drawn over three block groups: the panel's counts equal an independent computation", async ({ page }) => {
  const errors = await openTravis(page);
  const { all, three, box } = await threeAndBox(page);
  const selectedBefore = await page.evaluate(() => (0, eval)("selected"));
  expect(await drawBox(page, box, "first-corner")).toBe("ok");
  expect(await page.evaluate(() => (0, eval)("selected"))).toBe(selectedBefore);   // drawing clicks never select a neighborhood
  const state = await page.evaluate(() => { const a = (window as any).DrawArea.current(); return { ring: a.shape.ring as [number, number][], bgs: a.blockGroups as { id: string; share: number }[] }; });
  expect(state.ring).toHaveLength(4);
  // the rectangle as the page holds it (four clicks on a map whose meridians and parallels are straight)
  const xs = state.ring.map((p) => p[0]).sort((a, b) => a - b), ys = state.ring.map((p) => p[1]).sort((a, b) => a - b);
  // (corners are kept to five decimals, so a side can be off by one unit in the fifth decimal: about a metre in 500)
  expect(xs[1] - xs[0]).toBeLessThan(1.5e-5); expect(xs[3] - xs[2]).toBeLessThan(1.5e-5); expect(ys[1] - ys[0]).toBeLessThan(1.5e-5); expect(ys[3] - ys[2]).toBeLessThan(1.5e-5);
  const [x0, x1, y0, y1] = [(xs[0] + xs[1]) / 2, (xs[2] + xs[3]) / 2, (ys[0] + ys[1]) / 2, (ys[2] + ys[3]) / 2];
  const shares = all.map((f: any) => ({ id: f.id as string, share: shareInRect(f.geometry, x0, y0, x1, y1) })).filter((s: any) => s.share > 0);
  // the page lists exactly the block groups this computation finds (above the tool's half-percent noise floor), with the same shares
  const mine = new Map(shares.map((s: any) => [s.id, s.share]));
  for (const b of state.bgs) expect(Math.abs(b.share - (mine.get(b.id) ?? 0))).toBeLessThan(1e-3);
  for (const s of shares) if (s.share > 0.02) expect(state.bgs.some((b) => b.id === s.id)).toBe(true);
  for (const f of three) expect(state.bgs.find((b) => b.id === f.id)?.share).toBe(1);
  expect(state.bgs.length).toBeGreaterThan(3);   // the box also cuts their neighbours
  // counts: share x the block group's own figure, summed over the block groups the page lists
  const m = await figuresOf(page, state.bgs.map((b) => b.id));
  for (const [key, field] of [["pop", "pop"], ["homes", "homes"], ["landAcres", "acres"]] as const) {
    const want = state.bgs.reduce((s, b) => s + (mine.get(b.id) ?? 0) * (m[b.id] as any)[field], 0);
    const el = page.locator(`#da-panel [data-da-fig="${key}"]`);
    const raw = Number(await el.getAttribute("data-da-value"));
    expect(Math.abs(raw - want)).toBeLessThan(Math.max(0.5, want * 5e-4));
    const shown = Number((await el.locator(".da-num").innerText()).replace(/[^0-9.]/g, ""));
    expect(Math.abs(shown - raw)).toBeLessThanOrEqual(key === "landAcres" ? 0.51 : 0.5);   // the text is the figure, rounded
    expect(await el.getAttribute("data-da-basis")).toBe("apportioned");
    await expect(el).toContainText(/about /);
    await expect(el).toContainText(new RegExp(`estimated from ${state.bgs.length} block groups by area; largest partial share \\d+%`));
  }
  // a median is a range, never one figure for the area
  const hv = page.locator('#da-panel [data-da-fig="hv"]');
  expect(await hv.getAttribute("data-da-basis")).toBe("range");
  await expect(hv).toContainText("homes-weighted average of block-group medians");
  await expect(page.locator("#da-summary")).toContainText(/touches \d+ Census block groups/);
  await expect(page.locator("#da-summary")).toContainText("the median for the area itself cannot be worked out");
  // the four sections, each figure with a basis tag and a disclosure listing the block groups and shares
  for (const k of ["here", "build", "land", "transit"]) await expect(page.locator(`#da-panel [data-da-sec=${k}]`)).toBeVisible();
  await page.locator('#da-panel [data-da-fig="pop"] .da-how > summary').click();
  await expect(page.locator('#da-panel [data-da-fig="pop"] .da-from tbody tr')).toHaveCount(state.bgs.length);
  await expect(page.locator('#da-panel [data-da-fig="pop"] .da-from')).toContainText(three[0].id);
  await expect(page.locator("#da-panel [data-da-sec=land]")).toContainText("What would get this land redeveloped is not on file");
  await expect(page.locator("#da-panel [data-da-verdict]")).toBeVisible();
  await expect(page.locator("#da-panel [data-da-riders]")).toContainText("not on file for a drawn area");
  expect(await badWords(page)).toEqual([]);
  // the link carries the area
  expect(await page.evaluate(() => location.hash)).toMatch(/county=48453.*area=p_|area=p_.*county=48453/);
  // "See these neighborhoods" selects one on the map; the strip brings the area panel back
  await page.locator("#da-panel [data-da-sec=hoods] [data-da-select]").first().click();
  await expect(page.locator("#da-panel")).toHaveCount(0);
  expect(state.bgs.map((b) => b.id)).toContain(await page.evaluate(() => (0, eval)("selected")));
  expect(await page.evaluate(() => location.hash)).toContain("area=p_");
  await page.click("[data-da-strip=show]");
  await expect(page.locator("#da-panel[data-da-status=ok]")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the circle tool: a chosen radius around a clicked point, with the station at its centre counted exactly", async ({ page }) => {
  const errors = await openTravis(page);
  const stn = await page.evaluate(() => { const f = (0, eval)("activeBundle()").layers.stations.features.find((x: any) => x.properties.n === "Downtown"); return f.geometry.coordinates as [number, number]; });
  await page.evaluate((c) => { (window as any).map.setView([c[1], c[0]], 14, { animate: false }); }, stn);
  await page.waitForTimeout(400);
  await page.click("#btn-draw-area");
  await page.click('[data-da-radius="0.25"]');
  await page.click("[data-da-start=circle]");
  await expect(page.locator("#da-strip")).toContainText("quarter mile circle");
  const [pt] = await screenOf(page, [stn]);
  await page.mouse.click(pt[0], pt[1]);
  expect(await panelDone(page)).toBe("ok");
  const a = await page.evaluate(() => { const s = (window as any).DrawArea.spec(), c = (window as any).DrawArea.current(); return { spec: s, acres: c.shape.acres.value, stations: c.points.stations.items.map((x: any) => x.name), bgs: c.blockGroups.length }; });
  expect(a.spec.type).toBe("circle");
  expect(a.spec.radiusMiles).toBe(0.25);
  expect(Math.hypot(a.spec.center[0] - stn[0], a.spec.center[1] - stn[1])).toBeLessThan(0.001);
  // a quarter-mile circle is pi/16 square miles = 125.66 acres; the 72-sided shape drawn is a little inside it
  expect(a.acres).toBeGreaterThan(125.3); expect(a.acres).toBeLessThan(125.67);
  expect(a.stations).toContain("Downtown");
  await expect(page.locator("#da-panel h2")).toHaveText("Quarter mile around a point");
  await expect(page.locator('#da-panel [data-da-fig="stations"]')).toContainText("Exact");
  expect(await page.evaluate(() => location.hash)).toMatch(/area=c_30\.\d+_-97\.\d+_0\.25/);
  // choosing another radius redraws the same circle bigger
  await page.click("#btn-draw-area");
  await page.click('[data-da-radius="0.5"]');
  await page.waitForFunction(() => (window as any).DrawArea.current()?.shape?.radiusMiles === 0.5, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).DrawArea.current().blockGroups.length)).toBeGreaterThan(a.bgs);
  await expect(page.locator("#da-panel h2")).toHaveText("Half mile around a point");
  expect(await badWords(page)).toEqual([]);
  // the advisor gets a compact, capped summary once asked; Clear removes everything
  expect(await page.evaluate(() => (window as any).serializeLiveAdvisorContext().drawn_area)).toBeNull();
  await page.click("#da-panel [data-da-act=ask]");
  const adv = await page.evaluate(() => { const d = (window as any).serializeLiveAdvisorContext().drawn_area; return { schema: d.schema, n: JSON.stringify(d).length, basis: d.figures.people.basis, hv: d.figures.medianHomeValue.basis }; });
  expect(adv.schema).toBe("city-pretty/drawn-area@1");
  expect(adv.n).toBeLessThanOrEqual(6000);
  expect(adv.basis).toBe("apportioned"); expect(adv.hv).toBe("range");
  await page.evaluate(() => { (0, eval)("closeAiAdvisor()"); });
  await page.click("#da-panel [data-da-act=clear]");
  await expect(page.locator("#da-panel")).toHaveCount(0);
  expect(await page.evaluate(() => location.hash)).not.toContain("area=");
  expect(await page.evaluate(() => (window as any).serializeLiveAdvisorContext().drawn_area)).toBeNull();
  expect(errors).toEqual([]);
});

test("a link with an area reproduces it, in the right county, with the same figures", async ({ page }) => {
  const errors = await openTravis(page);
  const { box } = await threeAndBox(page);
  expect(await drawBox(page, box, "double-click")).toBe("ok");   // double-click also finishes a shape
  const first = await page.evaluate(() => { const a = (window as any).DrawArea.current(); return { url: location.href, pop: a.figures.pop.value, homes: a.figures.homes.value, n: a.blockGroups.length, ring: a.shape.ring.length }; });
  expect(first.ring).toBe(4);
  expect(first.url).toContain("county=48453");
  const p2 = await page.context().newPage();
  await p2.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  await p2.goto(first.url);
  await p2.waitForSelector("#da-panel[data-da-status=ok]", { timeout: 120_000 });
  const again = await p2.evaluate(() => { const a = (window as any).DrawArea.current(); return { fips: (0, eval)("activeFips()"), pop: a.figures.pop.value, homes: a.figures.homes.value, n: a.blockGroups.length, hash: location.hash, onMap: document.querySelectorAll(".da-handle").length }; });
  expect(again.fips).toBe(TRAVIS);
  expect(again.n).toBe(first.n);
  // the page keeps corners to the five decimals the link carries, so the figures are the same
  expect(Math.abs(again.pop - first.pop)).toBeLessThan(1e-6);
  expect(Math.abs(again.homes - first.homes)).toBeLessThan(1e-6);
  expect(again.hash).toContain("area=p_");
  expect(again.onMap).toBe(4);   // the shape is back on the map with its four corner handles
  expect(await badWords(p2)).toEqual([]);
  expect(errors).toEqual([]);
});

test("limits and cancelling: a shape too small for block-group figures says so; Escape cancels a drawing", async ({ page }) => {
  const errors = await openTravis(page);
  const { all } = await threeAndBox(page);
  // a 60 m box in the middle of the largest block group of the county
  const big = all.map((f: any) => ({ f, a: ringArea((f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates[0])[0]) })).sort((x: any, y: any) => y.a - x.a)[0].f;
  const centre = await page.evaluate((id) => { const A = (window as any).AreaAggregationEngine, f = (0, eval)("byId").get(id); return A.ringCentroid((f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates[0])[0]); }, big.id);
  const d = 0.0003;
  await page.evaluate((spec) => (window as any).DrawArea.setArea(spec, { fit: true }), { type: "polygon", ring: [[centre[0] - d, centre[1] - d], [centre[0] + d, centre[1] - d], [centre[0] + d, centre[1] + d], [centre[0] - d, centre[1] + d]] });
  expect(await panelDone(page)).toBe("too_coarse");
  await expect(page.locator("#da-panel .da-banner")).toContainText(/covers at most \d+% of any block group it touches \(under 25%\)/);
  await expect(page.locator('#da-panel [data-da-fig="pop"]')).toHaveCount(0);
  await expect(page.locator('#da-panel [data-da-fig="stations"]')).toHaveCount(1);   // exact point data is still shown
  await page.locator("#da-panel [data-da-sec=limits] > summary").click();
  await expect(page.locator("#da-panel [data-da-sec=limits]")).toContainText("stops at 150 block groups");
  expect(await badWords(page)).toEqual([]);
  // Escape while drawing: nothing new is drawn and the area that was there stays
  await page.click("#btn-draw-area");
  await page.click("[data-da-start=polygon]");
  const box = (await page.locator("#map").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#da-strip")).toContainText("1 corner");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.querySelector("#map")!.classList.contains("da-drawing"))).toBe(false);
  expect(await page.evaluate(() => (window as any).DrawArea.spec().ring.length)).toBe(4);
  expect(errors).toEqual([]);
});

test.describe("phone width, by touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("taps add corners, Finish closes the shape, and the panel has no null, NaN or undefined text", async ({ page }) => {
    const errors = await openTravis(page);
    const { three, box } = await threeAndBox(page);
    await page.evaluate((b) => { (window as any).map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { animate: false, padding: [60, 150] }); }, box);
    await page.waitForTimeout(400);
    await page.locator("#btn-draw-area").click();
    await page.locator("[data-da-start=polygon]").click();
    const scr = await screenOf(page, [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]);
    for (const [x, y] of scr) { await page.touchscreen.tap(x, y); await page.waitForTimeout(120); }
    await expect(page.locator("#da-strip")).toContainText("4 corners");
    await page.locator("[data-da-strip=finish]").click();
    expect(await panelDone(page)).toBe("ok");
    const bgs = await page.evaluate(() => (window as any).DrawArea.current().blockGroups as { id: string; share: number }[]);
    for (const f of three) expect(bgs.find((b) => b.id === f.id)?.share).toBe(1);
    expect(await badWords(page)).toEqual([]);
    // nothing in the panel is wider than the screen
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
    expect(errors).toEqual([]);
  });
});
