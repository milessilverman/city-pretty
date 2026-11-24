// @ts-check
// Block-group attributes are DEMOGRAPHIC INPUTS only. They can be apportioned onto receptors; impact is never keyed by them.
import { centroidOf } from '../schema/geo.js';

/** @typedef {import('../schema/geo.js').GeoRef} GeoRef */
/** @typedef {{ bgId: string, receptorId: string, weight: number }} ApportionWeight */

/** Always throws: impact results are not keyed or aggregated by block group. @param {any} [_result] */
export function keyImpactByBlockGroup(_result) {
  throw new Error('block groups are demographic inputs only; impact results cannot be keyed by block group');
}

/** @type {[number, number][]} */
const NONE = [];
/** @param {number[][]} ring @param {number} lat0 @param {number} lon0 planar metres-ish (scaled degrees); only ratios are used */
function project(ring, lat0, lon0) {
  const k = Math.cos(lat0 * Math.PI / 180);
  return ring.map((p) => /** @type {[number, number]} */ ([(p[0] - lon0) * k, p[1] - lat0]));
}
/** @param {[number, number][]} p signed area */
function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
/** @param {[number, number][]} p */
function isConvex(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cr !== 0) { if (s !== 0 && Math.sign(cr) !== s) return false; s = Math.sign(cr); }
  }
  return true;
}
/** Sutherland-Hodgman: clip subject (any simple polygon) by a convex counter-clockwise clip. @param {[number, number][]} subject @param {[number, number][]} clipPoly */
function clip(subject, clipPoly) {
  let out = subject;
  for (let i = 0; i < clipPoly.length && out.length; i++) {
    const a = clipPoly[i], b = clipPoly[(i + 1) % clipPoly.length];
    const inside = (/** @type {[number, number]} */ p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const inter = (/** @type {[number, number]} */ p, /** @type {[number, number]} */ q) => {
      const d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = b[0] - a[0], d2y = b[1] - a[1];
      const t = ((a[0] - p[0]) * d2y - (a[1] - p[1]) * d2x) / (d1x * d2y - d1y * d2x);
      return /** @type {[number, number]} */ ([p[0] + t * d1x, p[1] + t * d1y]);
    };
    const inp = out; out = NONE.slice();
    for (let j = 0; j < inp.length; j++) {
      const cur = inp[j], prev = inp[(j + inp.length - 1) % inp.length];
      if (inside(cur)) { if (!inside(prev)) out.push(inter(prev, cur)); out.push(cur); } else if (inside(prev)) out.push(inter(prev, cur));
    }
  }
  return out;
}

/**
 * Area-overlap weights: share of each block group's area that falls inside each receptor polygon. Receptor polygons must be
 * simple convex polygons (grid cells); block-group polygons may be any simple polygon (outer ring only).
 * @param {GeoRef[]} blockGroups @param {GeoRef[]} receptors @returns {ApportionWeight[]}
 */
export function areaOverlapWeights(blockGroups, receptors) {
  const out = [];
  for (const bg of blockGroups) {
    if (bg.kind !== 'block_group' || bg.geometry.type !== 'Polygon') throw new Error('areaOverlapWeights: block group polygons required');
    const [lon0, lat0] = centroidOf(bg.geometry);
    const sp = project(bg.geometry.coordinates[0].slice(0, -1), lat0, lon0);
    const bgArea = Math.abs(signedArea(sp));
    if (bgArea === 0) throw new Error(`areaOverlapWeights: block group ${bg.id} has zero area`);
    for (const r of receptors) {
      if (r.geometry.type !== 'Polygon') throw new Error('areaOverlapWeights: receptors must be polygons');
      let cp = project(r.geometry.coordinates[0].slice(0, -1), lat0, lon0);
      if (!isConvex(cp)) throw new Error(`areaOverlapWeights: receptor ${r.id} must be convex`);
      if (signedArea(cp) < 0) cp = cp.slice().reverse();
      const ov = Math.abs(signedArea(clip(sp, cp)));
      if (ov > 0) out.push({ bgId: bg.id, receptorId: r.id, weight: ov / bgArea });
    }
  }
  return out;
}

/**
 * Apportion block-group attributes onto receptors using weights (share of the block group assigned to each receptor).
 * 'extensive' attributes (counts) are summed share x value; 'intensive' attributes (rates, medians) are weight-averaged.
 * A null attribute in any contributing block group makes the result null (unknown, not zero).
 * @param {{ id: string, attributes: Record<string, number|null> }[]} blockGroupAttributes
 * @param {ApportionWeight[]} weights
 * @param {Record<string, 'extensive'|'intensive'>} attributeKinds required for every attribute used
 */
export function apportionDemographics(blockGroupAttributes, weights, attributeKinds) {
  const bgs = new Map(blockGroupAttributes.map((b) => [b.id, b]));
  /** @type {Map<string, { receptorId: string, attributes: Record<string, number|null>, sources: string[], tag: 'demographic_input' }>} */
  const out = new Map();
  /** @type {Map<string, Record<string, { sum: number, w: number, unknown: boolean }>>} */
  const acc = new Map();
  for (const w of weights) {
    const bg = bgs.get(w.bgId);
    if (!bg) throw new Error('apportionDemographics: unknown block group ' + w.bgId);
    if (!(w.weight >= 0) || !Number.isFinite(w.weight)) throw new Error('apportionDemographics: weights must be finite and >= 0');
    let a = acc.get(w.receptorId);
    if (!a) { a = {}; acc.set(w.receptorId, a); out.set(w.receptorId, { receptorId: w.receptorId, attributes: {}, sources: [], tag: 'demographic_input' }); }
    out.get(w.receptorId)?.sources.push(w.bgId);
    for (const [name, val] of Object.entries(bg.attributes)) {
      if (!attributeKinds[name]) throw new Error(`apportionDemographics: attribute '${name}' needs a kind (extensive|intensive)`);
      const s = a[name] || (a[name] = { sum: 0, w: 0, unknown: false });
      if (val === null || val === undefined || !Number.isFinite(val)) { s.unknown = true; continue; }
      s.sum += val * w.weight;
      s.w += w.weight;
    }
  }
  for (const [rid, a] of acc) {
    const o = /** @type {any} */ (out.get(rid));
    for (const [name, s] of Object.entries(a)) o.attributes[name] = s.unknown || (attributeKinds[name] === 'intensive' && s.w === 0) ? null : attributeKinds[name] === 'intensive' ? s.sum / s.w : s.sum;
  }
  return [...out.values()];
}
