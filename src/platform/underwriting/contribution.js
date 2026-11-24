// @ts-check
// P3 contribution engine. Solves the largest private contribution at which the private party still earns its
// hurdle, the minimum public contribution (the funding gap), and the public ceiling from the public streams the
// caller marks as countable. The recommendation is always the minimum public contribution, never the ceiling.
// Basis: the recommendation, the funding gap, the ceiling and the deal range are present values at the public
// discount rate; nominal amounts are reported alongside (by period and summed) and labelled as nominal.
//
// Contribution timing: the private party funds the share s = C / totalCost of every period's cost (pro rata), the
// public party funds the rest. When all cost falls in period 0 this is an up-front contribution.
import { VALUE_STREAM_KEYS } from '../schema/opportunity.js';
import { CASES, caseRate, caseValue, derived, known, missingInSchedule, missingQ, nonEmpty, unknownWith } from './q.js';
import { npv } from './metrics.js';
import { unknownQuantity } from '../schema/quantity.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {import('./q.js').CaseName} CaseName */
/** @typedef {{ flows: Quantity[], capturedBy: string, mechanism: string }} PublicStream */

const BISECT_REL_TOL = 1e-12;
const BELOW_HURDLE_AT_ZERO = 'private_flows_do_not_meet_hurdle_even_with_zero_contribution';
export const BELOW_HURDLE_DEAL_REASON = 'private_return_below_hurdle_at_any_contribution';
/** Basis labels. A nominal figure is never compared with a present-value figure. */
export const BASIS = Object.freeze({
  nominal: 'nominal (undiscounted sum over periods)',
  nominalByPeriod: 'nominal, by period',
  pv: 'present value at the public discount rate',
  pvHurdle: 'present value at the private hurdle rate',
});
/** The basis of every money figure in the contributionRange output. */
const FIGURE_BASIS = Object.freeze({
  totalCost: BASIS.nominal, maxPrivateContribution: BASIS.nominal, minPublicContribution: BASIS.nominal,
  minPublicContributionNominalByPeriod: BASIS.nominalByPeriod, minPublicContributionPv: BASIS.pv, fundingGap: BASIS.pv,
  recommendedPublicContribution: BASIS.pv, publicCeiling: BASIS.pv, publicValueByStream: BASIS.pv, range: BASIS.pv,
  byCase: `${BASIS.pv} (operatingShortfallAtHurdle: ${BASIS.pvHurdle})`, operatingShortfall: BASIS.pvHurdle,
  dealTest: 'min public contribution PV <= public ceiling PV, per case',
});

/**
 * Largest C in [0, totalCost] with NPV_h(F - (C/totalCost)·K) >= 0, by monotone bisection.
 * @param {number[]} K cost per period @param {number[]} F private net flows per period @param {number} h hurdle
 * @returns {{ contribution: number, share: number, capped: boolean, reason: string|null }}
 */
export function solveMaxPrivate(K, F, h) {
  const total = K.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new RangeError('solveMaxPrivate: total cost must be positive');
  const f = (/** @type {number} */ c) => npv(h, F.map((x, t) => x - (c / total) * K[t]));
  // NPV of the private operating flows at the hurdle <= 0: no private contribution is feasible (max is 0).
  if (f(0) <= 0) return { contribution: 0, share: 0, capped: false, reason: BELOW_HURDLE_AT_ZERO };
  if (f(total) >= 0) return { contribution: total, share: 1, capped: true, reason: 'private_party_can_fund_entire_cost_at_hurdle' };
  let lo = 0, hi = total;
  for (let i = 0; i < 200 && hi - lo > BISECT_REL_TOL * total; i++) {
    const m = 0.5 * (lo + hi);
    if (f(m) >= 0) lo = m; else hi = m;
  }
  return { contribution: lo, share: lo / total, capped: false, reason: null };
}

/**
 * @param {{ costSchedule: Quantity[], privateNetFlows: Quantity[], hurdleRate: Quantity, publicDiscountRate?: Quantity,
 *   publicStreams?: Record<string, PublicStream>, countable?: { streams: string[], basis?: string },
 *   privateMechanism?: string }} spec
 */
