// @ts-check
// Problem-first discovery: a measured deficit maps to candidate categories through a caller-supplied table.
import { isQuantity } from '../schema/quantity.js';
import { getCategory } from '../schema/categories.js';
import { makeOpportunity } from '../schema/opportunity.js';
import { readCriterion } from './feasibility.js';

/**
 * @typedef {{ indicator: string, direction: 'above'|'below', threshold: any, categoryIds: string[] }} ProblemMapRow
 * direction 'above': a value above the threshold is a deficit (for example crash count). 'below': a value below it is (for example canopy).
 * @param {{ locations: any[], indicators: Record<string, Record<string, any>>, problemMap: ProblemMapRow[] }} args
 */
export function problemFirst({ locations, indicators, problemMap }) {
  if (!Array.isArray(problemMap)) throw new Error('problemFirst: problemMap array required');
  /** @type {any[]} */ const opportunities = [];
  /** @type {{ locationId: string, indicator: string }[]} */ const noDeficit = [];
  const counts = { locations: 0, deficits: 0, needsInfo: 0, noDeficit: 0, opportunities: 0 };
  for (const loc of locations) {
    const ref = loc && loc.ref !== undefined ? loc.ref : loc;
    if (!ref || !ref.id) continue;
    counts.locations++;
    const vals = (indicators && indicators[ref.id]) || {};
    for (const row of problemMap) {
      const cats = row.categoryIds.map(getCategory).filter((c) => c && c.appliesTo.includes(ref.kind));
      if (!cats.length) continue;
      const v = vals[row.indicator];
      const thr = readCriterion({ t: row.threshold }, 't');
      const missing = [];
      if (!isQuantity(v) || v.value === null) missing.push(`indicator:${row.indicator}`);
      if (!thr) missing.push(`threshold:${row.indicator}`);
      if (!missing.length && isQuantity(v) && thr && thr.unit && v.unit !== thr.unit) missing.push(`unit_mismatch:${row.indicator}`);
      if (missing.length) {
        for (const c of /** @type {any[]} */ (cats)) {
          opportunities.push(makeOpportunity({ id: `problem_first:${c.id}:${ref.id}:${row.indicator}`, categoryId: c.id, location: ref, discoveredBy: 'problem_first',
            checks: { engineering: { result: 'unknown', missing } }, confidence: 'unknown', confidenceReasons: ['indicator not measured: needs data, not "no problem"'] }));
          counts.needsInfo++; counts.opportunities++;
        }
        continue;
      }
      const x = /** @type {number} */ (/** @type {any} */ (v).value), t = /** @type {any} */ (thr).value;
      const deficit = row.direction === 'above' ? x > t : x < t;
      if (!deficit) { noDeficit.push({ locationId: ref.id, indicator: row.indicator }); counts.noDeficit++; continue; }
      counts.deficits++;
      for (const c of /** @type {any[]} */ (cats)) {
        opportunities.push(makeOpportunity({ id: `problem_first:${c.id}:${ref.id}:${row.indicator}`, categoryId: c.id, location: ref, discoveredBy: 'problem_first',
          evidence: [v], confidence: 'low', confidenceReasons: [`measured ${row.indicator} is ${row.direction} the supplied threshold; deterministic checks have not run`] }));
        counts.opportunities++;
      }
    }
  }
  return { opportunities, noDeficit, counts };
}
