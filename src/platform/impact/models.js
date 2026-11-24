// @ts-check
// ImpactModel: one record per improvement type. Every number is a sourced Quantity; nothing is defaulted here.
import { isQuantity } from '../schema/quantity.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/**
 * @typedef {Object} ImpactLayerModel  a signed effect (the model itself, or one of its negative effects)
 * @property {string} id
 * @property {string} target   e.g. 'residential_property_value', 'noise', 'traffic_volume', 'safety'
 * @property {1|-1} sign
 * @property {{ form: 'bands'|'linear'|'exponential', parameters: Record<string, Quantity>, bands?: { outer: Quantity, weight: Quantity }[] }} decay
 * @property {Quantity} reach        length (unit m, km or mile); the OUTER radius
 * @property {Quantity} [innerRadius] length; when present the effect is an annulus (weight 0 closer than this)
 * @property {Quantity} magnitude    low/high carry the study range
 * @property {'network'|'straight_line'|'unspecified'} distanceBasis  as used by the cited study
 * @property {{ title: string, url: string, retrieved: string, quote?: string }} source
 * @typedef {ImpactLayerModel & { categoryIds: string[], transferability: string, negativeEffects: ImpactLayerModel[], variant?: string, specificity?: number, appliesTo?: Record<string, string>, alternativeTo?: string[],
 *   sharedCategoryJustification?: string, verification?: any, caveat?: string, studyArea?: string }} ImpactModel
 */

export const DECAY_FORMS = Object.freeze(['bands', 'linear', 'exponential']);
export const DISTANCE_BASES = Object.freeze(['network', 'straight_line', 'unspecified']);
/** Physical unit conversions to metres (constants of measurement, not policy parameters). */
const METRES_PER = { m: 1, km: 1000, mile: 1609.344, mi: 1609.344 };

/** @param {any} s */
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

/** Convert a length Quantity to metres. Throws if unit unknown or value null. @param {Quantity} q */
export function toMetres(q) {
  const f = /** @type {Record<string, number>} */ (METRES_PER)[q.unit];
  if (f === undefined) throw new Error(`toMetres: unsupported length unit '${q.unit}'`);
  if (q.value === null) throw new Error('toMetres: unknown value');
  return q.value * f;
}

/** @param {any} q @param {string} name @param {string[]} errs */
function sourcedQ(q, name, errs) {
  if (!isQuantity(q)) { errs.push(`${name} must be a Quantity`); return false; }
  if (q.value === null) { errs.push(`${name} has no value`); return false; }
  if (!q.source || !nonEmpty(q.source.url) || !nonEmpty(q.source.title)) { errs.push(`${name} must carry a source (title, url)`); return false; }
  return true;
}

