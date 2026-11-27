// @ts-check
// Parcel feasibility rule sets for the 17 parcel categories. No thresholds live here: every criterion is supplied by the caller.
// Physical screening failures are recorded on the engineering check with basis 'physical' (the schema has no separate physical check key).
import { isQuantity } from '../schema/quantity.js';
import { IMPROVEMENT_CATEGORIES, getCategory } from '../schema/categories.js';
import { makeUseOption, USE_KINDS, CHECK_RESULTS } from '../schema/opportunity.js';

/**
 * @typedef {{ attributes?: Record<string, any>, labels?: Record<string, any>, ref?: any, id?: string }} ParcelLike
 * @typedef {{ kind: 'threshold', attr: string, op: Op, criterion: string }
 *   | { kind: 'ratio', num: string, den: string, op: Op, criterion: string }
 *   | { kind: 'flag', attr: string }} PhysicalTest
 * @typedef {'gte'|'lte'|'gt'|'lt'} Op
 * @typedef {{ regulatory?: Function, financial?: Function, engineering?: Function }} InjectedChecks
 * @typedef {{ categoryId: string, status: string, uses: readonly import('../schema/opportunity.js').UseOption[],
 *   checks: import('../schema/opportunity.js').Checks, missing: string[], rejection: { basis: string, reason: string }|null }} FeasibilityResult
 * @typedef {{ categoryId: string, requiredAttributes: readonly string[], evaluate: (parcel: ParcelLike, criteria: Record<string, any>, checks?: InjectedChecks) => FeasibilityResult }} RuleSet
 */

const BASE = ['parcel_area', 'zoning_district', 'current_use'];
const OP_TEXT = { gte: 'at least', lte: 'at most', gt: 'above', lt: 'below' };

/** Physical tests per category for the develop use. @type {Record<string, PhysicalTest[]>} */
const DEVELOP_TESTS = {
  underused_land: [{ kind: 'ratio', num: 'assessed_improvement_value', den: 'assessed_land_value', op: 'lte', criterion: 'max_improvement_to_land_ratio' }],
  surface_parking: [{ kind: 'threshold', attr: 'parking_surface_area', op: 'gte', criterion: 'min_parking_surface_area' }],
  vacant_land: [{ kind: 'flag', attr: 'vacancy_status' }],
  ageing_retail: [{ kind: 'threshold', attr: 'year_built', op: 'lte', criterion: 'max_year_built' }, { kind: 'threshold', attr: 'retail_vacancy', op: 'gte', criterion: 'min_retail_vacancy' }],
  brownfield: [{ kind: 'flag', attr: 'contamination_status' }, { kind: 'threshold', attr: 'remediation_cost', op: 'lte', criterion: 'max_remediation_cost' }],
  assembly: [{ kind: 'threshold', attr: 'combined_parcel_area', op: 'gte', criterion: 'min_assembled_area' }],
  lot_split: [{ kind: 'threshold', attr: 'parcel_area', op: 'gte', criterion: 'min_splittable_area' }],
  adu: [{ kind: 'threshold', attr: 'parcel_area', op: 'gte', criterion: 'min_adu_lot_area' }, { kind: 'threshold', attr: 'existing_structures', op: 'lte', criterion: 'max_existing_structures' }],
  densification: [{ kind: 'ratio', num: 'built_floor_area', den: 'permitted_floor_area', op: 'lte', criterion: 'max_built_to_permitted_ratio' }],
  office_to_residential: [{ kind: 'threshold', attr: 'office_vacancy', op: 'gte', criterion: 'min_office_vacancy' }],
  mixed_use: [{ kind: 'threshold', attr: 'permitted_floor_area', op: 'gte', criterion: 'min_mixed_use_floor_area' }],
  air_rights: [{ kind: 'threshold', attr: 'unused_development_rights', op: 'gte', criterion: 'min_unused_rights' }],
  shared_parking: [{ kind: 'threshold', attr: 'parking_occupancy', op: 'lte', criterion: 'max_parking_occupancy' }],
  p3_mixed_use: [{ kind: 'flag', attr: 'public_ownership' }, { kind: 'threshold', attr: 'permitted_floor_area', op: 'gte', criterion: 'min_p3_floor_area' }],
  park_with_development: [{ kind: 'threshold', attr: 'open_space_deficit', op: 'gte', criterion: 'min_open_space_deficit' }],
  industrial_revitalisation: [{ kind: 'threshold', attr: 'industrial_vacancy', op: 'gte', criterion: 'min_industrial_vacancy' }],
  commercial_revitalisation: [{ kind: 'threshold', attr: 'commercial_vacancy', op: 'gte', criterion: 'min_commercial_vacancy' }],
};

