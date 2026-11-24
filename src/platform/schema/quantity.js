// @ts-check
// Quantity: every number in the platform. No defaults, no real-world values live here.

/** @typedef {'verified'|'estimated'|'assumed'|'unavailable'|'requires_investigation'} QuantityStatus */
/** @typedef {{ title: string, url: string, retrieved: string, quote?: string }} Source */
/**
 * @typedef {Object} Quantity
 * @property {number|null} value
 * @property {string} unit
 * @property {number|null} low
 * @property {number|null} high
 * @property {QuantityStatus} status
 * @property {Source|null} source
 * @property {string|null} jurisdiction
 * @property {string|null} effectiveDate
 * @property {readonly string[]} inputs
 * @property {readonly string[]} assumptions
 * @property {string} method   reason when value is null, else how the value was obtained
 * @property {string} [label]
 */

/** Strongest to weakest. */
export const QUANTITY_STATUSES = Object.freeze(['verified', 'estimated', 'assumed', 'unavailable', 'requires_investigation']);
const NON_NULL_STATUSES = ['verified', 'estimated', 'assumed'];
const NULL_STATUSES = ['unavailable', 'requires_investigation'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** @param {any} s */
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
/** @param {any} n */
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
/** @param {any} s */
function sourceOk(s) {
  return !!s && typeof s === 'object' && nonEmpty(s.title) && nonEmpty(s.url) && nonEmpty(s.retrieved);
}
/** @param {string[]} arr */
const uniq = (arr) => [...new Set(arr)];

/** @param {any} x @returns {x is Quantity} */
export function isQuantity(x) {
  if (!x || typeof x !== 'object') return false;
  if (!QUANTITY_STATUSES.includes(x.status)) return false;
  if (!Array.isArray(x.inputs) || !Array.isArray(x.assumptions) || typeof x.method !== 'string') return false;
  if (typeof x.unit !== 'string') return false;
  if (x.value === null) {
    return x.low === null && x.high === null && NULL_STATUSES.includes(x.status) && nonEmpty(x.method);
  }
  if (!finite(x.value) || !finite(x.low) || !finite(x.high)) return false;
  if (!(x.low <= x.value && x.value <= x.high)) return false;
  if (!nonEmpty(x.unit) || !nonEmpty(x.jurisdiction) || !nonEmpty(x.effectiveDate) || !DATE_RE.test(x.effectiveDate)) return false;
  if (!NON_NULL_STATUSES.includes(x.status)) return false;
  return sourceOk(x.source) || x.assumptions.length > 0 || x.inputs.length > 0;
}

/**
 * Build a Quantity that carries a number. Throws unless fully specified.
 * @param {{ value: number|null, unit: string, low: number, high: number, status?: QuantityStatus, source?: Source|null,
 *   jurisdiction: string, effectiveDate: string, inputs?: string[], assumptions?: string[], method?: string, label?: string }} spec
 * @returns {Quantity}
 */
export function makeQuantity(spec) {
  if (!spec || typeof spec !== 'object') throw new TypeError('makeQuantity: spec object required');
  if (spec.value === null || spec.value === undefined) {
    if (spec.status && NULL_STATUSES.includes(spec.status)) {
      return unknownQuantity(spec.unit, spec.method || '', { status: /** @type {any} */ (spec.status) });
    }
    throw new Error('makeQuantity: null value requires status unavailable or requires_investigation (use unknownQuantity)');
  }
  const errs = [];
  if (!finite(spec.value)) errs.push('value must be a finite number');
  if (!nonEmpty(spec.unit)) errs.push('unit required');
  if (!finite(spec.low) || !finite(spec.high)) errs.push('low and high required');
  else if (finite(spec.value) && !(spec.low <= spec.value && spec.value <= spec.high)) errs.push('need low <= value <= high');
  if (!nonEmpty(spec.jurisdiction)) errs.push('jurisdiction required');
  if (!nonEmpty(spec.effectiveDate) || !DATE_RE.test(spec.effectiveDate)) errs.push('effectiveDate (YYYY-MM-DD) required');
  const assumptions = Array.isArray(spec.assumptions) ? spec.assumptions.filter(nonEmpty) : [];
  const hasSource = sourceOk(spec.source);
  const status = spec.status ?? (hasSource ? 'verified' : 'assumed');
  if (!NON_NULL_STATUSES.includes(status)) errs.push('status for a number must be verified, estimated or assumed');
  if (!hasSource && !(assumptions.length > 0 && status === 'assumed')) {
    errs.push('needs a source (title, url, retrieved) or non-empty assumptions with status assumed');
  }
  if (status === 'verified' && !hasSource) errs.push('verified requires a source');
  if (status === 'assumed' && assumptions.length === 0) errs.push('assumed requires non-empty assumptions');
  if (errs.length) throw new Error('makeQuantity: ' + errs.join('; '));
  return Object.freeze({
    value: spec.value, unit: spec.unit, low: spec.low, high: spec.high, status,
    source: hasSource ? Object.freeze({ ...(/** @type {Source} */ (spec.source)) }) : null,
    jurisdiction: spec.jurisdiction, effectiveDate: spec.effectiveDate,
    inputs: Object.freeze([...(spec.inputs || [])]), assumptions: Object.freeze(assumptions),
    method: spec.method || '', ...(spec.label ? { label: spec.label } : {}),
  });
}

/**
 * The null form. The reason goes in `method`.
 * @param {string} unit
 * @param {string} reason
 * @param {{ status?: 'unavailable'|'requires_investigation', inputs?: string[], assumptions?: string[] }} [opts]
 * @returns {Quantity}
 */
export function unknownQuantity(unit, reason, opts = {}) {
  const status = opts.status ?? 'requires_investigation';
  if (!NULL_STATUSES.includes(status)) throw new Error('unknownQuantity: status must be unavailable or requires_investigation');
  if (!nonEmpty(reason)) throw new Error('unknownQuantity: a reason is required');
  return Object.freeze({
    value: null, unit: typeof unit === 'string' ? unit : '', low: null, high: null, status, source: null,
    jurisdiction: null, effectiveDate: null,
    inputs: Object.freeze([...(opts.inputs || [])]), assumptions: Object.freeze([...(opts.assumptions || [])]),
    method: reason,
  });
}

/**
 * Weakest of the given statuses (verified strongest, requires_investigation weakest).
 * @param {QuantityStatus[]} statuses @returns {QuantityStatus}
 */
export function weakestStatus(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) throw new Error('weakestStatus: at least one status required');
  let idx = 0;
  for (const s of statuses) {
    const i = QUANTITY_STATUSES.indexOf(s);
    if (i < 0) throw new Error('weakestStatus: unknown status ' + s);
    if (i > idx) idx = i;
  }
  return /** @type {QuantityStatus} */ (QUANTITY_STATUSES[idx]);
}

