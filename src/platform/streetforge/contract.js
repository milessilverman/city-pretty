// @ts-check
// StreetForge interface contract: what City Pretty would send and accept. Contract only; no network access.
import { validateGeoRef, getCategory, isQuantity } from '../schema/index.js';

export const CONTRACT_VERSION = '1.0.0';

/** Capabilities seen in StreetForge's page source. Nothing else may be attributed to it. */
export const OBSERVED_CAPABILITIES = Object.freeze(['design_project_json', 'png_export', 'share_link', 'remix_link']);
export const OBSERVATION = Object.freeze({ observed: '2026-11-24', url: 'https://www.streetforge.app/' });
/** Capabilities a response may report only if a real source provides them. */
export const COST_CAPABILITY = 'cost_estimate';
export const QUANTITY_CAPABILITY = 'quantities';

/** @typedef {{ valid: boolean, errors: string[] }} Validation */

/** @param {any} x */
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/** @param {any} req @returns {Validation} */
export function validateRequest(req) {
  const errors = [];
  if (!isObj(req)) return { valid: false, errors: ['request object required'] };
  if (req.contractVersion !== CONTRACT_VERSION) errors.push(`contractVersion must be ${CONTRACT_VERSION}`);
  const g = validateGeoRef(req.segment);
  if (!g.valid) errors.push(...g.errors.map((e) => 'segment: ' + e));
  else if (req.segment.kind !== 'street_segment') errors.push('segment.kind must be street_segment');
  const pc = req.proposedChange;
  if (!isObj(pc)) errors.push('proposedChange required');
  else {
    const cat = typeof pc.categoryId === 'string' ? getCategory(pc.categoryId) : null;
    if (!cat) errors.push('proposedChange.categoryId is not a known category');
    else if (cat.family !== 'street') errors.push(`proposedChange.categoryId ${pc.categoryId} is not a street-family category`);
    if (!isObj(pc.parameters)) errors.push('proposedChange.parameters object required');
  }
  if (typeof req.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(req.asOf)) errors.push('asOf (YYYY-MM-DD) required');
  return { valid: errors.length === 0, errors };
}

/** @param {any} res @returns {Validation} */
export function validateResponse(res) {
  const errors = [];
  if (!isObj(res)) return { valid: false, errors: ['response object required'] };
  if (res.contractVersion !== CONTRACT_VERSION) errors.push(`contractVersion must be ${CONTRACT_VERSION}`);
  const caps = res.capabilities;
  if (!Array.isArray(caps) || caps.some((c) => typeof c !== 'string')) errors.push('capabilities must be an array of strings');
  const has = (/** @type {string} */ c) => Array.isArray(caps) && caps.includes(c);
  if (res.design !== null) {
    if (!isObj(res.design) || res.design.format !== 'streetforge-project') errors.push("design must be null or have format 'streetforge-project'");
    else {
      const s = res.design.scenes;
      if (!isObj(s) || !isObj(s.before) || !Array.isArray(s.before.elements) || !isObj(s.after) || !Array.isArray(s.after.elements)) {
        errors.push('design.scenes.before and .after need an elements array');
      }
    }
  }
  if (!Array.isArray(res.quantities)) errors.push('quantities must be an array');
  else {
    res.quantities.forEach((q, i) => {
      if (!isQuantity(q)) errors.push(`quantities[${i}] is not a valid Quantity`);
      else if (q.value !== null && !has(QUANTITY_CAPABILITY)) errors.push(`quantities[${i}] carries a value but capabilities lacks '${QUANTITY_CAPABILITY}'`);
    });
  }
  if (!isQuantity(res.cost)) errors.push('cost must be a valid Quantity');
  else if (res.cost.value !== null && !has(COST_CAPABILITY)) errors.push(`cost carries a value but capabilities lacks '${COST_CAPABILITY}'`);
  if (!Array.isArray(res.tradeoffs)) errors.push('tradeoffs must be an array');
  return { valid: errors.length === 0, errors };
}
