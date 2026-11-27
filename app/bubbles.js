// Effect-area bubbles: rings around a placed project, sized and shaded ONLY from a cited study in
// app/data/impact_distance_effects.json. No radius, decay or effect size is typed here. No record => nothing is drawn.
import { makeQuantity } from "../src/platform/schema/quantity.js";
import { selectRecord, ringSummary, distanceToGeometryM, minDistanceBetweenM } from "../src/platform/pilot/distanceEffects.js";

const EVIDENCE_URL = new URL("app/data/impact_distance_effects.json", document.baseURI).href;
// Method constants for the sample grid (not evidence): about this many grid cells per band width, capped for speed.
const CELLS_PER_BAND_WIDTH = 3;
const MAX_SAMPLES_PER_BG = 20000;
const MAX_LIST = 12;
const MINUS = "−";

/** @type {Promise<{ records: any[], loaded: boolean }>|null} */
let evidence = null;
function loadEvidence() {
  if (!evidence) {
    evidence = fetch(EVIDENCE_URL).then((r) => (r.ok ? r.json() : null)).then((j) => (j && Array.isArray(j.records) ? { records: j.records, loaded: true } : { records: [], loaded: false })).catch(() => ({ records: [], loaded: false }));
  }
  return evidence;
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = (n) => Math.round(n).toLocaleString("en-US");
const signed = (n, f) => (n < 0 ? MINUS : "") + f(Math.abs(n));
const fmtUsd = (n) => signed(n, (a) => "$" + fmtN(a));
const fmtPct = (n) => signed(n, (a) => String(a)) + "%";
const safeUrl = (u) => (/^https?:\/\//i.test(String(u)) ? String(u) : null);

let state = { layers: null, panel: null, token: 0, last: null };

function css(name, fallback) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch (e) { return fallback; }
}

function clear() {
  state.token++;
  if (state.layers) { try { state.layers.remove(); } catch (e) {} state.layers = null; }
  if (state.panel) { state.panel.remove(); state.panel = null; }
  state.last = null;
}

// ---- geometry for drawing
const R = 6371008.8, RAD = Math.PI / 180;
/** Circle as a polygon ring of [lat, lon], always the same winding. */
function circleRing(lon, lat, r, steps = 48) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    out.push([lat + ((r * Math.cos(a)) / R) / RAD, lon + ((r * Math.sin(a)) / (R * Math.cos(lat * RAD))) / RAD]);
  }
  return out;
}
function densify(coords, stepM) {
  const pts = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const d = distanceToGeometryM(a, { type: "Point", coordinates: b });
    const n = Math.max(1, Math.ceil(d / stepM));
    for (let k = 1; k <= n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return pts;
}
function lineLengthM(coords) {
  let t = 0;
  for (let i = 1; i < coords.length; i++) t += distanceToGeometryM(coords[i - 1], { type: "Point", coordinates: coords[i] });
  return t;
}

function bboxOfPolygon(g) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of polys) for (const [x, y] of p[0]) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return [a, b, c, d];
}

// ---- block-group inputs from the county bundle. Properties: id; h = homes; hv = typical (median) home value.
// Meaning proven in app/explore.js:383 (`const homes = m.homes || p.h, hv = m.hv || p.hv`) and app/app.js METRICS.value
// (`label: "Typical home value", f: p => p.hv`).
function blockGroupInputs(features, outerBox) {
  const today = new Date().toISOString().slice(0, 10);
  const src = (what) => ({ title: `County bundle loaded by this page: block-group property ${what}`, url: String(location.href).split("#")[0], retrieved: today });
  const q = (v, unit, what, id) => (typeof v === "number" && Number.isFinite(v)
    ? makeQuantity({ value: v, low: v, high: v, unit, status: "estimated", source: src(what), jurisdiction: "county bundle", effectiveDate: today, inputs: [`block group ${id} ${what}`], method: `as loaded from the county bundle (${what})` })
    : null);
  const out = [];
  for (const f of features || []) {
    const p = f && f.properties, g = f && f.geometry;
    if (!p || !g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) continue;
    const bb = bboxOfPolygon(g);
    if (bb[2] < outerBox[0] || bb[0] > outerBox[2] || bb[3] < outerBox[1] || bb[1] > outerBox[3]) continue;
    out.push({ id: String(p.id), homes: q(p.h, "homes", "h (homes)", p.id), medianHomeValue: q(p.hv, "USD", "hv (typical home value)", p.id), polygon: g, bbox: bb });
  }
  return out;
}

