// @ts-check
// Combination discovery: adjacent-parcel assembly candidates and cross-category groups, with a hard bound.
import { makeGeoRef, bboxOf } from '../schema/geo.js';
import { makeOpportunity } from '../schema/opportunity.js';

/**
 * pairRule: { id, categoryIds: [a, b] or [a, b, c], relation: 'same_location'|'adjacent', basis: string }
 * Triples are allowed for same_location only. adjacency: [parcelIdA, parcelIdB][] ; if absent, shared polygon edges are tested.
 * @param {{ opportunities?: any[], parcels?: any[], adjacency?: [string, string][]|null, pairRules?: any[], bound: number }} args
 */
export function combinations({ opportunities = [], parcels = [], adjacency = null, pairRules = [], bound }) {
  if (!Number.isInteger(bound) || bound < 0) throw new Error('combinations: bound must be a non-negative integer');
  for (const r of pairRules) {
    if (!r || !r.id || !Array.isArray(r.categoryIds) || r.categoryIds.length < 2 || r.categoryIds.length > 3) throw new Error('combinations: pairRule needs id and 2 or 3 categoryIds');
    if (!['same_location', 'adjacent'].includes(r.relation)) throw new Error('combinations: pairRule relation must be same_location or adjacent');
    if (r.relation === 'adjacent' && r.categoryIds.length !== 2) throw new Error('combinations: adjacent rules take exactly two categories');
  }
  /** @type {Map<string, any>} */ const byId = new Map();
  for (const p of parcels) if (p && p.ref) byId.set(p.ref.id, p);
  const pairs = adjacency ? adjacency.filter(([a, b]) => a !== b) : sharedEdgePairs(parcels);
  const known = pairs.filter(([a, b]) => byId.has(a) && byId.has(b));

  /** @type {any[]} */ const out = [];
  /** @type {any[]} */ const assemblyOpportunities = [];
  let total = 0;
  const room = () => bound - out.length;

  // 1. adjacent-parcel assembly candidates
  for (const [a, b] of known) {
    total++;
    if (room() <= 0) continue;
    const pa = byId.get(a).ref, pb = byId.get(b).ref;
    const [x0, y0, x1, y1] = bbox2(pa, pb);
    const area = makeGeoRef({ kind: 'area', id: `assembly:${a}+${b}`, jurisdiction: pa.jurisdiction,
      geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]] } });
    const opp = makeOpportunity({ id: `combination:assembly:${a}+${b}`, categoryId: 'assembly', location: area, discoveredBy: 'combination',
      missingInputs: ['ownership_records', 'combined_parcel_area'], confidence: 'low',
      confidenceReasons: ['adjacent parcels; location is the bounding box of the two parcels, not their union'] });
    assemblyOpportunities.push(opp);
    out.push({ id: opp.id, kind: 'assembly', ruleId: null, members: [a, b], opportunityIds: [], opportunity: opp });
  }

  // 2. cross-category groups from caller rules
  /** @type {Map<string, any[]>} */ const oppsByLoc = new Map();
  for (const o of opportunities) {
    if (o.status === 'rejected') continue;
    const k = o.location.id;
    if (!oppsByLoc.has(k)) oppsByLoc.set(k, []);
    /** @type {any[]} */ (oppsByLoc.get(k)).push(o);
  }
  /** @param {string} loc @param {string} cat */
  const pick = (loc, cat) => (oppsByLoc.get(loc) || []).filter((o) => o.categoryId === cat);
  for (const rule of pairRules) {
    /** @type {string[][]} */ let unitsLocs = [];
    if (rule.relation === 'same_location') unitsLocs = [...oppsByLoc.keys()].map((l) => [l]);
    else unitsLocs = known.flatMap(([a, b]) => [[a, b], [b, a]]);
    for (const locs of unitsLocs) {
      const lists = rule.categoryIds.map((/** @type {string} */ c, /** @type {number} */ i) => pick(locs[rule.relation === 'same_location' ? 0 : i], c));
      const n = lists.reduce((/** @type {number} */ m, /** @type {any[]} */ l) => m * l.length, 1);
      if (n === 0) continue;
      total += n;
      let made = 0;
      const gen = (/** @type {number} */ i, /** @type {any[]} */ acc) => {
        if (room() <= 0) return;
        if (i === lists.length) {
          out.push({ id: `combination:${rule.id}:${acc.map((o) => o.id).join('+')}`, kind: 'cross_category', ruleId: rule.id, basis: rule.basis, members: locs.slice(), opportunityIds: acc.map((o) => o.id) });
          made++; return;
        }
        for (const o of lists[i]) { if (room() <= 0) return; gen(i + 1, [...acc, o]); }
      };
      gen(0, []);
    }
  }
  const generated = out.length;
  return {
    combinations: out, opportunities: assemblyOpportunities, generated, total, bound,
    truncated: total > generated, notGenerated: total - generated,
  };
}

/** @param {any} a @param {any} b @returns {[number, number, number, number]} */
function bbox2(a, b) {
  const p = bboxOf(a.geometry), q = bboxOf(b.geometry);
  return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[2], q[2]), Math.max(p[3], q[3])];
}

/** Shared-edge test on simple polygons: two parcels are adjacent if they share an edge (same two vertices, either order). @param {any[]} parcels @returns {[string, string][]} */
export function sharedEdgePairs(parcels) {
  /** @type {Map<string, string[]>} */ const edges = new Map();
  for (const p of parcels) {
    const g = p && p.ref && p.ref.geometry;
    if (!g || g.type !== 'Polygon') continue;
    const ring = g.coordinates[0];
    for (let i = 1; i < ring.length; i++) {
      const u = ring[i - 1].join(','), v = ring[i].join(',');
      const k = u < v ? `${u}|${v}` : `${v}|${u}`;
      const l = edges.get(k);
      if (l) { if (!l.includes(p.ref.id)) l.push(p.ref.id); } else edges.set(k, [p.ref.id]);
    }
  }
  /** @type {Set<string>} */ const seen = new Set();
  /** @type {[string, string][]} */ const out = [];
  for (const ids of edges.values()) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
      if (!seen.has(a + '\u0000' + b)) { seen.add(a + '\u0000' + b); out.push([a, b]); }
    }
  }
  return out;
}
