// @ts-check
// Draw-your-own-area geometry and aggregation. Pure functions, no DOM. Coordinates are [lon, lat] (GeoJSON order).
// No scoring happens here: aggregateRecommendations only groups and adds what the investment decision engine returned.

/** @typedef {[number, number]} LonLat */
/** @typedef {{ id: string, inside: 'centroid_inside'|'partly'|'outside', shareInside: number, centroid: LonLat|null }} BlockGroupSelection */

/**
 * Sample grid used to estimate how much of a block group lies inside the drawn area. The block group's bounding box
 * is cut into GRID_SIZE x GRID_SIZE cells; each cell centre that falls inside the block group is one sample.
 * shareInside = samples also inside the drawn area / samples inside the block group. A method parameter, not data.
 */
export const GRID_SIZE = 24;
/** Mean Earth radius in metres (IUGG), used only by polygonAreaSqM. */
export const EARTH_RADIUS_M = 6371008.8;

/** Drop the closing point when it repeats the first one. @param {LonLat[]} ring @returns {LonLat[]} */
export function openRing(ring) {
  if (ring.length > 1) {
    const a = ring[0], b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring;
}

/** @param {LonLat} p @param {LonLat} a @param {LonLat} b */
function onSegment(p, a, b) {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const scale = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) + Math.abs(p[0] - a[0]) + Math.abs(p[1] - a[1]);
  if (Math.abs(cross) > 1e-12 * (scale || 1)) return false;
  return p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
}

/**
 * Ray casting (even-odd). A point on an edge or a corner counts as inside. The ring may or may not repeat its first point.
 * @param {LonLat} pt @param {LonLat[]} ring
 */
export function pointInPolygon(pt, ring) {
  const r = openRing(ring);
  const n = r.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = r[i], b = r[j];
    if (onSegment(pt, a, b)) return true;
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Point in a GeoJSON polygon given as [outer, ...holes]. @param {LonLat} pt @param {LonLat[][]} rings */
export function pointInRings(pt, rings) {
  if (!rings.length || !pointInPolygon(pt, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (pointInPolygon(pt, rings[k]) && !onRingEdge(pt, rings[k])) return false;
  return true;
}
/** @param {LonLat} pt @param {LonLat[]} ring */
function onRingEdge(pt, ring) {
  const r = openRing(ring);
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (onSegment(pt, r[i], r[j])) return true;
  return false;
}

/**
 * Area of a ring in square metres. Method: equirectangular projection about the ring's mean latitude
 * (x = R * dLon * cos(lat0), y = R * dLat, radians), then the shoelace formula. Adequate for areas of city scale;
 * the error grows with size and latitude span.
 * @param {LonLat[]} ring
 */
export function polygonAreaSqM(ring) {
  const r = openRing(ring);
  if (r.length < 3) return 0;
  const rad = Math.PI / 180;
  const lat0 = (r.reduce((s, p) => s + p[1], 0) / r.length) * rad;
  const lon0 = r[0][0];
  const xy = r.map(p => [EARTH_RADIUS_M * (p[0] - lon0) * rad * Math.cos(lat0), EARTH_RADIUS_M * p[1] * rad]);
  let s = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) s += xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
  return Math.abs(s) / 2;
}

/** @param {LonLat[]} ring */
function bbox(ring) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1 };
}

