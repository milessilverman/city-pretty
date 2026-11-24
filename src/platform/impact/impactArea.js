// @ts-check
// Impact area of one improvement: network distance (or labelled straight-line fallback), decay weight, sign, barriers.
import { centroidOf, haversineM } from '../schema/geo.js';
import { applyBarriers } from './barriers.js';
import { dijkstra, nearestNode } from './graph.js';
import { toMetres, validateImpactModel } from './models.js';

/** @typedef {import('../schema/geo.js').GeoRef} GeoRef */
/** @typedef {import('./graph.js').Graph} Graph */
/** @typedef {import('./models.js').ImpactModel} ImpactModel */
/** @typedef {import('./models.js').ImpactLayerModel} ImpactLayerModel */
/** @typedef {{ features: any[], crossings?: { position: [number, number], toleranceM: number }[] }} Barriers */

/** @type {WeakMap<Graph, WeakMap<object, { graph: Graph, cutEdges: any[] }>>} */
const barrierCache = new WeakMap();
/** @type {WeakMap<Graph, WeakMap<object, { node: number, offsetM: number }|null>>} */
const accessCache = new WeakMap();

/** @param {Graph} graph @param {Barriers} barriers */
function cutGraph(graph, barriers) {
  let m = barrierCache.get(graph);
  if (!m) { m = new WeakMap(); barrierCache.set(graph, m); }
  let r = m.get(barriers);
  if (!r) { r = applyBarriers(graph, barriers.features, barriers.crossings || []); m.set(barriers, r); }
  return r;
}

/** @param {Graph} graph @param {GeoRef} receptor */
function accessOf(graph, receptor) {
  let m = accessCache.get(graph);
  if (!m) { m = new WeakMap(); accessCache.set(graph, m); }
  if (m.has(receptor)) return m.get(receptor);
  const n = nearestNode(graph, centroidOf(receptor.geometry));
  const r = n ? { node: n.node, offsetM: n.distanceM } : null;
  m.set(receptor, r);
  return r;
}

/** @param {readonly GeoRef[]} receptors */
export function resolutionOf(receptors) {
  if (receptors.length && receptors.every((r) => r.kind === 'parcel')) return 'parcel';
  if (receptors.length && receptors.every((r) => r.kind === 'street_segment')) return 'street_segment';
  return 'area';
}

/** @param {GeoRef} g @returns {[number, number][]} */
function pointsOf(g) {
  const geo = g.geometry;
  if (geo.type === 'Point') return [geo.coordinates];
  if (geo.type === 'LineString') return geo.coordinates;
  return geo.coordinates[0].slice(0, -1);
}

/** @param {ImpactLayerModel} layer @param {number} d @param {number} reachM @returns {number|null} null = outside */
function weightAt(layer, d, reachM) {
  if (d > reachM) return null;
  const dec = layer.decay;
  if (dec.form === 'linear') return 1 - d / reachM;
  if (dec.form === 'exponential') return Math.exp(-d / toMetres(dec.parameters.lengthScale));
  if (dec.bands) {
    const sorted = [...dec.bands].sort((a, b) => toMetres(a.outer) - toMetres(b.outer));
    for (const b of sorted) if (d <= toMetres(b.outer)) return /** @type {number} */ (b.weight.value);
    return null;
  }
  return 1; // single uniform band out to reach
}

const CONF = ['low', 'medium', 'high'];
/** @param {string} c */
const lower = (c) => CONF[Math.max(0, CONF.indexOf(c) - 1)];

/**
 * @param {{ improvement: { id: string, categoryId: string, location: GeoRef, impactModelId?: string|null },
 *   model: ImpactModel|null|undefined, graph: Graph|null, receptors: readonly GeoRef[], barriers?: Barriers|null, asOf: string,
 *   maxAccessM?: number }} input
 */