function reachBox(site, outerM) {
  const cs = site.type === "Point" ? [site.coordinates] : site.coordinates;
  const lons = cs.map((c) => c[0]), lats = cs.map((c) => c[1]);
  const dLat = outerM / R / RAD, dLon = outerM / (R * Math.cos(Math.max(...lats.map(Math.abs)) * RAD)) / RAD;
  return [Math.min(...lons) - dLon, Math.min(...lats) - dLat, Math.max(...lons) + dLon, Math.max(...lats) + dLat];
}

function samplesFor(bbox, minWidthM) {
  const midLat = (bbox[1] + bbox[3]) / 2;
  const w = (bbox[2] - bbox[0]) * RAD * R * Math.cos(midLat * RAD), h = (bbox[3] - bbox[1]) * RAD * R;
  const cell = Math.max(minWidthM / CELLS_PER_BAND_WIDTH, 1);
  return Math.max(16, Math.min(MAX_SAMPLES_PER_BG, Math.ceil((w * h) / (cell * cell))));
}

// ---- panel text
function bandLabel(b) {
  const metres = (n) => fmtN(n) + " m";
  const stated = `${b.statedInner}–${b.statedOuter} ${b.statedUnit}`;
  const m = b.statedUnit === "m" ? "" : ` (${metres(b.innerM)}–${metres(b.outerM)})`;
  return b.kind === "within" ? `within ${b.statedOuter} ${b.statedUnit}${b.statedUnit === "m" ? "" : ` (${metres(b.outerM)})`}` : stated + m;
}
function effectText(e) {
  if (e.value === null) return esc("No percentage given by the study (see its quote)");
  const range = e.low !== null || e.high !== null ? `<br><span class="muted">range ${e.low !== null ? fmtPct(e.low) : "not stated"} to ${e.high !== null ? fmtPct(e.high) : "not stated"}</span>` : `<br><span class="muted">no range stated</span>`;
  return esc(fmtPct(e.value)) + range;
}
function qText(q, fmt) {
  if (!q || q.value === null) return `<span class="muted" title="${esc(q ? q.method : "")}">not available</span>`;
  const rng = q.low !== q.value || q.high !== q.value ? `<br><span class="muted">${fmt(q.low)} to ${fmt(q.high)}</span>` : "";
  return fmt(q.value) + rng;
}
function listHtml(items, none) {
  if (!items.length) return `<div class="muted">${esc(none)}</div>`;
  const shown = items.slice(0, MAX_LIST).map((t) => `<li>${t}</li>`).join("");
  return `<ul style="margin:2px 0 6px;padding-left:18px">${shown}</ul>${items.length > MAX_LIST ? `<div class="muted">and ${items.length - MAX_LIST} more</div>` : ""}`;
}

function projectsInside(projects, kinds, site, outerM) {
  if (!projects) return null;
  const rows = Array.isArray(projects) ? projects : projects.rows;
  const K = kinds || (projects && projects.kinds) || [];
  if (!Array.isArray(rows)) return null;
  const out = [];
  for (const r of rows) {
    const lat = r[6], lon = r[7];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (distanceToGeometryM([lon, lat], site) > outerM) continue;
    const kind = K[r[0]] || "housing project";
    out.push(`<b>${esc(kind)}</b>${r[1] ? " · " + esc(r[1]) : ""}${r[2] ? " · " + esc(r[2]) : ""}${r[3] ? " · status: " + esc(r[3]) : ""}${r[5] ? " · " + esc(r[5]) : ""}`);
  }
  return out;
}
function alongside(others, site, outerM) {
  const out = [];
  for (const o of others || []) {
    const inside = (o.sites || []).filter((s) => s && s.geometry && (s.geometry.type === "Point" || s.geometry.type === "LineString") && minDistanceBetweenM(site, s.geometry) <= outerM);
    if (inside.length) out.push(`<b>${esc(o.name || o.key)}</b> <span class="muted">(${inside.length} located site${inside.length === 1 ? "" : "s"}${inside[0].label ? ": " + esc(inside[0].label) : ""})</span>`);
  }
  return out;
}

function noRecordText(sel) {
  let h = `<p style="margin:6px 0"><b>No cited study gives a distance for this improvement yet, so no effect area is drawn.</b></p>`;
  if (sel.reason === "requires_investigation") h += `<p class="small" style="margin:4px 0">Reason on file: ${esc((sel.detail || []).filter(Boolean).join(" ") || "not stated")}</p>`;
  else if (sel.reason === "ambiguous") h += `<p class="small" style="margin:4px 0">More than one cited study applies and their figures are not averaged: ${(sel.candidates || []).map((c) => esc(c.study && c.study.citation)).join("; ")}</p>`;
  else if (sel.detail && sel.detail.length) h += `<p class="small" style="margin:4px 0">Evidence on file is incomplete: ${esc(sel.detail.join("; "))}</p>`;
  return h;
}