/** @param {any} q */
function assertQ(q, name = 'operand') {
  if (!isQuantity(q)) throw new TypeError(`${name} is not a valid Quantity`);
}

/** @param {Quantity} q */
function refs(q) {
  if (q.inputs.length > 0) return [...q.inputs];
  const r = q.label || (q.source && q.source.title) || q.method || q.unit;
  return r ? [r] : [];
}

/** @param {string} unit @param {Quantity[]} ops @param {string} op */
function unknownFrom(unit, ops, op) {
  const bad = ops.filter((q) => q.value === null);
  const status = bad.some((q) => q.status === 'requires_investigation') ? 'requires_investigation' : 'unavailable';
  return unknownQuantity(unit, `${op}: unknown operand (${bad.map((b) => b.method).join('; ')})`, {
    status, inputs: uniq(ops.flatMap(refs)), assumptions: uniq(ops.flatMap((q) => q.assumptions)),
  });
}

/** @param {string} unit @param {number} value @param {number} low @param {number} high @param {Quantity[]} ops @param {string} method @returns {Quantity} */
function derive(unit, value, low, high, ops, method) {
  const weakest = weakestStatus(ops.map((q) => q.status));
  const status = weakest === 'verified' ? 'estimated' : weakest; // computed from verified inputs is estimated
  const juris = uniq(ops.map((q) => /** @type {string} */ (q.jurisdiction)));
  const dates = ops.map((q) => /** @type {string} */ (q.effectiveDate)).sort();
  return Object.freeze({
    value, unit, low: Math.min(low, value), high: Math.max(high, value), status, source: null,
    jurisdiction: juris.length === 1 ? juris[0] : 'mixed', effectiveDate: dates[0],
    inputs: Object.freeze(uniq(ops.flatMap(refs))), assumptions: Object.freeze(uniq(ops.flatMap((q) => q.assumptions))),
    method,
  });
}

