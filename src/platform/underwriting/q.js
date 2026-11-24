// @ts-check
// Internal helpers shared by the underwriting engines: coherent case series built from Quantities, and a derived
// Quantity constructor. No numeric parameters live here.
import { isQuantity, unknownQuantity, weakestStatus } from '../schema/quantity.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {'point'|'low'|'high'} CaseName */
/** @typedef {{ point: number[], low: number[], high: number[] }} CaseSeries */

export const CASES = Object.freeze(/** @type {CaseName[]} */ (['point', 'low', 'high']));

/** @param {any} s */
export const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
/** @param {any} n */
export const finite = (n) => typeof n === 'number' && Number.isFinite(n);
/** @param {string[]} a */
export const uniq = (a) => [...new Set(a)];

/** A Quantity that carries a number. @param {any} q @returns {q is Quantity} */
export const known = (q) => isQuantity(q) && q.value !== null;

/** Name used in `inputs` lists. @param {Quantity} q @param {string} fallback */
export function refOf(q, fallback) {
  if (q.inputs.length > 0) return [...q.inputs];
  return [q.label || (q.source && q.source.title) || fallback];
}

/**
 * Case value of a Quantity. Low case = adverse: a benefit takes its low bound, a cost its high bound.
 * @param {Quantity} q @param {CaseName} c @param {'benefit'|'cost'} kind
 */
export function caseValue(q, c, kind) {
  if (c === 'point') return /** @type {number} */ (q.value);
  const takeLow = (c === 'low') === (kind === 'benefit');
  return /** @type {number} */ (takeLow ? q.low : q.high);
}

/**
 * A rate in each case: the adverse (low) case uses the high rate when `adverseIsHigh`.
 * @param {Quantity} r @param {CaseName} c @param {boolean} adverseIsHigh
 */
export function caseRate(r, c, adverseIsHigh) {
  return caseValue(r, c, adverseIsHigh ? 'cost' : 'benefit');
}

/**
 * Validate a schedule: every entry a known Quantity of the given length. Returns the list of missing entries.
 * @param {any} arr @param {number} n @param {string} name @returns {string[]}
 */
export function missingInSchedule(arr, n, name) {
  if (!Array.isArray(arr)) return [name];
  if (arr.length !== n) return [`${name} (length ${arr.length}, expected ${n})`];
  /** @type {string[]} */ const out = [];
  arr.forEach((q, i) => { if (!known(q)) out.push(`${name}[${i}]`); });
  return out;
}

/** @param {any} q @param {string} name @returns {string[]} */
export const missingQ = (q, name) => (known(q) ? [] : [name]);

/**
 * Coherent case series from a schedule of Quantities.
 * @param {Quantity[]} arr @param {'benefit'|'cost'} kind @returns {CaseSeries}
 */
export function seriesCases(arr, kind) {
  return {
    point: arr.map((q) => caseValue(q, 'point', kind)),
    low: arr.map((q) => caseValue(q, 'low', kind)),
    high: arr.map((q) => caseValue(q, 'high', kind)),
  };
}

/**
 * Build a derived Quantity from operands. Value = point case; low/high = min/max over the coherent cases (so the
 * interval always contains the point). Status is the weakest operand's, with verified downgraded to estimated.
 * @param {{ unit: string, point: number, low: number, high: number, from: Quantity[], method: string,
 *   assumptions?: string[], label?: string }} spec
 * @returns {Quantity}
 */
export function derived(spec) {
  const ops = spec.from.filter(known);
  if (ops.length === 0) throw new Error('derived: at least one known operand required');
  const weakest = weakestStatus(ops.map((q) => q.status));
  const status = weakest === 'verified' ? 'estimated' : weakest;
  const juris = uniq(ops.map((q) => /** @type {string} */ (q.jurisdiction)));
  let date = /** @type {string} */ (ops[0].effectiveDate);
  for (const q of ops) if (/** @type {string} */ (q.effectiveDate) < date) date = /** @type {string} */ (q.effectiveDate);
  const inputs = uniq(ops.flatMap((q) => refOf(q, q.unit)));
  const assumptions = uniq([...ops.flatMap((q) => q.assumptions), ...(spec.assumptions || [])]);
  const v = spec.point;
  return Object.freeze({
    value: v, unit: spec.unit, low: Math.min(spec.low, spec.high, v), high: Math.max(spec.low, spec.high, v),
    status, source: null, jurisdiction: juris.length === 1 ? juris[0] : 'mixed', effectiveDate: date,
    inputs: Object.freeze(inputs), assumptions: Object.freeze(assumptions), method: spec.method,
    ...(spec.label ? { label: spec.label } : {}),
  });
}

/**
 * The null form with a missing list.
 * @param {string} unit @param {string} reason @param {string[]} missing
 */
export function unknownWith(unit, reason, missing) {
  return unknownQuantity(unit, missing.length ? `${reason}: missing ${missing.join(', ')}` : reason, { inputs: missing });
}

/** @param {number} a @param {number} b */
export const sum = (a, b) => a + b;
