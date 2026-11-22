/**
 * Area Aggregation Engine (browser global and CommonJS module; one copy, loaded by index.html and the unit tests)
 *
 * Answers "what is inside this drawn shape?" from per-block-group data, without pretending to know more than the
 * data does. Pure functions: no network, no file reads, no DOM. Everything is passed in.
 *
 * Rules (docs/DRAW-AREA.md):
 *  - a block group counts by the share of its mapped shape that lies inside the drawn shape (polygon clipping, below);
 *  - counts are apportioned by that share ("estimated from N block groups by area"); when every block group is wholly
 *    inside, the sum is exact and is tagged "measured";
 *  - medians are never averaged into "the median of the area": the figure is the range across the block groups
 *    touched, plus a homes-weighted average of medians labelled exactly as that;
 *  - a rate or share is recomputed from apportioned numerator and denominator when both are on file, else a range;
 *  - a value a block group does not have stays missing, and the figure says how many block groups had none;
 *  - points (sites, stations, stops) are in or out by their own coordinates: exact, never apportioned.
 * Every figure is { value, unit, basis: "measured" | "apportioned" | "range" | "modelled", from: [...], source }.
 *
 * Loading: index.html loads this file after src/engines/investmentDecisionEngine.js; app/draw-area.js calls
 * window.AreaAggregationEngine. In Node: require() it (the tests import it as an ES module).
 */
(function () {
"use strict";

const AREA_ENGINE_VERSION = "1.0.0";
const FEET_M = 0.3048;                       // exact by definition (international foot)
const MILE_M = 5280 * FEET_M;                // 1,609.344 m
const ACRE_M2 = 43560 * FEET_M * FEET_M;     // 43,560 sq ft
const EARTH_R_M = 3958.8 * MILE_M;           // the Earth radius app/app.js uses for distances (haversineDistMi)
const DEG = Math.PI / 180;

// The page's own working limits (choices made for this tool, not sourced thresholds; docs/DRAW-AREA.md says so).
const LIMITS = {
  minLargestShare: 0.25,     // below this share of every block group touched, block-group figures are too coarse to show
  maxBlockGroups: 150,       // above this many block groups the area is too large for this tool
  maxCorners: 60,
  circleSides: 72,
  circleRadiiMiles: [0.25, 0.5, 1],
  minShare: 0.005,           // a block group is "touched" when at least this share of it, or of the shape, overlaps; smaller
                             // overlaps are boundary noise (neighbouring outlines are simplified separately and overlap slightly)
  wholeShare: 1 - 1e-6,      // shares at or above this are treated as the whole block group
  walkMeters: 0.5 * MILE_M,  // half a mile, straight line: the station-area radius the page already uses
};

const num = x => (typeof x === "number" && isFinite(x)) ? x : null;
const round = (x, d) => x == null ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d);

// ---------------------------------------------------------------- geometry (planar, metres, local projection)
function openRing(r) {
  const n = r.length;
  return (n > 1 && r[0][0] === r[n - 1][0] && r[0][1] === r[n - 1][1]) ? r.slice(0, n - 1) : r.slice();
}
// Equirectangular projection about (lon0, lat0): [lon, lat] degrees -> [x, y] metres. Over a few miles its area error
// is far below the error of the even-spread assumption, and shares are ratios of areas in the same projection.
function projector(lon0, lat0) {
  const k = Math.cos(lat0 * DEG), d = DEG * EARTH_R_M;
  return p => [(p[0] - lon0) * d * k, (p[1] - lat0) * d];
}
function signedArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return a / 2;
}
const ensureCCW = pts => signedArea(pts) < 0 ? pts.slice().reverse() : pts;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function isConvex(pts) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const c = cross(pts[i], pts[(i + 1) % pts.length], pts[(i + 2) % pts.length]);
    if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); }
  }
  return true;
}
function segmentsCross(a, b, c, d) {   // proper crossing (shared end points and touching do not count)
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function isSimple(pts) {
  const n = pts.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
    if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return false;
  }
  return true;
}
// Sutherland-Hodgman: clip any polygon (may be concave) against a CONVEX counter-clockwise polygon. A concave subject
// can come back with zero-width bridges between its pieces; they cancel in the shoelace area, which is all we use.
function clipConvex(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], inp = out; out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length];
      const cp = cross(a, b, p), cq = cross(a, b, q);
      if (cp >= 0) out.push(p);
      if ((cp > 0 && cq < 0) || (cp < 0 && cq > 0)) { const t = cp / (cp - cq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
  }
  return out;
}
function inTriangle(p, a, b, c) { return cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0; }
// Ear clipping: a simple polygon -> convex parts (itself when already convex, else triangles), all counter-clockwise.
function convexParts(poly) {
  const pts = ensureCCW(poly);
  if (pts.length < 3) return [];
  if (isConvex(pts)) return [pts];
  const idx = pts.map((_, i) => i), tris = [];
  let guard = pts.length * pts.length + 10;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic], cr = cross(a, b, c);
      if (cr < 0) continue;                                    // reflex corner
      if (cr === 0) { idx.splice(i, 1); cut = true; break; }   // straight corner: drop it, no area
      let ear = true;
      for (const k of idx) { if (k === ia || k === ib || k === ic) continue; if (inTriangle(pts[k], a, b, c)) { ear = false; break; } }
      if (!ear) continue;
      tris.push([a, b, c]); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3 && cross(pts[idx[0]], pts[idx[1]], pts[idx[2]]) > 0) tris.push([pts[idx[0]], pts[idx[1]], pts[idx[2]]]);
  return tris;
}
function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return [x0, y0, x1, y1];
}
const bboxHit = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
// Area of (ring ∩ clip), where clip is given as convex parts with their bounding boxes.
function ringClipArea(ring, parts) {
  const bb = bboxOf(ring);
  let a = 0;
  for (const part of parts) { if (!bboxHit(bb, part.bbox)) continue; a += Math.abs(signedArea(clipConvex(ring, part.pts))); }
  return a;
}
/** Area of the overlap of two simple polygons given as arrays of [x, y] (any orientation, either may be concave). */
function intersectionArea(subject, clip) {
  const parts = convexParts(openRing(clip)).map(pts => ({ pts, bbox: bboxOf(pts) }));
  return ringClipArea(openRing(subject), parts);
}
function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function ringCentroid(ring) {   // area centroid of a simple ring ([x, y] or [lon, lat]); the vertex mean when the area is 0
  const r = openRing(ring); let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; }
  if (Math.abs(a) < 1e-18) { const n = r.length || 1; return [r.reduce((s, p) => s + p[0], 0) / n, r.reduce((s, p) => s + p[1], 0) / n]; }
  return [cx / (3 * a), cy / (3 * a)];
}
function distanceMeters(a, b) {   // [lon, lat] pairs; haversine
  const dLat = (b[1] - a[1]) * DEG, dLon = (b[0] - a[0]) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ---------------------------------------------------------------- the drawn shape
/** A circle as the many-sided polygon the page draws and measures (corners on the circle, so slightly inside it). */
function circleRing(center, radiusMeters, sides) {
  const n = sides || LIMITS.circleSides, k = Math.cos(center[1] * DEG), d = DEG * EARTH_R_M, out = [];
  for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; out.push([center[0] + radiusMeters * Math.cos(t) / (d * k), center[1] + radiusMeters * Math.sin(t) / d]); }
  return out;
}
/**
 * normalizeShape(spec) -> { ok, type, ring: [[lon, lat]...] (open), center?, radiusMiles?, acres, sqMiles, error? }
 *   spec: { type: "polygon", ring: [[lon, lat]...] } or { type: "circle", center: [lon, lat], radiusMiles }
 */