/** Area-weighted centroid of a ring (planar, in degrees); bounding-box centre when the ring has no area. @param {LonLat[]} ring @returns {LonLat|null} */
export function ringCentroid(ring) {
  const r = openRing(ring);
  if (r.length < 3) return null;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
  }
  if (a === 0) { const b = bbox(r); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Polygons of a GeoJSON feature as arrays of rings. @param {any} f @returns {LonLat[][][]} */
function polysOf(f) {
  const g = f && f.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

/**
 * For each block group feature (GeoJSON Polygon or MultiPolygon, properties.id) say how it relates to the drawn area.
 * inside: 'centroid_inside' when the block group's centroid (of its largest ring) is inside the area; 'partly' when
 * the centroid is outside but the sample grid (GRID_SIZE x GRID_SIZE, see above) or a vertex shows an overlap;
 * 'outside' otherwise. shareInside is the sampled share (0..1); it is an estimate, deterministic for a given input.
 * @param {LonLat[]} polygon @param {any[]} bgFeatures @returns {BlockGroupSelection[]}
 */
export function selectBlockGroups(polygon, bgFeatures) {
  const poly = openRing(polygon);
  if (poly.length < 3) return [];
  const pb = bbox(poly);
  /** @type {BlockGroupSelection[]} */
  const out = [];
  for (const f of bgFeatures || []) {
    const id = f && f.properties && f.properties.id;
    if (id == null) continue;
    const polys = polysOf(f);
    if (!polys.length) continue;
    let fb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const rings of polys) { const b = bbox(rings[0]); fb = { x0: Math.min(fb.x0, b.x0), y0: Math.min(fb.y0, b.y0), x1: Math.max(fb.x1, b.x1), y1: Math.max(fb.y1, b.y1) }; }
    if (fb.x1 < pb.x0 || fb.x0 > pb.x1 || fb.y1 < pb.y0 || fb.y0 > pb.y1) { out.push({ id: String(id), inside: 'outside', shareInside: 0, centroid: null }); continue; }
    const big = polys.reduce((m, p) => (bbox(p[0]).x1 - bbox(p[0]).x0) * (bbox(p[0]).y1 - bbox(p[0]).y0) > (bbox(m[0]).x1 - bbox(m[0]).x0) * (bbox(m[0]).y1 - bbox(m[0]).y0) ? p : m, polys[0]);
    const centroid = ringCentroid(big[0]);
    const cIn = !!centroid && pointInPolygon(centroid, poly);
    let samples = 0, hits = 0;
    const dx = (fb.x1 - fb.x0) / GRID_SIZE, dy = (fb.y1 - fb.y0) / GRID_SIZE;
    for (let i = 0; i < GRID_SIZE; i++) for (let j = 0; j < GRID_SIZE; j++) {
      /** @type {LonLat} */
      const p = [fb.x0 + (i + 0.5) * dx, fb.y0 + (j + 0.5) * dy];
      if (!polys.some(rings => pointInRings(p, rings))) continue;
      samples++;
      if (pointInPolygon(p, poly)) hits++;
    }
    let share = samples ? hits / samples : (cIn ? 1 : 0);
    let overlap = hits > 0 || cIn;
    if (!overlap) {
      // thin or small block groups can fall between samples: any shared vertex still shows an overlap
      overlap = polys.some(rings => rings[0].some(v => pointInPolygon(v, poly))) || poly.some(v => polys.some(rings => pointInRings(v, rings)));
    }
    out.push({ id: String(id), inside: cIn ? 'centroid_inside' : overlap ? 'partly' : 'outside', shareInside: overlap ? share : 0, centroid });
  }
  return out;
}

/**
 * Which located site records fall in the area. A site is { pt?: [lon,lat], lines?: [lon,lat][][] } plus anything else
 * the caller keeps (returned untouched). A point counts when inside. A line counts when any vertex is inside;
 * insideVertices is the number of its vertices inside (the clipped vertex count), totalVertices all of them.
 * @template {{ pt?: LonLat|null, lines?: LonLat[][]|null }} S
 * @param {S[]} sites @param {LonLat[]} polygon
 * @returns {{ site: S, geometry: 'point'|'line', insideVertices: number, totalVertices: number }[]}
 */
export function sitesInPolygon(sites, polygon) {
  const poly = openRing(polygon);
  /** @type {{ site: S, geometry: 'point'|'line', insideVertices: number, totalVertices: number }[]} */
  const out = [];
  if (poly.length < 3) return out;
  for (const site of sites || []) {
    if (!site) continue;
    if (site.lines && site.lines.length) {
      let tot = 0, inn = 0;
      for (const ln of site.lines) for (const v of ln) { tot++; if (pointInPolygon(v, poly)) inn++; }
      if (inn > 0) out.push({ site, geometry: 'line', insideVertices: inn, totalVertices: tot });
    } else if (site.pt && Array.isArray(site.pt) && site.pt.length >= 2) {
      if (pointInPolygon(/** @type {LonLat} */ (site.pt), poly)) out.push({ site, geometry: 'point', insideVertices: 1, totalVertices: 1 });
    }
  }
  return out;
}

const isNum = (/** @type {any} */ v) => typeof v === 'number' && isFinite(v);
/**
 * The engine's own test for "pays" (src/engines/investmentDecisionEngine.js, `pays` in recommendForNeighborhood):
 * a value-per-dollar figure of at least 1. Copied here because the engine does not export it; can be overridden.
 * @param {any} idea
 */
export const enginePays = idea => !!idea && !!idea.valuePerDollar && isNum(idea.valuePerDollar.value) && idea.valuePerDollar.value >= 1;

/**
 * @typedef {{ value: number|null, unit: string|null, basis: string, partial: boolean, contributing: number }} Total
 */

/**
 * Group what recommendForNeighborhood returned for each selected block group by improvement and rank the improvements.
 * Nothing is estimated: totals add only numeric fields the engine returned (cost.value, valueAdded.value) for block
 * groups whose centre is inside the area; a block group with no number for a field is counted under noFigureIn and
 * adds nothing. Ranking: block groups where the engine put the idea first (its own ordering), then how many pay
 * (engine definition), then block groups carrying it, then key. Ideas the engine only withheld come last.
 * @param {{ id: string, shareInside: number, inside?: string, rec: any }[]} perBlockGroup
 * @param {{ pays?: (idea:any)=>boolean }} [opts]
 */
export function aggregateRecommendations(perBlockGroup, opts = {}) {
  const pays = opts.pays || enginePays;
  const BASIS = 'sum of engine figures for block groups whose centre is inside the area';
  /** @type {Map<string, any>} */
  const byKey = new Map();
  const withoutRecommendation = [];
  const get = (/** @type {string} */ key, /** @type {string} */ name, /** @type {string|null} */ kind) => {
    let a = byKey.get(key);
    if (!a) {
      a = { key, name, kind, blockGroups: 0, topIn: 0, paysIn: 0, noFigureIn: { cost: 0, valueAdded: 0 }, withheldIn: { count: 0, reasons: [], blockGroupIds: [] },
        evidence: [], blockGroupIds: [], _cost: [], _value: [], _partial: false };
      byKey.set(key, a);
    }
    return a;
  };
  for (const bg of perBlockGroup || []) {
    const rec = bg && bg.rec;
    if (!rec || !Array.isArray(rec.ideas)) { withoutRecommendation.push({ id: bg && bg.id, missing: rec && rec.missing || [] }); continue; }
    const centreIn = bg.inside ? bg.inside === 'centroid_inside' : bg.shareInside > 0;
    const partial = bg.shareInside < 1 || bg.inside === 'partly';
    rec.ideas.forEach((/** @type {any} */ idea, /** @type {number} */ i) => {
      const a = get(idea.id, idea.name || idea.id, idea.kind || null);
      a.blockGroups++; a.blockGroupIds.push(bg.id);
      if (i === 0) a.topIn++;
      if (pays(idea)) a.paysIn++;
      const ev = idea.evidence || {};
      const tag = JSON.stringify([ev.tier || null, ev.verification || null, ev.grade || null]);
      let e = a.evidence.find((/** @type {any} */ x) => x.tag === tag);
      if (!e) { e = { tag, tier: ev.tier || null, verification: ev.verification || null, grade: ev.grade || null, blockGroups: 0 }; a.evidence.push(e); }
      e.blockGroups++;
      if (partial) a._partial = true;
      for (const [field, list, key] of /** @type {const} */ ([['cost', a._cost, 'cost'], ['valueAdded', a._value, 'valueAdded']])) {
        const f = idea[field];
        if (!f || !isNum(f.value)) { a.noFigureIn[key]++; continue; }
        if (centreIn) list.push({ v: f.value, unit: f.unit || null, partial });
      }
    });
    for (const w of rec.withheld || []) {
      const a = get(w.id, w.name || w.id, w.kind || null);
      a.withheldIn.count++; a.withheldIn.blockGroupIds.push(bg.id);
      let r = a.withheldIn.reasons.find((/** @type {any} */ x) => x.reason === w.reason);
      if (!r) { r = { reason: w.reason, verification: w.verification || null, blockGroups: 0 }; a.withheldIn.reasons.push(r); }
      r.blockGroups++;
    }
  }
  const total = (/** @type {{v:number,unit:string|null,partial:boolean}[]} */ list, /** @type {boolean} */ anyPartial) => /** @type {Total} */ ({
    value: list.length ? list.reduce((s, x) => s + x.v, 0) : null,
    unit: list.length ? list[0].unit : null, basis: BASIS, partial: anyPartial || list.some(x => x.partial), contributing: list.length,
  });
  const improvements = [...byKey.values()].map(a => {
    const { _cost, _value, _partial, ...rest } = a;
    return { ...rest, cost: total(_cost, _partial), valueAdded: total(_value, _partial) };
  });
  improvements.sort((a, b) => (b.blockGroups > 0 ? 1 : 0) - (a.blockGroups > 0 ? 1 : 0) || b.topIn - a.topIn || b.paysIn - a.paysIn || b.blockGroups - a.blockGroups || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { improvements, blockGroupsConsidered: (perBlockGroup || []).length, withoutRecommendation, ordering: 'block groups where the engine ranked the idea first, then block groups where it pays (engine definition), then block groups carrying it; ideas only withheld come last' };
}
