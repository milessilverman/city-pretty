// @ts-check
// Recall, precision, F1. A zero denominator gives null (undefined), never 0.

/** @typedef {{ tp: number, fp: number, fn: number }} Confusion */

/** @param {Iterable<string>} predicted @param {Iterable<string>} truth @returns {Confusion} */
export function confusionCounts(predicted, truth) {
  const p = new Set(predicted), t = new Set(truth);
  let tp = 0;
  for (const x of p) if (t.has(x)) tp++;
  return { tp, fp: p.size - tp, fn: t.size - tp };
}

/** @param {Confusion} c @returns {number|null} */
export function recall(c) { const d = c.tp + c.fn; return d === 0 ? null : c.tp / d; }
/** @param {Confusion} c @returns {number|null} */
export function precision(c) { const d = c.tp + c.fp; return d === 0 ? null : c.tp / d; }
/** @param {Confusion} c @returns {number|null} */
export function f1(c) { const d = 2 * c.tp + c.fp + c.fn; return d === 0 ? null : (2 * c.tp) / d; }

/** @param {Confusion} c */
export function score(c) { return { ...c, recall: recall(c), precision: precision(c), f1: f1(c) }; }
