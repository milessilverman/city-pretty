// @ts-check
// Pair interactions between opportunities: explicit, sourced records; absence is reported, never read as zero.
import { isQuantity, addQ, mulQ, scaleQ } from '../schema/quantity.js';
import { VALUE_STREAM_KEYS } from '../schema/opportunity.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/**
 * @typedef {Object} Interaction
 * @property {string} id
 * @property {string} a
 * @property {string} b
 * @property {string} type
 * @property {'positive'|'negative'} sign
 * @property {string|null} effectOn  a value stream key, 'cost', or null for hard constraints
 * @property {Quantity} magnitude    ratio (applied to the two items' amounts) or currency; for hard types the limit
 * @property {string} basis
 * @property {string|null} resource  hard types only
 */

export const SYNERGY_TYPES = Object.freeze({
  positive: Object.freeze(['demand', 'financial', 'construction', 'network', 'environmental', 'development', 'shared_infrastructure']),
  negative: Object.freeze(['competition', 'overlap', 'congestion', 'land_limit', 'capacity_limit']),
});
/** Hard constraints: the magnitude is a limit, not an adjustment. */
export const HARD_TYPES = Object.freeze(['land_limit', 'capacity_limit']);
const RATIO_UNITS = ['1', 'ratio', 'dimensionless'];
const nonEmpty = (/** @type {any} */ s) => typeof s === 'string' && s.trim().length > 0;

/**
 * Build an interaction. Throws unless it has a sourced magnitude and a basis.
 * @param {{ a: string, b: string, type: string, sign: 'positive'|'negative', effectOn?: string|null, magnitude: Quantity,
 *   basis: string, resource?: string }} spec
 * @returns {Readonly<Interaction>}
 */
export function makeInteraction(spec) {
  const errs = [];
  if (!spec || typeof spec !== 'object') throw new TypeError('makeInteraction: spec required');
  if (!nonEmpty(spec.a) || !nonEmpty(spec.b)) errs.push('a and b required');
  const polarity = SYNERGY_TYPES.positive.includes(spec.type) ? 'positive' : SYNERGY_TYPES.negative.includes(spec.type) ? 'negative' : null;
  if (!polarity) errs.push(`unknown type ${spec.type}`);
  else if (spec.sign !== polarity) errs.push(`type ${spec.type} is ${polarity}, sign given ${spec.sign}`);
  const hard = HARD_TYPES.includes(spec.type);
  let effectOn = spec.effectOn ?? null;
  if (hard) {
    if (!nonEmpty(spec.resource)) errs.push('hard constraint needs a resource name');
    effectOn = null;
  } else if (!(effectOn === 'cost' || VALUE_STREAM_KEYS.includes(/** @type {any} */ (effectOn)))) {
    errs.push('effectOn must be exactly one of the seven value streams or cost');
  }
  const m = spec.magnitude;
  if (!isQuantity(m) || m.value === null) errs.push('magnitude must be a known Quantity');
  else {
    if (!m.source || !nonEmpty(m.source.title) || !nonEmpty(m.source.url) || !nonEmpty(m.source.retrieved)) errs.push('magnitude needs a source (no source, no interaction)');
    if (/** @type {number} */ (m.value) < 0) errs.push('magnitude must be >= 0; direction is carried by sign');
  }
  if (!nonEmpty(spec.basis)) errs.push('basis required');
  if (errs.length) throw new Error('makeInteraction: ' + errs.join('; '));
  return Object.freeze({ id: `${spec.type}:${spec.a}|${spec.b}:${effectOn ?? spec.resource}`, a: spec.a, b: spec.b, type: spec.type,
    sign: /** @type {'positive'|'negative'} */ (spec.sign), effectOn, magnitude: m, basis: spec.basis, resource: hard ? /** @type {string} */ (spec.resource) : null });
}

/** @param {any} v @returns {Quantity|null} */
const amountOf = (v) => (v && v.amount ? v.amount : v || null);

/** @param {Quantity[]} qs */
function foldAdd(qs) {
  let acc = qs[0];
  for (let i = 1; i < qs.length; i++) acc = addQ(acc, qs[i]);
  return acc;
}

/** @param {Quantity} q @param {number} value @param {number} low @param {number} high @param {string} method @returns {Quantity} */
function withNumbers(q, value, low, high, method) {
  return Object.freeze({ ...q, value, low, high, method: `${q.method}; ${method}` });
}

/**
 * @param {{ id: string, categoryId?: string, valueStreams?: Record<string, any>|null, cost?: Quantity|null, demand?: Record<string, number> }[]} items
 * @param {readonly Interaction[]} interactions
 * @param {{ guard?: Record<string, { rule: 'max'|'capped_sum'|'none', cap?: Quantity }>|null }} [opts]
 */
export function applyInteractions(items, interactions, opts = {}) {
  const guard = opts.guard || {};
  for (const [k, g] of Object.entries(guard)) {
    if (!['max', 'capped_sum', 'none'].includes(g.rule)) throw new Error(`guard ${k}: rule must be max, capped_sum or none`);
    if (g.rule === 'capped_sum' && !(isQuantity(g.cap) && g.cap.value !== null && g.cap.source)) throw new Error(`guard ${k}: capped_sum needs a sourced cap Quantity`);
  }
  const ids = items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) throw new Error('applyInteractions: duplicate item ids');
  const keys = (/** @type {any} */ it) => [it.id, it.categoryId].filter(nonEmpty);
  const matches = (/** @type {Interaction} */ x, /** @type {any} */ p, /** @type {any} */ q) =>
    (keys(p).includes(x.a) && keys(q).includes(x.b)) || (keys(p).includes(x.b) && keys(q).includes(x.a));

  const pairs = [];
  const notAssessed = [];
  const infeasible = [];
  /** @type {Record<string, Quantity[]>} */ const adjByKey = {};
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const p = items[i], q = items[j];
      const found = interactions.filter((x) => matches(x, p, q));
      if (found.length === 0) { notAssessed.push({ a: p.id, b: q.id, status: 'not assessed: no interaction record (this is not a finding of no synergy)' }); continue; }
      const adjustments = [];
      for (const x of found) {
        if (x.resource) {
          const da = p.demand?.[x.resource], db = q.demand?.[x.resource];
          const lim = /** @type {number} */ (x.magnitude.value);
          if (typeof da !== 'number' || typeof db !== 'number') {
            adjustments.push({ interactionId: x.id, type: x.type, sign: x.sign, effectOn: null, adjustment: null, hard: 'unknown: demand missing for ' + x.resource });
          } else {
            const over = da + db > lim;
            adjustments.push({ interactionId: x.id, type: x.type, sign: x.sign, effectOn: null, adjustment: null, hard: over ? 'infeasible' : 'within limit' });
            if (over) infeasible.push({ a: p.id, b: q.id, type: x.type, resource: x.resource, demand: da + db, limit: lim });
          }
          continue;
        }
        const eff = /** @type {string} */ (x.effectOn);
        const get = (/** @type {any} */ it) => (eff === 'cost' ? it.cost || null : amountOf(it.valueStreams?.[eff]));
        const ba = get(p), bb = get(q);
        /** @type {Quantity|null} */ let adj = null;
        let note = '';
        if (!ba || !bb) note = `${eff} amount missing on ${!ba ? p.id : q.id}`;
        else if (ba.value === null || bb.value === null) note = `${eff} amount unknown`;
        else {
          const mag = x.magnitude;
          if (RATIO_UNITS.includes(mag.unit)) adj = mulQ(mag, addQ(ba, bb));
          else if (mag.unit === ba.unit) adj = mag;
          else throw new Error(`applyInteractions: ${x.id} magnitude unit ${mag.unit} does not match ${eff} unit ${ba.unit}`);
          const toward = eff === 'cost' ? (x.sign === 'positive' ? -1 : 1) : (x.sign === 'positive' ? 1 : -1);
          adj = scaleQ(adj, toward);
        }
        adjustments.push({ interactionId: x.id, type: x.type, sign: x.sign, effectOn: eff, adjustment: adj, note: note || undefined });
        if (adj) (adjByKey[eff] ||= []).push(adj); else (adjByKey[eff] ||= []).push(/** @type {any} */ (null));
      }
      pairs.push({ a: p.id, b: q.id, adjustments });
    }
  }

  // Roll up per stream (never across streams), then apply the double-counting guard.
  /** @type {Record<string, any>} */ const byStream = {};
  const streamKeys = [...VALUE_STREAM_KEYS, 'cost'].filter((k) => adjByKey[k] || items.some((it) => (k === 'cost' ? it.cost : it.valueStreams?.[k])));
  for (const k of streamKeys) {
    const own = items.map((it) => (k === 'cost' ? it.cost : amountOf(it.valueStreams?.[k]))).filter((x) => !!x);
    const standalone = own.length ? foldAdd(/** @type {Quantity[]} */ (own)) : null;
    const adjList = adjByKey[k] || [];
    const adjUnknown = adjList.some((x) => x === null || x.value === null);
    const known = /** @type {Quantity[]} */ (adjList.filter((x) => x && x.value !== null));
    const adjustment = adjUnknown ? 'unknown' : known.length ? foldAdd(known) : null;
    /** @type {Quantity|null|'unknown'} */ let before = standalone;
    if (!standalone || standalone.value === null || adjustment === 'unknown') before = 'unknown';
    else if (adjustment) before = addQ(standalone, adjustment);
    const g = guard[k];
    let combined = before;
    /** @type {any} */ let guardInfo = { rule: g ? g.rule : 'none', cap: null, applied: false, supplied: !!g };
    if (before !== 'unknown' && before && g && g.rule !== 'none') {
      let capV, capL, capH;
      if (g.rule === 'capped_sum') { const c = /** @type {Quantity} */ (g.cap); capV = c.value; capL = c.low; capH = c.high; guardInfo.cap = c; }
      else {
        const vs = /** @type {Quantity[]} */ (own);
        if (vs.some((x) => x.value === null)) { capV = null; }
        else { capV = Math.max(...vs.map((x) => /** @type {number} */ (x.value))); capL = Math.max(...vs.map((x) => /** @type {number} */ (x.low))); capH = Math.max(...vs.map((x) => /** @type {number} */ (x.high))); }
      }
      if (capV !== null && capV !== undefined && before.value !== null) {
        const v = Math.min(before.value, capV), lo = Math.min(/** @type {number} */ (before.low), /** @type {number} */ (capL)), hi = Math.min(/** @type {number} */ (before.high), /** @type {number} */ (capH));
        guardInfo.applied = v < before.value || hi < /** @type {number} */ (before.high);
        combined = withNumbers(before, v, Math.min(lo, v), Math.max(hi, v), `double-counting guard ${g.rule}`);
      }
    }
    byStream[k] = { standalone, adjustment, beforeGuard: before, combined, guard: guardInfo };
  }
  return Object.freeze({ pairs, notAssessed, infeasible, feasible: infeasible.length === 0, byStream,
    note: 'Value streams are reported separately; no cross-stream total exists.' });
}
