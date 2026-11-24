// @ts-check
// State of California jurisdiction module. Pure: takes parsed app/data/statutes.json and state_finance_profiles.json['CA'].
// Every number is read from the record at run time and carried as a Quantity sourced to the record's own URL and evidence quote.
import { makeQuantity } from '../schema/quantity.js';
import { makeConclusion, makeJurisdictionModule, attr, TOPICS, PARCEL_ATTRIBUTES as PA } from './framework.js';
import { CATEGORY_TOPICS } from './check.js';

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
  if (!windowOf(rec).repealDate && mentionsRepeal(rec)) return { level: 'high', reasons: ['record text mentions repeal or sunset but carries no machine-readable repeal_date or sunset_date; whether the rule is still in force at asOf is not confirmed', ...unv.map((u) => `unverified: ${u}`)] };
  if (v.status === 'partially_verified') return { level: 'high', reasons: [`record verification status is partially_verified`, ...unv.map((u) => `unverified: ${u}`)] };
  if (unv.length) return { level: 'medium', reasons: unv.map((u) => `unverified: ${u}`) };
  return { level: 'low', reasons: [`record verified on ${v.checked_on}; no unverified fields listed`] };
}

/** Machine-readable window dates, read from the record only (never typed here). @param {any} rec */
const windowOf = (rec) => ({
  operativeDate: nonEmpty(rec.operative_date) ? rec.operative_date : null,
  repealDate: nonEmpty(rec.repeal_date) ? rec.repeal_date : (nonEmpty(rec.sunset_date) ? rec.sunset_date : null),
});
/** Does any text of the record mention repeal or sunset? @param {any} rec */
const mentionsRepeal = (rec) => {
  const v = rec.verification || {};
  return [rec.summary, rec.short_name, rec.unmapped_condition, v.evidence, v.notes, v.method].some((t) => typeof t === 'string' && /\b(repeal|sunset)/i.test(t));
};

/** Categories each rule is about (routing table of category ids, not legal content). */
const ALL_CATEGORIES = Object.freeze(Object.keys(CATEGORY_TOPICS));
const HOUSING_ON_SITE = ['underused_land', 'surface_parking', 'vacant_land', 'ageing_retail', 'assembly', 'densification', 'office_to_residential', 'mixed_use', 'p3_mixed_use'];
/** @type {Record<string, readonly string[]>} */
const RULE_CATEGORIES = Object.freeze({
  sb79: HOUSING_ON_SITE,
  sb9: ['lot_split', 'vacant_land', 'underused_land', 'densification'],
  ab2097: [...HOUSING_ON_SITE, 'shared_parking'],
  ab2011: HOUSING_ON_SITE,
  adu: ['adu'],
});

/** @param {any} rec @param {string} field */
const isUnverifiedField = (rec, field) => ((rec.verification || {}).unverified_fields || []).some((/** @type {string} */ u) => String(u).startsWith(field));

/** @param {any} rec @param {string} field @param {string} unit @param {string} label */
/** Quantity status comes from the record's own verification status. @param {any} rec @param {string} field */
const statusOf = (rec, field) => ((rec.verification || {}).status === 'verified' && !isUnverifiedField(rec, field) ? 'verified' : 'estimated');

function qtyOf(rec, field, unit, label, effectiveDate = rec.effective_date) {
  const src = srcOf(rec);
  if (!src || !nonEmpty(effectiveDate) || typeof rec[field] !== 'number') return null;
  const status = statusOf(rec, field);
  return makeQuantity({
    value: rec[field], low: rec[field], high: rec[field], unit, status, label, jurisdiction: rec.state_code || 'CA', effectiveDate,
    source: { title: src.citation, url: src.url, retrieved: src.retrieved, quote: src.quote }, method: `read from record ${rec.id} field ${field}`,
  });
}

/** exclusion id = leading token of each exclusion string. @param {string} s */
const exclusionId = (s) => (String(s).match(/^[a-z0-9_]+/) || [String(s)])[0];