function normalizeShape(spec) {
  if (!spec) return { ok: false, error: "no shape" };
  const okPt = p => Array.isArray(p) && num(p[0]) != null && num(p[1]) != null && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
  let ring, extra = {};
  if (spec.type === "circle") {
    if (!okPt(spec.center) || !LIMITS.circleRadiiMiles.includes(spec.radiusMiles)) return { ok: false, error: "a circle needs a centre and a radius of " + LIMITS.circleRadiiMiles.join(", ") + " miles" };
    ring = circleRing(spec.center, spec.radiusMiles * MILE_M);
    extra = { center: [spec.center[0], spec.center[1]], radiusMiles: spec.radiusMiles };
  } else if (spec.type === "polygon") {
    ring = openRing((spec.ring || []).filter(okPt));
    if (ring.length !== openRing(spec.ring || []).length) return { ok: false, error: "a corner is not a valid position" };
    if (ring.length < 3) return { ok: false, error: "a shape needs at least 3 corners" };
    if (ring.length > LIMITS.maxCorners) return { ok: false, error: `a shape can have at most ${LIMITS.maxCorners} corners` };
  } else return { ok: false, error: "unknown shape type" };
  const c = ringCentroid(ring), proj = projector(c[0], c[1]), xy = ring.map(proj);
  if (!isSimple(xy)) return { ok: false, error: "the lines of the shape cross each other; move a corner so they do not" };
  const m2 = Math.abs(signedArea(xy));
  if (!(m2 > 0)) return { ok: false, error: "the shape has no area" };
  return Object.assign({ ok: true, type: spec.type, ring, acres: m2 / ACRE_M2, sqMiles: m2 / (MILE_M * MILE_M) }, extra);
}
// URL form, made only of characters a URL hash keeps as they are: p_lat_lng_lat_lng... or c_lat_lng_radiusMiles
function encodeArea(spec) {
  const f = v => (+v).toFixed(5);
  if (!spec) return "";
  if (spec.type === "circle") return ["c", f(spec.center[1]), f(spec.center[0]), String(spec.radiusMiles)].join("_");
  if (spec.type === "polygon") return ["p"].concat(openRing(spec.ring).map(p => f(p[1]) + "_" + f(p[0]))).join("_");
  return "";
}
function decodeArea(text) {
  const t = String(text || "").split("_");
  const nums = t.slice(1).map(Number);
  if (nums.some(v => !isFinite(v))) return null;
  let spec = null;
  if (t[0] === "c" && nums.length === 3) spec = { type: "circle", center: [nums[1], nums[0]], radiusMiles: nums[2] };
  else if (t[0] === "p" && nums.length >= 6 && nums.length % 2 === 0) { const ring = []; for (let i = 0; i < nums.length; i += 2) ring.push([nums[i + 1], nums[i]]); spec = { type: "polygon", ring }; }
  return spec && normalizeShape(spec).ok ? spec : null;
}

// ---------------------------------------------------------------- 1. block-group shares
function featurePolys(f) {
  const g = f && f.geometry;
  if (!g || !g.coordinates) return [];
  return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
}
/**
 * blockGroupShares(shape, features) -> [{ id, share, areaInsideM2, areaM2 }] sorted by share, largest first.
 *   share = area of (block-group shape ∩ drawn shape) / area of the block-group shape, holes removed. The block-group
 *   shape is the one the map draws; the county build removes mapped water from it where water is 5% or more
 *   (docs/pipeline-README.md, "Land-only block-group shapes"), so the share is a share of land there.
 */
function blockGroupShares(shape, features) {
  const s = shape && shape.ok ? shape : normalizeShape(shape);
  if (!s.ok) return [];
  const c = ringCentroid(s.ring), proj = projector(c[0], c[1]);
  const clipXY = s.ring.map(proj), parts = convexParts(clipXY).map(pts => ({ pts, bbox: bboxOf(pts) }));
  const sb = bboxOf(s.ring), shapeM2 = Math.abs(signedArea(clipXY));
  const out = [];
  for (const f of (features || [])) {
    const id = f && f.properties && f.properties.id;
    if (id == null) continue;
    let areaBg = 0, areaIn = 0, hit = false;
    for (const poly of featurePolys(f)) {
      if (!poly.length) continue;
      const outerLL = openRing(poly[0]);
      if (bboxHit(bboxOf(outerLL), sb)) hit = true;
      else continue;
      const outer = outerLL.map(proj);
      areaBg += Math.abs(signedArea(outer)); areaIn += ringClipArea(outer, parts);
      for (let h = 1; h < poly.length; h++) { const hole = openRing(poly[h]).map(proj); areaBg -= Math.abs(signedArea(hole)); areaIn -= ringClipArea(hole, parts); }
    }
    if (!hit || !(areaIn > 0)) continue;
    // the parts of a multi-part block group that the shape's box does not reach still belong to its area
    for (const poly of featurePolys(f)) {
      if (!poly.length || bboxHit(bboxOf(openRing(poly[0])), sb)) continue;
      areaBg += Math.abs(signedArea(openRing(poly[0]).map(proj)));
      for (let h = 1; h < poly.length; h++) areaBg -= Math.abs(signedArea(openRing(poly[h]).map(proj)));
    }
    if (!(areaBg > 0)) continue;
    let share = Math.min(1, areaIn / areaBg);
    if (share < LIMITS.minShare && areaIn / shapeM2 < LIMITS.minShare) continue;   // a sliver along a shared edge
    if (share >= LIMITS.wholeShare) share = 1;
    out.push({ id: String(id), share, areaInsideM2: areaIn, areaM2: areaBg });
  }
  return out.sort((a, b) => b.share - a.share || (a.id < b.id ? -1 : 1));
}

