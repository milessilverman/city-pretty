// @ts-check
// State of California jurisdiction module. Pure: takes parsed app/data/statutes.json and state_finance_profiles.json['CA'].
// Every number is read from the record at run time and carried as a Quantity sourced to the record's own URL and evidence quote.
import { makeQuantity } from '../schema/quantity.js';
import { makeConclusion, makeJurisdictionModule, attr, TOPICS } from './framework.js';

/** @typedef {import('./framework.js').Conclusion} Conclusion */

const JUR = Object.freeze({ level: /** @type {'state'} */ ('state'), state: 'CA', countyFips: null, place: null });
const USABLE = ['verified', 'partially_verified'];

/** @param {any} v */
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/** @param {any} rec @returns {import('./framework.js').RegSource|null} */
function srcOf(rec) {
  const v = rec && rec.verification;
  const s = { citation: rec.statute_citation || rec.statutory_citation, url: rec.statute_url || rec.source_url, quote: v && v.evidence, retrieved: v && v.checked_on };
  return nonEmpty(s.citation) && nonEmpty(s.url) && nonEmpty(s.quote) && nonEmpty(s.retrieved) ? s : null;
}

/** @param {any} rec @returns {import('./framework.js').Uncertainty} */
function uncertaintyOf(rec) {
  const v = rec.verification || {};
  const unv = Array.isArray(v.unverified_fields) ? v.unverified_fields.filter(nonEmpty) : [];
  if (v.status === 'partially_verified') return { level: 'high', reasons: [`record verification status is partially_verified`, ...unv.map((u) => `unverified: ${u}`)] };
  if (unv.length) return { level: 'medium', reasons: unv.map((u) => `unverified: ${u}`) };
  return { level: 'low', reasons: [`record verified on ${v.checked_on}; no unverified fields listed`] };
}

/** @param {any} rec @param {string} field */
const isUnverifiedField = (rec, field) => ((rec.verification || {}).unverified_fields || []).some((/** @type {string} */ u) => String(u).startsWith(field));

/** @param {any} rec @param {string} field @param {string} unit @param {string} label */
function qtyOf(rec, field, unit, label) {
  const src = srcOf(rec);
  if (!src || !nonEmpty(rec.effective_date) || typeof rec[field] !== 'number') return null;
  const status = rec.verification.status === 'verified' && !isUnverifiedField(rec, field) ? 'verified' : 'estimated';
  return makeQuantity({
    value: rec[field], low: rec[field], high: rec[field], unit, status, label, jurisdiction: rec.state_code, effectiveDate: rec.effective_date,
    source: { title: src.citation, url: src.url, retrieved: src.retrieved, quote: src.quote }, method: `read from record ${rec.id} field ${field}`,
  });
}

/** exclusion id = leading token of each exclusion string. @param {string} s */
const exclusionId = (s) => (String(s).match(/^[a-z0-9_]+/) || [String(s)])[0];

/**
 * @typedef {{ state: 'yes'|'no'|'unknown', missing: string[], conditions: string[] }} Applicability
 * @typedef {{ field: string, unit: string, label: string }} FieldSpec
 * @typedef {{ rec: any, topic: string, fields: FieldSpec[], applicable: (parcel: any) => Applicability, baseConditions: string[], exceptions: string[] }} Rule
 */

/** Exclusion attributes: true => rule excluded; false => clear; undefined => missing.
 * @param {any} parcel @param {string[]} exclusions @returns {{ excluded: boolean, missing: string[], clear: string[] }} */
function exclusionStatus(parcel, exclusions) {
  const missing = []; const clear = []; let excluded = false;
  for (const e of exclusions) {
    const id = exclusionId(e); const v = attr(parcel, id);
    if (v === true) excluded = true; else if (v === false) clear.push(id); else missing.push(id);
  }
  return { excluded, missing, clear };
}