/** @param {Quantity} a @param {Quantity} b @returns {Quantity} */
export function addQ(a, b) {
  assertQ(a, 'addQ a'); assertQ(b, 'addQ b');
  if (a.unit !== b.unit) throw new Error(`addQ: incompatible units ${a.unit} and ${b.unit}`);
  if (a.value === null || b.value === null) return unknownFrom(a.unit, [a, b], 'addQ');
  return derive(a.unit, a.value + b.value, /** @type {number} */ (a.low) + /** @type {number} */ (b.low),
    /** @type {number} */ (a.high) + /** @type {number} */ (b.high), [a, b], 'addQ (interval sum)');
}

/** @param {Quantity} a @param {Quantity} b @returns {Quantity} */
export function subQ(a, b) {
  assertQ(a, 'subQ a'); assertQ(b, 'subQ b');
  if (a.unit !== b.unit) throw new Error(`subQ: incompatible units ${a.unit} and ${b.unit}`);
  if (a.value === null || b.value === null) return unknownFrom(a.unit, [a, b], 'subQ');
  return derive(a.unit, a.value - b.value, /** @type {number} */ (a.low) - /** @type {number} */ (b.high),
    /** @type {number} */ (a.high) - /** @type {number} */ (b.low), [a, b], 'subQ (interval difference)');
}

const DIMENSIONLESS = ['1', 'ratio', 'dimensionless'];

/** @param {Quantity} a @param {Quantity} b @returns {Quantity} */
export function mulQ(a, b) {
  assertQ(a, 'mulQ a'); assertQ(b, 'mulQ b');
  const unit = DIMENSIONLESS.includes(a.unit) ? b.unit : DIMENSIONLESS.includes(b.unit) ? a.unit : `${a.unit}*${b.unit}`;
  if (a.value === null || b.value === null) return unknownFrom(unit, [a, b], 'mulQ');
  const al = /** @type {number} */ (a.low), ah = /** @type {number} */ (a.high);
  const bl = /** @type {number} */ (b.low), bh = /** @type {number} */ (b.high);
  const p = [al * bl, al * bh, ah * bl, ah * bh];
  return derive(unit, a.value * b.value, Math.min(...p), Math.max(...p), [a, b], 'mulQ (interval product)');
}

/** Multiply by a plain scalar (negative scalars swap the bounds). @param {Quantity} q @param {number} k @returns {Quantity} */
export function scaleQ(q, k) {
  assertQ(q, 'scaleQ q');
  if (!finite(k)) throw new TypeError('scaleQ: factor must be a finite number');
  if (q.value === null) return unknownFrom(q.unit, [q], 'scaleQ');
  const l = /** @type {number} */ (q.low) * k, h = /** @type {number} */ (q.high) * k;
  return derive(q.unit, q.value * k, Math.min(l, h), Math.max(l, h), [q], 'scaleQ (interval scaled)');
}
