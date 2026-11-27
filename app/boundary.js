// Draw your own area. Click corners on the map, finish, and the page runs the SAME investment decision engine
// (window.InvestmentDecisionEngine.recommendForNeighborhood, with the same ctx as the Invest view) once per block group
// the area touches, then groups the engine's answers (src/platform/boundary/area.js). No scoring happens here: every
// figure shown is a number the engine returned, or a sum of such numbers, or "not on file".
// Reads page globals from the classic scripts (D, D_OC, COUNTY_BUNDLES, SITES, loadSites, decodeLine, cpJson, activeFips, map).
import { aggregateRecommendations, openRing, polygonAreaSqM, selectBlockGroups, sitesInPolygon } from "../src/platform/boundary/index.js";

const G = /** @type {any} */ (window);
const g = name => { try { return (0, eval)(`typeof ${name} === "undefined" ? undefined : ${name}`); } catch (e) { return undefined; } };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = v => "$" + Math.round(v).toLocaleString("en-US");
const perDollar = v => "$" + v.toFixed(2);
const MAX_SITES = 20;
const BASIS_NOTE = "sum of engine figures for block groups whose centre is inside the area";

const st = { drawing: false, pts: [], layer: null, markers: null, panel: null, ctl: null, last: null, tail: null, busy: 0 };

// ---------------------------------------------------------------- data the page already holds
function countyData() {
  const D = g("D"), fips = String(typeof g("activeFips") === "function" ? g("activeFips")() : "06037");
  if (fips === "06037") {
    if (!D || !D.bgs || !D.details) return { fips, features: [], details: null };
    return { fips, features: D.bgs.features || [], details: id => D.details[id] };
  }
  const CB = g("COUNTY_BUNDLES"), OC = g("D_OC");
  const B = (CB && CB[fips]) || (OC && OC.meta && OC.meta.fips === fips ? OC : null);
  if (!B || !B.details || !Object.keys(B.details).length) return { fips, features: [], details: null };
  return { fips, features: B.features || [], details: id => B.details[id] };
}
async function engineInputs() {
  const iv = G.cpInvest && G.cpInvest.state && G.cpInvest.state.data;
  const cj = g("cpJson");
  const j = id => (typeof cj === "function" ? cj(id) : Promise.resolve(null)).catch(() => null);
  const verification = iv ? iv.verification : await j("intervention-verification");
  const sites = iv ? iv.sites : await j("underused-sites");
  if (typeof g("loadSites") === "function") { try { await g("loadSites")(); } catch (e) { /* the page falls back to an empty table */ } }
  const ok = verification && typeof verification === "object" && !Array.isArray(verification);
  return { verification: ok ? verification : null, underusedSites: Array.isArray(sites) ? sites : [] };
}
const sitesTable = () => { const S = g("SITES"); return (S && S.sites) || {}; };
function projectsContext() {
  const D = g("D"), ab = g("activeBundle");
  const B = (typeof ab === "function" ? ab() : null) || D;
  const L_ = (B && B.layers) || (D && D.layers) || {};
  const rows = Array.isArray(L_.projects) ? L_.projects : (D && D.layers && Array.isArray(D.layers.projects) ? D.layers.projects : null);
  const kinds = L_.pj_kinds || (D && D.layers && D.layers.pj_kinds) || null;
  return { rows, kinds };
}

