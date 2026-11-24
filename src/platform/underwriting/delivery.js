// @ts-check
// Delivery-model comparison: P3 vs conventional public procurement vs fully private, on lifecycle cost in present
// value at the stated public discount rate and on risk allocation. There is no built-in efficiency assumption: each
// model's costs are caller inputs, and a missing model makes the comparison requires_investigation.
//
// Financing structure (stated, not a number): each period's capex is financed at the model's financing rate and
// repaid over termPeriods starting the next period; financing: null means capex is paid as incurred. Risk register
// expected costs are taken as present values at period 0. Transferred risk is not added to a model's cost: the
// caller's cost inputs for that model are taken to include the counterparty's pricing of the risk it bears.
import { addQ, mulQ, scaleQ, subQ } from '../schema/quantity.js';
import { CASES, caseValue, derived, known, missingInSchedule, missingQ, nonEmpty, unknownWith } from './q.js';
import { debtService, npv } from './metrics.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {{ risk: string, allocatedTo: 'public'|'private'|'shared', expectedCost: Quantity, publicShare?: Quantity }} RiskRow */
/**
 * @typedef {{ capex: Quantity[], om: Quantity[], renewal: Quantity[], financing: { rate: Quantity, termPeriods: number,
 *   type: 'level'|'interest_only' }|null, transactionCost: Quantity, riskRegister: RiskRow[], revenue?: Quantity[], hurdleRate?: Quantity }} ModelInput
 */

const MODEL_KEYS = /** @type {const} */ (['p3', 'conventional', 'private']);

/** @param {any} m @param {number} n @param {string} k @returns {string[]} */
function modelMissing(m, n, k) {
  if (!m) return [`models.${k}`];
  const out = [...missingInSchedule(m.capex, n, `${k}.capex`), ...missingInSchedule(m.om, n, `${k}.om`),
    ...missingInSchedule(m.renewal, n, `${k}.renewal`), ...missingQ(m.transactionCost, `${k}.transactionCost`)];
  if (m.financing === undefined) out.push(`${k}.financing (pass null for pay-as-you-go)`);
  else if (m.financing !== null) {
    out.push(...missingQ(m.financing.rate, `${k}.financing.rate`));
    if (!Number.isInteger(m.financing.termPeriods) || m.financing.termPeriods < 1) out.push(`${k}.financing.termPeriods`);
    if (m.financing.type !== 'level' && m.financing.type !== 'interest_only') out.push(`${k}.financing.type`);
    if (out.length === 0) {
      const last = m.capex.reduce((/** @type {number} */ a, /** @type {Quantity} */ q, /** @type {number} */ t) => (/** @type {number} */ (q.high) > 0 ? t : a), -1);
      if (last >= 0 && last + m.financing.termPeriods > n - 1) out.push(`${k}.financing horizon (repayment runs past the last period)`);
    }
  }
  if (!Array.isArray(m.riskRegister) || m.riskRegister.length === 0) out.push(`${k}.riskRegister (state every risk; an empty register is not zero risk)`);
  else m.riskRegister.forEach((/** @type {any} */ r, /** @type {number} */ i) => {
    if (!r || !nonEmpty(r.risk) || !['public', 'private', 'shared'].includes(r.allocatedTo)) out.push(`${k}.riskRegister[${i}] (risk, allocatedTo)`);
    else {
      out.push(...missingQ(r.expectedCost, `${k}.riskRegister[${i}].expectedCost`));
      if (r.allocatedTo === 'shared') out.push(...missingQ(r.publicShare, `${k}.riskRegister[${i}].publicShare (shared risk needs the public share)`));
    }
  });
  return out;
}

/** Cost stream for one case. @param {ModelInput} m @param {number} n @param {'point'|'low'|'high'} c */
function costStream(m, n, c) {
  const s = new Array(n).fill(0);
  for (let t = 0; t < n; t++) s[t] += caseValue(m.om[t], c, 'cost') + caseValue(m.renewal[t], c, 'cost');
  s[0] += caseValue(m.transactionCost, c, 'cost');
  for (let t = 0; t < n; t++) {
    const k = caseValue(m.capex[t], c, 'cost');
    if (!m.financing) { s[t] += k; continue; }
    if (k === 0) continue;
    const rate = caseValue(m.financing.rate, c, 'cost');
    for (const row of debtService(k, rate, m.financing.termPeriods, m.financing.type).schedule) s[t + row.period] += row.payment;
  }
  return s;
}

/** @param {ModelInput} m @param {string} k */
function riskTable(m, k) {
  return m.riskRegister.map((r) => {
    const publicPortion = r.allocatedTo === 'public' ? r.expectedCost
      : r.allocatedTo === 'private' ? scaleQ(r.expectedCost, 0) : mulQ(r.expectedCost, /** @type {Quantity} */ (r.publicShare));
    return { model: k, risk: r.risk, allocatedTo: r.allocatedTo, expectedCost: r.expectedCost, publicPortion,
      privatePortion: subQ(r.expectedCost, publicPortion) };
  });
}

/** @param {Quantity[]} qs @param {string} unit @param {string} what */
const sumQ = (qs, unit, what) => (qs.length ? qs.reduce((a, b) => addQ(a, b)) : unknownWith(unit, what, ['riskRegister']));

