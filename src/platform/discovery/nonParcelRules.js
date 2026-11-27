// @ts-check
// Feasibility rule sets for the 20 non-parcel categories (street, open space, transit, utility/energy, facility).
// Same contract as the parcel rule sets: no thresholds, costs, warrants or standards live here. Every criterion is
// supplied by the caller (Quantity or labelled 'assumed' threshold with provenance); a missing attribute or criterion
// is needs_info with its name. Uses: build (develop), preserve (do nothing), coordinate with adjacent work.
import { IMPROVEMENT_CATEGORIES, getCategory } from '../schema/categories.js';
import { makeUseOption } from '../schema/opportunity.js';
import { physicalScreen, normalizeInjected, mergeChecks, RANK, FEASIBILITY_RULES } from './feasibility.js';


/** Inputs satisfied by the location's own geometry (a GeoRef always carries one). */
const GEOMETRY_INPUTS = ['location', 'segment_geometry', 'corridor_geometry'];
/** Non-parcel use options: build, do nothing, coordinate with adjacent work. */
const NON_PARCEL_USES = Object.freeze(['develop', 'preserve', 'coordinated_development']);

/** @param {string} attr @param {'gte'|'lte'} op @param {string} criterion @returns {import('./feasibility.js').PhysicalTest} */
const th = (attr, op, criterion) => ({ kind: 'threshold', attr, op, criterion });
/** @param {string} attr @returns {import('./feasibility.js').PhysicalTest} */
const flag = (attr) => ({ kind: 'flag', attr });

/**
 * Per category: attributes needed beyond requiredInputs, and the physical tests for the build use.
 * Criterion names only; their values come from the caller.
 * @type {Record<string, { extra: string[], tests: import('./feasibility.js').PhysicalTest[] }>}
 */
const BUILD = {
  bike_lane: { extra: [], tests: [th('right_of_way_width', 'gte', 'min_bike_lane_row_width')] },
  bus_lane: { extra: [], tests: [th('right_of_way_width', 'gte', 'min_bus_lane_row_width'), th('transit_ridership', 'gte', 'min_bus_lane_ridership')] },
  traffic_calming: { extra: ['street_class', 'agency_eligibility_rule'], tests: [th('traffic_speed', 'gte', 'min_calming_speed'), th('crash_records', 'gte', 'min_calming_crash_count'), flag('agency_eligibility_rule')] },
  crosswalk: { extra: ['ped_crash_count', 'crossing_geometry'], tests: [th('ped_crash_count', 'gte', 'min_crosswalk_ped_crashes'), th('pedestrian_volume', 'gte', 'min_crosswalk_pedestrian_volume')] },
  street_trees: { extra: [], tests: [th('canopy_cover', 'lte', 'max_canopy_cover_for_planting'), th('planting_space', 'gte', 'min_planting_space')] },
  sidewalk: { extra: [], tests: [th('sidewalk_condition', 'lte', 'max_acceptable_sidewalk_condition'), th('pedestrian_volume', 'gte', 'min_sidewalk_pedestrian_volume')] },
  street_lighting: { extra: [], tests: [th('lighting_inventory', 'lte', 'max_lighting_inventory'), th('crash_records', 'gte', 'min_lighting_crash_count')] },
  road_diet: { extra: [], tests: [th('lane_count', 'gte', 'min_road_diet_lanes'), th('traffic_volume', 'lte', 'max_road_diet_traffic_volume')] },
  park: { extra: [], tests: [th('site_area', 'gte', 'min_park_area'), th('open_space_deficit', 'gte', 'min_park_open_space_deficit')] },
  pocket_park: { extra: [], tests: [th('site_area', 'gte', 'min_pocket_park_area'), th('open_space_deficit', 'gte', 'min_pocket_park_open_space_deficit')] },
  rail_station: { extra: [], tests: [th('ridership_forecast', 'gte', 'min_station_ridership')] },
  brt: { extra: [], tests: [th('transit_ridership', 'gte', 'min_brt_ridership'), th('right_of_way_width', 'gte', 'min_brt_row_width')] },
  bus_shelter: { extra: [], tests: [th('transit_ridership', 'gte', 'min_shelter_ridership')] },
  ev_charger: { extra: ['host_agreement'], tests: [th('grid_capacity', 'gte', 'min_charger_power_capacity'), th('vehicle_registrations', 'gte', 'min_ev_registrations'), flag('host_agreement')] },
  solar_microgrid: { extra: [], tests: [th('site_area', 'gte', 'min_solar_site_area'), th('solar_resource', 'gte', 'min_solar_resource')] },
  undergrounding: { extra: [], tests: [th('right_of_way_width', 'gte', 'min_undergrounding_row_width')] },
  grocery: { extra: [], tests: [th('site_area', 'gte', 'min_grocery_site_area'), th('food_access_deficit', 'gte', 'min_food_access_deficit')] },
  clinic: { extra: [], tests: [th('site_area', 'gte', 'min_clinic_site_area'), th('health_access_deficit', 'gte', 'min_health_access_deficit')] },
  library: { extra: [], tests: [th('site_area', 'gte', 'min_library_site_area'), th('service_area_population', 'gte', 'min_library_service_population')] },
  school_upgrade: { extra: [], tests: [th('facility_condition', 'lte', 'max_acceptable_facility_condition')] },
};

