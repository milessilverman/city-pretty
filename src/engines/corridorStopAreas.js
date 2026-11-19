/**
 * Corridor stop areas (browser global and CommonJS module). Pure functions: no network, no file reads.
 *
 * A planned-rail corridor record (app/data/intercity_transit_corridors.json) lists the cities its source document
 * names, each at the Census internal point of the city. This module answers one question: which block groups of a
 * loaded county bundle lie within a stated radius of one of those points. It does not say where a station will be:
 * the point is a city point, and the result is worded that way by the caller.
 *
 * Distance is measured from the point to the block-group polygon: 0 when the point is inside it, otherwise the
 * distance to its nearest edge. A local flat projection around the point is used (the radii here are a few miles).
 */
(function () {
"use strict";

const MILES_PER_DEG_LAT = 69.0935; // mean length of one degree of latitude in statute miles (WGS84 mean radius 3958.8 mi)

function proj(lat0, lng0) {
  const kx = MILES_PER_DEG_LAT * Math.cos(lat0 * Math.PI / 180);
  return (lng, lat) => [(lng - lng0) * kx, (lat - lat0) * MILES_PER_DEG_LAT];
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function ringContains(ring, f) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = f(ring[i][0], ring[i][1]), b = f(ring[j][0], ring[j][1]);
    if ((a[1] > 0) !== (b[1] > 0) && 0 < (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// Distance in miles from (lat, lng) to a GeoJSON Polygon or MultiPolygon; 0 if the point is inside. null if no usable ring.
function distanceToGeometryMiles(lat, lng, geom) {
  if (!geom || !Array.isArray(geom.coordinates)) return null;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  const f = proj(lat, lng);
  let best = null;
  for (const poly of polys) {
    if (!poly || !poly.length || !poly[0] || poly[0].length < 3) continue;
    const outer = poly[0];
    if (ringContains(outer, f) && !poly.slice(1).some(h => ringContains(h, f))) return 0;
    for (const ring of poly) {
      for (let i = 1; i < ring.length; i++) {
        const a = f(ring[i - 1][0], ring[i - 1][1]), b = f(ring[i][0], ring[i][1]);
        const d = segDist(0, 0, a[0], a[1], b[0], b[1]);
        if (best === null || d < best) best = d;
      }
    }
  }
  return best;
}

/**
 * Block groups of one county bundle within `miles` of a point.
 * bundle: { features: [{ properties: { id, n, c }, geometry }] } (the map features of a county bundle).
 * Returns { ok, reason?, miles, areas: [{ id, name, city, miles }] } sorted nearest first, then by id.
 */
function blockGroupsWithin(bundle, point, miles) {
  const r = Number(miles);
  if (!(r > 0)) return { ok: false, reason: "radius must be a positive number of miles", miles: r, areas: [] };
  if (!point || !isFinite(point.lat) || !isFinite(point.lng)) return { ok: false, reason: "the stop has no coordinates", miles: r, areas: [] };
  const feats = bundle && Array.isArray(bundle.features) ? bundle.features : null;
  if (!feats || !feats.length) return { ok: false, reason: "the county's block-group outlines are not loaded", miles: r, areas: [] };
  const dLat = r / MILES_PER_DEG_LAT, dLng = r / (MILES_PER_DEG_LAT * Math.max(0.01, Math.cos(point.lat * Math.PI / 180)));
  const areas = [];
  for (const ft of feats) {
    const p = ft && ft.properties;
    if (!p || typeof p.id !== "string" || !ft.geometry) continue;
    // cheap box test first: skip polygons whose bounding box misses the radius box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const polys = ft.geometry.type === "Polygon" ? [ft.geometry.coordinates] : ft.geometry.type === "MultiPolygon" ? ft.geometry.coordinates : [];
    for (const poly of polys) for (const c of (poly[0] || [])) { if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0]; if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1]; }
    if (maxX < point.lng - dLng || minX > point.lng + dLng || maxY < point.lat - dLat || minY > point.lat + dLat) continue;
    const d = distanceToGeometryMiles(point.lat, point.lng, ft.geometry);
    if (d !== null && d <= r) areas.push({ id: p.id, name: p.n || null, city: p.c || null, miles: Math.round(d * 100) / 100 });
  }
  areas.sort((a, b) => a.miles - b.miles || (a.id < b.id ? -1 : 1));
  return { ok: true, miles: r, areas };
}

/**
 * For one corridor record and one loaded county bundle: for each stop city whose county FIPS is this county, the block groups
 * within `miles` of the stop point. A stop in another county, or without a point, is not listed.
 */
function stopAreasForCounty(corridor, bundle, countyFips, miles) {
  const out = [];
  for (const s of (corridor && corridor.proposed_stations) || []) {
    if (!s || s.fips !== countyFips) continue;
    const res = blockGroupsWithin(bundle, { lat: s.lat, lng: s.lng }, miles);
    out.push({ stop: s, miles: res.miles, ok: res.ok, reason: res.reason || null, areas: res.areas });
  }
  return out;
}

const api = { distanceToGeometryMiles, blockGroupsWithin, stopAreasForCounty };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.CorridorStopAreas = api;
})();