export function computeImpactArea({ improvement, model, graph, receptors, barriers, asOf, maxAccessM }) {
  if (!improvement || !improvement.id || !improvement.location) throw new TypeError('computeImpactArea: improvement {id, categoryId, location} required');
  if (typeof asOf !== 'string' || !asOf) throw new TypeError('computeImpactArea: asOf required');
  for (const r of receptors) if (r.kind === 'block_group') throw new Error('computeImpactArea: block groups are demographic inputs only and cannot be impact receptors');
  const resolution = resolutionOf(receptors);
  /** @param {string} reason @param {string[]} [extra] */
  const needsInvestigation = (reason, extra = []) => ({
    status: /** @type {'requires_investigation'} */ ('requires_investigation'), improvementId: improvement.id, categoryId: improvement.categoryId,
    modelId: null, missingModelId: improvement.impactModelId ?? null, reason, cells: [], negativeLayers: [], excludedByBarrier: [], unreachable: [],
    resolution, confidence: /** @type {'unknown'} */ ('unknown'), confidenceReasons: [reason], notes: [reason, ...extra], asOf,
  });
  if (!model) return needsInvestigation(`no impact model for category '${improvement.categoryId}'${improvement.impactModelId ? ` (expected ${improvement.impactModelId})` : ''}; no default radius is applied`);
  const v = validateImpactModel(model);
  if (!v.valid) return needsInvestigation(`impact model '${model.id}' is invalid: ${v.errors.join('; ')}`);
  if (!model.categoryIds.includes(improvement.categoryId)) return needsInvestigation(`model '${model.id}' does not list category '${improvement.categoryId}'`);

  /** @type {string[]} */ const notes = [];
  const layers = [model, ...model.negativeEffects];
  const reachM = layers.map((l) => toMetres(l.reach));
  const maxReach = Math.max(...reachM);
  const srcPoints = pointsOf(improvement.location);
  const recPoints = receptors.map((r) => centroidOf(r.geometry));
  const straight = recPoints.map((p) => Math.min(...srcPoints.map((s) => haversineM(s, p))));

  /** @type {Graph|null} */ let eff = null;
  /** @type {any[]} */ let cutEdges = [];
  if (graph) {
    eff = graph;
    if (barriers && barriers.features && barriers.features.length) {
      const c = cutGraph(graph, barriers); eff = c.graph; cutEdges = c.cutEdges;
      notes.push(`${cutEdges.length} street edge(s) cut by barriers`);
    }
  } else {
    notes.push('no street network supplied: distances are straight-line fallback' + (barriers && barriers.features && barriers.features.length ? ' and barriers could not be applied' : ''));
  }
  const accessLimit = maxAccessM;
  /** @param {Graph} g */
  const netDist = (g) => {
    const src = [];
    for (const s of srcPoints) { const n = nearestNode(g, s); if (n && (accessLimit === undefined || n.distanceM <= accessLimit)) src.push({ node: n.node, offsetM: n.distanceM }); }
    return dijkstra(g, src, maxReach);
  };
  const dist = eff ? netDist(eff) : null;
  /** @type {Float64Array|undefined} */ let uncut;
  /** @type {boolean} */ let anyFallback = !graph;
  /** @param {number} i @returns {{ d: number, kind: 'network'|'straight_line_fallback' }} d may be Infinity */
  const distanceFor = (i) => {
    if (!eff || !dist) return { d: straight[i], kind: 'straight_line_fallback' };
    const a = accessOf(eff, receptors[i]);
    if (!a || (accessLimit !== undefined && a.offsetM > accessLimit)) { anyFallback = true; return { d: straight[i], kind: 'straight_line_fallback' }; }
    return { d: dist[a.node] + a.offsetM, kind: 'network' };
  };
  /** @param {number} i */
  const uncutDistance = (i) => {
    if (!graph) return Infinity;
    if (uncut === undefined) uncut = netDist(graph);
    const a = accessOf(graph, receptors[i]);
    return a ? uncut[a.node] + a.offsetM : Infinity;
  };

  /** @type {any[]} */ const outLayers = [];
  const excluded = [], unreachable = [];
  layers.forEach((layer, li) => {
    const cells = [];
    receptors.forEach((ref, i) => {
      const { d, kind } = distanceFor(i);
      const w = Number.isFinite(d) ? weightAt(layer, d, reachM[li]) : null;
      if (w !== null) { cells.push({ ref, distanceM: d, distanceKind: kind, weight: w, sign: layer.sign, target: layer.target, modelId: layer.id }); return; }
      if (kind === 'network' && straight[i] <= reachM[li]) {
        if (cutEdges.length && uncutDistance(i) <= reachM[li]) {
          excluded.push({ ref, layerId: layer.id, straightLineM: straight[i], reason: 'reachable only across a barrier or by a detour beyond reach' });
        } else if (!Number.isFinite(d)) unreachable.push({ ref, layerId: layer.id, straightLineM: straight[i], reason: 'no network path within reach' });
      }
    });
    outLayers.push({ modelId: layer.id, target: layer.target, sign: layer.sign, magnitude: layer.magnitude, cells });
  });

  const base = model.magnitude.status === 'verified' && model.reach.status === 'verified' ? 'high' : 'medium';
  /** @type {string[]} */ const reasons = [`model '${model.id}': ${model.distanceBasis} distance in the cited study`];
  let confidence = base;
  if (model.verification && model.verification.status && model.verification.status !== 'verified_in_fetched_text') { confidence = lower(confidence); reasons.push(`model verification: ${model.verification.status}`); }
  if (anyFallback) { confidence = lower(confidence); reasons.push('straight-line fallback used for some or all receptors'); }
  if (model.distanceBasis !== 'network' && graph) notes.push(`study distance basis is '${model.distanceBasis}'; network distances applied to it`);
  if (model.distanceBasis === 'network' && !graph) notes.push('model is defined on network distance; straight-line fallback overstates reach');

  const [primary, ...negativeLayers] = outLayers;
  return {
    status: /** @type {'ok'} */ ('ok'), improvementId: improvement.id, categoryId: improvement.categoryId, modelId: model.id, missingModelId: null,
    target: model.target, sign: model.sign, magnitude: model.magnitude, cells: primary.cells, negativeLayers, excludedByBarrier: excluded, unreachable,
    cutEdgeCount: cutEdges.length, resolution, confidence, confidenceReasons: reasons, notes, asOf,
  };
}