// ---------------------------------------------------------------- 2. figures
const EVEN_SPREAD = "Area weighting assumes people and homes are spread evenly across each block group, which is false where part of one is a park, a campus, water or an industrial yard.";
function partialInfo(rows) {
  const partial = rows.filter(r => r.share < 1);
  return { n: rows.length, partial: partial.length, largestPartialShare: partial.length ? Math.max(...partial.map(r => r.share)) : null };
}
const fromRows = rows => rows.map(r => ({ id: r.id, share: round(r.share, 4), value: r.v == null ? null : r.v }));
/** A count: sum of share x value. rows: [{ id, share, v }] (v null = the block group has no value). */
function countFigure(o, rows) {
  const have = rows.filter(r => num(r.v) != null), none = rows.length - have.length, pi = partialInfo(have);
  const base = { key: o.key, label: o.label, unit: o.unit, source: o.source || null, kind: "count", from: fromRows(rows), blockGroups: rows.length, noValue: none };
  if (!have.length) return Object.assign(base, { value: null, basis: null, how: "No block group in the area has this value on file." });
  const value = have.reduce((s, r) => s + r.share * r.v, 0);
  const missing = none ? ` ${none} of ${rows.length} block groups have no value on file and add nothing, so the real figure is higher.` : "";
  if (!pi.partial) return Object.assign(base, { value, basis: "measured", tag: `sum of ${have.length} whole block group${have.length > 1 ? "s" : ""}`, how: `Every block group counted lies wholly inside the shape, so this is their sum.${missing}` });
  return Object.assign(base, { value, basis: "apportioned", tag: `estimated from ${have.length} block group${have.length > 1 ? "s" : ""} by area`, largestPartialShare: round(pi.largestPartialShare, 4),
    how: `Each block group's count times the share of its mapped shape inside the drawn shape, added up. ${pi.partial} of ${have.length} block groups are cut by the shape; the largest part of a cut block group that is inside is ${Math.round(pi.largestPartialShare * 100)}%. ${EVEN_SPREAD}${missing}` });
}
/** A median: never averaged into "the median of the area". rows: [{ id, share, v, w }] (w = homes, the weight). */
function medianFigure(o, rows) {
  const have = rows.filter(r => num(r.v) != null && r.v > 0), none = rows.length - have.length;
  const base = { key: o.key, label: o.label, unit: o.unit, source: o.source || null, kind: "median", from: fromRows(rows), blockGroups: rows.length, noValue: none };
  if (!have.length) return Object.assign(base, { value: null, basis: null, how: "No block group in the area has this value on file." });
  const tract = have.filter(r => r.tract).length, top = o.topCode ? have.filter(r => r.v >= o.topCode[0] && r.v <= o.topCode[1]).length : 0;
  const topNote = top ? ` ${top} of these values ${top > 1 ? "are" : "is"} at the Census's top code (published only as "${o.topCodeText}"), so the high end${have.length > 1 ? " and the average are" : " is"} understated.` : "";
  const tractNote = tract ? ` ${tract} of these ${have.length} values ${tract > 1 ? "are" : "is"} the median of the surrounding Census tract, because the block group's own is not published.` : "";
  const missing = none ? ` ${none} of ${rows.length} block groups have no value on file.` : "";
  if (rows.length === 1 && have[0].share === 1) return Object.assign(base, { value: have[0].v, basis: "measured", tag: "this block group's own median", topCoded: top, how: `The shape covers exactly one block group, so this is that block group's median.${tractNote}${topNote}` });
  const lo = Math.min(...have.map(r => r.v)), hi = Math.max(...have.map(r => r.v));
  const wOk = have.every(r => num(r.w) != null && r.w >= 0), wSum = wOk ? have.reduce((s, r) => s + r.share * r.w, 0) : 0;
  const avg = wOk && wSum > 0 ? have.reduce((s, r) => s + r.share * r.w * r.v, 0) / wSum : null;
  return Object.assign(base, {
    value: null, basis: "range", range: [lo, hi], tag: have.length > 1 ? `range across ${have.length} block-group medians` : "the median of the one block group touched",
    weightedAverage: avg == null ? null : { value: avg, label: "homes-weighted average of block-group medians", weight: "homes inside the shape (each block group's homes x its share inside)" },
    weightedAverageMissing: avg == null ? "homes are not on file for every block group with a value" : null,
    how: `A median cannot be added up or averaged into the median of a new area: that needs the household-level records, which are not published. Shown instead: the lowest and highest block-group median among the block groups touched${avg != null ? ", and an average of those medians weighted by the homes each block group has inside the shape" : ""}. Neither is the median of the drawn area.${tractNote}${topNote}${missing}`, topCoded: top });
}
/** A rate or share recomputed from numerator and denominator. rows: [{ id, share, v (the rate), d (its denominator count) }]; per = 100 for a percent, 1000 for "per 1,000". */
function rateFigure(o, rows) {
  const have = rows.filter(r => num(r.v) != null), none = rows.length - have.length;
  const base = { key: o.key, label: o.label, unit: o.unit, source: o.source || null, kind: "rate", from: fromRows(rows), blockGroups: rows.length, noValue: none };
  if (!have.length) return Object.assign(base, { value: null, basis: null, how: "No block group in the area has this value on file." });
  const missing = none ? ` ${none} of ${rows.length} block groups have no value on file and are left out of both the top and the bottom of the fraction.` : "";
  if (rows.length === 1 && have[0].share === 1) return Object.assign(base, { value: have[0].v, basis: "measured", tag: "this block group's own figure", how: "The shape covers exactly one block group, so this is that block group's figure." });
  const dOk = o.denominator && have.every(r => num(r.d) != null && r.d >= 0), dSum = dOk ? have.reduce((s, r) => s + r.share * r.d, 0) : 0;
  if (dOk && dSum > 0) {
    const pi = partialInfo(have), whole = !pi.partial;
    return Object.assign(base, { value: have.reduce((s, r) => s + r.share * r.d * r.v, 0) / dSum, basis: whole ? "measured" : "apportioned",
      tag: whole ? `recomputed from ${have.length} whole block groups` : `recomputed from ${have.length} block groups by area`, largestPartialShare: round(pi.largestPartialShare, 4),
      how: `Recomputed, not averaged: each block group's figure is turned back into a count (figure x its ${o.denominator}), the counts and the ${o.denominator} are ${whole ? "added up" : "apportioned by the share of the block group inside the shape and added up"}, and the two totals are divided.${o.rounded ? " The block-group figures are stored rounded, so the result is approximate." : ""}${whole ? "" : " " + EVEN_SPREAD}${missing}` });
  }
  const lo = Math.min(...have.map(r => r.v)), hi = Math.max(...have.map(r => r.v));
  return Object.assign(base, { value: null, basis: "range", range: [lo, hi], tag: have.length > 1 ? `range across ${have.length} block groups` : "the one block group touched",
    how: `${o.whyRange || "The count this figure is a share of is not on file for every block group, so it cannot be recomputed for the area."} Shown instead: the lowest and highest block-group figure among the block groups touched.${missing}` });
}
/** A level measured at or around each block group (heat, buses at the busiest stop): a range only. */
function rangeFigure(o, rows) {
  return rateFigure(Object.assign({}, o, { denominator: null, whyRange: o.whyRange || "This figure is measured for each block group as a whole and has no count behind it to apportion." }), rows);
}
/** Points are in or out by their own coordinates. items: [{ lon, lat, ... }] */
function pointsInside(shape, items) {
  const s = shape && shape.ok ? shape : normalizeShape(shape);
  if (!s.ok) return [];
  const bb = bboxOf(s.ring);
  return (items || []).filter(p => p && num(p.lon) != null && num(p.lat) != null && p.lon >= bb[0] && p.lon <= bb[2] && p.lat >= bb[1] && p.lat <= bb[3] && pointInRing([p.lon, p.lat], s.ring));
}
function pointFigure(o, items) {
  return { key: o.key, label: o.label, unit: o.unit, source: o.source || null, kind: "points", value: items.length, basis: "measured", tag: "exact: counted inside the shape", from: [], blockGroups: 0, noValue: 0,
    how: o.how || "Each one is counted only if its own mapped position is inside the drawn shape. Nothing is apportioned." };
}

const FIELD_NOTES = {
  own: "Owner-occupied share is a share of occupied homes; the number of occupied homes per block group is not on file.",
  nocar: "The share of households without a car is a share of households; the number of households per block group is not on file.",
  ht: "Heat is one figure for each block group as a whole (Tree Equity Score), not a count.",
  tg: "The canopy gap is one figure for each block group as a whole (Tree Equity Score), not a count.",
  bt: "Buses per hour is read at each block group's busiest stop, so it cannot be added across block groups.",
  pa: "Park acres within half a mile is measured around each block group, and neighbouring block groups share the same parks, so it cannot be added.",
};
/**
 * areaFigures(rows, ctx) -> { key: figure }
 *   rows: [{ id, share, m (the block group's metrics), crash ([ped/bike, killed or seriously injured, all] or null) }]
 *   ctx: { acs (text), bundleFile (text), crashMeta }
 */