// ---------------------------------------------------------------- site records -> geometry
function decodeLonLat(str) { const dl = g("decodeLine"); return typeof dl === "function" ? dl(str).map(p => [p[1], p[0]]) : []; }
function siteLabel(s) {
  const j = a => (Array.isArray(a) ? a.filter(Boolean).join(" & ") : "");
  if (s.t === "xing") return j(s.at) || null;
  if (s.t === "calm") return s.street ? s.street + (s.from && s.to ? ` (${s.from} to ${s.to})` : "") : null;
  if (s.t === "lot_park") return s.ad || s.nmlot || (s.next && s.next[0] ? "next to " + s.next[0] : null) || s.st || null;
  if (s.t === "ev") return s.dest ? s.dest + (s.st ? ` (${s.st})` : "") : (s.st || null);
  if (s.t === "creek") return s.nm || null;
  return s.nm || s.street || s.dest || null;
}
function siteGeometry(rec) {
  if (Array.isArray(rec.pt) && rec.pt.length >= 2) return { pt: [rec.pt[0], rec.pt[1]], lines: null, geometry: { type: "Point", coordinates: [rec.pt[0], rec.pt[1]] } };
  const lines = (rec.g || []).map(decodeLonLat).filter(l => l.length > 1);
  if (!lines.length) return { pt: null, lines: null, geometry: null };
  return { pt: null, lines, geometry: { type: "LineString", coordinates: lines.flat() } };
}

// ---------------------------------------------------------------- analysis
function toRing(latlngs) {
  const ring = (latlngs || []).map(p => Array.isArray(p) ? [p[1], p[0]] : [p.lng, p.lat]).filter(p => isFinite(p[0]) && isFinite(p[1]));
  return openRing(ring.filter((p, i) => i === 0 || p[0] !== ring[i - 1][0] || p[1] !== ring[i - 1][1]));
}
async function analyse(ring) {
  const engine = G.InvestmentDecisionEngine;
  if (!engine || typeof engine.recommendForNeighborhood !== "function") return { message: "The decision engine did not load, so no recommendation can be made for this area." };
  const cd = countyData();
  if (!cd.details || !cd.features.length) return { message: "This county has no block-group details on the page yet, so no recommendation can be made for a drawn area." };
  const inputs = await engineInputs();
  const catalog = g("D") && g("D").catalog;
  const sel = selectBlockGroups(ring, cd.features).filter(s => s.inside !== "outside");
  const props = new Map(cd.features.map(f => [f.properties.id, f.properties]));
  const feature = new Map(cd.features.map(f => [f.properties.id, f]));
  const S = sitesTable();
  const perBlockGroup = [];
  for (const s of sel) {
    let rec = null;
    const d0 = cd.details(s.id), p = props.get(s.id) || {};
    if (d0 && d0.m) {
      const m = (d0.m.n || !p.n) ? d0.m : Object.assign({}, d0.m, { n: p.n, c: d0.m.c || p.c || null });
      try { rec = engine.recommendForNeighborhood({ id: s.id, m, r: d0.r }, { catalog, verification: inputs.verification, countyFips: cd.fips, underusedSites: inputs.underusedSites, sites: S[s.id] || [] }); } catch (e) { rec = null; }
    }
    perBlockGroup.push({ id: s.id, name: (rec && rec.name) || p.n || null, inside: s.inside, shareInside: s.shareInside, rec });
  }
  const agg = aggregateRecommendations(perBlockGroup);
  // located sites of the selected block groups, inside the drawn polygon
  const all = [];
  for (const s of sel) for (const rec of S[s.id] || []) { const gm = siteGeometry(rec); if (gm.geometry) all.push({ rec, blockGroupId: s.id, pt: gm.pt, lines: gm.lines, geometry: gm.geometry }); }
  const inArea = sitesInPolygon(all, ring);
  const sites = {};
  for (const hit of inArea) {
    const r = hit.site, key = r.rec.p;
    (sites[key] = sites[key] || []).push({ key, geometry: r.geometry, blockGroupId: r.blockGroupId, label: siteLabel(r.rec), type: r.rec.t, insideVertices: hit.insideVertices, totalVertices: hit.totalVertices });
  }
  const names = new Map(agg.improvements.map(i => [i.key, i.name]));
  for (const k of Object.keys(sites)) for (const x of sites[k]) x.name = names.get(k) || (catalog && catalog[k] && catalog[k].name) || k;
  return { ring, areaSqM: polygonAreaSqM(ring), selection: sel, perBlockGroup, aggregate: agg, sites, features: sel.map(s => feature.get(s.id)).filter(Boolean), fips: cd.fips, projects: projectsContext() };
}

