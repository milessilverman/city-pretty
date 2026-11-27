// @ts-check
// Pure adapter: parsed app/data/sites-la.b64.txt JSON -> located site records for the platform engines. Nothing is invented.
// Only records with `pt` are located. The file states no unit for any numeric field except what its own meta names, so
// numbers whose unit is not stated stay as labels (plain values under their own key); counts are Quantities with unit 'count'.
// A unit may be used only where a repo build script or data file states it; UNIT_SEARCH records what was searched and found.
import { makeQuantity } from '../schema/quantity.js';
import { makeGeoRef, haversineM } from '../schema/geo.js';

/** Block-group cities whose value names an area, not a city: kept as a label, not used as jurisdiction.place. */
const NOT_A_PLACE = /^unincorporated\b/i;

export const CITY_METHOD = 'city of the containing block group as carried in the county bundle';
export const ASSUMED_TEXT = 'value as carried in the site file; source not stated in the file';
const COUNTY = 'Los Angeles County';

/**
 * Which file key feeds which attribute / label, per record type. `quantity` = Quantity (unit 'count'); `label` = kept as read.
 * @type {Readonly<Record<string, Record<string, { as: 'quantity'|'label', name: string, unit?: string, note: string }>>>}
 */
export const fieldMap = Object.freeze({
  xing: {
    n: { as: 'quantity', name: 'xing_n', unit: 'count', note: 'count carried under key `n`; what it counts is not stated in the file; not mapped to a rule attribute' },
    ped: { as: 'quantity', name: 'xing_ped', unit: 'count', note: 'count carried under key `ped`; its definition is not stated in the file meta or a repo build script, so it is NOT mapped to the crosswalk attribute ped_crash_count' },
    bike: { as: 'quantity', name: 'xing_bike', unit: 'count', note: 'count carried under key `bike`; definition not stated; not mapped' },
    killed: { as: 'quantity', name: 'xing_killed', unit: 'count', note: 'count carried under key `killed`; definition not stated; not mapped' },
    at: { as: 'label', name: 'at', note: 'cross streets as listed' },
    school: { as: 'label', name: 'school', note: 'as listed' },
    p: { as: 'label', name: 'p', note: 'as listed' },
  },
  lot_park: {
    use: { as: 'label', name: 'current_use', note: 'key `use`' },
    z: { as: 'label', name: 'zoning_district', note: 'key `z`' },
    ac: { as: 'label', name: 'ac', note: 'number kept as read; no repo build script or data file states a unit for lot_park `ac` (see UNIT_SEARCH), so it is not a Quantity and is not mapped to parcel_area' },
    lav: { as: 'label', name: 'lav', note: 'number kept as read; no repo build script or data file states a unit or currency for lot_park `lav` (see UNIT_SEARCH); not mapped to assessed_land_value' },
    pn: { as: 'label', name: 'pn', note: 'number kept as read; meaning and unit not stated by the site file or a build script that produces it (see UNIT_SEARCH)' },
    pa: { as: 'label', name: 'pa', note: 'number kept as read; meaning and unit not stated by the site file or a build script that produces it (see UNIT_SEARCH)' },
    own: { as: 'label', name: 'own', note: 'as listed' },
    src: { as: 'label', name: 'src', note: 'as listed' },
    ad: { as: 'label', name: 'ad', note: 'as listed' },
    st: { as: 'label', name: 'st', note: 'as listed' },
    site: { as: 'label', name: 'site', note: 'as listed' },
    nmlot: { as: 'label', name: 'nmlot', note: 'as listed' },
    op: { as: 'label', name: 'op', note: 'as listed' },
    p: { as: 'label', name: 'p', note: 'as listed' },
  },
  ev: {
    n_l2: { as: 'quantity', name: 'ev_n_l2', unit: 'count', note: 'count carried under key `n_l2`' },
    n_dc: { as: 'quantity', name: 'ev_n_dc', unit: 'count', note: 'count carried under key `n_dc`' },
    dl2: { as: 'label', name: 'dl2', note: 'number kept as read; docs/pipeline-README.md:289 calls dl2/ddc "that distance" (to the nearest charger of a kind) but states no unit' },
    ddc: { as: 'label', name: 'ddc', note: 'number kept as read; docs/pipeline-README.md:289 calls dl2/ddc "that distance" (to the nearest charger of a kind) but states no unit' },
    ac: { as: 'label', name: 'ac', note: 'number kept as read; no repo build script or data file states a unit for ev `ac` (see UNIT_SEARCH)' },
    dest: { as: 'label', name: 'dest', note: 'as listed' },
    dk: { as: 'label', name: 'dk', note: 'as listed' },
    nmlot: { as: 'label', name: 'nmlot', note: 'as listed' },
    op: { as: 'label', name: 'op', note: 'as listed' },
    st: { as: 'label', name: 'st', note: 'as listed' },
    p: { as: 'label', name: 'p', note: 'as listed' },
  },
});

