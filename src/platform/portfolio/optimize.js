// @ts-check
// Portfolio optimiser: exact branch and bound for small n, labelled heuristic above. Deterministic.
import { isQuantity, addQ, subQ, unknownQuantity } from '../schema/quantity.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/**
 * @typedef {{ id: string, cost: Quantity, objectiveValue: Quantity, irr: number|null, publicOutcome: Record<string, number>,
 *   startPeriod: number, endPeriod: number, excludes: string[], requires: string[] }} Candidate
 */

/** @param {Quantity} like @param {string} unit @returns {Quantity} */
function zeroLike(like, unit) {
  return Object.freeze({ value: 0, unit, low: 0, high: 0, status: 'assumed', source: null, jurisdiction: like.jurisdiction, effectiveDate: like.effectiveDate,
    inputs: Object.freeze([]), assumptions: Object.freeze(['empty selection']), method: 'zero of an empty selection' });
}
/** @param {Quantity[]} qs @param {Quantity} like @param {string} unit */
function sumQ(qs, like, unit) {
  if (qs.length === 0) return zeroLike(like, unit);
  let acc = qs[0];
  for (let i = 1; i < qs.length; i++) acc = addQ(acc, qs[i]);
  return acc;
}

/**
 * @param {{ candidates: Candidate[], constraints: { budget: Quantity, minReturn?: number|null, horizon?: number|null,
 *   minPublicOutcomes?: Record<string, number>|null }, interactions?: { a: string, b: string, adjustment: Quantity }[]|null,
 *   objective: 'maximize', conservative?: boolean, maxExact?: number, maxPasses?: number }} spec
 */
