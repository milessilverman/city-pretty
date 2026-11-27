// @ts-check
// Distance effects: how far, and how much, a CITED study says an improvement type changes nearby home values.
// Pure functions. No default radius, decay or effect size lives here: every number comes from an evidence record
// (app/data/impact_distance_effects.json) or from the block-group inputs the caller passes. No record => no rings.
import { makeQuantity, mulQ, addQ, scaleQ, unknownQuantity, isQuantity } from '../schema/quantity.js';
import { haversineM } from '../schema/geo.js';
import { combineImpacts } from '../impact/combine.js';

/** @typedef {import('../schema/quantity.js').Quantity} Quantity */
/** @typedef {{ inner: number, outer: number, unit: string, effectPct: number|null, lowPct: number|null, highPct: number|null, quoteIndex: number }} DistanceBand */
/**
 * @typedef {Object} DistanceEffectRecord
 * @property {string} id
 * @property {string} improvementKey
 * @property {string} target
 * @property {'positive'|'negative'|'mixed'|'none_found'} direction
 * @property {DistanceBand[]} bands
 * @property {'straight_line'|'network'|'unspecified'} distanceBasis
 * @property {string} studyArea
 * @property {string} propertyType
 * @property {{ citation: string, doi: string|null, url: string, retrieved: string, type: string }} study
 * @property {string[]} quotes
 * @property {string} transferability
 * @property {'verified'|'requires_investigation'} status
 * @property {string} [reason]
 * @property {string[]} notRepresented
 */
/** @typedef {{ type: 'Point', coordinates: number[] }|{ type: 'LineString', coordinates: number[][] }} SiteGeometry */

/** Exact unit definitions (international foot, statute mile). Physical constants, not policy parameters. */
export const METRES_PER_UNIT = Object.freeze({ m: 1, ft: 0.3048, mile: 1609.344, km: 1000 });
const DIRECTIONS = ['positive', 'negative', 'mixed', 'none_found'];
const BASES = ['straight_line', 'network', 'unspecified'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** @param {any} s */
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
/** @param {any} n */
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
/** @param {any} n */
const numOrNull = (n) => n === null || finite(n);

/**
 * Validate one evidence record against the file contract.
 * @param {any} rec
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDistanceEffectRecord(rec) {
  /** @type {string[]} */ const e = [];
  if (!rec || typeof rec !== 'object') return { valid: false, errors: ['record must be an object'] };
  for (const k of ['id', 'improvementKey', 'target', 'studyArea', 'propertyType', 'transferability']) if (!nonEmpty(rec[k])) e.push(`${k} required`);
  if (!DIRECTIONS.includes(rec.direction)) e.push('direction must be positive, negative, mixed or none_found');
  if (!BASES.includes(rec.distanceBasis)) e.push('distanceBasis must be straight_line, network or unspecified');
  if (!['verified', 'requires_investigation'].includes(rec.status)) e.push('status must be verified or requires_investigation');
  if (rec.status === 'requires_investigation' && !nonEmpty(rec.reason)) e.push('reason required when status is requires_investigation');
  const s = rec.study;
  if (!s || typeof s !== 'object') e.push('study required');
  else {
    if (!nonEmpty(s.citation)) e.push('study.citation required');
    if (!nonEmpty(s.url)) e.push('study.url required');
    if (!nonEmpty(s.retrieved) || !DATE_RE.test(s.retrieved)) e.push('study.retrieved (YYYY-MM-DD) required');
    if (!nonEmpty(s.type)) e.push('study.type required');
    if (!(s.doi === null || s.doi === undefined || nonEmpty(s.doi))) e.push('study.doi must be a string or null');
  }
  if (!Array.isArray(rec.quotes) || !rec.quotes.every(nonEmpty) || (rec.status === 'verified' && rec.quotes.length === 0)) e.push('quotes must be an array of non-empty strings (non-empty when verified)');
  if (!Array.isArray(rec.notRepresented) || !rec.notRepresented.every(nonEmpty)) e.push('notRepresented must be an array of strings');
  if (!Array.isArray(rec.bands)) e.push('bands must be an array');
  else {
    if (rec.status === 'verified' && rec.bands.length === 0) e.push('a verified record needs at least one band');
    rec.bands.forEach((/** @type {any} */ b, /** @type {number} */ i) => {
      const w = `bands[${i}]`;
      if (!b || typeof b !== 'object') { e.push(`${w} must be an object`); return; }
      if (!(b.unit in METRES_PER_UNIT)) e.push(`${w}.unit must be m, ft, mile or km`);
      if (!finite(b.inner) || b.inner < 0) e.push(`${w}.inner must be a number >= 0`);
      if (!finite(b.outer) || !(b.outer > b.inner)) e.push(`${w}.outer must be a number greater than inner`);
      for (const k of ['effectPct', 'lowPct', 'highPct']) if (!numOrNull(b[k])) e.push(`${w}.${k} must be a number or null`);
      if (finite(b.effectPct) && finite(b.lowPct) && b.lowPct > b.effectPct) e.push(`${w}.lowPct is above effectPct`);
      if (finite(b.effectPct) && finite(b.highPct) && b.highPct < b.effectPct) e.push(`${w}.highPct is below effectPct`);
      if (b.effectPct === null && (finite(b.lowPct) || finite(b.highPct))) e.push(`${w} gives a range but no effectPct`);
      if (!Number.isInteger(b.quoteIndex) || !Array.isArray(rec.quotes) || b.quoteIndex < 0 || b.quoteIndex >= rec.quotes.length) e.push(`${w}.quoteIndex must index into quotes`);
      const vals = [b.effectPct, b.lowPct, b.highPct].filter(finite);
      if (rec.direction === 'positive' && vals.some((v) => v < 0)) e.push(`${w}: direction is positive but an effect is negative`);
      if (rec.direction === 'negative' && vals.some((v) => v > 0)) e.push(`${w}: direction is negative but an effect is positive`);
    });
    // Bands may be nested ('within X' results that start at the same inner distance). That is allowed; ringSummary marks them.
  }
  return { valid: e.length === 0, errors: e };
}

