// @ts-check
// Funding-mechanism catalogue engine: record validator, eligibility check and funding stack. Mechanism records are
// data with a jurisdiction and quoted legal basis; nothing state-specific is coded here. Grants and credits are
// never counted as secured without an explicit award record, and the minimum public subsidy is never raised to use
// up available money.
import { VALUE_STREAM_KEYS } from '../schema/opportunity.js';
import { makeQuantity, unknownQuantity } from '../schema/quantity.js';
import { derived, finite, known, nonEmpty } from './q.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */

export const MECHANISM_TYPES = Object.freeze([
  'federal_grant', 'state_grant', 'municipal_grant', 'ifd_eifd', 'tif', 'special_assessment', 'private_activity_bond',
  'developer_contribution', 'joint_development', 'land_lease', 'dedicated_tax', 'tax_credit', 'concession',
  'operating_revenue', 'federal_credit_assistance',
]);
export const CERTAINTIES = Object.freeze(['by_right', 'formula', 'requires_allocation', 'requires_local_action', 'competitive', 'discretionary', 'unknown']);
/** Order used by the funding stack: lower is more certain. */
const CERTAINTY_RANK = Object.freeze({ by_right: 0, formula: 0, requires_allocation: 1, requires_local_action: 2, competitive: 3, discretionary: 4, unknown: 5 });
const NEVER_GUARANTEED = ['competitive', 'discretionary', 'unknown'];
export const RULE_OPS = Object.freeze(['eq', 'in', 'gte', 'lte', 'is_true']);
export const RULE_FIELDS = Object.freeze([
  'project.state', 'project.use', 'project.categoryFamily', 'project.affordableUnitShare', 'project.affordableIncomeLimitPctAmi',
  'project.isHistoricStructure', 'project.inLowIncomeCommunity', 'project.inOpportunityZone', 'project.eligibleCostUsd',
  'project.sponsorType', 'project.hasLocalApproval',
]);
export const JURISDICTION_LEVELS = Object.freeze(['federal', 'state', 'county', 'city', 'place', 'regional', 'special_district']);
const RECORD_STATUSES = ['verified', 'requires_investigation'];
/**
 * The one vocabulary for project.use and project.sponsorType. Rule values outside it are rejected by the validator,
 * and a project value outside it is treated as unknown (never as a failed rule).
 */
export const PROJECT_USES = Object.freeze([
  'residential_rental', 'residential_ownership', 'commercial', 'mixed_use', 'industrial', 'transportation',
  'public_facility', 'parking', 'park_or_open_space',
]);
export const SPONSOR_TYPES = Object.freeze([
  'charitable_or_nonprofit_organization', 'metropolitan_planning_organization', 'political_subdivision_of_a_state',
  'federally_recognized_tribal_government', 'multijurisdictional_group', 'state_government', 'private_for_profit_entity',
]);
/** @type {Readonly<Record<string, readonly string[]>>} */
export const RULE_VOCABULARY = Object.freeze({ 'project.use': PROJECT_USES, 'project.sponsorType': SPONSOR_TYPES });
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** @param {any} s */
const isIsoDate = (s) => typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** @param {any} i @param {any[]} quotes */
const quoteOk = (i, quotes) => Number.isInteger(i) && i >= 0 && i < quotes.length;

