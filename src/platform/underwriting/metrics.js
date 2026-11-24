// @ts-check
// Investment metrics. The numeric core works on plain numbers (period 0 first); the Quantity wrappers add
// provenance and coherent low/high cases. Only numerical tolerances live here, never market parameters.
import { unknownQuantity } from '../schema/quantity.js';
import { CASES, caseRate, caseValue, derived, finite, known, unknownWith } from './q.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {import('./q.js').CaseSeries} CaseSeries */

const RATE_TOL = 1e-12;
const MAX_ITER = 300;

/** @param {number} rate */
function assertRate(rate) {
  if (!finite(rate) || rate <= -1) throw new RangeError('rate must be a finite number greater than -1');
}

/** Net present value; flows[0] is undiscounted. @param {number} rate @param {number[]} flows */
export function npv(rate, flows) {
  assertRate(rate);
  let acc = 0;
  let df = 1;
  const k = 1 / (1 + rate);
  for (let t = 0; t < flows.length; t++) {
    acc += flows[t] * df;
    df *= k;
  }
  return acc;
}

/** Number of sign changes, ignoring zeros (Descartes' bound on the number of IRRs). @param {number[]} flows */
export function signChanges(flows) {
  let n = 0;
  let prev = 0;
  for (const f of flows) {
    if (f === 0) continue;
    const s = f > 0 ? 1 : -1;
    if (prev !== 0 && s !== prev) n++;
    prev = s;
  }
  return n;
}

/** Bisection on a bracket [a, b] with f(a), f(b) of opposite sign. @param {(r:number)=>number} f @param {number} a @param {number} b */
function bisect(f, a, b) {
  let fa = f(a);
  for (let i = 0; i < MAX_ITER; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0 || (b - a) / 2 < RATE_TOL) return m;
    if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m;
  }
  return 0.5 * (a + b);
}

/** Search grid for brackets (numerical device, not a market assumption): toward -1 and upward geometrically. */
function rateGrid() {
  const g = [];
  for (let k = 40; k >= 1; k--) g.push(-1 + Math.pow(2, -k));
  for (let r = -0.5; r < 1; r += 0.01) g.push(Math.round(r * 1e6) / 1e6);
  for (let r = 1; r <= 1e6; r *= 1.25) g.push(r);
  return g;
}
const GRID = rateGrid();

/**
 * Modified IRR. @param {number[]} flows @param {number} financeRate @param {number} reinvestmentRate
 * @returns {number|null}
 */
export function mirr(flows, financeRate, reinvestmentRate) {
  assertRate(financeRate); assertRate(reinvestmentRate);
  const n = flows.length - 1;
  if (n < 1) return null;
  let pvNeg = 0, fvPos = 0;
  for (let t = 0; t <= n; t++) {
    const f = flows[t];
    if (f < 0) pvNeg += f / Math.pow(1 + financeRate, t);
    else if (f > 0) fvPos += f * Math.pow(1 + reinvestmentRate, n - t);
  }
  if (pvNeg === 0 || fvPos === 0) return null;
  return Math.pow(fvPos / -pvNeg, 1 / n) - 1;
}

/**
 * @typedef {{ value: number|null, reason: string|null, signChanges: number, multipleIrrPossible: boolean,
 *   roots: number[], mirr: number|null, mirrReason: string|null }} IrrResult
 */

/**
 * Internal rate of return by bracketing and bisection.
 * - no sign change: value null, reason 'no_sign_change'.
 * - more than one sign change: multipleIrrPossible; every root found on the bracket grid is listed; value is the
 *   root only when exactly one was found, else null with reason 'multiple_irr'; MIRR when both rates are supplied.
 * @param {number[]} flows @param {{ financeRate?: number, reinvestmentRate?: number }} [opts] @returns {IrrResult}
 */