// ---------------------------------------------------------------- drawing
function layerGroup() { if (!st.layer) st.layer = G.L.layerGroup().addTo(G.map); return st.layer; }
function redraw() {
  const grp = layerGroup(); grp.clearLayers();
  const ll = st.pts.map(p => [p.lat, p.lng]);
  if (ll.length > 1) G.L.polyline(ll, { color: "#d9480f", weight: 3, dashArray: "6 6", interactive: false }).addTo(grp);
  ll.forEach(p => G.L.circleMarker(p, { radius: 5, color: "#fff", weight: 2, fillColor: "#d9480f", fillOpacity: 1, interactive: false }).addTo(grp));
  syncControl();
}
function onClick(e) {
  e.stopPropagation(); e.preventDefault();
  const ll = G.map.mouseEventToLatLng(e);
  st.pts.push(ll); redraw();
}
function onDbl(e) { e.stopPropagation(); e.preventDefault(); finish(); }
function onKey(e) { if (e.key === "Escape" && st.drawing) cancel(); }
function listen(on) {
  const c = G.map.getContainer(), f = on ? "addEventListener" : "removeEventListener";
  c[f]("click", onClick, true); c[f]("dblclick", onDbl, true);
  if (on) { G.map.doubleClickZoom.disable(); c.style.cursor = "crosshair"; } else { G.map.doubleClickZoom.enable(); c.style.cursor = ""; }
}
function start() {
  if (!G.map || !G.L) return;
  clear();
  st.drawing = true; st.pts = []; listen(true); syncControl();
}
function cancel() { st.drawing = false; st.pts = []; listen(false); if (st.layer) st.layer.clearLayers(); syncControl(); }
function clear() {
  if (st.drawing) { st.drawing = false; listen(false); }
  st.pts = []; st.last = null; st.tail = null;
  if (st.layer) st.layer.clearLayers();
  if (st.markers) st.markers.clearLayers();
  if (st.panel) st.panel.hidden = true;
  if (G.CPBubbles && typeof G.CPBubbles.clear === "function") G.CPBubbles.clear();
  syncControl();
}
/** Close the shape (from the map clicks, or given latlngs: [{lat,lng}] or [[lat,lng]]) and run the analysis. */
function finish(latlngs) {
  const ll = latlngs || st.pts;
  const ring = toRing(ll);
  if (ring.length < 3) { showMessage("Add at least 3 corners to draw an area."); return Promise.resolve(null); }
  if (st.drawing) { st.drawing = false; listen(false); }
  const grp = layerGroup(); grp.clearLayers();
  G.L.polygon(ring.map(p => [p[1], p[0]]), { color: "#d9480f", weight: 3, fillColor: "#d9480f", fillOpacity: .08, interactive: false }).addTo(grp);
  st.pts = []; syncControl();
  const tok = ++st.busy;
  st.tail = analyse(ring).then(res => {
    if (tok !== st.busy) return null;
    st.last = res; render(res); return res;
  }).catch(e => { const r = { message: "The area could not be analysed: " + (e && e.message || e) }; if (tok === st.busy) { st.last = r; render(r); } return r; });
  return st.tail;
}

