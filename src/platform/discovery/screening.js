// @ts-check
// Exhaustive screening: every applicable category for every location, no cut-off, no early exit.
import { IMPROVEMENT_CATEGORIES } from '../schema/categories.js';
import { validateGeoRef } from '../schema/geo.js';
import { makeOpportunity, deriveStatus } from '../schema/opportunity.js';
import { createLedger, recordFound, recordRejected, recordNeedsInfo, recordNotEvaluated, finalizeLedger } from '../coverage/ledger.js';

/**
 * evaluate(location, category) returns { status: 'viable'|'candidate'|'needs_info'|'rejected'|'not_evaluated',
 *   checks?, uses?, missing?, rejection?: { basis, reason }, reason?, evidence?, confidenceReasons? }
 * @param {{ locations: any[], categories?: readonly any[], evaluate: (location: any, category: any) => any, asOf: string, discoveredBy?: string }} args
 */
export function exhaustiveScreen({ locations, categories = IMPROVEMENT_CATEGORIES, evaluate, asOf, discoveredBy = 'exhaustive' }) {
  if (!Array.isArray(locations)) throw new Error('exhaustiveScreen: locations array required');
  if (typeof evaluate !== 'function') throw new Error('exhaustiveScreen: evaluate function required');
  /** @type {any[]} */ const opportunities = [];
  /** @type {any[]} */ const ledgers = [];
  /** @type {any[]} */ const unlocated = [];
  const counts = { locations: 0, unlocated: 0, evaluations: 0, found: 0, needsInfo: 0, rejected: 0, notEvaluated: 0, opportunities: 0 };
  /** @type {Map<string, any[]>} */ const byKind = new Map();
  for (const item of locations) {
    const ref = item && item.ref !== undefined ? item.ref : item;
    if (!ref || !validateGeoRef(ref).valid) { unlocated.push(item); counts.unlocated++; continue; }
    counts.locations++;
    let applicable = byKind.get(ref.kind);
    if (!applicable) { applicable = categories.filter((c) => c.appliesTo.includes(ref.kind)); byKind.set(ref.kind, applicable); }
    const ledger = createLedger(ref, asOf, /** @type {any} */ (categories));
    for (const cat of applicable) {
      counts.evaluations++;
      const r = evaluate(item, cat);
      if (!r || typeof r.status !== 'string') throw new Error(`exhaustiveScreen: evaluate returned no status for ${cat.id}`);
      if (r.status === 'rejected') {
        recordRejected(ledger, cat.id, r.rejection || { basis: 'physical', reason: '' });
        counts.rejected++;
      } else if (r.status === 'not_evaluated') {
        recordNotEvaluated(ledger, cat.id, r.reason);
        counts.notEvaluated++;
      } else if (['viable', 'candidate', 'needs_info'].includes(r.status)) {
        /** @type {any} */ let checks = r.checks || {};
        if (r.status === 'needs_info' && deriveStatus(checks) !== 'needs_info') {
          if (!Array.isArray(r.missing) || !r.missing.length) throw new Error(`exhaustiveScreen: needs_info for ${cat.id} without a missing list`);
          checks = { engineering: { result: 'unknown', missing: r.missing } };
        }
        if (deriveStatus(checks) !== r.status) throw new Error(`exhaustiveScreen: ${cat.id} status ${r.status} contradicts its checks`);
        const opp = makeOpportunity({
          id: `${discoveredBy}:${cat.id}:${ref.id}`, categoryId: cat.id, location: ref, discoveredBy, checks,
          uses: r.uses ? [...r.uses] : [], missingInputs: r.missing || [], evidence: r.evidence || [],
          confidenceReasons: r.confidenceReasons || [],
        });
        opportunities.push(opp); counts.opportunities++;
        if (r.status === 'needs_info') { recordNeedsInfo(ledger, cat.id, r.missing && r.missing.length ? r.missing : [...opp.missingInputs]); counts.needsInfo++; }
        else { recordFound(ledger, cat.id, opp.id); counts.found++; }
      } else throw new Error(`exhaustiveScreen: unknown status ${r.status} for ${cat.id}`);
    }
    ledgers.push(finalizeLedger(ledger));
  }
  return { opportunities, ledgers, counts, unlocated };
}
