// @ts-check
// Bounded AI idea intake. No model calls here: this file fixes the idea schema, validates ideas and converts accepted ones to candidates.
import { getCategory, IMPROVEMENT_CATEGORIES } from '../schema/categories.js';
import { validateGeoRef } from '../schema/geo.js';
import { makeOpportunity } from '../schema/opportunity.js';

const ALL = ['parcel_development', 'street', 'open_space', 'transit', 'utility_energy', 'facility'];

/** @type {Readonly<Record<string, { brief: string, families: readonly string[] }>>} */
export const SPECIALIST_ROLES = Object.freeze({
  development: { brief: 'Real-estate development: infill, assembly, reuse and density opportunities on parcels.', families: ['parcel_development'] },
  transportation: { brief: 'Transportation: street, transit and access improvements and what they connect.', families: ['street', 'transit'] },
  civil: { brief: 'Civil engineering: streets, utilities and site works, and what physically constrains them.', families: ['street', 'utility_energy', 'facility'] },
  environmental: { brief: 'Environment: open space, canopy, contamination and energy opportunities.', families: ['open_space', 'utility_energy', 'parcel_development'] },
  planning: { brief: 'Urban planning: land use, public space and service gaps across all categories.', families: ALL },
  commercial: { brief: 'Commercial and retail: revitalisation, facilities and mixed-use demand.', families: ['parcel_development', 'facility'] },
  municipal_finance: { brief: 'Municipal finance: opportunities that change public revenue, cost or capturable value.', families: ALL },
  underwriting: { brief: 'Underwriting: opportunities whose financial structure should be tested first.', families: ALL },
});

const IDEA_KEYS = ['role', 'categoryId', 'location', 'rationale', 'claims', 'title'];
const UNITS = '%|percent|acres?|ac|sq\\.?\\s?ft|sqft|sf|m2|m²|ft|feet|foot|km|meters?|metres?|miles?|mi|m|usd|dollars?|units?|homes?|dwellings?|jobs?|years?|yrs?|stor(?:y|ies)|floors?|beds?|spaces?|trips?|kw|mw|kwh|gal|tons?|lots?|parcels?|crashes|trees?';
const NUMERIC_TEXT = new RegExp(`(?:[$€£]\\s?\\d)|(?:\\d[\\d,]*(?:\\.\\d+)?\\s?(?:${UNITS})(?![a-z]))`, 'i');

/** @param {any} s */
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

/**
 * @param {any} idea
 * @returns {{ valid: boolean, reasons: string[] }}
 */
export function validateIdea(idea) {
  /** @type {string[]} */ const reasons = [];
  if (!idea || typeof idea !== 'object' || Array.isArray(idea)) return { valid: false, reasons: ['idea must be an object'] };
  const extra = Object.keys(idea).filter((k) => !IDEA_KEYS.includes(k));
  if (extra.length) reasons.push(`unknown field(s): ${extra.join(', ')}`);
  const role = SPECIALIST_ROLES[idea.role];
  if (!role) reasons.push(`role must be one of ${Object.keys(SPECIALIST_ROLES).join('|')}`);
  const cat = typeof idea.categoryId === 'string' ? getCategory(idea.categoryId) : null;
  if (!cat) reasons.push(`categoryId does not exist in the catalogue: ${idea.categoryId}`);
  else if (role && !role.families.includes(cat.family)) reasons.push(`role ${idea.role} may not propose family ${cat.family}`);
  const g = validateGeoRef(idea.location);
  if (!g.valid) reasons.push('location is not a valid GeoRef: ' + g.errors.join('; '));
  else if (cat && !cat.appliesTo.includes(idea.location.kind)) reasons.push(`category ${cat.id} does not apply to ${idea.location.kind}`);
  if (!nonEmpty(idea.rationale)) reasons.push('rationale must be a non-empty string');
  if (!Array.isArray(idea.claims)) reasons.push('claims must be a list (empty if there are none)');
  else {
    idea.claims.forEach((/** @type {any} */ c, /** @type {number} */ i) => {
      if (!c || typeof c !== 'object') { reasons.push(`claims[${i}] must be an object`); return; }
      const numeric = typeof c.value === 'number' || (typeof c.value === 'string' && NUMERIC_TEXT.test(c.value)) || (typeof c.value === 'string' && /^\s*[-+]?\d/.test(c.value));
      if (!nonEmpty(c.name)) reasons.push(`claims[${i}] needs a name`);
      if (numeric) {
        const s = c.source;
        if (!s || typeof s !== 'object' || !nonEmpty(s.title) || !nonEmpty(s.url) || !nonEmpty(s.retrieved)) reasons.push(`claims[${i}] is an unsourced numeric claim (source needs title, url, retrieved)`);
      }
    });
  }
  for (const f of ['rationale', 'title']) {
    if (typeof idea[f] === 'string' && NUMERIC_TEXT.test(idea[f])) reasons.push(`${f} contains a number with a unit outside claims: unsourced numeric claim`);
  }
  if (idea.title !== undefined && typeof idea.title !== 'string') reasons.push('title must be a string');
  return { valid: reasons.length === 0, reasons };
}