function areaFigures(rows, ctx) {
  ctx = ctx || {};
  const file = ctx.bundleFile || "the county data file";
  const acs = `Census ACS ${ctx.acs || "5-year estimates"}, block groups, as carried in ${file}`;
  const src = (base, f) => `${base} (field ${f})`;
  const col = (f, extra) => rows.map(r => Object.assign({ id: r.id, share: r.share, v: num(r.m && r.m[f]) }, extra ? extra(r) : null));
  const homesW = r => ({ w: num(r.m && r.m.homes) });
  // each block group says where its own home value comes from (field hvs): the ACS median, the surrounding tract's
  // median, or for Los Angeles County a median of homes that changed hands
  const hvKinds = [...new Set(rows.filter(r => r.m && num(r.m.hv) != null && r.m.hvs).map(r => String(r.m.hvs).replace(/median of [\d,]+ homes/, "median of homes")))];
  const hvSource = hvKinds.length ? `${hvKinds.slice(0, 2).join("; ")}${hvKinds.length > 2 ? "; and " + (hvKinds.length - 2) + " more kinds of source" : ""}, as carried in ${file} (fields hv, hvs)` : src(acs, "hv");
  const out = {};
  out.landAcres = Object.assign(countFigure({ key: "landAcres", label: "Land inside the shape", unit: "acres", source: src(`block-group acres in ${file}`, "acres") }, col("acres")), {});
  out.pop = countFigure({ key: "pop", label: "People", unit: "people", source: src(acs, "pop") }, col("pop"));
  out.homes = countFigure({ key: "homes", label: "Homes", unit: "homes", source: src(acs, "homes") }, col("homes"));
  out.hv = medianFigure({ key: "hv", label: "Typical home value", unit: "USD", topCode: [2000000, 2000001], topCodeText: "$2,000,000 or more", source: hvSource }, col("hv", r => Object.assign(homesW(r), { tract: /tract/i.test(String((r.m && r.m.hvs) || "")) })));
  out.rent = medianFigure({ key: "rent", label: "Median rent", unit: "USD per month", topCode: [3500, Infinity], topCodeText: "$3,500 or more", source: src(acs, "rent") }, col("rent", homesW));
  out.inc = medianFigure({ key: "inc", label: "Median household income", unit: "USD per year", topCode: [250001, 250001], topCodeText: "$250,000 or more", source: src(acs, "inc") }, col("inc", homesW));
  out.yb = medianFigure({ key: "yb", label: "Median year homes were built", unit: "year", source: src(acs, "yb") }, col("yb", homesW));
  out.sf = rateFigure({ key: "sf", label: "Homes in single-unit buildings", unit: "% of homes", denominator: "homes", rounded: true, source: src(acs, "sf") }, col("sf", r => ({ d: num(r.m && r.m.homes) })));
  out.own = rateFigure({ key: "own", label: "Owner-occupied", unit: "% of occupied homes", whyRange: FIELD_NOTES.own, source: src(acs, "own") }, col("own"));
  out.nocar = rateFigure({ key: "nocar", label: "Households without a car", unit: "% of households", whyRange: FIELD_NOTES.nocar, source: src(acs, "nocar") }, col("nocar"));
  if (rows.some(r => r.m && r.m.vc != null)) out.vc = rateFigure({ key: "vc", label: "Violent crime", unit: "per 1,000 residents, 12 months", denominator: "residents", source: src(`police records as carried in ${file}`, "vc") }, col("vc", r => ({ d: num(r.m && r.m.pop) })));
  if (rows.some(r => r.m && r.m.pcr != null)) out.pcr = countFigure({ key: "pcr", label: "Property crimes, 12 months", unit: "crimes", source: src(`police records as carried in ${file}`, "pcr") }, col("pcr"));
  out.ht = rangeFigure({ key: "ht", label: "Heat vs. the urban area's average", unit: "°F", whyRange: FIELD_NOTES.ht, source: src(`Tree Equity Score as carried in ${file}`, "ht") }, col("ht"));
  out.tg = rangeFigure({ key: "tg", label: "Tree canopy gap to goal", unit: "points", whyRange: FIELD_NOTES.tg, source: src(`Tree Equity Score as carried in ${file}`, "tg") }, col("tg"));
  out.bt = rangeFigure({ key: "bt", label: "Buses per hour at the busiest stop", unit: "buses per hour, 7-9 am", whyRange: FIELD_NOTES.bt, source: src(`GTFS schedules as carried in ${file}`, "bt") }, col("bt"));
  out.pa = rangeFigure({ key: "pa", label: "Park acres within half a mile", unit: "acres", whyRange: FIELD_NOTES.pa, source: src(`park layers as carried in ${file}`, "pa") }, col("pa"));
  const cm = ctx.crashMeta || null;
  if (rows.some(r => Array.isArray(r.crash))) {
    const yrs = cm && cm.years ? (Array.isArray(cm.years) ? `${cm.years[0]}-${cm.years[cm.years.length - 1]}` : String(cm.years)) : null;
    const csrc = `${(cm && cm.source) || "state crash records"}${yrs ? ", " + yrs : ""} (${ctx.crashFile || "app/data/crash_counts"})`;
    const ccol = i => rows.map(r => ({ id: r.id, share: r.share, v: Array.isArray(r.crash) ? num(r.crash[i]) : null }));
    const third = cm && Array.isArray(cm.fields) && cm.fields[2] ? cm.fields[2] : "all crashes";
    const note = f => Object.assign(f, { how: f.how + " Crashes happen on streets, many of them the boundary streets between block groups, so an area share is a rough guide for a cut block group." + (yrs ? ` Years: ${yrs}.` : "") });
    out.crashAll = note(countFigure({ key: "crashAll", label: third[0].toUpperCase() + third.slice(1), unit: "crashes", source: csrc }, ccol(2)));
    out.crashKsi = note(countFigure({ key: "crashKsi", label: "Crashes with someone killed or seriously injured", unit: "crashes", source: csrc }, ccol(1)));
    out.crashPedBike = note(countFigure({ key: "crashPedBike", label: "Crashes involving a pedestrian or cyclist", unit: "crashes", source: csrc }, ccol(0)));
  }
  // density: modelled from two apportioned counts
  const h = out.homes, a = out.landAcres, p = out.pop;
  const both = h.value != null && a.value != null && a.value > 0;
  const hRows = new Set(rows.filter(r => num(r.m && r.m.homes) != null && num(r.m && r.m.acres) != null).map(r => r.id));
  const dens = both ? rows.filter(r => hRows.has(r.id)).reduce((s, r) => s + r.share * r.m.homes, 0) / rows.filter(r => hRows.has(r.id)).reduce((s, r) => s + r.share * r.m.acres, 0) : null;
  out.homesPerAcre = { key: "homesPerAcre", label: "Homes per acre of land", unit: "homes per gross acre", kind: "ratio", value: num(dens), basis: num(dens) != null ? "modelled" : null, from: fromRows(rows.map(r => ({ id: r.id, share: r.share, v: hRows.has(r.id) ? r.m.homes / r.m.acres : null }))), blockGroups: rows.length, noValue: rows.length - hRows.size,
    source: `${h.source}; ${a.source}`, tag: "homes inside divided by land inside", how: "The estimated homes inside the shape divided by the estimated land acres inside it (both from the block groups that have both figures)." + (h.basis === "apportioned" ? " " + EVEN_SPREAD : "") };
  const pRows = rows.filter(r => num(r.m && r.m.pop) != null && num(r.m && r.m.acres) != null);
  const pAc = pRows.reduce((s, r) => s + r.share * r.m.acres, 0);
  const pd = pRows.length && pAc > 0 ? pRows.reduce((s, r) => s + r.share * r.m.pop, 0) / (pAc * ACRE_M2 / (MILE_M * MILE_M)) : null;
  out.popPerSqMi = { key: "popPerSqMi", label: "People per square mile of land", unit: "people per square mile", kind: "ratio", value: num(pd), basis: num(pd) != null ? "modelled" : null, from: [], blockGroups: rows.length, noValue: rows.length - pRows.length,
    source: `${p.source}; ${a.source}`, tag: "people inside divided by land inside", how: "The estimated people inside the shape divided by the estimated land inside it, in square miles." };
  return out;
}

