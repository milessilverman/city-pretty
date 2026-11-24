// @ts-check
// Value of an impact area and combination of overlapping improvements through ONE guard.
import { isQuantity, makeQuantity, mulQ, addQ, scaleQ, unknownQuantity } from '../schema/quantity.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {{ rule: 'max' }|{ rule: 'capped_sum', cap: Quantity }|{ rule: 'not_assessed' }} Guard */
/**
 * @typedef {{ receptorId: string, target: string, sign: 1|-1, layerId: string, improvementId: string, value: Quantity }} ReceptorValue
 * @typedef {{ improvementId: string, perReceptor: ReceptorValue[], unknownBase: string[], notValued: { layerId: string, reason: string }[] }} ValueEffect
 */

const PERCENT = ['percent', '%'];
const RATIO = ['ratio', '1', 'dimensionless'];

/**
 * magnitude x weight x receptor base value, as Quantities (ranges propagate). Negative layers produce negative values.
 * Receptors whose base value is missing or null are listed in unknownBase (never counted as zero).
 * @param {any} area result of computeImpactArea with status 'ok'
 * @param {Record<string, Quantity|null|undefined>|Map<string, Quantity|null|undefined>} receptorValues base value per receptor id
 * @returns {ValueEffect}
 */
export function valueEffect(area, receptorValues) {
  if (!area || area.status !== 'ok') throw new Error('valueEffect: area must be a computed impact area (status ok)');
  const get = (/** @type {string} */ id) => (receptorValues instanceof Map ? receptorValues.get(id) : receptorValues[id]);
  /** @type {ReceptorValue[]} */ const out = [];
  /** @type {Set<string>} */ const unknown = new Set();
  /** @type {{ layerId: string, reason: string }[]} */ const notValued = [];
  const layers = [{ modelId: area.modelId, target: area.target, sign: area.sign, magnitude: area.magnitude, cells: area.cells }, ...area.negativeLayers];
  for (const L of layers) {
    /** @type {Quantity} */ const m = L.magnitude;
    const k = PERCENT.includes(m.unit) ? 0.01 : RATIO.includes(m.unit) ? 1 : null;
    if (k === null || m.value === null) { notValued.push({ layerId: L.modelId, reason: `magnitude unit '${m.unit}' is not a value fraction; not converted to money` }); continue; }
    for (const c of L.cells) {
      const base = get(c.ref.id);
      if (!base || !isQuantity(base) || base.value === null) { unknown.add(c.ref.id); continue; }
      const f = c.weight * L.sign * k;
      const lo = /** @type {number} */ (m.low) * f, hi = /** @type {number} */ (m.high) * f;
      const frac = makeQuantity({
        value: m.value * f, unit: 'ratio', low: Math.min(lo, hi), high: Math.max(lo, hi), status: m.status === 'assumed' ? 'assumed' : 'estimated',
        source: m.source, jurisdiction: /** @type {string} */ (m.jurisdiction), effectiveDate: /** @type {string} */ (m.effectiveDate),
        inputs: [`${L.modelId} magnitude`, `weight ${c.weight}`], assumptions: [...m.assumptions], method: 'magnitude (percent to fraction) x decay weight x sign',
      });
      out.push({ receptorId: c.ref.id, target: L.target, sign: L.sign, layerId: L.modelId, improvementId: area.improvementId, value: mulQ(frac, base) });
    }
  }
  return { improvementId: area.improvementId, perReceptor: out, unknownBase: [...unknown], notValued };
}

/** @param {Quantity} q */
const absV = (q) => Math.abs(/** @type {number} */ (q.value));

/**
 * Combine value effects of several improvements per (receptor, target, sign) through one guard. Positive and negative
 * effects are never netted. Without a guard, overlapping values are returned un-summed and flagged.
 * @param {ValueEffect[]} effects
 * @param {Guard|null|undefined} guard
 */
