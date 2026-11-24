// @ts-check
// City of Los Angeles module, built from the bundle's zone_rules. Rows are used as legal standards ONLY if they carry a
// complete source {citation,url,quote,retrieved} and an effective_date; otherwise every conclusion is requires_investigation
// with the row attached as an unverified hint. No municipal code citation is ever supplied here.
import { makeConclusion, makeJurisdictionModule, attr } from './framework.js';
import { makeQuantity } from '../schema/quantity.js';

const JUR = Object.freeze({ level: /** @type {'city'} */ ('city'), state: 'CA', countyFips: null, place: 'Los Angeles' });
/** topic -> row fields feeding it @type {Record<string, Array<[string, string]>>} */
const FIELDS = {
  zoning: [['allowed', 'text']],
  density: [['units_per_acre', 'du/acre'], ['max_far', 'ratio']],
  height: [['max_height_ft', 'ft']],
  setbacks: [['front_ft', 'ft'], ['side_ft', 'ft'], ['rear_ft', 'ft']],
};
const NOT_LEGAL = 'zone_rules row has no source citation, URL, quote or retrieval date; it may not be shown as a legal standard';

/** @param {any} s */
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
/** @param {any} row */
function rowSource(row) {
  const s = row && row.source;
  return s && nonEmpty(s.citation) && nonEmpty(s.url) && nonEmpty(s.quote) && nonEmpty(s.retrieved) && nonEmpty(row.effective_date) ? s : null;
}

/** @param {any} row @param {string} field @param {string} unit @param {any} src */
function rowQuantity(row, field, unit, src) {
  const n = Number(row[field]);
  if (row[field] === null || row[field] === undefined || row[field] === '' || !Number.isFinite(n)) return null;
  return makeQuantity({ value: n, low: n, high: n, unit, status: 'estimated', jurisdiction: 'Los Angeles', effectiveDate: row.effective_date,
    source: { title: src.citation, url: src.url, retrieved: src.retrieved, quote: src.quote }, method: `read from zone_rules row ${row.zone_prefix} field ${field}` });
}

/** @param {any[]} zoneRules rows of the bundle's zone_rules */
export function buildLosAngelesCityModule(zoneRules) {
  const rows = (Array.isArray(zoneRules) ? zoneRules : []).filter((r) => r && r.jurisdiction === JUR.place && nonEmpty(r.zone_prefix));
  /** @param {string} topic @returns {import('./framework.js').Evaluator} */
  const evaluator = (topic) => (parcel) => {
    const base = { topic, jurisdiction: JUR };
    const zone = attr(parcel, 'zoning_district');
    if (zone === undefined) return [makeConclusion({ ...base, finding: 'requires_investigation', missing: ['zoning_district'], note: 'parcel zoning_district is needed to select a zone_rules row' })];
    const z = String(zone).toLowerCase();
    const row = rows.filter((r) => z.startsWith(String(r.zone_prefix).toLowerCase())).sort((a, b) => b.zone_prefix.length - a.zone_prefix.length)[0];
    if (!row) return [makeConclusion({ ...base, finding: 'requires_investigation', missing: [`zone_rules row for ${zone}`], note: `no Los Angeles zone_rules row matches zoning_district ${zone}` })];
    const src = rowSource(row);
    if (!src) {
      const hint = { row, fields: Object.fromEntries(FIELDS[topic].map(([f]) => [f, row[f]])) };
      return [makeConclusion({ ...base, finding: 'requires_investigation', unverifiedHint: hint, note: NOT_LEGAL, uncertainty: { level: 'high', reasons: [NOT_LEGAL] } })];
    }
    const unc = { level: /** @type {'medium'} */ ('medium'), reasons: ['municipal row; verify against current adopted code'] };
    return FIELDS[topic].map(([f, unit]) => {
      const v = unit === 'text' ? null : rowQuantity(row, f, unit, src);
      return makeConclusion({ ...base, finding: 'conditional', source: src, effectiveDate: row.effective_date, uncertainty: unc, value: v, conditions: unit === 'text' ? [String(row[f])] : [], ruleId: `la_zone_${row.zone_prefix}` });
    });
  };
  return makeJurisdictionModule({ jurisdiction: JUR, topics: Object.fromEntries(Object.keys(FIELDS).map((t) => [t, evaluator(t)])) });
}
