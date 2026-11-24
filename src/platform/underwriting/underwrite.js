// @ts-check
// Orchestrator: one opportunity/use in, every underwriting output plus a financial check out. The check is shaped
// for Opportunity.checks.financial (pass | fail with reason and basis | unknown with a missing list).
import { makeValueStreams } from '../schema/opportunity.js';
import { unknownQuantity } from '../schema/quantity.js';
import { buildCashFlow } from './cashflow.js';
import { equityMultiple, irrCases, npv, npvCases, paybackPeriodDetail, pvQ, signChanges } from './metrics.js';
import { riskAdjusted } from './risk.js';
import { BELOW_HURDLE_DEAL_REASON, contributionRange } from './contribution.js';
import { municipalFiscalEffect } from './fiscal.js';
import { compareDeliveryModels } from './delivery.js';
import { fundingStack } from './funding.js';
import { CASES, caseRate, known } from './q.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */

/**
 * @param {any} project
 */
export function underwrite(project) {
  const p = project || {};
  const designated = /** @type {'point'|'low'|'high'} */ (CASES.includes(p.designatedCase) ? p.designatedCase : 'low');
  // Structural inputs: without them nothing can be built. Report them as missing instead of throwing.
  const structural = [
    ...(Number.isInteger(p.periods) && p.periods >= 2 ? [] : ['periods']),
    ...['capexSchedule', 'revenueSchedule', 'omSchedule'].filter((k) => !Array.isArray(p[k])),
  ];
  if (structural.length) {
    const missing = [...structural, ...(known(p.hurdleRate) ? [] : ['hurdleRate'])];
    const ri = { status: 'requires_investigation', missing };
    const fc = { result: 'unknown', reasons: [`underwriting inputs missing: ${missing.join(', ')}`], missing, designatedCase: designated };
    return Object.freeze({ id: p.id, use: p.use, asOf: p.asOf, status: 'requires_investigation', missing,
      cashFlow: ri, metrics: null, risk: ri, contribution: ri, fiscal: ri, delivery: ri, funding: ri, valueStreams: null,
      financialCheck: Object.freeze({ ...fc, reason: fc.reasons.join('; ') }) });
  }
  const cashFlow = buildCashFlow({ periods: p.periods, capexSchedule: p.capexSchedule, omSchedule: p.omSchedule,
    revenueSchedule: p.revenueSchedule, financing: p.financing, asOf: p.asOf });
  const unit = cashFlow.unit;
  const cfMissing = cashFlow.dependentMissing.unleveredNet;
  const hurdleMissing = known(p.hurdleRate) ? [] : ['hurdleRate'];
  const from = [...(Array.isArray(p.revenueSchedule) ? p.revenueSchedule : []), ...(Array.isArray(p.omSchedule) ? p.omSchedule : []),
    ...(Array.isArray(p.capexSchedule) ? p.capexSchedule : [])].filter(known);

  // ---- metrics on the coherent unlevered series (and levered when financing is known)
  const unlev = cashFlow.cases.unleveredNet;
  const irrU = irrCases(unlev, { from, missing: cfMissing, financeRate: p.financeRate, reinvestmentRate: p.reinvestmentRate });
  const lev = cashFlow.cases.levered;
  const metrics = {
    unlevered: {
      irr: irrU,
      npvAtHurdle: npvCases(p.hurdleRate, unlev, { unit, from, missing: [...cfMissing, ...hurdleMissing] }),
      payback: unlev ? Object.fromEntries(CASES.map((c) => [c, paybackPeriodDetail(unlev[c])])) : null,
      equityMultiple: unlev ? { point: equityMultiple(unlev.point), low: equityMultiple(unlev.low), high: equityMultiple(unlev.high) } : null,
    },
    levered: lev ? { irr: irrCases(lev, { from, financeRate: p.financeRate, reinvestmentRate: p.reinvestmentRate }) } : null,
    dscr: cashFlow.dscr,
  };

  // ---- risk
  // No default rate: a missing scenarioDiscountRate makes the risk output requires_investigation.
  const risk = riskAdjusted({ scenarios: p.scenarios || [], discountRate: p.scenarioDiscountRate, discountRateName: 'scenarioDiscountRate', unit });

  // ---- contribution (unlevered: private capital as a whole earns the hurdle)
  const contribution = contributionRange({ costSchedule: p.capexSchedule, privateNetFlows: /** @type {Quantity[]} */ (cashFlow.series.netOperating),
    hurdleRate: p.hurdleRate, publicDiscountRate: p.publicDiscountRate, publicStreams: p.publicStreams, countable: p.countable,
    privateMechanism: p.privateMechanism });

  // ---- fiscal, delivery, funding (each optional; absence is reported, never zero)
  const fiscal = p.fiscal ? municipalFiscalEffect({ project: { state: p.state }, ...p.fiscal })
    : { status: 'requires_investigation', missing: ['fiscal inputs'] };
  const delivery = p.delivery ? compareDeliveryModels({ periods: p.periods, publicDiscountRate: p.publicDiscountRate, ...p.delivery })
    : { status: 'requires_investigation', missing: ['delivery-model inputs'] };
  const funding = p.funding ? fundingStack({ gap: contribution.fundingGap, candidates: p.funding.candidates,
    project: p.funding.descriptor, asOf: p.asOf, awards: p.funding.awards })
    : { status: 'requires_investigation', missing: ['funding candidates and project descriptor'] };

  // ---- value streams: seven separate keys, never totalled
  const nq = (/** @type {string} */ why) => unknownQuantity(unit, why);
  const pubPv = (/** @type {string} */ k) => (contribution.publicValueByStream[k] ? contribution.publicValueByStream[k] : null);
  const vsIn = p.valueStreamInputs || {};
  const fiscalPv = fiscal && /** @type {any} */ (fiscal).municipalTaxRevenue && known(p.publicDiscountRate)
    ? pvQ(p.publicDiscountRate, /** @type {any} */ (fiscal).municipalTaxRevenue.byYear, { kind: 'benefit', unit }) : null;
  /** @param {string} k @param {string} capturedBy */
  const fromPublic = (k, capturedBy) => {
    const s = pubPv(k);
    return s ? { amount: s.pv, capturedBy: s.capturedBy, mechanism: s.mechanism }
      : { amount: nq(`${k} not supplied`), capturedBy, mechanism: 'none_identified' };
  };
  /** @param {string} k */
  const fromInput = (k) => (vsIn[k] ? vsIn[k] : { amount: nq(`${k} is not computed by underwriting; supply it`), capturedBy: 'unknown', mechanism: 'none_identified' });
  const valueStreams = makeValueStreams({
    propertyAppreciation: fromInput('propertyAppreciation'),
    developmentProfit: fromInput('developmentProfit'),
    municipalTaxRevenue: fiscalPv && fiscalPv.value !== null
      ? { amount: fiscalPv, capturedBy: /** @type {any} */ (fiscal).municipalTaxRevenue.capturedBy, mechanism: 'property_tax' }
      : fromPublic('municipalTaxRevenue', 'municipality'),
    publicEconomicBenefit: fromPublic('publicEconomicBenefit', 'public'),
    investorCashFlow: { amount: pvQ(p.hurdleRate, /** @type {Quantity[]} */ (cashFlow.series.netOperating), { kind: 'benefit', unit, label: 'PV of net operating cash flow at the hurdle rate' }),
      capturedBy: 'private partner', mechanism: p.privateMechanism || 'none_identified' },
    operatingRevenue: { amount: Array.isArray(p.revenueSchedule) ? pvQ(p.hurdleRate, p.revenueSchedule, { kind: 'benefit', unit }) : nq('revenueSchedule missing'),
      capturedBy: 'project operator', mechanism: p.privateMechanism || 'none_identified' },
    capturableLandValue: fromPublic('capturableLandValue', 'public'),
  });

  // ---- financial check. Primary test: NPV of the designated-case unlevered flows at the hurdle >= 0. IRR is reported;
  // for non-conventional flows (first non-zero flow positive, or more than one sign change) only NPV is used.
  /** @type {any} */ let financialCheck;
  if (cfMissing.length || hurdleMissing.length) {
    financialCheck = { result: 'unknown', reasons: ['cash flow or hurdle missing'], missing: [...cfMissing, ...hurdleMissing] };
  } else {
    const ir = irrU[designated];
    const h = caseRate(p.hurdleRate, designated, true);
    const flows = /** @type {number[]} */ (/** @type {any} */ (unlev)[designated]);
    const npvH = npv(h, flows);
    const firstNonZero = flows.find((x) => x !== 0);
    const conventional = firstNonZero !== undefined && firstNonZero < 0 && signChanges(flows) <= 1;
    const irrText = ir && ir.value !== null ? `IRR ${ir.value}` : `IRR undefined (${ir ? ir.reason : 'unavailable'})`;
    const testText = conventional
      ? `${designated}-case NPV at hurdle ${h} = ${npvH} (${irrText}, reported only)`
      : `${designated}-case flows are non-conventional (first non-zero flow positive or more than one sign change): NPV at hurdle ${h} = ${npvH} is the only test; IRR not used (${irrText})`;
    const common = { test: 'npv_at_hurdle', npvAtHurdle: npvH, irr: ir ? ir.value : null, conventionalFlows: conventional };
    const deal = contribution.byCase[designated];
    if (firstNonZero !== undefined && npvH >= 0) financialCheck = { result: 'pass', reasons: [`${testText} >= 0`], missing: [], ...common };
    else if (deal.deal === 'both_benefit') {
      financialCheck = { result: 'pass', reasons: [`${testText} < 0`, `${designated}-case both-benefit range is non-empty: public contribution PV ${deal.fromPv} to ${deal.toPv} (${deal.basis})`], missing: [], ...common };
    } else if (deal.deal === 'no_deal' && deal.reason === BELOW_HURDLE_DEAL_REASON) {
      financialCheck = { result: 'fail', basis: 'financial', reasonCode: BELOW_HURDLE_DEAL_REASON, shortfall: contribution.operatingShortfall, ...common,
        reasons: [`${testText} < 0`, `${BELOW_HURDLE_DEAL_REASON}: private operating flows miss the hurdle even with zero private contribution; an operating subsidy of ${deal.operatingShortfallAtHurdle} (${deal.operatingShortfallBasis}) would also be needed, which this engine does not model`] };
    } else if (deal.deal === 'no_deal') {
      financialCheck = { result: 'fail', basis: 'financial', reasonCode: deal.reason, ...common,
        reasons: [`${testText} < 0`, `no deal: public ceiling short of the minimum public contribution by ${deal.shortByPv} (${deal.basis})`] };
    } else {
      financialCheck = { result: 'unknown', ...common, reasons: [`${testText}${firstNonZero === undefined ? ' (no non-zero flow)' : ' < 0'}`, 'the both-benefit range could not be computed'],
        missing: deal.missing && deal.missing.length ? [...deal.missing] : ['contribution inputs'] };
    }
  }
  financialCheck.reason = financialCheck.reasons.join('; ');
  financialCheck.designatedCase = designated;

  return Object.freeze({ id: p.id, use: p.use, asOf: p.asOf, cashFlow, metrics, risk, contribution, fiscal, delivery, funding, valueStreams,
    financialCheck: Object.freeze(financialCheck) });
}