function makePanel(map) {
  const host = (map.getContainer && map.getContainer().parentElement) || document.body;
  const el = document.createElement("div");
  el.className = "legend cp-bubbles-panel";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Effect area");
  el.style.cssText = "left:auto;right:12px;top:64px;bottom:auto;width:min(420px,calc(100% - 24px));max-width:none;max-height:calc(100% - 140px);overflow:auto;z-index:600";
  host.appendChild(el);
  return el;
}

async function show(opts) {
  clear();
  const token = state.token;
  const { map, site, context } = opts || {};
  if (!map || !site || !site.geometry) return null;
  const ctx = context || {};
  const { records, loaded } = await loadEvidence();
  if (token !== state.token) return null;

  const sel = loaded ? selectRecord(records, site.key) : { record: null, reason: "no_cited_distance_effect", detail: ["No distance-effect evidence file is loaded."] };
  const panel = makePanel(map);
  state.panel = panel;
  const head = (body) => `<button type="button" class="cp-b-close" aria-label="Close effect area" style="float:right;border:0;background:none;font-size:16px;cursor:pointer;color:var(--ink-2)">×</button><h4>Effect area: ${esc(site.name || site.key)}${site.label ? ` <span class="muted" style="font-weight:400">${esc(site.label)}</span>` : ""}</h4>${body}`;
  const wire = () => { const b = panel.querySelector(".cp-b-close"); if (b) b.addEventListener("click", clear); };

  if (!sel.record) {
    panel.innerHTML = head(noRecordText(sel));
    wire();
    state.last = { selection: sel, summary: null };
    return { record: null, reason: sel.reason, detail: sel.detail || null };
  }

  const record = sel.record;
  const geom = site.geometry;
  // reach: the largest outer band in metres, via a throwaway summary-free computation done by ringSummary below
  const probe = ringSummary({ record, site: geom, blockGroups: [], samplesPerBlockGroup: 1 });
  const outerM = probe.outerM;
  const box = reachBox(geom, outerM);
  const widths = probe.bands.map((b) => b.outerM - b.innerM).filter((w) => w > 0);
  const bgs = blockGroupInputs(ctx.blockGroups, box);
  const samples = samplesFor(box, Math.min(...widths));
  const summary = ringSummary({ record, site: geom, blockGroups: bgs.map(({ bbox, ...rest }) => rest), samplesPerBlockGroup: samples, siteKey: site.key });

  // ---- draw
  const L = window.L;
  const group = L.layerGroup().addTo(map);
  state.layers = group;
  const positive = css("--cat-1", "#2a78d6"), negative = css("--cat-2", "#eb6834"), neutral = css("--ink-3", "#7d8a86");
  const maxAbs = Math.max(0, ...summary.bands.map((b) => (b.effectPct.value === null ? 0 : Math.abs(b.effectPct.value))));
  const style = (b) => {
    const v = b.effectPct.value;
    const color = v === null || v === 0 ? neutral : v < 0 ? negative : positive;
    const rel = v === null || maxAbs === 0 ? 0 : Math.abs(v) / maxAbs;
    return { color, weight: 1.5, dashArray: v === null ? "5 4" : null, fillColor: color, fillOpacity: v === null ? 0 : 0.15 + 0.4 * rel, fillRule: "nonzero", interactive: false, bubblingMouseEvents: false };
  };
  const isLine = geom.type === "LineString";
  const ringLayers = [];
  [...summary.bands].sort((a, b) => b.outerM - a.outerM).forEach((b) => {
    let layer;
    if (!isLine) {
      const [lon, lat] = geom.coordinates;
      if (b.innerM > 0) layer = L.polygon([circleRing(lon, lat, b.outerM, 72), circleRing(lon, lat, b.innerM, 72).reverse()], { ...style(b), fillRule: "evenodd" });
      else layer = L.circle([lat, lon], { ...style(b), radius: b.outerM });
    } else {
      const step = Math.max(b.outerM / 2, lineLengthM(geom.coordinates) / 150);
      layer = L.polygon(densify(geom.coordinates, step).map(([lon, lat]) => circleRing(lon, lat, b.outerM, 36)), style(b));
    }
    layer.cpRing = true;
    layer.addTo(group);
    ringLayers.push(layer);
  });
  const c0 = isLine ? geom.coordinates[Math.floor(geom.coordinates.length / 2)] : geom.coordinates;
  if (isLine) L.polyline(geom.coordinates.map(([x, y]) => [y, x]), { color: css("--site", "#d9661f"), weight: 4, interactive: false }).addTo(group);
  else L.circleMarker([c0[1], c0[0]], { radius: 5, color: "#fff", weight: 1.5, fillColor: css("--site", "#d9661f"), fillOpacity: 1, interactive: false }).addTo(group);
  try { map.fitBounds(L.featureGroup(ringLayers).getBounds(), { animate: false, paddingTopLeft: [24, 70], paddingBottomRight: [Math.min(panel.offsetWidth || 0, map.getSize().x * 0.6) + 24, 24] }); } catch (e) {}

  // ---- panel
  const s = summary.study, doi = s.doi ? `, DOI ${esc(s.doi)}` : "";
  const url = safeUrl(s.url);
  const nested = summary.bands.some((b) => b.kind === "within");
  const dirText = { positive: "raises", negative: "lowers", mixed: "has mixed effects on", none_found: "was found to have no clear effect on" }[summary.direction];
  const rows = summary.bands.map((b) => `<tr><td>${esc(bandLabel(b))}</td><td>${effectText(b.effectPct)}</td><td>${qText(b.homesEstimated, fmtN)}</td><td>${qText(b.valueEffect, fmtUsd)}</td></tr>`).join("");
  const quoteIdx = [...new Set(summary.bands.map((b) => b.quoteIndex))];
  const quotes = quoteIdx.map((i) => `<blockquote style="margin:4px 0;padding-left:8px;border-left:3px solid var(--rule-strong)">“${esc(summary.quotes[i])}”<div class="muted">supports: ${summary.bands.filter((b) => b.quoteIndex === i).map((b) => esc(bandLabel(b))).join("; ")}</div></blockquote>`).join("");
  const noPct = summary.bands.some((b) => b.effectPct.value === null);
  const swatch = (c, op, dash) => `<i style="display:inline-block;width:14px;height:10px;margin-right:6px;border:1.5px ${dash ? "dashed" : "solid"} ${c};background:${c};opacity:${dash ? 1 : Math.max(op, 0.25)};${dash ? "background:none" : ""}"></i>`;
  const legend = summary.bands.map((b) => { const st = style(b); return `<div>${swatch(st.color, st.fillOpacity, b.effectPct.value === null)}${esc(bandLabel(b))}: ${b.effectPct.value === null ? "no percentage given" : esc(fmtPct(b.effectPct.value))}</div>`; }).join("");
  const proj = projectsInside(ctx.projects, ctx.projectKinds, geom, outerM);
  const along = alongside(ctx.otherRecommendations, geom, outerM);

  panel.innerHTML = head(`
    <p class="small" style="margin:4px 0">${esc(summary.improvementKey)} ${esc(dirText)} nearby home values in ${esc(record.studyArea)}, according to:</p>
    <p style="margin:4px 0"><b>${esc(s.citation)}</b>${doi} ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">link</a>` : ""} <span class="chip">${esc(s.type)}</span></p>
    <p class="small" style="margin:4px 0"><b>How far this carries over:</b> ${esc(record.transferability)}</p>
    ${record.notRepresented.length ? `<div class="small"><b>Not represented:</b>${listHtml(record.notRepresented.map(esc), "")}</div>` : ""}
    ${quotes}
    <table class="small" style="border-collapse:collapse;width:100%;margin:6px 0;font-size:11px;font-variant-numeric:tabular-nums"><thead><tr><th align="left">Distance from site</th><th align="left">Effect on home values</th><th align="left">Homes (estimated)</th><th align="left">Change in home values (est.)</th></tr></thead><tbody>${rows}</tbody></table>
    ${nested ? `<p class="small" style="margin:4px 0">Bands marked “within” are alternative measurements of the same homes, not to be added together.</p>` : ""}
    ${noPct ? `<p class="small" style="margin:4px 0">Where the study gives no percentage, the band is drawn dashed and no value change is computed.</p>` : ""}
    <div class="small" style="margin:6px 0"><b>Legend</b>${legend}<div class="muted">Darker shading = stronger effect in this study${summary.direction === "negative" || summary.bands.some((b) => b.effectPct.value < 0) ? "; orange and a minus sign mean lower values" : ""}.${isLine ? " Approximate outline of the buffer around the line; shading adds up toward the line." : ""} Distances are straight-line from the site.</div></div>
    <details open><summary class="small"><b>Caveats</b></summary><ul class="small" style="margin:2px 0 6px;padding-left:18px">${summary.caveats.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></details>
    <div class="small"><b>Projects already in this area</b>${proj === null ? `<div class="muted">project data not loaded for this county</div>` : listHtml(proj, "none in the data")}</div>
    <div class="small"><b>Could be added alongside</b>${listHtml(along, "no other recommended improvement has a located site in this area")}<div class="muted">This is a list only. Combined effects are not added together because no cited interaction exists.</div></div>
  `);
  wire();
  state.last = { selection: sel, summary, projects: proj, alongside: along };
  return summary;
}

window.CPBubbles = { show, clear, get last() { return state.last; }, ringLayers() { return state.layers ? state.layers.getLayers().filter((l) => l.cpRing) : []; } };
