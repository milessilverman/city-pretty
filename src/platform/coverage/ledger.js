// @ts-check
// Coverage ledger: every catalogue category for a location ends in exactly one of
// found | rejected (basis + reason) | needsInfo (missing list) | notEvaluated (reason).
// Missing data can never produce "rejected". `evaluated` = found + rejected (conclusive).

/**
 * @typedef {{ categoryId: string, reason: string, basis: 'financial'|'regulatory'|'engineering'|'physical' }} RejectedEntry
 * @typedef {{ categoryId: string, missing: string[] }} NeedsInfoEntry
 * @typedef {{ categoryId: string, reason: string }} NotEvaluatedEntry
 * @typedef {Object} CoverageLedger
 * @property {import('../schema/geo.js').GeoRef} location
 * @property {string} asOf
 * @property {readonly string[]} evaluated
 * @property {readonly NotEvaluatedEntry[]} notEvaluated
 * @property {readonly { categoryId: string, opportunityId: string|null }[]} found
 * @property {readonly RejectedEntry[]} rejected
 * @property {readonly NeedsInfoEntry[]} needsInfo
 * @property {readonly { dataset: string, note: string }[]} staleData
 * @property {readonly string[]} missingData
 * @property {'high'|'medium'|'low'|'unknown'} confidence
 */
/** @typedef {ReturnType<typeof createLedger>} LedgerBuilder */

const BASES = ['financial', 'regulatory', 'engineering', 'physical'];
const MISSING_WORDS = /\b(missing|no data|not available|unavailable|unknown|unknowable|absent|lacks?|lacking|not found|n\/a|insufficient data|no record)\b/i;
/** @param {any} s */
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

/**
 * @param {import('../schema/geo.js').GeoRef} location
 * @param {string} asOf  YYYY-MM-DD, passed by the caller
 * @param {{ id: string, appliesTo: readonly string[] }[]} categories
 */
export function createLedger(location, asOf, categories) {
  if (!location || typeof location.kind !== 'string') throw new Error('createLedger: location with kind required');
  if (!nonEmpty(asOf) || !/^\d{4}-\d{2}-\d{2}/.test(asOf)) throw new Error('createLedger: asOf (YYYY-MM-DD) required');
  /** @type {Set<string>} */ const applicable = new Set();
  /** @type {Map<string, string>} */ const outcome = new Map();
  /** @type {NotEvaluatedEntry[]} */ const notEvaluated = [];
  for (const c of categories) {
    if (c.appliesTo.includes(location.kind)) applicable.add(c.id);
    else {
      outcome.set(c.id, 'notEvaluated');
      notEvaluated.push({ categoryId: c.id, reason: `category does not apply to ${location.kind}` });
    }
  }
  return {
    location, asOf, applicable, outcome, notEvaluated,
    found: /** @type {{ categoryId: string, opportunityId: string|null }[]} */ ([]),
    rejected: /** @type {RejectedEntry[]} */ ([]),
    needsInfo: /** @type {NeedsInfoEntry[]} */ ([]),
    staleData: /** @type {{ dataset: string, note: string }[]} */ ([]),
    missingData: /** @type {string[]} */ ([]),
    finalized: false,
  };
}

/** @param {LedgerBuilder} l @param {string} id @param {string} kind */
function claim(l, id, kind) {
  if (l.finalized) throw new Error('ledger is finalized');
  if (!l.applicable.has(id)) throw new Error(`category ${id} is not an applicable category for this location`);
  if (l.outcome.has(id)) throw new Error(`category ${id} already recorded as ${l.outcome.get(id)}; exactly one outcome allowed`);
  l.outcome.set(id, kind);
}

/** @param {LedgerBuilder} l @param {string} categoryId @param {string|null} [opportunityId] */
export function recordFound(l, categoryId, opportunityId = null) {
  claim(l, categoryId, 'found');
  l.found.push({ categoryId, opportunityId });
}

