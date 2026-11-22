// Live check of the draw-an-area tool on the real page (NOT part of CI; the unit and e2e suites cover the rules).
//
// For each county, at desktop and phone width, this drives the page the way a visitor would (mouse clicks, or taps on
// the phone profile) and checks what the panel shows against a computation made here, independently of the page's
// clipping code: a grid count of points inside both the block group and the drawn shape gives each block group's
// share, and people / homes are those shares times the block groups' own figures.
//   polygon over three block groups -> people, homes and land acres in the panel match the grid computation
//   circle around a point           -> same check; a station placed at the centre is counted exactly
//   drag a corner, Escape, undo     -> the shape and the panel follow
//   link                            -> opening the copied link in a new page reproduces the same figures
//   text                            -> no "null", "NaN" or "undefined" anywhere in the panel; no console errors
//   advisor                         -> "Ask the advisor about this area" puts drawn_area on the context, under the cap
// Screenshots go to LIVE_SHOTS (default: a folder under the system temp dir), never into the repo.
//
// Usage: node scripts/live_check_draw_area.mjs [fips ...]     Env: LIVE_PORT (default 8898), LIVE_SHOTS
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8898);
const SHOTS = process.env.LIVE_SHOTS || path.join(os.tmpdir(), "city-pretty-draw-area");
fs.mkdirSync(SHOTS, { recursive: true });
const DEFAULT = ["06037", "48453", "47095"];   // Los Angeles; Travis TX; Lake County TN (the smallest county data file)
// where to draw in each county: a block group to build the three-block-group polygon around, and a station name for the circle
const PLAN = { "06037": { bg: "060372145042", station: "Wilshire/La Brea", radius: 0.5 }, "48453": { bg: "484530011022", station: "Downtown", radius: 0.5, pick: "Montopolis" }, "47095": { bg: null, station: null, radius: 1 } };
const VIEWS = [
  { name: "desktop", ctx: { viewport: { width: 1400, height: 900 } }, touch: false },
  { name: "phone", ctx: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, touch: true },
];

const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const inGeom = (pt, g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).some(([o, ...hs]) => inRing(pt, o) && !hs.some(hh => inRing(pt, hh)));
// Independent of the page: the share of a block group inside the ring, by counting grid cell centres.
function gridShare(geom, ring, n = 420) {
  const cs = (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates).flatMap(p => p[0]);
  const x0 = Math.min(...cs.map(p => p[0])), x1 = Math.max(...cs.map(p => p[0])), y0 = Math.min(...cs.map(p => p[1])), y1 = Math.max(...cs.map(p => p[1]));
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const pt = [x0 + (i + 0.5) / n * (x1 - x0), y0 + (j + 0.5) / n * (y1 - y0)]; if (inGeom(pt, geom)) { a++; if (inRing(pt, ring)) b++; } }
  return a ? b / a : 0;
}
const numIn = t => { const m = String(t).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };

async function openCounty(page, fips) {
  await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
  await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
  if (fips !== "06037") {
    await page.evaluate(f => { window.openCounty(f); }, fips);
    await page.waitForFunction(f => window.D_OC?.meta?.fips === f && window.activeCounty === "oc" && (0, eval)("typeof _countyLoading === 'undefined' || !_countyLoading"), fips, { timeout: 180000 });
  }
  await page.waitForFunction(() => !!window.DrawArea && !!document.querySelector("#btn-draw-area"), null, { timeout: 30000 });
}
// the page's own data for the block groups (their figures as the neighborhood panel would show them) and geometry
const pageData = (page) => page.evaluate(() => {
  const fips = String(activeFips()), B = activeBundle(), la = fips === "06037";
  const feats = (la ? D.bgs.features : B.features).filter(f => String(f.properties.id).startsWith(fips));
  return { fips, feats: feats.map(f => ({ id: f.properties.id, n: f.properties.n, geometry: f.geometry })), def: (B.meta && B.meta.default_bg) || feats[0].properties.id,
    stations: (((la ? D : B).layers.stations || {}).features || []).map(f => ({ n: f.properties.n, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })) };
});
const mOf = (page, ids) => page.evaluate(ids => { const B = String(activeFips()) === "06037" ? D : activeBundle(); return Object.fromEntries(ids.map(id => [id, (({ pop, homes, acres }) => ({ pop, homes, acres }))((B.details[id] || {}).m || {})])); }, ids);
const centroid = g => { const r = (g.type === "Polygon" ? g.coordinates : g.coordinates[0])[0]; return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length]; };