/** @param {any} rec @returns {Rule[]} */
function sb79Rules(rec) {
  /** @param {any} parcel @returns {Applicability} */
  const applicable = (parcel) => {
    const p = parcel && parcel.ref && parcel.ref.jurisdiction;
    if (Array.isArray(rec.eligible_counties) && p && !rec.eligible_counties.includes(p.countyFips)) return { state: 'no', missing: [], conditions: [] };
    const d = attr(parcel, 'distance_to_transit_mi'); const mode = attr(parcel, 'transit_mode'); const pop = attr(parcel, 'city_population');
    if (typeof d === 'number' && (d > rec.distance_to_transit_max_mi || (typeof rec.distance_to_transit_min_mi === 'number' && d <= rec.distance_to_transit_min_mi))) return { state: 'no', missing: [], conditions: [] };
    if (mode !== undefined && mode !== rec.transit_mode) return { state: 'no', missing: [], conditions: [] };
    if (typeof rec.city_population_min === 'number' && typeof pop === 'number' && pop < rec.city_population_min) return { state: 'no', missing: [], conditions: [] };
    const ex = exclusionStatus(parcel, rec.statutory_exclusions || []);
    if (ex.excluded) return { state: 'no', missing: [], conditions: [] };
    const missing = [];
    if (d === undefined) missing.push('distance_to_transit_mi');
    if (mode === undefined) missing.push('transit_mode');
    if (typeof rec.city_population_min === 'number' && pop === undefined) missing.push('city_population');
    missing.push(...ex.missing);
    const conditions = [
      `distance_to_transit_mi <= ${rec.distance_to_transit_max_mi}` + (typeof rec.distance_to_transit_min_mi === 'number' ? ` and > ${rec.distance_to_transit_min_mi}` : ''),
      `transit_mode = ${rec.transit_mode}`,
      ...(typeof rec.city_population_min === 'number' ? [`city_population >= ${rec.city_population_min}`] : []),
      ...(rec.affordability_options ? [`affordability (record, ${rec.affordability_options.citation}): ${JSON.stringify(rec.affordability_options)}`] : []),
      ...ex.clear.map((c) => `exclusion cleared by parcel attribute: ${c}`),
    ];
    return { state: missing.length ? 'unknown' : 'yes', missing, conditions };
  };
  const exceptions = (rec.statutory_exclusions || []).map(String);
  /** @type {Array<[string, FieldSpec[]]>} */
  const topics = [
    ['tod_law', [{ field: 'distance_to_transit_max_mi', unit: 'mi', label: 'maximum distance to transit stop' }]],
    ['height', [{ field: 'max_height_ft', unit: 'ft', label: 'height figure in record' }]],
    ['density', [{ field: 'min_allowed_density_du_per_acre', unit: 'du/acre', label: 'density figure in record' }, { field: 'max_far', unit: 'ratio', label: 'FAR figure in record' }]],
  ];
  return topics.map(([topic, fields]) => ({ rec, topic, fields, applicable, baseConditions: [], exceptions }));
}

/** @param {any} rec @returns {Rule[]} */
function rulesFor(rec) {
  const exceptions = (rec.statutory_exclusions || []).map(String);
  if (/^ca_sb79/.test(rec.id)) return sb79Rules(rec);
  if (rec.id === 'ca_sb9_lot_split') {
    /** @param {any} parcel @returns {Applicability} */
    const applicable = (parcel) => {
      const sf = attr(parcel, 'single_family_zone');
      if (sf === false) return { state: 'no', missing: [], conditions: [] };
      const ex = exclusionStatus(parcel, rec.statutory_exclusions || []);
      if (ex.excluded) return { state: 'no', missing: [], conditions: [] };
      const missing = [...(sf === undefined ? ['single_family_zone'] : []), ...ex.missing];
      return { state: missing.length ? 'unknown' : 'yes', missing, conditions: ['parcel in a single-family residential zone', ...(nonEmpty(rec.min_new_parcel_note) ? [`record note: ${rec.min_new_parcel_note}`] : []), ...(nonEmpty(rec.parking_note) ? [`record parking note: ${rec.parking_note}`] : [])] };
    };
    return [
      { rec, topic: 'lot_split', fields: [{ field: 'min_new_parcel_sqft', unit: 'sqft', label: 'minimum new parcel size in record' }], applicable, baseConditions: [], exceptions },
      { rec, topic: 'density', fields: [{ field: 'max_units_by_right', unit: 'units', label: 'units by right in record' }], applicable, baseConditions: [], exceptions },
    ];
  }
  if (rec.id === 'ca_ab2097') {
    /** @param {any} parcel @returns {Applicability} */
    const applicable = (parcel) => {
      const d = attr(parcel, 'distance_to_public_transit_mi');
      if (typeof d === 'number' && d > rec.distance_to_transit_max_mi) return { state: 'no', missing: [], conditions: [] };
      return { state: d === undefined ? 'unknown' : 'yes', missing: d === undefined ? ['distance_to_public_transit_mi'] : [], conditions: [`distance_to_public_transit_mi <= ${rec.distance_to_transit_max_mi}`, `record summary (exceptions): ${rec.summary}`] };
    };
    return [{ rec, topic: 'parking', fields: [{ field: 'min_parking_spaces_per_unit', unit: 'spaces/unit', label: 'minimum parking figure in record' }], applicable, baseConditions: [], exceptions: [String(rec.summary)] }];
  }
  if (rec.id === 'ca_ab2011_affordable') {
    /** @param {any} parcel @returns {Applicability} */
    const applicable = (parcel) => {
      const z = attr(parcel, 'zoning_class'); const crit = attr(parcel, 'ab2011_site_criteria_met');
      if ((z !== undefined && z !== rec.applies_to_zone) || crit === false) return { state: 'no', missing: [], conditions: [] };
      const missing = [...(z === undefined ? ['zoning_class'] : []), ...(crit === undefined ? ['ab2011_site_criteria_met'] : [])];
      return { state: missing.length ? 'unknown' : 'yes', missing, conditions: [`zoning_class = ${rec.applies_to_zone}`, `site criteria (record): ${rec.unmapped_condition}`] };
    };
    return [
      { rec, topic: 'affordability', fields: [{ field: 'affordability_mandate_pct', unit: 'percent', label: 'affordable share in record' }, { field: 'affordability_term_years', unit: 'years', label: 'affordability term in record' }], applicable, baseConditions: [], exceptions },
      { rec, topic: 'zoning', fields: [], applicable, baseConditions: [], exceptions },
    ];
  }
  if (rec.id === 'ca_adu_66323') {
    /** @type {() => Applicability} */
    const applicable = () => ({ state: 'yes', missing: [], conditions: ['lot has a proposed or existing single-family dwelling (record summary)'] });
    return [{ rec, topic: 'density', fields: [{ field: 'adus_by_right', unit: 'units', label: 'ADUs by right in record' }], applicable, baseConditions: [], exceptions }];
  }
  return [];
}