// ---------------------------------------------------------------- 3. what to build
const GRADES = ["A", "B", "C", "D"];
/**
 * whatToBuild(rows, ctx) -> { ideas, withheld, housingPlays, ordering, caveats, missing }
 *   rows: [{ id, share, m, r }] ; ctx: { decisionEngine, catalog, verification, countyFips }
 *   Runs the decision engine's recommendForNeighborhood on every block group and combines the answers. An idea whose
 *   figures are withheld in a block group contributes no figure from it. Nothing is summed across block groups:
 *   neighbouring block groups can list the same project (the same park), so a sum could count it twice.
 */
function whatToBuild(rows, ctx) {
  ctx = ctx || {};
  const eng = ctx.decisionEngine, missing = [];
  if (!eng || typeof eng.recommendForNeighborhood !== "function") return { ideas: [], withheld: [], housingPlays: [], missing: ["decision engine (src/engines/investmentDecisionEngine.js)"] };
  const ideas = new Map(), held = new Map(), plays = new Map();
  let shareSum = 0, firstRec = null;
  for (const row of rows) {
    if (!row.m) continue;
    shareSum += row.share;
    let rec = null;
    try { rec = eng.recommendForNeighborhood({ id: row.id, m: row.m, r: row.r || [] }, { catalog: ctx.catalog, verification: ctx.verification, countyFips: ctx.countyFips }); } catch (e) { rec = null; }
    if (!rec) continue;
    if (!firstRec) { firstRec = rec; for (const x of rec.missing || []) if (!missing.includes(x)) missing.push(x); }
    const best = new Map();   // one row per idea per block group: the one returning most per dollar
    for (const x of rec.ideas || []) {
      const cur = best.get(x.id), v = x.valuePerDollar && x.valuePerDollar.value;
      if (!cur || (v != null && (cur.valuePerDollar.value == null || v > cur.valuePerDollar.value))) best.set(x.id, x);
    }
    for (const [id, x] of best) {
      if (!ideas.has(id)) ideas.set(id, { id, name: x.name, kind: x.kind, evidence: x.evidence, parts: [] });
      ideas.get(id).parts.push({ id: row.id, share: row.share, vpd: num(x.valuePerDollar.value), cost: num(x.cost.value), project: x.project || null });
    }
    for (const w of rec.withheld || []) {
      if (!held.has(w.id)) held.set(w.id, { id: w.id, name: w.name, kind: w.kind || null, verification: w.verification || null, reason: w.reason, blockGroups: 0 });
      held.get(w.id).blockGroups++;
    }
    for (const p of rec.housingPlays || []) {
      if (!plays.has(p.play)) plays.set(p.play, { play: p.play, label: p.label, legal: p.legal, evidence: p.evidence, parts: [], missing: [], availableIn: 0 });
      const q = plays.get(p.play);
      if (/found|listed/.test(String(p.available || "")) && !/none listed/.test(String(p.available || ""))) q.availableIn++;
      q.parts.push({ id: row.id, share: row.share, vpd: num(p.valuePerDollar && p.valuePerDollar.value), cost: num(p.cost && p.cost.value) });
      for (const x of p.missing || []) if (!q.missing.includes(x)) q.missing.push(x);
    }
  }
  const bsrc = "the county data file's project rows (pipeline estimates), gated by app/data/intervention_verification.json";
  const combine = (parts, key, unit, label) => {
    const have = parts.filter(p => p[key] != null);
    const from = parts.map(p => ({ id: p.id, share: round(p.share, 4), value: p[key] }));
    if (!have.length) return { value: null, unit, basis: null, from, source: bsrc, blockGroups: parts.length, noValue: parts.length };
    const w = have.reduce((s, p) => s + p.share, 0);
    return { value: null, unit, basis: "range", range: [Math.min(...have.map(p => p[key])), Math.max(...have.map(p => p[key]))], from, source: bsrc, blockGroups: parts.length, noValue: parts.length - have.length,
      weightedAverage: w > 0 ? { value: have.reduce((s, p) => s + p.share * p[key], 0) / w, label, weight: "the share of each block group inside the shape" } : null };
  };
  const list = [...ideas.values()].map(x => {
    const vpd = combine(x.parts, "vpd", "USD of home value per USD spent", "share-weighted average of the block-group estimates");
    const cost = combine(x.parts, "cost", "USD per block-group project (build + land + 10-yr upkeep)", "share-weighted average cost of one block group's project");
    return { id: x.id, name: x.name, kind: x.kind, evidence: x.evidence, valuePerDollar: vpd, cost,
      appliesIn: x.parts.length, blockGroups: rows.length, coverage: shareSum > 0 ? x.parts.reduce((s, p) => s + p.share, 0) / shareSum : null,
      example: (x.parts.slice().sort((a, b) => b.share - a.share)[0] || {}).project || null };
  });
  const avg = x => x.valuePerDollar.weightedAverage ? x.valuePerDollar.weightedAverage.value : null;
  const tier = x => (x.evidence && x.evidence.tier === "borrowed study") ? 0 : 1;
  const pays = x => (avg(x) != null && avg(x) >= 1) ? 0 : 1;
  const grade = x => { const i = GRADES.indexOf(x.evidence && x.evidence.grade); return i < 0 ? 9 : i; };
  list.sort((a, b) => (tier(a) - tier(b)) || (pays(a) - pays(b)) || (grade(a) - grade(b)) || ((avg(b) ?? -1) - (avg(a) ?? -1)) || (a.id < b.id ? -1 : 1));
  // an idea listed with figures in some block groups can be withheld in others (a study that applies only below an income)
  const withheld = [...held.values()].sort((a, b) => b.blockGroups - a.blockGroups || (a.id < b.id ? -1 : 1));
  const housingPlays = [...plays.values()].map(p => ({
    play: p.play, label: p.label, legal: p.legal, evidence: p.evidence, availableIn: p.availableIn, blockGroups: rows.length,
    valuePerDollar: combine(p.parts, "vpd", "USD of home value per USD spent", "share-weighted average of the block-group estimates"),
    cost: combine(p.parts, "cost", "USD per home", "share-weighted average of the block-group estimates"), missing: p.missing }));
  return {
    ideas: list, withheld, housingPlays,
    ordering: "Same order as the decision engine uses for one block group: ideas that passed the data audit first, then those returning at least $1 per $1, then the catalog's own grade, then value per dollar. Here value per dollar is the average of the block-group estimates, weighted by the share of each block group inside the shape, over the block groups where the idea has a figure.",
    caveats: (firstRec && firstRec.caveats ? firstRec.caveats.slice() : []).concat(["Costs are not added up across block groups: neighbouring block groups can list the same project (for example the same park), so a sum could count it twice."]),
    missing,
  };
}

