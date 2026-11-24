// @ts-check
// Sequencing: dependency order, earliest feasible starts, gates, acquisition, absorption, phasing, street coordination.
import { isQuantity, subQ } from '../schema/quantity.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */

/** Throws naming the cycle. @param {Map<string, string[]>} deps @returns {string[]} topological order (ties by id) */
function topoOrder(deps) {
  /** @type {Map<string, number>} */ const state = new Map();
  /** @type {string[]} */ const order = [];
  /** @type {string[]} */ const stack = [];
  const visit = (/** @type {string} */ id) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      const cyc = [...stack.slice(stack.indexOf(id)), id];
      throw new Error('sequence: dependency cycle ' + cyc.join(' -> '));
    }
    state.set(id, 1); stack.push(id);
    for (const d of [...(deps.get(id) || [])].sort()) visit(d);
    stack.pop(); state.set(id, 2); order.push(id);
  };
  for (const id of [...deps.keys()].sort()) visit(id);
  return order;
}

/**
 * @param {{ items: { id: string, durationPeriods: number, earliestStart: number, dependsOn: string[], acquisitionBy: number|null,
 *   units?: number|null, absorptionPerPeriod: Quantity|null, regulatoryGate: { availableFrom: number }|null,
 *   financingWindow: { from: number, to: number }|null }[], horizon: number,
 *   streetWork?: { segmentId: string, scheduledPeriod: number, source: any }[]|null,
 *   coordinationSavings?: { itemId: string, segmentId: string, standaloneCost: Quantity, coordinatedCost: Quantity }[]|null }} input
 */
export function sequence(input) {
  const { items, horizon } = input;
  if (!Number.isFinite(horizon)) throw new TypeError('sequence: horizon required');
  const byId = new Map(items.map((i) => [i.id, i]));
  if (byId.size !== items.length) throw new Error('sequence: duplicate item ids');
  const deps = new Map(items.map((i) => [i.id, [...(i.dependsOn || [])]]));
  for (const [id, ds] of deps) for (const d of ds) if (!byId.has(d)) throw new Error(`sequence: ${id} depends on unknown item ${d}`);
  const order = topoOrder(deps);

  /** @type {Record<string, any>} */ const schedule = {};
  for (const id of order) {
    const it = /** @type {any} */ (byId.get(id));
    const constraints = [{ reason: 'earliestStart', period: it.earliestStart }];
    for (const d of it.dependsOn || []) constraints.push({ reason: `after ${d}`, period: schedule[d].finish });
    if (it.regulatoryGate) constraints.push({ reason: 'regulatory gate', period: it.regulatoryGate.availableFrom });
    if (Number.isFinite(it.acquisitionBy)) constraints.push({ reason: 'acquisition', period: it.acquisitionBy });
    if (it.financingWindow) constraints.push({ reason: 'financing window opens', period: it.financingWindow.from });
    const start = Math.max(...constraints.map((c) => c.period));
    const bindingConstraints = constraints.filter((c) => c.period === start).map((c) => c.reason);
    const finish = start + it.durationPeriods;
    const flags = [];
    if (finish > horizon) flags.push('exceeds_horizon');
    if (it.financingWindow && start > it.financingWindow.to) flags.push('financing_window_missed');
    const phasing = [];
    for (let t = start; t < finish; t++) phasing.push({ period: t, activity: 'build' });
    /** @type {any} */ let absorption;
    const cap = it.absorptionPerPeriod;
    if (!cap) absorption = { status: 'absorption not assessed' };
    else if (!isQuantity(cap) || cap.value === null || !(cap.value > 0)) absorption = { status: 'absorption not assessed', reason: 'absorption Quantity unknown or not positive' };
    else if (!Number.isFinite(it.units)) absorption = { status: 'absorption not assessed', reason: 'units to release not supplied' };
    else {
      const periods = (/** @type {number} */ r) => Math.ceil(it.units / r);
      const n = periods(cap.value);
      let left = it.units;
      for (let t = 0; t < n; t++) { const rel = Math.min(cap.value, left); left -= rel; phasing.push({ period: finish + t, activity: 'release', units: rel }); }
      absorption = { status: 'assessed', absorptionPeriods: n, slowestPeriods: periods(/** @type {number} */ (cap.low) > 0 ? /** @type {number} */ (cap.low) : cap.value),
        fastestPeriods: periods(/** @type {number} */ (cap.high)), completeBy: finish + n };
      if (finish + n > horizon) flags.push('absorption_exceeds_horizon');
    }
    schedule[id] = { id, start, finish, bindingConstraints, flags, phasing, absorption };
  }

  const sw = input.streetWork || null;
  const streetCoordination = (input.coordinationSavings || []).map((c) => {
    const s = schedule[c.itemId];
    if (!s) throw new Error(`sequence: coordinationSavings refers to unknown item ${c.itemId}`);
    const work = sw ? sw.find((w) => w.segmentId === c.segmentId && w.source) : null;
    const costsOk = isQuantity(c.standaloneCost) && isQuantity(c.coordinatedCost) && c.standaloneCost.value !== null && c.coordinatedCost.value !== null
      && !!c.standaloneCost.source && !!c.coordinatedCost.source;
    if (!work || !costsOk) {
      return { itemId: c.itemId, segmentId: c.segmentId, status: 'no_schedule_data',
        reason: !work ? 'no sourced street-work schedule for this segment' : 'standalone and coordinated costs are not both known and sourced' };
    }
    const aligned = work.scheduledPeriod >= s.start && work.scheduledPeriod <= s.finish;
    return { itemId: c.itemId, segmentId: c.segmentId, status: aligned ? 'coordinated' : 'not_aligned', streetWorkPeriod: work.scheduledPeriod,
      standaloneCost: c.standaloneCost, coordinatedCost: aligned ? c.coordinatedCost : null,
      saving: aligned ? subQ(c.standaloneCost, c.coordinatedCost) : null };
  });
  return Object.freeze({ order, schedule, flagged: order.filter((id) => schedule[id].flags.length > 0), streetCoordination, horizon });
}