export function contributionRange(spec) {
  const n = Array.isArray(spec.costSchedule) ? spec.costSchedule.length : 0;
  const unit = n && known(spec.costSchedule[0]) ? spec.costSchedule[0].unit : 'USD';
  const privMissing = [
    ...(n ? missingInSchedule(spec.costSchedule, n, 'costSchedule') : ['costSchedule']),
    ...missingInSchedule(spec.privateNetFlows, n, 'privateNetFlows'),
    ...missingQ(spec.hurdleRate, 'hurdleRate'),
  ];
  const streams = spec.publicStreams || {};
  for (const k of Object.keys(streams)) {
    if (!VALUE_STREAM_KEYS.includes(k) || k === 'investorCashFlow') throw new Error(`contributionRange: ${k} is not a public value stream key`);
  }
  const countableList = spec.countable && Array.isArray(spec.countable.streams) ? spec.countable.streams : [];
  const pubMissing = [...missingQ(spec.publicDiscountRate, 'publicDiscountRate')];
  if (countableList.length === 0) pubMissing.push('countable (public streams the public party may count)');
  for (const k of countableList) {
    const s = streams[k];
    if (!s) pubMissing.push(`publicStreams.${k}`);
    else pubMissing.push(...missingInSchedule(s.flows, n, `publicStreams.${k}.flows`));
  }

  // ---- private side
  /** @type {Record<CaseName, any>|null} */ let priv = null;
  if (privMissing.length === 0) {
    priv = /** @type {any} */ ({});
    for (const c of CASES) {
      const K = spec.costSchedule.map((q) => caseValue(q, c, 'cost'));
      const F = spec.privateNetFlows.map((q) => caseValue(q, c, 'benefit'));
      const h = caseRate(spec.hurdleRate, c, true);
      const total = K.reduce((a, b) => a + b, 0);
      if (!(total > 0)) { privMissing.push('costSchedule (total cost must be positive)'); priv = null; break; }
      const sol = solveMaxPrivate(K, F, h);
      const operatingNpvAtHurdle = npv(h, F);
      /** @type {any} */ (priv)[c] = { K, F, hurdle: h, totalCost: total, ...sol, minPublic: Math.max(0, total - sol.contribution),
        operatingNpvAtHurdle, belowHurdleAtAnyContribution: sol.reason === BELOW_HURDLE_AT_ZERO };
    }
  }
  const privFrom = privMissing.length ? [] : [...spec.costSchedule, ...spec.privateNetFlows, spec.hurdleRate];
  const qOr = (/** @type {(c: CaseName) => number} */ get, /** @type {string} */ method, /** @type {Quantity[]} */ from, /** @type {string[]} */ miss, /** @type {string} */ what) => (
    miss.length === 0 ? derived({ unit, point: get('point'), low: get('low'), high: get('high'), from, method, label: what.replace(/ unknown$/, '') }) : unknownWith(unit, what, miss));
  const p = /** @type {Record<CaseName, any>} */ (priv || {});
  const totalCost = qOr((c) => p[c].totalCost, 'sum of the cost schedule (nominal)', privFrom, privMissing, 'total cost (nominal) unknown');
  const maxPrivateContribution = qOr((c) => p[c].contribution,
    'largest pro-rata private contribution with NPV at the hurdle >= 0 (monotone bisection), nominal sum', privFrom, privMissing, 'max private contribution (nominal) unknown');
  const minPublicContribution = qOr((c) => p[c].minPublic,
    'max(0, total cost - max private contribution), nominal sum over periods', privFrom, privMissing, 'min public contribution (nominal) unknown');
  /** @type {Quantity[]} */ const minPublicContributionNominalByPeriod = Array.from({ length: n }, (_, t) => qOr((c) => (1 - p[c].share) * p[c].K[t],
    `public share of period ${t} cost, nominal`, privFrom, privMissing, `min public contribution period ${t} (nominal) unknown`));

  // ---- public side, per stream (never summed without a stated no-overlap basis)
  const pr = spec.publicDiscountRate;
  /** @type {Record<string, any>} */ const publicValueByStream = {};
  /** @type {Record<string, Record<CaseName, number>>} */ const streamPv = {};
  for (const [k, s] of Object.entries(streams)) {
    const miss = [...missingQ(pr, 'publicDiscountRate'), ...missingInSchedule(s.flows, n, `publicStreams.${k}.flows`)];
    if (!nonEmpty(s.capturedBy) || !nonEmpty(s.mechanism)) throw new Error(`contributionRange: publicStreams.${k} needs capturedBy and mechanism (use none_identified)`);
    let pv;
    if (miss.length === 0) {
      const rr = /** @type {Quantity} */ (pr);
      /** @type {Record<CaseName, number>} */ const v = /** @type {any} */ ({});
      for (const c of CASES) v[c] = npv(caseRate(rr, c, true), s.flows.map((q) => caseValue(q, c, 'benefit')));
      streamPv[k] = v;
      pv = derived({ unit, point: v.point, low: v.low, high: v.high, from: [rr, ...s.flows],
        method: `present value of ${k} at the public discount rate`, label: k });
    } else pv = unknownWith(unit, `${k} present value unknown`, miss);
    publicValueByStream[k] = { pv, capturedBy: s.capturedBy, mechanism: s.mechanism, countable: countableList.includes(k) };
  }
  const basisStated = !!(spec.countable && nonEmpty(spec.countable.basis));
  /** @type {string} */ let ceilingBasis;
  /** @type {Record<CaseName, number>|null} */ let ceil = null;
  if (pubMissing.length === 0) {
    ceil = /** @type {any} */ ({});
    if (countableList.length === 1) ceilingBasis = 'single_countable_stream';
    else if (basisStated) ceilingBasis = 'sum_of_countable_streams_with_stated_no_overlap_basis';
    else ceilingBasis = 'largest_single_countable_stream (no no-overlap basis stated, so streams are not added)';
    for (const c of CASES) {
      const vals = countableList.map((k) => streamPv[k][c]);
      /** @type {any} */ (ceil)[c] = countableList.length > 1 && basisStated ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals);
    }
  } else ceilingBasis = 'not_computed';
  const ceilFrom = pubMissing.length ? [] : [/** @type {Quantity} */ (pr), ...countableList.flatMap((k) => streams[k].flows)];
  const cc = /** @type {Record<CaseName, number>} */ (ceil || {});
  const publicCeiling = pubMissing.length === 0
    ? derived({ unit, point: cc.point, low: cc.low, high: cc.high, from: ceilFrom,
      label: `public ceiling (${BASIS.pv})`, method: `public ceiling: ${ceilingBasis}`, assumptions: basisStated && countableList.length > 1 ? [`no-overlap basis: ${/** @type {any} */ (spec.countable).basis}`] : [] })
    : unknownWith(unit, 'public ceiling unknown', pubMissing);

  // ---- deal test in present-value terms at the public discount rate (same rate on both sides within a case).
  // A case where the private operating flows miss the hurdle even with zero private contribution is no_deal: the
  // private party would need an operating subsidy too, and this engine has none. It is never both_benefit.
  /** @type {Record<CaseName, any>} */ const byCase = /** @type {any} */ ({});
  /** @type {Quantity} */ let minPublicContributionPv = unknownWith(unit, 'min public contribution PV unknown', [...privMissing, ...missingQ(pr, 'publicDiscountRate')]);
  /** @type {Record<CaseName, number>|null} */ let mpv = null;
  if (priv && known(pr)) {
    mpv = /** @type {any} */ ({});
    for (const c of CASES) /** @type {any} */ (mpv)[c] = (1 - p[c].share) * npv(caseRate(pr, c, true), p[c].K);
    const m = /** @type {Record<CaseName, number>} */ (mpv);
    minPublicContributionPv = derived({ unit, point: m.point, low: m.low, high: m.high, from: [...privFrom, pr],
      method: 'public share of each period cost, discounted at the public discount rate', label: `min public contribution (${BASIS.pv})` });
  }
  if (priv) {
    for (const c of CASES) {
      if (p[c].belowHurdleAtAnyContribution) {
        byCase[c] = { deal: 'no_deal', reason: BELOW_HURDLE_DEAL_REASON, operatingShortfallAtHurdle: Math.max(0, -p[c].operatingNpvAtHurdle),
          operatingShortfallBasis: BASIS.pvHurdle };
      } else if (!mpv || !ceil) byCase[c] = { deal: 'unknown', missing: [...new Set([...missingQ(pr, 'publicDiscountRate'), ...pubMissing])] };
      else {
        const surplus = ceil[c] - mpv[c];
        byCase[c] = surplus >= 0
          ? { deal: 'both_benefit', fromPv: mpv[c], toPv: ceil[c], basis: BASIS.pv }
          : { deal: 'no_deal', reason: 'public_ceiling_below_min_public_contribution', shortByPv: -surplus, basis: BASIS.pv };
      }
    }
  } else for (const c of CASES) byCase[c] = { deal: 'unknown', missing: [...privMissing, ...pubMissing] };

  // Operating shortfall (PV at the hurdle): the subsidy beyond capital the private party would need, per case.
  const anyBelow = !!priv && CASES.some((c) => p[c].belowHurdleAtAnyContribution);
  const operatingShortfall = anyBelow
    ? derived({ unit, point: Math.max(0, -p.point.operatingNpvAtHurdle), low: Math.max(0, -p.low.operatingNpvAtHurdle), high: Math.max(0, -p.high.operatingNpvAtHurdle),
      from: privFrom, label: `private operating shortfall (${BASIS.pvHurdle})`,
      method: 'max(0, -(NPV of private net operating flows at the hurdle)) per case: the operating subsidy the private party would need with zero contribution' })
    : null;

  /** @type {any} */ let range;
  const deals = CASES.map((c) => byCase[c].deal);
  const perCase = Object.fromEntries(CASES.map((c) => [c, byCase[c]]));
  if (byCase.point.deal === 'unknown') {
    range = { deal: 'unknown', missing: [...new Set([...privMissing, ...pubMissing, ...missingQ(pr, 'publicDiscountRate')])] };
  } else if (new Set(deals).size > 1) {
    range = { deal: 'case_dependent', pointCaseDeal: byCase.point.deal, basis: BASIS.pv, byCase: perCase,
      note: 'the low, point and high cases disagree on whether a deal exists; read each case, no single range is stated' };
  } else if (byCase.point.deal === 'both_benefit') {
    range = { deal: 'both_benefit', basis: BASIS.pv, from: minPublicContributionPv, to: publicCeiling, byCase: perCase,
      note: 'in every case both parties benefit for a public contribution (present value at the public discount rate) between that case\'s from and to' };
  } else if (CASES.every((c) => byCase[c].reason === BELOW_HURDLE_DEAL_REASON)) {
    range = { deal: 'no_deal', reason: BELOW_HURDLE_DEAL_REASON, shortfall: operatingShortfall, basis: BASIS.pvHurdle, byCase: perCase,
      note: 'private operating flows miss the hurdle even with zero private contribution: no capital contribution makes the deal work' };
  } else if (CASES.every((c) => byCase[c].reason === 'public_ceiling_below_min_public_contribution')) {
    const sb = (/** @type {CaseName} */ c) => byCase[c].shortByPv;
    range = { deal: 'no_deal', reason: 'public_ceiling_below_min_public_contribution', basis: BASIS.pv, byCase: perCase,
      shortBy: derived({ unit, point: sb('point'), low: sb('low'), high: sb('high'), label: `public ceiling shortfall (${BASIS.pv})`,
        from: [minPublicContributionPv, publicCeiling], method: 'min public contribution PV minus public ceiling, per case' }) };
  } else {
    range = { deal: 'no_deal', reason: 'mixed_no_deal_reasons_by_case', basis: BASIS.pv, byCase: perCase, shortfall: operatingShortfall };
  }

  // Recommendation: the minimum public contribution in PV (same basis as the range and the ceiling). None exists when
  // the point case misses the hurdle at any contribution.
  const recommendedPublicContribution = priv && p.point.belowHurdleAtAnyContribution
    ? unknownQuantity(unit, `no public capital contribution lets the private party reach its hurdle (${BELOW_HURDLE_DEAL_REASON})`, { status: 'unavailable', inputs: ['privateNetFlows', 'hurdleRate'] })
    : minPublicContributionPv;

  const missing = [...new Set([...privMissing, ...pubMissing])];
  return Object.freeze({
    status: missing.length ? 'requires_investigation' : 'ok',
    missing,
    timing: 'private funds a pro-rata share of every period cost; the public party funds the remainder',
    totalCost, maxPrivateContribution, minPublicContribution, minPublicContributionNominalByPeriod, minPublicContributionPv,
    fundingGap: minPublicContributionPv,
    privateByCase: priv ? Object.fromEntries(CASES.map((c) => [c, { contribution: p[c].contribution, share: p[c].share,
      cappedAtTotalCost: p[c].capped, hurdle: p[c].hurdle, reason: p[c].reason }])) : null,
    publicValueByStream, publicCeiling, ceilingBasis,
    range, byCase, operatingShortfall,
    recommendedPublicContribution,
    basis: FIGURE_BASIS,
    recommendationBasis: 'the minimum public contribution that lets the private party reach its hurdle; the public ceiling is a limit on rational public support, never a recommendation',
    capture: [
      { party: 'private', stream: 'investorCashFlow', mechanism: spec.privateMechanism || 'none_identified',
        what: 'project net operating cash flow, in exchange for the private contribution' },
      ...Object.entries(publicValueByStream).map(([k, v]) => ({ party: v.capturedBy, stream: k, mechanism: v.mechanism,
        what: v.countable ? 'counted toward the public ceiling' : 'reported only; not counted toward the public ceiling' })),
    ],
  });
}