/** @param {PhysicalTest} t @returns {string[]} */
const testAttrs = (t) => (t.kind === 'ratio' ? [t.num, t.den] : [t.attr]);

/** @param {string} id @returns {Record<string, { attrs: string[], tests: PhysicalTest[] }>} */
function useDefs(id) {
  const dev = DEVELOP_TESTS[id];
  return {
    develop: { attrs: [...new Set([...BASE, ...dev.flatMap(testAttrs)])], tests: dev },
    preserve: { attrs: ['current_use'], tests: [] },
    public_space: { attrs: ['parcel_area'], tests: [{ kind: 'threshold', attr: 'parcel_area', op: 'gte', criterion: 'min_public_space_area' }] },
    coordinated_development: { attrs: ['adjacent_parcels'], tests: [{ kind: 'threshold', attr: 'adjacent_parcels', op: 'gte', criterion: 'min_coordination_partners' }] },
  };
}

/** @param {any} v */
export const isPresent = (v) => v !== undefined && v !== null && v !== '' && !(isQuantity(v) && v.value === null) && !(typeof v === 'number' && !Number.isFinite(v));

/** Raw attribute: parcel.attributes first, then parcel.labels. @param {ParcelLike} parcel @param {string} name */
export function attrValue(parcel, name) {
  const a = parcel && parcel.attributes && parcel.attributes[name];
  if (a !== undefined) return a;
  return parcel && parcel.labels ? parcel.labels[name] : undefined;
}