export function combineImpacts(effects, guard) {
  // One improvement is valued once per (improvement, target, receptor, sign). Repeating the same layer is dropped; the same improvement
  // under two different models for one target is refused (the caller must choose one model, see registry.selectModel).
  /** @type {Map<string, ReceptorValue>} */ const seen = new Map();
  /** @type {Map<string, ReceptorValue[]>} */ const groups = new Map();
  for (const e of effects) for (const r of e.perReceptor) {
    const dk = `${r.improvementId}\u0000${r.target}\u0000${r.receptorId}\u0000${r.sign}`;
    const prior = seen.get(dk);
    if (prior) {
      if (prior.layerId !== r.layerId) throw new Error(`combineImpacts: improvement '${r.improvementId}' is valued under two models ('${prior.layerId}', '${r.layerId}') for target '${r.target}' at receptor '${r.receptorId}'; choose one model`);
      continue;
    }
    seen.set(dk, r);
    const k = `${r.receptorId}\u0000${r.target}\u0000${r.sign}`;
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  if (guard && guard.rule === 'capped_sum' && !(isQuantity(guard.cap) && guard.cap.value !== null && guard.cap.source)) {
    throw new Error("combineImpacts: capped_sum needs a cap Quantity with a source");
  }
  if (guard && guard.rule === 'capped_sum') {
    for (const items of groups.values()) {
      const u = items[0].value.unit;
      if (items.some((i) => i.value.unit !== u) ) throw new Error('combineImpacts: contributions in one group have different units');
      if (items.length > 1 && guard.cap.unit !== u) throw new Error(`combineImpacts: cap unit '${guard.cap.unit}' differs from the values' unit '${u}'`);
    }
  }
  if (guard && !['max', 'capped_sum', 'not_assessed'].includes(guard.rule)) throw new Error('combineImpacts: unknown guard rule ' + guard.rule);
  /** @type {any[]} */ const combined = [];
  /** @type {any[]} */ const uncombined = [];
  /** @type {Set<string>} */ const flags = new Set();
  for (const [, items] of groups) {
    const { receptorId, target, sign } = items[0];
    if (items.length === 1) { combined.push({ receptorId, target, sign, value: items[0].value, rule: 'single', contributors: [items[0].improvementId], capped: false }); continue; }
    const contributors = items.map((i) => i.improvementId);
    if (!guard) { uncombined.push({ receptorId, target, sign, perImprovement: items.map((i) => ({ improvementId: i.improvementId, layerId: i.layerId, value: i.value })) }); flags.add('overlap_not_combined'); continue; }
    if (guard.rule === 'not_assessed') {
      combined.push({ receptorId, target, sign, value: unknownQuantity(items[0].value.unit, `overlap of ${items.length} improvements not assessed (guard: not_assessed)`), rule: 'not_assessed', contributors, capped: false });
      flags.add('overlap_not_assessed'); continue;
    }
    const known = items.filter((i) => i.value.value !== null);
    if (known.length < items.length) {
      combined.push({ receptorId, target, sign, value: unknownQuantity(items[0].value.unit, 'an overlapping contribution is unknown'), rule: guard.rule, contributors, capped: false });
      flags.add('overlap_has_unknown'); continue;
    }
    if (guard.rule === 'max') {
      const best = known.reduce((a, b) => (absV(b.value) > absV(a.value) ? b : a));
      combined.push({ receptorId, target, sign, value: best.value, rule: 'max', contributors, chosen: best.improvementId, capped: false });
    } else {
      let sum = known[0].value;
      for (const i of known.slice(1)) sum = addQ(sum, i.value);
      // Cap |low|, |value| and |high| separately at the cap's value, keeping each one's own sign.
      const capV = Math.abs(/** @type {number} */ (guard.cap.value));
      const cl = (/** @type {number} */ x) => Math.sign(x) * Math.min(Math.abs(x), capV);
      const [lo, v, hi] = [cl(/** @type {number} */ (sum.low)), cl(/** @type {number} */ (sum.value)), cl(/** @type {number} */ (sum.high))];
      const capped = lo !== sum.low || v !== sum.value || hi !== sum.high;
      const value = capped ? makeQuantity({
        value: v, low: lo, high: hi, unit: sum.unit, status: sum.status === 'verified' ? 'estimated' : /** @type {any} */ (sum.status),
        source: guard.cap.source, jurisdiction: /** @type {string} */ (guard.cap.jurisdiction), effectiveDate: /** @type {string} */ (guard.cap.effectiveDate),
        inputs: [...sum.inputs], assumptions: [...sum.assumptions, `capped at ${capV} ${guard.cap.unit} (low, value and high each)`], method: `capped_sum: ${sum.method}`,
      }) : sum;
      combined.push({ receptorId, target, sign, value, rule: 'capped_sum', contributors, capped, cappedValue: v !== sum.value });
    }
    flags.add('overlap_combined');
  }
  return { combined, uncombined, flags: [...flags] };
}