export function optimizePortfolio(spec) {
  const { candidates, constraints, objective } = spec;
  if (objective !== 'maximize') throw new Error("optimizePortfolio: objective must be 'maximize'");
  const conservative = spec.conservative === true;
  const maxExact = spec.maxExact ?? 20;
  const maxPasses = spec.maxPasses ?? 200;
  const budget = constraints.budget;
  if (!isQuantity(budget) || budget.value === null) throw new Error('optimizePortfolio: budget must be a known Quantity');
  const ids = candidates.map((c) => c.id);
  const horizon = constraints.horizon ?? null;
  if (new Set(ids).size !== ids.length) throw new Error('optimizePortfolio: duplicate candidate ids');

  // ---- eligibility: unknown cost or objective is not worthless, it is not assessed
  /** @type {{ id: string, reason: string }[]} */ const notOptimised = [];
  /** @type {Candidate[]} */ let pool = [];
  for (const c of candidates) {
    const why = [];
    if (!isQuantity(c.cost) || c.cost.value === null) why.push('cost unknown');
    else if (c.cost.unit !== budget.unit) why.push(`cost unit ${c.cost.unit} differs from budget unit ${budget.unit}`);
    else if (/** @type {number} */ (c.cost.low) < 0) why.push('negative cost not supported');
    if (!isQuantity(c.objectiveValue) || c.objectiveValue.value === null) why.push('objective value unknown');
    for (const r of c.requires || []) if (!ids.includes(r)) why.push(`requires unknown candidate ${r}`);
    if (horizon !== null && !Number.isFinite(c.endPeriod)) why.push('end period unknown, so the horizon cannot be checked');
    if (why.length) notOptimised.push({ id: c.id, reason: why.join('; ') });
    else pool.push(c);
  }
  for (let changed = true; changed;) { // a requirement on a not-optimised candidate cannot be met
    changed = false;
    const bad = new Set(notOptimised.map((n) => n.id));
    pool = pool.filter((c) => {
      const r = (c.requires || []).find((x) => bad.has(x));
      if (r === undefined) return true;
      notOptimised.push({ id: c.id, reason: `requires ${r}, which is not fully assessed` });
      changed = true;
      return false;
    });
  }
  const objUnits = new Set(pool.map((c) => c.objectiveValue.unit));
  if (objUnits.size > 1) throw new Error('optimizePortfolio: objective values must share one unit (' + [...objUnits].join(', ') + ')');
  const excludedByHorizon = horizon === null ? [] : pool.filter((c) => c.endPeriod > horizon).map((c) => c.id);
  pool = pool.filter((c) => !excludedByHorizon.includes(c.id));
  // requirement on a horizon-excluded candidate also cannot be met
  for (let changed = true; changed;) {
    changed = false;
    const gone = new Set(excludedByHorizon);
    pool = pool.filter((c) => {
      if (!(c.requires || []).some((x) => gone.has(x))) return true;
      excludedByHorizon.push(c.id); changed = true; return false;
    });
  }
  pool.sort((x, y) => (y.objectiveValue.value ?? 0) - (x.objectiveValue.value ?? 0) || (x.id < y.id ? -1 : 1));
  const n = pool.length;
  const idx = new Map(pool.map((c, i) => [c.id, i]));
  const cost = pool.map((c) => /** @type {number} */ (conservative ? c.cost.high : c.cost.value));
  const obj = pool.map((c) => /** @type {number} */ (c.objectiveValue.value));
  // conservative: highest cost against the lowest budget
  const B = /** @type {number} */ (conservative ? budget.low : budget.value);
  const excl = pool.map(() => /** @type {number[]} */ ([]));
  const req = pool.map(() => /** @type {number[]} */ ([]));
  pool.forEach((c, i) => {
    for (const e of c.excludes || []) { const j = idx.get(e); if (j !== undefined) { excl[i].push(j); excl[j].push(i); } }
    for (const r of c.requires || []) req[i].push(/** @type {number} */ (idx.get(r)));
  });
  // pairwise interactions
  /** @type {Map<number, number>[]} */ const adj = pool.map(() => new Map());
  /** @type {{ a: string, b: string, reason: string }[]} */ const unknownInteractions = [];
  /** @type {Map<string, Quantity[]>} */ const adjQ = new Map();
  for (const it of spec.interactions || []) {
    const i = idx.get(it.a), j = idx.get(it.b);
    if (i === undefined || j === undefined) continue;
    if (!isQuantity(it.adjustment) || it.adjustment.value === null) { unknownInteractions.push({ a: it.a, b: it.b, reason: 'interaction adjustment unknown; not applied and not treated as zero' }); continue; }
    if (it.adjustment.unit !== pool[0].objectiveValue.unit) throw new Error('optimizePortfolio: interaction adjustment unit differs from objective unit');
    const v = (adj[i].get(j) || 0) + it.adjustment.value;
    adj[i].set(j, v); adj[j].set(i, v);
    const key = i < j ? `${i}|${j}` : `${j}|${i}`;
    adjQ.set(key, [...(adjQ.get(key) || []), it.adjustment]); // several records on one pair: keep every one
  }
  const outNames = Object.keys(constraints.minPublicOutcomes || {});
  const minOut = constraints.minPublicOutcomes || {};
  /** @type {{ id: string, outcomes: string[] }[]} */ const unknownPublicOutcome = [];
  const outc = pool.map((c) => {
    const missing = outNames.filter((k) => !Number.isFinite(c.publicOutcome?.[k]));
    if (missing.length) unknownPublicOutcome.push({ id: c.id, outcomes: missing });
    return outNames.map((k) => (missing.includes(k) ? 0 : /** @type {number} */ (c.publicOutcome[k])));
  });
  const minReturn = constraints.minReturn ?? null;
  const unknownReturn = minReturn === null ? [] : pool.filter((c) => c.irr === null || c.irr === undefined || !Number.isFinite(c.irr)).map((c) => c.id);

  /** Constraints other than the budget, evaluated on a complete set. @param {boolean[]} sel */
  function complete(sel) {
    let tc = 0, wr = 0, unknownIrr = false;
    const out = outNames.map(() => 0);
    for (let i = 0; i < n; i++) {
      if (!sel[i]) continue;
      for (const e of excl[i]) if (sel[e]) return null;
      for (const r of req[i]) if (!sel[r]) return null;
      tc += cost[i];
      const irr = pool[i].irr;
      if (irr === null || irr === undefined || !Number.isFinite(irr)) unknownIrr = true; else wr += cost[i] * irr;
      outNames.forEach((_, k) => { out[k] += outc[i][k]; });
    }
    for (let k = 0; k < outNames.length; k++) if (out[k] < minOut[outNames[k]]) return null;
    let ret = null;
    if (minReturn !== null && tc > 0) {
      if (unknownIrr) return null; // a return that cannot be shown to meet the floor is not accepted
      ret = wr / tc;
      if (ret < minReturn) return null;
    }
    return { cost: tc, ret, out };
  }
  /** @param {boolean[]} sel */
  function objectiveOf(sel) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (!sel[i]) continue;
      v += obj[i];
      for (const [j, a] of adj[i]) if (j > i && sel[j]) v += a;
    }
    return v;
  }
  /** @param {boolean[]} sel @param {boolean} [ignoreBudget] */
  function evalSet(sel, ignoreBudget = false) {
    const c = complete(sel);
    if (!c) return null;
    if (!ignoreBudget && c.cost > B) return null;
    return { ...c, objective: objectiveOf(sel) };
  }

  /** @type {{ obj: number, sel: boolean[] }|null} */ let best = null;
  /** @type {{ obj: number, sel: boolean[] }|null} */ let second = null;
  /** @param {number} o @param {boolean[]} sel */
  const offer = (o, sel) => {
    if (!best || o > best.obj) { second = best; best = { obj: o, sel: sel.slice() }; }
    else if (!second || o > second.obj) second = { obj: o, sel: sel.slice() };
  };
  let method;
  if (n <= maxExact) {
    method = 'exact (branch and bound)';
    const ub = new Array(n + 1).fill(0);
    for (let k = n - 1; k >= 0; k--) {
      let g = Math.max(0, obj[k]);
      for (const [j, a] of adj[k]) if (j < k && a > 0) g += a;
      ub[k] = ub[k + 1] + g;
    }
    const outRem = outNames.map((_, k) => { const a = new Array(n + 1).fill(0); for (let i = n - 1; i >= 0; i--) a[i] = a[i + 1] + Math.max(0, outc[i][k]); return a; });
    const sel = new Array(n).fill(false);
    const dfs = (/** @type {number} */ i, /** @type {number} */ cur, /** @type {number} */ tc, /** @type {number[]} */ out) => {
      if (second && cur + ub[i] < /** @type {any} */ (second).obj) return;
      for (let k = 0; k < outNames.length; k++) if (out[k] + outRem[k][i] < minOut[outNames[k]]) return;
      if (i === n) {
        const r = evalSet(sel);
        if (r) offer(r.objective, sel);
        return;
      }
      if (tc + cost[i] <= B && !excl[i].some((e) => e < i && sel[e])) {
        let g = obj[i];
        for (const [j, a] of adj[i]) if (j < i && sel[j]) g += a;
        sel[i] = true;
        dfs(i + 1, cur + g, tc + cost[i], out.map((v, k) => v + outc[i][k]));
        sel[i] = false;
      }
      dfs(i + 1, cur, tc, out);
    };
    dfs(0, 0, 0, outNames.map(() => 0));
  } else {
    method = 'heuristic, not proven optimal';
    const closure = (/** @type {number} */ i, /** @type {boolean[]} */ sel) => {
      const add = [];
      const stack = [i];
      while (stack.length) { const x = /** @type {number} */ (stack.pop()); if (!sel[x] && !add.includes(x)) { add.push(x); stack.push(...req[x]); } }
      return add;
    };
    const tryAdd = (/** @type {boolean[]} */ sel, /** @type {number} */ i) => {
      const add = closure(i, sel);
      const t = sel.slice();
      for (const a of add) t[a] = true;
      return t;
    };
    const monotoneOk = (/** @type {boolean[]} */ s) => {
      let tc = 0;
      for (let i = 0; i < n; i++) if (s[i]) { tc += cost[i]; for (const e of excl[i]) if (s[e]) return false; }
      return tc <= B;
    };
    let cur = new Array(n).fill(false);
    const order = [...Array(n).keys()].sort((x, y) => {
      const rx = cost[x] > 0 ? obj[x] / cost[x] : (obj[x] > 0 ? Infinity : 0), ry = cost[y] > 0 ? obj[y] / cost[y] : (obj[y] > 0 ? Infinity : 0);
      return ry === rx ? x - y : ry > rx ? 1 : -1;
    });
    for (const i of order) { if (obj[i] <= 0 || cur[i]) continue; const t = tryAdd(cur, i); if (monotoneOk(t)) cur = t; }
    if (!evalSet(cur)) { // repair towards outcome / return constraints
      for (const i of order) { if (cur[i]) continue; const t = tryAdd(cur, i); if (monotoneOk(t)) { cur = t; if (evalSet(cur)) break; } }
    }
    let curEval = evalSet(cur);
    if (curEval) {
      const neighbours = (/** @type {boolean[]} */ s, /** @type {(t: boolean[]) => boolean|void} */ visit) => {
        for (let i = 0; i < n; i++) {
          if (s[i]) {
            const t = s.slice(); t[i] = false;
            if (visit(t)) return;
            for (let j = 0; j < n; j++) { if (s[j] || j === i) continue; const u = tryAdd(t, j); if (visit(u)) return; }
          } else if (visit(tryAdd(s, i))) return;
        }
      };
      for (let pass = 0; pass < maxPasses; pass++) {
        let moved = false;
        const base = /** @type {any} */ (curEval).objective;
        neighbours(cur, (t) => {
          const r = evalSet(t);
          if (r && r.objective > base + 1e-12) { cur = t; curEval = r; moved = true; return true; }
        });
        if (!moved) break;
      }
      offer(/** @type {any} */ (curEval).objective, cur);
      // next best among single-move neighbours
      let nb = null;
      neighbours(cur, (t) => {
        const r = evalSet(t);
        if (r && t.some((v, k) => v !== cur[k]) && (!nb || r.objective > nb.obj)) nb = { obj: r.objective, sel: t };
      });
      if (nb) second = nb;
    }
  }

  const base = {
    method, optimalAmong: 'fully assessed candidates only (unassessed candidates are listed under notOptimised, not treated as worthless)',
    notOptimised, excludedByHorizon, unknownInteractions, n, maxExact, conservative, budgetLimitApplied: B,
    unknownPublicOutcome,
    unknownPublicOutcomeNote: unknownPublicOutcome.length
      ? 'minimum public-outcome constraints were checked with these candidates\' missing values counted as zero; the true totals may differ'
      : null,
    unknownReturn,
    unknownReturnNote: unknownReturn.length ? 'these candidates have no return, so no portfolio containing them can be shown to meet the minimum return' : null,
  };
  const bestRes = /** @type {{ obj: number, sel: boolean[] }|null} */ (best);
  if (!bestRes) return Object.freeze({ ...base, feasible: false, chosen: [], reason: 'no portfolio satisfies the constraints' });

  const chosenIdx = (/** @type {boolean[]} */ s) => s.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  // with no assessed candidate the only portfolio is the empty one; take units from the budget and the inputs
  const objUnit = pool[0]?.objectiveValue.unit ?? candidates.find((c) => isQuantity(c.objectiveValue))?.objectiveValue.unit ?? 'unknown';
  const like = pool[0] ?? { cost: budget, objectiveValue: { ...budget, unit: objUnit } };
  const totalsOf = (/** @type {boolean[]} */ s) => {
    const ci = chosenIdx(s);
    const adjs = [];
    for (const i of ci) for (const j of adj[i].keys()) if (j > i && s[j]) adjs.push(.../** @type {Quantity[]} */ (adjQ.get(`${i}|${j}`)));
    const e = /** @type {any} */ (evalSet(s, true));
    return { cost: sumQ(ci.map((i) => pool[i].cost), like.cost, budget.unit), objective: sumQ([...ci.map((i) => pool[i].objectiveValue), ...adjs], like.objectiveValue, like.objectiveValue.unit),
      costUsed: e.cost, objectiveValue: e.objective, returnAchieved: e.ret, outcomes: Object.fromEntries(outNames.map((k, x) => [k, e.out[x]])) };
  };
  const t = totalsOf(bestRes.sel);
  const chosen = chosenIdx(bestRes.sel).map((i) => pool[i].id);
  const slack = {
    budget: B - t.costUsed,
    minReturn: minReturn === null || t.returnAchieved === null ? null : t.returnAchieved - minReturn,
    horizon: horizon === null ? null : horizon - Math.max(0, ...chosenIdx(bestRes.sel).map((i) => pool[i].endPeriod)),
    minPublicOutcomes: Object.fromEntries(outNames.map((k) => [k, t.outcomes[k] - minOut[k]])),
  };
  const sec = /** @type {{ obj: number, sel: boolean[] }|null} */ (second);
  const nextBest = sec ? { chosen: chosenIdx(sec.sel).map((i) => pool[i].id), ...(({ cost: c, objective: o, objectiveValue }) => ({ cost: c, objective: o, objectiveValue }))(totalsOf(sec.sel)) } : null;
  const opportunityCost = nextBest
    ? subQ(t.objective, nextBest.objective)
    : unknownQuantity(like.objectiveValue.unit, 'no other feasible portfolio exists, so no opportunity cost can be computed');
  // marginal candidate: best single addition blocked only by the budget
  /** @type {any} */ let marginal = null;
  for (let i = 0; i < n; i++) {
    if (bestRes.sel[i]) continue;
    const s = bestRes.sel.slice();
    const add = [i]; const st = [i];
    while (st.length) { const x = /** @type {number} */ (st.pop()); for (const r of req[x]) if (!s[r] && !add.includes(r)) { add.push(r); st.push(r); } }
    for (const a of add) s[a] = true;
    const r = evalSet(s, true);
    if (r && r.cost > B && (!marginal || r.objective - bestRes.obj > marginal.gain)) {
      marginal = { id: pool[i].id, gain: r.objective - bestRes.obj, shortBy: r.cost - B, addedWithRequirements: add.map((a) => pool[a].id) };
    }
  }
  return Object.freeze({ ...base, feasible: true, chosen, totals: t, slack, nextBest, opportunityCost,
    marginalExcludedByBudget: marginal, proven: method.startsWith('exact') });
}