/**
 * Structural validation of one mechanism record.
 * @param {any} r @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMechanismRecord(r) {
  /** @type {string[]} */ const e = [];
  if (!r || typeof r !== 'object') return { valid: false, errors: ['record must be an object'] };
  if (!nonEmpty(r.id)) e.push('id required');
  if (!MECHANISM_TYPES.includes(r.mechanismType)) e.push(`mechanismType must be one of ${MECHANISM_TYPES.join('|')}`);
  if (!nonEmpty(r.name)) e.push('name required');
  if (!RECORD_STATUSES.includes(r.status)) e.push('status must be verified|requires_investigation');
  const verified = r.status === 'verified';
  const j = r.jurisdiction;
  if (!j || !JURISDICTION_LEVELS.includes(j.level)) e.push(`jurisdiction.level must be one of ${JURISDICTION_LEVELS.join('|')}`);
  else if (j.level !== 'federal' && !(typeof j.state === 'string' && /^[A-Z]{2}$/.test(j.state))) e.push('non-federal jurisdiction needs a two-letter state');
  if ((j && (j.level === 'county') && !nonEmpty(j.countyFips))) e.push('county jurisdiction needs countyFips');
  if ((j && (j.level === 'city' || j.level === 'place') && !nonEmpty(j.place))) e.push('city/place jurisdiction needs place');
  const lb = r.legalBasis;
  if (!lb || typeof lb !== 'object') e.push('legalBasis required');
  else if (verified) {
    for (const k of ['citation', 'url', 'publisher', 'retrieved']) if (!nonEmpty(lb[k])) e.push(`legalBasis.${k} required for a verified record`);
    if (nonEmpty(lb.url) && !/^https?:\/\//.test(lb.url)) e.push('legalBasis.url must be http(s)');
  }
  const quotes = Array.isArray(r.quotes) ? r.quotes : null;
  if (!quotes) e.push('quotes must be an array');
  else quotes.forEach((q, i) => {
    if (!q || !nonEmpty(q.topic) || !nonEmpty(q.text)) e.push(`quotes[${i}] needs topic and text`);
    else if (q.sourceUrl !== undefined && !(nonEmpty(q.sourceUrl) && /^https?:\/\//.test(q.sourceUrl))) e.push(`quotes[${i}].sourceUrl must be an http(s) URL when present`);
  });
  const qs = quotes || [];
  if (verified && qs.length === 0) e.push('a verified record needs at least one quote');
  if (!Array.isArray(r.rules)) e.push('rules must be an array');
  else r.rules.forEach((/** @type {any} */ ru, /** @type {number} */ i) => {
    if (!ru || !RULE_FIELDS.includes(ru.field)) e.push(`rules[${i}].field must be one of ${RULE_FIELDS.join('|')}`);
    if (!ru || !RULE_OPS.includes(ru.op)) e.push(`rules[${i}].op must be one of ${RULE_OPS.join('|')}`);
    else if (ru.op === 'in' && !Array.isArray(ru.value)) e.push(`rules[${i}].value must be an array for 'in'`);
    else if ((ru.op === 'gte' || ru.op === 'lte') && !finite(ru.value)) e.push(`rules[${i}].value must be a number for '${ru.op}'`);
    if (ru && verified && !quoteOk(ru.quoteIndex, qs)) e.push(`rules[${i}].quoteIndex must point at a quote`);
    const vocab = ru && RULE_VOCABULARY[ru.field];
    if (vocab && (ru.op === 'eq' || ru.op === 'in')) {
      const vals = ru.op === 'in' ? (Array.isArray(ru.value) ? ru.value : []) : [ru.value];
      for (const x of vals) if (!vocab.includes(x)) e.push(`rules[${i}].value ${JSON.stringify(x)} is not in the ${ru.field} vocabulary (${vocab.join('|')})`);
    } else if (vocab) e.push(`rules[${i}].op must be eq or in for ${ru.field}`);
    if (ru && !(ru.alternativeGroup === null || ru.alternativeGroup === undefined || nonEmpty(ru.alternativeGroup))) e.push(`rules[${i}].alternativeGroup must be a string or null`);
  });
  const ps = r.publicShare;
  if (!ps || typeof ps !== 'object') e.push('publicShare required ({ maxShareOfEligibleCost|null, quoteIndex|null })');
  else if (ps.maxShareOfEligibleCost !== null) {
    if (!(finite(ps.maxShareOfEligibleCost) && ps.maxShareOfEligibleCost > 0 && ps.maxShareOfEligibleCost <= 1)) e.push('publicShare.maxShareOfEligibleCost must be in (0, 1] or null');
    if (!quoteOk(ps.quoteIndex, qs)) e.push('publicShare.quoteIndex must point at a quote when a share is given');
  }
  for (const k of ['matchRequirement', 'deadlineOrSunset']) {
    const v = r[k];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'object' || !nonEmpty(v.text)) e.push(`${k} must be null or { text, quoteIndex }`);
    else if (v.quoteIndex !== null && v.quoteIndex !== undefined && !quoteOk(v.quoteIndex, qs)) e.push(`${k}.quoteIndex must point at a quote`);
  }
  // optional machine-readable availability window (YYYY-MM-DD, inclusive), each date quoted verbatim in a quote
  for (const k of ['availableFrom', 'availableUntil']) {
    if (r[k] !== undefined && r[k] !== null && !isIsoDate(r[k])) e.push(`${k} must be a YYYY-MM-DD date when present`);
  }
  const hasWindow = isIsoDate(r.availableFrom) || isIsoDate(r.availableUntil);
  if (hasWindow && !quoteOk(r.availabilityQuoteIndex, qs)) e.push('availabilityQuoteIndex must point at the quote that states the availability date');
  if (!hasWindow && r.availabilityQuoteIndex !== undefined && r.availabilityQuoteIndex !== null) e.push('availabilityQuoteIndex given without availableFrom or availableUntil');
  if (isIsoDate(r.availableFrom) && isIsoDate(r.availableUntil) && r.availableFrom > r.availableUntil) e.push('availableFrom must not be after availableUntil');
  if (!CERTAINTIES.includes(r.certainty)) e.push(`certainty must be one of ${CERTAINTIES.join('|')}`);
  if (!(r.capturedValueStream === null || r.capturedValueStream === undefined || VALUE_STREAM_KEYS.includes(r.capturedValueStream))) e.push('capturedValueStream must be a value-stream key or null');
  if (!(r.reason === undefined || r.reason === null || typeof r.reason === 'string')) e.push('reason must be a string when present');
  if (r.status === 'requires_investigation' && !nonEmpty(r.reason)) e.push('a requires_investigation record needs a reason');
  if (!Array.isArray(r.notRepresented)) e.push('notRepresented must be an array');
  return { valid: e.length === 0, errors: e };
}

/** @param {any} project @param {string} path */
function getField(project, path) {
  const parts = path.split('.');
  /** @type {any} */ let cur = { project };
  for (const p of parts) { if (cur === null || cur === undefined) return undefined; cur = cur[p]; }
  return cur;
}

/** @param {any} rule @param {any} v @returns {boolean} */
function applyRule(rule, v) {
  switch (rule.op) {
    case 'eq': return v === rule.value;
    case 'in': return rule.value.includes(v);
    case 'gte': return typeof v === 'number' && v >= rule.value;
    case 'lte': return typeof v === 'number' && v <= rule.value;
    case 'is_true': return v === true;
    default: return false;
  }
}

/**
 * Eligibility of a project for one mechanism at `asOf` (YYYY-MM-DD). Undefined project fields give 'unknown', never 'ineligible'.
 * Availability: when the record has availableFrom/availableUntil and asOf is outside them, the result is 'ineligible'
 * (reason 'outside_availability_window'); without a valid asOf it is at best 'unknown'. When the record has
 * deadlineOrSunset text but no machine-readable availableUntil, the result is at best 'unknown'
 * (reason 'sunset_or_deadline_not_machine_readable') and the text is returned.
 * Rules with alternativeGroup null must all hold. Rules sharing one alternativeGroup label must all hold together;
 * with several labels at least one label must hold in full (AND within a label, OR across labels). If no label
 * holds but a label has only unknown fields left, the result is 'unknown'. An empty rules array gives 'unknown'.
 * @param {any} record @param {any} project @param {string} [asOf]
 */
export function checkEligibility(record, project, asOf) {
  const v = validateMechanismRecord(record);
  const quotes = record && Array.isArray(record.quotes) ? record.quotes : [];
  const notRepresented = record && Array.isArray(record.notRepresented) ? [...record.notRepresented] : [];
  const base = { id: record && record.id, failedRules: /** @type {any[]} */ ([]), unknownFields: /** @type {string[]} */ ([]),
    quotesUsed: /** @type {any[]} */ ([]), notRepresented };
  if (!v.valid) return { ...base, result: 'unknown', reason: 'invalid_record', errors: v.errors };
  if (record.status === 'requires_investigation') return { ...base, result: 'unknown', reason: `record requires investigation: ${record.reason}` };
  // availability window
  const from = isIsoDate(record.availableFrom) ? record.availableFrom : null;
  const until = isIsoDate(record.availableUntil) ? record.availableUntil : null;
  const window = from || until ? { availableFrom: from, availableUntil: until,
    quote: quoteOk(record.availabilityQuoteIndex, quotes) ? { index: record.availabilityQuoteIndex, ...quotes[record.availabilityQuoteIndex] } : null } : null;
  const asOfOk = isIsoDate(asOf);
  if (window && asOfOk && ((from && /** @type {string} */ (asOf) < from) || (until && /** @type {string} */ (asOf) > until))) {
    return { ...base, result: 'ineligible', reason: 'outside_availability_window', asOf, availability: window,
      failedRules: [{ field: 'asOf', op: 'within', value: [from, until], actual: asOf }] };
  }
  /** @type {{ reason: string, deadlineOrSunsetText?: string }|null} */ let cap = null;
  if (window && !asOfOk) cap = { reason: 'asOf_required_for_availability_window' };
  else if (record.deadlineOrSunset && nonEmpty(record.deadlineOrSunset.text) && !until) {
    cap = { reason: 'sunset_or_deadline_not_machine_readable', deadlineOrSunsetText: record.deadlineOrSunset.text };
  }
  const res = checkRules(record, project, base, quotes);
  if (window) res.availability = window;
  if (!cap) return res;
  if (cap.deadlineOrSunsetText) res.deadlineOrSunsetText = cap.deadlineOrSunsetText;
  if (res.result === 'eligible') { res.result = 'unknown'; res.reason = cap.reason; }
  else if (res.result === 'unknown') res.reason = `${res.reason}; ${cap.reason}`;
  return res;
}

/** @param {any} record @param {any} project @param {any} base @param {any[]} quotes @returns {any} */
function checkRules(record, project, base, quotes) {
  // jurisdiction gate
  const j = record.jurisdiction;
  if (j.level !== 'federal') {
    const checks = [['state', j.state, project && project.state]];
    if (j.countyFips) checks.push(['countyFips', j.countyFips, project && project.countyFips]);
    if (j.place) checks.push(['place', j.place, project && project.place]);
    for (const [k, want, have] of checks) {
      if (have === undefined || have === null) return { ...base, result: 'unknown', reason: 'jurisdiction', unknownFields: [`project.${k}`] };
      if (have !== want) return { ...base, result: 'ineligible', reason: 'jurisdiction', failedRules: [{ field: `project.${k}`, op: 'eq', value: want, actual: have }] };
    }
  }
  if (record.rules.length === 0) return { ...base, result: 'unknown', reason: 'no_eligibility_rules_encoded' };
  /** @type {Map<string, any[]>} */ const groups = new Map();
  /** @type {any[]} */ const solo = [];
  for (const ru of record.rules) {
    if (nonEmpty(ru.alternativeGroup)) { const g = groups.get(ru.alternativeGroup) || []; g.push(ru); groups.set(ru.alternativeGroup, g); }
    else solo.push(ru);
  }
  /** @param {any} ru */
  const evalRule = (ru) => {
    const val = getField(project, ru.field);
    if (val === undefined || val === null) return { ru, state: 'unknown', val };
    const vocab = RULE_VOCABULARY[ru.field];
    if (vocab && !vocab.includes(val)) return { ru, state: 'unknown', val, outOfVocabulary: true };
    return { ru, state: applyRule(ru, val) ? 'pass' : 'fail', val };
  };
  /** @type {any[]} */ const failed = [];
  /** @type {Set<string>} */ const unknownFields = new Set();
  /** @type {Set<number>} */ const used = new Set();
  let anyUnknown = false;
  for (const ru of solo) {
    const r = evalRule(ru);
    used.add(ru.quoteIndex);
    if (r.state === 'fail') failed.push({ field: ru.field, op: ru.op, value: ru.value, actual: r.val });
    else if (r.state === 'unknown') { anyUnknown = true; unknownFields.add(r.outOfVocabulary ? `${ru.field} (value ${JSON.stringify(r.val)} not in the vocabulary)` : ru.field); }
  }
  if (groups.size > 0) {
    // AND within a label, OR across labels
    const evals = [...groups].map(([name, rules]) => {
      rules.forEach((ru) => used.add(ru.quoteIndex));
      const rs = rules.map(evalRule);
      const state = rs.some((x) => x.state === 'fail') ? 'fail' : rs.some((x) => x.state === 'unknown') ? 'unknown' : 'pass';
      return { name, rs, state };
    });
    if (!evals.some((g) => g.state === 'pass')) {
      const open = evals.filter((g) => g.state === 'unknown');
      if (open.length) {
        anyUnknown = true;
        open.forEach((g) => g.rs.filter((x) => x.state === 'unknown').forEach((x) => unknownFields.add(x.outOfVocabulary ? `${x.ru.field} (value ${JSON.stringify(x.val)} not in the vocabulary)` : x.ru.field)));
      } else {
        failed.push({ alternativeGroups: evals.map((g) => ({ alternativeGroup: g.name,
          rules: g.rs.map((x) => ({ field: x.ru.field, op: x.ru.op, value: x.ru.value, actual: x.val, state: x.state })) })) });
      }
    }
  }
  const quotesUsed = [...used].filter((i) => quoteOk(i, quotes)).sort((a, b) => a - b).map((i) => ({ index: i, ...quotes[i] }));
  const result = failed.length ? 'ineligible' : anyUnknown ? 'unknown' : 'eligible';
  return { ...base, result, reason: result === 'eligible' ? 'all encoded rules met (see notRepresented for conditions not encoded)' : result,
    failedRules: failed, unknownFields: [...unknownFields], quotesUsed };
}

/**
 * Order eligible mechanisms by certainty and size the potential (never secured) amounts against the gap.
 * @param {{ gap: Quantity, candidates: any[], project: any, asOf: string,
 *   awards?: { mechanismId: string, amount: Quantity, awardRecord: { title: string, url: string, retrieved: string } }[] }} spec
 */
export function fundingStack(spec) {
  const { gap, candidates, project, asOf } = spec;
  const unit = gap && gap.unit ? gap.unit : 'USD';
  const checked = (candidates || []).map((r) => ({ record: r, eligibility: /** @type {any} */ (checkEligibility(r, project, asOf)) }));
  const eligible = checked.filter((x) => x.eligibility.result === 'eligible')
    .sort((a, b) => /** @type {any} */ (CERTAINTY_RANK)[a.record.certainty] - /** @type {any} */ (CERTAINTY_RANK)[b.record.certainty]);
  const awards = (spec.awards || []).filter((a) => a && known(a.amount) && a.awardRecord && nonEmpty(a.awardRecord.url) && nonEmpty(a.awardRecord.retrieved));
  const securedValue = awards.reduce((s, a) => s + /** @type {number} */ (a.amount.value), 0);
  const securedAmount = awards.length
    ? derived({ unit, point: securedValue, low: awards.reduce((a, x) => a + /** @type {number} */ (x.amount.low), 0),
      high: awards.reduce((a, x) => a + /** @type {number} */ (x.amount.high), 0), from: awards.map((a) => a.amount),
      assumptions: awards.map((a) => `award record ${a.awardRecord.url}`), method: 'sum of explicit award records' })
    : makeQuantity({ value: 0, unit, low: 0, high: 0, status: 'assumed', assumptions: ['no award record supplied: nothing is counted as secured'],
      jurisdiction: (gap && gap.jurisdiction) || 'unspecified', effectiveDate: asOf, method: 'no award record' });
  const gapKnown = known(gap);
  // interval subtraction: low = gap.low - secured.high, high = gap.high - secured.low, each floored at 0
  /** @type {any} */ const remaining = gapKnown
    ? { point: Math.max(0, /** @type {number} */ (gap.value) - securedValue),
      low: Math.max(0, /** @type {number} */ (gap.low) - /** @type {number} */ (securedAmount.high)),
      high: Math.max(0, /** @type {number} */ (gap.high) - /** @type {number} */ (securedAmount.low)) }
    : null;
  const remainingGap = gapKnown
    ? derived({ unit, point: remaining.point, low: remaining.low, high: remaining.high, from: [gap, ...awards.map((a) => a.amount)],
      assumptions: ['gap minus secured awards only; potential funding is not subtracted'], method: 'gap minus secured' })
    : unknownQuantity(unit, 'funding gap unknown', { inputs: ['gap'] });
  const left = remaining ? { ...remaining } : null;
  const awardedIds = new Set(awards.map((a) => a.mechanismId));
  const potential = eligible.filter((x) => !awardedIds.has(x.record.id)).map(({ record, eligibility }) => {
    const share = record.publicShare && record.publicShare.maxShareOfEligibleCost;
    const ec = project ? project.eligibleCostUsd : undefined;
    /** @type {Quantity} */ let amount;
    if (share === null || share === undefined) amount = unknownQuantity(unit, 'record gives no share cap; award size not determinable from the record', { inputs: [record.id] });
    else if (!finite(ec)) amount = unknownQuantity(unit, 'project.eligibleCostUsd unknown', { inputs: [record.id, 'project.eligibleCostUsd'] });
    else if (!left) amount = unknownQuantity(unit, 'funding gap unknown', { inputs: [record.id, 'gap'] });
    else {
      const cap = share * ec;
      const v = { point: Math.min(cap, left.point), low: Math.min(cap, left.low), high: Math.min(cap, left.high) };
      left.point -= v.point; left.low -= v.low; left.high -= v.high;
      amount = makeQuantity({ value: v.point, unit, low: Math.min(v.low, v.point), high: Math.max(v.high, v.point), status: 'assumed',
        assumptions: [`potential only (${record.certainty}); not awarded`, `capped at ${share} of eligible cost per ${record.legalBasis.citation}`, 'capped at the remaining gap'],
        jurisdiction: record.jurisdiction.level === 'federal' ? 'US' : record.jurisdiction.state, effectiveDate: asOf, inputs: [record.id, 'project.eligibleCostUsd', 'fundingGap'],
        method: 'min(maxShareOfEligibleCost x eligibleCostUsd, remaining gap)' });
    }
    return { id: record.id, name: record.name, mechanismType: record.mechanismType, certainty: record.certainty,
      guaranteed: false, neverGuaranteed: NEVER_GUARANTEED.includes(record.certainty), amount,
      matchRequirement: record.matchRequirement ?? null, deadlineOrSunset: record.deadlineOrSunset ?? null,
      capturedValueStream: record.capturedValueStream ?? null, legalBasis: record.legalBasis, quotesUsed: eligibility.quotesUsed,
      notRepresented: eligibility.notRepresented };
  });
  return Object.freeze({
    securedAmount, remainingGap,
    minimumPublicSubsidy: gap,
    minimumPublicSubsidyBasis: 'the gap left after private capacity; never raised to use available grants or credits',
    potential,
    remainingIfAllPotentialAwarded: left
      ? { point: left.point, low: left.low, high: left.high, note: 'conditional on every potential award; not a forecast' } : null,
    unknownEligibility: checked.filter((x) => x.eligibility.result === 'unknown').map((x) => ({ id: x.record && x.record.id, reason: x.eligibility.reason, unknownFields: x.eligibility.unknownFields,
      ...(x.eligibility.deadlineOrSunsetText ? { deadlineOrSunsetText: x.eligibility.deadlineOrSunsetText } : {}) })),
    ineligible: checked.filter((x) => x.eligibility.result === 'ineligible').map((x) => ({ id: x.record.id, reason: x.eligibility.reason, failedRules: x.eligibility.failedRules })),
  });
}