async function toScreen(page, lonlats) {
  const pts = await page.evaluate(ll => ll.map(p => { const c = map.latLngToContainerPoint([p[1], p[0]]); return [c.x, c.y]; }), lonlats);
  const box = await page.locator("#map").boundingBox();
  return pts.map(p => [box.x + p[0], box.y + p[1]]);
}
// Fit the map so that every corner can be clicked: not under the map's own bar, legend, strip or zoom buttons.
async function fitClear(page, bb, corners) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(b => void map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { animate: false, padding: [60, 110] }), bb);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(350);
    const scr = await toScreen(page, corners);
    const clear = await page.evaluate(pts => pts.every(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest("#map") && !el.closest(".leaflet-control"); }), scr);
    if (clear) return scr;
    await page.evaluate(() => void map.setZoom(map.getZoom() - 0.5, { animate: false }));
  }
  return toScreen(page, corners);
}
async function clickAt(page, view, x, y) { if (view.touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
async function panelReady(page) {
  await page.waitForSelector("#da-panel[data-da-status]:not([data-da-status=working])", { timeout: 60000 });
  return page.getAttribute("#da-panel", "data-da-status");
}
async function readPanel(page) {
  return page.evaluate(() => {
    document.querySelectorAll("#da-panel details").forEach(d => { d.open = true; });
    const figs = {};
    document.querySelectorAll("#da-panel [data-da-fig]").forEach(el => { figs[el.dataset.daFig] = { basis: el.dataset.daBasis, raw: el.dataset.daValue, text: (el.querySelector(".da-v") || el).innerText.trim(), sub: (el.querySelector(".da-sub") || {}).innerText || "" }; });
    const bad = []; const w = document.createTreeWalker(document.querySelector("#da-panel"), NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode.textContent || ""; if (/\bnull\b|NaN|undefined/.test(t)) bad.push(t.trim().slice(0, 100)); }
    const a = window.DrawArea.current();
    return { status: document.querySelector("#da-panel").dataset.daStatus, summary: (document.querySelector("#da-summary") || {}).innerText || "", figs, bad, spec: window.DrawArea.spec(), hash: location.hash,
      ring: a && a.shape ? a.shape.ring : null, bgs: a && a.blockGroups ? a.blockGroups : [], ideas: a && a.build ? a.build.ideas.slice(0, 3).map(x => ({ name: x.name, avg: x.valuePerDollar.weightedAverage && x.valuePerDollar.weightedAverage.value, range: x.valuePerDollar.range, in: x.appliesIn })) : [],
      withheld: a && a.build ? a.build.withheld.length : null, sites: a && a.land ? a.land.candidates.length : null, site0: a && a.land && a.land.candidates[0] ? { kind: a.land.candidates[0].kind, zoning: a.land.candidates[0].zoning, law: a.land.candidates[0].stateLaw.status, station: a.land.candidates[0].station.answer, ver: a.land.candidates[0].verification } : null,
      transit: a && a.transit ? { verdict: a.transit.verdict, scale: a.transit.scale, net: a.transit.density.homesPerNetAcre.value } : null,
      stations: a && a.points ? a.points.stations.items.map(s => s.name) : [], stops: a && a.points ? a.points.stops.value : null };
  });
}
// the independent computation: grid shares x each block group's own figure
async function independent(page, data, ring) {
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]), bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const near = data.feats.filter(f => { const cs = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap(p => p[0]); return Math.min(...cs.map(p => p[0])) <= bb[2] && Math.max(...cs.map(p => p[0])) >= bb[0] && Math.min(...cs.map(p => p[1])) <= bb[3] && Math.max(...cs.map(p => p[1])) >= bb[1]; });
  const shares = near.map(f => ({ id: f.id, share: gridShare(f.geometry, ring) })).filter(s => s.share > 0);
  const m = await mOf(page, shares.map(s => s.id));
  const sum = k => shares.reduce((t, s) => t + (typeof m[s.id][k] === "number" ? s.share * m[s.id][k] : 0), 0);
  return { shares, pop: sum("pop"), homes: sum("homes"), acres: sum("acres") };
}
function compare(label, panel, ind, out) {
  const tol = v => Math.max(1.5, Math.abs(v) * 0.01);   // the grid count is good to well under 1%; the panel rounds to whole numbers
  for (const [k, v] of [["pop", ind.pop], ["homes", ind.homes], ["landAcres", ind.acres]]) {
    const f = panel.figs[k]; const shown = f ? numIn(f.text) : null, raw = f && f.raw !== "" ? +f.raw : null;
    const ok = f && shown != null && raw != null && Math.abs(raw - v) <= tol(v) && Math.abs(shown - raw) <= (k === "landAcres" ? 0.6 : 0.5);
    out.checks.push({ check: `${label}: ${k} equals the independent grid computation`, ok: !!ok, panel: f ? f.text : null, panel_raw: raw, independent: Math.round(v * 100) / 100, basis: f ? f.basis : null });
  }
  // every block group the page lists has a share close to the grid's, and none is missing
  const byId = new Map(ind.shares.map(s => [s.id, s.share]));
  const worst = Math.max(0, ...panel.bgs.map(b => Math.abs(b.share - (byId.get(b.id) || 0))));
  const missed = ind.shares.filter(s => s.share > 0.02 && !panel.bgs.some(b => b.id === s.id)).map(s => s.id);
  out.checks.push({ check: `${label}: block-group shares match the grid count`, ok: worst < 0.01 && !missed.length, worst_share_difference: Math.round(worst * 1e4) / 1e4, block_groups: panel.bgs.length, missed });
  out.checks.push({ check: `${label}: no null / NaN / undefined text`, ok: panel.bad.length === 0, found: panel.bad.slice(0, 5) });
}