/**
 * The single verified record for an improvement key. Several verified records are returned as candidates, never averaged.
 * @param {any[]} records
 * @param {string} improvementKey
 * @returns {{ record: DistanceEffectRecord, reason?: undefined }|{ record: null, reason: 'no_cited_distance_effect'|'ambiguous'|'requires_investigation', candidates?: any[], detail?: string[] }}
 */
export function selectRecord(records, improvementKey) {
  const all = (Array.isArray(records) ? records : []).filter((r) => r && r.improvementKey === improvementKey);
  if (all.length === 0) return { record: null, reason: 'no_cited_distance_effect' };
  const verified = all.filter((r) => r.status === 'verified');
  const usable = verified.filter((r) => validateDistanceEffectRecord(r).valid);
  if (usable.length === 1) return { record: usable[0] };
  if (usable.length > 1) return { record: null, reason: 'ambiguous', candidates: usable };
  const pending = all.filter((r) => r.status === 'requires_investigation');
  if (verified.length === 0 && pending.length > 0) return { record: null, reason: 'requires_investigation', candidates: pending, detail: pending.map((r) => String(r.reason || '')) };
  return { record: null, reason: 'no_cited_distance_effect', detail: verified.flatMap((r) => validateDistanceEffectRecord(r).errors) };
}

/**
 * Band limits in metres.
 * @param {DistanceEffectRecord} record
 * @returns {{ innerM: number, outerM: number, unit: string, inner: number, outer: number }[]}
 */
export function bandsInMetres(record) {
  return record.bands.map((b) => {
    const k = METRES_PER_UNIT[/** @type {'m'} */ (b.unit)];
    if (!k) throw new Error(`bandsInMetres: unknown unit '${b.unit}'`);
    return { innerM: b.inner * k, outerM: b.outer * k, unit: b.unit, inner: b.inner, outer: b.outer };
  }).sort((a, b) => a.innerM - b.innerM);
}

// ---------------------------------------------------------------- geometry helpers (planar around the query point)

const EARTH_R = 6371008.8;
const RAD = Math.PI / 180;

/** Local planar offset (metres) of q relative to origin o, both [lon, lat]. @param {number[]} o @param {number[]} q */
function local(o, q) { return [(q[0] - o[0]) * RAD * EARTH_R * Math.cos(o[1] * RAD), (q[1] - o[1]) * RAD * EARTH_R]; }