/**
 * What was searched for a stated unit or definition of the lot_park / ev numeric keys, and what was found. Only the meta of the
 * site file itself and files in this repo count. The script that built the site file (`sites.py`) is not in this repository.
 */
export const UNIT_SEARCH = Object.freeze({
  buildScriptInRepo: false,
  searched: Object.freeze(['scripts/', 'pipeline/', 'national/', 'patches/', 'docs/pipeline-README.md', 'app/data/underused_sites.json', 'research/sites_verification.csv']),
  found: Object.freeze([
    'docs/pipeline-README.md:289 names dl2/ddc as "that distance" to the nearest charger of a kind (no unit).',
    'app/data/underused_sites.json: verification.source_fields_origin says its acres/assessedLandValue/prop13BaseYear come from bundle-la under.sites ("The build code that produced the bundle is not in this repository"); those are bundle records, not these site-file records, so they are not carried over to lot_park ac/lav.',
  ]),
  notUsed: Object.freeze(['app/app.js labels (a renderer, neither a build script nor a data file)', 'pipeline/metrics_oc.py:526-528 (builds block-group pa/pn for Orange County, not these site records)']),
});

/** Distance attribute name; deliberately not the name the California rules read (`distance_to_transit_mi`). */
export const STATION_DISTANCE_ATTR = 'straight_line_distance_to_nearest_rail_station';

/** Decode one Google encoded polyline (precision 5) into [lon, lat] positions. @param {string} s @param {number} precision @returns {[number, number][]} */
function decodePolyline(s, precision) {
  const f = 10 ** precision;
  /** @type {[number, number][]} */ const out = [];
  let i = 0, lat = 0, lon = 0;
  while (i < s.length) {
    for (let k = 0; k < 2; k++) {
      let shift = 0, result = 0, c;
      do {
        if (i >= s.length) throw new Error('truncated polyline');
        c = s.charCodeAt(i++) - 63; result |= (c & 31) << shift; shift += 5;
      } while (c >= 32);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lon += d;
    }
    out.push([lon / f, lat / f]);
  }
  return out;
}

/** @param {any} v */
const isPos = (v) => Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]);
/** @param {any} v */
const present = (v) => v !== undefined && v !== null && v !== '';

/**
 * @param {any} json parsed sites-la JSON { meta: { la }, sites: { bg: [records] } }
 * @param {{ stations?: any[], stationsBuilt?: string, blockGroupCities?: Record<string, string|null|undefined>, zoneRuleJurisdictions?: string[] }} [opts] stations: GeoJSON Point features (properties.n = name); blockGroupCities: 12-digit block-group id -> the city value carried by that block group in the county bundle; zoneRuleJurisdictions: jurisdiction values of the bundle's own zone_rules rows (counted, never typed here)
 */
