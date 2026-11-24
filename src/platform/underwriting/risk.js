// @ts-check
// Risk-adjusted return from caller-stated scenario probabilities, and a one-at-a-time sensitivity table.
// No certainty-equivalent and no probability-weighted mean IRR is produced: both would be invented summaries.
import { isQuantity } from '../schema/quantity.js';
import { derived, finite, known, nonEmpty, unknownWith } from './q.js';
import { irr, npv } from './metrics.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */

const PROB_TOL = 1e-6;

/**
 * @param {{ scenarios: { name: string, probability: Quantity, flows: number[] }[], discountRate: Quantity, unit?: string,
 *   discountRateName?: string }} spec discountRateName: the name reported in `missing` when the rate is absent (no default rate).
 */
export function riskAdjusted(spec) {
  const unit = spec.unit || 'USD';
  const scenarios = Array.isArray(spec.scenarios) ? spec.scenarios : [];
  /** @type {string[]} */ const missing = [];
  if (scenarios.length === 0) missing.push('scenarios');
  if (!known(spec.discountRate)) missing.push(spec.discountRateName || 'discountRate');
  scenarios.forEach((s, i) => {
    const p = s && s.probability;
    if (!isQuantity(p) || p.value === null) missing.push(`scenarios[${i}].probability (with provenance)`);
    else if (!(p.value >= 0 && p.value <= 1)) missing.push(`scenarios[${i}].probability (must be in [0, 1])`);
    if (!s || !Array.isArray(s.flows) || s.flows.length < 2 || !s.flows.every(finite)) missing.push(`scenarios[${i}].flows`);
    if (!s || !nonEmpty(s.name)) missing.push(`scenarios[${i}].name`);
  });
  if (missing.length === 0) {
    const total = scenarios.reduce((a, s) => a + /** @type {number} */ (s.probability.value), 0);
    if (Math.abs(total - 1) > PROB_TOL) missing.push(`scenario probabilities sum to ${total}, not 1`);
  }
  if (missing.length) {
    return Object.freeze({ status: 'requires_investigation', missing,
      expectedNpv: unknownWith(unit, 'risk-adjusted NPV needs stated probabilities summing to 1', missing),
      probabilityNpvNegative: null, scenarios: [], irrDistribution: null });
  }
  const r = /** @type {Quantity} */ (spec.discountRate);
  const rows = scenarios.map((s) => {
    const p = /** @type {number} */ (s.probability.value);
    const at = [/** @type {number} */ (r.value), /** @type {number} */ (r.low), /** @type {number} */ (r.high)].map((x) => npv(x, s.flows));
    const ir = irr(s.flows);
    return { name: s.name, probability: p, npv: at[0], npvAtLowRate: at[1], npvAtHighRate: at[2], irr: ir.value, irrReason: ir.reason };
  });
  const e = (/** @type {(row: any) => number} */ f) => rows.reduce((a, row) => a + row.probability * f(row), 0);
  const point = e((x) => x.npv), atLow = e((x) => x.npvAtLowRate), atHigh = e((x) => x.npvAtHighRate);
  const expectedNpv = derived({ unit, point, low: Math.min(atLow, atHigh), high: Math.max(atLow, atHigh),
    from: [r, ...scenarios.map((s) => s.probability)],
    method: 'probability-weighted NPV over the stated scenarios; range from the discount-rate range only (probability ranges not propagated)' });
  const irrs = rows.map((x) => x.irr).filter((x) => x !== null);
  return Object.freeze({
    status: 'ok', missing: [], expectedNpv,
    probabilityNpvNegative: rows.filter((x) => x.npv < 0).reduce((a, x) => a + x.probability, 0),
    scenarios: rows,
    irrDistribution: {
      min: irrs.length ? Math.min(.../** @type {number[]} */ (irrs)) : null,
      max: irrs.length ? Math.max(.../** @type {number[]} */ (irrs)) : null,
      byScenario: rows.map((x) => ({ name: x.name, probability: x.probability, irr: x.irr, reason: x.irrReason })),
      undefinedProbability: rows.filter((x) => x.irr === null).reduce((a, x) => a + x.probability, 0),
      note: 'no certainty-equivalent or mean IRR is reported',
    },
  });
}

/**
 * One-at-a-time sensitivity. `evaluate` is a pure caller function of the named inputs returning a number.
 * @param {{ evaluate: (inputs: Record<string, number>) => number, inputs: Record<string, number> }} base
 * @param {{ name: string, low: number, high: number }[]} drivers
 */
export function sensitivity(base, drivers) {
  if (!base || typeof base.evaluate !== 'function' || !base.inputs) throw new TypeError('sensitivity: base { evaluate, inputs } required');
  const baseOutput = base.evaluate({ ...base.inputs });
  const rows = drivers.map((d) => {
    if (!(d.name in base.inputs)) throw new Error(`sensitivity: unknown driver ${d.name}`);
    const atLow = base.evaluate({ ...base.inputs, [d.name]: d.low });
    const atHigh = base.evaluate({ ...base.inputs, [d.name]: d.high });
    return { driver: d.name, baseValue: base.inputs[d.name], low: d.low, high: d.high, outputAtLow: atLow, outputAtHigh: atHigh,
      swing: Math.abs(atHigh - atLow) };
  });
  rows.sort((a, b) => b.swing - a.swing);
  return Object.freeze({ baseOutput, rows });
}