/** @param {any} m @param {string} path @param {string[]} errs */
function checkLayer(m, path, errs) {
  if (!m || typeof m !== 'object') { errs.push(`${path} must be an object`); return; }
  if (!nonEmpty(m.id)) errs.push(`${path}.id required`);
  if (!nonEmpty(m.target)) errs.push(`${path}.target required`);
  if (m.sign !== 1 && m.sign !== -1) errs.push(`${path}.sign must be +1 or -1`);
  if (!DISTANCE_BASES.includes(m.distanceBasis)) errs.push(`${path}.distanceBasis must be one of ${DISTANCE_BASES.join('|')}`);
  const s = m.source;
  if (!s || !nonEmpty(s.title) || !nonEmpty(s.url) || !nonEmpty(s.retrieved)) errs.push(`${path}.source (title, url, retrieved) required`);
  if (sourcedQ(m.magnitude, `${path}.magnitude`, errs) && (m.magnitude.low === null || m.magnitude.high === null)) errs.push(`${path}.magnitude needs low/high`);
  if (sourcedQ(m.reach, `${path}.reach`, errs) && !(m.reach.unit in METRES_PER)) errs.push(`${path}.reach unit must be m, km or mile`);
  if (m.innerRadius !== undefined) {
    if (sourcedQ(m.innerRadius, `${path}.innerRadius`, errs)) {
      if (!(m.innerRadius.unit in METRES_PER)) errs.push(`${path}.innerRadius must be a length`);
      else if (isQuantity(m.reach) && m.reach.value !== null && m.reach.unit in METRES_PER && !(toMetres(m.innerRadius) >= 0 && toMetres(m.innerRadius) < toMetres(m.reach))) errs.push(`${path}.innerRadius must be >= 0 and below reach`);
    }
  }
  const d = m.decay;
  if (!d || !DECAY_FORMS.includes(d.form)) { errs.push(`${path}.decay.form must be one of ${DECAY_FORMS.join('|')}`); return; }
  const params = d.parameters && typeof d.parameters === 'object' ? d.parameters : {};
  for (const [k, q] of Object.entries(params)) sourcedQ(q, `${path}.decay.parameters.${k}`, errs);
  if (d.form === 'exponential') {
    if (!params.lengthScale) errs.push(`${path}.decay.parameters.lengthScale required for exponential`);
    else if (isQuantity(params.lengthScale) && !(params.lengthScale.unit in METRES_PER)) errs.push(`${path}.decay.parameters.lengthScale must be a length`);
  }
  if (d.bands !== undefined) {
    if (d.form !== 'bands' || !Array.isArray(d.bands) || d.bands.length === 0) errs.push(`${path}.decay.bands only for form 'bands' and non-empty`);
    else d.bands.forEach((/** @type {any} */ b, /** @type {number} */ i) => {
      if (sourcedQ(b && b.outer, `${path}.decay.bands[${i}].outer`, errs) && !(b.outer.unit in METRES_PER)) errs.push(`${path}.decay.bands[${i}].outer must be a length`);
      sourcedQ(b && b.weight, `${path}.decay.bands[${i}].weight`, errs);
    });
  }
}

/**
 * @param {any} model
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateImpactModel(model) {
  /** @type {string[]} */ const errs = [];
  if (!model || typeof model !== 'object') return { valid: false, errors: ['model object required'] };
  checkLayer(model, 'model', errs);
  if (!Array.isArray(model.categoryIds) || model.categoryIds.length === 0 || !model.categoryIds.every(nonEmpty)) errs.push('model.categoryIds must be a non-empty list of category ids');
  if (!nonEmpty(model.transferability)) errs.push('model.transferability note required');
  if (!Array.isArray(model.negativeEffects)) errs.push('model.negativeEffects must be an array (may be empty)');
  else model.negativeEffects.forEach((/** @type {any} */ n, /** @type {number} */ i) => {
    checkLayer(n, `model.negativeEffects[${i}]`, errs);
    if (n && n.id === model.id) errs.push(`model.negativeEffects[${i}].id must differ from the model id`);
  });
  return { valid: errs.length === 0, errors: errs };
}

/** True when two models name different values for the same attribute, so no entity can match both. @param {ImpactModel} a @param {ImpactModel} b */
function scopesConflict(a, b) {
  const x = a.appliesTo || {}, y = b.appliesTo || {};
  return Object.keys(x).some((k) => k in y && x[k] !== y[k]);
}

/**
 * Registry of models. A category gets a model only if a model lists it explicitly; lookups never fall back.
 * Several models may serve one category only if they differ in target or variant (for example transit mode).
 * A model listing more than one category must pass `categories`, all of one family, and carry a written justification.
 * @param {{ models?: ImpactModel[], categories?: readonly { id: string, family: string }[] }} [opts]
 */
