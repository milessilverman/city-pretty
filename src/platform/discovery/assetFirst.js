// @ts-check
// Asset-first discovery: flag parcels from their own attributes. Thresholds come from criteria; missing attribute gives needs_info.
import { makeOpportunity } from '../schema/opportunity.js';
import { physicalScreen, attrValue, numeric, readCriterion } from './feasibility.js';



/** @type {{ flag: string, categoryId: string, attrs: string[], tests: import('./feasibility.js').PhysicalTest[] }[]} */
const ASSET_RULES = [
  { flag: 'underused_land', categoryId: 'underused_land', attrs: ['assessed_land_value', 'assessed_improvement_value'],
    tests: [{ kind: 'ratio', num: 'assessed_improvement_value', den: 'assessed_land_value', op: 'lte', criterion: 'max_improvement_to_land_ratio' }] },
  { flag: 'vacant_building', categoryId: 'commercial_revitalisation', attrs: ['building_vacant'], tests: [{ kind: 'flag', attr: 'building_vacant' }] },
  { flag: 'surface_parking', categoryId: 'surface_parking', attrs: ['parking_surface_area'],
    tests: [{ kind: 'threshold', attr: 'parking_surface_area', op: 'gte', criterion: 'min_parking_surface_area' }] },
  { flag: 'unused_development_rights', categoryId: 'air_rights', attrs: ['permitted_floor_area', 'built_floor_area'], tests: [] },
];

/** @param {{ parcels: any[], criteria: Record<string, any> }} args */
export function assetFirst({ parcels, criteria }) {
  /** @type {any[]} */ const opportunities = [];
  /** @type {any[]} */ const unlocated = [];
  const counts = { parcels: 0, flagged: 0, needsInfo: 0, notFlagged: 0, unlocated: 0 };
  for (const p of parcels) {
    counts.parcels++;
    const ref = p && p.ref;
    if (!ref) { unlocated.push(p); counts.unlocated++; continue; }
    for (const rule of ASSET_RULES) {
      let r;
      if (rule.flag === 'unused_development_rights') {
        // unused rights = permitted floor area minus built floor area, compared with the caller's minimum
        r = physicalScreen(p, rule.attrs, [], criteria);
        if (r.result === 'pass') {
          const crit = readCriterion(criteria, 'min_unused_floor_area');
          const c = crit ? crit.value : NaN;
          if (!crit) r = { result: 'unknown', missing: ['criterion:min_unused_floor_area'] };
          else {
            const unused = /** @type {number} */ (numeric(attrValue(p, 'permitted_floor_area'))) - /** @type {number} */ (numeric(attrValue(p, 'built_floor_area')));
            r = unused >= c ? { result: 'pass', missing: [] } : { result: 'fail', missing: [], reason: `unused floor area ${unused} below ${c}` };
          }
        }
      } else r = physicalScreen(p, rule.attrs, rule.tests, criteria);
      const id = `asset_first:${rule.categoryId}:${ref.id}:${rule.flag}`;
      if (r.result === 'unknown') {
        opportunities.push(makeOpportunity({ id, categoryId: rule.categoryId, location: ref, discoveredBy: 'asset_first',
          checks: { engineering: { result: 'unknown', missing: r.missing } }, confidenceReasons: [`${rule.flag}: attribute not available`] }));
        counts.needsInfo++;
      } else if (r.result === 'pass') {
        opportunities.push(makeOpportunity({ id, categoryId: rule.categoryId, location: ref, discoveredBy: 'asset_first', confidence: 'low',
          evidence: rule.attrs.map((a) => attrValue(p, a)).filter((q) => q && typeof q === 'object' && 'status' in q),
          confidenceReasons: [`${rule.flag} flagged from parcel attributes; regulatory, financial and engineering checks have not run`] }));
        counts.flagged++;
      } else counts.notFlagged++;
    }
  }
  return { opportunities, unlocated, counts };
}
