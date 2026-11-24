// @ts-check
// Regulatory framework: conclusions carry jurisdiction + source + effective date + uncertainty.
// A jurisdiction module can never be applied to a parcel outside its jurisdiction. Unknown is never "not_allowed".
import { isQuantity } from '../schema/quantity.js';

/** @typedef {'zoning'|'density'|'height'|'setbacks'|'parking'|'lot_split'|'tod_law'|'affordability'|'environmental'|'easements'|'permitting'|'incentives'|'property_tax'} Topic */
/** @typedef {'allowed'|'not_allowed'|'conditional'|'requires_investigation'} Finding */
/** @typedef {{ level: 'state'|'county'|'city', state: string, countyFips?: string|null, place?: string|null }} RegJurisdiction */
/** @typedef {{ citation: string, url: string, quote: string, retrieved: string }} RegSource */
/** @typedef {{ level: 'low'|'medium'|'high', reasons: string[] }} Uncertainty */
/**
 * @typedef {Object} Conclusion
 * @property {string} topic
 * @property {Finding} finding
 * @property {RegJurisdiction} jurisdiction
 * @property {readonly string[]} conditions
 * @property {import('../schema/quantity.js').Quantity|null} value
 * @property {RegSource|null} source
 * @property {string|null} effectiveDate
 * @property {Uncertainty|null} uncertainty
 * @property {readonly string[]} exceptions
 * @property {readonly string[]} missing      parcel attributes (or facts) needed before a finding can be made
 * @property {'in_effect'|'not_yet_in_effect'|'repealed'} status
 * @property {string} [note]
 * @property {any} [unverifiedHint]           unverified data attached for a human; may not be shown as a legal standard
 * @property {string} [ruleId]
 * @property {readonly string[]|null} appliesToCategories   parcel categories the governing rule is about; null = not declared (the check then ignores the conclusion)
 * @property {readonly {condition: string, attribute: string}[]} satisfied  conditions already met by a known parcel attribute (see PARCEL_ATTRIBUTES)
 * @property {string|null} operativeDate   rule applies only on/after this date (read from the record), or null
 * @property {string|null} repealDate      rule applies only before this date (read from the record), or null
 */

export const TOPICS = Object.freeze(['zoning', 'density', 'height', 'setbacks', 'parking', 'lot_split', 'tod_law', 'affordability', 'environmental', 'easements', 'permitting', 'incentives', 'property_tax']);
/**
 * The one table of parcel attribute names the regulatory rules read. Adapters map their own layers to these names.
 * Keyed by a role key used in code; `name` is the key in parcel.attributes. Plain value or Quantity both accepted (see attr()).
 */
export const PARCEL_ATTRIBUTES = Object.freeze(Object.fromEntries([
  ['distanceToTransit', 'distance_to_transit_mi', 'distance in miles to the nearest transit stop (of the mode in transitMode)', 'number'],
  ['transitMode', 'transit_mode', 'service type of that stop, using the record\'s transit_mode vocabulary', 'string'],
  ['cityPopulation', 'city_population', 'population of the city containing the parcel', 'number'],
  ['distanceToPublicTransit', 'distance_to_public_transit_mi', 'distance in miles to any public transit stop', 'number'],
  ['urbanTransitCounty', 'urban_transit_county', 'adapter-confirmed result of the statute\'s urban transit county test for the parcel\'s county', 'boolean'],
  ['singleFamilyZone', 'single_family_zone', 'parcel is in a single-family residential zone', 'boolean'],
  ['zoningClass', 'zoning_class', 'generic zoning class label (for example commercial)', 'string'],
  ['zoningDistrict', 'zoning_district', 'local zoning district code (for example R1-1)', 'string'],
  ['ab2011SiteCriteriaMet', 'ab2011_site_criteria_met', 'site meets every site criterion listed in the AB 2011 record', 'boolean'],
  ['calfireOrStateVhfhsz', 'calfire_or_state_vhfhsz', 'parcel is in a very high fire hazard severity zone', 'boolean'],
  ['rentControlledHousingSite', 'rent_controlled_housing_site', 'site is or was rent or price controlled housing', 'boolean'],
  ['mobilehomeOrRvParkSite', 'mobilehome_or_rv_park_site', 'site is a mobilehome or RV park', 'boolean'],
  ['historicDistrictHpoz', 'historic_district_hpoz', 'parcel is in a historic district or HPOZ', 'boolean'],
  ['femaFloodway', 'fema_100yr_floodway', 'parcel is in a FEMA 100-year floodway', 'boolean'],
  ['primeFarmland', 'prime_farmland', 'parcel is prime farmland', 'boolean'],
].map(([key, name, meaning, type]) => [key, Object.freeze({ name, meaning, type })])));
/** @type {ReadonlySet<string>} */
export const PARCEL_ATTRIBUTE_NAMES = new Set(Object.values(PARCEL_ATTRIBUTES).map((a) => a.name));