// ---------------------------------------------------------------- 4. land to redevelop
/**
 * describeCandidate(site, ctx) -> what the data on file can and cannot say about one site
 *   site: { id, kind, name, address, lon, lat, acres, parcelRecord (bool), zoningCode, zoningCategory, publicOwner,
 *           assessedLandValue, assessedBaseYear, status ("built" | "building" | "planned" | null), housingElement,
 *           easement, verification ({ status, unverified_fields } | null), verificationNote, source, modelFields: [names] }
 *   ctx: { stations: [{ name, lon, lat }], planned: [{ name, lon, lat, status }], unplaced: n (planned stations on file
 *          whose position is not confirmed), decisionEngine, laws, stateCode, countyFips, walkMeters }
 */
function describeCandidate(site, ctx) {
  ctx = ctx || {};
  const walk = ctx.walkMeters || LIMITS.walkMeters, here = [site.lon, site.lat];
  const nearest = list => { let best = null; for (const s of (list || [])) { const d = distanceMeters(here, [s.lon, s.lat]); if (!best || d < best.meters) best = { name: s.name || null, meters: d, status: s.status || null }; } return best; };
  const ex = nearest(ctx.stations), pl = nearest(ctx.planned);
  const station = {
    walkMeters: walk, basis: "measured", how: "straight-line distance from the site's centre to the station's mapped position; not a walking route",
    existing: ex ? { name: ex.name, meters: round(ex.meters, 0), within: ex.meters <= walk } : null,
    planned: pl ? { name: pl.name, meters: round(pl.meters, 0), within: pl.meters <= walk, status: pl.status } : null,
    answer: ex && ex.meters <= walk ? "within walk distance of an existing station" : pl && pl.meters <= walk ? "within walk distance of a station under construction or planned" : (ex || pl) ? "not within walk distance of a station on file" : "no station on file for this county",
    plannedUnplaced: ctx.unplaced || 0,
  };
  const blockers = [];
  const zKnown = !!(site.zoningCode && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(String(site.zoningCode).trim()));
  let stateLaw = { status: "not determined", why: site.parcelRecord ? "no zoning code in the parcel record" : "no parcel record on file for this site", statutes: [], notConfirmed: [] };
  if (site.parcelRecord && zKnown) {
    const eng = ctx.decisionEngine;
    if (!eng || typeof eng.recommendForParcel !== "function") stateLaw.why = "statute engine not loaded";
    else if (!Array.isArray(ctx.laws)) stateLaw.why = "state law table (app/data/statutes.json) not loaded";
    else {
      const cat = String(site.zoningCategory || "");
      const facts = {
        parcel_id: String(site.id), state_code: ctx.stateCode || null, county_fips: ctx.countyFips || null, base_zoning_code: String(site.zoningCode).trim(),
        municipality_pop: null, county_pop: null,
        is_commercial_or_mixed_use: /commercial|mixed/i.test(cat), is_single_family_residential: /single-family/i.test(cat),
        dist_to_heavy_rail_mi: ex ? ex.meters / MILE_M : null, dist_to_frequent_bus_or_brt_mi: null,
        exclusions: { historic_district_hpoz: null, fema_100yr_floodway: null, calfire_or_state_vhfhsz: null },
        lot_sqft: num(site.acres) != null ? site.acres * 43560 : null,
      };
      let z = null;
      try { z = eng.recommendForParcel(facts, { laws: ctx.laws }).zoning; } catch (e) { z = null; }
      if (!z) stateLaw.why = "the statute engine gave no answer";
      else {
        stateLaw = { status: z.statutes && z.statutes.length ? "a state law on file applies" : "not determined", statutes: z.statutes || [], notConfirmed: z.not_confirmed || [],
          why: z.statutes && z.statutes.length ? "A screen from the zoning category and station distance in the record; flood, fire-hazard and historic overlays were not checked for this site, and the city or county decides." : (z.not_confirmed && z.not_confirmed.length ? "the statute engine could not confirm any law for this record" : "no state law on file was applied to this record by the statute engine") };
      }
    }
  }
  if (!zKnown) blockers.push({ fact: "zoning", why: site.parcelRecord ? "the parcel record has no zoning code" : "no parcel record on file, so the zoning is unknown" });
  if (!site.publicOwner) blockers.push({ fact: "owner", why: site.parcelRecord ? "the record names no owner: it is not on the county's public-agency parcel list as carried here, and private owners are not on file" : "no parcel record on file, so the owner is unknown" });
  blockers.push({ fact: "cost", why: "no sourced construction cost per square foot and no recorded land price are on file" + (num(site.assessedLandValue) != null ? "; the assessed land value is a tax-roll figure, not a price" : "") });
  blockers.push({ fact: "overlays", why: "flood, fire-hazard, historic and easement checks were not run for this site" + (site.easement ? " (the record does flag a conservation easement)" : "") });
  const v = site.verification || null;
  return {
    id: site.id, kind: site.kind || null, name: site.name || null, address: site.address || null, lon: site.lon, lat: site.lat, blockGroupId: site.blockGroupId || null,
    acres: { value: num(site.acres), unit: "acres", basis: num(site.acres) != null ? "measured" : null, from: [], source: site.source || null },
    assessedLandValue: { value: num(site.assessedLandValue), unit: "USD (assessed, tax roll)", basis: num(site.assessedLandValue) != null ? "measured" : null, from: [], source: site.source || null, baseYear: site.assessedBaseYear || null },
    status: site.status || null, housingElement: site.housingElement == null ? null : site.housingElement, easement: !!site.easement,
    publicOwner: site.publicOwner || null,
    zoning: { code: zKnown ? String(site.zoningCode).trim() : null, category: site.zoningCategory || null, status: zKnown ? "on file" : "not determined" },
    stateLaw, station, blockers,
    verification: v ? (v.status || "unverified") : "not individually checked",
    verificationNote: site.verificationNote || (v && v.status_detail) || null,
    withheldFields: site.modelFields || (v && v.unverified_fields) || [],
    recommendation: null,
    recommendationWhy: "No recommendation: " + blockers.filter(b => b.fact !== "overlays").map(b => b.fact).join(", ") + " not on file.",
  };
}
const NO_RECIPE = {
  text: "What would get this land redeveloped is not on file. The repository has no sourced study or record that links building a particular public project to a nearby lot being redeveloped, so no \"build X to unlock Y\" is given.",
  dataNeeded: [
    "recorded sales and building permits around past public projects (to measure whether redevelopment followed)",
    "who owns each site and on what terms (owner, lease, liens)",
    "the local zoning rules for each site (height, floor area, parking, minimum lot size)",
    "construction cost per square foot and land prices for the area",
    "flood, fire-hazard, historic and easement checks for each site",
  ],
};