async function runCounty(browser, fips, view) {
  const out = { fips, view: view.name, checks: [], notes: {} };
  const ctx = await browser.newContext(view.ctx);
  await ctx.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message).slice(0, 200)));
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${fips}-${view.name}-${name}.png`) });
  try {
    await openCounty(page, fips);
    const data = await pageData(page), plan = PLAN[fips] || { bg: null, station: null, radius: 0.5 };
    const seed = data.feats.find(f => f.id === (plan.bg || data.def)) || data.feats[0];
    const c0 = centroid(seed.geometry);
    const three = data.feats.map(f => ({ f, d: Math.hypot(...centroid(f.geometry).map((v, i) => v - c0[i])) })).sort((a, b) => a.d - b.d).slice(0, 3).map(x => x.f);
    const cs = three.flatMap(f => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap(p => p[0]));
    const bb = [Math.min(...cs.map(p => p[0])), Math.min(...cs.map(p => p[1])), Math.max(...cs.map(p => p[0])), Math.max(...cs.map(p => p[1]))];
    const padX = (bb[2] - bb[0]) * 0.02, padY = (bb[3] - bb[1]) * 0.02;
    // five corners around the three block groups (a house shape, so the polygon is not just a box)
    const corners = [[bb[0] - padX, bb[1] - padY], [bb[2] + padX, bb[1] - padY], [bb[2] + padX, bb[3] + padY], [(bb[0] + bb[2]) / 2, bb[3] + padY * 6], [bb[0] - padX, bb[3] + padY]];
    // ---- polygon: open the control, start, click the corners, close on the first corner (desktop) or Finish (phone)
    await page.evaluate(b => void map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { animate: false, padding: [60, 110] }), bb);
    await page.locator("#btn-draw-area").click();
    await shot("1-control");
    await page.locator("[data-da-start=polygon]").click();
    const before = await page.evaluate(() => (0, eval)("selected"));
    let scr = await fitClear(page, bb, corners);
    for (const [x, y] of scr) { await clickAt(page, view, x, y); await page.waitForTimeout(120); }
    out.checks.push({ check: "polygon: clicks while drawing do not select a neighborhood", ok: before === await page.evaluate(() => (0, eval)("selected")) });
    out.checks.push({ check: "polygon: the strip counts the corners", ok: /5 corners/.test(await page.locator("#da-strip").innerText()) });
    // Undo removes the last corner; adding it again restores it
    await page.locator("[data-da-strip=undo]").click();
    const after4 = /4 corners/.test(await page.locator("#da-strip").innerText());
    await page.evaluate(() => window.scrollTo(0, 0));
    scr = await toScreen(page, corners);
    await page.waitForTimeout(700);   // a second tap on the very same spot right away would be a double-tap, which finishes the shape
    await clickAt(page, view, scr[4][0], scr[4][1] - 22);
    out.checks.push({ check: "polygon: Undo removes a corner", ok: after4 && /5 corners/.test(await page.locator("#da-strip").innerText()) });
    await shot("2-drawing");
    if (view.touch) await page.locator("[data-da-strip=finish]").click(); else { await page.evaluate(() => window.scrollTo(0, 0)); scr = await toScreen(page, corners); await page.mouse.click(scr[0][0], scr[0][1]); }
    const st1 = await panelReady(page);
    await page.waitForTimeout(400);
    await shot("3-polygon");
    let panel = await readPanel(page);
    out.notes.polygon = { status: st1, summary: panel.summary, hash: panel.hash, ideas: panel.ideas, withheld: panel.withheld, sites: panel.sites, site0: panel.site0, transit: panel.transit, figs: Object.fromEntries(Object.entries(panel.figs).map(([k, v]) => [k, `${v.text} [${v.basis}]`])) };
    out.checks.push({ check: "polygon: three block groups are wholly inside", ok: three.every(f => panel.bgs.some(b => b.id === f.id && b.share === 1)), three: three.map(f => f.id) });
    if (st1 === "ok") compare("polygon", panel, await independent(page, data, panel.ring), out);
    else out.checks.push({ check: "polygon: figures shown", ok: false, status: st1 });
    for (const k of ["here", "build", "land", "transit"]) { await page.locator(`[data-da-sec=${k}]`).scrollIntoViewIfNeeded(); await shot("4-" + k); }
    await page.evaluate(() => { document.querySelector("#panel").scrollTop = 0; window.scrollTo(0, 0); });

    // ---- a "See these neighborhoods" entry selects it; the strip brings the area panel back
    await page.locator("[data-da-sec=hoods] [data-da-select]").first().click();
    await page.waitForFunction(() => !document.querySelector("#da-panel"), null, { timeout: 20000 });
    const selNow = await page.evaluate(() => (0, eval)("selected"));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("[data-da-strip=show]").click();
    await page.waitForSelector("#da-panel[data-da-status=ok]", { timeout: 20000 });
    out.checks.push({ check: "neighborhood list selects a block group and the area panel comes back", ok: panel.bgs.some(b => b.id === selNow) && (await page.evaluate(() => location.hash)).includes("area=") });
    await page.evaluate(() => window.scrollTo(0, 0));

    // ---- drag a corner (the top one, pulled a little higher): the shape and the figures follow
    scr = await fitClear(page, bb, corners);
    const acres0 = +panel.figs.landAcres.raw;
    await page.mouse.move(scr[3][0], scr[3][1]); await page.mouse.down(); await page.mouse.move(scr[3][0] + 6, scr[3][1] - 14, { steps: 4 }); await page.mouse.move(scr[3][0] + 10, scr[3][1] - 34, { steps: 6 }); await page.mouse.up();
    await page.waitForFunction(a => { const c = window.DrawArea.current(); return c && c.figures && Math.abs(c.figures.landAcres.value - a) > 1e-6; }, acres0, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    panel = await readPanel(page);
    out.checks.push({ check: "dragging a corner changes the shape and the figures", ok: Math.abs(+panel.figs.landAcres.raw - acres0) > 1e-6 && panel.spec.ring.length === 5, acres_before: acres0, acres_after: +panel.figs.landAcres.raw });
    if (panel.status === "ok") compare("after dragging", panel, await independent(page, data, panel.ring), out);

    // ---- the link reproduces the area in a fresh page
    const url = await page.evaluate(() => location.href);
    const p2 = await ctx.newPage();
    await p2.goto(url);
    await p2.waitForSelector("#da-panel[data-da-status]:not([data-da-status=working])", { timeout: 180000 });
    await p2.waitForTimeout(1500);
    const again = await readPanel(p2);
    out.checks.push({ check: "the link reproduces the area", ok: again.status === panel.status && again.figs.pop && again.figs.pop.raw === panel.figs.pop.raw && again.figs.homes.raw === panel.figs.homes.raw && JSON.stringify(again.spec) === JSON.stringify(panel.spec), url: url.replace(/^.*#/, "#") });
    await p2.screenshot({ path: path.join(SHOTS, `${fips}-${view.name}-5-from-link.png`) });
    await p2.close();

    // ---- Escape cancels a drawing in progress and the old area comes back
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#btn-draw-area").click();
    await page.locator("[data-da-start=polygon]").click();
    await clickAt(page, view, scr[0][0] + 40, scr[0][1] - 40);
    await page.keyboard.press("Escape");
    out.checks.push({ check: "Escape cancels and keeps the area that was there", ok: await page.evaluate(() => !document.querySelector("#map").classList.contains("da-drawing") && !!window.DrawArea.spec()) });

    // ---- circle: around a named station where there is one, else the default block group's centre
    const stn = plan.station ? data.stations.find(s => s.n === plan.station) : null;
    const centre = stn ? [stn.lon, stn.lat] : c0;
    await page.evaluate(c => void map.setView([c[1], c[0]], 14, { animate: false }), centre);
    await page.waitForTimeout(600);
    await page.locator("#btn-draw-area").click();
    await page.locator(`[data-da-radius="${plan.radius}"]`).click();
    await page.locator("[data-da-start=circle]").click();
    const [cp] = await toScreen(page, [centre]);
    await clickAt(page, view, cp[0], cp[1]);
    await page.waitForFunction(() => { const s = window.DrawArea.spec(), c = window.DrawArea.current(); return s && s.type === "circle" && c && c.shape && c.shape.type === "circle"; }, null, { timeout: 60000 });
    const st2 = await panelReady(page);
    await page.waitForTimeout(500);
    await shot("6-circle");
    panel = await readPanel(page);
    out.notes.circle = { status: st2, summary: panel.summary, hash: panel.hash, stations: panel.stations, stops: panel.stops, sites: panel.sites, site0: panel.site0, transit: panel.transit, ideas: panel.ideas, figs: Object.fromEntries(Object.entries(panel.figs).map(([k, v]) => [k, `${v.text} [${v.basis}]`])) };
    out.checks.push({ check: "circle: placed where clicked with the chosen radius", ok: panel.spec.type === "circle" && panel.spec.radiusMiles === plan.radius && Math.hypot(panel.spec.center[0] - centre[0], panel.spec.center[1] - centre[1]) < 0.0015, spec: panel.spec });
    if (stn) out.checks.push({ check: "circle: the station it was centred on is counted", ok: panel.stations.includes(stn.n), stations: panel.stations });
    if (st2 === "ok") compare("circle", panel, await independent(page, data, panel.ring), out);
    else out.checks.push({ check: "circle: a too-small or too-large shape says so and shows no block-group figure", ok: /too coarse|stops at/.test(panel.summary) && !panel.figs.pop, status: st2 });
    for (const k of ["land", "transit"]) { const l = page.locator(`[data-da-sec=${k}]`); if (await l.count()) { await l.scrollIntoViewIfNeeded(); await shot("7-circle-" + k); } }

    // ---- a planned stop on file as the circle's centre: the station-area sites inside are listed with their records
    if (plan.pick) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator("#btn-draw-area").click();
      await page.waitForFunction(t => [...document.querySelectorAll("#da-centre option")].some(o => o.textContent.includes(t)), plan.pick, { timeout: 30000 });
      const val = await page.evaluate(t => [...document.querySelectorAll("#da-centre option")].find(o => o.textContent.includes(t)).value, plan.pick);
      const before = panel.hash;
      await page.selectOption("#da-centre", val);
      await page.waitForFunction(b => location.hash !== b && document.querySelector("#da-panel[data-da-status]:not([data-da-status=working])") && window.DrawArea.current() && window.DrawArea.current().shape.encoded === new URLSearchParams(location.hash.slice(1)).get("area"), before, { timeout: 60000 });
      await page.waitForTimeout(500);
      await shot("9-planned-stop");
      panel = await readPanel(page);
      const land = await page.evaluate(() => { const a = window.DrawArea.current(); return { n: a.land.candidates.length, first: a.land.candidates.slice(0, 3).map(c => ({ kind: c.kind, name: c.name, acres: c.acres.value, origin: c.origin, zoning: c.zoning.code, law: c.stateLaw.status, station: c.station.answer, ver: c.verification, facts: (c.facts || []).length })), cards: a.cards ? { area: a.cards.area ? a.cards.area.courses.map(c => c.label) : null, notAssessed: a.cards.area ? a.cards.area.notAssessed.length : null, sites: Object.keys(a.cards.sites).length } : null, text: document.querySelector("[data-da-sec=land]").innerText.slice(0, 1500) }; });
      out.notes.plannedStop = { summary: panel.summary, land, transit: panel.transit, figs: Object.fromEntries(Object.entries(panel.figs).map(([k, v]) => [k, `${v.text} [${v.basis}]`])) };
      out.checks.push({ check: "planned stop as centre: station-area sites inside are listed, each with a record or 'not on file'", ok: land.n > 0 && land.first.every(c => c.origin === "station" ? c.facts > 0 : true) && panel.bad.length === 0, sites: land.n });
      out.checks.push({ check: "planned stop as centre: the area gets a courses-of-action card", ok: !!(land.cards && land.cards.area), courses: land.cards && land.cards.area });
      const l = page.locator("[data-da-sec=land]"); await l.scrollIntoViewIfNeeded(); await shot("9-planned-stop-land");
    }

    // ---- ask the advisor: the context carries the area, under the cap
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("[data-da-act=ask]").click();
    const adv = await page.evaluate(() => { const c = serializeLiveAdvisorContext(); return { open: !document.getElementById("ai-advisor-modal").hidden, len: c.drawn_area ? JSON.stringify(c.drawn_area).length : 0, schema: c.drawn_area && c.drawn_area.schema, status: c.drawn_area && c.drawn_area.status }; });
    out.checks.push({ check: "Ask the advisor puts the area on the context, under 6,000 characters", ok: adv.open && adv.schema === "city-pretty/drawn-area@1" && adv.len > 200 && adv.len <= 6000, chars: adv.len });
    await shot("8-advisor");
    await page.evaluate(() => void closeAiAdvisor());

    // ---- clear: the shape, the hash entry and the advisor field go
    await page.locator("[data-da-act=clear]").click();
    const cleared = await page.evaluate(() => ({ spec: window.DrawArea.spec(), hash: location.hash, panel: !!document.querySelector("#da-panel"), adv: serializeLiveAdvisorContext().drawn_area }));
    out.checks.push({ check: "Clear removes the shape, the link entry and the advisor field", ok: !cleared.spec && !/area=/.test(cleared.hash) && !cleared.panel && cleared.adv == null });
    out.checks.push({ check: "no page errors", ok: errors.length === 0, errors: errors.slice(0, 5) });
  } catch (e) {
    out.checks.push({ check: "run completed", ok: false, error: String(e && e.message || e).slice(0, 400) });
    await shot("error").catch(() => {});
  }
  await ctx.close();
  return out;
}

const fipsList = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
const server = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch();
const results = [];
try {
  for (const fips of fipsList) for (const view of VIEWS) {
    const r = await runCounty(browser, fips, view);
    results.push(r);
    const bad = r.checks.filter(c => !c.ok);
    console.log(`${fips} ${view.name}: ${r.checks.length - bad.length}/${r.checks.length} checks passed`);
    for (const c of bad) console.log("  FAIL", JSON.stringify(c));
  }
} finally { await browser.close(); server.kill(); }
const date = new Date().toISOString().slice(0, 10);
const file = path.join(root, `data/backtests/live_check_draw_area_${date}.json`);
fs.mkdirSync(path.dirname(file), { recursive: true });
const total = results.reduce((s, r) => s + r.checks.length, 0), passed = results.reduce((s, r) => s + r.checks.filter(c => c.ok).length, 0);
fs.writeFileSync(file, JSON.stringify({ checked: date, tool: "scripts/live_check_draw_area.mjs", method: "the page's panel against a grid count made in this script (420 x 420 cell centres per block group), people / homes / land acres = share x the block group's own figure; tolerance 1% or 1.5", passed, total, screenshots: "not kept in the repository", results }, null, 1));
console.log(`${passed}/${total} checks passed; wrote ${path.relative(root, file)}; screenshots in ${SHOTS}`);
process.exit(passed === total ? 0 : 1);
