// @ts-check
// Frozen catalogue of improvement categories. Structure only: no numbers, no thresholds.

/**
 * @typedef {'parcel_development'|'street'|'open_space'|'transit'|'utility_energy'|'facility'} CategoryFamily
 * @typedef {{ id: string, family: CategoryFamily, appliesTo: readonly import('./geo.js').GeoKind[], requiredInputs: readonly string[], impactModelId: string|null }} ImprovementCategory
 */

/** @type {import('./geo.js').GeoKind[]} */
const PARCEL = ['parcel'];

/** @param {string} id @param {CategoryFamily} family @param {import('./geo.js').GeoKind[]} appliesTo @param {string[]} requiredInputs @param {string|null} [impactModelId] @returns {ImprovementCategory} */
const c = (id, family, appliesTo, requiredInputs, impactModelId = null) =>
  Object.freeze({ id, family, appliesTo: Object.freeze([...appliesTo]), requiredInputs: Object.freeze([...requiredInputs]), impactModelId });

const P = 'parcel_development';
const BASE = ['parcel_area', 'zoning_district', 'current_use'];

export const IMPROVEMENT_CATEGORIES = Object.freeze([
  // 17 parcel categories (impact models are Stage 2 records; none assigned here)
  c('underused_land', P, PARCEL, [...BASE, 'assessed_land_value', 'assessed_improvement_value', 'permitted_floor_area', 'built_floor_area']),
  c('surface_parking', P, PARCEL, [...BASE, 'parking_surface_area', 'permitted_floor_area']),
  c('vacant_land', P, PARCEL, [...BASE, 'vacancy_status', 'permitted_floor_area']),
  c('ageing_retail', P, PARCEL, [...BASE, 'year_built', 'retail_vacancy', 'built_floor_area']),
  c('brownfield', P, PARCEL, [...BASE, 'contamination_status', 'remediation_cost']),
  c('assembly', P, ['parcel', 'area'], ['adjacent_parcels', 'ownership_records', 'zoning_district', 'combined_parcel_area']),
  c('lot_split', P, PARCEL, [...BASE, 'subdivision_rules', 'lot_dimensions']),
  c('adu', P, PARCEL, [...BASE, 'adu_rules', 'existing_structures']),
  c('densification', P, PARCEL, [...BASE, 'permitted_density', 'built_floor_area']),
  c('office_to_residential', P, PARCEL, [...BASE, 'office_vacancy', 'building_floorplate', 'conversion_rules']),
  c('mixed_use', P, PARCEL, [...BASE, 'permitted_uses', 'permitted_floor_area']),
  c('air_rights', P, PARCEL, [...BASE, 'unused_development_rights', 'transfer_rules']),
  c('shared_parking', P, PARCEL, [...BASE, 'parking_supply', 'parking_occupancy']),
  c('p3_mixed_use', P, PARCEL, [...BASE, 'public_ownership', 'permitted_floor_area', 'delivery_model_rules']),
  c('park_with_development', P, PARCEL, [...BASE, 'open_space_deficit', 'permitted_floor_area']),
  c('industrial_revitalisation', P, PARCEL, [...BASE, 'industrial_vacancy', 'building_condition']),
  c('commercial_revitalisation', P, PARCEL, [...BASE, 'commercial_vacancy', 'building_condition']),
  // street
  c('bike_lane', 'street', ['street_segment'], ['segment_geometry', 'right_of_way_width', 'traffic_volume'], 'model.bike_lane'),
  c('bus_lane', 'street', ['street_segment'], ['segment_geometry', 'right_of_way_width', 'transit_ridership'], 'model.bus_lane'),
  c('traffic_calming', 'street', ['street_segment'], ['segment_geometry', 'crash_records', 'traffic_speed'], 'model.traffic_calming'),
  c('crosswalk', 'street', ['street_segment', 'point'], ['location', 'crash_records', 'pedestrian_volume'], 'model.crosswalk'),
  c('street_trees', 'street', ['street_segment'], ['segment_geometry', 'canopy_cover', 'planting_space'], 'model.street_trees'),
  c('sidewalk', 'street', ['street_segment'], ['segment_geometry', 'sidewalk_condition', 'pedestrian_volume'], 'model.sidewalk'),
  c('street_lighting', 'street', ['street_segment'], ['segment_geometry', 'lighting_inventory', 'crash_records'], 'model.street_lighting'),
  c('road_diet', 'street', ['street_segment'], ['segment_geometry', 'lane_count', 'traffic_volume'], 'model.road_diet'),
  // open space
  c('park', 'open_space', ['parcel', 'area'], ['site_area', 'open_space_deficit', 'ownership_records'], 'model.park'),
  c('pocket_park', 'open_space', ['parcel', 'point'], ['site_area', 'open_space_deficit', 'ownership_records'], 'model.pocket_park'),
  // transit
  c('rail_station', 'transit', ['point', 'asset'], ['location', 'rail_alignment', 'ridership_forecast'], 'model.rail_station'),
  c('brt', 'transit', ['street_segment', 'area'], ['corridor_geometry', 'transit_ridership', 'right_of_way_width'], 'model.brt'),
  c('bus_shelter', 'transit', ['point', 'street_segment'], ['location', 'stop_inventory', 'transit_ridership'], 'model.bus_shelter'),
  // utility and energy
  c('ev_charger', 'utility_energy', ['point', 'parcel', 'asset'], ['location', 'grid_capacity', 'vehicle_registrations'], 'model.ev_charger'),
  c('solar_microgrid', 'utility_energy', ['parcel', 'asset', 'area'], ['site_area', 'grid_capacity', 'solar_resource'], 'model.solar_microgrid'),
  c('undergrounding', 'utility_energy', ['street_segment'], ['segment_geometry', 'utility_inventory', 'right_of_way_width'], 'model.undergrounding'),
  // facility
  c('grocery', 'facility', ['parcel', 'asset'], ['site_area', 'food_access_deficit', 'zoning_district'], 'model.grocery'),
  c('clinic', 'facility', ['parcel', 'asset'], ['site_area', 'health_access_deficit', 'zoning_district'], 'model.clinic'),
  c('library', 'facility', ['parcel', 'asset'], ['site_area', 'service_area_population', 'zoning_district'], 'model.library'),
  c('school_upgrade', 'facility', ['asset'], ['facility_condition', 'enrolment_records', 'ownership_records'], 'model.school_upgrade'),
]);

/** @param {string} id @returns {ImprovementCategory|null} */
export function getCategory(id) {
  return IMPROVEMENT_CATEGORIES.find((x) => x.id === id) || null;
}

/** @param {import('./geo.js').GeoKind} kind @returns {ImprovementCategory[]} */
export function categoriesFor(kind) {
  return IMPROVEMENT_CATEGORIES.filter((x) => x.appliesTo.includes(kind));
}
