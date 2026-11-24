// @ts-check
// Back-test harness: guards against leakage (future data) and survivorship (only successes in truth).
import { score } from './metrics.js';

/**
 * @typedef {{ id: string, date?: string }} DatedRecord
 * @typedef {{ id: string, category: string, outcome: string, date?: string }} TruthRecord
 * @typedef {{ id?: string, category: string }} Prediction
 */

export class LeakageError extends Error {
  /** @param {string} m */
  constructor(m) { super(m); this.name = 'LeakageError'; }
}
export class SurvivorshipError extends Error {
  /** @param {string} m */
  constructor(m) { super(m); this.name = 'SurvivorshipError'; }
}

/** Truth outcomes a good discoverer should surface. */
export const POSITIVE_OUTCOMES = Object.freeze(['built', 'succeeded', 'alternative']);
/** Truth outcomes it should not have recommended; matching one is a false positive. */
export const NEGATIVE_OUTCOMES = Object.freeze(['failed', 'cancelled']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** @param {any} d */
const validDate = (d) => typeof d === 'string' && DATE_RE.test(d);

/** Keep only dated records on or before the cut-off (a number is a year, cut-off 31 Dec). @param {any[]} records @param {string|number} cutoff */
export function reconstructYear(records, cutoff) {
  const cut = typeof cutoff === 'number' ? `${cutoff}-12-31` : cutoff;
  if (!validDate(cut)) throw new Error('reconstructYear: cutoff must be YYYY-MM-DD or a year');
  return records.filter((r) => validDate(r && r.date) && r.date.slice(0, 10) <= cut.slice(0, 10));
}

/**
 * @param {{ cutoff: string, inputs: DatedRecord[], truth: TruthRecord[], discover: (inputs: readonly DatedRecord[]) => Prediction[],
 *   match?: (p: Prediction, t: TruthRecord) => boolean }} args
 */
export function runBacktest({ cutoff, inputs, truth, discover, match }) {
  if (!validDate(cutoff)) throw new Error('runBacktest: cutoff must be YYYY-MM-DD');
  if (!Array.isArray(inputs) || !Array.isArray(truth) || typeof discover !== 'function') throw new Error('runBacktest: inputs, truth and discover required');
  const cut = cutoff.slice(0, 10);
  for (const r of inputs) {
    if (!validDate(r && r.date)) throw new LeakageError(`input record ${r && r.id} has no valid date; undated records cannot be proven to predate ${cut}`);
    if (/** @type {string} */ (r.date).slice(0, 10) > cut) throw new LeakageError(`input record ${r.id} dated ${r.date} is after cutoff ${cut}`);
  }
  const known = [...POSITIVE_OUTCOMES, ...NEGATIVE_OUTCOMES];
  for (const t of truth) {
    if (!known.includes(t.outcome)) throw new Error(`runBacktest: truth ${t.id} has unknown outcome ${t.outcome}`);
  }
  if (!truth.some((t) => NEGATIVE_OUTCOMES.includes(t.outcome))) {
    throw new SurvivorshipError('truth contains no failed or cancelled project; a survivors-only truth set is refused');
  }
  if (!truth.some((t) => t.outcome === 'alternative')) {
    throw new SurvivorshipError('truth contains no plausible alternative; a survivors-only truth set is refused');
  }
  const matchFn = match || ((p, t) => p.id !== undefined && p.id === t.id);
  const predictions = discover(Object.freeze([...inputs]));
  if (!Array.isArray(predictions)) throw new Error('runBacktest: discover must return an array');

  const claimed = new Set();
  /** @type {Record<string, { tp: number, fp: number, fn: number }>} */ const by = {};
  const bucket = (/** @type {string} */ k) => (by[k] ||= { tp: 0, fp: 0, fn: 0 });
  let falsePositivesOnFailed = 0;
  let duplicates = 0;
  let unjudged = 0;
  for (const p of predictions) {
    const hitPos = truth.find((t) => POSITIVE_OUTCOMES.includes(t.outcome) && !claimed.has(t) && matchFn(p, t));
    if (hitPos) { claimed.add(hitPos); bucket(hitPos.category).tp++; continue; }
    if (truth.some((t) => NEGATIVE_OUTCOMES.includes(t.outcome) && matchFn(p, t))) {
      // recommended something that was tried and failed or was cancelled: a judged false positive
      falsePositivesOnFailed++; bucket(p.category).fp++; continue;
    }
    if (truth.some((t) => POSITIVE_OUTCOMES.includes(t.outcome) && matchFn(p, t))) { duplicates++; bucket(p.category).fp++; continue; }
    // matches nothing in the truth set: the truth set is never complete, so this is unknown, not wrong
    unjudged++;
  }
  for (const t of truth) if (POSITIVE_OUTCOMES.includes(t.outcome) && !claimed.has(t)) bucket(t.category).fn++;
  const builtTruth = truth.filter((t) => t.outcome === 'built' || t.outcome === 'succeeded');
  const builtFound = builtTruth.filter((t) => claimed.has(t)).length;

  const overall = { tp: 0, fp: 0, fn: 0 };
  /** @type {Record<string, any>} */ const byCategory = {};
  for (const [k, v] of Object.entries(by)) {
    overall.tp += v.tp; overall.fp += v.fp; overall.fn += v.fn;
    byCategory[k] = score(v);
  }
  return {
    cutoff: cut, overall: score(overall), byCategory,
    counts: {
      inputs: inputs.length, truth: truth.length, predictions: predictions.length,
      positives: truth.filter((t) => POSITIVE_OUTCOMES.includes(t.outcome)).length,
      negatives: truth.filter((t) => NEGATIVE_OUTCOMES.includes(t.outcome)).length,
      falsePositivesOnFailed, duplicates, unjudged,
    },
    // precision above counts only judged predictions; this one treats every unjudged prediction as wrong (a lower bound)
    precisionStrict: predictions.length === 0 ? null : overall.tp / predictions.length,
    // recall on projects that were actually built, leaving the plausible alternatives out of the denominator
    recallBuilt: builtTruth.length === 0 ? null : builtFound / builtTruth.length,
  };
}
