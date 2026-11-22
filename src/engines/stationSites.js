/**
 * Station-area redevelopment sites (browser global window.StationSites, and a CommonJS module for tests).
 *
 * Reads app/data/station_sites/index.json and one county file, app/data/station_sites/<fips>.json, only when that county
 * is opened. Each record is land near a station or stop-city point, found in OpenStreetMap (surface parking, vacant or
 * brownfield land, golf courses) and matched to the county's parcel record where a service is on file. Nothing here
 * estimates homes, value or margin. See docs/audit/station-sites-2026-11-22.md for how the files were made.
 *
 * API: load(fips) -> Promise<site[]>, cached(fips) -> site[] | null, normalize(doc), facts(site) -> [[label, text], ...],
 * loadPlaces(fips) -> Promise (adds site.place: census tract and ZIP area, from app/data/station_site_places/<fips>.json).
 * A site has the fields app/invest.js reads from underused_sites.json records (id, name, kind, acres, countyFips, sourceUrl,
 * verification) and no homes, value or margin field.
 */
(function (root) {
"use strict";
const BASE = "app/data/station_sites/";
const PLACES = "app/data/station_site_places/";
const PAGE_MAX = 150;   // the page lists the largest this many sites of a county; the file holds more
const KIND = { surface_parking: "Surface parking lot", vacant_or_brownfield: "Vacant or brownfield land", golf_course: "Golf course" };
const CLASS = { pipeline_station: "station of a local project on file", existing_station: "existing rail station", corridor_stop_city: "stop city centre, not a station site" };
const cache = {}, pending = {};
let indexP = null;

const osmUrl = id => "https://www.openstreetmap.org/" + id;
const m = v => Math.round(v).toLocaleString("en-US");

function normalize(doc) {
  if (!doc || !Array.isArray(doc.sites)) return [];
  const out = doc.sites.map(s => {
    const src = (doc.sources || [])[s.s] || {};
    const near = s.near || {};
    const p = s.p || null;
    const kind = KIND[s.k] || "Site";
    const label = near.c === "corridor_stop_city" ? near.n : near.n;
    const rec = {
      id: "ss:" + doc.fips + ":" + s.id, stationSite: true, kind: s.k, kindLabel: kind, countyFips: doc.fips,
      name: kind + " near " + label,
      acres: s.ac, sourceUrl: osmUrl(s.id),
      // the same fields the Invest view reads for a site; no homes, value-if-built or margin exist on these records
      verification: { status: p ? (p.mm ? "measured; parcel record found, larger or smaller than the map outline" : "measured; parcel record matched") : "measured from OpenStreetMap; no parcel record matched",
        audited: p ? p.d : (src.dataTimestamp || "").slice(0, 10), evidence_url: osmUrl(s.id), source_fields: ["acres", "location", "OpenStreetMap tags"], unverified_fields: [] },
      near, osm: { id: s.id, tag: s.tag, access: s.acc || null, name: s.nm || null, builtShare: s.bs, source: src }, parcel: p, parcelWhy: s.pw || null, also: s.also || [],
      point: s.pt
    };
    if (near.c === "existing_station") { rec.nearestRailStation = near.n; rec.distanceToRailMeters = near.d; rec.railStationStatus = "existing"; }
    return rec;
  });
  out.sort((a, b) => b.acres - a.acres);
  out.total = doc.total; out.leftOut = doc.leftOut || 0; out.parcelService = doc.parcelService || null;
  return out;
}

function facts(s) {
  const rows = [], n = s.near || {}, o = s.osm || {}, p = s.parcel;
  rows.push(["Near", `${n.n} (${CLASS[n.c] || n.c}${n.ln ? "; " + n.ln : ""}), ${m(n.d)} m from the middle of the site${n.u ? ". The project's own record marks this stop location as unverified" : ""}`]);
  if (s.also && s.also.length) rows.push(["Also within range", s.also.join("; ")]);
  rows.push(["From OpenStreetMap", `${o.id}, tagged ${o.tag}${o.access ? "; access=" + o.access : ""}. Area measured from the outline: ${s.acres} acres; buildings cover ${Math.round((o.builtShare || 0) * 100)}% of it. Data dated ${(o.source.dataTimestamp || "").slice(0, 10) || "not stated"} (${o.source.source || ""})`]);
  if (!p) { rows.push(["County parcel record", "Not on file: " + (s.parcelWhy || "no parcel record was matched")]); if (s.zoning) rows.push(zoningFact(s.zoning)); }
  else {
    rows.push(["County parcel record", `${p.id ? "parcel " + p.id : "parcel id not given by the service"}; parcel area ${p.pa != null ? p.pa + " acres" : "not given"}${p.r != null ? " (" + p.r + " times the outline)" : ""}; retrieved ${p.d}`]);
    rows.push(["Land use on the record", p.ut || p.uc ? [p.ut, p.uc ? "code " + p.uc : null].filter(Boolean).join(", ") : "Not on file: the service gives no use field, or it was blank"]);
    const own = p.ot ? (p.own ? p.own + " (" + p.ot + ")" : p.ot + (/name not stored/.test(p.ot) ? "" : " (name not shown)")) : null;
    rows.push(["Owner on the record", own || p.oc ? [own, p.oc ? "the service's own owner-type code: " + p.oc : null].filter(Boolean).join("; ") : "Not on file: the service gives no owner field, or it was blank"]);
    rows.push(["Zoning code on the record", p.zn || "Not on file: the service gives no zoning field, or it was blank"]);
    if (s.zoning) rows.push(zoningFact(s.zoning));
    rows.push(["Assessed land value", p.lv != null ? "$" + m(p.lv) + " (the county's figure for the parcel)" : p.mm ? "Withheld: the parcel is " + p.r + " times the outline's area, so the value is for the whole parcel" : "Not on file: the service gives no land value field, or it was blank"]);
  }
  return rows;
}

// One fact row for the site's zoning: the zone, where it was read, who zones the site, and the code-table category.
function zoningFact(z) {
  const who = z.name ? "zoned by " + z.name : null;
  if (!z.zone) return ["Zoning", "Not on file: " + [z.why || "no zone code was found for this site", who].filter(Boolean).join("; ")];
  // host names only in running text (a bare URL is one long word that overflows a phone screen); the full URLs are in
  // the site file and the card's sources
  const how = z.how && z.how.kind === "point" ? `the city's zoning map asked at the site's point (${hostOf(z.how.url)}, ${z.how.asked})` : "the county parcel record's zoning field";
  const cat = z.row ? (z.row.notDetermined ? "rules not determined: " + z.row.notDetermined : "category " + (z.row.category || "not determined") + (z.row.categoryBasis ? " (" + z.row.categoryBasis + ")" : "")) : "code rules not on file: " + (z.tableWhy || "no code table");
  return ["Zoning", `${z.zone}${z.overlay && z.overlay.length ? " with commercial overlay " + z.overlay.join(", ") : ""}, from ${how}; ${who ? who + "; " : ""}${cat}`];
}

function loadIndex() {
  if (!indexP) indexP = fetch(BASE + "index.json").then(r => r.ok ? r.json() : null).catch(() => null);
  return indexP;
}
function load(fips) {
  if (!fips || typeof fetch !== "function") return Promise.resolve([]);
  if (cache[fips]) return Promise.resolve(cache[fips]);
  if (!pending[fips]) pending[fips] = loadIndex().then(ix => {
    if (!ix || !ix.counties || !ix.counties[fips]) { cache[fips] = []; return cache[fips]; }
    return fetch(BASE + ix.counties[fips].file).then(r => r.ok ? r.json() : null).then(d => (cache[fips] = normalize(d))).catch(() => (cache[fips] = []));
  });
  return pending[fips];
}
const cached = fips => cache[fips] || null;

// Census tract and ZIP area of each site (app/data/station_site_places/<fips>.json, pipeline/site_places_build.py):
// [tract GEOID, metres to the tract's edge, ZCTA, metres to the ZCTA's edge, how the ZCTA was read]. Attached as
// site.place for the project card's place rows (HUD QCT / DDA, rent ceilings, permit cost). A site with no row keeps none.
function placeOf(row) {
  if (!Array.isArray(row)) return null;
  return { tract: row[0] || null, tractEdgeM: typeof row[1] === "number" ? row[1] : null, zcta: row[2] || null, zctaEdgeM: typeof row[3] === "number" ? row[3] : null, zctaHow: row[4] || null };
}
function attachPlaces(list, doc) {
  const by = doc && doc.sites ? doc.sites : null;
  if (!by || !Array.isArray(list)) return list;
  for (const s of list) { const p = placeOf(by[s.osm && s.osm.id]); if (p) s.place = p; }
  return list;
}
const placesP = {};
function loadPlaces(fips) {
  if (!fips || typeof fetch !== "function") return Promise.resolve(null);
  if (!placesP[fips]) placesP[fips] = fetch(PLACES + fips + ".json").then(r => r.ok ? r.json() : null).catch(() => null);
  return Promise.all([placesP[fips], load(fips)]).then(([doc, list]) => { attachPlaces(list, doc); return doc; });
}

// Zoning of each site (app/data/site_zoning/, pipeline/site_zoning_build.py, docs/audit/site-zoning-2026-11-23.md):
// the government that zones the site, the zone code (the city's zoning map asked at the site's point, or the county
// parcel record) and, where the city's code text was fetched, the code-table row with its quotes. Attached as
// site.zoning; site.baseZoning, site.zoningCategory, site.cityName and site.zoningLimits are what the card engine reads.
const ZBASE = "app/data/site_zoning/";
// the code table's categories, in the words the page's parcel facts test (/commercial/ marks commercial or mixed use)
const CAT_WORDS = { "single-family": "single-family", multifamily: "multifamily", commercial: "commercial", "mixed-use": "commercial / mixed use", industrial: "industrial", "public/open space": "open space / public", "planned/special": "planned or special district" };
const hostOf = u => { const m = String(u || "").match(/^https?:\/\/([^/]+)/); return m ? m[1] : String(u || ""); };
const shortName = n => String(n || "").replace(/ \(balance\)$/, "").replace(/ (city|town|village|metropolitan government)$/, "").replace(/^Nashville-Davidson$/, "Nashville");
// The card engine's view of one code row: only what the row states, each with its source; nothing filled in.
// A code table stores a quote used by several rows once, in table.quotes, and the rows point at it as { ref: id }.
function resolveRefs(x, quotes) {
  if (Array.isArray(x)) return x.map(v => resolveRefs(v, quotes));
  if (!x || typeof x !== "object") return x;
  if (typeof x.ref === "string" && Object.keys(x).length === 1) return quotes && quotes[x.ref] ? resolveRefs(quotes[x.ref], quotes) : null;
  const o = {};
  for (const k of Object.keys(x)) o[k] = resolveRefs(x[k], quotes);
  return o;
}
function limitsOf(row, table, zone, how) {
  if (!row) return null;
  row = resolveRefs(row, table && table.quotes);
  const nd = row.notDetermined || null;
  const h = row.housing || {}, d = row.density || {}, f = row.far || null, ht = row.height || null;
  const quoteOf = x => x && x.quote ? { section: x.section || null, quote: x.quote, url: x.url || null, fetched: x.fetched || null } : null;
  const out = { zone, city: table.city, code: table.code, category: row.category || null, categoryBasis: row.categoryBasis || null, categorySource: row.categorySource || null, notDetermined: nd, notDeterminedSource: nd ? quoteOf(row.quote) : null,
    housing: nd ? null : (h.permitted === true || h.permitted === false ? h.permitted : null), housingWhy: nd || h.why || h.note || null, housingSource: quoteOf(h),
    density: null, densityWhy: nd || d.why || null, far: null, farWhy: null, heightFt: null, cautions: (row.cautions || []).map(c => ({ text: c.text, quote: c.quote, section: c.section, url: c.url })), zoneSource: how || null };
  if (!nd && d.method === "lot_area_per_home" && typeof d.sqftPerHome === "number") out.density = { method: d.method, sqftPerHome: d.sqftPerHome, duPerAcre: d.duPerAcre, roundUpFrom: d.roundUpFrom, formula: d.formula, source: quoteOf(d.rule), rounding: quoteOf(d.rounding) };
  if (!nd && d.method === "floor_area_over_factor" && typeof d.duFactor === "number" && f && typeof f.low === "number") out.density = { method: d.method, duFactor: d.duFactor, farLow: f.low, farHigh: f.high, roundUpFrom: d.roundUpFrom, duPerAcre: d.duPerAcre, formula: d.formula, source: quoteOf(d.factor), rule: quoteOf(d.rule), farSource: { section: f.section, url: f.url, rows: f.rows, note: f.note } };
  if (!nd && f && typeof f.low === "number") out.far = { low: f.low, high: f.high, section: f.section || null, url: f.url || null, quote: f.quote || (f.rows || []).join("; ") || null, note: f.note || null };
  if (!nd && ht && Array.isArray(ht.maxFt)) out.heightFt = { low: ht.maxFt[0], high: ht.maxFt[1], section: ht.section, url: ht.url, quote: ht.quote };
  out.parkingWhy = (row.parking && row.parking.why) || "parking minimums were not read for this code";
  return out;
}
function attachZoning(list, doc, tables, index) {
  if (!doc || !doc.sites || !Array.isArray(list)) return list;
  const names = (doc.places || {});
  for (const s of list) {
    const r = doc.sites[s.osm && s.osm.id];
    if (!Array.isArray(r)) continue;
    const [juris, zone, si, key] = r;
    const extra = r.slice(3).filter(x => x && typeof x === "object");
    const how = doc.sources && doc.sources[si] ? doc.sources[si] : null;
    const city = index && index.cities ? index.cities[juris] : null, T = city && tables ? tables[city.key] : null;
    const row = T && zone ? resolveRefs(T.codes[typeof key === "string" ? key : zone] || null, T.quotes) : null;
    const z = { juris, name: names[juris] || (city && city.name) || null, zone: zone || null, how, why: (extra.find(x => x.why) || {}).why || null, overlay: (extra.find(x => x.overlay) || {}).overlay || null,
      table: city ? city.table : null, tableWhy: (!T || T.notOnFile) && index && index.notOnFile && index.notOnFile[juris] ? "the city's code text could not be fetched" : !T ? "no code table for this jurisdiction was built in this job" : zone && !row ? `the code table for ${city.name} has no row for ${zone}` : null, row };
    s.zoning = z;
    if (zone) s.baseZoning = zone;
    if (z.name) s.cityName = shortName(z.name);
    if (row) { s.zoningCategory = CAT_WORDS[row.category] || null; s.zoningLimits = limitsOf(row, T, zone, how); }
    // a zone with no code row: the card says why its rules are not determined, rather than "not classed as multifamily"
    else if (zone) s.zoningLimits = { zone, city: z.name ? shortName(z.name) : null, category: null, notDetermined: (z.tableWhy || "no code table") + (index && index.notOnFile && index.notOnFile[juris] ? " (" + hostOf(index.notOnFile[juris].tried[0].url) + ": " + index.notOnFile[juris].tried[0].result + ")" : ""), notDeterminedSource: index && index.notOnFile && index.notOnFile[juris] ? { url: index.notOnFile[juris].tried[0].url } : null, cautions: [], zoneSource: how };
  }
  return list;
}
let zIndexP = null;
const zTables = {}, zCounty = {};
function loadZoning(fips) {
  if (!fips || typeof fetch !== "function") return Promise.resolve(null);
  const j = u => fetch(ZBASE + u).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!zIndexP) zIndexP = j("index.json");
  return zIndexP.then(ix => {
    if (!ix || !(ix.counties || []).includes(fips)) return null;
    if (!zCounty[fips]) zCounty[fips] = j(fips + ".json");
    return zCounty[fips].then(doc => {
      const keys = [...new Set(Object.values((doc && doc.sites) || {}).map(r => ix.cities[r[0]]).filter(Boolean).map(c => c.key))];
      for (const k of keys) if (!zTables[k]) zTables[k] = j("codes/" + k + ".json");
      return Promise.all([load(fips), Promise.all(keys.map(k => zTables[k].then(t => [k, t])))]).then(([list, ts]) => { attachZoning(list, doc, Object.fromEntries(ts.filter(x => x[1])), ix); return doc; });
    });
  });
}

const api = { load, cached, normalize, facts, loadPlaces, attachPlaces, placeOf, loadZoning, attachZoning, limitsOf, resolveRefs, shortName, KIND, CLASS, PAGE_MAX };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.StationSites = api;
})(typeof window !== "undefined" ? window : this);