/** @param {any} v @returns {number|null} */
export function numeric(v) {
  if (isQuantity(v)) return v.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** @param {any} v @returns {string|null} */
const unitOf = (v) => (isQuantity(v) ? v.unit : v && typeof v === 'object' && typeof v.unit === 'string' ? v.unit : null);

/**
 * A criterion is a Quantity with a value, or a plain { label, value, status: 'assumed', provenance } threshold.
 * @param {Record<string, any>} criteria @param {string} name
 * @returns {{ value: number, unit: string|null, label: string }|null}
 */
export function readCriterion(criteria, name) {
  const c = criteria && criteria[name];
  if (isQuantity(c)) return c.value === null ? null : { value: c.value, unit: c.unit, label: c.label || name };
  if (c && typeof c === 'object' && Number.isFinite(c.value) && c.status === 'assumed'
    && typeof c.provenance === 'string' && c.provenance.trim() && typeof c.label === 'string' && c.label.trim()) {
    return { value: c.value, unit: typeof c.unit === 'string' ? c.unit : null, label: c.label };
  }
  return null;
}

/** @param {Op} op @param {number} a @param {number} b */
export function compare(op, a, b) {
  return op === 'gte' ? a >= b : op === 'lte' ? a <= b : op === 'gt' ? a > b : a < b;
}

/**
 * Run physical tests. Returns the missing names, or the first failure reason, or pass.
 * @param {ParcelLike} parcel @param {string[]} attrs @param {PhysicalTest[]} tests @param {Record<string, any>} criteria
 * @returns {{ result: 'pass'|'fail'|'unknown', missing: string[], reason?: string }}
 */
export function physicalScreen(parcel, attrs, tests, criteria) {
  /** @type {string[]} */ const missing = [];
  for (const a of attrs) if (!isPresent(attrValue(parcel, a))) missing.push(a);
  /** @type {string|undefined} */ let failure;
  for (const t of tests) {
    if (t.kind === 'flag') {
      const v = attrValue(parcel, t.attr);
      if (!isPresent(v)) continue;
      if (v !== true && !failure) failure = `${t.attr} is not flagged`;
      continue;
    }
    const crit = readCriterion(criteria, t.criterion);
    if (!crit) { missing.push(`criterion:${t.criterion}`); continue; }
    /** @type {number|null} */ let x; /** @type {string|null} */ let u;
    if (t.kind === 'ratio') {
      const n = attrValue(parcel, t.num), d = attrValue(parcel, t.den);
      if (!isPresent(n) || !isPresent(d)) continue;
      const nv = numeric(n), dv = numeric(d);
      if (nv === null || dv === null) { missing.push(`${isQuantity(n) || typeof n === 'number' ? t.den : t.num} (not numeric)`); continue; }
      if (dv === 0) { missing.push(`${t.den} (zero, ratio undefined)`); continue; }
      if (unitOf(n) && unitOf(d) && unitOf(n) !== unitOf(d)) { missing.push(`unit_mismatch:${t.num}/${t.den}`); continue; }
      x = nv / dv; u = null;
    } else {
      const v = attrValue(parcel, t.attr);
      if (!isPresent(v)) continue;
      x = numeric(v); u = unitOf(v);
      if (x === null) { missing.push(`${t.attr} (not numeric)`); continue; }
    }
    if (u && crit.unit && u !== crit.unit) { missing.push(`unit_mismatch:${t.kind === 'ratio' ? t.num : t.attr}/${t.criterion}`); continue; }
    if (!compare(t.op, x, crit.value) && !failure) {
      const name = t.kind === 'ratio' ? `${t.num}/${t.den}` : t.attr;
      failure = `${name} ${x} is not ${OP_TEXT[t.op]} ${crit.label} ${crit.value}`;
    }
  }
  if (failure) return { result: 'fail', missing: [], reason: failure };
  if (missing.length) return { result: 'unknown', missing: [...new Set(missing)] };
  return { result: 'pass', missing: [] };
}

/** @param {any} r @param {string} name @returns {import('../schema/opportunity.js').CheckResult} */
export function normalizeInjected(r, name) {
  if (!r || !CHECK_RESULTS.includes(r.result)) throw new Error(`check ${name} must return { result: pass|fail|unknown }`);
  if (r.result === 'fail') return { result: 'fail', reason: r.reason || `${name} check failed (no reason given)`, basis: r.basis || /** @type {any} */ (name) };
  if (r.result === 'unknown') return { result: 'unknown', missing: Array.isArray(r.missing) && r.missing.length ? r.missing : [`${name} check inputs`] };
  return { result: 'pass' };
}

/** fail > unknown > pass. @param {import('../schema/opportunity.js').CheckResult[]} list @returns {import('../schema/opportunity.js').CheckResult} */
export function mergeChecks(list) {
  const f = list.find((x) => x.result === 'fail');
  if (f) return f;
  const u = list.filter((x) => x.result === 'unknown');
  if (u.length) return { result: 'unknown', missing: [...new Set(u.flatMap((x) => x.missing || []))] };
  return { result: 'pass' };
}

export const RANK = { viable: 0, candidate: 1, needs_info: 2, rejected: 3 };

/** @param {string} categoryId @returns {RuleSet} */
function makeRuleSet(categoryId) {
  const defs = useDefs(categoryId);
  const requiredAttributes = Object.freeze([...new Set(Object.values(defs).flatMap((d) => d.attrs))]);
  return Object.freeze({
    categoryId, requiredAttributes,
    evaluate(parcel, criteria, checks = {}) {
      const category = /** @type {any} */ (getCategory(categoryId));
      const regulatory = checks.regulatory
        ? normalizeInjected(checks.regulatory(parcel, category), 'regulatory')
        : /** @type {import('../schema/opportunity.js').CheckResult} */ ({ result: 'unknown', missing: ['check:regulatory'] });
      const engInjected = checks.engineering
        ? normalizeInjected(checks.engineering(parcel, category), 'engineering')
        : /** @type {import('../schema/opportunity.js').CheckResult} */ ({ result: 'unknown', missing: ['check:engineering'] });
      const uses = USE_KINDS.map((use) => {
        const d = defs[use];
        const phys = physicalScreen(parcel, d.attrs, d.tests, criteria || {});
        /** @type {import('../schema/opportunity.js').CheckResult} */
        const physCheck = phys.result === 'fail' ? { result: 'fail', reason: /** @type {string} */ (phys.reason), basis: 'physical' }
          : phys.result === 'unknown' ? { result: 'unknown', missing: phys.missing } : { result: 'pass' };
        const financial = phys.result === 'fail' ? undefined
          : checks.financial ? normalizeInjected(checks.financial(parcel, category, use), 'financial')
            : /** @type {import('../schema/opportunity.js').CheckResult} */ ({ result: 'unknown', missing: ['check:financial'] });
        return makeUseOption({ use, checks: { regulatory, financial, engineering: mergeChecks([physCheck, engInjected]) } });
      });
      // Category status follows the actionable uses; 'preserve' is the do-nothing baseline and is reported but does not decide it.
      const actionable = uses.filter((u) => u.use !== 'preserve');
      const best = actionable.reduce((a, b) => (RANK[/** @type {'viable'} */ (b.status)] < RANK[/** @type {'viable'} */ (a.status)] ? b : a));
      const missing = [...new Set(uses.flatMap((u) => Object.values(u.checks).flatMap((c) => (c.result === 'unknown' ? c.missing || [] : []))))];
      const rejection = best.status === 'rejected'
        ? (() => {
          const f = Object.values(best.checks).find((c) => c.result === 'fail');
          return { basis: f && f.basis ? f.basis : 'physical', reason: `every actionable use rejected; ${actionable.map((u) => `${u.use}: ${Object.values(u.checks).find((c) => c.result === 'fail')?.reason}`).join('; ')}` };
        })() : null;
      return { categoryId, status: best.status, uses, checks: best.checks, missing, rejection };
    },
  });
}

/** One rule set per parcel_development category, keyed by category id. @type {Readonly<Record<string, RuleSet>>} */
export const FEASIBILITY_RULES = Object.freeze(Object.fromEntries(
  IMPROVEMENT_CATEGORIES.filter((c) => c.family === 'parcel_development').map((c) => [c.id, makeRuleSet(c.id)]),
));

/**
 * Adapter for exhaustiveScreen: looks up the parcel by location id.
 * @param {{ parcels: ParcelLike[], criteria: Record<string, any>, checks?: InjectedChecks }} cfg
 */
export function makeParcelEvaluator({ parcels, criteria, checks }) {
  /** @type {Map<string, ParcelLike>} */ const byId = new Map();
  for (const p of parcels) if (p && p.ref && p.ref.id) byId.set(p.ref.id, p);
  return (/** @type {any} */ location, /** @type {{ id: string }} */ category) => {
    const rule = FEASIBILITY_RULES[category.id];
    if (!rule) return { status: 'not_evaluated', reason: `no parcel rule set for ${category.id}` };
    const ref = location && location.ref !== undefined ? location.ref : location;
    const parcel = byId.get(ref.id);
    if (!parcel) return { status: 'needs_info', missing: ['parcel attributes'] };
    return rule.evaluate(parcel, criteria, checks);
  };
}
