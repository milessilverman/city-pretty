// @ts-check
// Quality-of-life index. Never converts quality of life into dollars; unknown is never scored as zero or average.
import { QOL_DIMENSIONS } from './dimensions.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {{ low: Quantity, high: Quantity }} ReferenceRange  reference range with sources; low < high in value */

/** @param {any} n */
const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/**
 * @param {Quantity} q @param {'higher_is_better'|'lower_is_better'} direction @param {ReferenceRange} ref
 * @returns {{ score: number, clamped: boolean }}
 */
function normalise(q, direction, ref) {
  const lo = ref.low.value, hi = ref.high.value;
  const v = /** @type {number} */ (q.value);
  const raw = direction === 'higher_is_better' ? (v - /** @type {number} */ (lo)) / (/** @type {number} */ (hi) - /** @type {number} */ (lo))
    : (/** @type {number} */ (hi) - v) / (/** @type {number} */ (hi) - /** @type {number} */ (lo));
  const score = Math.min(1, Math.max(0, raw));
  return { score, clamped: score !== raw };
}

/** @param {string} id @param {any} ref */
function checkRef(id, ref) {
  if (!ref || !ref.low || !ref.high) throw new Error(`reference for ${id} needs low and high Quantities`);
  for (const k of ['low', 'high']) {
    const r = ref[k];
    if (!finite(r.value) || !r.source) throw new Error(`reference.${id}.${k} needs a numeric value and a source`);
  }
  if (ref.low.unit !== ref.high.unit) throw new Error(`reference.${id} low and high units differ`);
  if (!(ref.low.value < ref.high.value)) throw new Error(`reference.${id} needs low < high`);
}

/**
 * @param {{ indicators: Record<string, Quantity>, weights: Record<string, number>, reference: Record<string, ReferenceRange>,
 *   baseline?: Record<string, Quantity> }} args  baseline (optional) is the before-state, used only to list tradeoffs.
 */
export function scoreQualityOfLife({ indicators, weights, reference, baseline }) {
  const ind = indicators || {}, w = weights || {}, refs = reference || {};
  let totalWeight = 0;
  for (const dim of QOL_DIMENSIONS) {
    const x = w[dim.id];
    if (!finite(x) || x < 0) throw new Error(`weights.${dim.id} must be a finite non-negative number`);
    totalWeight += x;
  }
  if (!(totalWeight > 0)) throw new Error('weights must not all be zero');

  /** @param {string} id @param {Quantity|undefined} q @param {any} dir */
  const scoreOne = (id, q, dir) => {
    if (!q || q.value === null || q.value === undefined) return null;
    checkRef(id, refs[id]);
    if (q.unit !== refs[id].low.unit) throw new Error(`indicator ${id} unit ${q.unit} differs from reference unit ${refs[id].low.unit}`);
    return normalise(q, dir, refs[id]);
  };

  const results = [];
  const unknown = [];
  const tradeoffs = [];
  let covered = 0, weighted = 0;
  for (const dim of QOL_DIMENSIONS) {
    const q = ind[dim.id];
    const s = scoreOne(dim.id, q, dim.direction);
    if (!s) {
      unknown.push(dim.id);
      results.push({ dimension: dim.id, status: 'unknown', score: null, weight: w[dim.id], reason: q ? q.method : 'no indicator supplied' });
      continue;
    }
    covered += w[dim.id];
    weighted += w[dim.id] * s.score;
    const base = baseline ? scoreOne(dim.id, baseline[dim.id], dim.direction) : null;
    const worsens = !!base && s.score < base.score;
    if (worsens) tradeoffs.push(dim.id);
    results.push({ dimension: dim.id, status: 'scored', score: s.score, weight: w[dim.id], clamped: s.clamped, baselineScore: base ? base.score : null, worsens });
  }
  return {
    results, unknown, tradeoffs,
    index: covered > 0 ? weighted / covered : null,
    coverage: covered / totalWeight,
  };
}

/**
 * Side-by-side only. Quality of life is never converted to dollars.
 * @param {{ qol: ReturnType<typeof scoreQualityOfLife>, financial: any }} args
 */
export function compareWithReturns({ qol, financial }) {
  return {
    qualityOfLife: { index: qol.index, coverage: qol.coverage, unknown: qol.unknown, tradeoffs: qol.tradeoffs },
    financial,
    convertedToDollars: false,
    note: 'Quality of life and financial returns are shown side by side and are not combined or converted into dollars.',
  };
}
