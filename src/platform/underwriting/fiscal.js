// @ts-check
// Municipal fiscal effect. Municipal tax revenue is its own stream (municipalTaxRevenue), never merged with investor
// cash flow or property appreciation. The assessment rule is caller-supplied data with a state and a source; the
// engine applies it generically and refuses a rule from another state.
import { CASES, caseValue, derived, known, missingInSchedule, missingQ, nonEmpty, unknownWith } from './q.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/**
 * @typedef {{ id: string, state: string, source: { title: string, url: string, retrieved: string, quote?: string },
 *   annualIncreaseCap: Quantity|null, reassessOnSale: boolean }} AssessmentRule
 */

/** @param {any} rule @returns {string[]} */
function ruleProblems(rule) {
  if (!rule || typeof rule !== 'object') return ['assessmentRule'];
  const m = [];
  if (!nonEmpty(rule.id)) m.push('assessmentRule.id');
  if (!(typeof rule.state === 'string' && /^[A-Z]{2}$/.test(rule.state))) m.push('assessmentRule.state');
  const s = rule.source;
  if (!s || !nonEmpty(s.title) || !nonEmpty(s.url) || !nonEmpty(s.retrieved)) m.push('assessmentRule.source (title, url, retrieved)');
  if (!(rule.annualIncreaseCap === null || known(rule.annualIncreaseCap))) m.push('assessmentRule.annualIncreaseCap (Quantity or explicit null for no cap)');
  if (typeof rule.reassessOnSale !== 'boolean') m.push('assessmentRule.reassessOnSale');
  return m;
}

/**
 * Year t = period t. Market value of the added assessed value grows at marketValueGrowth; the assessed value follows
 * the rule (capped growth, reset to market value in a sale year when reassessOnSale).
 * @param {{ project: { state?: string }, assessedValueChange: Quantity, marketValueGrowth?: Quantity, taxRate: Quantity,
 *   jurisdictionShare: Quantity, assessmentRule: AssessmentRule, saleYears?: number[], otherRevenues: Quantity[],
 *   serviceCosts: Quantity[], horizon: number, capturedBy?: string }} spec
 */