// ---------------------------------------------------------------- 5. transit
/** The area as the decision engine's transit "area": gross density from the apportioned counts. Bus frequency is a range, so it is not passed. */
function transitInput(name, figures) {
  const d = figures.homesPerAcre, p = figures.popPerSqMi;
  return { name, householdsPerGrossAcre: d && d.value != null ? d.value : null,
    densitySource: "homes inside the drawn area / land acres inside it (apportioned by area from Census ACS block groups)",
    stationAreaPopDensityPerSqMi: p && p.value != null ? p.value : null, currentBusesPerHour: null };
}

// ---------------------------------------------------------------- 6. the whole answer
/**
 * summarizeArea(input) -> the area report
 *   input: { shape (spec), features, details (id -> { m, r }), names (id -> { n, c }) optional, fips, countyName, stateCode,
 *            acs, bundleFile, crashCounts ({ _meta, id: [..] }) optional, crashFile,
 *            points: { stations, planned, plannedUnplaced, stops, sites (normalised candidates), places },
 *            decisionEngine, catalog, verification, laws, costBenchmarks, valueEffects }
 */
function summarizeArea(input) {
  input = input || {};
  const shape = normalizeShape(input.shape);
  if (!shape.ok) return { status: "invalid", error: shape.error, limits: LIMITS };
  const shares = blockGroupShares(shape, input.features);
  const det = input.details || {}, names = input.names || {};
  const pts = input.points || {};
  const base = {
    schema: "city-pretty/drawn-area@1", engineVersion: AREA_ENGINE_VERSION, limits: LIMITS,
    county: { fips: input.fips || null, name: input.countyName || null },
    shape: { type: shape.type, ring: shape.ring, center: shape.center || null, radiusMiles: shape.radiusMiles || null,
      acres: { value: shape.acres, unit: "acres", basis: "measured", from: [], source: "measured from the drawn shape" + (shape.type === "circle" ? ` (a ${LIMITS.circleSides}-sided shape with its corners on the circle)` : "") },
      sqMiles: shape.sqMiles, encoded: encodeArea(input.shape) },
  };
  // exact point data, whatever the size of the shape
  const stations = pointsInside(shape, pts.stations), planned = pointsInside(shape, pts.planned), stops = pointsInside(shape, pts.stops);
  const siteCtx = { stations: pts.stations, planned: pts.planned, unplaced: pts.plannedUnplaced || 0, decisionEngine: input.decisionEngine, laws: input.laws, stateCode: input.stateCode, countyFips: input.fips };
  const sitesIn = pointsInside(shape, pts.sites);
  const candidates = sitesIn.filter(s => !s.status).map(s => describeCandidate(s, siteCtx)).sort((a, b) => (b.acres.value ?? -1) - (a.acres.value ?? -1) || (String(a.id) < String(b.id) ? -1 : 1));
  const done = sitesIn.filter(s => s.status).map(s => ({ id: s.id, kind: s.kind, acres: num(s.acres), status: s.status }));
  const places = pointsInside(shape, pts.places);
  base.points = {
    stations: Object.assign(pointFigure({ key: "stations", label: "Rail stations", unit: "stations", source: pts.stationsSource || "the county data file's stations layer" }, stations), { items: stations.map(s => ({ name: s.name || null })) }),
    plannedStations: Object.assign(pointFigure({ key: "plannedStations", label: "Stations under construction or planned", unit: "stations", source: pts.plannedSource || "the county data file and app/data/transit_pipelines.json (positions marked confirmed only)" }, planned), { items: planned.map(s => ({ name: s.name || null, status: s.status || null })), unplaced: pts.plannedUnplaced || 0 }),
    stops: pointFigure({ key: "stops", label: "Busier bus stops (the map's stops layer)", unit: "stops", source: pts.stopsSource || "the county data file's stops layer", how: pts.stopsHow || null }, stops),
    sites: pointFigure({ key: "sites", label: "Redevelopment candidates", unit: "sites", source: pts.sitesSource || "the site records on file", how: "A site is counted only if the centre of its mapped outline (or its mapped point) is inside the drawn shape. Sites the record marks as already built, under construction or approved are listed apart." }, candidates),
    places: Object.assign(pointFigure({ key: "places", label: "Specific places suggested for projects", unit: "places", source: pts.placesSource || "the county's site suggestions file" }, places), { items: places.slice(0, 40).map(p => ({ type: p.type, name: p.name || null, idea: p.idea || null })) }),
  };
  base.land = { candidates, alreadyUnderWay: done, coverage: pts.sitesCoverage || null, noRecipe: NO_RECIPE, walkMeters: LIMITS.walkMeters };
  base.blockGroups = shares.map(s => { const d = det[s.id] || {}, m = d.m || {}, nm = names[s.id] || {}; return { id: s.id, name: m.n || nm.n || null, city: m.c || nm.c || null, share: round(s.share, 4), acresInside: num(m.acres) != null ? s.share * m.acres : null }; });
  base.neighborhoods = [...new Set(base.blockGroups.map(b => b.name).filter(Boolean))];
  if (!shares.length) return Object.assign(base, { status: "empty", message: "The shape does not overlap any block group of the county that is open." });
  const largest = shares[0].share;
  if (shares.length > LIMITS.maxBlockGroups) return Object.assign(base, { status: "too_large", message: `The shape touches ${shares.length} block groups. This tool stops at ${LIMITS.maxBlockGroups}: beyond that, use the county views. Draw a smaller area.` });
  if (largest < LIMITS.minLargestShare) return Object.assign(base, { status: "too_coarse", largestShare: round(largest, 4),
    message: `The shape covers at most ${Math.max(1, Math.round(largest * 100))}% of any block group it touches (under ${Math.round(LIMITS.minLargestShare * 100)}%). Block groups are the smallest unit the data has, so figures for a slice this small would be too coarse to trust. Only what is mapped as its own point is shown.` });
  const rows = shares.map(s => ({ id: s.id, share: s.share, m: (det[s.id] || {}).m || null, r: (det[s.id] || {}).r || [], crash: input.crashCounts && Array.isArray(input.crashCounts[s.id]) ? input.crashCounts[s.id] : null }));
  const figures = areaFigures(rows.map(r => Object.assign({}, r, { m: r.m || {} })), { acs: input.acs, bundleFile: input.bundleFile, crashMeta: input.crashCounts && input.crashCounts._meta, crashFile: input.crashFile });
  const build = whatToBuild(rows, { decisionEngine: input.decisionEngine, catalog: input.catalog, verification: input.verification, countyFips: input.fips });
  let transit = null;
  const label = base.neighborhoods.length ? `Drawn area (${base.neighborhoods.slice(0, 3).join(", ")}${base.neighborhoods.length > 3 ? " and more" : ""})` : "Drawn area";
  if (input.decisionEngine && typeof input.decisionEngine.evaluateTransit === "function") {
    try { transit = input.decisionEngine.evaluateTransit(transitInput(label, figures), { costBenchmarks: input.costBenchmarks, valueEffects: input.valueEffects }); } catch (e) { transit = null; }
  }
  return Object.assign(base, { status: "ok", largestShare: round(largest, 4), figures, build, transit, label });
}