// ---------------------------------------------------------------- UI
function syncControl() {
  if (!st.ctl) return;
  const [draw, fin, clr] = st.ctl.querySelectorAll("button");
  draw.hidden = st.drawing; fin.hidden = !st.drawing; fin.disabled = st.pts.length < 3;
  clr.hidden = !st.drawing && !st.last && !(st.layer && st.layer.getLayers().length);
  draw.textContent = "Draw an area";
}
function addControl() {
  const Ctl = G.L.Control.extend({ options: { position: "topleft" }, onAdd() {
    const d = G.L.DomUtil.create("div", "leaflet-bar leaflet-control cp-boundary-ctl");
    d.style.cssText = "display:flex;background:var(--ground,#fff);border:1px solid var(--rule-strong,#ccc);border-radius:6px;overflow:hidden";
    d.innerHTML = `<button type="button" class="preset-btn" title="Click corners on the map to outline any area">Draw an area</button><button type="button" class="preset-btn" hidden title="Close the shape (or double-click)">Finish</button><button type="button" class="preset-btn" hidden title="Remove the drawn area">Clear</button>`;
    G.L.DomEvent.disableClickPropagation(d);
    const [a, b, c] = d.querySelectorAll("button");
    a.addEventListener("click", start); b.addEventListener("click", () => finish()); c.addEventListener("click", clear);
    st.ctl = d; return d;
  } });
  new Ctl().addTo(G.map);
  syncControl();
}
function panel() {
  if (st.panel) return st.panel;
  const p = document.createElement("section");
  p.id = "cp-boundary-panel"; p.setAttribute("aria-label", "Your area"); p.hidden = true;
  p.style.cssText = "position:absolute;left:10px;bottom:10px;z-index:900;width:min(340px,calc(100% - 20px));max-height:62%;overflow:auto;background:var(--sheet,#fff);color:var(--ink,#111);border:1px solid var(--rule-strong,#bbb);border-radius:8px;padding:12px 14px;font:13px/1.45 var(--body,system-ui);box-shadow:0 6px 24px rgba(0,0,0,.25)";
  (document.querySelector(".mapwrap") || document.body).appendChild(p);
  ["click", "dblclick", "mousedown", "wheel", "touchstart"].forEach(ev => p.addEventListener(ev, e => e.stopPropagation()));
  st.panel = p; return p;
}
function showMessage(msg) { const p = panel(); p.hidden = false; p.innerHTML = head() + `<p id="cp-boundary-msg">${esc(msg)}</p>`; wireClose(p); }
function head() { return `<div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="margin:0;font:700 17px/1.2 var(--display,inherit)">Your area</h3><button type="button" class="preset-btn" data-act="close" style="border:1px solid var(--rule-strong,#ccc);border-radius:4px">Close</button></div>`; }
function wireClose(p) { const b = p.querySelector('[data-act="close"]'); if (b) b.addEventListener("click", clear); }

