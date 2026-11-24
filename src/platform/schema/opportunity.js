// @ts-check
// Opportunity, UseOption and ValueStreams. Status is derived from checks, never asserted.
import { isQuantity } from './quantity.js';
import { validateGeoRef } from './geo.js';
import { getCategory } from './categories.js';

/**
 * @typedef {'pass'|'fail'|'unknown'} CheckResultValue
 * @typedef {'financial'|'regulatory'|'engineering'|'physical'} RejectionBasis
 * @typedef {{ result: CheckResultValue, reason?: string, basis?: RejectionBasis, missing?: string[] }} CheckResult
 * @typedef {{ financial?: CheckResult, regulatory?: CheckResult, engineering?: CheckResult }} Checks
 * @typedef {'candidate'|'viable'|'rejected'|'needs_info'} OpportunityStatus
 * @typedef {{ amount: import('./quantity.js').Quantity, capturedBy: string, mechanism: string }} ValueStream
 * @typedef {Readonly<Record<'propertyAppreciation'|'developmentProfit'|'municipalTaxRevenue'|'publicEconomicBenefit'|'investorCashFlow'|'operatingRevenue'|'capturableLandValue', ValueStream>>} ValueStreams
 * @typedef {{ use: string, checks: Checks, status: OpportunityStatus }} UseOption
 * @typedef {{ check: string, basis: RejectionBasis, reason: string }} RejectionReason
 * @typedef {Object} Opportunity
 * @property {string} id
 * @property {string} categoryId
 * @property {import('./geo.js').GeoRef} location
 * @property {string} discoveredBy
 * @property {OpportunityStatus} status
 * @property {readonly UseOption[]} uses
 * @property {Checks} checks
 * @property {readonly RejectionReason[]} rejectionReasons
 * @property {readonly string[]} missingInputs
 * @property {string} confidence
 * @property {readonly string[]} confidenceReasons
 * @property {ValueStreams|null} valueStreams
 * @property {readonly import('./quantity.js').Quantity[]} evidence
 */

export const CHECK_RESULTS = Object.freeze(['pass', 'fail', 'unknown']);
export const CHECK_KEYS = Object.freeze(['financial', 'regulatory', 'engineering']);
export const REJECTION_BASES = Object.freeze(['financial', 'regulatory', 'engineering', 'physical']);
export const DISCOVERED_BY = Object.freeze(['exhaustive', 'problem_first', 'asset_first', 'combination', 'ai_exploration']);
export const OPPORTUNITY_STATUSES = Object.freeze(['candidate', 'viable', 'rejected', 'needs_info']);
export const USE_KINDS = Object.freeze(['develop', 'preserve', 'public_space', 'coordinated_development']);
export const CONFIDENCE_LEVELS = Object.freeze(['high', 'medium', 'low', 'unknown']);
export const VALUE_STREAM_KEYS = Object.freeze([
  'propertyAppreciation', 'developmentProfit', 'municipalTaxRevenue', 'publicEconomicBenefit',
  'investorCashFlow', 'operatingRevenue', 'capturableLandValue',
]);

/** @param {any} s */
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

/**
 * viable only if all three checks pass; a fail rejects; an unknown gives needs_info; unrun checks leave a candidate.
 * @param {Checks} checks @returns {OpportunityStatus}
 */
export function deriveStatus(checks) {
  const results = CHECK_KEYS.map((k) => {
    const r = /** @type {any} */ (checks || {})[k];
    if (r === undefined || r === null) return undefined;
    if (!CHECK_RESULTS.includes(r.result)) throw new Error(`deriveStatus: check ${k} has invalid result ${r.result}`);
    return r.result;
  });
  if (results.includes('fail')) return 'rejected';
  if (results.every((r) => r === 'pass')) return 'viable';
  if (results.includes('unknown')) return 'needs_info';
  return 'candidate';
}

/** Validate and freeze checks; fail needs a non-missing-data reason and basis, unknown needs a missing list. @param {any} checks @returns {Checks} */
function normalizeChecks(checks) {
  /** @type {any} */ const out = {};
  for (const k of CHECK_KEYS) {
    const r = checks && checks[k];
    if (r === undefined || r === null) continue;
    if (!CHECK_RESULTS.includes(r.result)) throw new Error(`check ${k}: result must be pass|fail|unknown`);
    if (r.result === 'fail') {
      if (!nonEmpty(r.reason)) throw new Error(`check ${k}: a fail needs a reason`);
      const basis = r.basis ?? k;
      if (!REJECTION_BASES.includes(basis)) throw new Error(`check ${k}: basis must be one of ${REJECTION_BASES.join('|')}`);
      out[k] = Object.freeze({ result: 'fail', reason: r.reason, basis });
    } else if (r.result === 'unknown') {
      if (!Array.isArray(r.missing) || r.missing.length === 0 || !r.missing.every(nonEmpty)) {
        throw new Error(`check ${k}: an unknown needs a non-empty missing list`);
      }
      out[k] = Object.freeze({ result: 'unknown', missing: Object.freeze([...r.missing]) });
    } else out[k] = Object.freeze({ result: 'pass' });
  }
  return Object.freeze(out);
}