export function irr(flows, opts = {}) {
  if (!Array.isArray(flows) || flows.length < 2 || !flows.every(finite)) throw new TypeError('irr: at least two finite flows required');
  const sc = signChanges(flows);
  const multiple = sc > 1;
  const haveRates = finite(opts.financeRate) && finite(opts.reinvestmentRate);
  const m = haveRates ? mirr(flows, /** @type {number} */ (opts.financeRate), /** @type {number} */ (opts.reinvestmentRate)) : null;
  const mirrReason = haveRates ? (m === null ? 'mirr_undefined_needs_positive_and_negative_flows' : null) : 'finance_and_reinvestment_rates_not_supplied';
  const base = { signChanges: sc, multipleIrrPossible: multiple, mirr: m, mirrReason };
  if (sc === 0) return { value: null, reason: 'no_sign_change', roots: [], ...base };
  const f = (/** @type {number} */ r) => npv(r, flows);
  /** @type {number[]} */ const roots = [];
  let prevR = GRID[0];
  let prevF = f(prevR);
  if (prevF === 0) roots.push(prevR);
  for (let i = 1; i < GRID.length; i++) {
    const r = GRID[i];
    const fr = f(r);
    if (!Number.isFinite(fr) || !Number.isFinite(prevF)) { prevR = r; prevF = fr; continue; }
    if (fr === 0) roots.push(r);
    else if (prevF !== 0 && (fr > 0) !== (prevF > 0)) roots.push(bisect(f, prevR, r));
    prevR = r; prevF = fr;
    if (!multiple && roots.length === 1) break;
  }
  if (roots.length === 1) return { value: roots[0], reason: null, roots, ...base };
  if (roots.length === 0) return { value: null, reason: 'no_root_found_on_bracket_grid', roots, ...base };
  return { value: null, reason: 'multiple_irr', roots, ...base };
}

/**
 * Payback period with a reason. Counting starts only once the cumulative flow first goes negative (the outlay may
 * start in any period); the payback is the first time after that the cumulative flow recovers to 0 or above,
 * interpolated linearly within the period and measured from period 0.
 * - cumulative flow never negative: value null, reason 'no_initial_outlay'.
 * - cumulative flow never recovers: value null, reason 'cumulative_flow_never_recovers'.
 * @param {number[]} flows @returns {{ value: number|null, reason: string|null }}
 */
export function paybackPeriodDetail(flows) {
  if (!Array.isArray(flows) || flows.length === 0) return { value: null, reason: 'no_flows' };
  let cum = 0;
  let inOutlay = false;
  for (let t = 0; t < flows.length; t++) {
    const prev = cum;
    cum += flows[t];
    if (!inOutlay) { if (cum < 0) inOutlay = true; continue; }
    if (cum >= 0) return { value: t - 1 + -prev / flows[t], reason: null };
  }
  return { value: null, reason: inOutlay ? 'cumulative_flow_never_recovers' : 'no_initial_outlay' };
}

/** Payback period as a number, or null (see paybackPeriodDetail for the reason). @param {number[]} flows @returns {number|null} */
export function paybackPeriod(flows) {
  return paybackPeriodDetail(flows).value;
}

/** Sum of positive flows over the absolute sum of negative flows. @param {number[]} flows @returns {number|null} */
export function equityMultiple(flows) {
  let pos = 0, neg = 0;
  for (const f of flows) { if (f > 0) pos += f; else neg -= f; }
  return neg === 0 ? null : pos / neg;
}

/**
 * @typedef {{ period: number, payment: number, interest: number, principal: number, balance: number }} DebtRow
 */

/**
 * Debt service schedule (periods 1..term after the draw). 'level' = annuity; 'interest_only' = interest each
 * period with the principal repaid in the final period.
 * @param {number} principal @param {number} rate @param {number} term @param {'level'|'interest_only'} type
 * @returns {{ payment: number, schedule: DebtRow[] }}
 */
export function debtService(principal, rate, term, type) {
  if (!finite(principal) || principal < 0) throw new RangeError('debtService: principal must be >= 0');
  assertRate(rate);
  if (!Number.isInteger(term) || term < 1) throw new RangeError('debtService: term must be a positive integer');
  if (type !== 'level' && type !== 'interest_only') throw new RangeError("debtService: type must be 'level' or 'interest_only'");
  const pay = type === 'level'
    ? (rate === 0 ? principal / term : principal * rate / (1 - Math.pow(1 + rate, -term)))
    : principal * rate;
  /** @type {DebtRow[]} */ const schedule = [];
  let bal = principal;
  for (let p = 1; p <= term; p++) {
    const interest = bal * rate;
    let prin = type === 'level' ? pay - interest : (p === term ? bal : 0);
    if (p === term) prin = bal;
    const payment = interest + prin;
    bal -= prin;
    schedule.push({ period: p, payment, interest, principal: prin, balance: Math.abs(bal) < 1e-9 * Math.max(1, principal) ? 0 : bal });
  }
  return { payment: pay, schedule };
}