const evLabel = e => [e.tier, e.verification, e.grade ? "grade " + e.grade : null].filter(Boolean).join(" · ") || "no evidence label from the engine";
function totalHtml(label, t) {
  if (t.value == null) return `<div><b>${label}:</b> not on file in any block group here</div>`;
  return `<div><b>${label}:</b> ${money(t.value)}${t.partial ? ` <span title="At least one block group is only partly inside the area; its figure is for the whole block group.">(partial: includes block groups only partly inside)</span>` : ""} <span style="color:var(--ink-3,#666)">${esc(t.unit || "")}; ${BASIS_NOTE}; ${t.contributing} block group${t.contributing === 1 ? "" : "s"}</span></div>`;
}
function render(res) {
  const p = panel(); p.hidden = false; p.style.maxHeight = "62%";
  if (res.message) { p.innerHTML = head() + `<p id="cp-boundary-msg">${esc(res.message)}</p>`; wireClose(p); return; }
  const n = res.selection.length, partly = res.selection.filter(s => s.shareInside < 1).length;
  const km2 = res.areaSqM / 1e6, acres = res.areaSqM / 4046.8564224;
  const imps = res.aggregate.improvements, shown = imps.filter(i => i.blockGroups > 0), held = imps.filter(i => i.blockGroups === 0);
  const nameOf = new Map(res.perBlockGroup.map(b => [b.id, b.name]));
  let h = head();
  h += `<p style="margin:6px 0"><b>Size:</b> ${km2 >= 0.1 ? km2.toFixed(2) + " sq km" : Math.round(res.areaSqM).toLocaleString("en-US") + " sq m"} (${acres.toLocaleString("en-US", { maximumFractionDigits: 0 })} acres; flat-map estimate).<br><b>${n}</b> block group${n === 1 ? "" : "s"} touch this area${partly ? `, <b>${partly}</b> only partly inside` : ""}. Figures are block-group estimates, not parcel-level.</p>`;
  if (res.aggregate.withoutRecommendation.length) h += `<p style="margin:6px 0">${res.aggregate.withoutRecommendation.length} block group${res.aggregate.withoutRecommendation.length === 1 ? " has" : "s have"} no engine recommendation and ${res.aggregate.withoutRecommendation.length === 1 ? "is" : "are"} left out of the totals.</p>`;
  if (!shown.length) h += `<p>The engine returned no improvement with figures for this area.</p>`;
  h += `<ol id="cp-boundary-list" style="margin:8px 0 0;padding-left:20px">`;
  const hasBubbles = !!(G.CPBubbles && typeof G.CPBubbles.show === "function");
  shown.forEach(i => {
    const sl = res.sites[i.key] || [];
    h += `<li class="cp-b-imp" data-key="${esc(i.key)}" style="margin-bottom:10px"><b>${esc(i.name)}</b> <span style="color:var(--ink-3,#666)">in ${i.blockGroups} block group${i.blockGroups === 1 ? "" : "s"}; ranked first in ${i.topIn}; pays in ${i.paysIn}</span>`;
    h += `<div>Evidence: ${i.evidence.map(e => `${esc(evLabel(e))} (${e.blockGroups})`).join("; ")}</div>`;
    h += totalHtml("Cost", i.cost) + totalHtml("Value added to nearby homes", i.valueAdded);
    if (i.noFigureIn.cost || i.noFigureIn.valueAdded) h += `<div style="color:var(--ink-3,#666)">Not on file: cost in ${i.noFigureIn.cost} block group${i.noFigureIn.cost === 1 ? "" : "s"}, value in ${i.noFigureIn.valueAdded}.</div>`;
    if (i.withheldIn.count) h += `<div style="color:var(--ink-3,#666)">Withheld in ${i.withheldIn.count} other block group${i.withheldIn.count === 1 ? "" : "s"}: ${i.withheldIn.reasons.map(r => esc(r.reason)).join("; ")}</div>`;
    h += `<details><summary>Per block group (engine figures)</summary><ul style="margin:4px 0;padding-left:18px">${res.perBlockGroup.filter(b => b.rec && b.rec.ideas && b.rec.ideas.some(x => x.id === i.key)).map(b => { const x = b.rec.ideas.find(y => y.id === i.key); return `<li>${esc(b.name || b.id)}: cost ${x.cost.value != null ? money(x.cost.value) : "not on file"}${x.valuePerDollar.value != null ? `, ${perDollar(x.valuePerDollar.value)} of home value per $1` : ""}${b.shareInside < 1 ? " (partly inside)" : ""}</li>`; }).join("")}</ul></details>`;
    if (!sl.length) h += `<div class="cp-b-where">Where: No located sites for this improvement in the data.</div>`;
    else {
      h += `<div class="cp-b-where"><b>Where:</b> ${sl.length} located site${sl.length === 1 ? "" : "s"} in your area</div><ul style="margin:2px 0;padding-left:18px">`;
      sl.slice(0, MAX_SITES).forEach((s, k) => { h += siteLi(s, i.key, k, hasBubbles); });
      if (sl.length > MAX_SITES) h += `<li>and ${sl.length - MAX_SITES} more on the map</li>`;
      h += `</ul>`;
    }
    h += `</li>`;
  });
  h += `</ol>`;
  const otherKeys = Object.keys(res.sites).filter(k => !shown.some(i => i.key === k));
  if (otherKeys.length) {
    h += `<div id="cp-boundary-other"><p style="margin:10px 0 2px"><b>Other located sites in your area</b></p><p style="margin:0 0 4px;color:var(--ink-3,#666)">These are locations in the data, not recommendations from the ranking.</p>`;
    otherKeys.forEach(k => { const sl = res.sites[k]; h += `<div class="cp-b-other" data-key="${esc(k)}"><b>${esc(sl[0].name)}</b>: ${sl.length} located site${sl.length === 1 ? "" : "s"}<ul style="margin:2px 0;padding-left:18px">${sl.slice(0, MAX_SITES).map((x, n) => siteLi(x, k, n, hasBubbles)).join("")}${sl.length > MAX_SITES ? `<li>and ${sl.length - MAX_SITES} more</li>` : ""}</ul></div>`; });
    h += `</div>`;
  }
  if (held.length) h += `<p style="margin:8px 0 2px"><b>Withheld by the engine (no figures shown):</b></p><ul style="margin:0;padding-left:18px">${held.map(i => `<li>${esc(i.name)}: ${i.withheldIn.reasons.map(r => esc(r.reason)).join("; ")}</li>`).join("")}</ul>`;
  p.innerHTML = h; wireClose(p);
  p.querySelectorAll('[data-act="effect"]').forEach(b => b.addEventListener("click", async () => {
    const label = b.textContent; b.disabled = true; b.textContent = "Working…";
    try { await effect(b.dataset.key, +b.dataset.i); } catch (e) { /* the effect panel reports its own state */ } finally { b.disabled = false; b.textContent = label; }
  }));
  drawMarkers(res);
}
function siteLi(s, key, k, hasBubbles) {
  return `<li>${esc(s.label || "(no street or intersection label on this record)")} <button type="button" class="preset-btn" data-act="effect" data-key="${esc(key)}" data-i="${k}" style="border:1px solid var(--rule-strong,#ccc);border-radius:4px"${hasBubbles ? "" : " hidden"}>Show effect area</button></li>`;
}
function drawMarkers(res) {
  if (!st.markers) st.markers = G.L.layerGroup().addTo(G.map);
  st.markers.clearLayers();
  const listed = new Set(res.aggregate.improvements.filter(i => i.blockGroups > 0).map(i => i.key));
  for (const k of Object.keys(res.sites)) for (const s of res.sites[k]) {
    const tip = `${s.name}${s.label ? ": " + s.label : ""}`;
    if (s.geometry.type === "Point") G.L.circleMarker([s.geometry.coordinates[1], s.geometry.coordinates[0]], { radius: 6, color: "#fff", weight: 2, fillColor: "#0b7285", fillOpacity: 1 }).bindTooltip(tip).addTo(st.markers);
    else G.L.polyline(s.geometry.coordinates.map(c => [c[1], c[0]]), { color: "#0b7285", weight: 5, opacity: .85 }).bindTooltip(tip).addTo(st.markers);
  }
}
async function effect(key, i) {
  const res = st.last; if (!res || !G.CPBubbles || typeof G.CPBubbles.show !== "function") return;
  const s = (res.sites[key] || [])[i]; if (!s) return;
  const strip = x => ({ key: x.key, name: x.name, geometry: x.geometry, blockGroupId: x.blockGroupId, label: x.label });
  const inArea = res.projects.rows ? res.projects.rows.filter(r => { const lat = r[6], lon = r[7]; return typeof lat === "number" && typeof lon === "number" && sitesInPolygon([{ pt: [lon, lat] }], res.ring).length; }) : null;
  const pn = panel(); pn.style.maxHeight = "34%";   // leave the rings and the effect panel visible
  return G.CPBubbles.show({
    map: G.map, site: strip(s),
    context: {
      blockGroups: res.features, projects: inArea, projectKinds: res.projects.kinds,
      otherRecommendations: res.aggregate.improvements.filter(x => x.blockGroups > 0 && x.key !== key).map(x => ({ key: x.key, name: x.name, sites: (res.sites[x.key] || []).map(strip) })),
    },
  });
}

// ---------------------------------------------------------------- start up
G.CPBoundary = { start, finish, clear, get lastResult() { return st.last; }, get ready() { return st.tail; } };
document.addEventListener("keydown", onKey);
(function boot(tries) {
  if (G.map && G.L && G.map.getContainer && g("D")) { addControl(); return; }
  if (tries > 600) return;
  setTimeout(() => boot(tries + 1), 200);
})(0);