/** A rejection must rest on a financial, regulatory, engineering or physical reason, never on missing data. @param {LedgerBuilder} l @param {string} categoryId @param {{ basis: string, reason: string }} r */
export function recordRejected(l, categoryId, r) {
  if (!r || !BASES.includes(r.basis)) throw new Error(`recordRejected: basis must be one of ${BASES.join('|')}`);
  if (!nonEmpty(r.reason)) throw new Error('recordRejected: a reason is required');
  if (MISSING_WORDS.test(r.reason)) throw new Error('recordRejected: missing data is not a rejection; use recordNeedsInfo or recordNotEvaluated');
  claim(l, categoryId, 'rejected');
  l.rejected.push({ categoryId, reason: r.reason, basis: /** @type {any} */ (r.basis) });
}

/** @param {LedgerBuilder} l @param {string} categoryId @param {string[]} missing */
export function recordNeedsInfo(l, categoryId, missing) {
  if (!Array.isArray(missing) || missing.length === 0 || !missing.every(nonEmpty)) throw new Error('recordNeedsInfo: a non-empty missing list is required');
  claim(l, categoryId, 'needsInfo');
  l.needsInfo.push({ categoryId, missing: [...missing] });
}

/** @param {LedgerBuilder} l @param {string} categoryId @param {string} reason */
export function recordNotEvaluated(l, categoryId, reason) {
  if (!nonEmpty(reason)) throw new Error('recordNotEvaluated: a reason is required');
  claim(l, categoryId, 'notEvaluated');
  l.notEvaluated.push({ categoryId, reason });
}

/** @param {LedgerBuilder} l @param {string} dataset @param {string} note */
export function recordStaleData(l, dataset, note) {
  if (!nonEmpty(dataset) || !nonEmpty(note)) throw new Error('recordStaleData: dataset and note required');
  l.staleData.push({ dataset, note });
}

/** @param {LedgerBuilder} l @param {string} name */
export function recordMissingData(l, name) {
  if (!nonEmpty(name)) throw new Error('recordMissingData: name required');
  l.missingData.push(name);
}

/** Fails if any applicable category has no outcome. @param {LedgerBuilder} l @returns {CoverageLedger} */
export function finalizeLedger(l) {
  const unaccounted = [...l.applicable].filter((id) => !l.outcome.has(id));
  if (unaccounted.length) throw new Error(`finalizeLedger: unaccounted categories: ${unaccounted.join(', ')}`);
  l.finalized = true;
  const conclusive = l.applicable.size === l.found.length + l.rejected.length;
  /** @type {CoverageLedger['confidence']} */
  const confidence = l.applicable.size === 0 ? 'unknown'
    : !conclusive ? 'low'
    : l.staleData.length || l.missingData.length ? 'medium' : 'high';
  return Object.freeze({
    location: l.location, asOf: l.asOf,
    evaluated: Object.freeze([...l.found.map((f) => f.categoryId), ...l.rejected.map((r) => r.categoryId)]),
    notEvaluated: Object.freeze(l.notEvaluated), found: Object.freeze(l.found), rejected: Object.freeze(l.rejected),
    needsInfo: Object.freeze(l.needsInfo), staleData: Object.freeze(l.staleData), missingData: Object.freeze(l.missingData),
    confidence,
  });
}

/** @param {CoverageLedger[]} ledgers */
export function summarizeLedgers(ledgers) {
  /** @type {Record<string, { found: number, rejected: number, needsInfo: number, notEvaluated: number }>} */ const byCategory = {};
  const totals = { found: 0, rejected: 0, needsInfo: 0, notEvaluated: 0 };
  /** @type {Record<string, number>} */ const confidence = { high: 0, medium: 0, low: 0, unknown: 0 };
  const b = (/** @type {string} */ id) => (byCategory[id] ||= { found: 0, rejected: 0, needsInfo: 0, notEvaluated: 0 });
  for (const l of ledgers) {
    if (!l || !Array.isArray(l.found) || !('confidence' in l)) throw new Error('summarizeLedgers: finalized ledgers only');
    for (const x of l.found) { b(x.categoryId).found++; totals.found++; }
    for (const x of l.rejected) { b(x.categoryId).rejected++; totals.rejected++; }
    for (const x of l.needsInfo) { b(x.categoryId).needsInfo++; totals.needsInfo++; }
    for (const x of l.notEvaluated) { b(x.categoryId).notEvaluated++; totals.notEvaluated++; }
    confidence[l.confidence]++;
  }
  return { locations: ledgers.length, totals, byCategory, confidence };
}
