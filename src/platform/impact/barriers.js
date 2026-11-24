// @ts-check
// Barriers (freeway, rail, wall, water) cut street edges that geometrically cross them, unless the edge is flagged
// as a crossing/bridge/tunnel or a caller-supplied crossing point lies near the intersection.
import { haversineM } from '../schema/geo.js';
import { withoutEdges } from './graph.js';

/** @typedef {import('./graph.js').Graph} Graph */
/** @typedef {[number, number]} Position */

/** @param {Position} a @param {Position} b @param {Position} c */
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
/** @param {number} v */
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
/** @param {Position} a @param {Position} b @param {Position} c collinear point c lies within box of a-b */
const within = (a, b, c) => Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);

/**
 * Do segments p1-p2 and q1-q2 intersect (touching counts)? Returns the intersection point or null.
 * @param {Position} p1 @param {Position} p2 @param {Position} q1 @param {Position} q2 @returns {Position|null}
 */
export function segmentIntersection(p1, p2, q1, q2) {
  const o1 = sgn(orient(p1, p2, q1)), o2 = sgn(orient(p1, p2, q2));
  const o3 = sgn(orient(q1, q2, p1)), o4 = sgn(orient(q1, q2, p2));
  if (o1 !== o2 && o3 !== o4) {
    const d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0]);
    if (d === 0) return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const t = ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  }
  if (o1 === 0 && within(p1, p2, q1)) return q1;
  if (o2 === 0 && within(p1, p2, q2)) return q2;
  if (o3 === 0 && within(q1, q2, p1)) return p1;
  if (o4 === 0 && within(q1, q2, p2)) return p2;
  return null;
}

/** @param {any} f @returns {Position[][]} polylines (polygon rings count as lines) */
function polylines(f) {
  const g = f && f.geometry;
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString' || g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  return [];
}

/**
 * @param {Graph} graph
 * @param {any[]} barrierFeatures GeoJSON features (LineString, MultiLineString, Polygon boundaries)
 * @param {{ position: Position, toleranceM: number }[]} [crossings] caller-supplied crossing points; an edge whose
 *   intersection with a barrier lies within toleranceM of one is kept
 * @returns {{ graph: Graph, cutEdges: { edgeId: number, featureId: string|null, barrierId: string, at: Position }[] }}
 */
export function applyBarriers(graph, barrierFeatures, crossings = []) {
  /** @type {{ minX: number, minY: number, maxX: number, maxY: number, a: Position, b: Position, id: string }[]} */
  const segs = [];
  (barrierFeatures || []).forEach((f, i) => {
    const id = f && f.id !== undefined ? String(f.id) : f && f.properties && f.properties.id !== undefined ? String(f.properties.id) : String(i);
    for (const line of polylines(f)) for (let j = 1; j < line.length; j++) {
      const a = line[j - 1], b = line[j];
      segs.push({ minX: Math.min(a[0], b[0]), minY: Math.min(a[1], b[1]), maxX: Math.max(a[0], b[0]), maxY: Math.max(a[1], b[1]), a, b, id });
    }
  });
  const cuts = [];
  const removed = new Set();
  for (const e of graph.edges) {
    if (e.crossing) continue;
    const [p, q] = e.segment;
    const eMinX = Math.min(p[0], q[0]), eMaxX = Math.max(p[0], q[0]), eMinY = Math.min(p[1], q[1]), eMaxY = Math.max(p[1], q[1]);
    for (const s of segs) {
      if (s.maxX < eMinX || s.minX > eMaxX || s.maxY < eMinY || s.minY > eMaxY) continue;
      const at = segmentIntersection(p, q, s.a, s.b);
      if (!at) continue;
      if (crossings.some((c) => haversineM(c.position, at) <= c.toleranceM)) continue;
      removed.add(e.id);
      cuts.push({ edgeId: e.id, featureId: e.featureId, barrierId: s.id, at });
      break;
    }
  }
  return { graph: withoutEdges(graph, removed), cutEdges: cuts };
}
