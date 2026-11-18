/**
 * Build app/data/underused_sites.json from sources (no typed attributes).
 *
 *  - Los Angeles County (06037): candidate sites come from the LA bundle (app/data/bundle-la.b64.txt:
 *    `under.sites` + the outlines in `layers.underused`). Candidates are ranked by ACRES (a measured
 *    value, not by the bundle's modelled margin). Each candidate is then checked against the live
 *    LA County assessor parcel service (AIN, acres, roll land value, use code) and kept only if the
 *    live parcel agrees with the claimed kind.
 *  - Other counties: scripts/underused_site_seeds.json lists county FIPS + OpenStreetMap object id +
 *    kind. Geometry/acres/name come from Nominatim, block group + place from the Census geocoder,
 *    parcel owner/value/zoning from the county's open ArcGIS parcel service, rail distance from the
 *    county bundle's station layer.
 *  - potentialHomes / margin / idea / marketLandValue are NOT facts: they are produced by
 *    src/engines/underusedLandEngine.js (computeScreeningEstimate) and stored under
 *    `screening_estimate`. The old top-level names are kept as null for back-compat.
 *
 * Usage: node scripts/build_underused_sites.mjs [--no-write]   (needs network)
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const engine = require(path.join(rootDir, "src/engines/underusedLandEngine.js"));
const seedFile = JSON.parse(fs.readFileSync(path.join(rootDir, "scripts/underused_site_seeds.json"), "utf8"));
const CHECKED = process.env.SITES_CHECKED_DATE || new Date().toISOString().slice(0, 10);
const UA = { "User-Agent": "citypretty-sites-build/1.0 (open-data verification script)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LA_PARCEL = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const CENSUS_GEO = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

async function getJson(url, init = {}, tries = 3) {
  let last;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: UA, ...init });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; await sleep(800 * (t + 1)); }
  }
  throw new Error(`${url.slice(0, 120)}: ${last && last.message}`);
}

// ---------------------------------------------------------------- geometry helpers
const M2_PER_ACRE = 4046.856;
function ringAreaM2(r) { // r = [[lng,lat],...]
  const lat0 = r.reduce((a, b) => a + b[1], 0) / r.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  let a = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * kx * (q[1] * ky) - q[0] * kx * (p[1] * ky); }
  return Math.abs(a / 2);
}
function polysOf(g) { return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []; }
function acresOf(polys) {
  let m2 = 0;
  for (const p of polys) { m2 += ringAreaM2(p[0]); for (const h of p.slice(1)) m2 -= ringAreaM2(h); }
  return m2 / M2_PER_ACRE;
}
function inRing(pt, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i][1] > pt[1] !== r[j][1] > pt[1] && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  }
  return c;
}
function inPoly(pt, p) { return inRing(pt, p[0]) && !p.slice(1).some(h => inRing(pt, h)); }
/** A point inside the largest polygon: centroid of its outer ring if inside, else a bbox grid scan. */
function interiorPoint(polys) {
  const big = polys.slice().sort((a, b) => ringAreaM2(b[0]) - ringAreaM2(a[0]))[0];
  const r = big[0];
  const c = [r.reduce((a, b) => a + b[0], 0) / r.length, r.reduce((a, b) => a + b[1], 0) / r.length];
  if (inPoly(c, big)) return c;
  const xs = r.map(p => p[0]), ys = r.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let n = 3; n <= 41; n += 2) for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) {
    const p = [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * j) / n];
    if (inPoly(p, big)) return p;
  }
  return r[0];
}
function haversineM(a, b) {
  const R = 6371008.8, rad = x => (x * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function decodeLine(str) { // same polyline format app/app.js decodeLine() reads; returns [[lat,lng],...]
  const pts = []; let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) { let b, sh = 0, r = 0; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); const d = r & 1 ? ~(r >> 1) : r >> 1; if (k === 0) lat += d; else lon += d; }
    pts.push([lat / 1e5, lon / 1e5]);
  }
  return pts;
}