/** Debt service coverage per period; null where debt service is zero. @param {number[]} noi @param {number[]} ds */
export function dscr(noi, ds) {
  return noi.map((n, i) => (ds[i] > 0 ? n / ds[i] : null));
}

// ---------- Quantity wrappers ----------

/**
 * Present value of a Quantity schedule at a Quantity rate over coherent cases. Low case = low benefit (or high cost)
 * at the high rate; high case = high benefit (or low cost) at the low rate.
 * @param {Quantity} rate @param {Quantity[]} series @param {{ kind: 'benefit'|'cost', unit?: string, label?: string }} opts
 * @returns {Quantity}
 */
export function pvQ(rate, series, opts) {
  /** @type {string[]} */ const missing = [];
  if (!known(rate)) missing.push('rate');
  if (!Array.isArray(series) || series.length === 0) missing.push('series');
  else series.forEach((q, i) => { if (!known(q)) missing.push(`series[${i}]`); });
  const unit = opts.unit || (Array.isArray(series) && series[0] ? series[0].unit : '');
  if (missing.length) return unknownWith(unit, 'pvQ: cannot discount', missing);
  /** @type {Record<string, number>} */ const out = {};
  for (const c of CASES) {
    // adverse case for a benefit is a high rate; for a cost the adverse (high-cost) case is a low rate
    const r = caseRate(rate, c, opts.kind === 'benefit');
    const flows = series.map((q) => caseValue(q, c, opts.kind));
    out[c] = npv(r, flows);
  }
  return derived({ unit, point: out.point, low: out.low, high: out.high, from: [rate, ...series],
    method: `present value at ${rate.label || 'the stated rate'} over coherent ${opts.kind} cases`, label: opts.label });
}

/**
 * NPV of coherent case series at a Quantity rate (low case discounted at the high rate).
 * @param {Quantity} rate @param {CaseSeries|null} cases @param {{ unit: string, from: Quantity[], missing?: string[], label?: string }} meta
 */
export function npvCases(rate, cases, meta) {
  const missing = [...(meta.missing || []), ...(known(rate) ? [] : ['rate'])];
  if (missing.length || !cases) return unknownWith(meta.unit, 'npv: cannot compute', missing.length ? missing : ['cash flow']);
  const v = { point: npv(/** @type {number} */ (rate.value), cases.point), low: npv(/** @type {number} */ (rate.high), cases.low),
    high: npv(/** @type {number} */ (rate.low), cases.high) };
  return derived({ unit: meta.unit, point: v.point, low: v.low, high: v.high, from: [rate, ...meta.from],
    method: 'NPV of coherent cases (low case at the high rate, high case at the low rate)', label: meta.label });
}

/**
 * IRR of each coherent case plus a Quantity summary when all three are defined.
 * @param {CaseSeries|null} cases @param {{ from: Quantity[], missing?: string[], financeRate?: Quantity, reinvestmentRate?: Quantity }} meta
 */
export function irrCases(cases, meta) {
  const missing = meta.missing || [];
  if (missing.length || !cases) {
    return { point: null, low: null, high: null, quantity: unknownWith('ratio', 'irr: cannot compute', missing.length ? missing : ['cash flow']) };
  }
  const opts = known(meta.financeRate) && known(meta.reinvestmentRate)
    ? { financeRate: /** @type {number} */ (meta.financeRate.value), reinvestmentRate: /** @type {number} */ (meta.reinvestmentRate.value) }
    : {};
  const res = { point: irr(cases.point, opts), low: irr(cases.low, opts), high: irr(cases.high, opts) };
  const vals = [res.point.value, res.low.value, res.high.value];
  const quantity = vals.every((x) => x !== null)
    ? derived({ unit: 'ratio', point: /** @type {number} */ (vals[0]), low: /** @type {number} */ (vals[1]), high: /** @type {number} */ (vals[2]),
      from: meta.from, method: 'IRR of each coherent case (bracketing + bisection)' })
    : unknownQuantity('ratio', `irr undefined in at least one case (${[res.point, res.low, res.high].map((r) => r.reason || 'ok').join(', ')})`);
  return { ...res, quantity };
}