const fmtInt = v => Math.round(v).toLocaleString("en-US");
const fmtUsd = v => (v >= 2000000 && v <= 2000001) ? "$2,000,000 or more" : "$" + Math.round(v).toLocaleString("en-US");   // the Census top code for home value, as app/app.js shows it
/** One plain paragraph: what the area is, how many neighborhoods it touches, and the three figures people ask for first. */
function plainSummary(a) {
  if (!a || a.status === "invalid") return "No area is drawn.";
  const what = a.shape.type === "circle" ? `A circle of ${a.shape.radiusMiles === 0.25 ? "a quarter mile" : a.shape.radiusMiles === 0.5 ? "half a mile" : "one mile"} around the point you chose` : "The shape you drew";
  const size = `${a.shape.acres.value >= 100 ? fmtInt(a.shape.acres.value) : a.shape.acres.value.toFixed(1)} acres (${a.shape.sqMiles.toFixed(2)} square miles)`;
  const n = a.blockGroups.length, hoods = a.neighborhoods;
  const where = n ? ` in ${a.county.name || "this county"}. It touches ${n} Census block group${n > 1 ? "s" : ""}${hoods.length ? ` in ${hoods.length} named neighborhood${hoods.length > 1 ? "s" : ""} (${hoods.slice(0, 4).join(", ")}${hoods.length > 4 ? " and " + (hoods.length - 4) + " more" : ""})` : ""}.` : ".";
  if (a.status !== "ok") return `${what} covers ${size}${where} ${a.message || ""}`.trim();
  const f = a.figures, bits = [];
  const est = x => x.basis === "measured" ? "" : "about ";
  if (f.pop.value != null) bits.push(`${est(f.pop)}${fmtInt(f.pop.value)} people`);
  if (f.homes.value != null) bits.push(`${est(f.homes)}${fmtInt(f.homes.value)} homes`);
  let third = "";
  if (f.hv.basis === "measured") third = ` The typical (median) home value is ${fmtUsd(f.hv.value)}.`;
  else if (f.hv.basis === "range") third = ` Typical home values (block-group medians) run from ${fmtUsd(f.hv.range[0])} to ${fmtUsd(f.hv.range[1])}; the median for the area itself cannot be worked out from block-group data.`;
  else third = " No home value is on file for these block groups.";
  const cut = a.blockGroups.filter(b => b.share < 1).length;
  const how = cut ? ` ${cut} of the ${n} block groups are cut by the shape, so the counts are estimates by area.` : " Every block group is wholly inside, so the counts are exact sums.";
  return `${what} covers ${size}${where}${bits.length ? " It holds " + bits.join(" and ") + "." : ""}${third}${how}`;
}

/** A compact form for the AI advisor (context.drawn_area; the Worker caps it at DRAWN_AREA_MAX_CHARS). */
function advisorSummary(a, maxChars) {
  if (!a || a.status === "invalid") return null;
  const f = x => !x ? null : x.basis === "range" ? { range: x.range, unit: x.unit, basis: "range", weightedAverageOfMedians: x.weightedAverage ? round(x.weightedAverage.value, 2) : null, blockGroupsWithoutValue: x.noValue }
    : x.value == null ? null : { value: round(x.value, 2), unit: x.unit, basis: x.basis, how: x.tag || null, blockGroupsWithoutValue: x.noValue };
  const out = {
    schema: a.schema, county: a.county, status: a.status, message: a.message || null,
    howToRead: "Figures for an area the visitor drew on the map. basis: measured = exact; apportioned = block-group counts split by the share of each block group's area inside the shape (assumes people are spread evenly); range = lowest and highest block-group value (a median or rate cannot be combined); modelled = computed from apportioned counts. null = not on file. Never call a range or a weighted average of medians the median of the area.",
    summary: plainSummary(a),
    shape: { type: a.shape.type, acres: round(a.shape.acres.value, 1), radiusMiles: a.shape.radiusMiles },
    blockGroups: a.blockGroups.length, largestShareOfABlockGroupInside: a.largestShare != null ? a.largestShare : null, neighborhoods: a.neighborhoods.slice(0, 8),
    figures: null, whatToBuild: null, land: null, transit: null,
    exactPoints: { railStations: a.points.stations.items.map(s => s.name).slice(0, 6), stationsPlanned: a.points.plannedStations.items.map(s => s.name).slice(0, 6), busStops: a.points.stops.value, redevelopmentCandidates: a.points.sites.value },
  };
  if (a.status === "ok") {
    const g = a.figures;
    out.figures = { people: f(g.pop), homes: f(g.homes), landAcres: f(g.landAcres), homesPerAcre: f(g.homesPerAcre), medianHomeValue: f(g.hv), medianRent: f(g.rent), medianHouseholdIncome: f(g.inc), crashesKilledOrSeriouslyInjured: g.crashKsi ? f(g.crashKsi) : null };
    out.whatToBuild = {
      ideas: a.build.ideas.slice(0, 6).map(x => ({ name: x.name, valuePerDollar: f(x.valuePerDollar), blockGroupsWithAFigure: x.appliesIn, of: x.blockGroups, evidence: x.evidence ? x.evidence.verification || x.evidence.tier : null })),
      withheldNoFigure: a.build.withheld.slice(0, 10).map(x => x.name),
      housingPlays: a.build.housingPlays.map(p => ({ play: p.label, legal: p.legal, valuePerDollar: f(p.valuePerDollar), missing: p.missing.slice(0, 2) })),
    };
    const t = a.transit;
    out.transit = t ? { verdict: t.verdict, scale: t.scale, meaning: t.verdictMeaning || null, homesPerNetAcre: t.density && t.density.homesPerNetAcre ? t.density.homesPerNetAcre.value : null, reasons: (t.reasons || []).slice(0, 3), missing: (t.missing || []).slice(0, 3) } : null;
  }
  out.land = {
    coverage: a.land.coverage, whatWouldUnlockRedevelopment: a.land.noRecipe.text, dataNeeded: a.land.noRecipe.dataNeeded,
    candidates: a.land.candidates.slice(0, 6).map(c => ({ kind: c.kind, acres: c.acres.value, zoning: c.zoning.code || "not determined", stateLaw: c.stateLaw.status, station: c.station.answer, verification: c.verification, missing: c.blockers.map(b => b.fact) })),
    moreCandidates: Math.max(0, a.land.candidates.length - 6),
  };
  const cap = maxChars || 6000;
  // drop the longest lists first until it fits; never cut in the middle of a value
  const trims = [o => { o.land.candidates = o.land.candidates.slice(0, 3); o.land.moreCandidates = Math.max(0, a.land.candidates.length - 3); }, o => { if (o.whatToBuild) o.whatToBuild.ideas = o.whatToBuild.ideas.slice(0, 3); }, o => { if (o.whatToBuild) o.whatToBuild.withheldNoFigure = []; }, o => { o.land.dataNeeded = []; }, o => { o.land.candidates = []; }, o => { o.howToRead = "basis: measured, apportioned (by area), range, modelled; null = not on file."; }, o => { if (o.transit) o.transit.reasons = []; }, o => { o.neighborhoods = []; }];
  for (const t of trims) { if (JSON.stringify(out).length <= cap) break; t(out); }
  return JSON.stringify(out).length <= cap ? out : { schema: a.schema, county: a.county, status: a.status, summary: plainSummary(a).slice(0, Math.max(0, cap - 300)) };
}

const api = { AREA_ENGINE_VERSION, LIMITS, MILE_M, ACRE_M2, projector, signedArea, clipConvex, convexParts, isSimple, intersectionArea, pointInRing, ringCentroid, distanceMeters, circleRing, normalizeShape, encodeArea, decodeArea,
  blockGroupShares, countFigure, medianFigure, rateFigure, rangeFigure, pointsInside, areaFigures, whatToBuild, describeCandidate, transitInput, summarizeArea, plainSummary, advisorSummary };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.AreaAggregationEngine = api;
})();
