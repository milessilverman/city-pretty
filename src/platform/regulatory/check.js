// @ts-check
// Adapter: collapses registry conclusions into the pass/fail/unknown shape discovery/feasibility.js expects of checks.regulatory.

/** Topics each of the 17 parcel categories needs regulatory conclusions on (a routing table, not legal content). */
export const CATEGORY_TOPICS = Object.freeze({
  underused_land: ['zoning', 'density', 'height', 'permitting'],
  surface_parking: ['zoning', 'parking', 'density'],
  vacant_land: ['zoning', 'density', 'height', 'setbacks'],
  ageing_retail: ['zoning', 'density', 'parking'],
  brownfield: ['zoning', 'environmental', 'permitting'],
  assembly: ['zoning', 'density', 'easements'],
  lot_split: ['zoning', 'lot_split'],
  adu: ['zoning', 'density', 'setbacks', 'permitting'],
  densification: ['zoning', 'density', 'height', 'tod_law'],
  office_to_residential: ['zoning', 'permitting', 'parking'],
  mixed_use: ['zoning', 'density', 'affordability'],
  air_rights: ['zoning', 'height', 'easements'],
  shared_parking: ['zoning', 'parking'],
  p3_mixed_use: ['zoning', 'incentives', 'affordability'],
  park_with_development: ['zoning', 'environmental'],
  industrial_revitalisation: ['zoning', 'environmental'],
  commercial_revitalisation: ['zoning', 'incentives'],
});

/**
 * @param {{ evaluate: (parcel: any, topic: string, asOf: string) => import('./framework.js').Conclusion[] }} registry
 * @param {Record<string, readonly string[]>} categoryTopics
 * @param {string} asOf YYYY-MM-DD
 * @returns {(parcel: any, category: any) => import('../schema/opportunity.js').CheckResult}
 */
export function makeRegulatoryCheck(registry, categoryTopics, asOf) {
  if (!registry || typeof registry.evaluate !== 'function') throw new TypeError('makeRegulatoryCheck: registry required');
  return (parcel, category) => {
    const id = typeof category === 'string' ? category : category && category.id;
    const topics = categoryTopics[id];
    if (!topics || !topics.length) return { result: 'unknown', missing: [`regulatory:category_topics:${id}`] };
    const all = topics.flatMap((t) => registry.evaluate(parcel, t, asOf));
    const fail = all.filter((c) => c.finding === 'not_allowed');
    if (fail.length) {
      const c = fail[0];
      return { result: 'fail', basis: 'regulatory', reason: `${c.topic} not allowed (${c.jurisdiction.level}:${c.jurisdiction.state}${c.jurisdiction.place ? '/' + c.jurisdiction.place : ''}): ${c.source ? `${c.source.citation} ${c.source.url}` : 'no source'}` };
    }
    const unknown = all.filter((c) => c.finding === 'requires_investigation');
    if (unknown.length) {
      const missing = [...new Set(unknown.flatMap((c) => (c.missing.length ? [...c.missing] : [`${c.topic}: ${c.note || 'requires investigation'}`])))];
      return { result: 'unknown', missing };
    }
    return { result: 'pass', conditions: [...new Set(all.flatMap((c) => c.conditions))] };
  };
}