export const FINDINGS = Object.freeze(['allowed', 'not_allowed', 'conditional', 'requires_investigation']);
const LEVELS = ['state', 'county', 'city'];
const UNCERTAINTY_LEVELS = ['low', 'medium', 'high'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {any} s */
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
/** @param {any} s */
const norm = (s) => String(s ?? '').trim().toLowerCase();
/** @param {any} a @returns {string[]} */
const strs = (a) => (Array.isArray(a) ? a.filter(nonEmpty) : []);

/** @param {any} j @returns {RegJurisdiction} */
export function validateJurisdiction(j) {
  if (!j || typeof j !== 'object' || !LEVELS.includes(j.level) || !nonEmpty(j.state)) throw new Error('jurisdiction needs level (state|county|city) and state');
  if (j.level !== 'state' && !nonEmpty(j.countyFips) && !(j.level === 'city' && nonEmpty(j.place))) throw new Error('county jurisdiction needs countyFips; city jurisdiction needs place');
  if (j.level === 'city' && !nonEmpty(j.place)) throw new Error('city jurisdiction needs place');
  return Object.freeze({ level: j.level, state: j.state, countyFips: j.countyFips ?? null, place: j.place ?? null });
}

/**
 * Build a conclusion. Any finding other than requires_investigation needs source, effectiveDate and uncertainty.
 * @param {{ topic: string, jurisdiction: any, finding: string, conditions?: string[], value?: import('../schema/quantity.js').Quantity|null,
 *   source?: RegSource|null, effectiveDate?: string|null, uncertainty?: Uncertainty|null, exceptions?: string[], missing?: string[],
 *   status?: 'in_effect'|'not_yet_in_effect'|'repealed', note?: string, unverifiedHint?: any, ruleId?: string,
 *   appliesToCategories?: readonly string[]|null, satisfied?: readonly {condition: string, attribute: string}[], operativeDate?: string|null, repealDate?: string|null }} spec
 * @returns {Conclusion}
 */
export function makeConclusion(spec) {
  if (!spec || typeof spec !== 'object') throw new TypeError('makeConclusion: spec required');
  const errs = [];
  if (!TOPICS.includes(/** @type {any} */ (spec.topic))) errs.push(`unknown topic ${spec.topic}`);
  if (!FINDINGS.includes(/** @type {any} */ (spec.finding))) errs.push(`unknown finding ${spec.finding}`);
  /** @type {RegJurisdiction|null} */
  let jurisdiction = null;
  try { jurisdiction = validateJurisdiction(spec.jurisdiction); } catch (e) { errs.push(/** @type {Error} */ (e).message); }
  const src = spec.source ?? null;
  const srcOk = !!src && nonEmpty(src.citation) && nonEmpty(src.url) && nonEmpty(src.quote) && nonEmpty(src.retrieved);
  const eff = spec.effectiveDate ?? null;
  if (eff !== null && !(typeof eff === 'string' && DATE_RE.test(eff))) errs.push('effectiveDate must be YYYY-MM-DD');
  const unc = spec.uncertainty ?? null;
  const uncOk = !!unc && UNCERTAINTY_LEVELS.includes(unc.level) && strs(unc.reasons).length > 0;
  for (const [k, v] of [['operativeDate', spec.operativeDate], ['repealDate', spec.repealDate]]) {
    if (v != null && !(typeof v === 'string' && DATE_RE.test(v))) errs.push(`${k} must be YYYY-MM-DD`);
  }
  if (spec.appliesToCategories != null && !(Array.isArray(spec.appliesToCategories) && spec.appliesToCategories.every(nonEmpty))) errs.push('appliesToCategories must be a list of category ids');
  const satisfied = (Array.isArray(spec.satisfied) ? spec.satisfied : []).filter((x) => x && nonEmpty(x.condition) && nonEmpty(x.attribute));
  if (spec.value != null && !isQuantity(spec.value)) errs.push('value must be a Quantity or null');
  if (spec.finding !== 'requires_investigation') {
    if (!srcOk) errs.push('a finding other than requires_investigation needs source {citation,url,quote,retrieved}');
    if (eff === null) errs.push('a finding other than requires_investigation needs effectiveDate');
    if (!uncOk) errs.push('a finding other than requires_investigation needs uncertainty {level, reasons[]}');
  }
  if (errs.length) throw new Error('makeConclusion: ' + errs.join('; '));
  return Object.freeze({
    topic: spec.topic, finding: /** @type {Finding} */ (spec.finding), jurisdiction: /** @type {RegJurisdiction} */ (jurisdiction),
    conditions: Object.freeze(strs(spec.conditions)), value: spec.value ?? null,
    source: srcOk ? Object.freeze({ ...(/** @type {RegSource} */ (src)) }) : null, effectiveDate: eff,
    uncertainty: uncOk ? Object.freeze({ level: /** @type {Uncertainty} */ (unc).level, reasons: strs(/** @type {Uncertainty} */ (unc).reasons) }) : (unc ? /** @type {Uncertainty} */ (unc) : null),
    exceptions: Object.freeze(strs(spec.exceptions)), missing: Object.freeze(strs(spec.missing)),
    status: spec.status ?? 'in_effect',
    ...(spec.note ? { note: spec.note } : {}), ...(spec.unverifiedHint !== undefined ? { unverifiedHint: spec.unverifiedHint } : {}),
    ...(spec.ruleId ? { ruleId: spec.ruleId } : {}),
    appliesToCategories: Array.isArray(spec.appliesToCategories) ? Object.freeze([...spec.appliesToCategories]) : null,
    satisfied: Object.freeze(satisfied.map((x) => Object.freeze({ condition: x.condition, attribute: x.attribute }))),
    operativeDate: spec.operativeDate ?? null, repealDate: spec.repealDate ?? null,
  });
}

/**
 * Read a parcel attribute: plain value, or the value of a Quantity. Returns undefined when unknown.
 * @param {any} parcel @param {string} name
 */
export function attr(parcel, name) {
  const v = parcel && parcel.attributes ? parcel.attributes[name] : undefined;
  if (v === undefined || v === null || v === '') return undefined;
  if (isQuantity(v)) return v.value === null ? undefined : v.value;
  if (typeof v === 'number' && !Number.isFinite(v)) return undefined;
  return v;
}

/** Parcel jurisdiction or null. @param {any} parcel */
export function parcelJurisdiction(parcel) {
  const j = parcel && parcel.ref && parcel.ref.jurisdiction;
  return j && nonEmpty(j.state) ? j : null;
}

/** Does the jurisdiction contain the parcel? @param {RegJurisdiction} j @param {any} parcel */
export function contains(j, parcel) {
  const p = parcelJurisdiction(parcel);
  if (!p) return false;
  if (norm(p.state) !== norm(j.state)) return false;
  if (j.level === 'state') return true;
  if (j.level === 'county') return nonEmpty(j.countyFips) && norm(p.countyFips) === norm(j.countyFips);
  if (nonEmpty(j.countyFips) && norm(p.countyFips) !== norm(j.countyFips)) return false;
  return nonEmpty(j.place) && nonEmpty(p.place) && norm(p.place) === norm(j.place);
}

/** @param {any} asOf */
function checkAsOf(asOf) {
  if (typeof asOf !== 'string' || !DATE_RE.test(asOf)) throw new TypeError('asOf (YYYY-MM-DD) is required');
}

/**
 * @typedef {(parcel: any, asOf: string) => Conclusion[]} Evaluator
 * @typedef {{ jurisdiction: RegJurisdiction, topics: () => string[], covers: (topic: string) => boolean, contains: (parcel: any) => boolean,
 *   evaluate: (parcel: any, topic: string, asOf: string) => Conclusion[] }} JurisdictionModule
 */

/**
 * @param {{ jurisdiction: any, topics: Record<string, Evaluator> }} spec
 * @returns {JurisdictionModule}
 */
export function makeJurisdictionModule(spec) {
  const jurisdiction = validateJurisdiction(spec && spec.jurisdiction);
  const table = Object.freeze({ ...(spec.topics || {}) });
  for (const [t, fn] of Object.entries(table)) {
    if (!TOPICS.includes(/** @type {any} */ (t))) throw new Error(`module: unknown topic ${t}`);
    if (typeof fn !== 'function') throw new Error(`module: evaluator for ${t} must be a function`);
  }
  return Object.freeze({
    jurisdiction,
    topics: () => Object.keys(table),
    covers: (/** @type {string} */ t) => Object.prototype.hasOwnProperty.call(table, t),
    contains: (/** @type {any} */ parcel) => contains(jurisdiction, parcel),
    evaluate(parcel, topic, asOf) {
      checkAsOf(asOf);
      if (!contains(jurisdiction, parcel)) {
        const p = parcelJurisdiction(parcel);
        throw new Error(`jurisdiction module ${jurisdiction.level}:${jurisdiction.state}${jurisdiction.place ? '/' + jurisdiction.place : ''} cannot be applied to a parcel in ${p ? `${p.state}/${p.countyFips ?? '?'}/${p.place ?? '?'}` : 'an unknown jurisdiction'}`);
      }
      if (!Object.prototype.hasOwnProperty.call(table, topic)) throw new Error(`module has no evaluator for topic ${topic}`);
      return table[topic](parcel, asOf).map((c) => {
        /** @type {string|null} */ let why = null; let status = /** @type {'not_yet_in_effect'|'repealed'} */ ('not_yet_in_effect');
        if (c.effectiveDate && c.effectiveDate > asOf) why = `not_yet_in_effect: rule takes effect ${c.effectiveDate}, after asOf ${asOf}; not applied`;
        else if (c.operativeDate && c.operativeDate > asOf) why = `not_yet_in_effect: rule becomes operative ${c.operativeDate}, after asOf ${asOf}; not applied`;
        else if (c.repealDate && c.repealDate <= asOf) { why = `repealed: record repeal/sunset date ${c.repealDate} is on or before asOf ${asOf}; not applied`; status = 'repealed'; }
        if (!why) return c;
        return makeConclusion({
          topic: c.topic, jurisdiction: c.jurisdiction, finding: 'requires_investigation', value: null, source: c.source,
          effectiveDate: c.effectiveDate, uncertainty: c.uncertainty, status, ruleId: c.ruleId,
          conditions: [...c.conditions], exceptions: [...c.exceptions], appliesToCategories: c.appliesToCategories,
          operativeDate: c.operativeDate, repealDate: c.repealDate, note: why,
        });
      });
    },
  });
}

/** @returns {{ register: (m: JurisdictionModule) => void, modules: () => JurisdictionModule[], evaluate: (parcel: any, topic: string, asOf: string) => Conclusion[] }} */
export function createRegistry() {
  /** @type {JurisdictionModule[]} */
  const mods = [];
  return {
    register(m) {
      if (!m || typeof m.evaluate !== 'function' || !m.jurisdiction) throw new Error('register: not a jurisdiction module');
      mods.push(m);
    },
    modules: () => [...mods],
    evaluate(parcel, topic, asOf) {
      checkAsOf(asOf);
      if (!TOPICS.includes(/** @type {any} */ (topic))) throw new Error(`unknown topic ${topic}`);
      const pj = parcelJurisdiction(parcel);
      /** @param {string} why @param {string[]} missing */
      const ri = (why, missing) => makeConclusion({
        topic, finding: 'requires_investigation', missing,
        jurisdiction: pj ? { level: 'state', state: pj.state, countyFips: null, place: null } : { level: 'state', state: 'unknown' },
        note: why,
      });
      if (!pj) return [ri('parcel has no jurisdiction (ref.jurisdiction.state)', ['parcel.ref.jurisdiction'])];
      const covering = mods.filter((m) => m.contains(parcel) && m.covers(topic));
      if (covering.length === 0) {
        const where = [pj.state, pj.countyFips, pj.place].filter(Boolean).join('/');
        return [ri(`no jurisdiction module for topic ${topic} in ${where}`, [`jurisdiction_module:${where}:${topic}`])];
      }
      const out = covering.flatMap((m) => m.evaluate(parcel, topic, asOf));
      if (out.length === 0) {
        const where = [pj.state, pj.countyFips, pj.place].filter(Boolean).join('/');
        return [ri(`no registered rule applies to this parcel for topic ${topic} in ${where}; local rules not covered`, [`applicable_rule:${where}:${topic}`])];
      }
      return out;
    },
  };
}
