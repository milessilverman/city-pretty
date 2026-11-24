// @ts-check
import { attr, PARCEL_ATTRIBUTE_NAMES } from './framework.js';
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
 * Pass only when, for every topic the category needs, at least one conclusion from a rule that lists the category is
 * `allowed`, or `conditional` with every condition satisfied by a known parcel attribute. Conclusions from rules that do
 * not list the category are ignored (never pass, never fail). No relevant conclusion for a topic is `unknown`.
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
    /** @param {import('./framework.js').Conclusion} c */
    const relevant = (c) => (c.finding === 'requires_investigation' && !c.ruleId) || (Array.isArray(c.appliesToCategories) && c.appliesToCategories.includes(id));
    /** @param {import('./framework.js').Conclusion} c @returns {string[]} conditions not yet satisfied by a known parcel attribute */
    const openConditions = (c) => c.conditions.filter((cond) => !c.satisfied.some((s) => s.condition === cond && PARCEL_ATTRIBUTE_NAMES.has(s.attribute) && attr(parcel, s.attribute) !== undefined));
    const byTopic = topics.map((t) => ({ topic: t, cs: registry.evaluate(parcel, t, asOf).filter(relevant) }));
    const all = byTopic.flatMap((x) => x.cs);
    const fail = all.filter((c) => c.finding === 'not_allowed' && c.status === 'in_effect');
    if (fail.length) {
      const c = fail[0];
      return { result: 'fail', basis: 'regulatory', reason: `${c.topic} not allowed (${c.jurisdiction.level}:${c.jurisdiction.state}${c.jurisdiction.place ? '/' + c.jurisdiction.place : ''}): ${c.source ? `${c.source.citation} ${c.source.url}` : 'no source'}` };
    }
    // a rule outside its operative/repeal window is not applied, so it cannot block (or satisfy) a topic
    const unknown = all.filter((c) => c.finding === 'requires_investigation' && c.status === 'in_effect');
    const missing = [...new Set(unknown.flatMap((c) => (c.missing.length ? [...c.missing] : [`${c.topic}: ${c.note || 'requires investigation'}`])))];
    /** @type {string[]} */ const conditions = [];
    for (const { topic, cs } of byTopic) {
      const good = cs.filter((c) => c.status === 'in_effect' && (c.finding === 'allowed' || (c.finding === 'conditional' && openConditions(c).length === 0)));
      if (good.length) { conditions.push(...good.flatMap((c) => c.conditions)); continue; }
      const open = cs.filter((c) => c.status === 'in_effect' && c.finding === 'conditional');
      if (open.length) missing.push(...open.flatMap((c) => openConditions(c).map((o) => `${topic}: open condition (${c.ruleId || 'rule'}): ${o}`)));
      else if (!unknown.some((c) => c.topic === topic)) missing.push(`${topic}: no rule that lists category ${id} gives a conclusion`);
    }
    if (missing.length) return { result: 'unknown', missing: [...new Set(missing)] };
    return { result: 'pass', conditions: [...new Set(conditions)] };
  };
}
