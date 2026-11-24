// @ts-check
// GeoRef: where something is. GeoJSON Point / LineString / Polygon in EPSG:4326 only.

/**
 * @typedef {[number, number]} Position  [longitude, latitude]
 * @typedef {{ type: 'Point', coordinates: Position }} PointGeometry
 * @typedef {{ type: 'LineString', coordinates: Position[] }} LineStringGeometry
 * @typedef {{ type: 'Polygon', coordinates: Position[][] }} PolygonGeometry
 * @typedef {PointGeometry|LineStringGeometry|PolygonGeometry} Geometry
 * @typedef {'point'|'parcel'|'street_segment'|'asset'|'block_group'|'area'} GeoKind
 * @typedef {{ country: 'US', state: string, countyFips: string, place: string|null }} GeoJurisdiction
 * @typedef {{ kind: GeoKind, id: string, jurisdiction: GeoJurisdiction, geometry: Geometry, crs: 'EPSG:4326' }} GeoRef
 */

export const GEO_KINDS = Object.freeze(['point', 'parcel', 'street_segment', 'asset', 'block_group', 'area']);
const KIND_GEOMETRIES = {
  point: ['Point'], parcel: ['Polygon'], street_segment: ['LineString'], asset: ['Point', 'Polygon'],
  block_group: ['Polygon'], area: ['Polygon'],
};
/** Mean Earth radius in metres: a physical constant, not a policy parameter. */
const EARTH_RADIUS_M = 6371008.8;

/** @param {any} p */
function posErrors(p) {
  if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return ['position must be [lon, lat] numbers'];
  const e = [];
  if (p[0] < -180 || p[0] > 180) e.push(`longitude ${p[0]} outside WGS84 bounds`);
  if (p[1] < -90 || p[1] > 90) e.push(`latitude ${p[1]} outside WGS84 bounds`);
  return e;
}

/** @param {any} g @returns {string[]} */
function geometryErrors(g) {
  if (!g || typeof g !== 'object') return ['geometry required'];
  const c = g.coordinates;
  if (g.type === 'Point') return posErrors(c);
  if (g.type === 'LineString') {
    if (!Array.isArray(c) || c.length < 2) return ['LineString needs at least 2 positions'];
    return c.flatMap(posErrors);
  }
  if (g.type === 'Polygon') {
    if (!Array.isArray(c) || c.length < 1) return ['Polygon needs at least one ring'];
    const e = [];
    for (const ring of c) {
      if (!Array.isArray(ring) || ring.length < 4) { e.push('Polygon ring needs at least 4 positions'); continue; }
      e.push(...ring.flatMap(posErrors));
      const f = ring[0], l = ring[ring.length - 1];
      if (!f || !l || f[0] !== l[0] || f[1] !== l[1]) e.push('Polygon ring must be closed');
    }
    return e;
  }
  return [`unsupported geometry type ${g.type}`];
}

/** @param {any} ref @returns {{ valid: boolean, errors: string[] }} */
export function validateGeoRef(ref) {
  const errors = [];
  if (!ref || typeof ref !== 'object') return { valid: false, errors: ['GeoRef object required'] };
  if (!GEO_KINDS.includes(ref.kind)) errors.push(`kind must be one of ${GEO_KINDS.join('|')}`);
  if (typeof ref.id !== 'string' || !ref.id) errors.push('id required');
  if (ref.crs !== 'EPSG:4326') errors.push("crs must be 'EPSG:4326'");
  const j = ref.jurisdiction;
  if (!j || typeof j !== 'object') errors.push('jurisdiction required');
  else {
    if (j.country !== 'US') errors.push("jurisdiction.country must be 'US'");
    if (typeof j.state !== 'string' || !j.state) errors.push('jurisdiction.state required');
    if (typeof j.countyFips !== 'string' || !/^\d{5}$/.test(j.countyFips)) errors.push('jurisdiction.countyFips must be 5 digits');
    if (j.place !== null && typeof j.place !== 'string') errors.push('jurisdiction.place must be string or null');
  }
  const ge = geometryErrors(ref.geometry);
  errors.push(...ge);
  if (!ge.length && GEO_KINDS.includes(ref.kind) && !KIND_GEOMETRIES[/** @type {GeoKind} */ (ref.kind)].includes(ref.geometry.type)) {
    errors.push(`kind ${ref.kind} cannot have a ${ref.geometry.type} geometry`);
  }
  return { valid: errors.length === 0, errors };
}

/** @param {{ kind: GeoKind, id: string, jurisdiction: { state: string, countyFips: string, place?: string|null, country?: 'US' }, geometry: Geometry }} spec @returns {GeoRef} */
export function makeGeoRef(spec) {
  const ref = {
    kind: spec && spec.kind, id: spec && spec.id,
    jurisdiction: { country: 'US', state: spec?.jurisdiction?.state, countyFips: spec?.jurisdiction?.countyFips, place: spec?.jurisdiction?.place ?? null },
    geometry: spec && spec.geometry, crs: 'EPSG:4326',
  };
  const v = validateGeoRef(ref);
  if (!v.valid) throw new Error('makeGeoRef: ' + v.errors.join('; '));
  return /** @type {GeoRef} */ (Object.freeze({ ...ref, jurisdiction: Object.freeze(ref.jurisdiction) }));
}

/** Great-circle distance in metres between two [lon, lat] positions. @param {Position} a @param {Position} b */
export function haversineM(a, b) {
  const errs = [...posErrors(a), ...posErrors(b)];
  if (errs.length) throw new Error('haversineM: ' + errs.join('; '));
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** @param {Geometry} g @returns {Position[]} */
function allPositions(g) {
  if (g.type === 'Point') return [g.coordinates];
  if (g.type === 'LineString') return g.coordinates;
  return g.coordinates.flat();
}

/** @param {Geometry} g @returns {[number, number, number, number]} minLon, minLat, maxLon, maxLat */
export function bboxOf(g) {
  const e = geometryErrors(g);
  if (e.length) throw new Error('bboxOf: ' + e.join('; '));
  const ps = allPositions(g);
  return [Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))];
}

/** Planar centroid in degrees (adequate for parcel/segment scale). @param {Geometry} g @returns {Position} */
export function centroidOf(g) {
  const e = geometryErrors(g);
  if (e.length) throw new Error('centroidOf: ' + e.join('; '));
  if (g.type === 'Point') return [g.coordinates[0], g.coordinates[1]];
  if (g.type === 'LineString') {
    let len = 0, x = 0, y = 0;
    for (let i = 1; i < g.coordinates.length; i++) {
      const p = g.coordinates[i - 1], q = g.coordinates[i];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      len += l; x += l * (p[0] + q[0]) / 2; y += l * (p[1] + q[1]) / 2;
    }
    if (len === 0) return [g.coordinates[0][0], g.coordinates[0][1]];
    return [x / len, y / len];
  }
  const ring = g.coordinates[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i - 1], q = ring[i];
    const cr = p[0] * q[1] - q[0] * p[1];
    a += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr;
  }
  if (a === 0) {
    const pts = ring.slice(0, -1);
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}
