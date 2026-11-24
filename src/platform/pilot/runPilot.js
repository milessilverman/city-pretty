// @ts-check
// Los Angeles County pilot: wires located site records through discovery, the regulatory check (California module),
// the financial check (underwrite) and the coverage ledgers. Pure: the caller reads files and passes parsed JSON.
// Unknown is never zero: no criteria, no problem map and no sourced costs are invented here.
import { IMPROVEMENT_CATEGORIES } from '../schema/categories.js';
import { discover, makeParcelEvaluator } from '../discovery/index.js';
import { summarizeLedgers } from '../coverage/index.js';
import { createRegistry, buildCaliforniaModule, buildLosAngelesCityModule, makeRegulatoryCheck, CATEGORY_TOPICS } from '../regulatory/index.js';
import { underwrite } from '../underwriting/index.js';
import { makeModelRegistry } from '../impact/index.js';
import { modelsFromTransitValueEffects } from './impactModels.js';
import { locatedSitesFromSitesLa } from './laSites.js';

/** @param {Record<string, number>} t @param {string} k @param {number} [n] */
const bump = (t, k, n = 1) => { t[k] = (t[k] || 0) + n; };
/** @param {Record<string, any>} o */
const sortedObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
/** @param {Record<string, number>} t @param {number} [limit] */
const ranked = (t, limit = Infinity) => Object.entries(t).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, limit).map(([name, count]) => ({ name, count }));

/** Input names underwrite() reads that this run can only supply from sourced data. */
const UNDERWRITING_INPUTS = ['periods', 'capexSchedule', 'revenueSchedule', 'omSchedule', 'hurdleRate'];

/**
 * @param {{ sitesJson: any, bundle: any, statutes: any[], financeProfileCA: any, transitValueEffects: any, asOf: string,
 *   criteria?: Record<string, any>, problemMap?: any[], underwritingInputs?: Record<string, any> }} args
 */