export function makeModelRegistry(opts = {}) {
  const families = new Map((opts.categories || []).map((c) => [c.id, c.family]));
  /** @type {Map<string, ImpactModel>} */ const byId = new Map();
  /** @type {Map<string, ImpactModel[]>} */ const byCategory = new Map();
  /** @param {ImpactModel} model */
  function register(model) {
    const v = validateImpactModel(model);
    if (!v.valid) throw new Error(`registry refused model '${model && model.id}': ${v.errors.join('; ')}`);
    if (byId.has(model.id)) throw new Error(`registry refused model '${model.id}': id already registered`);
    if (model.categoryIds.length > 1) {
      if (!nonEmpty(model.sharedCategoryJustification)) throw new Error(`registry refused model '${model.id}': serves ${model.categoryIds.length} categories without sharedCategoryJustification`);
      const fam = new Set();
      for (const c of model.categoryIds) {
        const f = families.get(c);
        if (!f) throw new Error(`registry refused model '${model.id}': category '${c}' not in the supplied category list, cannot verify it is the same kind`);
        fam.add(f);
      }
      if (fam.size > 1) throw new Error(`registry refused model '${model.id}': categories of different kinds (${[...fam].join(', ')}) cannot share one model`);
    }
    for (const c of model.categoryIds) {
      for (const other of byCategory.get(c) || []) {
        if (other.target !== model.target) continue;
        if ((other.variant || '') === (model.variant || '')) {
          throw new Error(`registry refused model '${model.id}': category '${c}' already has model '${other.id}' for target '${model.target}' and the same variant`);
        }
        // Same category and target, different variant: the scopes may overlap (for example 'light rail' inside 'all rail station types').
        // They must be declared mutually exclusive alternatives, so one improvement can never be valued under both.
        const linked = (model.alternativeTo || []).includes(other.id) || (other.alternativeTo || []).includes(model.id);
        if (linked) continue;
        const ordered = nonEmpty(model.variant) && nonEmpty(other.variant) && Number.isFinite(model.specificity) && Number.isFinite(other.specificity) &&
          (model.specificity !== other.specificity || scopesConflict(model, other));
        if (!ordered) {
          throw new Error(`registry refused model '${model.id}': category '${c}' target '${model.target}' overlaps model '${other.id}'; give both a variant and distinct specificity (or disjoint appliesTo), or list each other in alternativeTo`);
        }
      }
    }
    byId.set(model.id, model);
    for (const c of model.categoryIds) byCategory.set(c, [...(byCategory.get(c) || []), model]);
    return model;
  }
  for (const m of opts.models || []) register(m);
  return {
    register,
    /** @param {string} id */
    get: (id) => byId.get(id) || null,
    /** All models explicitly listing the category. @param {string} categoryId */
    candidates: (categoryId) => [...(byCategory.get(categoryId) || [])],
    /** The sole model for the category (optionally filtered), else null (none, or ambiguous: use candidates()).
     * @param {string} categoryId @param {{ target?: string, variant?: string }} [filter] */
    forCategory(categoryId, filter = {}) {
      const c = (byCategory.get(categoryId) || []).filter((m) => (!filter.target || m.target === filter.target) && (filter.variant === undefined || m.variant === filter.variant));
      return c.length === 1 ? c[0] : null;
    },
    /**
     * Pick exactly ONE model for (category, target, attributes): among the models whose appliesTo is satisfied by the attributes
     * (a model without appliesTo is the general one), the one with the highest specificity. Never falls back to a default.
     * Returns model null with reason 'no_match' or 'ambiguous' (candidates lists the tied ids).
     * @param {string} categoryId @param {string} target @param {Record<string, string>} [attributes]
     * @returns {{ model: ImpactModel|null, reason: string|null, candidates: string[] }}
     */
    selectModel(categoryId, target, attributes = {}) {
      const all = (byCategory.get(categoryId) || []).filter((m) => m.target === target);
      const ok = all.filter((m) => Object.entries(m.appliesTo || {}).every(([k, v]) => attributes[k] === v));
      if (ok.length === 0) return { model: null, reason: 'no_match', candidates: all.map((m) => m.id) };
      const top = Math.max(...ok.map((m) => (Number.isFinite(m.specificity) ? /** @type {number} */ (m.specificity) : -Infinity)));
      const best = ok.filter((m) => (Number.isFinite(m.specificity) ? m.specificity : -Infinity) === top);
      if (best.length !== 1) return { model: null, reason: 'ambiguous', candidates: best.map((m) => m.id) };
      return { model: best[0], reason: null, candidates: ok.map((m) => m.id) };
    },
    list: () => [...byId.values()],
  };
}
