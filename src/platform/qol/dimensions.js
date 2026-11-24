// @ts-check
// Quality-of-life dimensions: structure only. No numbers, thresholds or weights.

/** @typedef {{ id: string, direction: 'higher_is_better'|'lower_is_better', inputs: readonly string[] }} QolDimension */

/** @param {string} id @param {'higher_is_better'|'lower_is_better'} direction @param {string[]} inputs @returns {QolDimension} */
const d = (id, direction, inputs) => Object.freeze({ id, direction, inputs: Object.freeze(inputs) });
const H = 'higher_is_better', L = 'lower_is_better';

export const QOL_DIMENSIONS = Object.freeze([
  d('housing', L, ['housing_cost_burden', 'housing_supply']),
  d('transport_cost', L, ['household_transport_cost']),
  d('access_jobs', H, ['jobs_reachable', 'travel_time_matrix']),
  d('access_education', H, ['schools_reachable', 'travel_time_matrix']),
  d('access_health', H, ['health_facilities_reachable', 'travel_time_matrix']),
  d('access_groceries', H, ['grocery_stores_reachable', 'travel_time_matrix']),
  d('travel_time', L, ['door_to_door_travel_time']),
  d('safety', H, ['crash_records', 'crime_records']),
  d('noise', L, ['noise_exposure']),
  d('heat', L, ['surface_temperature', 'canopy_cover']),
  d('air', H, ['air_quality_measurements']),
  d('public_space', H, ['open_space_per_resident', 'public_space_access']),
  d('resilience', H, ['hazard_exposure', 'infrastructure_redundancy']),
  d('displacement', L, ['rent_change', 'eviction_records', 'tenure_mix']),
]);

export const QOL_DIMENSION_COUNT = QOL_DIMENSIONS.length;
export const QOL_DIMENSION_IDS = Object.freeze(QOL_DIMENSIONS.map((x) => x.id));

/** @param {string} id @returns {QolDimension|null} */
export function getDimension(id) {
  return QOL_DIMENSIONS.find((x) => x.id === id) || null;
}