/** @param {import('./feasibility.js').PhysicalTest} t @returns {string[]} */
const testAttrs = (t) => (t.kind === 'ratio' ? [t.num, t.den] : [t.attr]);

/** @param {string} id @returns {import('./feasibility.js').RuleSet} */
function makeNonParcelRuleSet(id) {
  const cat = /** @type {any} */ (getCategory(id));
  const spec = BUILD[id];
  const buildAttrs = [...new Set([...cat.requiredInputs, ...spec.extra, ...spec.tests.flatMap(testAttrs)])];
  /** @type {Record<string, { attrs: string[], tests: import('./feasibility.js').PhysicalTest[] }>} */
  const defs = {
    develop: { attrs: buildAttrs, tests: spec.tests },
    preserve: { attrs: [], tests: [] },
    coordinated_development: { attrs: ['adjacent_work'], tests: [th('adjacent_work', 'gte', 'min_adjacent_work')] },
  };
  const requiredAttributes = Object.freeze([...new Set(Object.values(defs).flatMap((d) => d.attrs))]);
  return Object.freeze({
    categoryId: id, requiredAttributes,
    evaluate(location, criteria, checks = {}) {
      const category = getCategory(id);
      // inputs the location's own geometry supplies are present when the GeoRef carries a geometry
      const hasGeom = !!(location && location.ref && location.ref.geometry);
      /** @type {Record<string, any>} */ const derived = {};
      if (hasGeom) for (const g of GEOMETRY_INPUTS) derived[g] = true;
      const view = { ...location, attributes: { ...derived, ...((location && location.attributes) || {}) } };
      const regulatory = checks.regulatory
        ? normalizeInjected(checks.regulatory(location, category), 'regulatory')
        : /** @type {import('../schema/opportunity.js').CheckResult} */ ({ result: 'unknown', missing: ['check:regulatory'] });
      const engInjected = checks.engineering
        ? normalizeInjected(checks.engineering(location, category), 'engineering')
        : /** @type {import('../schema/opportunity.js').CheckResult} */ ({ result: 'unknown', missing: ['check:engineering'] });
      const uses = NON_PARCEL_USES.map((use) => {
        const d = defs[use];
        const phys = physicalScreen(view, d.attrs, d.tests, criteria || {});
        /** @type {import('../schema/opportunity.js').CheckResult} */
        const physCheck = phys.result === 'fail' ? { result: 'fail', reason: /** @type {string} */ (phys.reason), basis: 'physical' }
          : phys.result === 'unknown' ? { result: 'unknown', missing: phys.missing } : { result: 'pass' };
        const financial = phys.result === 'fail' ? undefined
          : checks.financial ? normalizeInjected(checks.financial(location, category, use), 'financial')
            : /** @type {import('../schema/opportunity.js').CheckResult} */ ({ result: 'unknown', missing: ['check:financial'] });
        return makeUseOption({ use, checks: { regulatory, financial, engineering: mergeChecks([physCheck, engInjected]) } });
      });
      // 'preserve' is the do-nothing baseline: reported, but it does not decide the category status.
      const actionable = uses.filter((u) => u.use !== 'preserve');
      const best = actionable.reduce((a, b) => (RANK[/** @type {'viable'} */ (b.status)] < RANK[/** @type {'viable'} */ (a.status)] ? b : a));
      const missing = [...new Set(uses.flatMap((u) => Object.values(u.checks).flatMap((c) => (c.result === 'unknown' ? c.missing || [] : []))))];
      const rejection = best.status === 'rejected'
        ? (() => {
          const f = Object.values(best.checks).find((c) => c.result === 'fail');
          return { basis: f && f.basis ? f.basis : 'physical', reason: `every actionable use rejected; ${actionable.map((u) => `${u.use}: ${Object.values(u.checks).find((c) => c.result === 'fail')?.reason}`).join('; ')}` };
        })() : null;
      return { categoryId: id, status: best.status, uses, checks: best.checks, missing, rejection };
    },
  });
}

/** One rule set per non-parcel-family category. @type {Readonly<Record<string, import('./feasibility.js').RuleSet>>} */
export const NON_PARCEL_RULES = Object.freeze(Object.fromEntries(
  IMPROVEMENT_CATEGORIES.filter((c) => c.family !== 'parcel_development').map((c) => [c.id, makeNonParcelRuleSet(c.id)]),
));

/**
 * Evaluator for exhaustiveScreen covering every category: parcel rule sets for the 17 parcel categories, non-parcel
 * rule sets for the rest. Locations are looked up by id (any kind). A location with no record gives needs_info.
 * @param {{ locations: any[], criteria: Record<string, any>, checks?: import('./feasibility.js').InjectedChecks }} cfg
 */
export function makeDiscoveryEvaluator({ locations, criteria, checks }) {
  /** @type {Map<string, any>} */ const byId = new Map();
  for (const p of locations) if (p && p.ref && p.ref.id) byId.set(p.ref.id, p);
  return (/** @type {any} */ location, /** @type {{ id: string }} */ category) => {
    const rule = FEASIBILITY_RULES[category.id] || NON_PARCEL_RULES[category.id];
    if (!rule) return { status: 'not_evaluated', reason: `no rule set for ${category.id}` };
    const ref = location && location.ref !== undefined ? location.ref : location;
    const loc = byId.get(ref.id);
    if (!loc) return { status: 'needs_info', missing: ['location attributes'] };
    return rule.evaluate(loc, criteria, checks);
  };
}
