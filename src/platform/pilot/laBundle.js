// @ts-check
// Pure adapter: Los Angeles County bundle `under.sites` records -> parcel-like objects. Nothing is invented.
// `under.assumptions` is never read. The bundle states no source for site fields, so numbers carry status 'assumed'
// with an explicit "no source stated" assumption (the Quantity schema allows no weaker status for a number).

/** Which bundle key fed which attribute. `numeric` ones become Quantities; `label` ones go to `labels` as strings. */
export const fieldMap = Object.freeze({
  ac: { attribute: 'parcel_area', type: 'numeric', unit: 'acre', note: 'key `ac`; unit taken from app/app.js:3600 which prints it as acres; the bundle itself states no unit' },
  lav: { attribute: 'assessed_land_value', type: 'numeric', unit: 'USD', note: 'key `lav`; app/app.js:2872 labels it assessed land value; the bundle states no unit or source' },
  by: { attribute: 'assessment_base_year', type: 'numeric', unit: 'year', note: 'key `by`; app/app.js:2872 prints it as the base year' },
  mkt: { attribute: 'bundle_mkt', type: 'numeric', unit: 'unspecified', note: 'key `mkt`; meaning not stated in the bundle, kept under its own key' },
  rail: { attribute: 'bundle_rail', type: 'numeric', unit: 'unspecified', note: 'key `rail`; meaning and unit not stated in the bundle, kept under its own key' },
  use: { attribute: 'current_use', type: 'label', note: 'key `use`' },
  z: { attribute: 'zoning_district', type: 'label', note: 'key `z`' },
  zc: { attribute: 'zoning_class', type: 'label', note: 'key `zc`' },
  k: { attribute: 'site_kind', type: 'label', note: 'key `k`' },
});

/** Keys present in records that are model outputs, not source facts: not mapped. */
const MODEL_OUTPUT_KEYS = ['homes', 'margin', 'idea', 'he'];

/**
 * @param {any} bundle parsed bundle object
 * @returns {{ parcels: { id: string, ref: null, attributes: Record<string, any>, labels: Record<string, string> }[],
 *   fieldMap: typeof fieldMap, limits: string[], recordCount: number }}
 */
export function parcelsFromUnderSites(bundle) {
  const sites = bundle && bundle.under && bundle.under.sites;
  if (!Array.isArray(sites)) throw new Error('parcelsFromUnderSites: bundle.under.sites array required');
  const built = (bundle.meta && bundle.meta.built) || null;
  const effectiveDate = typeof built === 'string' && /^\d{4}-\d{2}-\d{2}/.test(built) ? built : null;
  const countyName = 'Los Angeles County';
  /** @type {Record<string, number>} */ const absent = {};
  /** @type {Set<string>} */ const keysSeen = new Set();
  const parcels = sites.map((rec, idx) => {
    const attributes = /** @type {Record<string, any>} */ ({});
    const labels = /** @type {Record<string, string>} */ ({});
    for (const k of Object.keys(rec)) keysSeen.add(k);
    for (const [key, spec] of Object.entries(fieldMap)) {
      const v = rec[key];
      if (v === undefined || v === null || v === '') { absent[key] = (absent[key] || 0) + 1; continue; }
      if (spec.type === 'label') { labels[spec.attribute] = String(v); continue; }
      if (typeof v !== 'number' || !Number.isFinite(v) || !effectiveDate) continue;
      attributes[spec.attribute] = Object.freeze({
        value: v, unit: /** @type {any} */ (spec).unit, low: v, high: v, status: 'assumed', source: null, jurisdiction: countyName, effectiveDate,
        inputs: Object.freeze([`bundle-la.under.sites[${idx}].${key}`]),
        assumptions: Object.freeze(['the bundle states no source for this field; value carried as read, not verified']),
        method: `read from ${spec.note}`, label: spec.attribute,
      });
    }
    return { id: `la-under-site-${rec.i ?? idx}`, ref: null, attributes, labels };
  });
  const limits = [];
  limits.push('No record has coordinates or geometry (keys: ' + [...keysSeen].sort().join(', ') + '); every parcel has ref: null and cannot enter the coverage ledger or adjacency tests. `gid` is a 12-digit block-group code, not a parcel id, and is not used as a location.');
  limits.push('The bundle states no source for site fields; numeric attributes carry status assumed with that stated. Units for ac, lav and by come from app/app.js labels, not from the bundle.');
  limits.push(`Fields absent from the records are left out, not filled (absent counts: ${Object.entries(absent).map(([k, n]) => `${k} ${n}/${sites.length}`).join(', ')}). No assessed improvement value, permitted floor area or built floor area exists, so underused-land and development-rights rules return needs_info.`);
  limits.push(`Model outputs not mapped: ${MODEL_OUTPUT_KEYS.join(', ')}. under.assumptions is never read.`);
  if (!effectiveDate) limits.push('bundle.meta.built missing or malformed: no numeric attribute could be built.');
  return { parcels, fieldMap, limits, recordCount: sites.length };
}