/**
 * @param {{ periods: number, publicDiscountRate: Quantity, models: { p3?: ModelInput, conventional?: ModelInput, private?: ModelInput } }} spec
 */
export function compareDeliveryModels(spec) {
  const n = spec.periods;
  if (!Number.isInteger(n) || n < 1) throw new RangeError('compareDeliveryModels: periods must be a positive integer');
  const pr = spec.publicDiscountRate;
  const prMissing = missingQ(pr, 'publicDiscountRate');
  const models = spec.models || {};
  /** @type {Record<string, any>} */ const out = {};
  /** @type {any[]} */ const riskAllocation = [];
  let unit = 'USD';
  for (const k of MODEL_KEYS) {
    const m = /** @type {any} */ (models)[k];
    if (m && Array.isArray(m.capex) && known(m.capex[0])) { unit = m.capex[0].unit; break; }
  }
  for (const k of MODEL_KEYS) {
    const m = /** @type {ModelInput|undefined} */ (/** @type {any} */ (models)[k]);
    const miss = [...prMissing, ...modelMissing(m, n, k)];
    if (k === 'private' && m) miss.push(...missingInSchedule(m.revenue, n, 'private.revenue'), ...missingQ(m.hurdleRate, 'private.hurdleRate'));
    if (miss.length || !m) {
      out[k] = { status: 'requires_investigation', missing: miss,
        lifecycleCostPv: unknownWith(unit, `${k} lifecycle cost unknown`, miss), publicRetainedRisk: unknownWith(unit, `${k} risk unknown`, miss),
        riskTransferred: unknownWith(unit, `${k} risk unknown`, miss), totalPublicCostPv: unknownWith(unit, `${k} public cost unknown`, miss) };
      continue;
    }
    const rr = /** @type {Quantity} */ (pr);
    const streams = { point: costStream(m, n, 'point'), low: costStream(m, n, 'low'), high: costStream(m, n, 'high') };
    const rates = [/** @type {number} */ (rr.low), /** @type {number} */ (rr.value), /** @type {number} */ (rr.high)];
    const pvs = [];
    for (const r of rates) for (const c of CASES) pvs.push(npv(r, streams[c]));
    const from = [rr, ...m.capex, ...m.om, ...m.renewal, m.transactionCost, ...(m.financing ? [m.financing.rate] : [])];
    const lifecycleCostPv = derived({ unit, point: npv(/** @type {number} */ (rr.value), streams.point), low: Math.min(...pvs), high: Math.max(...pvs), from,
      method: `${k}: PV at the public discount rate of O&M + renewal + transaction cost + ${m.financing ? 'debt service on financed capex' : 'capex as incurred'}; range over input cases and the public-rate range` });
    const table = riskTable(m, k);
    riskAllocation.push(...table);
    const publicRetainedRisk = sumQ(table.map((x) => x.publicPortion), unit, 'no risks');
    const riskTransferred = sumQ(table.map((x) => x.privatePortion), unit, 'no risks');
    /** @type {any} */ const row = { status: 'ok', missing: [], lifecycleCostPv, publicRetainedRisk, riskTransferred,
      costStreamByCase: streams };
    if (k === 'private') {
      const h = /** @type {Quantity} */ (m.hurdleRate);
      const rev = /** @type {Quantity[]} */ (m.revenue);
      /** @type {Record<string, number>} */ const npvAtHurdle = {};
      for (const c of CASES) npvAtHurdle[c] = npv(caseValue(h, c, 'cost'), rev.map((q, t) => caseValue(q, c, 'benefit') - streams[c][t]));
      row.npvAtHurdleByCase = npvAtHurdle;
      row.costBorneBy = 'private';
      if (npvAtHurdle.point < 0) {
        row.status = 'not_applicable';
        row.reason = 'revenue_cannot_meet_hurdle: project revenue less lifecycle cost has negative NPV at the private hurdle rate (point case)';
      } else row.hurdleMetInLowCase = npvAtHurdle.low >= 0;
      row.totalPublicCostPv = publicRetainedRisk;
    } else {
      row.costBorneBy = 'public (directly or through payments to the private partner)';
      row.totalPublicCostPv = addQ(lifecycleCostPv, publicRetainedRisk);
    }
    out[k] = row;
  }
  const vfmMissing = [...(out.p3.missing || []), ...(out.conventional.missing || [])];
  const valueForMoney = vfmMissing.length
    ? unknownWith(unit, 'value for money needs caller-supplied inputs for both P3 and conventional (no efficiency is assumed)', vfmMissing)
    : subQ(out.conventional.totalPublicCostPv, out.p3.totalPublicCostPv);
  return Object.freeze({
    status: vfmMissing.length ? 'requires_investigation' : 'ok',
    models: out, riskAllocation, valueForMoney,
    valueForMoneyDefinition: 'conventional (lifecycle cost + public retained risk) minus P3 (lifecycle cost + public retained risk), PV at the public discount rate; positive favours P3; range by interval arithmetic',
    efficiencyAssumption: 'none: every model cost is a caller input',
  });
}
