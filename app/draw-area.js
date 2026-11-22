// Draw an area: a shape drawn on the map (a polygon, or a circle around a point) and what the data on file says is
// inside it. This file is the map control, the drawing and the panel; every figure comes from
// src/engines/areaAggregationEngine.js (block-group shares, apportioning, ranges) and, through it, from
// src/engines/investmentDecisionEngine.js (ideas, housing plays, the transit screen). No figure is computed here.
// Reads the globals app/app.js sets up (map, D, D_OC, SITES, activeBundle, activeFips, select, cpJson, esc, fmtN, ...).
// Rules and limits: docs/DRAW-AREA.md.
(() => {
"use strict";

const AE = () => window.AreaAggregationEngine;
const DE = () => window.InvestmentDecisionEngine;
const q = s => document.querySelector(s);
const h = s => String(s ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const isNum = v => typeof v === "number" && isFinite(v);
const n0 = v => Math.round(v).toLocaleString("en-US");
const money = v => (typeof fmt$ === "function") ? fmt$(v) : "$" + n0(v);
const fipsNow = () => (typeof activeFips === "function") ? String(activeFips()) : "06037";
const toast = m => { if (typeof showToast === "function") showToast(m); };
const RADII = [[0.25, "Quarter mile"], [0.5, "Half mile"], [1, "One mile"]];

const st = {
  mode: "idle",            // idle | polygon | circle
  corners: [],             // [lat, lng] while drawing a polygon
  radius: 0.5,
  spec: null, fips: null,  // the finished shape and the county it was drawn in
  result: null, seq: 0, ask: false,
  group: null, shapeLayer: null, handles: [], draft: null, band: null,
  down: null, applying: false, dataP: null, crash: {}, laCentroids: null,
  open: { here: true, build: true, land: true, transit: true },
};
// The link the page was opened with: app/app.js rewrites the hash when it selects its first block group, so read it now.
const LINK = (() => { const p = new URLSearchParams(String(location.hash || "").replace(/^#/, "")); return { area: p.get("area"), county: p.get("county"), bg: p.get("bg") }; })();

// ---------------------------------------------------------------- data the engine needs
function loadTables() {
  if (st.dataP) return st.dataP;
  const j = id => (typeof cpJson === "function" ? cpJson(id) : Promise.resolve(null)).catch(() => null);
  const get = f => fetch("app/data/" + f).then(r => (r.ok ? r.json() : null)).catch(() => null);
  st.dataP = Promise.all([j("intervention-verification"), j("statutes"), j("transit-cost-benchmarks"), j("transit-value-effects"), j("underused-sites"), j("transit-pipelines"),
    j("intercity-corridors"), get("building_costs.json"), get("housing_funding_rules.json"), get("hud_income_limits.json"), j("hud-fmr"), j("valuation-benchmarks"), j("county-valuation-models"),
    (typeof loadSites === "function" ? loadSites() : Promise.resolve(null)).catch(() => null)])
    .then(([ver, laws, cost, eff, under, pipes, corr, bc, fr, il, fmr, vb, vm]) => ({
      corridors: Array.isArray(corr) ? corr : [], effectRows: (eff && eff.rows) || [],
      // the tables the project card engine reads, loaded the way app/invest.js loads them
      card: { buildingCosts: (bc && bc.rows) || [], fundingRules: fr, incomeLimits: il, fmr, valuationBenchmarks: vb, valuationModels: vm && vm.counties ? vm : null },
      verification: ver && typeof ver === "object" && !Array.isArray(ver) ? ver : null,
      laws: Array.isArray(laws) ? laws : null,
      // field renaming and unit conversion only, the same shaping app/invest.js does for the engine
      costBenchmarks: ((cost && cost.rows) || []).filter(r => r && isNum(r.cost_per_mile_usd_millions)).map(r => ({ mode: r.mode, cost_per_mile: r.cost_per_mile_usd_millions * 1e6, year: r.dollar_year || null, source_url: r.source_url || null })),
      valueEffects: ((eff && eff.rows) || []).filter(r => r && isNum(r.effect_pct)).map(r => { const t = String(r.mode || "").toLowerCase(); return { mode: /light rail/.test(t) ? "light_rail" : /heavy rail|metro/.test(t) ? "heavy_rail" : /commuter/.test(t) ? "commuter_rail" : /bus rapid|brt/.test(t) ? "brt" : "all_rail", distance_band: r.distance_band, effect_pct: r.effect_pct, source_url: r.source_url || null }; }),
      underused: Array.isArray(under) ? under : [],
      pipelines: Array.isArray(pipes) ? pipes : [],
    }));
  return st.dataP;
}
function crashFor(fips) {
  if (fips in st.crash) return Promise.resolve(st.crash[fips]);
  return fetch(`app/data/crash_counts/${fips}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null).then(d => { st.crash[fips] = d || null; return st.crash[fips]; });
}
function bundleNow() {
  const B = (typeof activeBundle === "function") ? activeBundle() : null;
  const la = fipsNow() === "06037";
  const feats = la ? ((typeof D !== "undefined" && D && D.bgs && D.bgs.features) || []) : ((B && B.features) || []);
  return { B: la ? D : B, la, features: feats.filter(f => f && f.properties && String(f.properties.id).startsWith(fipsNow())) };
}
// LA's underused-land inventory: the records are in D.under.sites, their outlines in D.layers.underused (one list per grid cell).
function laSiteCentroids() {
  if (st.laCentroids) return st.laCentroids;
  const m = new Map(), U = D && D.layers && D.layers.underused;
  if (U && U.cells && typeof decodeLine === "function") for (const k in U.cells) for (const [sid, rings] of U.cells[k]) {
    if (m.has(sid) || !rings || !rings[0]) continue;
    const c = AE().ringCentroid(decodeLine(rings[0]).map(p => [p[1], p[0]]));
    if (isNum(c[0]) && isNum(c[1])) m.set(sid, c);
  }
  st.laCentroids = m;
  return m;
}
const MODEL_FIELDS = ["estimated market value of the land", "homes it could hold", "profit margin", "suggested use"];
function candidateSites(env, tables, fips) {
  if (env.la) {
    const cent = laSiteCentroids(), sites = (D.under && D.under.sites) || [];
    const audited = new Map();
    for (const u of tables.underused) { const m = /_(\d+)$/.exec(String(u.id || "")); if (m && u.countyFips === "06037") audited.set(+m[1], u); }
    const list = [];
    for (const s of sites) {
      const c = cent.get(s.i); if (!c) continue;
      const a = audited.get(s.i), match = a && a.blockGroupId === s.gid && Math.abs((a.acres || 0) - (s.ac || 0)) < 0.011 ? a : null;
      const osm = /OpenStreetMap/i.test(String(s.use || ""));
      list.push({ id: "la-" + s.i, siteIndex: s.i, kind: s.k, name: s.nm || null, address: s.ad || null, lon: c[0], lat: c[1], blockGroupId: s.gid, acres: s.ac, parcelRecord: true,
        zoningCode: s.z || null, zoningCategory: s.zc || null, publicOwner: s.own || null, assessedLandValue: isNum(s.lav) ? s.lav : null, assessedBaseYear: s.by || null,
        status: s.bs || null, housingElement: s.he, easement: !!s.ease, use: s.use || null,
        verification: match ? match.verification : null,
        verificationNote: match ? null : "Not one of the 90 records the data audit checked one by one (app/data/underused_sites.json). Same origin as those: the outline, acreage, use, zoning and assessed value come from the county's records as packaged in the county data file; the file's own estimates are not shown.",
        modelFields: MODEL_FIELDS,
        source: osm ? "Surface parking mapped in OpenStreetMap, as packaged in app/data/bundle-la.b64.txt (under.sites)" : "LA County Assessor roll and GIS layers, as packaged in app/data/bundle-la.b64.txt (under.sites); https://data.lacounty.gov/datasets/lacounty::assessor-parcels-data-2024" });
    }
    const ss = stationSiteCandidates(fips);
    return { sites: ss.concat(list), coverage: "Two lists are on file for Los Angeles County. (1) The county's underused-land inventory: surface parking lots, golf courses, vacant parcels and lightly built commercial lots; none of its records names a public owner. (2) " + (ss.length ? `${n0(ss.length)} sites near stations, measured from OpenStreetMap and matched to the county parcel record where one was found. The same lot can be in both lists.` : "The station-area sites file, which could not be loaded."),
      sitesSource: "the underused-land inventory in the Los Angeles County data file (app/data/bundle-la.b64.txt, under.sites)" };
  }
  const list = [];
  const S = (typeof SITES !== "undefined" && SITES && SITES.sites) || {};
  for (const gid in S) {
    if (!gid.startsWith(fips)) continue;
    (S[gid] || []).forEach((s, i) => {
      if (s.t !== "lot_park" || !Array.isArray(s.pt)) return;
      list.push({ id: `${gid}-lot-${i}`, kind: "parking lot", name: s.nmlot || null, address: s.st ? "near " + s.st : null, lon: s.pt[0], lat: s.pt[1], blockGroupId: gid, acres: isNum(s.ac) ? s.ac : null, parcelRecord: false,
        verification: null, verificationNote: "A parking area mapped in OpenStreetMap, listed in this county's site suggestions as a possible pocket park. No parcel record is on file for it.", modelFields: [],
        source: `OpenStreetMap parking areas, as listed in counties/sites_${fips}.json.gz` });
    });
  }
  const ss = stationSiteCandidates(fips);
  return { sites: ss.concat(list), coverage: (ss.length ? `${n0(ss.length)} sites near stations or planned stops are on file for this county (surface parking, vacant or brownfield land, golf courses), measured from OpenStreetMap and matched to the county parcel record where a service is on file. ` : "No station-area sites file is on file for this county. ") + "Land away from stations is not inventoried here: the full underused-land inventory covers Los Angeles County only. Parking lots that the county's site suggestions list as possible pocket parks are included.",
    sitesSource: `app/data/station_sites/${fips}.json and the parking lots in counties/sites_${fips}.json.gz` };
}
// Station-area sites (src/engines/stationSites.js, app/data/station_sites/<fips>.json): land near a station or a stop
// city, measured from OpenStreetMap and matched to the county parcel record where a service is on file.
function stationSiteCandidates(fips) {
  const SS = window.StationSites, list = (SS && SS.cached(fips)) || [];
  return list.filter(s => s && Array.isArray(s.point) && isNum(s.point[0]) && isNum(s.point[1])).map(s => {
    const p = s.parcel || null;
    return { id: s.id, origin: "station", kind: String(s.kindLabel || s.kind || "site").toLowerCase(), name: (s.osm && s.osm.name) || null, address: null, lat: s.point[0], lon: s.point[1], acres: isNum(s.acres) ? s.acres : null,
      parcelRecord: !!p, zoningCode: (p && p.zn) || null, zoningCategory: null, publicOwner: p ? (p.own ? p.own + (p.ot ? ` (${p.ot})` : "") : (p.ot || null)) : null,
      assessedLandValue: p && isNum(p.lv) ? p.lv : null, assessedBaseYear: null, status: null, housingElement: null, easement: false,
      verification: { status: (s.verification && s.verification.status) || "measured from OpenStreetMap" }, verificationNote: null, modelFields: [],
      facts: SS.facts(s), source: `OpenStreetMap ${(s.osm && s.osm.id) || ""}${p ? " and the county parcel record" : ""} (app/data/station_sites/${fips}.json; ${s.sourceUrl || ""})` };
  });
}
function suggestedPlaces(fips, ring) {
  const out = [], S = (typeof SITES !== "undefined" && SITES && SITES.sites) || {}, A = AE();
  for (const gid in S) {
    if (!gid.startsWith(fips)) continue;
    for (const s of (S[gid] || [])) {
      let pt = Array.isArray(s.pt) ? [s.pt[0], s.pt[1]] : null;
      if (!pt && Array.isArray(s.g) && typeof decodeLine === "function") {   // a line (a creek path, a street): inside when any of its mapped points is
        for (const g of s.g) { try { const v = decodeLine(g).map(p => [p[1], p[0]]); pt = v.find(p => A.pointInRing(p, ring)) || pt || v[0] || null; if (pt && A.pointInRing(pt, ring)) break; } catch (e) { /* skip */ } }
      }
      if (!pt) continue;
      out.push({ type: s.t, idea: s.p || null, name: s.nm || s.dest || s.street || s.st || null, lon: pt[0], lat: pt[1] });
    }
  }
  return out;
}
function stationPoints(env, tables, fips) {
  const L_ = (env.B && env.B.layers) || {};
  const stations = ((L_.stations && L_.stations.features) || []).filter(f => f && f.geometry && Array.isArray(f.geometry.coordinates)).map(f => ({ name: (f.properties && f.properties.n) || null, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
  const planned = (Array.isArray(L_.stations_con) ? L_.stations_con : []).filter(r => Array.isArray(r) && isNum(r[1]) && isNum(r[2])).map(r => ({ name: r[0] || null, lat: r[1], lon: r[2], status: "under construction (county data file)" }));
  let unplaced = 0;
  for (const p of tables.pipelines) {
    if (!p || String(p.fips) !== fips) continue;
    for (const s of (p.stations || [])) {
      if (!s || !isNum(s.lat) || !isNum(s.lng)) continue;
      if (s.verified === false) { unplaced++; continue; }   // an illustrative position, not the agency's: never used for distance
      if (/under construction|planned|proposed/i.test(String(s.desc || s.status || ""))) planned.push({ name: s.name || null, lat: s.lat, lon: s.lng, status: "planned (app/data/transit_pipelines.json)" });
      else stations.push({ name: s.name || null, lat: s.lat, lon: s.lng });
    }
  }
  const stops = ((L_.stops && L_.stops.features) || []).filter(f => f && f.geometry && Array.isArray(f.geometry.coordinates)).map(f => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
  const ts = ((L_.stops && L_.stops.features) || []).map(f => f && f.properties ? +f.properties.t : NaN).filter(isNum);
  return { stations, planned, plannedUnplaced: unplaced, stops, stopsFloor: ts.length ? Math.min(...ts) : null, stopsOnLayer: stops.length };
}

async function compute(spec) {
  const A = AE(), fips = fipsNow(), env = bundleNow();
  const [tables, crash] = await Promise.all([loadTables(), crashFor(fips), (window.StationSites ? window.StationSites.load(fips) : Promise.resolve(null)).catch(() => null)]);
  const shape = A.normalizeShape(spec);
  if (!shape.ok) return { status: "invalid", error: shape.error };
  const details = {}, names = {};
  for (const s of A.blockGroupShares(shape, env.features)) {
    const d = env.B && env.B.details ? env.B.details[s.id] : null;
    if (d) details[s.id] = { m: d.m || null, r: d.r || [] };
    const f = (typeof byId !== "undefined") ? byId.get(s.id) : null;
    if (f && f.properties) names[s.id] = { n: f.properties.n || null, c: f.properties.c || null };
  }
  const cand = candidateSites(env, tables, fips), stn = stationPoints(env, tables, fips);
  const meta = (env.B && env.B.meta) || {};
  const res = A.summarizeArea({
    shape: spec, features: env.features, details, names, fips,
    countyName: (typeof countyOf === "function" && countyOf()) || meta.county || null,
    stateCode: typeof activeState === "function" ? activeState() : null,
    acs: meta.acs || null, bundleFile: env.la ? "the Los Angeles County data file (app/data/bundle-la.b64.txt)" : `counties/bundle_${fips}.json.gz`,
    crashCounts: crash, crashFile: `app/data/crash_counts/${fips}.json`,
    points: Object.assign({ sites: cand.sites, sitesCoverage: cand.coverage, sitesSource: cand.sitesSource, places: suggestedPlaces(fips, shape.ring),
      stopsSource: "the county data file's stops layer (GTFS schedules, weekday 7-9 am departures)",
      stopsHow: stn.stopsOnLayer ? `Each stop is counted only if its own mapped position is inside the drawn shape. The county data file keeps only its busier stops on this layer: the least busy of the ${n0(stn.stopsOnLayer)} on it has ${stn.stopsFloor} buses an hour (7-9 am). Stops with fewer buses are not on file as points, so this is not a count of every bus stop.` : "This county's data file has no bus stops on its stops layer, so none can be counted. That is not the same as no bus service: see buses per hour below." }, stn),
    decisionEngine: DE(), catalog: (typeof D !== "undefined" && D && D.catalog) || null, verification: tables.verification, laws: tables.laws,
    costBenchmarks: tables.costBenchmarks, valueEffects: tables.valueEffects,
  });
  try { res.cards = projectCards(res, details, tables); } catch (e) { console.warn("draw-area: project cards", e); res.cards = null; }
  return res;
}
// Courses of action (src/engines/projectCardEngine.js) for the area and for the largest candidates that have a zoning
// code on file. The subjects are shaped the way app/invest.js shapes them; every figure is the card engine's.
const CARD_SITES = 3;
function projectCards(a, details, tables) {
  const P = window.ProjectCardEngine;
  if (!P || !a || (a.status !== "ok" && a.status !== "too_coarse")) return null;
  const st_ = typeof activeState === "function" ? activeState() : null, fips = a.county.fips;
  const ctx = { laws: tables.laws || undefined, buildingCosts: tables.card.buildingCosts, fundingRules: tables.card.fundingRules, incomeLimits: tables.card.incomeLimits, fmr: tables.card.fmr, valuationModels: tables.card.valuationModels, valuationBenchmarks: tables.card.valuationBenchmarks, transitEffects: { rows: tables.effectRows }, corridors: tables.corridors };
  const c = AE().ringCentroid(a.shape.ring), out = { area: null, sites: {} };
  if (a.status === "ok") {
    const rows = a.blockGroups.map(b => { const m = (details[b.id] || {}).m || {}; return { id: b.id, hv: isNum(m.hv) ? m.hv : null, hvSource: m.hvs ? String(typeof hvSourceText === "function" ? hvSourceText(m.hvs) : m.hvs) : "Census ACS 5-year median home value for the block group" }; });
    out.area = P.buildProjectCard({ kind: "neighborhood", id: "drawn-area", name: a.label || "Drawn area", countyFips: fips, stateCode: st_, city: (a.blockGroups[0] || {}).city || null, blockGroups: rows, point: { lat: c[1], lng: c[0] }, sitesNearby: a.land.candidates.length }, ctx);
  }
  for (const s of a.land.candidates.filter(x => x.zoning.code).slice(0, CARD_SITES)) {
    const cat = String(s.zoning.category || ""), near = s.station.existing;
    out.sites[s.id] = P.buildProjectCard({ kind: "site", id: s.id, name: s.name || s.kind, siteKind: s.kind, countyFips: fips, stateCode: st_, city: null, point: { lat: s.lat, lng: s.lon },
      acres: s.acres.value != null ? { value: s.acres.value, source: s.acres.source } : null, railStationMi: near ? near.meters / AE().MILE_M : null,
      railNote: near ? `the nearest rail station on file is ${near.name || "a station"}, ${Math.round(near.meters)} m away in a straight line; its mode is not on the site record` : null,
      parcel: { parcel_id: String(s.id), state_code: st_, county_fips: fips, base_zoning_code: s.zoning.code, municipality_name: null, is_commercial_or_mixed_use: /commercial/.test(cat), is_single_family_residential: cat === "single-family", is_multifamily_residential: cat === "multifamily", exclusions: {}, lot_sqft: s.acres.value != null ? s.acres.value * 43560 : null } }, ctx);
  }
  return out;
}

// ---------------------------------------------------------------- formatting (text only; no arithmetic on figures)
const BASIS = {
  measured: ["Exact", "Read or added up from whole records; nothing estimated."],
  apportioned: ["Estimated by area", "Block-group counts split by the share of each block group inside the shape. Assumes people and homes are spread evenly."],
  range: ["Range", "The lowest and highest block-group value. A median or rate cannot be combined into one figure for the area."],
  modelled: ["Modelled", "Computed from other figures shown here."],
  assumed: ["Assumed", "No evidence behind it; an assumption."],
};
const basisTag = b => b && BASIS[b] ? `<span class="iv-basis da-b-${b}" title="${h(BASIS[b][1])}">${BASIS[b][0]}</span>` : "";
const nof = why => `<span class="iv-nof">Not on file</span>${why ? `<span class="da-why"> ${h(why)}</span>` : ""}`;
function fmtVal(f, v) {
  const u = String(f.unit || "");
  if (f.key === "rent" && typeof fmtRent === "function") return fmtRent(v);
  if (/per USD/.test(u)) return "$" + v.toFixed(2) + " per $1";
  if (/^USD/.test(u)) return money(v);
  if (/^%/.test(u)) return Math.round(v) + "%";
  if (u === "year") return String(Math.round(v));
  if (u === "°F") return (v > 0 ? "+" : "") + v.toFixed(1) + "°F";
  if (u === "acres") return (v >= 100 ? n0(v) : v.toFixed(1)) + " acres";
  if (u === "crashes" || u === "crimes") return Number.isInteger(v) ? n0(v) : v.toFixed(1);
  if (/^per 1,000/.test(u)) return v.toFixed(1) + " per 1,000";
  if (/homes per gross acre/.test(u)) return v.toFixed(1) + " per acre";
  if (/per square mile/.test(u)) return n0(v) + " per sq mi";
  if (/^buses per hour/.test(u)) return Math.round(v) + " an hour";
  if (u === "points") return Math.round(v) + " points";
  return n0(v);
}
function figValue(f) {
  if (!f || f.basis == null) return nof(f && f.noValue ? "no block group here has a value" : "");
  if (f.basis === "range") { const [lo, hi] = f.range; return `<span class="da-num">${h(lo === hi ? fmtVal(f, lo) : fmtVal(f, lo) + " to " + fmtVal(f, hi))}</span>`; }
  return `<span class="da-num">${f.basis === "apportioned" ? "about " : ""}${h(fmtVal(f, f.value))}</span>`;
}
function figSub(f) {
  if (!f || f.basis == null) return "";
  const bits = [];
  if (f.tag) bits.push(f.tag + (f.basis === "apportioned" && f.largestPartialShare != null && f.kind === "count" ? `; largest partial share ${Math.round(f.largestPartialShare * 100)}%` : ""));
  if (f.weightedAverage) bits.push(`${f.weightedAverage.label}: ${fmtVal(f, f.weightedAverage.value)}`);
  if (f.noValue) bits.push(`${f.noValue} of ${f.blockGroups} block groups have no value`);
  return bits.join(" · ");
}
function fromTable(f, a) {
  if (!f.from || !f.from.length) return "";
  const nm = new Map(a.blockGroups.map(b => [b.id, b]));
  return `<div class="da-from-wrap"><table class="da-from"><thead><tr><th>Block group</th><th>Share inside</th><th>Its value</th></tr></thead><tbody>${f.from.map(r => {
    const b = nm.get(r.id) || {};
    return `<tr><td>${h(b.name || "Block group")} <span class="da-id">${h(r.id)}</span></td><td>${(r.share * 100).toFixed(r.share >= 0.995 || r.share < 0.0005 ? 0 : 1)}%</td><td>${r.value == null ? "none on file" : h(fmtVal(f, r.value))}</td></tr>`; }).join("")}</tbody></table></div>`;
}
const how = (f, a, key) => `<details class="iv-det da-how" data-da-how="${h(key || f.key)}"><summary>How this was worked out</summary><p>${h(f.how || "")}</p>${fromTable(f, a)}${f.source ? `<p class="da-src">Source: ${h(f.source)}</p>` : ""}</details>`;
function figRow(f, a) {
  if (!f) return "";
  const raw = f.basis === "range" ? `${f.range[0]},${f.range[1]}` : (f.value == null ? "" : String(f.value));
  return `<div class="da-fig" data-da-fig="${h(f.key)}" data-da-basis="${h(f.basis || "none")}" data-da-value="${h(raw)}">
    <div class="da-fig-top"><span class="da-k">${h(f.label)}</span><span class="da-v">${figValue(f)} ${basisTag(f.basis)}</span></div>
    ${figSub(f) ? `<div class="da-sub">${h(figSub(f))}</div>` : ""}${how(f, a)}</div>`;
}
const sec = (key, title, inner) => `<details class="panel-sec da-sec" data-da-sec="${key}"${st.open[key] ? " open" : ""}><summary><b>${title}</b></summary><div class="sec-content">${inner}</div></details>`;

// ---------------------------------------------------------------- the panel
const VERDICT = { build: "Build", do_not_build: "Do not build at this scale", screen_only: "Screen only, no build decision", not_enough_data: "Not enough data to say" };
const SCALE = { bus_frequency: "more frequent buses", brt: "bus rapid transit (BRT)", light_rail: "light rail", heavy_rail: "heavy rail or metro", commuter_rail: "commuter or regional rail" };
const VER = { verified: "Sourced inputs", partially_verified: "Partly verified", unverified: "Not sourced yet", "not individually checked": "Not individually checked" };
const chip = t => t ? `<span class="da-chip-s">${h(VER[t] || t)}</span>` : "";

function hereHtml(a) {
  const f = a.figures, order = ["pop", "homes", "landAcres", "homesPerAcre", "hv", "rent", "inc", "yb", "sf", "own", "nocar", "crashAll", "crashKsi", "crashPedBike", "vc", "pcr", "ht", "tg", "bt", "pa"];
  const p = a.points;
  return `<p class="small muted">Figures come from ${a.blockGroups.length} Census block group${a.blockGroups.length > 1 ? "s" : ""}. Each one is tagged with how it was reached; open "How this was worked out" for the block groups and shares behind it.</p>
    ${order.map(k => figRow(f[k], a)).join("")}
    <h4 class="da-h4">Counted exactly (mapped points inside the shape)</h4>
    ${[p.stations, p.stops, p.places].map(x => figRow(x, a)).join("")}`;
}
function vpdLine(x, a) {
  const v = x.valuePerDollar;
  if (!v || v.basis == null) return `<span class="da-k">Back per $1</span> ${nof("no figure in these block groups")}`;
  const wa = v.weightedAverage, [lo, hi] = v.range;
  return `<span class="da-k">Back per $1</span> <span class="da-num">${wa ? "$" + wa.value.toFixed(2) : ""}</span> ${basisTag("range")}
    <span class="da-sub">${h(wa ? wa.label : "")}; ${lo === hi ? `the block-group estimate is $${lo.toFixed(2)}` : `block-group estimates run from $${lo.toFixed(2)} to $${hi.toFixed(2)}`} in ${x.appliesIn != null ? x.appliesIn : v.blockGroups - v.noValue} of ${x.blockGroups != null ? x.blockGroups : v.blockGroups} block groups</span>`;
}
function ideaHtml(x, a, i) {
  const c = x.cost, ev = x.evidence || {};
  const costTxt = c && c.basis ? (c.range[0] === c.range[1] ? money(c.range[0]) : money(c.range[0]) + " to " + money(c.range[1])) + " for one block group's project" : null;
  const f = Object.assign({ key: "idea-" + x.id, how: "The decision engine's estimate for each block group, kept apart: an idea whose figures are withheld in a block group adds nothing from it. The headline is the average of the block-group estimates weighted by the share of each block group inside the shape. Costs and values are the county data file's own estimates, shown only for ideas whose effect or cost the data audit confirmed against a source." }, x.valuePerDollar);
  return `<li class="da-item" data-da-idea="${h(x.id)}"><div class="da-item-top"><b>${i + 1}. ${h(x.name)}</b> ${chip(ev.verification || ev.tier)}</div>
    <div class="da-line">${vpdLine(x, a)}</div>
    ${costTxt ? `<div class="da-line"><span class="da-k">Cost</span> ${h(costTxt)} ${basisTag("range")}</div>` : ""}
    ${x.example ? `<div class="da-sub">For example, in the block group with the largest share inside: ${h(x.example)}</div>` : ""}
    ${how(f, a)}${ev.note ? `<p class="da-sub">${h(ev.note)}</p>` : ""}</li>`;
}
function cardHtml(card, key) {
  if (!card) return `<p class="da-note">Courses of action are not on file here: the project card engine or its tables could not be loaded.</p>`;
  const rng = r => !r || !r.low || !isNum(r.low.value) ? null : (r.low.value === r.high.value ? money(r.low.value) : money(r.low.value) + " to " + money(r.high.value));
  const legal = l => !l ? "not determined" : [l.basis === "statute" ? "state law on file" + (l.citation ? " (" + l.citation + ")" : "") : l.basis, l.note].filter(Boolean).join(": ");
  const courses = (card.courses || []).map(c => {
    const cost = rng(c.cost), units = c.size && c.size.units ? rng({ low: c.size.units.low, high: c.size.units.high }) : null;
    return `<li class="da-item"><div class="da-item-top"><b>${h(c.label)}</b></div>
      <div class="da-sub">Legal basis: ${h(legal(c.legal))}</div>
      <div class="da-line"><span class="da-k">${h((c.cost && c.cost.label) || "Cost")}</span> ${cost ? `<span class="da-num">${h(cost)}</span> ${basisTag(c.cost.basis)} <span class="da-sub">${h(c.cost.unit || "")}</span>` : nof(c.costWhy || "")}</div>
      ${c.size && c.size.units && isNum(c.size.units.low.value) ? `<div class="da-line"><span class="da-k">Homes</span> ${n0(c.size.units.low.value)}${c.size.units.high.value !== c.size.units.low.value ? " to " + n0(c.size.units.high.value) : ""} ${basisTag(c.size.units.basis)} <span class="da-sub">${h(c.size.units.unit || "")}</span></div>` : ""}
      ${c.incomeWhy ? `<div class="da-sub">Income: ${h(c.incomeWhy)}</div>` : ""}</li>`; }).join("");
  const na = card.notAssessed || [];
  return `<div data-da-card="${h(key)}">${courses ? `<ul class="da-list da-nonum">${courses}</ul>` : `<p class="da-note">No course of action can be assessed from the data on file.</p>`}
    ${na.length ? `<details class="iv-det"><summary>Not assessed (${na.length}), and the fact that is missing</summary><ul class="da-plain">${na.map(x => `<li><b>${h(x.label)}:</b> ${h((x.missing || []).join("; "))}</li>`).join("")}</ul></details>` : ""}
    <p class="da-sub">${h(card.ordering || "")} Method: docs/PROJECT-CARDS.md.</p></div>`;
}
function buildHtml(a) {
  const b = a.build, top = b.ideas.slice(0, 6), more = b.ideas.slice(6);
  const plays = b.housingPlays.map(p => {
    const has = p.valuePerDollar && p.valuePerDollar.basis;
    return `<li class="da-item" data-da-play="${h(p.play)}"><div class="da-item-top"><b>${h(p.label)}</b></div>
      <div class="da-line">${has ? vpdLine({ valuePerDollar: p.valuePerDollar, appliesIn: p.valuePerDollar.blockGroups - p.valuePerDollar.noValue, blockGroups: p.blockGroups }, a) : `<span class="da-k">Figures</span> ${nof((p.missing || []).slice(0, 2).join("; "))}`}</div>
      <div class="da-sub">Legal: ${h(p.legal || "not determined")}</div></li>`; }).join("");
  return `<p class="small muted">${h(b.ordering || "")}</p>
    ${b.missing && b.missing.length ? `<p class="da-note">Missing: ${h(b.missing.join("; "))}</p>` : ""}
    <h4 class="da-h4">Improvement ideas (${b.ideas.length} with a sourced figure)</h4>
    ${top.length ? `<ol class="da-list">${top.map((x, i) => ideaHtml(x, a, i)).join("")}</ol>` : `<p class="da-note">No improvement idea has a sourced figure in these block groups.</p>`}
    ${more.length ? `<details class="iv-det"><summary>${more.length} more ideas</summary><ol class="da-list" start="7">${more.map((x, i) => ideaHtml(x, a, i + 6)).join("")}</ol></details>` : ""}
    ${b.withheld.length ? `<details class="iv-det"><summary>Listed without figures (${b.withheld.length})</summary><ul class="da-plain">${b.withheld.map(w => `<li><b>${h(w.name)}</b> <span class="da-sub">in ${w.blockGroups} block group${w.blockGroups > 1 ? "s" : ""}: ${h(w.reason)}</span></li>`).join("")}</ul></details>` : ""}
    <h4 class="da-h4">Housing</h4><ul class="da-list da-nonum">${plays}</ul>
    <h4 class="da-h4">Courses of action for the area</h4>${cardHtml(a.cards && a.cards.area, "area")}
    <ul class="da-caveats">${(b.caveats || []).map(c => `<li>${h(c)}</li>`).join("")}</ul>`;
}
const meters = m => m >= 400 ? (m / AE().MILE_M).toFixed(2) + " mi" : Math.round(m / 10) * 10 + " m";
function candHtml(c) {
  const s = c.station, near = s.existing && s.existing.within ? s.existing : s.planned && s.planned.within ? s.planned : (s.existing || s.planned);
  const law = c.stateLaw;
  return `<li class="da-item da-site" data-da-site="${h(c.id)}"><div class="da-item-top"><b>${h(c.kind ? c.kind[0].toUpperCase() + c.kind.slice(1) : "Site")}</b>${c.acres.value != null ? ` · ${c.acres.value.toFixed(c.acres.value < 10 ? 2 : 0)} acres ${basisTag("measured")}` : ""} ${chip(c.verification)}
      <button type="button" class="da-link" data-da-zoom="${c.lat},${c.lon}">Show on map</button></div>
    ${c.name || c.address ? `<div class="da-sub">${h([c.name, c.address].filter(Boolean).join(" · "))}</div>` : ""}
    <div class="da-kv">
      <span>Zoning</span><span>${c.zoning.code ? h(c.zoning.code) + (c.zoning.category ? ` (${h(c.zoning.category)})` : "") : nof(c.blockers.find(b => b.fact === "zoning") ? c.blockers.find(b => b.fact === "zoning").why : "")}</span>
      <span>State law</span><span>${law.statutes && law.statutes.length ? h(law.status) + ": " + h(law.statutes.join("; ")) : `<span class="iv-nof">Not determined</span>`}<span class="da-why"> ${h(law.why || "")}</span></span>
      <span>Station</span><span>${h(s.answer[0].toUpperCase() + s.answer.slice(1))}${near ? ` (${h(near.name || "station")}, ${meters(near.meters)} in a straight line${near.status ? "; " + h(near.status) : ""})` : ""}</span>
      <span>Owner</span><span>${c.publicOwner ? h(c.publicOwner) : nof(c.blockers.find(b => b.fact === "owner").why)}</span>
      ${c.assessedLandValue.value != null ? `<span>Assessed land value</span><span>${h(money(c.assessedLandValue.value))}${c.assessedLandValue.baseYear ? ` (base year ${h(c.assessedLandValue.baseYear)})` : ""}; a tax-roll figure, not a price</span>` : ""}
      ${c.housingElement != null ? `<span>Housing Element</span><span>Listed in the city's Housing Element inventory${c.housingElement ? ` for about ${n0(c.housingElement)} homes` : ""}</span>` : ""}
      ${c.easement ? `<span>Easement</span><span>The record flags a conservation easement</span>` : ""}
    </div>
    <div class="da-note">${h(c.recommendationWhy)}</div>
    ${st.result && st.result.cards && st.result.cards.sites[c.id] ? `<details class="iv-det"><summary>Courses of action for this site</summary>${cardHtml(st.result.cards.sites[c.id], c.id)}</details>` : ""}
    <details class="iv-det"><summary>What is missing, and where this comes from</summary><ul class="da-plain">${c.blockers.map(b => `<li><b>${h(b.fact[0].toUpperCase() + b.fact.slice(1))}:</b> ${h(b.why)}</li>`).join("")}</ul>
      ${law.notConfirmed && law.notConfirmed.length ? `<p class="da-sub">Laws the statute engine could not confirm for this record: ${h(law.notConfirmed.slice(0, 4).join(" | "))}</p>` : ""}
      ${c.withheldFields.length ? `<p class="da-sub">Not shown because they are unchecked estimates: ${h(c.withheldFields.join(", "))}.</p>` : ""}
      ${c.facts ? `<div class="da-kv">${c.facts.map(([k, t]) => `<span>${h(k)}</span><span>${h(t)}</span>`).join("")}</div>` : ""}
      ${c.verificationNote ? `<p class="da-sub">${h(c.verificationNote)}</p>` : ""}<p class="da-src">Source: ${h(c.acres.source || "")}</p></details></li>`;
}
function landHtml(a) {
  const L_ = a.land, c = L_.candidates, top = c.slice(0, 8), more = c.slice(8);
  const kinds = {}; for (const x of c) kinds[x.kind || "site"] = (kinds[x.kind || "site"] || 0) + 1;
  return `<p class="small muted">${h(L_.coverage || "")}</p>
    <div class="da-fig" data-da-fig="sites" data-da-basis="measured" data-da-value="${c.length}"><div class="da-fig-top"><span class="da-k">Candidates inside the shape</span><span class="da-v"><span class="da-num">${c.length}</span> ${basisTag("measured")}</span></div>
      <div class="da-sub">${h(Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(" · ") || "none")}${L_.alreadyUnderWay.length ? ` · ${L_.alreadyUnderWay.length} more left out because the record marks them built, under construction or approved` : ""} · exact: a site counts when the centre of its outline is inside</div></div>
    ${top.length ? `<ul class="da-list da-nonum">${top.map(candHtml).join("")}</ul>` : `<p class="da-note">No redevelopment candidate on file has its centre inside this shape.</p>`}
    ${more.length ? `<details class="iv-det"><summary>${more.length} more, smaller sites</summary><ul class="da-list da-nonum">${more.map(candHtml).join("")}</ul></details>` : ""}
    <div class="da-recipe"><b>What would get this land redeveloped?</b><p>${h(L_.noRecipe.text)}</p><p>Data that would be needed:</p><ul>${L_.noRecipe.dataNeeded.map(x => `<li>${h(x)}</li>`).join("")}</ul>
      <p class="da-sub">Station distance uses half a mile (${Math.round(L_.walkMeters)} m) in a straight line, the station-area radius this page already uses. It is not a walking route.</p></div>`;
}
const plainMissing = s => /cbdMillionSqft/.test(s) ? "downtown office and commercial floor area (needed to test rail)" : /annualizedCapitalCostUsd/.test(s) ? "a project's yearly cost and yearly trips (needed for FTA's cost per trip)" : /dwellingUnitsPerNetAcre/.test(s) ? "homes and land acres for these block groups" : String(s);
function transitHtml(a) {
  const t = a.transit, p = a.points;
  const names = p.stations.items.map(s => s.name).filter(Boolean);
  let hm = `${figRow(p.stations, a)}${names.length ? `<div class="da-sub da-indent">${h(names.join(", "))}</div>` : ""}
    ${figRow(p.plannedStations, a)}${p.plannedStations.items.length ? `<div class="da-sub da-indent">${h(p.plannedStations.items.map(s => `${s.name || "station"} (${s.status || "planned"})`).join(", "))}</div>` : ""}
    ${p.plannedStations.unplaced ? `<p class="da-sub">${p.plannedStations.unplaced} planned stop position${p.plannedStations.unplaced > 1 ? "s" : ""} on file for this county ${p.plannedStations.unplaced > 1 ? "are" : "is"} marked as illustrative, not the agency's, so ${p.plannedStations.unplaced > 1 ? "they are" : "it is"} not counted.</p>` : ""}
    ${figRow(p.stops, a)}`;
  if (a.status !== "ok") return hm;
  hm += figRow(a.figures.bt, a);
  if (!t) return hm + `<p class="da-note">The transit screen could not be run: the decision engine is not loaded.</p>`;
  const d = t.density && t.density.homesPerNetAcre;
  hm += `<div class="da-verdict" data-da-verdict="${h(t.verdict)}"><b>${h(VERDICT[t.verdict] || t.verdict)}</b>${t.scale ? `: density here supports ${h(SCALE[t.scale] || t.scale)}` : ""}
      <p class="da-sub">${h(t.verdictMeaning || "")}</p></div>
    <div class="da-fig" data-da-fig="netDensity" data-da-basis="${d && d.value != null ? "modelled" : "none"}" data-da-value="${d && d.value != null ? d.value : ""}"><div class="da-fig-top"><span class="da-k">Homes per net acre</span><span class="da-v">${d && d.value != null ? `<span class="da-num">${d.value.toFixed(1)}</span> ${basisTag("modelled")}` : nof("homes or land acres are not on file for these block groups")}</span></div>
      ${d && d.value != null ? `<div class="da-sub">${h(d.source || "")}</div>` : ""}</div>
    ${(t.reasons || []).length ? `<ul class="da-plain">${t.reasons.map(r => `<li>${h(r)}</li>`).join("")}</ul>` : ""}
    ${(t.missing || []).length ? `<p class="da-sub">Not given, so not tested: ${h(t.missing.map(plainMissing).join("; "))}.</p>` : ""}
    <p class="da-note" data-da-riders>Riders, fares and operating cost: not on file for a drawn area. The ridership model works on a line (its length and its stops), not on a shape. This county's lines on file, if any, are in the Invest view's transit card.</p>
    <p class="da-sub">A planning rule of thumb from the area's estimated density (TCRP Report 165 density guidelines and FTA's 2025 breakpoints, as in the Invest view), not a ridership forecast. ${(t.sources || []).slice(0, 2).map((u, i) => `<a href="${h(u)}" target="_blank" rel="noopener">source ${i + 1}</a>`).join(" · ")}</p>`;
  return hm;
}
function hoodsHtml(a) {
  return `<p class="small muted">Select one to open its own panel. "Share inside" is the part of that block group's mapped shape that lies in the drawn area.</p>
    <ul class="da-hoods">${a.blockGroups.map(b => `<li><button type="button" class="da-link" data-da-select="${h(b.id)}">${h(b.name || "Block group")}${b.city ? ", " + h(b.city) : ""}</button> <span class="da-id">${h(b.id)}</span><span class="da-share">${(b.share * 100).toFixed(b.share >= 0.995 ? 0 : 1)}% inside${b.acresInside != null ? ` · ${b.acresInside >= 100 ? n0(b.acresInside) : b.acresInside.toFixed(1)} acres` : ""}</span></li>`).join("")}</ul>`;
}
function limitsHtml(a) {
  const L_ = AE().LIMITS;
  return `<ul class="da-plain">
    <li><b>Smallest area.</b> Block groups are the smallest unit the data has. If the shape covers less than ${Math.round(L_.minLargestShare * 100)}% of every block group it touches, block-group figures are not shown, only what is mapped as its own point.</li>
    <li><b>Largest area.</b> The tool stops at ${L_.maxBlockGroups} block groups. For anything bigger, use the county views.</li>
    <li><b>Counts are estimates</b> wherever the shape cuts a block group: they assume people and homes are spread evenly, which is false where part of a block group is a park, a campus or water.</li>
    <li><b>Medians and most rates</b> are shown as a range, because they cannot be combined without the household-level records.</li>
    <li><b>These limits are this tool's own working rules</b>, not thresholds from a published source. Full rules and a worked example: <a href="docs/DRAW-AREA.md" target="_blank" rel="noopener">docs/DRAW-AREA.md</a>.</li></ul>`;
}
function render() {
  const a = st.result, pn = q("#panel");
  if (!a || !pn) return;
  const A = AE(), title = a.status === "invalid" ? "Area" : a.shape.type === "circle" ? `${RADII.find(r => r[0] === a.shape.radiusMiles)[1]} around a point` : "The area you drew";
  let hm = `<div class="da-panel" id="da-panel" data-da-status="${h(a.status)}">`;
  if (a.status === "invalid") { pn.innerHTML = hm + `<h2>Area</h2><p class="da-note">${h(a.error || "The shape could not be read.")}</p></div>`; return; }
  hm += `<div class="eyebrow">DRAWN AREA · ${h(String(a.county.name || "").toUpperCase())} · ${h(a.shape.acres.value >= 100 ? n0(a.shape.acres.value) : a.shape.acres.value.toFixed(1))} ACRES</div><h2>${h(title)}</h2>
    <div class="action-bar">
      <button type="button" class="action-pill" data-da-act="ask" title="Open the AI advisor with this area's figures"><svg class="ic" aria-hidden="true"><use href="#i-sparkle"/></svg> Ask the advisor about this area</button>
      <button type="button" class="action-pill" data-da-act="copy" title="Copy a link that reproduces this area"><svg class="ic" aria-hidden="true"><use href="#i-link"/></svg> Copy link</button>
      <button type="button" class="action-pill" data-da-act="clear" title="Remove the drawn area"><svg class="ic" aria-hidden="true"><use href="#i-edit"/></svg> Clear</button>
    </div>
    <p class="verdict da-summary" id="da-summary">${h(A.plainSummary(a))}</p>`;
  if (a.status !== "ok") {
    hm += `<div class="prelim-banner warn da-banner" role="status">${h(a.message || "")}</div>`;
    if (a.status === "too_coarse") hm += sec("land", "Land to redevelop", landHtml(a)) + sec("transit", "Stations and stops inside", transitHtml(a));
    if (a.blockGroups.length && a.status !== "too_large") hm += `<details class="panel-sec da-sec" data-da-sec="hoods"><summary><b>See these neighborhoods (${a.blockGroups.length})</b></summary><div class="sec-content">${hoodsHtml(a)}</div></details>`;
  } else {
    hm += sec("here", "What is here", hereHtml(a)) + sec("build", "What to build", buildHtml(a)) + sec("land", "Land to redevelop", landHtml(a)) + sec("transit", "Transit", transitHtml(a));
    hm += `<details class="panel-sec da-sec" data-da-sec="hoods"><summary><b>See these neighborhoods (${a.blockGroups.length})</b></summary><div class="sec-content">${hoodsHtml(a)}</div></details>`;
  }
  hm += `<details class="panel-sec da-sec" data-da-sec="limits"><summary><b>Limits of this tool</b></summary><div class="sec-content">${limitsHtml(a)}</div></details></div>`;
  pn.innerHTML = hm; pn.scrollTop = 0;
}
function panelClick(e) {
  const t = e.target.closest("[data-da-act],[data-da-select],[data-da-zoom]");
  if (!t || !t.closest("#da-panel")) return;
  if (t.dataset.daAct === "clear") return clearArea();
  if (t.dataset.daAct === "copy") return copyLink();
  if (t.dataset.daAct === "ask") return askAdvisor();
  if (t.dataset.daSelect && typeof select === "function") return select(t.dataset.daSelect, true);
  if (t.dataset.daZoom) { const [la, lo] = t.dataset.daZoom.split(",").map(Number); if (isNum(la) && isNum(lo)) { map.setView([la, lo], Math.max(map.getZoom(), 17)); if (matchMedia("(max-width: 860px)").matches) q(".mapwrap").scrollIntoView({ behavior: "smooth", block: "start" }); } }
}
function copyLink() {
  writeHash();
  const url = location.href;
  const done = () => toast("Link copied. Opening it draws this area again.");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { window.prompt("Copy this link", url); });
  else window.prompt("Copy this link", url);
}
function askAdvisor() {
  if (!st.result) return;
  st.ask = true;
  if (typeof openAiAdvisor === "function") openAiAdvisor();
  const strip = document.getElementById("ai-context-desc");
  if (strip && !/drawn area/.test(strip.textContent)) strip.append(" · plus the drawn area");
}

// ---------------------------------------------------------------- hash
function writeHash() {
  const p = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
  if (st.spec) { p.set("area", AE().encodeArea(st.spec)); if (st.fips && st.fips !== "06037") p.set("county", st.fips); }
  else p.delete("area");
  const hash = "#" + p.toString();
  if (location.hash !== hash) history.replaceState(null, "", hash);
}
function whenReady(test, ms) {
  return new Promise(res => { const t0 = Date.now(); const tick = () => { let ok = false; try { ok = !!test(); } catch (e) { ok = false; } if (ok) res(true); else if (Date.now() - t0 > ms) res(false); else setTimeout(tick, 200); }; tick(); });
}
const mapReady = () => typeof map !== "undefined" && map && map._loaded && typeof selected !== "undefined" && selected && q("#loading") && q("#loading").hidden && !(typeof _countyLoading !== "undefined" && _countyLoading);
async function restore(link) {
  const A = AE(), spec = link && link.area ? A.decodeArea(link.area) : null;
  if (!spec) return false;
  st.applying = true;
  try {
    if (!(await whenReady(mapReady, 90000))) return false;
    const want = link.county ? String(link.county).padStart(5, "0") : "06037";
    if (want !== fipsNow() && typeof openCounty === "function") {
      try { await openCounty(want, link.bg && String(link.bg).startsWith(want) ? link.bg : undefined); } catch (e) { /* the message below covers it */ }
      await whenReady(() => mapReady() && fipsNow() === want, 90000);
    }
    if (want !== fipsNow()) { toast("The area in this link is in a county that could not be opened."); return false; }
    await setArea(spec, { fit: true });
    return true;
  } finally { st.applying = false; }
}

// ---------------------------------------------------------------- the shape on the map
function ensureLayers() {
  if (st.group) return;
  if (!map.getPane("da-pane")) { const p = map.createPane("da-pane"); p.style.zIndex = 450; p.style.pointerEvents = "none"; }
  st.renderer = L.svg({ pane: "da-pane" });
  st.group = L.layerGroup().addTo(map);
}
const ACCENT = () => (typeof css === "function" && css("--accent")) || "#1d4ed8";
function ringLatLngs(spec) { const s = AE().normalizeShape(spec); return s.ok ? s.ring.map(p => [p[1], p[0]]) : []; }
function drawShape() {
  ensureLayers();
  st.group.clearLayers(); st.handles = []; st.shapeLayer = null;
  if (!st.spec) return;
  st.shapeLayer = L.polygon(ringLatLngs(st.spec), { pane: "da-pane", renderer: st.renderer, interactive: false, color: ACCENT(), weight: 2.5, fillColor: ACCENT(), fillOpacity: 0.08, dashArray: "6 4" }).addTo(st.group);
  const handle = (ll, cls, title) => L.marker(ll, { draggable: true, keyboard: false, title, icon: L.divIcon({ className: "da-handle " + cls, iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000 }).addTo(st.group);
  if (st.spec.type === "circle") {
    const m = handle([st.spec.center[1], st.spec.center[0]], "da-handle-c", "Drag to move the circle");
    m.on("drag", () => { const ll = m.getLatLng(); st.shapeLayer.setLatLngs(ringLatLngs({ type: "circle", center: [ll.lng, ll.lat], radiusMiles: st.spec.radiusMiles })); });
    m.on("dragend", () => { const ll = m.getLatLng(); setArea({ type: "circle", center: [ll.lng, ll.lat], radiusMiles: st.spec.radiusMiles }, {}); });
    st.handles.push(m);
  } else {
    st.spec.ring.forEach((p, i) => {
      const m = handle([p[1], p[0]], "", "Drag to move this corner. Double-click to remove it.");
      const ringNow = () => st.handles.map(x => { const ll = x.getLatLng(); return [ll.lng, ll.lat]; });
      m.on("drag", () => st.shapeLayer.setLatLngs(ringNow().map(x => [x[1], x[0]])));
      m.on("dragend", () => {
        const next = { type: "polygon", ring: ringNow() }, chk = AE().normalizeShape(next);
        if (!chk.ok) { toast("Not moved: " + chk.error + "."); drawShape(); return; }
        setArea(next, {});
      });
      m.on("dblclick", e => { L.DomEvent.stop(e); if (st.spec.ring.length <= 3) return toast("A shape needs at least 3 corners.");
        const next = { type: "polygon", ring: st.spec.ring.filter((_, k) => k !== i) }, chk = AE().normalizeShape(next);
        if (!chk.ok) return toast("Not removed: " + chk.error + "."); setArea(next, {}); });
      st.handles.push(m);
    });
  }
}
async function setArea(spec, opts) {
  const A = AE(), chk = A.normalizeShape(spec);
  if (!chk.ok) { toast("That shape cannot be used: " + chk.error + "."); return; }
  st.spec = spec; st.fips = fipsNow();
  const my = ++st.seq;
  drawShape(); syncUi(); writeHash();
  if (opts && opts.fit && st.shapeLayer) map.fitBounds(st.shapeLayer.getBounds(), { padding: [60, 60], maxZoom: 16, animate: false });
  const pn = q("#panel");
  if (pn && !q("#da-panel")) pn.innerHTML = `<div class="da-panel" id="da-panel" data-da-status="working"><p class="empty">Working out what is inside the shape…</p></div>`;
  let res = null;
  try { res = await compute(spec); } catch (e) { console.warn("draw-area: could not compute", e); res = { status: "invalid", error: "The area could not be worked out (" + (e && e.message ? e.message : "error") + ")" }; }
  if (my !== st.seq) return;   // a newer shape replaced this one while it was being worked out
  st.result = res; window.__cpDrawnArea = res;
  render(); syncUi();
  if (opts && opts.scroll && matchMedia("(max-width: 860px)").matches && q("#da-panel")) q("#panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
function clearArea(quiet) {
  st.seq++; st.spec = null; st.result = null; st.ask = false; st.fips = null; window.__cpDrawnArea = null;
  if (st.group) st.group.clearLayers();
  st.handles = []; st.shapeLayer = null;
  stopDrawing();
  writeHash(); syncUi();
  if (q("#da-panel") && !quiet) { if (typeof selected !== "undefined" && selected && typeof select === "function" && typeof byId !== "undefined" && byId.has(selected)) select(selected, false); else q("#panel").innerHTML = `<p class="empty">Click a neighborhood on the map, or draw an area.</p>`; }
}

// ---------------------------------------------------------------- drawing (captured on the map's own element, so the
// page's click handlers for neighborhoods and lots do not fire while a shape is being drawn; dragging still pans)
function containerPt(e) { const r = map.getContainer().getBoundingClientRect(); return L.point(e.clientX - r.left, e.clientY - r.top); }
function onDown(e) { st.down = { x: e.clientX, y: e.clientY }; }
function onClickCapture(e) {
  if (st.mode === "idle") return;
  if (e.target.closest && e.target.closest(".leaflet-control")) return;   // zoom buttons keep working
  e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault();
  if (st.down && Math.hypot(e.clientX - st.down.x, e.clientY - st.down.y) > 8) return;   // the end of a drag, not a click
  const pt = containerPt(e), ll = map.containerPointToLatLng(pt);
  if (st.mode === "circle") { const r = st.radius; stopDrawing(); setArea({ type: "circle", center: [ll.lng, ll.lat], radiusMiles: r }, { scroll: true, fit: true }); return; }
  if (st.corners.length >= 3 && map.latLngToContainerPoint(st.corners[0]).distanceTo(pt) <= 14) return finishPolygon();
  const last = st.corners[st.corners.length - 1];
  if (last && map.latLngToContainerPoint(last).distanceTo(pt) <= 4) return;   // the second click of a double-click
  if (st.corners.length >= AE().LIMITS.maxCorners) return toast(`A shape can have at most ${AE().LIMITS.maxCorners} corners. Finish this one.`);
  st.corners.push([ll.lat, ll.lng]);
  drawDraft(); syncUi();
}
function onDblCapture(e) {
  if (st.mode === "idle") return;
  if (e.target.closest && e.target.closest(".leaflet-control")) return;
  e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault();
  if (st.mode === "polygon") finishPolygon();
}
function onMove(e) {
  if (st.mode !== "polygon" || !st.corners.length || !st.band) return;
  const ll = map.containerPointToLatLng(containerPt(e));
  st.band.setLatLngs([st.corners[st.corners.length - 1], [ll.lat, ll.lng]]);
}
function onKey(e) {
  if (e.key !== "Escape") return;
  if (st.mode !== "idle") { stopDrawing(); syncUi(); toast("Drawing cancelled."); }
  else if (q("#da-pop") && !q("#da-pop").hidden) q("#da-pop").hidden = true;
}
function drawDraft() {
  ensureLayers();
  if (st.draft) { st.draft.remove(); st.draft = null; }
  if (st.mode !== "polygon") return;
  st.draft = L.layerGroup().addTo(map);
  const o = { pane: "da-pane", renderer: st.renderer, interactive: false, color: ACCENT(), weight: 2.5 };
  if (st.corners.length > 1) L.polyline(st.corners, o).addTo(st.draft);
  st.band = L.polyline([], Object.assign({}, o, { dashArray: "4 4", weight: 1.5 })).addTo(st.draft);
  st.corners.forEach((c, i) => L.circleMarker(c, Object.assign({}, o, { radius: i === 0 ? 7 : 4.5, fillColor: i === 0 ? "#fff" : ACCENT(), fillOpacity: 1 })).addTo(st.draft));
}
function startDrawing(mode) {
  if (typeof map === "undefined" || !map) return;
  ensureLayers();
  stopDrawing();
  st.mode = mode; st.corners = [];
  if (st.group) st.group.clearLayers();   // one area at a time: the old shape leaves the map while a new one is drawn
  st.handles = []; st.shapeLayer = null;
  map.getContainer().classList.add("da-drawing");
  if (map.doubleClickZoom) map.doubleClickZoom.disable();
  q("#da-pop").hidden = true;
  drawDraft(); syncUi();
}
function stopDrawing() {
  if (st.draft) { st.draft.remove(); st.draft = null; }
  st.band = null;
  if (st.mode !== "idle") {
    st.mode = "idle"; st.corners = [];
    if (typeof map !== "undefined" && map) { map.getContainer().classList.remove("da-drawing"); if (map.doubleClickZoom) map.doubleClickZoom.enable(); }
    if (st.spec && st.group && !st.shapeLayer) drawShape();   // drawing was cancelled: the area that was there comes back
  }
}
function finishPolygon() {
  if (st.corners.length < 3) return toast("Add at least 3 corners first.");
  const spec = { type: "polygon", ring: st.corners.map(c => [c[1], c[0]]) }, chk = AE().normalizeShape(spec);
  if (!chk.ok) return toast("Not finished: " + chk.error + ".");
  stopDrawing();
  setArea(spec, { scroll: true });
}
function undoCorner() { if (st.mode === "polygon" && st.corners.length) { st.corners.pop(); drawDraft(); syncUi(); } }

// ---------------------------------------------------------------- the control
function buildUi() {
  const bar = q(".map-bar"), wrap = q(".mapwrap");
  if (!bar || !wrap || q("#btn-draw-area")) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "tool-btn"; b.id = "btn-draw-area"; b.title = "Draw a shape or a circle on the map and see what is inside it";
  b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "da-pop");
  b.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#i-edit"/></svg><span>Draw an area</span>`;
  bar.appendChild(b);
  const pop = document.createElement("div");
  pop.id = "da-pop"; pop.className = "da-pop"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Draw an area");
  pop.innerHTML = `<div class="da-pop-h">Draw an area</div>
    <p class="da-pop-p">See what is inside any shape, across neighborhood lines: people, homes, what to build, land to redevelop and transit.</p>
    <button type="button" class="tool-btn primary" data-da-start="polygon">Draw a shape</button>
    <p class="da-pop-hint">Click to add corners. Double-click, or click the first corner, to finish.</p>
    <div class="da-pop-h2">Or a circle around a point</div>
    <div class="seg da-radii" role="group" aria-label="Circle radius">${RADII.map(([r, t]) => `<button type="button" data-da-radius="${r}"${r === st.radius ? ' class="active" aria-pressed="true"' : ' aria-pressed="false"'}>${t}</button>`).join("")}</div>
    <button type="button" class="tool-btn" data-da-start="circle">Click the map to place it</button>
    <label class="da-pop-hint" for="da-centre">or centre it on a station or planned stop on file</label>
    <select id="da-centre" class="da-centre"><option value="">Choose a station…</option></select>
    <div class="da-pop-foot" id="da-pop-foot" hidden><button type="button" class="da-link" data-da-show>Show the area panel</button><button type="button" class="da-link" data-da-clear>Clear the area</button></div>`;
  wrap.appendChild(pop);
  const strip = document.createElement("div");
  strip.id = "da-strip"; strip.className = "da-strip"; strip.hidden = true; strip.setAttribute("role", "status"); strip.setAttribute("aria-live", "polite");
  wrap.appendChild(strip);
  b.addEventListener("click", e => { e.stopPropagation(); pop.hidden = !pop.hidden; b.setAttribute("aria-expanded", String(!pop.hidden)); if (!pop.hidden) fillCentres(); });
  pop.querySelector("#da-centre").addEventListener("change", e => {
    const v = e.target.value; if (!v) return;
    const [la, lo] = v.split(",").map(Number); e.target.value = "";
    pop.hidden = true; stopDrawing();
    setArea({ type: "circle", center: [lo, la], radiusMiles: st.radius }, { fit: true, scroll: true });
  });
  document.addEventListener("click", e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== b && !b.contains(e.target)) { pop.hidden = true; b.setAttribute("aria-expanded", "false"); } });
  pop.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.daRadius) {
      st.radius = +t.dataset.daRadius;
      pop.querySelectorAll("[data-da-radius]").forEach(x => { const on = x === t; x.classList.toggle("active", on); x.setAttribute("aria-pressed", String(on)); });
      if (st.spec && st.spec.type === "circle" && st.mode === "idle") setArea({ type: "circle", center: st.spec.center, radiusMiles: st.radius }, {});
    } else if (t.dataset.daStart) startDrawing(t.dataset.daStart);
    else if ("daShow" in t.dataset) { pop.hidden = true; showPanel(); }
    else if ("daClear" in t.dataset) { pop.hidden = true; clearArea(); }
  });
  strip.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    const a = t.dataset.daStrip;
    if (a === "finish") finishPolygon(); else if (a === "undo") undoCorner(); else if (a === "cancel") { stopDrawing(); syncUi(); }
    else if (a === "show") showPanel(); else if (a === "clear") clearArea();
  });
  document.addEventListener("click", panelClick);
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.daSec && d.dataset.daSec in st.open) st.open[d.dataset.daSec] = d.open; }, true);
  document.addEventListener("keydown", onKey);
}
// Circle centres on file for the open county: its rail stations, stations of local projects, and the stop cities of
// rail corridors. A point whose own record says it is not the agency's station site is labelled as such.
function fillCentres() {
  const sel = q("#da-centre"); if (!sel) return;
  const fips = fipsNow();
  loadTables().then(tables => {
    const env = bundleNow(), stn = stationPoints(env, tables, fips), opts = [];
    for (const s of stn.stations) if (s.name) opts.push([s.name + " (station)", s.lat, s.lon]);
    for (const s of stn.planned) if (s.name) opts.push([`${s.name} (${String(s.status || "planned").replace(/ \(.*$/, "")})`, s.lat, s.lon]);
    for (const p of tables.pipelines) if (p && String(p.fips) === fips) for (const s of (p.stations || [])) if (s && s.verified === false && isNum(s.lat) && isNum(s.lng)) opts.push([`${s.name} (planned stop; position not confirmed by the agency)`, s.lat, s.lng]);
    for (const c of tables.corridors) for (const s of (c.proposed_stations || [])) if (s && s.fips === fips && isNum(s.lat) && isNum(s.lng)) opts.push([`${s.city || s.name} (stop city of ${c.name}; a city centre, not a station site)`, s.lat, s.lng]);
    const seen = new Set();
    sel.innerHTML = `<option value="">${opts.length ? "Choose a station…" : "No station on file for this county"}</option>` + opts.filter(o => { const k = o[0] + o[1].toFixed(4); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a[0].localeCompare(b[0])).map(o => `<option value="${o[1]},${o[2]}">${h(o[0])}</option>`).join("");
    sel.disabled = !opts.length;
  });
}
function showPanel() {
  if (!st.result) return;
  render();
  if (matchMedia("(max-width: 860px)").matches) q("#panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
function syncUi() {
  const strip = q("#da-strip"), b = q("#btn-draw-area"), foot = q("#da-pop-foot");
  if (!strip || !b) return;
  b.classList.toggle("active", st.mode !== "idle" || !!st.spec);
  if (foot) foot.hidden = !st.spec;
  if (st.mode === "polygon") {
    const n = st.corners.length;
    strip.hidden = false;
    strip.innerHTML = `<span>${n === 0 ? "Click the map to add the first corner." : n < 3 ? `${n} corner${n > 1 ? "s" : ""}. Keep clicking to add more.` : `${n} corners. Double-click or click the first corner to finish.`} Esc cancels.</span>
      <button type="button" class="tool-btn primary" data-da-strip="finish"${n < 3 ? " disabled" : ""}>Finish</button><button type="button" class="tool-btn" data-da-strip="undo"${n ? "" : " disabled"}>Undo</button><button type="button" class="tool-btn" data-da-strip="cancel">Cancel</button>`;
  } else if (st.mode === "circle") {
    strip.hidden = false;
    strip.innerHTML = `<span>Click the map where the ${RADII.find(r => r[0] === st.radius)[1].toLowerCase()} circle should be centred. Esc cancels.</span><button type="button" class="tool-btn" data-da-strip="cancel">Cancel</button>`;
  } else if (st.spec) {
    const a = st.result, n = a && a.blockGroups ? a.blockGroups.length : null;
    strip.hidden = false;
    strip.innerHTML = `<span>Area drawn${n != null ? `: ${n} block group${n === 1 ? "" : "s"}` : ""}. Drag a corner to change it.</span><button type="button" class="tool-btn primary" data-da-strip="show">Show the area panel</button><button type="button" class="tool-btn" data-da-strip="clear">Clear</button>`;
  } else { strip.hidden = true; strip.innerHTML = ""; }
}

// ---------------------------------------------------------------- start
function wireMap() {
  const c = map.getContainer();
  c.addEventListener("pointerdown", onDown, true);
  c.addEventListener("click", onClickCapture, true);
  c.addEventListener("dblclick", onDblCapture, true);
  c.addEventListener("mousemove", onMove);
}
function start() {
  if (!AE()) { console.warn("draw-area: src/engines/areaAggregationEngine.js is not loaded"); return; }
  buildUi();
  whenReady(() => typeof map !== "undefined" && map && map._loaded, 120000).then(ok => {
    if (!ok) return;
    wireMap();
    if (LINK.area) restore(LINK);
  });
  window.addEventListener("hashchange", () => {
    const p = new URLSearchParams(String(location.hash || "").replace(/^#/, "")), area = p.get("area");
    if (area && (!st.spec || AE().encodeArea(st.spec) !== area)) restore({ area, county: p.get("county"), bg: p.get("bg") });
  });
}

// What the rest of the page calls (app/app.js: syncHash and serializeLiveAdvisorContext; nothing else).
window.DrawArea = {
  // app/app.js rebuilds the hash from scratch on every selection: keep the area in it, and drop the area when the
  // county on the map is no longer the one it was drawn in.
  onSyncHash(params, fips) {
    if (!st.spec) return;
    if (st.fips && fips && String(fips) !== st.fips && !st.applying) { clearArea(true); return; }
    try { params.set("area", AE().encodeArea(st.spec)); } catch (e) { /* leave the hash as it is */ }
  },
  // The compact summary the advisor gets once the visitor asks about the area (cleared with the area).
  advisorContext(fips) {
    if (!st.ask || !st.result || !st.spec || (fips && st.fips && String(fips) !== st.fips)) return null;
    try { return AE().advisorSummary(st.result, 6000); } catch (e) { return null; }
  },
  current: () => st.result,
  spec: () => st.spec,
  setArea: (spec, opts) => setArea(spec, opts || {}),
  clear: () => clearArea(),
  start: mode => startDrawing(mode),
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
