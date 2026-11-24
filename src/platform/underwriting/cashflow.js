// @ts-check
// Cash flow builder. Three coherent series are built, not interval arithmetic per period:
//   point = point inputs; low = low revenue with high capex, high O&M and the high interest rate;
//   high = high revenue with low capex, low O&M and the low interest rate.
// Every metric is computed on one of these series, so IRR is never taken over mismatched bounds.
import { CASES, caseValue, derived, known, missingInSchedule, missingQ, unknownWith } from './q.js';
import { debtService, dscr } from './metrics.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {import('./q.js').CaseSeries} CaseSeries */
/**
 * @typedef {{ principal: Quantity, rate: Quantity, termPeriods: number, type: 'level'|'interest_only', drawPeriod: number }} Financing
 */

export const CASE_DEFINITION = Object.freeze({
  point: 'point value of every input',
  low: 'low revenue, high capex, high O&M, high interest rate (adverse)',
  high: 'high revenue, low capex, low O&M, low interest rate (favourable)',
});

/** @param {Financing|null|undefined} f @param {number} periods @returns {string[]} */
function financingMissing(f, periods) {
  if (f === null) return [];
  if (f === undefined) return ['financing (pass null for an all-equity project)'];
  const m = [...missingQ(f.principal, 'financing.principal'), ...missingQ(f.rate, 'financing.rate')];
  if (!Number.isInteger(f.termPeriods) || f.termPeriods < 1) m.push('financing.termPeriods');
  if (f.type !== 'level' && f.type !== 'interest_only') m.push('financing.type');
  if (!Number.isInteger(f.drawPeriod) || f.drawPeriod < 0) m.push('financing.drawPeriod');
  if (m.length === 0 && f.drawPeriod + f.termPeriods > periods - 1) {
    m.push('financing horizon (debt term runs past the last period; supply periods covering the term)');
  }
  return m;
}

/**
 * @param {{ periods: number, capexSchedule: Quantity[], omSchedule: Quantity[], revenueSchedule: Quantity[],
 *   financing?: Financing|null, asOf: string }} spec
 */
export function buildCashFlow(spec) {
  const { periods, capexSchedule, omSchedule, revenueSchedule, financing, asOf } = spec;
  if (!Number.isInteger(periods) || periods < 2) throw new RangeError('buildCashFlow: periods must be an integer >= 2');
  const mRev = missingInSchedule(revenueSchedule, periods, 'revenueSchedule');
  const mOm = missingInSchedule(omSchedule, periods, 'omSchedule');
  const mCapex = missingInSchedule(capexSchedule, periods, 'capexSchedule');
  const mFin = financingMissing(financing, periods);
  const all = [revenueSchedule, omSchedule, capexSchedule].flatMap((a) => (Array.isArray(a) ? a.filter(known) : []));
  const unit = all.length ? all[0].unit : 'USD';
  for (const q of all) if (q.unit !== unit) throw new Error(`buildCashFlow: mixed units ${unit} and ${q.unit}`);
  if (financing && known(financing.principal) && financing.principal.unit !== unit) {
    throw new Error(`buildCashFlow: financing.principal unit ${financing.principal.unit} differs from ${unit}`);
  }

  const need = { netOperating: [...mRev, ...mOm], unleveredNet: [...mRev, ...mOm, ...mCapex] };
  const needLevered = [...need.unleveredNet, ...mFin];
  const assumptions = [];
  if (financing && known(financing.principal) && financing.principal.low !== financing.principal.high) {
    assumptions.push('financing principal range not propagated: the point principal is used in every case');
  }

  /** @type {CaseSeries|null} */ let netOp = null;
  /** @type {CaseSeries|null} */ let unlev = null;
  /** @type {CaseSeries|null} */ let capexC = null;
  /** @type {CaseSeries|null} */ let dsC = null;
  /** @type {CaseSeries|null} */ let lev = null;
  if (need.netOperating.length === 0) {
    netOp = { point: [], low: [], high: [] };
    for (const c of CASES) {
      netOp[c] = revenueSchedule.map((r, t) => caseValue(r, c, 'benefit') - caseValue(omSchedule[t], c, 'cost'));
    }
  }
  if (netOp && need.unleveredNet.length === 0) {
    const n = netOp;
    capexC = { point: [], low: [], high: [] };
    unlev = { point: [], low: [], high: [] };
    for (const c of CASES) {
      capexC[c] = capexSchedule.map((k) => caseValue(k, c, 'cost'));
      unlev[c] = n[c].map((x, t) => x - /** @type {CaseSeries} */ (capexC)[c][t]);
    }
  }
  if (unlev && needLevered.length === 0) {
    const u = unlev;
    dsC = { point: [], low: [], high: [] };
    lev = { point: [], low: [], high: [] };
    for (const c of CASES) {
      const ds = new Array(periods).fill(0);
      const draw = new Array(periods).fill(0);
      if (financing) {
        const P = /** @type {number} */ (financing.principal.value);
        const r = caseValue(financing.rate, c, 'cost');
        draw[financing.drawPeriod] = P;
        for (const row of debtService(P, r, financing.termPeriods, financing.type).schedule) ds[financing.drawPeriod + row.period] = row.payment;
      }
      dsC[c] = ds;
      lev[c] = u[c].map((x, t) => x + draw[t] - ds[t]);
    }
  }

  /** @param {CaseSeries|null} cs @param {string[]} miss @param {(t:number)=>Quantity[]} from @param {string} name */
  const toQ = (cs, miss, from, name) => Array.from({ length: periods }, (_, t) => (cs
    ? derived({ unit, point: cs.point[t], low: cs.low[t], high: cs.high[t], from: from(t), assumptions,
      method: `${name}[${t}] from coherent cases`, label: `${name}[${t}]` })
    : unknownWith(unit, `${name}[${t}] cannot be computed`, miss)));

  const finQs = financing ? [financing.principal, financing.rate] : [];
  const series = {
    netOperating: toQ(netOp, need.netOperating, (t) => [revenueSchedule[t], omSchedule[t]], 'netOperating'),
    unleveredNet: toQ(unlev, need.unleveredNet, (t) => [revenueSchedule[t], omSchedule[t], capexSchedule[t]], 'unleveredNet'),
    debtService: dsC && financing ? toQ(dsC, [], () => finQs, 'debtService')
      : (dsC ? null : Array.from({ length: periods }, () => unknownWith(unit, 'debt service cannot be computed', mFin.length ? mFin : needLevered))),
    levered: toQ(lev, needLevered, (t) => [revenueSchedule[t], omSchedule[t], capexSchedule[t], ...finQs], 'levered'),
  };
  const dscrCases = lev && financing && netOp && dsC
    ? { point: dscr(netOp.point, dsC.point), low: dscr(netOp.low, dsC.low), high: dscr(netOp.high, dsC.high) }
    : null;
  const missing = [...new Set(needLevered)];
  return Object.freeze({
    status: missing.length ? 'requires_investigation' : 'ok',
    periods, asOf, unit, missing,
    dependentMissing: { netOperating: need.netOperating, unleveredNet: need.unleveredNet, levered: needLevered },
    inputs: { revenue: revenueSchedule, om: omSchedule, capex: capexSchedule, financing: financing ?? null },
    series,
    cases: { netOperating: netOp, capex: capexC, unleveredNet: unlev, debtService: dsC, levered: lev },
    dscr: dscrCases,
    dscrNote: financing === null ? 'no debt: DSCR not applicable' : (dscrCases ? null : `DSCR needs net operating income and debt service: missing ${needLevered.join(', ')}`),
    caseDefinition: CASE_DEFINITION,
    assumptions,
  });
}
