// @ts-check
// Baseline vs hypothetical, same evaluator, per horizon; differences by interval arithmetic, per value stream.
import { isQuantity, subQ, unknownQuantity } from '../schema/quantity.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */

/**
 * evaluate(inputs, horizon) must return { streams: Record<string, Quantity>, phasing?: any }.
 * A hypothetical's inputs are the baseline with `changes` shallow-merged over it.
 * @param {{ baseline: Record<string, any>, hypotheticals: { name: string, changes: Record<string, any> }[],
 *   evaluate: (inputs: any, horizon: number) => { streams: Record<string, Quantity>, phasing?: any }, horizons: number[] }} spec
 */
export function runScenarios(spec) {
  const { baseline, hypotheticals, evaluate, horizons } = spec;
  if (!Array.isArray(horizons) || horizons.length === 0) throw new Error('runScenarios: at least one horizon required');
  const evalOne = (/** @type {any} */ inputs, /** @type {number} */ h) => {
    const r = evaluate(inputs, h);
    for (const [k, q] of Object.entries(r.streams || {})) if (!isQuantity(q)) throw new TypeError(`runScenarios: stream ${k} is not a Quantity`);
    return r;
  };
  const base = horizons.map((h) => ({ horizon: h, ...evalOne(baseline, h) }));
  const scenarios = hypotheticals.map((hyp) => {
    const inputs = { ...baseline, ...hyp.changes };
    const results = horizons.map((h, i) => {
      const r = evalOne(inputs, h);
      /** @type {Record<string, Quantity>} */ const differenceVsBaseline = {};
      const keys = new Set([...Object.keys(r.streams || {}), ...Object.keys(base[i].streams || {})]);
      for (const k of [...keys].sort()) {
        const s = r.streams?.[k], b = base[i].streams?.[k];
        if (!s || !b) differenceVsBaseline[k] = unknownQuantity((s || b)?.unit || '', `stream ${k} missing in ${!s ? hyp.name : 'baseline'}`);
        else if (s.value === null || b.value === null) differenceVsBaseline[k] = unknownQuantity(s.unit, `stream ${k} unknown in ${s.value === null ? hyp.name : 'baseline'}; difference not computed`, { status: 'requires_investigation' });
        else differenceVsBaseline[k] = subQ(s, b);
      }
      return { horizon: h, streams: r.streams, phasing: r.phasing ?? null, differenceVsBaseline };
    });
    return { name: hyp.name, changes: hyp.changes, results };
  });
  return Object.freeze({ baseline: base, scenarios, note: 'Differences are per value stream; streams are never added.' });
}