// ---------------------------------------------------------------- shared lookups
const bgCache = new Map();
async function censusGeo(lng, lat) {
  const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  if (bgCache.has(key)) return bgCache.get(key);
  const url = `${CENSUS_GEO}?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  let out = { geoid: null, place: null, url };
  try {
    const j = await getJson(url);
    const g = (j.result && j.result.geographies) || {};
    const blk = (g["2020 Census Blocks"] || [])[0];
    const bg = (g["Census Block Groups"] || [])[0] || (blk ? { GEOID: String(blk.GEOID).slice(0, 12) } : null);
    const pl = (g["Incorporated Places"] || [])[0] || (g["Census Designated Places"] || [])[0];
    out = { geoid: bg ? bg.GEOID : null, place: pl ? pl.BASENAME : null, url };
  } catch (e) { out.error = String(e.message || e); }
  bgCache.set(key, out);
  return out;
}

async function arcgisPoint(layerUrl, lng, lat, outFields, extra = {}) {
  const p = new URLSearchParams({ f: "json", geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields, returnGeometry: "false", ...extra });
  const j = await getJson(`${layerUrl}/query`, { method: "POST", body: p });
  if (j.error) throw new Error(`${layerUrl}: ${j.error.message}`);
  return { feats: (j.features || []).map(f => f.attributes), url: `${layerUrl}/query?${p.toString()}` };
}

/** Per-county parcel + zoning services. Fields were read from each layer's own metadata. */
const COUNTY = {
  "04013": {
    parcel: { url: "https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0", fields: "APN_DASH,OWNER_NAME,PHYSICAL_ADDRESS,LAND_SIZE,FCV_CUR,TAX_YR_CUR,PUC,CITY_ZONING,JURISDICTION",
      map: a => ({ parcelId: a.APN_DASH, owner: a.OWNER_NAME, address: a.PHYSICAL_ADDRESS, landSqft: a.LAND_SIZE, fullCashValueTotal: a.FCV_CUR, valueYear: a.TAX_YR_CUR, useCode: a.PUC, zoning: a.CITY_ZONING, jurisdiction: a.JURISDICTION }) },
    zoning: { url: "https://services1.arcgis.com/MdyCMZnX1raZ7TS3/arcgis/rest/services/EXLU_2026/FeatureServer/0", field: "LONG_DISPLAY_NAME" },
    bundle: "counties/bundle_04013.json.gz",
  },
  "48453": {
    parcel: null, // TCAD_public MapServer lists "layers": [] on 2026-11-18, so no parcel query is possible
    zoning: { url: "https://maps.austintexas.gov/gis/rest/Shared/Zoning_1/MapServer/0", field: "ZONING_ZTYPE" },
    bundle: "counties/bundle_48453.json.gz",
  },
  "53033": {
    parcel: { url: "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2", fields: "PIN,ADDR_FULL,PROP_NAME,LOTSQFT,KCA_ACRES,APPRLNDVAL,APPR_IMPR,KCA_ZONING,PREUSE_DESC,PROPTYPE",
      map: a => ({ parcelId: a.PIN, owner: null, address: a.ADDR_FULL, landSqft: a.LOTSQFT, acres: a.KCA_ACRES, assessedLandValue: a.APPRLNDVAL, assessedImprovementValue: a.APPR_IMPR, zoning: a.KCA_ZONING, useDesc: a.PREUSE_DESC, propName: a.PROP_NAME }) },
    zoning: null,
    bundle: "counties/bundle_53033.json.gz",
  },
};

function nearestStation(bundle, pt) {
  let best = null;
  const open = (bundle.layers && bundle.layers.stations && bundle.layers.stations.features) || [];
  for (const f of open) {
    const d = haversineM(pt, f.geometry.coordinates);
    if (!best || d < best.d) best = { d, name: f.properties.n, status: "open" };
  }
  for (const s of (bundle.layers && bundle.layers.stations_con) || []) { // [name, lat, lng]
    const d = haversineM(pt, [s[2], s[1]]);
    if (!best || d < best.d) best = { d, name: s[0], status: "coming" };
  }
  return best ? { meters: Math.round(best.d), station: best.name, status: best.status } : null;
}

function finish(rec) {
  const est = engine.computeScreeningEstimate(rec);
  rec.screening_estimate = est;
  return rec;
}

// ---------------------------------------------------------------- non-LA sites (OSM id seeds)
async function buildSeedSite(seed) {
  const cfg = COUNTY[seed.countyFips];
  if (!cfg) throw new Error(`no county config for ${seed.countyFips}`);
  const lookupUrl = `${NOMINATIM}/lookup?format=jsonv2&polygon_geojson=1&extratags=1&osm_ids=${seed.osm}`;
  const j = await getJson(lookupUrl);
  await sleep(1100);
  const o = j[0];
  if (!o) return { dropped: { id: seed.id, reason: `OSM object ${seed.osm} not found`, evidence_url: lookupUrl } };
  const tags = o.extratags || {};
  const isGolf = o.type === "golf_course";
  const isSurfaceLot = o.type === "parking" && (tags.parking === "surface" || tags.parking == null);
  if ((seed.kind === "golf course" && !isGolf) || (seed.kind === "parking lot" && !isSurfaceLot)) {
    return { dropped: { id: seed.id, reason: `OSM ${seed.osm} is ${o.category}=${o.type} parking=${tags.parking || "-"}, not a ${seed.kind}`, evidence_url: lookupUrl } };
  }
  const polys = polysOf(o.geojson);
  const acres = Math.round(acresOf(polys) * 100) / 100;
  const pt = interiorPoint(polys);
  const geo = await censusGeo(pt[0], pt[1]);
  const bundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(rootDir, cfg.bundle))));
  const rail = nearestStation(bundle, pt);
  const bgFeat = (bundle.features || []).find(f => f.properties && f.properties.id === geo.geoid);
  const hv = bgFeat && typeof bgFeat.properties.hv === "number" ? bgFeat.properties.hv : null;

  let parcel = null, parcelUrl = null, parcelErr = null;
  if (cfg.parcel) {
    try { const r = await arcgisPoint(cfg.parcel.url, pt[0], pt[1], cfg.parcel.fields); parcelUrl = r.url; parcel = r.feats[0] ? cfg.parcel.map(r.feats[0]) : null; } catch (e) { parcelErr = String(e.message || e); }
  }
  let zoningCode = parcel && parcel.zoning && !/^contact local jurisdiction$/i.test(String(parcel.zoning).trim()) ? String(parcel.zoning).trim() : null, zoningUrl = null;
  if (!zoningCode && cfg.zoning) {
    try { const r = await arcgisPoint(cfg.zoning.url, pt[0], pt[1], cfg.zoning.field); zoningUrl = r.url; zoningCode = r.feats[0] && r.feats[0][cfg.zoning.field] ? String(r.feats[0][cfg.zoning.field]) : null; } catch (e) { /* leave null */ }
  }
  if (parcel && typeof parcel.fullCashValueTotal === "string") { const v = Number(parcel.fullCashValueTotal.replace(/[^0-9.]/g, "")); parcel.fullCashValueTotal = Number.isFinite(v) && parcel.fullCashValueTotal.trim() ? v : null; }
  if (zoningCode && /^contact local jurisdiction$/i.test(zoningCode.trim())) zoningCode = null; // placeholder text, not a zone
  const lav = parcel && typeof parcel.assessedLandValue === "number" && parcel.assessedLandValue > 0 ? parcel.assessedLandValue : null;
  const owner = parcel && parcel.owner ? String(parcel.owner).trim() : null;

  const rec = {
    id: seed.id,
    name: o.name || null,
    address: parcel && parcel.address ? String(parcel.address).trim() : null,
    kind: seed.kind,
    acres,
    countyFips: seed.countyFips,
    blockGroupId: geo.geoid,
    cityName: geo.place,
    neighborhoodName: null,
    lat: Math.round(pt[1] * 1e6) / 1e6,
    lng: Math.round(pt[0] * 1e6) / 1e6,
    assessedLandValue: lav,
    marketLandValue: null,
    prop13BaseYear: null,
    baseZoning: zoningCode,
    zoningCategory: null,
    distanceToRailMeters: rail ? rail.meters : null,
    nearestRailStation: rail ? rail.station : null,
    railStationStatus: rail ? rail.status : null,
    publicOwner: null,
    ownerName: owner,
    inConservationEasement: false,
    isHousingElementSite: false,
    alreadyBuilt: false,
    neighborhoodMedianHv: hv,
    potentialHomes: null,
    margin: null,
    idea: null,
    sourceUrl: lookupUrl,
    lastVerified: CHECKED,
  };
  if (parcel) rec.parcel = parcel;
  finish(rec);
  const measured = ["name", "kind", "acres", "lat", "lng", "blockGroupId", "cityName"];
  const fromBundle = [];
  if (rec.distanceToRailMeters != null) fromBundle.push("distanceToRailMeters", "nearestRailStation", "railStationStatus");
  if (hv != null) fromBundle.push("neighborhoodMedianHv");
  if (parcel) measured.push("address", "parcel");
  if (lav != null) measured.push("assessedLandValue");
  if (zoningCode) measured.push("baseZoning");
  if (owner) measured.push("ownerName");
  const nulls = ["marketLandValue", "prop13BaseYear", "zoningCategory", "publicOwner", "neighborhoodName", "potentialHomes", "margin", "idea"];
  for (const k of ["assessedLandValue", "baseZoning", "address", "neighborhoodMedianHv", "distanceToRailMeters", "blockGroupId", "name"]) if (rec[k] == null) nulls.push(k);
  rec.verification = {
    status: parcel || !cfg.parcel ? "measured" : "measured_partial",
    checked: CHECKED,
    evidence_url: lookupUrl,
    fields_measured: measured,
    fields_from_bundle: fromBundle,
    fields_null: [...new Set(nulls)],
    evidence: {
      osm: { object: seed.osm, category: o.category, type: o.type, tags, note: "acres measured from the OSM polygon (equirectangular area)" },
      census_geocoder_url: geo.url,
      parcel_query_url: parcelUrl,
      zoning_query_url: zoningUrl,
      parcel_error: parcelErr || (cfg.parcel ? null : "county parcel service has no queryable layer"),
      rail: "nearest station in the county bundle (counties/bundle_" + seed.countyFips + ".json.gz layers.stations / stations_con), straight-line distance",
      neighborhoodMedianHv: "county bundle block-group hv (ACS 2020-24 B25077 per the bundle's own metadata; the Census API needs a key so it was not re-fetched; may be a tract median where the block group is suppressed)",
    },
    typed_claim_replaced: seed.typed_claim_replaced || null,
    notes: "owner/public status is the parcel owner string as published; publicOwner is left null because ownership type is not classified here.",
  };
  return { rec };
}

// ---------------------------------------------------------------- LA sites (bundle + live parcel service)
function loadLaBundle() {
  const b64 = fs.readFileSync(path.join(rootDir, "app/data/bundle-la.b64.txt"), "utf8").trim();
  return JSON.parse(zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8"));
}
const KIND_RULES = {
  "golf course": (s, p) => /golf/i.test(p.UseDescription || ""),
  "parking lot": (s, p) => /parking lots/i.test(p.UseDescription || ""),
  vacant: (s, p) => /V$/.test(p.UseCode || ""),
  "lightly built commercial": (s, p) => !/V$/.test(p.UseCode || "") && (p.Roll_ImpValue == null || p.Roll_LandValue == null || p.Roll_ImpValue <= 3 * p.Roll_LandValue),
};

async function liveParcels(rings) {
  const body = new URLSearchParams({
    f: "json", geometry: JSON.stringify({ rings: rings.map(r => [...r, r[0]]), spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPolygon", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", returnGeometry: "false",
    outFields: "AIN,APN,SitusFullAddress,SitusCity,UseCode,UseDescription,Roll_Year,Roll_LandValue,Roll_ImpValue,Roll_LandBaseYear,Shape.STArea()",
  });
  const j = await getJson(`${LA_PARCEL}/query`, { method: "POST", body });
  if (j.error) throw new Error(j.error.message);
  return (j.features || []).map(f => ({ ...f.attributes, acres: f.attributes["Shape.STArea()"] / 43560 }));
}

async function buildLa(D) {
  const bgMap = new Map();
  for (const f of (D.bgs && D.bgs.features) || []) { const p = f.properties || {}; bgMap.set(p.id, { neighborhood: p.n || null, city: p.c || null, hv: p.hv || null }); }
  const geo = new Map();
  const U = D.layers.underused;
  for (const k in U.cells) for (const [id, rings] of U.cells[k]) { if (!geo.has(id)) geo.set(id, []); geo.get(id).push(rings.map(decodeLine)); }
  const stationsOpen = D.layers.stations.features.map(f => ({ n: f.properties.n, p: f.geometry.coordinates, status: "open" }));
  const stationsCon = (D.layers.stations_con || []).map(s => ({ n: s[0], p: [s[2], s[1]], status: "coming" }));
  const allStations = [...stationsOpen, ...stationsCon];

  const all = Object.values(D.under.sites);
  const cand = {
    "golf course": all.filter(s => s.k === "golf course" && !s.bs && !s.ease && s.ac >= 5),
    "parking lot": all.filter(s => s.k === "parking lot" && !s.bs && s.rail != null && s.rail <= 805 && s.ac >= 0.5),
    vacant: all.filter(s => s.k === "vacant" && !s.bs && s.ac >= 0.5),
    "lightly built commercial": all.filter(s => s.k === "lightly built commercial" && !s.bs && !s.ease && s.rail != null && s.rail <= 805 && s.ac >= 1.0),
  };
  const out = [], dropped = [], usedAin = new Set();
  let n = 0;
  for (const kind of Object.keys(cand)) {
    const quota = seedFile.la.quota[kind];
    const list = cand[kind].slice().sort((a, b) => b.ac - a.ac);
    let kept = 0;
    for (const s of list) {
      if (kept >= quota) break;
      const g = geo.get(s.i);
      if (!g) { dropped.push({ bundleIndex: s.i, kind, reason: "no outline in bundle" }); continue; }
      // each encoded ring in the bundle is a separate part (the pipeline's own acres sum them), not a hole
      const rings = g.flatMap(parts => parts.map(r => r.map(([la, lo]) => [lo, la])));
      const polys = rings.map(r => [r]);
      const geomAcres = acresOf(polys);
      const pt = interiorPoint(polys);
      let feats;
      try { feats = await liveParcels(rings); } catch (e) { dropped.push({ bundleIndex: s.i, kind, reason: "live query failed: " + e.message }); continue; }
      const isOsmLot = /OpenStreetMap/i.test(s.use || "");
      let match = null, matchKind = null;
      const byArea = feats.slice().sort((a, b) => Math.abs(a.acres - geomAcres) - Math.abs(b.acres - geomAcres));
      const close = byArea[0] && Math.abs(byArea[0].acres - geomAcres) / geomAcres <= 0.1 ? byArea[0] : null;
      if (close && KIND_RULES[kind](s, close) && !usedAin.has(close.AIN)) { match = close; matchKind = "parcel"; }
      else if (kind === "parking lot" && isOsmLot) {
        // an OSM-mapped lot sits inside a larger parcel: take the live parcel under its interior point
        try {
          const r = await arcgisPoint(LA_PARCEL, pt[0], pt[1], "AIN,APN,SitusFullAddress,SitusCity,UseCode,UseDescription,Roll_Year,Roll_LandValue,Roll_ImpValue,Roll_LandBaseYear,Shape.STArea()");
          const a = r.feats[0];
          if (a && a.AIN && !usedAin.has(a.AIN) && a["Shape.STArea()"] / 43560 >= geomAcres * 0.9) { match = { ...a, acres: a["Shape.STArea()"] / 43560 }; matchKind = "contained"; }
        } catch (e) { /* no match */ }
      }
      if (!match) { dropped.push({ bundleIndex: s.i, kind, acres: s.ac, reason: "no live parcel confirms the claimed kind (best live parcel: " + (byArea[0] ? `${byArea[0].UseDescription}, ${byArea[0].acres.toFixed(2)} ac` : "none") + ")" }); continue; }
      usedAin.add(match.AIN);
      const siteAcres = matchKind === "parcel" ? Math.round(match.acres * 100) / 100 : Math.round(geomAcres * 100) / 100;
      const roll = match.Roll_Year;
      const lav = matchKind === "parcel" && typeof match.Roll_LandValue === "number" && match.Roll_LandValue > 0 ? match.Roll_LandValue : null;
      const base = matchKind === "parcel" && match.Roll_LandBaseYear && match.Roll_LandBaseYear !== "0000" ? +match.Roll_LandBaseYear : null;
      // rail: nearest station in the bundle's station layers, straight line from the interior point
      let best = null;
      for (const st of allStations) { const d = haversineM(pt, st.p); if (!best || d < best.d) best = { d, n: st.n, status: st.status }; }
      const cg = await censusGeo(pt[0], pt[1]);
      const bundleGid = s.gid;
      const gid = cg.geoid || bundleGid;
      const bg = bgMap.get(gid) || bgMap.get(bundleGid) || {};
      n++;
      const rec = {
        id: `site_la_${n}_${s.i}`,
        name: s.nm || null,
        address: match.SitusFullAddress && match.SitusFullAddress.trim() ? match.SitusFullAddress.trim() : null,
        kind,
        acres: siteAcres,
        countyFips: "06037",
        blockGroupId: gid,
        cityName: bg.city || cg.place || null,
        neighborhoodName: bg.neighborhood || null,
        lat: Math.round(pt[1] * 1e6) / 1e6,
        lng: Math.round(pt[0] * 1e6) / 1e6,
        assessedLandValue: lav,
        marketLandValue: null,
        prop13BaseYear: base,
        baseZoning: s.z || null,
        zoningCategory: s.zc || null,
        distanceToRailMeters: best ? Math.round(best.d) : null,
        nearestRailStation: best ? best.n : null,
        railStationStatus: best ? best.status : null,
        publicOwner: s.own || null,
        inConservationEasement: !!s.ease,
        isHousingElementSite: s.he != null,
        alreadyBuilt: !!s.bs,
        neighborhoodMedianHv: bg.hv || null,
        potentialHomes: null,
        margin: null,
        idea: null,
        parcel: { ain: match.AIN, apn: match.APN, useCode: match.UseCode, useDescription: match.UseDescription, parcelAcres: Math.round(match.acres * 100) / 100, rollYear: roll, rollLandValue: match.Roll_LandValue ?? null, rollImprovementValue: match.Roll_ImpValue ?? null, match: matchKind },
        sourceUrl: `${LA_PARCEL}/query?where=AIN%3D%27${match.AIN}%27&outFields=*&f=json`,
        lastVerified: CHECKED,
      };
      finish(rec);
      const measured = ["kind", "acres", "lat", "lng", "parcel", "blockGroupId"];
      if (rec.address) measured.push("address");
      if (lav != null) measured.push("assessedLandValue");
      if (base != null) measured.push("prop13BaseYear");
      if (rec.distanceToRailMeters != null) measured.push("distanceToRailMeters", "nearestRailStation", "railStationStatus");
      const fromBundle = ["baseZoning", "zoningCategory", "publicOwner", "inConservationEasement", "isHousingElementSite", "alreadyBuilt", "cityName", "neighborhoodName", "neighborhoodMedianHv"].filter(k => rec[k] != null && rec[k] !== false);
      const nulls = ["marketLandValue", "potentialHomes", "margin", "idea"];
      for (const k of ["name", "address", "assessedLandValue", "prop13BaseYear", "baseZoning", "zoningCategory", "publicOwner", "neighborhoodMedianHv"]) if (rec[k] == null) nulls.push(k);
      rec.verification = {
        status: matchKind === "parcel" ? "measured" : "measured_partial",
        checked: CHECKED,
        evidence_url: rec.sourceUrl,
        fields_measured: measured,
        fields_from_bundle: fromBundle,
        fields_null: [...new Set(nulls)],
        evidence: {
          live_service: LA_PARCEL,
          parcel_match: matchKind === "parcel"
            ? `live parcel AIN ${match.AIN} (${match.UseDescription}, ${match.acres.toFixed(2)} ac) is within 10% of the bundle outline (${geomAcres.toFixed(2)} ac) and agrees with kind "${kind}"`
            : `lot outline from the bundle's OpenStreetMap extract (${geomAcres.toFixed(2)} ac) lies inside live parcel AIN ${match.AIN} (${match.UseDescription}, ${match.acres.toFixed(2)} ac); acres are the lot outline, assessed value is withheld because it belongs to the whole parcel`,
          census_geocoder_url: cg.url,
          bundle_block_group: bundleGid,
          block_group_agrees_with_bundle: cg.geoid ? cg.geoid === bundleGid : null,
          bundle_pipeline_values: { acres: s.ac, assessedLandValue: s.lav ?? null, baseYear: s.by ?? null, railMeters: s.rail ?? null },
          bundle: "app/data/bundle-la.b64.txt (built " + (D.meta && D.meta.built) + ")",
          notes: "baseZoning/zoningCategory/publicOwner/easement/housing-element flags are bundle pipeline outputs and were not re-checked against their original sources here.",
        },
      };
      out.push(rec);
      kept++;
      process.stdout.write(`${kind} ${kept}/${quota}  bundle#${s.i} -> AIN ${match.AIN} (${matchKind})\r`);
      await sleep(120);
    }
    console.log(`\n${kind}: kept ${kept}/${quota} after checking against the live parcel service`);
  }
  return { out, dropped };
}