/** @param {Rule} r @param {any} parcel @returns {Conclusion[]} */
function evaluateRule(r, parcel) {
  const rec = r.rec; const ap = r.applicable(parcel);
  if (ap.state === 'no') return [];
  const src = srcOf(rec); const unc = uncertaintyOf(rec);
  const base = { topic: r.topic, jurisdiction: JUR, ruleId: rec.id, source: src, effectiveDate: nonEmpty(rec.effective_date) ? rec.effective_date : null, uncertainty: unc, exceptions: r.exceptions };
  if (ap.state === 'unknown') {
    return [makeConclusion({ ...base, finding: 'requires_investigation', missing: ap.missing, conditions: ap.conditions, note: `parcel attributes needed to apply ${rec.id}: ${ap.missing.join(', ')}` })];
  }
  if (!src || !base.effectiveDate) {
    const hint = Object.fromEntries(r.fields.filter((f) => rec[f.field] !== undefined).map((f) => [f.field, rec[f.field]]));
    const why = !base.effectiveDate ? 'record has no verified effective_date' : 'record has no complete source';
    return [makeConclusion({ ...base, finding: 'requires_investigation', conditions: ap.conditions, unverifiedHint: hint, note: `${why}; figures attached are not to be shown as a legal standard`, uncertainty: { level: 'high', reasons: [why, ...unc.reasons] } })];
  }
  const mk = (/** @type {any} */ value) => makeConclusion({ ...base, finding: 'conditional', conditions: ap.conditions, value });
  const vals = r.fields.map((f) => qtyOf(rec, f.field, f.unit, f.label)).filter((q) => q !== null);
  return vals.length ? vals.map(mk) : (r.fields.length ? [] : [mk(null)]);
}

/** @param {any} profile CA row of state_finance_profiles.json @returns {Conclusion[]} */
function propertyTaxConclusions(profile) {
  if (!profile || profile.state_code !== 'CA') return [];
  const v = profile.verification || {};
  if (!USABLE.includes(v.status)) return [];
  const src = srcOf(profile);
  const eff = nonEmpty(profile.effective_date) ? profile.effective_date : null;
  const unc = uncertaintyOf(profile);
  const conditions = [`uncaps_on_sale = ${profile.uncaps_on_sale} (profile field)`];
  const hint = { annual_assessment_cap: profile.annual_assessment_cap, uncaps_on_sale: profile.uncaps_on_sale };
  const base = { topic: 'property_tax', jurisdiction: JUR, ruleId: 'ca_prop13', source: src, effectiveDate: eff, uncertainty: unc, conditions };
  if (!src || !eff) {
    const why = !eff ? 'finance profile carries no effective date for the assessment cap' : 'finance profile has no complete source';
    return [makeConclusion({ ...base, finding: 'requires_investigation', unverifiedHint: hint, note: `${why}; figures attached are not to be shown as a legal standard`, uncertainty: { level: 'high', reasons: [why, ...unc.reasons] } })];
  }
  const value = makeQuantity({ value: profile.annual_assessment_cap, low: profile.annual_assessment_cap, high: profile.annual_assessment_cap, unit: 'fraction/yr', status: 'verified', label: 'annual assessment cap in profile',
    jurisdiction: 'CA', effectiveDate: eff, source: { title: src.citation, url: src.url, retrieved: src.retrieved, quote: src.quote } });
  return [makeConclusion({ ...base, finding: 'conditional', value })];
}

/**
 * @param {any[]} statuteRecords parsed statutes.json
 * @param {any} financeProfileCA state_finance_profiles.json['CA']
 */
export function buildCaliforniaModule(statuteRecords, financeProfileCA) {
  const recs = (Array.isArray(statuteRecords) ? statuteRecords : []).filter((r) => r && r.state_code === 'CA' && r.verification && USABLE.includes(r.verification.status));
  const rules = recs.flatMap(rulesFor);
  const profile = financeProfileCA ? { ...financeProfileCA, state_code: financeProfileCA.state_code || 'CA' } : null;
  /** @type {Record<string, import('./framework.js').Evaluator>} */
  const topics = {};
  for (const t of TOPICS) {
    const rs = rules.filter((r) => r.topic === t);
    if (rs.length) topics[t] = (parcel) => rs.flatMap((r) => evaluateRule(r, parcel));
  }
  if (profile) topics.property_tax = () => propertyTaxConclusions(profile);
  return makeJurisdictionModule({ jurisdiction: JUR, topics });
}
