// @ts-check
// Mock StreetForge adapter. Returns only what StreetForge's source shows it can produce: a design project.
import { unknownQuantity } from '../schema/index.js';
import { CONTRACT_VERSION, OBSERVED_CAPABILITIES, COST_CAPABILITY, QUANTITY_CAPABILITY, validateRequest, validateResponse } from './contract.js';

const NO_COST = 'StreetForge exposes no cost output (page source read 2026-11-24)';
const NO_QTY = 'StreetForge exposes no engineering quantities output (page source read 2026-11-24)';

/**
 * @param {{ fixtures?: { cost?: import('../schema/quantity.js').Quantity, quantities?: import('../schema/quantity.js').Quantity[], capabilities?: string[] } }} [opts]
 */
export function createMockStreetForge(opts = {}) {
  const fx = opts.fixtures || {};
  const hasCost = fx.cost !== undefined && fx.cost.value !== null;
  const hasQty = Array.isArray(fx.quantities) && fx.quantities.some((q) => q.value !== null);
  const caps = fx.capabilities ? [...fx.capabilities] : [...OBSERVED_CAPABILITIES];
  if (hasCost && !caps.includes(COST_CAPABILITY)) throw new Error(`fixture cost needs an explicit capabilities override including '${COST_CAPABILITY}'`);
  if (hasQty && !caps.includes(QUANTITY_CAPABILITY)) throw new Error(`fixture quantities need an explicit capabilities override including '${QUANTITY_CAPABILITY}'`);
  const injected = hasCost || hasQty;
  if (injected && !fx.capabilities) throw new Error('fixture values require an explicit capabilities override');

  return Object.freeze({
    /** @param {any} request */
    respond(request) {
      const v = validateRequest(request);
      if (!v.valid) throw new Error('mock StreetForge: invalid request: ' + v.errors.join('; '));
      const response = {
        contractVersion: CONTRACT_VERSION,
        design: { format: 'streetforge-project', scenes: { before: { elements: [] }, after: { elements: [] } } },
        quantities: fx.quantities ?? [unknownQuantity('1', NO_QTY, { status: 'unavailable' })],
        cost: fx.cost ?? unknownQuantity('1', NO_COST, { status: 'unavailable' }),
        tradeoffs: [],
        capabilities: caps,
        mock: true,
        ...(injected ? { fixture: true } : {}),
      };
      const r = validateResponse(response);
      if (!r.valid) throw new Error('mock StreetForge: invalid response: ' + r.errors.join('; '));
      return response;
    },
  });
}