/**
 * @typedef {{ state: 'yes'|'no'|'unknown', missing: string[], conditions: string[], satisfied?: {condition: string, attribute: string}[], note?: string }} Applicability
 * @typedef {{ field: string, unit: string, label: string }} FieldSpec
 * @typedef {{ rec: any, topic: string, fields: FieldSpec[], applicable: (parcel: any) => Applicability, baseConditions: string[], exceptions: string[], categories: readonly string[] }} Rule
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

/** County test text, from the record's own quote of the statute definition. @param {any} rec */
function countyTestName(rec) {
  const m = String((rec.verification || {}).evidence || '').match(/Urban transit county'? means ([^"(]*?)\.?(?:"|\s*\(|$)/i);
  return `urban_transit_county (${m ? m[1].trim() : 'statute county test, see record'})`;
}

/** @param {any} rec @returns {Rule[]} */
function sb79Rules(rec) {
  /** @param {any} parcel @returns {Applicability} */
  const applicable = (parcel) => {
    const p = parcel && parcel.ref && parcel.ref.jurisdiction;
    const d = attr(parcel, PA.distanceToTransit.name); const mode = attr(parcel, PA.transitMode.name); const pop = attr(parcel, PA.cityPopulation.name);
    const utc = attr(parcel, PA.urbanTransitCounty.name);
    if (utc === false) return { state: 'no', missing: [], conditions: [] };
    if (typeof d === 'number' && (d > rec.distance_to_transit_max_mi || (typeof rec.distance_to_transit_min_mi === 'number' && d <= rec.distance_to_transit_min_mi))) return { state: 'no', missing: [], conditions: [] };
    if (mode !== undefined && mode !== rec.transit_mode) return { state: 'no', missing: [], conditions: [] };
    if (typeof rec.city_population_min === 'number' && typeof pop === 'number' && pop < rec.city_population_min) return { state: 'no', missing: [], conditions: [] };
    const ex = exclusionStatus(parcel, rec.statutory_exclusions || []);
    if (ex.excluded) return { state: 'no', missing: [], conditions: [] };
    const missing = [];
    if (d === undefined) missing.push(PA.distanceToTransit.name);
    if (mode === undefined) missing.push(PA.transitMode.name);
    if (typeof rec.city_population_min === 'number' && pop === undefined) missing.push(PA.cityPopulation.name);
    missing.push(...ex.missing);
    // County test. The record's county list is a secondary-source field; the statute defines a test, not a list.
    const fips = p && p.countyFips ? String(p.countyFips) : null;
    const listed = Array.isArray(rec.eligible_counties) && fips !== null && rec.eligible_counties.includes(fips);
    const listUnverified = isUnverifiedField(rec, 'eligible_counties');
    const testName = countyTestName(rec);
    /** @type {string[]} */ const conditions = [];
    /** @type {{condition: string, attribute: string}[]} */ const satisfied = [];
    const add = (/** @type {string} */ condition, /** @type {string|null} */ attribute) => { conditions.push(condition); if (attribute) satisfied.push({ condition, attribute }); };
    let note;
    if (utc === true) add(`county test confirmed by parcel attribute ${PA.urbanTransitCounty.name}`, PA.urbanTransitCounty.name);
    else if (fips === null) { missing.push(testName); note = `county test not confirmed: parcel has no county code (ref.jurisdiction.countyFips)`; }
    else if (!listed) { missing.push(testName); note = `county test not confirmed: county ${fips} is not on the record's eligible_counties list, which is not the statute's test`; }
    else if (listUnverified) add(`county test not confirmed: county ${fips} is on the record's eligible_counties list, but that list is unverified (secondary source); confirm ${testName}`, null);
    else add(`county ${fips} is on the record's verified eligible_counties list`, null);
    add(`distance_to_transit_mi <= ${rec.distance_to_transit_max_mi}` + (typeof rec.distance_to_transit_min_mi === 'number' ? ` and > ${rec.distance_to_transit_min_mi}` : ''), PA.distanceToTransit.name);
    add(`transit_mode = ${rec.transit_mode}`, PA.transitMode.name);
    if (typeof rec.city_population_min === 'number') add(`city_population >= ${rec.city_population_min}`, PA.cityPopulation.name);
    if (rec.affordability_options) add(`affordability (record, ${rec.affordability_options.citation}): ${JSON.stringify(rec.affordability_options)}`, null);
    for (const c of ex.clear) add(`exclusion cleared by parcel attribute: ${c}`, c);
    return { state: missing.length ? 'unknown' : 'yes', missing, conditions, satisfied, ...(note ? { note } : {}) };
  };
  const exceptions = (rec.statutory_exclusions || []).map(String);
  /** @type {Array<[string, FieldSpec[]]>} */
  const topics = [
    ['tod_law', [{ field: 'distance_to_transit_max_mi', unit: 'mi', label: 'maximum distance to transit stop' }]],
    ['height', [{ field: 'max_height_ft', unit: 'ft', label: 'height figure in record' }]],
    ['density', [{ field: 'min_allowed_density_du_per_acre', unit: 'du/acre', label: 'density figure in record' }, { field: 'max_far', unit: 'ratio', label: 'FAR figure in record' }]],
  ];
  return topics.map(([topic, fields]) => ({ rec, topic, fields, applicable, baseConditions: [], exceptions, categories: RULE_CATEGORIES.sb79 }));
}

/** @param {any} rec @returns {Rule[]} */
function rulesFor(rec) {
  const exceptions = (rec.statutory_exclusions || []).map(String);
  /** @param {string} text @param {string|null} attribute @returns {{text: string, attribute: string|null}} */
  const cnd = (text, attribute) => ({ text, attribute });
  /** @param {Array<{text: string, attribute: string|null}>} cs */
  const split = (cs) => ({ conditions: cs.map((c) => c.text), satisfied: cs.filter((c) => c.attribute).map((c) => ({ condition: c.text, attribute: /** @type {string} */ (c.attribute) })) });
  if (/^ca_sb79/.test(rec.id)) return sb79Rules(rec);
  if (rec.id === 'ca_sb9_lot_split') {
    /** @param {any} parcel @returns {Applicability} */
    const applicable = (parcel) => {
      const sf = attr(parcel, PA.singleFamilyZone.name);
      if (sf === false) return { state: 'no', missing: [], conditions: [] };
      const ex = exclusionStatus(parcel, rec.statutory_exclusions || []);
      if (ex.excluded) return { state: 'no', missing: [], conditions: [] };
      const missing = [...(sf === undefined ? [PA.singleFamilyZone.name] : []), ...ex.missing];
      return { state: missing.length ? 'unknown' : 'yes', missing, ...split([
        cnd('parcel in a single-family residential zone', PA.singleFamilyZone.name),
        ...(nonEmpty(rec.min_new_parcel_note) ? [cnd(`record note: ${rec.min_new_parcel_note}`, null)] : []),
        ...(nonEmpty(rec.parking_note) ? [cnd(`record parking note: ${rec.parking_note}`, null)] : []),
        ...ex.clear.map((c) => cnd(`exclusion cleared by parcel attribute: ${c}`, c)),
      ]) };
    };
    return [
      { rec, topic: 'lot_split', fields: [{ field: 'min_new_parcel_sqft', unit: 'sqft', label: 'minimum new parcel size in record' }], applicable, baseConditions: [], exceptions, categories: RULE_CATEGORIES.sb9 },
      { rec, topic: 'density', fields: [{ field: 'max_units_by_right', unit: 'units', label: 'units by right in record' }], applicable, baseConditions: [], exceptions, categories: RULE_CATEGORIES.sb9 },
    ];
  }
  if (rec.id === 'ca_ab2097') {
    /** @param {any} parcel @returns {Applicability} */
    const applicable = (parcel) => {
      const d = attr(parcel, PA.distanceToPublicTransit.name);
      if (typeof d === 'number' && d > rec.distance_to_transit_max_mi) return { state: 'no', missing: [], conditions: [] };
      return { state: d === undefined ? 'unknown' : 'yes', missing: d === undefined ? [PA.distanceToPublicTransit.name] : [], ...split([
        cnd(`distance_to_public_transit_mi <= ${rec.distance_to_transit_max_mi}`, PA.distanceToPublicTransit.name),
        cnd(`record summary (exceptions): ${rec.summary}`, null),
      ]) };
    };
    return [{ rec, topic: 'parking', fields: [{ field: 'min_parking_spaces_per_unit', unit: 'spaces/unit', label: 'minimum parking figure in record' }], applicable, baseConditions: [], exceptions: [String(rec.summary)], categories: RULE_CATEGORIES.ab2097 }];
  }
  if (rec.id === 'ca_ab2011_affordable') {
    /** @param {any} parcel @returns {Applicability} */
    const applicable = (parcel) => {
      const z = attr(parcel, PA.zoningClass.name); const crit = attr(parcel, PA.ab2011SiteCriteriaMet.name);
      if ((z !== undefined && z !== rec.applies_to_zone) || crit === false) return { state: 'no', missing: [], conditions: [] };
      const missing = [...(z === undefined ? [PA.zoningClass.name] : []), ...(crit === undefined ? [PA.ab2011SiteCriteriaMet.name] : [])];
      return { state: missing.length ? 'unknown' : 'yes', missing, ...split([
        cnd(`zoning_class = ${rec.applies_to_zone}`, PA.zoningClass.name),
        cnd(`site criteria (record): ${rec.unmapped_condition}`, PA.ab2011SiteCriteriaMet.name),
        ...(typeof rec.affordability_mandate_pct === 'number' ? [cnd(`the proposed development is ${rec.affordability_mandate_pct}% affordable (record affordability_mandate_pct); this rule governs affordable housing only`, null)] : []),
      ]) };
    };
    return [
      { rec, topic: 'affordability', fields: [{ field: 'affordability_mandate_pct', unit: 'percent', label: 'affordable share in record' }, { field: 'affordability_term_years', unit: 'years', label: 'affordability term in record' }], applicable, baseConditions: [], exceptions, categories: RULE_CATEGORIES.ab2011 },
      { rec, topic: 'zoning', fields: [], applicable, baseConditions: [], exceptions, categories: RULE_CATEGORIES.ab2011 },
    ];
  }
  if (rec.id === 'ca_adu_66323') {
    /** @type {() => Applicability} */
    const applicable = () => ({ state: 'yes', missing: [], conditions: ['lot has a proposed or existing single-family dwelling (record summary)'] });
    return [{ rec, topic: 'density', fields: [{ field: 'adus_by_right', unit: 'units', label: 'ADUs by right in record' }], applicable, baseConditions: [], exceptions, categories: RULE_CATEGORIES.adu }];
  }
  return [];
}

/** @param {Rule} r @param {any} parcel @returns {Conclusion[]} */
function evaluateRule(r, parcel) {
  const rec = r.rec; const ap = r.applicable(parcel);
  if (ap.state === 'no') return [];
  const src = srcOf(rec); const unc = uncertaintyOf(rec);
  const base = { topic: r.topic, jurisdiction: JUR, ruleId: rec.id, source: src, effectiveDate: nonEmpty(rec.effective_date) ? rec.effective_date : null, uncertainty: unc, exceptions: r.exceptions, appliesToCategories: r.categories, ...windowOf(rec) };
  if (ap.state === 'unknown') {
    return [makeConclusion({ ...base, finding: 'requires_investigation', missing: ap.missing, conditions: ap.conditions, note: `${ap.note ? ap.note + '; ' : ''}parcel attributes needed to apply ${rec.id}: ${ap.missing.join(', ')}` })];
  }
  if (!src || !base.effectiveDate) {
    const hint = Object.fromEntries(r.fields.filter((f) => rec[f.field] !== undefined).map((f) => [f.field, rec[f.field]]));
    const why = !base.effectiveDate ? 'record has no verified effective_date' : 'record has no complete source';
    return [makeConclusion({ ...base, finding: 'requires_investigation', conditions: ap.conditions, unverifiedHint: hint, note: `${why}; figures attached are not to be shown as a legal standard`, uncertainty: { level: 'high', reasons: [why, ...unc.reasons] } })];
  }
  const mk = (/** @type {any} */ value) => makeConclusion({ ...base, finding: 'conditional', conditions: ap.conditions, satisfied: ap.satisfied || [], value });
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
  const base = { topic: 'property_tax', jurisdiction: JUR, ruleId: 'ca_prop13', source: src, effectiveDate: eff, uncertainty: unc, conditions, appliesToCategories: ALL_CATEGORIES };
  if (!src || !eff) {
    const why = !eff ? 'finance profile carries no effective date for the assessment cap' : 'finance profile has no complete source';
    return [makeConclusion({ ...base, finding: 'requires_investigation', unverifiedHint: hint, note: `${why}; figures attached are not to be shown as a legal standard`, uncertainty: { level: 'high', reasons: [why, ...unc.reasons] } })];
  }
  const status = statusOf(profile, 'annual_assessment_cap');
  const value = makeQuantity({ value: profile.annual_assessment_cap, low: profile.annual_assessment_cap, high: profile.annual_assessment_cap, unit: 'fraction/yr', status, label: 'annual assessment cap in profile',
    jurisdiction: 'CA', effectiveDate: eff, source: { title: src.citation, url: src.url, retrieved: src.retrieved, quote: src.quote }, method: 'read from the finance profile field annual_assessment_cap' });
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
