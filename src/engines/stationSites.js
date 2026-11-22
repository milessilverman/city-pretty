/**
 * Station-area redevelopment sites (browser global window.StationSites, and a CommonJS module for tests).
 *
 * Reads app/data/station_sites/index.json and one county file, app/data/station_sites/<fips>.json, only when that county
 * is opened. Each record is land near a station or stop-city point, found in OpenStreetMap (surface parking, vacant or
 * brownfield land, golf courses) and matched to the county's parcel record where a service is on file. Nothing here
 * estimates homes, value or margin. See docs/audit/station-sites-2026-11-22.md for how the files were made.
 *
 * API: load(fips) -> Promise<site[]>, cached(fips) -> site[] | null, normalize(doc), facts(site) -> [[label, text], ...].
 * A site has the fields app/invest.js reads from underused_sites.json records (id, name, kind, acres, countyFips, sourceUrl,
 * verification) and no homes, value or margin field.
 */
(function (root) {
"use strict";
const BASE = "app/data/station_sites/";
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
  if (!p) rows.push(["County parcel record", "Not on file: " + (s.parcelWhy || "no parcel record was matched")]);
  else {
    rows.push(["County parcel record", `${p.id ? "parcel " + p.id : "parcel id not given by the service"}; parcel area ${p.pa != null ? p.pa + " acres" : "not given"}${p.r != null ? " (" + p.r + " times the outline)" : ""}; retrieved ${p.d}`]);
    rows.push(["Land use on the record", p.ut || p.uc ? [p.ut, p.uc ? "code " + p.uc : null].filter(Boolean).join(", ") : "Not on file: the service gives no use field, or it was blank"]);
    const own = p.ot ? (p.own ? p.own + " (" + p.ot + ")" : p.ot + ", name not shown") : null;
    rows.push(["Owner on the record", own || p.oc ? [own, p.oc ? "the service's own owner-type code: " + p.oc : null].filter(Boolean).join("; ") : "Not on file: the service gives no owner field, or it was blank"]);
    rows.push(["Zoning code on the record", p.zn || "Not on file: the service gives no zoning field, or it was blank"]);
    rows.push(["Assessed land value", p.lv != null ? "$" + m(p.lv) + " (the county's figure for the parcel)" : p.mm ? "Withheld: the parcel is " + p.r + " times the outline's area, so the value is for the whole parcel" : "Not on file: the service gives no land value field, or it was blank"]);
  }
  return rows;
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

const api = { load, cached, normalize, facts, KIND, CLASS, PAGE_MAX };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.StationSites = api;
})(typeof window !== "undefined" ? window : this);