/**
 * @param {any[]} ideas
 * @param {{ maxIdeas: number }} opts
 */
export function intake(ideas, { maxIdeas } = /** @type {any} */ ({})) {
  if (!Number.isInteger(maxIdeas) || maxIdeas < 1) throw new Error('intake: maxIdeas (positive integer) required');
  if (!Array.isArray(ideas)) throw new Error('intake: ideas array required');
  const considered = ideas.slice(0, maxIdeas);
  /** @type {any[]} */ const accepted = [];
  /** @type {{ index: number, idea: any, reasons: string[] }[]} */ const rejected = [];
  /** @type {Record<string, any[]>} */ const claimsByOpportunity = {};
  considered.forEach((idea, index) => {
    const v = validateIdea(idea);
    if (!v.valid) { rejected.push({ index, idea, reasons: v.reasons }); return; }
    const opp = makeOpportunity({
      id: `ai_exploration:${idea.role}:${idea.categoryId}:${idea.location.id}:${index}`, categoryId: idea.categoryId, location: idea.location,
      discoveredBy: 'ai_exploration', confidence: 'low',
      confidenceReasons: [`proposed by the ${idea.role} specialist; a candidate only, no deterministic check has run`],
    });
    accepted.push(opp);
    claimsByOpportunity[opp.id] = idea.claims;
  });
  return { accepted, rejected, claimsByOpportunity, received: ideas.length, notProcessed: ideas.length - considered.length, truncated: ideas.length > considered.length };
}

/** @param {string} role @param {any} [context] */
export function buildPromptSpec(role, context) {
  const r = SPECIALIST_ROLES[role];
  if (!r) throw new Error(`buildPromptSpec: unknown role ${role}`);
  const ids = IMPROVEMENT_CATEGORIES.filter((c) => r.families.includes(c.family)).map((c) => c.id);
  return {
    role, brief: r.brief, context: context ?? null,
    instructions: [
      'Propose improvement ideas as candidates only. Deterministic regulatory, financial and engineering checks decide; you do not.',
      'Return a JSON array. Each idea must match outputSchema exactly; unknown fields reject the idea.',
      'Do not write numbers with units in rationale or title. Put every numeric statement in claims with a source object (title, url, retrieved).',
      'If you cannot cite a source for a number, leave it out.',
    ],
    status: 'candidate_only',
    allowedCategoryIds: ids,
    outputSchema: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['role', 'categoryId', 'location', 'rationale', 'claims'],
        properties: {
          role: { const: role },
          categoryId: { enum: ids },
          location: { type: 'object', description: 'GeoRef: kind, id, jurisdiction, geometry, crs EPSG:4326' },
          rationale: { type: 'string', description: 'Why, in words, without numbers with units' },
          title: { type: 'string' },
          claims: { type: 'array', items: { type: 'object', required: ['name', 'value'], properties: {
            name: { type: 'string' }, value: {}, unit: { type: 'string' },
            source: { type: 'object', required: ['title', 'url', 'retrieved'], description: 'required for every numeric value' },
          } } },
        },
      },
    },
  };
}