export function runLaPilot(args) {
  const { sitesJson, bundle, statutes, financeProfileCA, transitValueEffects, asOf } = args;
  if (typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('runLaPilot: asOf (YYYY-MM-DD) required');
  const criteria = args.criteria || {};
  const problemMap = args.problemMap || [];
  const underwritingInputs = args.underwritingInputs || {};

  // ---- located sites
  const stations = bundle && bundle.layers && bundle.layers.stations && Array.isArray(bundle.layers.stations.features) ? bundle.layers.stations.features : [];
  const sites = locatedSitesFromSitesLa(sitesJson, { stations, stationsBuilt: bundle && bundle.meta && bundle.meta.built });
  const locations = sites.locations;
  const parcels = locations.filter((l) => l.ref.kind === 'parcel');
  /** @type {Map<string, string>} */ const typeOf = new Map(locations.map((l) => [l.ref.id, l.sourceRecord.type]));

  // ---- regulatory: California module, plus the Los Angeles city module when zone rules exist. Conclusions are tallied once per (parcel, topic).
  const registry = createRegistry();
  /** @type {string[]} */ const modules = [];
  registry.register(buildCaliforniaModule(statutes, financeProfileCA)); modules.push('California (state)');
  const zoneRules = bundle && Array.isArray(bundle.zone_rules) ? bundle.zone_rules : [];
  if (zoneRules.length) { registry.register(buildLosAngelesCityModule(zoneRules)); modules.push('Los Angeles (city), from bundle zone_rules'); }
  /** @type {Map<string, any[]>} */ const memo = new Map();
  const regTally = { byFinding: /** @type {Record<string, number>} */ ({}), byRuleId: /** @type {Record<string, number>} */ ({}), byTopic: /** @type {Record<string, number>} */ ({}), parcelTopicPairs: 0 };
  const countingRegistry = {
    /** @param {any} parcel @param {string} topic @param {string} when */
    evaluate(parcel, topic, when) {
      const key = `${parcel.ref.id}|${topic}`;
      let r = memo.get(key);
      if (!r) {
        r = registry.evaluate(parcel, topic, when); memo.set(key, r); regTally.parcelTopicPairs++;
        for (const c of r) { bump(regTally.byFinding, c.finding); bump(regTally.byRuleId, c.ruleId || '(no registered rule: placeholder conclusion)'); bump(regTally.byTopic, c.topic); }
      }
      return r;
    },
  };
  const regulatory = makeRegulatoryCheck(countingRegistry, CATEGORY_TOPICS, asOf);

  // ---- financial: underwrite() with whatever sourced inputs exist (none today). Same inputs for every site, so run once.
  const suppliedUw = UNDERWRITING_INPUTS.filter((k) => underwritingInputs[k] !== undefined);
  /** @type {{ result: 'pass'|'fail'|'unknown', reason: string, missing: string[], basis?: any }} */ let financial;
  try {
    const uw = underwrite({ id: 'la-pilot', use: 'develop', ...underwritingInputs, asOf });
    const fc = /** @type {any} */ (uw.financialCheck);
    financial = fc.result === 'fail' ? { result: 'fail', reason: fc.reason, missing: [], basis: 'financial' }
      : fc.result === 'pass' ? { result: 'pass', reason: fc.reason, missing: [] }
        : { result: 'unknown', reason: fc.reason, missing: fc.missing && fc.missing.length ? [...fc.missing] : ['underwriting inputs'] };
  } catch (e) {
    const missing = UNDERWRITING_INPUTS.filter((k) => !suppliedUw.includes(k));
    financial = { result: 'unknown', reason: `underwrite() could not run: ${e instanceof Error ? e.message : String(e)}`, missing: missing.length ? missing : ['underwriting inputs'] };
  }
  const financialCheck = () => (financial.result === 'unknown' ? { result: 'unknown', missing: financial.missing }
    : financial.result === 'fail' ? { result: 'fail', reason: financial.reason, basis: 'financial' } : { result: 'pass' });

  // ---- discovery (engineering check not supplied: unknown through the rule sets)
  const baseEvaluate = makeParcelEvaluator({ parcels, criteria, checks: { regulatory, financial: financialCheck } });
  /** @type {Record<string, Record<string, number>>} */ const evalByCategory = {};
  const evalByStatus = { viable: 0, candidate: 0, needs_info: 0, rejected: 0, not_evaluated: 0 };
  let needsInfoCriterion = 0;
  /** @param {any} location @param {any} category */
  const evaluate = (location, category) => {
    const r = baseEvaluate(location, category);
    bump(evalByStatus, r.status);
    bump(evalByCategory[category.id] ||= {}, r.status);
    if (r.status === 'needs_info' && Array.isArray(r.missing) && r.missing.some((/** @type {string} */ m) => m.startsWith('criterion:'))) needsInfoCriterion++;
    return r;
  };
  const found = discover({ locations, evaluate, asOf, indicators: sites.indicators, problemMap, parcels, criteria });
  const opportunities = found.opportunities;
  const ledgers = found.ledgers;
  const ledgerSummary = summarizeLedgers(ledgers);

  /** @type {Record<string, number>} */ const missingTally = {};
  /** @type {Record<string, number>} */ const byDiscoveredBy = {};
  /** @type {Record<string, number>} */ const oppByStatus = {};
  for (const o of opportunities) {
    for (const m of o.missingInputs) bump(missingTally, m);
    bump(byDiscoveredBy, (found.foundBy[o.id] || [o.discoveredBy]).join('+'));
    bump(oppByStatus, o.status);
  }

  // ---- impact: models registered vs categories lacking one; areas only where a model exists
  const { models, skipped } = modelsFromTransitValueEffects(transitValueEffects);
  const modelRegistry = makeModelRegistry({ categories: IMPROVEMENT_CATEGORIES, models });
  const withModel = IMPROVEMENT_CATEGORIES.filter((c) => modelRegistry.candidates(c.id).length > 0).map((c) => c.id);
  const lacking = IMPROVEMENT_CATEGORIES.filter((c) => !withModel.includes(c.id)).map((c) => c.id);
  const oppsWithModel = opportunities.filter((o) => withModel.includes(o.categoryId)).length;
  /** @type {Record<string, number>} */ const skippedReasons = {};
  for (const s of skipped) bump(skippedReasons, s.reason);
  const impact = {
    modelsRegistered: models.length, modelIds: models.map((m) => m.id).sort(), modelsSkipped: skipped.length, skippedReasons: sortedObj(skippedReasons),
    categoriesWithModel: withModel, categoriesLackingModelCount: lacking.length, categoriesLackingModel: lacking,
    opportunitiesInCategoriesWithModel: oppsWithModel, impactAreasComputed: 0,
    note: oppsWithModel === 0
      ? `no opportunity exists in a category with a registered model (${withModel.join(', ') || 'none'}); the sites file holds no rail-station opportunities, so no impact area was computed`
      : `${oppsWithModel} opportunities are in categories with a model, but no street-network graph is supplied to this run, so no impact area was computed`,
  };

  const methodReasons = {
    exhaustive: 'ran on every located site',
    problem_first: problemMap.length ? 'ran' : 'ran with an empty problemMap: no indicator is mapped to any category, so it produced nothing',
    asset_first: Object.keys(criteria).length ? 'ran' : 'ran with empty criteria: every flag test lacks its threshold or attributes',
    combination: 'not run: no adjacency data and no combination bound supplied',
  };
  const notEvaluatedByThisRun = evalByStatus.not_evaluated;
  const summary = {
    asOf,
    locations: {
      total: sites.counts.located, byType: sortedObj(sites.byType), byKind: sortedObj(locations.reduce((/** @type {Record<string, number>} */ t, l) => { bump(t, l.ref.kind); return t; }, {})),
      recordsInFile: sites.counts.records, skippedNoPoint: sites.counts.skippedNoPoint, lotsWithStationDistance: sites.counts.stationDistances,
      stationsInBundle: stations.length, polygonFallbackToPoint: sites.counts.polygonFallbackToPoint,
    },
    evaluations: {
      total: Object.values(evalByStatus).reduce((a, b) => a + b, 0),
      byStatus: evalByStatus,
      byCategory: sortedObj(Object.fromEntries(Object.keys(evalByCategory).map((k) => [k, sortedObj(evalByCategory[k])]))),
      needsInfoBecauseCriterionNotSupplied: needsInfoCriterion,
      criteriaSupplied: Object.keys(criteria).length, problemMapRows: problemMap.length,
      notEvaluatedNote: notEvaluatedByThisRun ? 'not_evaluated = the category applies to the location kind but no feasibility rule set exists for it (only the 17 parcel categories have one)' : '',
    },
    discovery: {
      methodsRun: found.methodsRun, methodNotes: methodReasons, opportunitiesByMethodHits: found.perMethod, duplicatesMerged: found.duplicatesMerged,
      opportunitiesMerged: opportunities.length, opportunitiesByStatus: sortedObj(oppByStatus), byDiscoveredBy: sortedObj(byDiscoveredBy),
      crashIndicatorLocations: Object.keys(sites.indicators).length,
    },
    topMissingInputs: ranked(missingTally, 15),
    regulatory: {
      modulesRegistered: modules, parcelTopicPairsEvaluated: regTally.parcelTopicPairs,
      parcelsWithPlace: locations.filter((l) => l.ref.jurisdiction.place !== null).length,
      conclusionsByFinding: sortedObj(regTally.byFinding), conclusionsByRuleId: sortedObj(regTally.byRuleId), conclusionsByTopic: sortedObj(regTally.byTopic),
    },
    financial: {
      checkResult: financial.result, reason: financial.reason, missing: financial.missing, suppliedInputs: suppliedUw,
      engineeringCheck: 'not supplied (unknown for every site)',
    },
    impact,
    ledgers: {
      count: ledgers.length, allFinalized: ledgers.every((l) => Array.isArray(l.found) && 'confidence' in l),
      confidence: ledgerSummary.confidence, totals: ledgerSummary.totals,
      note: 'totals.notEvaluated includes categories that do not apply to the location kind',
    },
    limits: [...sites.limits,
      'criteria and problemMap are empty by default: nothing is screened on a threshold, so a site never passes or fails a physical test it has no criterion for.',
      'No sourced costs, revenues, period count or hurdle rate exist in the repo, so the financial check is unknown for every site.',
      'No engineering check exists, so no opportunity can be viable.'],
  };
  return { opportunities, ledgers, summary, foundBy: found.foundBy, typeOf };
}