export function municipalFiscalEffect(spec) {
  const { horizon } = spec;
  if (!Number.isInteger(horizon) || horizon < 1) throw new RangeError('municipalFiscalEffect: horizon must be a positive integer');
  const unit = known(spec.assessedValueChange) ? spec.assessedValueChange.unit : 'USD';
  const state = spec.project && spec.project.state;
  const rule = spec.assessmentRule;
  const separation = Object.freeze({ stream: 'municipalTaxRevenue', notMergedWith: ['investorCashFlow', 'propertyAppreciation'] });
  if (rule && typeof rule === 'object' && nonEmpty(rule.state) && nonEmpty(state) && rule.state !== state) {
    const reason = `assessment rule ${rule.id} is for ${rule.state}; the project is in ${state}. Rules are not applied across states.`;
    return Object.freeze({ status: 'refused', reason: 'assessment_rule_jurisdiction_mismatch', detail: reason, missing: [],
      municipalTaxRevenue: { byYear: Array.from({ length: horizon }, () => unknownWith(unit, reason, [])), capturedBy: spec.capturedBy || 'municipality', mechanism: 'property_tax' },
      netFiscalEffectByYear: Array.from({ length: horizon }, () => unknownWith(unit, reason, [])), separation });
  }
  const taxMissing = [
    ...(nonEmpty(state) ? [] : ['project.state']), ...ruleProblems(rule),
    ...missingQ(spec.assessedValueChange, 'assessedValueChange'), ...missingQ(spec.taxRate, 'taxRate'), ...missingQ(spec.jurisdictionShare, 'jurisdictionShare'),
  ];
  const needsGrowth = horizon > 1;
  if (needsGrowth) taxMissing.push(...missingQ(spec.marketValueGrowth, 'marketValueGrowth'));
  if (rule && rule.reassessOnSale === true && !Array.isArray(spec.saleYears)) taxMissing.push('saleYears (pass [] for no sale in the horizon)');
  const netMissing = [...taxMissing, ...missingInSchedule(spec.otherRevenues, horizon, 'otherRevenues'), ...missingInSchedule(spec.serviceCosts, horizon, 'serviceCosts')];

  /** @type {Record<string, number[]>|null} */ let tax = null;
  /** @type {Record<string, number[]>|null} */ let avPath = null;
  if (taxMissing.length === 0) {
    tax = {}; avPath = {};
    const sales = new Set(spec.saleYears || []);
    for (const c of CASES) {
      const av0 = caseValue(spec.assessedValueChange, c, 'benefit');
      const g = needsGrowth ? caseValue(/** @type {Quantity} */ (spec.marketValueGrowth), c, 'benefit') : 0;
      const cap = rule.annualIncreaseCap ? caseValue(rule.annualIncreaseCap, c, 'benefit') : null;
      const rate = caseValue(spec.taxRate, c, 'benefit') * caseValue(spec.jurisdictionShare, c, 'benefit');
      const av = [av0];
      let mv = av0;
      for (let t = 1; t < horizon; t++) {
        mv *= 1 + g;
        let a = cap === null ? mv : Math.min(mv, av[t - 1] * (1 + cap));
        if (rule.reassessOnSale && sales.has(t)) a = mv;
        av.push(a);
      }
      avPath[c] = av;
      tax[c] = av.map((a) => a * rate);
    }
  }
  const taxFrom = taxMissing.length ? [] : /** @type {Quantity[]} */ ([spec.assessedValueChange, spec.taxRate, spec.jurisdictionShare,
    ...(needsGrowth ? [spec.marketValueGrowth] : []), ...(rule.annualIncreaseCap ? [rule.annualIncreaseCap] : [])]);
  const ruleNote = `assessment rule ${rule && rule.id} (${rule && rule.state}) from ${rule && rule.source && rule.source.url}`;
  const t0 = /** @type {Record<string, number[]>} */ (tax || {});
  const byYear = Array.from({ length: horizon }, (_, t) => (tax
    ? derived({ unit, point: t0.point[t], low: t0.low[t], high: t0.high[t], from: taxFrom, assumptions: [ruleNote],
      method: `municipal tax revenue year ${t}: assessed value under the rule x tax rate x jurisdiction share`, label: `municipalTaxRevenue[${t}]` })
    : unknownWith(unit, `municipal tax revenue year ${t} unknown`, taxMissing)));
  const net = Array.from({ length: horizon }, (_, t) => {
    if (netMissing.length || !tax) return unknownWith(unit, `net fiscal effect year ${t} unknown`, netMissing);
    const o = spec.otherRevenues[t], s = spec.serviceCosts[t];
    const v = (/** @type {'point'|'low'|'high'} */ c) => t0[c][t] + caseValue(o, c, 'benefit') - caseValue(s, c, 'cost');
    return derived({ unit, point: v('point'), low: v('low'), high: v('high'), from: [...taxFrom, o, s], assumptions: [ruleNote],
      method: `net fiscal effect year ${t}: tax revenue + other revenues - service costs`, label: `netFiscalEffect[${t}]` });
  });
  const missing = [...new Set(netMissing)];
  return Object.freeze({
    status: missing.length ? 'requires_investigation' : 'ok', missing,
    ruleApplied: taxMissing.length ? null : { id: rule.id, state: rule.state, source: rule.source },
    assessedValuePath: avPath,
    municipalTaxRevenue: { byYear, capturedBy: spec.capturedBy || 'municipality', mechanism: 'property_tax' },
    otherRevenues: spec.otherRevenues, serviceCosts: spec.serviceCosts,
    netFiscalEffectByYear: net, separation,
  });
}