/** Distance in metres from point p to segment a-b, all [lon, lat]. @param {number[]} p @param {number[]} a @param {number[]} b */
function pointSegmentM(p, a, b) {
  const A = local(p, a), B = local(p, b);
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const L2 = dx * dx + dy * dy;
  let t = L2 === 0 ? 0 : -(A[0] * dx + A[1] * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(A[0] + t * dx, A[1] + t * dy);
}

/**
 * Distance in metres from a [lon, lat] position to a Point or LineString.
 * @param {number[]} pos @param {SiteGeometry} g
 */
export function distanceToGeometryM(pos, g) {
  if (g.type === 'Point') return haversineM(/** @type {[number, number]} */ (pos), /** @type {[number, number]} */ (g.coordinates));
  if (g.type === 'LineString') {
    const c = g.coordinates;
    if (c.length === 1) return haversineM(/** @type {[number, number]} */ (pos), /** @type {[number, number]} */ (c[0]));
    let best = Infinity;
    for (let i = 1; i < c.length; i++) best = Math.min(best, pointSegmentM(pos, c[i - 1], c[i]));
    return best;
  }
  throw new Error('distanceToGeometryM: site geometry must be a Point or LineString');
}

/** @param {SiteGeometry} g @returns {number[][]} */
function vertices(g) { return g.type === 'Point' ? [g.coordinates] : g.coordinates; }

/** Approximate minimum distance between two sites: vertices of each against the other's geometry. @param {SiteGeometry} a @param {SiteGeometry} b */
export function minDistanceBetweenM(a, b) {
  let best = Infinity;
  for (const v of vertices(a)) best = Math.min(best, distanceToGeometryM(v, b));
  for (const v of vertices(b)) best = Math.min(best, distanceToGeometryM(v, a));
  return best;
}

/** @param {number[]} p @param {number[][]} ring */
function inRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** @param {any} poly Polygon or MultiPolygon geometry @returns {number[][][][]} list of polygons, each a list of rings */
function polygonsOf(poly) {
  if (poly && poly.type === 'Polygon') return [poly.coordinates];
  if (poly && poly.type === 'MultiPolygon') return poly.coordinates;
  throw new Error('block group polygon must be a GeoJSON Polygon or MultiPolygon');
}

/**
 * Deterministic grid of points inside a block-group polygon (about `n` grid cells over its bounding box; only points inside
 * the polygon are kept). If no grid point falls inside (a sliver), the mean of the outer ring's vertices is used instead.
 * @param {any} poly @param {number} n @returns {number[][]}
 */
export function samplePoints(poly, n) {
  const polys = polygonsOf(poly);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) for (const [x, y] of p[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const wM = Math.max((maxX - minX) * Math.cos(((minY + maxY) / 2) * RAD), 1e-12), hM = Math.max(maxY - minY, 1e-12);
  const nx = Math.max(1, Math.ceil(Math.sqrt(n * (wM / hM)))), ny = Math.max(1, Math.ceil(n / nx));
  /** @type {number[][]} */ const pts = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p = [minX + ((i + 0.5) / nx) * (maxX - minX), minY + ((j + 0.5) / ny) * (maxY - minY)];
    if (polys.some((pg) => inRing(p, pg[0]) && !pg.slice(1).some((h) => inRing(p, h)))) pts.push(p);
  }
  if (pts.length === 0) {
    const r = polys[0][0];
    pts.push([r.reduce((s, q) => s + q[0], 0) / r.length, r.reduce((s, q) => s + q[1], 0) / r.length]);
  }
  return pts;
}

// ---------------------------------------------------------------- ring summary

/**
 * @typedef {Object} BlockGroupInput
 * @property {string} id
 * @property {Quantity|null} homes
 * @property {Quantity|null} medianHomeValue
 * @property {any} polygon GeoJSON Polygon or MultiPolygon
 */

/**
 * Per band: estimated homes and estimated change in home values, from a CITED record.
 * Bands are half-open: inner <= distance < outer, measured in a straight line from the site geometry.
 * @param {{ record: DistanceEffectRecord, site: SiteGeometry, blockGroups: BlockGroupInput[], samplesPerBlockGroup: number, siteKey?: string }} args
 */
export function ringSummary({ record, site, blockGroups, samplesPerBlockGroup, siteKey }) {
  const v = validateDistanceEffectRecord(record);
  if (!v.valid || record.status !== 'verified') throw new Error('ringSummary: needs a valid verified record (' + v.errors.join('; ') + ')');
  if (!site || (site.type !== 'Point' && site.type !== 'LineString')) throw new Error('ringSummary: site must be a GeoJSON Point or LineString');
  if (!Number.isInteger(samplesPerBlockGroup) || samplesPerBlockGroup < 1) throw new Error('ringSummary: samplesPerBlockGroup must be a positive integer');
  const limits = bandsInMetres(record);
  const source = { title: record.study.citation, url: record.study.url, retrieved: record.study.retrieved };
  const basisText = { straight_line: 'straight-line distance', network: 'distance along the street or walking network', unspecified: 'a distance basis the study does not state' }[record.distanceBasis];

  // share of each block group's sample points per band
  const perBg = blockGroups.map((bg) => {
    const pts = samplePoints(bg.polygon, samplesPerBlockGroup);
    const counts = limits.map(() => 0);
    for (const p of pts) {
      const d = distanceToGeometryM(p, site);
      limits.forEach((b, i) => { if (d >= b.innerM && d < b.outerM) counts[i]++; }); // nested bands each count the same point
    }
    return { bg, points: pts.length, shares: counts.map((c) => c / pts.length) };
  });

  const bands = limits.map((lim, bi) => {
    const srcBand = record.bands.find((b) => b.inner === lim.inner && b.outer === lim.outer && b.unit === lim.unit) || record.bands[bi];
    const eff = srcBand.effectPct;
    const effQ = eff === null ? null : makeQuantity({
      value: eff / 100, low: Number(finite(srcBand.lowPct) ? srcBand.lowPct : eff) / 100, high: Number(finite(srcBand.highPct) ? srcBand.highPct : eff) / 100,
      unit: 'ratio', status: 'verified', source, jurisdiction: record.studyArea, effectiveDate: record.study.retrieved,
      inputs: [`${record.id} band ${lim.inner}-${lim.outer} ${lim.unit}`], method: 'effect on nearby residential property values as stated by the study (percent / 100)',
    });
    /** @type {Quantity[]} */ const homesList = [];
    /** @type {Quantity[]} */ const valueList = [];
    /** @type {{ id: string, share: number, homes: Quantity, valueEffect: Quantity|null }[]} */ const detail = [];
    let valueUnknown = effQ === null ? 'the study gives no percentage for this band (see its quote; it may give a dollar figure instead), so no value effect is computed' : '';
    for (const r of perBg) {
      const share = r.shares[bi];
      if (!(share > 0)) continue;
      const homesBg = r.bg.homes && isQuantity(r.bg.homes)
        ? { ...scaleQ(r.bg.homes, share), method: `block-group homes x share of ${r.points} sample points of the block-group polygon that lie ${lim.innerM}-${lim.outerM} m from the site (apportioned, not counted)` }
        : unknownQuantity('homes', `block group ${r.bg.id} has no homes count`);
      homesList.push(homesBg);
      let val = null;
      if (effQ && r.bg.medianHomeValue && isQuantity(r.bg.medianHomeValue) && homesBg.value !== null) {
        const m = mulQ(mulQ(/** @type {Quantity} */ (homesBg), r.bg.medianHomeValue), effQ);
        val = m.unit === 'homes*USD' ? { ...m, unit: 'USD' } : m;
        val = { ...val, method: 'estimated homes in ring x block-group median home value x study effect (ranges multiplied through)' };
        valueList.push(val);
      } else if (effQ) valueUnknown = `block group ${r.bg.id} lacks a homes count or median home value`;
      detail.push({ id: r.bg.id, share, homes: homesBg, valueEffect: val });
    }
    const sum = (/** @type {Quantity[]} */ list, /** @type {string} */ unit, /** @type {string} */ empty, /** @type {string} */ method) => {
      if (list.length === 0) return unknownQuantity(unit, empty, { status: 'unavailable' });
      let t = list[0];
      for (const q of list.slice(1)) t = addQ(t, q);
      return { ...t, method };
    };
    const homesEstimated = sum(homesList, 'homes', 'no sample point of the block groups passed falls in this band', 'sum of block-group homes apportioned by the share of a deterministic sample grid of each block-group polygon whose straight-line distance to the site lies in this band');
    const noVal = valueUnknown || 'no block group has a point in this band';
    const valueEffect = valueUnknown || valueList.length === 0
      ? unknownQuantity('USD', noVal, { status: 'unavailable' })
      : sum(valueList, 'USD', noVal, 'sum over block groups of estimated homes in band x median home value x study effect');
    const kind = limits.some((o, oi) => oi !== bi && o.innerM < lim.outerM && lim.innerM < o.outerM) ? 'within' : 'ring';
    return {
      index: bi, kind, innerM: lim.innerM, outerM: lim.outerM, statedInner: lim.inner, statedOuter: lim.outer, statedUnit: lim.unit,
      effectPct: { value: srcBand.effectPct, low: srcBand.lowPct, high: srcBand.highPct },
      quoteIndex: srcBand.quoteIndex, homesEstimated, valueEffect, blockGroups: detail,
    };
  });

  /** @type {string[]} */ const caveats = [
    `Study area and property type: ${record.studyArea}; ${record.propertyType}. Whether this carries over here: ${record.transferability}`,
    record.distanceBasis === 'straight_line'
      ? 'The study measured straight-line distance, as the rings here do.'
      : `The study used ${basisText}; the rings here are straight-line distances from the site, so they can differ from the study's.`,
    ...(limits.some((l, i) => limits.some((o, j) => i !== j && o.innerM < l.outerM && l.innerM < o.outerM))
      ? ['Some bands are nested ("within X") results from the study. They are alternative measurements of the same homes, so their homes and values are never added together.'] : []),
    'Homes in each ring are estimated from block-group totals shared out by area (a grid of sample points), not counted house by house.',
    'The value effect applies the study\'s percent change to the block group\'s median home value for every home in the ring. It is the change in nearby home values that owners hold. It is not investor cash flow and not tax revenue.',
    ...record.notRepresented.map((t) => `Not represented: ${t}`),
  ];
  return {
    improvementKey: record.improvementKey, recordId: record.id, siteKey: siteKey || record.improvementKey, siteGeometry: site, target: record.target, direction: record.direction,
    resolution: /** @type {'block_group_estimate'} */ ('block_group_estimate'), distanceBasis: record.distanceBasis, study: record.study, quotes: record.quotes,
    samplesPerBlockGroup, outerM: Math.max(...limits.map((l) => l.outerM)), bands, caveats,
  };
}

// ---------------------------------------------------------------- overlap

/**
 * Per block group, the sum of that site's band values (null when any band value is unknown).
 * @param {any} summary @returns {Map<string, Quantity>}
 */
function perBlockGroupValue(summary) {
  /** @type {Map<string, Quantity>} */ const m = new Map();
  // nested ('within') bands measure the same homes: use only the widest of them, plus every disjoint ring band
  const widest = Math.max(...summary.bands.filter((/** @type {any} */ b) => b.kind === 'within').map((/** @type {any} */ b) => b.outerM), -Infinity);
  for (const b of summary.bands.filter((/** @type {any} */ x) => x.kind === 'ring' || x.outerM === widest)) for (const d of b.blockGroups) {
    const q = d.valueEffect || unknownQuantity('USD', 'value effect unknown for this block group and band', { status: 'unavailable' });
    const prev = m.get(d.id);
    m.set(d.id, prev ? addQ(prev, q) : q);
  }
  return m;
}

/**
 * When the rings of two shown sites overlap for the same target, their values are NOT added. With no guard the values stay
 * per site and 'overlap_not_combined' is returned; with a guard they go through combineImpacts (the single guard).
 * @param {any[]} summaries results of ringSummary
 * @param {import('../impact/combine.js').Guard|null} [guard]
 */
export function overlapNote(summaries, guard = null) {
  /** @type {{ a: string, b: string, target: string, distanceM: number, sharedBlockGroups: string[] }[]} */ const pairs = [];
  for (let i = 0; i < summaries.length; i++) for (let j = i + 1; j < summaries.length; j++) {
    const A = summaries[i], B = summaries[j];
    if (A.target !== B.target) continue;
    const d = minDistanceBetweenM(A.siteGeometry, B.siteGeometry);
    if (!(d < A.outerM + B.outerM)) continue;
    const ia = new Set(A.bands.flatMap((/** @type {any} */ b) => b.blockGroups.map((/** @type {any} */ x) => x.id)));
    const shared = [...new Set(B.bands.flatMap((/** @type {any} */ b) => b.blockGroups.map((/** @type {any} */ x) => x.id)))].filter((id) => ia.has(id));
    pairs.push({ a: A.siteKey, b: B.siteKey, target: A.target, distanceM: d, sharedBlockGroups: shared });
  }
  if (pairs.length === 0) return { overlapping: false, pairs, flags: /** @type {string[]} */ ([]), perSite: summaries.map((s) => ({ siteKey: s.siteKey, bands: s.bands })), combined: null };
  const perSite = summaries.map((s) => ({ siteKey: s.siteKey, bands: s.bands }));
  if (!guard) return { overlapping: true, pairs, flags: ['overlap_not_combined'], perSite, combined: null };
  const involved = new Set(pairs.flatMap((p) => [p.a, p.b]));
  const effects = summaries.filter((s) => involved.has(s.siteKey)).map((s) => ({
    improvementId: s.siteKey, notValued: [], unknownBase: [],
    perReceptor: [...perBlockGroupValue(s)].map(([id, value]) => ({ receptorId: id, target: s.target, sign: /** @type {1|-1} */ (s.direction === 'negative' ? -1 : 1), layerId: s.recordId, improvementId: s.siteKey, value })),
  }));
  const combined = combineImpacts(effects, guard);
  return { overlapping: true, pairs, flags: combined.flags, perSite, combined };
}
