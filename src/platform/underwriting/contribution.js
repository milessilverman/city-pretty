// @ts-check
// P3 contribution engine. Solves the largest private contribution at which the private party still earns its
// hurdle, the minimum public contribution (the funding gap), and the public ceiling from the public streams the
// caller marks as countable. The recommendation is always the minimum public contribution, never the ceiling.
//
// Contribution timing: the private party funds the share s = C / totalCost of every period's cost (pro rata), the
// public party funds the rest. When all cost falls in period 0 this is an up-front contribution.
import { VALUE_STREAM_KEYS } from '../schema/opportunity.js';
import { CASES, caseRate, caseValue, derived, known, missingInSchedule, missingQ, nonEmpty, unknownWith } from './q.js';
import { npv } from './metrics.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {import('./q.js').CaseName} CaseName */
/** @typedef {{ flows: Quantity[], capturedBy: string, mechanism: string }} PublicStream */

const BISECT_REL_TOL = 1e-12;

/**
 * Largest C in [0, totalCost] with NPV_h(F - (C/totalCost)·K) >= 0, by monotone bisection.
 * @param {number[]} K cost per period @param {number[]} F private net flows per period @param {number} h hurdle
 * @returns {{ contribution: number, share: number, capped: boolean, reason: string|null }}
 */
export function solveMaxPrivate(K, F, h) {
  const total = K.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new RangeError('solveMaxPrivate: total cost must be positive');
  const f = (/** @type {number} */ c) => npv(h, F.map((x, t) => x - (c / total) * K[t]));
  if (f(0) < 0) return { contribution: 0, share: 0, capped: false, reason: 'private_flows_do_not_meet_hurdle_even_with_zero_contribution' };
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
      /** @type {any} */ (priv)[c] = { K, F, hurdle: h, totalCost: total, ...sol, minPublic: Math.max(0, total - sol.contribution) };
    }
  }
  const privFrom = privMissing.length ? [] : [...spec.costSchedule, ...spec.privateNetFlows, spec.hurdleRate];
  const qOr = (/** @type {(c: CaseName) => number} */ get, /** @type {string} */ method, /** @type {Quantity[]} */ from, /** @type {string[]} */ miss, /** @type {string} */ what) => (
    miss.length === 0 ? derived({ unit, point: get('point'), low: get('low'), high: get('high'), from, method }) : unknownWith(unit, what, miss));
  const p = /** @type {Record<CaseName, any>} */ (priv || {});
  const totalCost = qOr((c) => p[c].totalCost, 'sum of the cost schedule (nominal)', privFrom, privMissing, 'total cost unknown');
  const maxPrivateContribution = qOr((c) => p[c].contribution,
    'largest pro-rata private contribution with NPV at the hurdle >= 0 (monotone bisection)', privFrom, privMissing, 'max private contribution unknown');
  const minPublicContribution = qOr((c) => p[c].minPublic,
    'max(0, total cost - max private contribution), nominal', privFrom, privMissing, 'min public contribution unknown');

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
      method: `public ceiling: ${ceilingBasis}`, assumptions: basisStated && countableList.length > 1 ? [`no-overlap basis: ${/** @type {any} */ (spec.countable).basis}`] : [] })
    : unknownWith(unit, 'public ceiling unknown', pubMissing);

  // ---- deal test in present-value terms at the public discount rate (same rate on both sides within a case)
  /** @type {Record<CaseName, any>} */ const byCase = /** @type {any} */ ({});
  /** @type {Quantity} */ let minPublicContributionPv = unknownWith(unit, 'min public contribution PV unknown', [...privMissing, ...missingQ(pr, 'publicDiscountRate')]);
  if (priv && known(pr)) {
    /** @type {Record<CaseName, number>} */ const mpv = /** @type {any} */ ({});
    for (const c of CASES) mpv[c] = (1 - p[c].share) * npv(caseRate(pr, c, true), p[c].K);
    minPublicContributionPv = derived({ unit, point: mpv.point, low: mpv.low, high: mpv.high, from: [...privFrom, pr],
      method: 'public share of each period cost, discounted at the public discount rate' });
    for (const c of CASES) {
      if (!ceil) { byCase[c] = { deal: 'unknown', missing: pubMissing }; continue; }
      const surplus = ceil[c] - mpv[c];
      byCase[c] = surplus >= 0
        ? { deal: 'both_benefit', fromPv: mpv[c], toPv: ceil[c] }
        : { deal: 'no_deal', shortByPv: -surplus };
    }
  } else for (const c of CASES) byCase[c] = { deal: 'unknown', missing: [...privMissing, ...pubMissing] };

  /** @type {any} */ let range;
  if (byCase.point.deal === 'both_benefit') {
    range = { deal: 'both_benefit', from: minPublicContributionPv, to: publicCeiling,
      note: 'both parties benefit for a public contribution (present value) between from and to' };
  } else if (byCase.point.deal === 'no_deal') {
    const sb = (/** @type {CaseName} */ c) => (byCase[c].deal === 'no_deal' ? byCase[c].shortByPv : 0);
    range = { deal: 'no_deal', shortBy: derived({ unit, point: sb('point'), low: sb('low'), high: sb('high'),
      from: [minPublicContributionPv, publicCeiling], method: 'min public contribution PV minus public ceiling, floored at 0 per case' }) };
  } else range = { deal: 'unknown', missing: [...new Set([...privMissing, ...pubMissing])] };

  const missing = [...new Set([...privMissing, ...pubMissing])];
  return Object.freeze({
    status: missing.length ? 'requires_investigation' : 'ok',
    missing,
    timing: 'private funds a pro-rata share of every period cost; the public party funds the remainder',
    totalCost, maxPrivateContribution, minPublicContribution, fundingGap: minPublicContribution, minPublicContributionPv,
    privateByCase: priv ? Object.fromEntries(CASES.map((c) => [c, { contribution: p[c].contribution, share: p[c].share,
      cappedAtTotalCost: p[c].capped, hurdle: p[c].hurdle, reason: p[c].reason }])) : null,
    publicValueByStream, publicCeiling, ceilingBasis,
    range, byCase,
    recommendedPublicContribution: minPublicContribution,
    recommendationBasis: 'the minimum public contribution that lets the private party reach its hurdle; the public ceiling is a limit on rational public support, never a recommendation',
    capture: [
      { party: 'private', stream: 'investorCashFlow', mechanism: spec.privateMechanism || 'none_identified',
        what: 'project net operating cash flow, in exchange for the private contribution' },
      ...Object.entries(publicValueByStream).map(([k, v]) => ({ party: v.capturedBy, stream: k, mechanism: v.mechanism,
        what: v.countable ? 'counted toward the public ceiling' : 'reported only; not counted toward the public ceiling' })),
    ],
  });
}

