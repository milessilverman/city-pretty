// @ts-check
// Pure adapter: bundle `layers.projects` rows -> dated project records for the back-test harness. Nothing is invented.
// Row layout [kindIndex, id, address, status, units, year, lat, lon] is the one app/app.js destructures where it draws
// the project layer ("for (const [k, nm, ad, st, u, yr, lat, lon] of projs)"; kind names come from layers.pj_kinds).
// The outcome comes only from the row's own status text; any status not listed in OUTCOME_BY_STATUS has outcome null.
import { runBacktest, POSITIVE_OUTCOMES, NEGATIVE_OUTCOMES } from '../coverage/backtest.js';

/**
 * Status text -> back-test outcome. Only text that itself says the project exists (built) or does not (failed/cancelled)
 * is mapped. "Permit Expired" / "Permit Closed" do not say the project was abandoned, so they are not mapped.
 * Keys are compared after trim + lower-case.
 */
export const OUTCOME_BY_STATUS = Object.freeze(/** @type {Record<string, 'built'|'failed'|'cancelled'>} */ ({
  'completed': 'built', 'in-service': 'built', 'cofo issued': 'built', 'permit finaled': 'built',
}));

/**
 * Project kind name -> platform category, only where the kind name says it unambiguously. Housing kinds (completed,
 * permitted, approved, apartments, house, building, affordable) name an outcome or a building type, not one platform
 * category, so they are unmapped.
 */
export const CATEGORY_BY_KIND = Object.freeze(/** @type {Record<string, string>} */ ({ 'new adu': 'adu' }));

/** @param {any} v */
const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * @param {any[]} rows layers.projects @param {string[]} kinds layers.pj_kinds
 * @returns {{ records: { id: string, rowIndex: number, date: string|null, category: string|null, outcome: string|null, kind: string|null, status: string|null }[],
 *   counts: { rows: number, dated: number, undated: number, categoryMapped: number, categoryUnmapped: number, outcomeMapped: number, outcomeUnmapped: number, duplicateIds: number },
 *   byStatus: Record<string, number>, byKind: Record<string, number> }}
 */
export function projectsFromBundle(rows, kinds) {
  if (!Array.isArray(rows) || !Array.isArray(kinds)) throw new Error('projectsFromBundle: rows and kinds arrays required');
  /** @type {Record<string, number>} */ const byStatus = {};
  /** @type {Record<string, number>} */ const byKind = {};
  const seen = new Set();
  const counts = { rows: rows.length, dated: 0, undated: 0, categoryMapped: 0, categoryUnmapped: 0, outcomeMapped: 0, outcomeUnmapped: 0, duplicateIds: 0 };
  const records = rows.map((row, rowIndex) => {
    const [k, nm, , st, , yr] = row;
    const kind = typeof kinds[k] === 'string' ? kinds[k] : null;
    const status = typeof st === 'string' ? st : null;
    byStatus[status ?? '(null)'] = (byStatus[status ?? '(null)'] || 0) + 1;
    byKind[kind ?? '(unknown kind)'] = (byKind[kind ?? '(unknown kind)'] || 0) + 1;
    // the file carries a year only: the latest possible date in that year, so a record is never placed before it happened
    const year = typeof yr === 'string' && /^\d{4}$/.test(yr) ? yr : null;
    if (year) counts.dated++; else counts.undated++;
    const category = kind !== null && Object.hasOwn(CATEGORY_BY_KIND, norm(kind)) ? CATEGORY_BY_KIND[norm(kind)] : null;
    if (category) counts.categoryMapped++; else counts.categoryUnmapped++;
    const outcome = status !== null && Object.hasOwn(OUTCOME_BY_STATUS, norm(status)) ? OUTCOME_BY_STATUS[norm(status)] : null;
    if (outcome) counts.outcomeMapped++; else counts.outcomeUnmapped++;
    const base = typeof nm === 'string' && nm ? nm : `row-${rowIndex}`;
    let id = `la-project:${base}`;
    if (seen.has(id)) { counts.duplicateIds++; id = `${id}#${rowIndex}`; }
    seen.add(id);
    return { id, rowIndex, date: year ? `${year}-12-31` : null, category, outcome, kind, status };
  });
  return { records, counts, byStatus, byKind };
}

/**
 * Choose the cut-off year: the year by which `share` of the dated records that have a mapped outcome are on or before. Returns null when none.
 * @param {{ date: string|null, outcome: string|null }[]} records @param {number} share 0..1
 * @returns {number|null}
 */
export function chooseCutoffYear(records, share) {
  const ys = records.filter((r) => r.date && r.outcome).map((r) => Number(/** @type {string} */ (r.date).slice(0, 4))).sort((a, b) => a - b);
  if (!ys.length) return null;
  return ys[Math.min(ys.length - 1, Math.ceil(ys.length * share) - 1)];
}

/**
 * Split at the cut-off and ask the harness. The harness's own refusal is returned as the result (never bypassed).
 * truth = dated records after the cut-off that have a mapped outcome AND a mapped category; inputs = dated records on or before it.
 * @param {{ rows: any[], kinds: string[], cutoffYear: number, discover: (inputs: readonly any[]) => any[] }} args
 */
export function backtestLaProjects({ rows, kinds, cutoffYear, discover }) {
  const { records, counts, byStatus, byKind } = projectsFromBundle(rows, kinds);
  const cutoff = `${cutoffYear}-12-31`;
  const dated = records.filter((r) => r.date);
  const inputs = dated.filter((r) => /** @type {string} */ (r.date) <= cutoff);
  const after = dated.filter((r) => /** @type {string} */ (r.date) > cutoff);
  const truth = after.filter((r) => r.outcome && r.category);
  const truthOutcomes = Object.fromEntries([...POSITIVE_OUTCOMES, ...NEGATIVE_OUTCOMES, 'alternative'].map((o) => [o, truth.filter((t) => t.outcome === o).length]));
  const tally = {
    cutoff, rows: counts.rows, undated: counts.undated, inputs: inputs.length, afterCutoff: after.length,
    afterCutoffWithOutcome: after.filter((r) => r.outcome).length, truth: truth.length, truthOutcomes,
    outcomeUnmapped: counts.outcomeUnmapped, categoryMapped: counts.categoryMapped, categoryUnmapped: counts.categoryUnmapped,
    duplicateIds: counts.duplicateIds, byStatus, byKind,
  };
  try {
    const result = runBacktest({ cutoff, inputs: /** @type {any} */ (inputs), truth: /** @type {any} */ (truth), discover: /** @type {any} */ (discover) });
    return { possible: true, refusal: null, result, tally };
  } catch (e) {
    return { possible: false, refusal: { name: e instanceof Error ? e.name : 'Error', message: e instanceof Error ? e.message : String(e) }, result: null, tally };
  }
}