/** @param {{ use: string, checks?: Checks }} spec @returns {UseOption} */
export function makeUseOption(spec) {
  if (!spec || !USE_KINDS.includes(spec.use)) throw new Error(`makeUseOption: use must be one of ${USE_KINDS.join('|')}`);
  const checks = normalizeChecks(spec.checks || {});
  return Object.freeze({ use: spec.use, checks, status: deriveStatus(checks) });
}

/** @param {any} streams @returns {ValueStreams} */
export function makeValueStreams(streams) {
  if (!streams || typeof streams !== 'object') throw new Error('makeValueStreams: object required');
  const keys = Object.keys(streams);
  const extra = keys.filter((k) => !VALUE_STREAM_KEYS.includes(k));
  if (extra.length) throw new Error(`makeValueStreams: unknown key(s) ${extra.join(', ')} (there is deliberately no total)`);
  const missing = VALUE_STREAM_KEYS.filter((k) => !keys.includes(k));
  if (missing.length) throw new Error(`makeValueStreams: missing stream(s) ${missing.join(', ')}`);
  /** @type {any} */ const out = {};
  for (const k of VALUE_STREAM_KEYS) {
    const s = streams[k];
    if (!s || !isQuantity(s.amount)) throw new Error(`makeValueStreams: ${k}.amount must be a Quantity`);
    if (!nonEmpty(s.capturedBy)) throw new Error(`makeValueStreams: ${k}.capturedBy required`);
    if (!nonEmpty(s.mechanism)) throw new Error(`makeValueStreams: ${k}.mechanism required (use none_identified)`);
    out[k] = Object.freeze({ amount: s.amount, capturedBy: s.capturedBy, mechanism: s.mechanism });
  }
  return Object.freeze(out);
}

/** Always throws: the seven streams have different holders and must never be added. @param {any} [_streams] @returns {never} */
export function sumValueStreams(_streams) {
  throw new Error('sumValueStreams: the seven value streams accrue to different parties and overlap (for example appreciation and capturable land value); adding them double counts, so no total exists. Report each stream separately.');
}

/**
 * @param {{ id: string, categoryId: string, location: import('./geo.js').GeoRef, discoveredBy: string, checks?: Checks,
 *   uses?: UseOption[], missingInputs?: string[], confidence?: string, confidenceReasons?: string[],
 *   valueStreams?: ValueStreams|null, evidence?: import('./quantity.js').Quantity[], status?: OpportunityStatus }} spec
 * @returns {Opportunity}
 */
export function makeOpportunity(spec) {
  if (!spec || !nonEmpty(spec.id)) throw new Error('makeOpportunity: id required');
  const cat = getCategory(spec.categoryId);
  if (!cat) throw new Error(`makeOpportunity: unknown category ${spec.categoryId}`);
  const v = validateGeoRef(spec.location);
  if (!v.valid) throw new Error('makeOpportunity: invalid location: ' + v.errors.join('; '));
  if (!cat.appliesTo.includes(spec.location.kind)) throw new Error(`makeOpportunity: ${cat.id} does not apply to ${spec.location.kind}`);
  if (!DISCOVERED_BY.includes(spec.discoveredBy)) throw new Error(`makeOpportunity: discoveredBy must be one of ${DISCOVERED_BY.join('|')}`);
  const confidence = spec.confidence ?? 'unknown';
  if (!CONFIDENCE_LEVELS.includes(confidence)) throw new Error('makeOpportunity: invalid confidence');
  const checks = normalizeChecks(spec.checks || {});
  const status = deriveStatus(checks);
  if (spec.status !== undefined && spec.status !== status) {
    throw new Error(`makeOpportunity: status ${spec.status} contradicts checks (derived ${status})`);
  }
  const uses = (spec.uses || []).map((u) => {
    if (!u || !USE_KINDS.includes(u.use)) throw new Error('makeOpportunity: invalid use option');
    return u;
  });
  const evidence = spec.evidence || [];
  if (!evidence.every(isQuantity)) throw new Error('makeOpportunity: evidence must be Quantities');
  const vs = spec.valueStreams ?? null;
  if (vs !== null) makeValueStreams(vs);
  /** @type {RejectionReason[]} */
  const rejectionReasons = CHECK_KEYS.flatMap((k) => {
    const r = /** @type {any} */ (checks)[k];
    return r && r.result === 'fail' ? [Object.freeze({ check: k, basis: r.basis, reason: r.reason })] : [];
  });
  const missing = new Set(spec.missingInputs || []);
  for (const k of CHECK_KEYS) {
    const r = /** @type {any} */ (checks)[k];
    if (r && r.result === 'unknown') r.missing.forEach((/** @type {string} */ m) => missing.add(m));
  }
  return Object.freeze({
    id: spec.id, categoryId: cat.id, location: spec.location, discoveredBy: spec.discoveredBy, status,
    uses: Object.freeze(uses), checks, rejectionReasons: Object.freeze(rejectionReasons),
    missingInputs: Object.freeze([...missing]), confidence, confidenceReasons: Object.freeze([...(spec.confidenceReasons || [])]),
    valueStreams: vs, evidence: Object.freeze([...evidence]),
  });
}
