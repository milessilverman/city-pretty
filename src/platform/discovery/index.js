// @ts-check
// discover(): run the four methods, merge duplicates (keeping the list of methods that found each), report per-method counts.
import { exhaustiveScreen } from './screening.js';
import { problemFirst } from './problemFirst.js';
import { assetFirst } from './assetFirst.js';
import { combinations } from './combination.js';

export * from './screening.js';
export * from './feasibility.js';
export * from './problemFirst.js';
export * from './assetFirst.js';
export * from './combination.js';
export * from './aiExploration.js';

/**
 * Each method runs only when its inputs are supplied; `methodsRun` says which did.
 * @param {{ locations?: any[], categories?: readonly any[], evaluate?: Function, asOf?: string,
 *   indicators?: Record<string, any>, problemMap?: any[], parcels?: any[], criteria?: Record<string, any>,
 *   adjacency?: [string, string][]|null, pairRules?: any[], bound?: number }} args
 */
export function discover(args) {
  const { locations, categories, evaluate, asOf, indicators, problemMap, parcels, criteria, adjacency, pairRules, bound } = args;
  /** @type {string[]} */ const methodsRun = [];
  /** @type {Record<string, number>} */ const perMethod = { exhaustive: 0, problem_first: 0, asset_first: 0, combination: 0 };
  /** @type {Map<string, any>} */ const merged = new Map();
  /** @type {Record<string, string[]>} */ const foundBy = {};
  let duplicatesMerged = 0;
  /** @type {any[]} */ let ledgers = [];
  /** @type {any} */ const detail = {};
  /** @param {string} method @param {any[]} opps */
  const add = (method, opps) => {
    for (const o of opps) {
      perMethod[method]++;
      const key = `${o.categoryId}|${o.location.id}`;
      if (merged.has(key)) { duplicatesMerged++; const m = foundBy[key]; if (!m.includes(method)) m.push(method); }
      else { merged.set(key, o); foundBy[key] = [method]; }
    }
  };
  if (locations && evaluate && asOf) {
    const r = exhaustiveScreen({ locations, categories, evaluate: /** @type {any} */ (evaluate), asOf });
    methodsRun.push('exhaustive'); ledgers = r.ledgers; detail.exhaustive = r.counts; add('exhaustive', r.opportunities);
  }
  if (locations && indicators && problemMap) {
    const r = problemFirst({ locations, indicators, problemMap });
    methodsRun.push('problem_first'); detail.problem_first = r.counts; add('problem_first', r.opportunities);
  }
  if (parcels && criteria) {
    const r = assetFirst({ parcels, criteria });
    methodsRun.push('asset_first'); detail.asset_first = r.counts; add('asset_first', r.opportunities);
  }
  if (parcels && bound !== undefined && (adjacency || pairRules)) {
    const r = combinations({ opportunities: [...merged.values()], parcels, adjacency: adjacency || null, pairRules: pairRules || [], bound });
    methodsRun.push('combination'); detail.combination = { generated: r.generated, total: r.total, truncated: r.truncated, notGenerated: r.notGenerated };
    add('combination', r.opportunities);
    detail.crossCategory = r.combinations.filter((c) => c.kind === 'cross_category');
  }
  const opportunities = [...merged.values()];
  return {
    opportunities, ledgers, perMethod, methodsRun, duplicatesMerged, detail,
    foundBy: Object.fromEntries(opportunities.map((o) => [o.id, foundBy[`${o.categoryId}|${o.location.id}`]])),
  };
}