export function locatedSitesFromSitesLa(json, opts = {}) {
  const sites = json && json.sites;
  if (!sites || typeof sites !== 'object') throw new Error('locatedSitesFromSitesLa: json.sites object required');
  const meta = (json.meta && json.meta.la) || {};
  const built = typeof meta.built === 'string' && /^\d{4}-\d{2}-\d{2}/.test(meta.built) ? meta.built : null;
  /** @type {string[]} */ const limits = [];
  if (!built) limits.push('meta.la.built missing or malformed: no Quantity could be built (no effective date).');

  const stations = (opts.stations || []).filter((f) => f && f.geometry && f.geometry.type === 'Point' && isPos(f.geometry.coordinates))
    .map((f, i) => ({ i, name: f.properties && f.properties.n ? String(f.properties.n) : `station ${i}`, pos: /** @type {[number, number]} */ (f.geometry.coordinates) }));
  const stationDate = opts.stationsBuilt && /^\d{4}-\d{2}-\d{2}/.test(opts.stationsBuilt) ? opts.stationsBuilt : built;

  /** @param {string} id @param {string} unit @param {number} v @param {string} key @param {string[]} extraInputs */
  const countQ = (id, unit, v, key, extraInputs) => makeQuantity({
    value: v, low: v, high: v, unit, status: 'assumed', source: null, jurisdiction: COUNTY, effectiveDate: /** @type {string} */ (built),
    inputs: [`sites-la:${id}.${key}`, ...extraInputs], assumptions: [ASSUMED_TEXT], method: `read from key \`${key}\``, label: key,
  });

  const zoneJur = new Set(opts.zoneRuleJurisdictions || []);
  /** @type {any[]} */ const locations = [];
  /** @type {Record<string, Record<string, any>>} */ const indicators = {};
  /** @type {Record<string, { records: number, located: number, skippedNoPoint: number }>} */ const byType = {};
  const counts = { cityFromBlockGroup: 0, cityWithZoneRules: 0, cityAreaNotPlace: 0, blockGroupNotInBundle: 0, records: 0, located: 0, skippedNoPoint: 0, polygonFallbackToPoint: 0, stationDistances: 0, skippedUnknownType: 0, quantityWithoutDate: 0 };
  /** @type {Record<string, number>} */ const unknownKeys = {};

  for (const bg of Object.keys(sites).sort()) {
    const recs = sites[bg];
    if (!Array.isArray(recs)) continue;
    recs.forEach((rec, index) => {
      counts.records++;
      const type = rec && typeof rec.t === 'string' ? rec.t : '(none)';
      const bt = (byType[type] ||= { records: 0, located: 0, skippedNoPoint: 0 });
      bt.records++;
      if (!rec || !isPos(rec.pt)) { bt.skippedNoPoint++; counts.skippedNoPoint++; return; }
      const map = fieldMap[type];
      if (!map) { counts.skippedUnknownType++; unknownKeys[type] = (unknownKeys[type] || 0) + 1; return; }
      const id = `la-sites:${type}:${bg}:${index}`;
      /** @type {import('../schema/geo.js').GeoRef} */ let ref;
      let place = present(rec.place) ? String(rec.place) : null;
      /** @type {Record<string, any>} */ const labels = {};
      if (place === null && opts.blockGroupCities) {
        const c = opts.blockGroupCities[bg];
        if (!present(c)) counts.blockGroupNotInBundle++;
        else if (NOT_A_PLACE.test(String(c))) { counts.cityAreaNotPlace++; labels.block_group_city_value = String(c); }
        else { place = String(c); counts.cityFromBlockGroup++; if (zoneJur.has(place)) counts.cityWithZoneRules++; labels.place_method = CITY_METHOD; }
      }
      const jurisdiction = { state: 'CA', countyFips: '06037', place };
      if (type === 'lot_park') {
        /** @type {any} */ let geometry = null;
        try {
          const ring = Array.isArray(rec.g) && typeof rec.g[0] === 'string' ? decodePolyline(rec.g[0], 5) : [];
          const closed = ring.length >= 4 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
          if (closed) geometry = { type: 'Polygon', coordinates: [ring] };
        } catch { /* fall back below */ }
        if (geometry) ref = makeGeoRef({ kind: 'parcel', id, jurisdiction, geometry });
        else { counts.polygonFallbackToPoint++; ref = makeGeoRef({ kind: 'asset', id, jurisdiction, geometry: { type: 'Point', coordinates: rec.pt } }); }
      } else {
        ref = makeGeoRef({ kind: type === 'ev' ? 'asset' : 'point', id, jurisdiction, geometry: { type: 'Point', coordinates: rec.pt } });
      }
      /** @type {Record<string, any>} */ const attributes = {};
      const extra = type === 'ev' && present(meta.ev_source) ? [`sites-la meta.la.ev_source: ${meta.ev_source}`] : [];
      for (const [key, spec] of Object.entries(map)) {
        let v = rec[key];
        if (!present(v)) continue;
        if (spec.as === 'quantity') {
          if (typeof v !== 'number' || !Number.isFinite(v)) continue;
          if (!built) { counts.quantityWithoutDate++; continue; }
          attributes[spec.name] = countQ(id, /** @type {string} */ (spec.unit), v, key, extra);
        } else {
          if (Array.isArray(v)) v = v.join(' / ');
          labels[spec.name] = v;
        }
      }
      if (type === 'lot_park' && stations.length && built && stationDate) {
        let best = null, bd = Infinity;
        for (const s of stations) { const d = haversineM(rec.pt, s.pos); if (d < bd) { bd = d; best = s; } }
        if (best) {
          attributes[STATION_DISTANCE_ATTR] = makeQuantity({
            value: bd, low: bd, high: bd, unit: 'm', status: 'assumed', source: null, jurisdiction: COUNTY, effectiveDate: stationDate,
            inputs: [`sites-la:${id}.pt`, `bundle-la layers.stations[${best.i}] (${best.name})`],
            assumptions: ['straight-line great-circle distance from the lot point to the nearest station point; not a network or walking distance; station list as carried in the county bundle'],
            method: 'straight_line', label: STATION_DISTANCE_ATTR,
          });
          counts.stationDistances++;
        }
      }
      if (type === 'xing' && built && [rec.ped, rec.bike, rec.killed].every((x) => typeof x === 'number' && Number.isFinite(x))) {
        // names are the file's own keys: the file does not define them, so no crash-rule attribute name is claimed
        indicators[id] = { xing_ped: countQ(id, 'count', rec.ped, 'ped', []), xing_bike: countQ(id, 'count', rec.bike, 'bike', []), xing_killed: countQ(id, 'count', rec.killed, 'killed', []) };
      }
      locations.push({ ref, attributes, labels, sourceRecord: { blockGroupId: bg, index, type } });
      bt.located++; counts.located++;
    });
  }

  limits.push('Only records with a point (`pt`) are located. Street segments (calm) and creek records carry no `pt` in this file and are counted but not located.');
  limits.push('No repo build script or data file states a unit or definition for ac, lav, pn, pa, dl2 or ddc (the script that built the site file is not in the repo; see UNIT_SEARCH). They stay labels under their own keys, so no rule reading parcel_area or assessed_land_value can use them. No unit was inferred from magnitudes.');
  limits.push('Counts (n, ped, bike, killed, n_l2, n_dc) are Quantities with unit "count" and status assumed; the file does not say what period or definition each count uses beyond its meta (crash_years, crashes, ev_source).');
  limits.push('Lot polygons are decoded from the encoded line in `g` using precision 5 (an assumption about the encoding, not stated in the file); a lot whose line cannot be decoded as a closed ring falls back to an asset point.');
  limits.push(`No record states its city. ${counts.cityFromBlockGroup} located records take jurisdiction.place from their block group's own city value (method: ${CITY_METHOD}); ${counts.cityWithZoneRules} are in a city that has rows in the bundle's zone_rules (${[...zoneJur].join(', ') || 'none'}). ${counts.cityAreaNotPlace} sit in a block group whose value is an unincorporated area, not a city (place left null), and ${counts.blockGroupNotInBundle} sit in a block group absent from the bundle (place null). A point can lie outside its block group's city value; this is not a point-in-polygon test.`);
  limits.push('The crossing counts (n, ped, bike, killed) are not mapped to crosswalk rule attributes: the file meta gives only crash_years and a county crash total, and no repo build script defines what each count measures.');
  limits.push('Distances to rail stations are straight-line (haversine), status assumed (built with makeQuantity), and are stored under a name the California rules do not read.');
  if (Object.keys(unknownKeys).length) limits.push(`Records of unrecognised type with a point were skipped: ${JSON.stringify(unknownKeys)}.`);

  return { locations, indicators, fieldMap, limits, counts, byType, meta: { built, county: meta.county ?? null, crashYears: meta.crash_years ?? null } };
}