// ---------------------------------------------------------------- main
const results = [];
const droppedAll = [];
console.log("LA: reading bundle and checking candidates against the live parcel service...");
const la = await buildLa(loadLaBundle());
results.push(...la.out);
droppedAll.push(...la.dropped.map(d => ({ county: "06037", ...d })));
for (const seed of seedFile.seeds) {
  console.log("seed", seed.id, seed.osm);
  const r = await buildSeedSite(seed);
  if (r.rec) results.push(r.rec); else droppedAll.push({ county: seed.countyFips, ...r.dropped });
}
for (const rm of seedFile.removed) droppedAll.push({ county: rm.countyFips, id: rm.id, reason: rm.reason, evidence_url: rm.evidence_url, previously_typed: true });
for (const r of results) { // keep the field lists consistent with the final values
  const v = r.verification;
  const dropMeasured = v.fields_measured.filter(k => r[k] == null);
  v.fields_measured = v.fields_measured.filter(k => r[k] != null);
  v.fields_from_bundle = v.fields_from_bundle.filter(k => r[k] != null);
  v.fields_null = [...new Set([...v.fields_null, ...dropMeasured])].filter(k => r[k] == null);
}
console.log(`kept ${results.length} sites; dropped ${droppedAll.length} candidates`);
if (process.argv.includes("--no-write")) process.exit(0);
fs.writeFileSync(path.join(rootDir, "app/data/underused_sites.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
const q = v => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const rows = [["id", "county_fips", "kind", "decision", "verification_status", "acres_measured", "acres_typed_or_bundle", "lat", "lng", "parcel_id", "evidence_url", "checked", "note"]];
for (const r of results) rows.push([r.id, r.countyFips, r.kind, "kept", r.verification.status, r.acres, (r.verification.typed_claim_replaced && r.verification.typed_claim_replaced.acres) ?? (r.verification.evidence.bundle_pipeline_values && r.verification.evidence.bundle_pipeline_values.acres) ?? "", r.lat, r.lng, r.parcel ? (r.parcel.ain || r.parcel.parcelId) : "", r.verification.evidence_url, CHECKED, r.verification.evidence.parcel_match || (r.verification.evidence.osm && "OSM " + r.verification.evidence.osm.object + " " + r.verification.evidence.osm.type) || ""]);
for (const d of droppedAll) rows.push([d.id || ("la_bundle_" + d.bundleIndex), d.county, d.kind || "", "dropped", "", "", d.acres ?? "", "", "", "", d.evidence_url || "", CHECKED, d.reason]);
fs.writeFileSync(path.join(rootDir, "research/sites_verification.csv"), rows.map(r => r.map(q).join(",")).join("\n") + "\n", "utf8");
console.log("wrote app/data/underused_sites.json");
