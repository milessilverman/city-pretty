/**
 * Project card engine (browser global and CommonJS module; the one copy, loaded by index.html, scripts and tests).
 *
 * For one subject (a redevelopment site on file, a lot opened on the map, a neighborhood, or the neighborhoods around a
 * planned-rail stop city) it lists the courses of action the data on file can support, from a fixed menu, and for each
 * one its size, cost, public money, income, value and what could break it. Pure functions: no network, no file reads;
 * every table is passed in ctx. docs/PROJECT-CARDS.md describes each formula and data source.
 *
 * Rules:
 *  - A course appears only when its legal basis is determined: by the statute engine (evaluateByRightHousing over
 *    app/data/statutes.json) or by the zoning on file. Otherwise it goes to `notAssessed` with the exact missing fact.
 *  - Every figure is { value, unit, source, basis } with basis "measured" | "modelled" | "assumed"; every result is a
 *    range { low, high } unless its source is exact (then `exact: true` and the reason).
 *  - Only cost rows with display_allowed: true reach a course. Rows marked display_allowed: false (the ICC building
 *    valuation table) are used only in `internal_only`, which the page never renders and cardsForAdvisor() drops.
 *  - A programme of public money is applied only when every condition it needs is known for this subject; otherwise it
 *    is listed as "could apply; not computed because ...".
 *  - No capitalisation rate, typical density, unit size or cost is typed here. Where none is on file, the course says so.
 *  - `missing` and `risks` are generated from the nulls and from the source rows' own caveats, not written per place.
 *
 * Loading: index.html loads this after app/app.js (it uses app.js's global evaluateByRightHousing). The API is
 * window.ProjectCardEngine. In Node: require() it.
 */
(function () {
"use strict";

const _evalHousing = (typeof evaluateByRightHousing !== "undefined")
  ? evaluateByRightHousing
  : ((typeof require !== "undefined") ? require("./statutoryZoningEngine").evaluateByRightHousing : null);

const PROJECT_CARD_ENGINE_VERSION = "1.0.0";

// The fixed menu. `affordable` courses repeat a building course "with an affordable share".
const COURSES = [
  { id: "hold", label: "Hold and rent the spaces" },
  { id: "adu", label: "Add a backyard home (ADU)" },
  { id: "state_law_units", label: "Split or add units under state law", affordable: true },
  { id: "small_multifamily", label: "Small multifamily", affordable: true },
  { id: "station_conventional", label: "Station-area apartments (conventional)", affordable: true },
  { id: "station_prefab", label: "Station-area apartments (prefabricated)", affordable: true },
];
const COURSE_INDEX = Object.fromEntries(COURSES.map((c, i) => [c.id, i]));
const SQFT_PER_ACRE = 43560;          // definition of the acre (US survey); a unit conversion, not data
const MILES_PER_METER = 1 / 1609.344; // definition of the international mile
const STOP_RADIUS_MI = 1;             // same radius the Transit card uses for stop-city neighborhoods (app/invest.js)
const RAIL_STATION_AREA_MI = 0.5;     // the widest transit distance in the statutes on file (SB 79 tier 2: 0.5 mile)

const STATE_NAMES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

// Which research prompt (docs/RESEARCH-PROMPTS.md) would fill each kind of gap.
const PROMPT = {
  build_cost: "research prompt 1 (building costs by type and place, including prefabricated)",
  space_rent: "research prompt 9 (renting out every space)",
  funding: "research prompt 6 (public money for the homes)",
  value_effect: "research prompt 11 (what transit and neighborhood investment do to values)",
  zoning: "research prompt 12 (zoning and land ownership data)",
  addition_value: "research prompt 2 (what an addition adds to a home's value)",
};

// ---------------------------------------------------------------- small helpers
const num = x => (typeof x === "number" && isFinite(x)) ? x : null;
const round = (x, d) => x == null ? null : Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0);
function fig(value, unit, source, basis, extra) {
  const v = num(value);
  return Object.assign({ value: v, unit: unit || null, source: v == null ? (source || null) : (source || null), basis: v == null ? null : (basis || null) }, extra || {});
}
// A range of two figures. A point is allowed only with exact: { why } (e.g. a statutory limit, a median of records).
function range(lo, hi, unit, source, basis, exact) {
  const a = num(lo), b = num(hi);
  if (a == null || b == null) return null;
  const r = { low: fig(Math.min(a, b), unit, source, basis), high: fig(Math.max(a, b), unit, source, basis), unit, source, basis };
  if (exact) r.exact = typeof exact === "string" ? exact : true;
  return r;
}
const inputRow = (name, value, unit, source, basis, note) => ({ name, value: num(value), text: num(value) == null && value != null ? String(value) : null, unit: unit || null, source: source || null, basis: basis || null, note: note || null });
const urlOf = s => { const m = String(s || "").match(/https?:\/\/[^\s;,)"]+/); return m ? m[0] : null; };
function haversineMi(a, b) {
  const R = 3958.8, rad = Math.PI / 180;   // mean Earth radius in miles (IUGG mean radius 6371.0088 km)
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// ---------------------------------------------------------------- data lookups (each returns null when not on file)
const displayRows = rows => (Array.isArray(rows) ? rows : []).filter(r => r && r.display_allowed === true);
const internalRows = rows => (Array.isArray(rows) ? rows : []).filter(r => r && r.display_allowed === false);

// Los Angeles ADU permit medians apply inside the City of Los Angeles only (the rows' own `place`).
function laAduRow(rows, city, kind) {
  if (!/^los angeles$/i.test(String(city || "").trim())) return null;
  const re = kind === "per_unit" ? /median declared cost per unit$/ : /median declared cost per sq ft$/;
  const xs = displayRows(rows).filter(r => /^New-construction ADU/.test(r.item || "") && re.test(r.item || "") && /^Los Angeles, CA \(city\)/.test(r.place || ""));
  // the latest calendar year whose permits are all issued: years before the year of the data refresh
  const complete = xs.filter(r => { const m = String(r.edition || "").match(/refreshed (\d{4})/); return !m || r.year < +m[1]; });
  const pool = complete.length ? complete : xs;
  return pool.sort((a, b) => b.year - a.year)[0] || null;
}
function dodStateFactor(rows, state) {
  const name = STATE_NAMES[state];
  if (!name) return null;
  return displayRows(rows).find(r => r.measure === "factor" && r.item === "DoD MILCON area cost factor, " + name) || null;
}
function iccRow(rows, group, type) {
  return internalRows(rows).find(r => r.icc_occupancy_group === group && r.icc_construction_type === type && r.measure === "cost_per_sqft") || null;
}
function fmrFor(fmr, fips) {
  const recs = fmr && Array.isArray(fmr.records) ? fmr.records : Array.isArray(fmr) ? fmr : [];
  const r = recs.find(x => x && x.fips === fips && x.verification && x.verification.status === "verified");
  if (!r) return null;
  return { rec: r, br: [r.zero_bed_eff, r.one_bed_1br, r.two_bed_2br, r.three_bed_3br, r.four_bed_4br], fy: r.fiscal_year, url: urlOf(r.verification.evidence), area: r.metro_or_county_name || r.county_name };
}
function incomeLimitsFor(il, fips) {
  const list = il && Array.isArray(il.counties) ? il.counties : [];
  const row = list.find(x => x && x.fips === fips) || null;
  const failed = il && il._source && Array.isArray(il._source.failed) ? il._source.failed.find(x => x.fips === fips) : null;
  return { row, failed, api: il && il._source ? il._source.api : null, year: il && il._source ? il._source.fiscal_year : null };
}
const fundingRow = (rules, measure, extra) => ((rules && rules.rows) || []).find(r => r && r.measure === measure && r.display_allowed === true && (!extra || extra(r))) || null;
const lawById = (laws, id) => (Array.isArray(laws) ? laws : []).find(l => l && l.id === id) || null;
// A county home-value model that passed its back-test: app/data/county_valuation_models.json (one entry per passing
// county) or, for Los Angeles, app/data/valuation_backtest_benchmarks.json where its gate passed.
function valuationModel(vm, fips, benchmarks) {
  const c = vm && vm.counties ? vm.counties[fips] : null;
  if (c && c.tested) return Object.assign({ source: "app/data/county_valuation_models.json" }, c);
  const b = benchmarks && benchmarks.counties ? benchmarks.counties[fips] : null;
  if (b && b.gate && b.gate.pass === true && b.model && num(b.model.mdape) != null) return { county_name: b.countyName, tested: { mdape: b.model.mdape, n: b.model.n, by_price_band: b.by_price_band || null }, stats: null, source: "app/data/valuation_backtest_benchmarks.json" };
  return null;
}

// ---------------------------------------------------------------- transit: planned-rail stop cities near a point
// Corridor stop records (app/data/intercity_transit_corridors.json proposed_stations) are city points, not stations.
function stopsNear(point, corridors, countyFips, miles) {
  const r = num(miles) || STOP_RADIUS_MI, out = [];
  if (!point || num(point.lat) == null || num(point.lng) == null) return out;
  for (const c of corridors || []) for (const s of (c && c.proposed_stations) || []) {
    if (!s || num(s.lat) == null || num(s.lng) == null || (countyFips && s.fips !== countyFips)) continue;
    const d = haversineMi(point, { lat: s.lat, lng: s.lng });
    if (d <= r) out.push({ corridorId: c.id, corridorName: c.name, corridorType: c.corridor_type || null, corridorStatus: (c.verification && c.verification.status) || "unverified", stopId: s.id, stopCity: s.city, miles: round(d, 2), coordinateBasis: s.coordinate_basis || null });
  }
  return out.sort((a, b) => a.miles - b.miles);
}
// Corridor type -> the study rows that speak to it. No row covers high-speed or intercity rail as such, so those take
// the pooled "all rail station types" rows, and say so.
function effectModeFor(corridorType) {
  const t = String(corridorType || "");
  if (/commuter|regional/.test(t)) return { mode: "commuter rail", note: "the corridor is listed as intercity, commuter or regional rail; the commuter-rail rows are used" };
  return { mode: "all rail station types", note: /high_speed/.test(t) ? "no study on file covers high-speed rail stations; the pooled all-rail rows are shown" : "no study on file covers intercity rail stations as such; the pooled all-rail rows are shown" };
}
function transitUplift(nearStops, effects) {
  if (!nearStops || !nearStops.length) return null;
  const s = nearStops[0], m = effectModeFor(s.corridorType);
  const rows = ((effects && effects.rows) || effects || []).filter(r => r && r.mode === m.mode && num(r.effect_pct) != null && /verified/.test((r.verification && r.verification.status) || ""));
  const pref = rows.filter(r => r.property_type === "residential");
  const use = pref.length ? pref : rows;
  return {
    stop: { city: s.stopCity, corridor: s.corridorName, miles: s.miles, corridorStatus: s.corridorStatus },
    modeUsed: m.mode, modeNote: m.note,
    bands: use.map(r => ({ band: r.distance_band, propertyType: r.property_type || null, study: r.study, url: r.source_url || null, estimates: num(r.n_estimates),
      average: fig(r.effect_pct, "% change in property value", r.source_url, "measured"),
      range: range(r.range_low_pct, r.range_high_pct, "% change in property value (lowest to highest published estimate)", r.source_url, "measured"),
      caveat: r.caveat || null })),
    caution: `The station site is not chosen: ${s.stopCity} is a stop city in the corridor record, placed at a city point (${s.coordinateBasis ? "the record's own note: " + String(s.coordinateBasis).replace(/\.$/, "") : "its basis is not stated"}; ${s.miles ? s.miles + " miles from here" : "the neighborhoods counted lie within " + STOP_RADIUS_MI + " mile of that point"}). Each band applies only to land at that distance from the eventual station. The corridor record's own check: ${String(s.corridorStatus).replace(/_/g, " ")}.`,
    missing: use.length ? [] : [`no verified study row for ${m.mode} in app/data/transit_value_effects.json`],
  };
}

// ---------------------------------------------------------------- legal basis
const ADU_LAW = s => /(^|_)adu(_|$)/i.test(String(s.id));
const UNITS_LAW = s => !ADU_LAW(s) && num(s.max_units_by_right) != null && s.max_units_by_right >= 2;
const MF_LAW = s => num(s.min_allowed_density_du_per_acre) != null || /live_local|sb840|ab2011|sb79/.test(String(s.id));
function zoningResult(parcel, laws, zoningFn) {
  if (!parcel) return { ran: false, why: "no parcel record for this subject" };
  const code = parcel.base_zoning_code;
  if (!code || /^(unzoned|unknown|missing|none|n\/a)$/i.test(String(code).trim())) return { ran: false, why: "the zoning code is not on file for this " + (parcel._kind || "lot") };
  const fn = zoningFn || _evalHousing;
  if (!fn) return { ran: false, why: "the statute engine is not loaded" };
  let z = null;
  try { z = fn(Object.assign({}, parcel, { exclusions: Object.assign({}, parcel.exclusions || {}) }), laws); } catch (e) { z = null; }
  if (!z) return { ran: false, why: "the statute engine did not run" };
  if (z.laws_loaded === false) return { ran: false, why: "the state law table (app/data/statutes.json) is not loaded" };
  return { ran: true, z, applicable: z.applicable_statutes || [], held: (z.not_confirmed || []).concat(z.excluded_by_statute || []) };
}
const heldFor = (zr, test) => zr && zr.held ? zr.held.filter(h => test({ id: h.id, max_units_by_right: (lawById(zr.lawsRef, h.id) || {}).max_units_by_right, min_allowed_density_du_per_acre: (lawById(zr.lawsRef, h.id) || {}).min_allowed_density_du_per_acre })).map(h => `${h.name}: ${h.reason}`) : [];
function legalFromStatute(s, laws) {
  const rec = lawById(laws, s.id) || {};
  return { determined: true, basis: "statute", statuteId: s.id, citation: s.citation, url: s.statute_url || null, verification: s.verification_status || null,
    checked: rec.last_verified || (rec.verification && rec.verification.checked_on) || null,
    unconfirmedFields: s.unconfirmed_fields || [], limitsNotChecked: s.exclusion_limits_not_checked || [], note: "a screen, not a permit: the city or county decides" };
}

// ---------------------------------------------------------------- the card
/**
 * buildProjectCard(subject, ctx)
 *  subject: { kind: "site"|"lot"|"neighborhood"|"stop_area", id, name, countyFips, stateCode, city,
 *             parcel?: statute-engine parcel facts (lot, site), acres?: figure, point?: { lat, lng },
 *             railStationMi?: measured distance to an existing rail station (any mode),
 *             nearStops?: [...] (stopsNear output; computed from point and ctx.corridors when absent),
 *             currentValue?: { value, source, method, tested: { mdape, p80 } } (lot: the page's back-tested estimate),
 *             blockGroups?: [{ id, hv, hvSource }] (neighborhood, stop_area), sitesNearby?: number }
 *  ctx: { laws, buildingCosts (rows), fundingRules, incomeLimits, fmr, valuationModels, transitEffects, corridors, zoningEngine? }
 */
function buildProjectCard(subject, ctx) {
  ctx = ctx || {};
  const S = Object.assign({}, subject || {});
  const fips = S.countyFips || null, state = S.stateCode || null;
  const costRows = Array.isArray(ctx.buildingCosts) ? ctx.buildingCosts : (ctx.buildingCosts && ctx.buildingCosts.rows) || [];
  const nearStops = Array.isArray(S.nearStops) ? S.nearStops : stopsNear(S.point, ctx.corridors, fips, STOP_RADIUS_MI);
  const uplift = transitUplift(nearStops, ctx.transitEffects);
  const isParcel = S.kind === "lot" || S.kind === "site";
  const zr = isParcel ? zoningResult(S.parcel ? Object.assign({ _kind: S.kind }, S.parcel) : null, ctx.laws, ctx.zoningEngine) : { ran: false, why: S.kind === "stop_area" ? `the legal basis depends on each site's zoning, and ${num(S.sitesNearby) ? S.sitesNearby + " redevelopment site(s) with a record are within " + STOP_RADIUS_MI + " mile (see each site's own card)" : "no redevelopment site with a record is within " + STOP_RADIUS_MI + " mile of this stop city point"}; the station site itself is not chosen` : "the legal basis depends on each lot's zoning; open a lot on the map" };
  if (zr) zr.lawsRef = ctx.laws;
  const fmr = fmrFor(ctx.fmr, fips);
  const ilim = incomeLimitsFor(ctx.incomeLimits, fips);
  const vm = valuationModel(ctx.valuationModels, fips, ctx.valuationBenchmarks);
  const lotSqft = S.parcel ? num(S.parcel.lot_sqft) : null;
  const acres = S.acres && num(S.acres.value) != null ? S.acres.value : (lotSqft != null ? lotSqft / SQFT_PER_ACRE : null);
  const acresSrc = S.acres && num(S.acres.value) != null ? S.acres.source : (lotSqft != null ? "lot area from the parcel record" : null);

  const courses = [], notAssessed = [], internal = [];
  const skip = (c, missing, kind) => notAssessed.push({ id: c.id, label: c.label + (c.affordable ? " (and with an affordable share)" : ""), kind: kind || "missing", missing: [].concat(missing).filter(Boolean) });

  for (const c of COURSES) {
    let legal = null, sizing = null;
    if (c.id === "hold") {
      legal = { determined: true, basis: "none needed", note: "keeping the property as it is needs no approval; renting spaces to the public may need a local permit (local rules are not on file)" };
    } else if (!zr.ran) {
      skip(c, zr.why); continue;
    } else if (c.id === "adu" && S.kind === "site") {
      // a redevelopment site record (golf course, parking lot, vacant land) shows no home; the ADU law on file covers lots
      // with a proposed or existing dwelling, and building the main home is a different course
      skip(c, `the site record shows no existing home (${S.siteKind || "site"}); the ADU law on file covers lots with a proposed or existing dwelling, and building the main home is not one of these courses`, "does_not_apply"); continue;
    } else if (c.id === "adu") {
      const s = zr.applicable.find(ADU_LAW);
      if (!s) { const h = heldFor(zr, ADU_LAW); skip(c, h.length ? h : [S.parcel.is_single_family_residential || S.parcel.is_multifamily_residential ? `no state ADU law on file for ${state || "this state"} applies to this ${S.kind}; local ADU rules (not on file) decide` : `the ${S.kind}'s zoning (${S.parcel.base_zoning_code}) is not classed here as single-family or multifamily residential, so no ADU law on file was applied`]); continue; }
      legal = legalFromStatute(s, ctx.laws);
      sizing = { units: range(1, 1, "homes added", "the course adds one accessory dwelling unit", "measured", "one ADU is the course itself"), sqft: null,
        sqftWhy: "the ADU law record on file sets no floor-area limit for this lot" + ((s.unconfirmed_fields || []).some(u => /adus_by_right/.test(u)) ? "; its count of ADUs per lot is listed as not confirmed" : "") };
    } else if (c.id === "state_law_units") {
      const s = zr.applicable.find(UNITS_LAW);
      if (!s) { const h = heldFor(zr, UNITS_LAW); skip(c, h.length ? h : [`no state law on file that allows two or more units by right applies to this ${S.kind}`]); continue; }
      legal = legalFromStatute(s, ctx.laws);
      sizing = { units: range(s.max_units_by_right, s.max_units_by_right, "homes in total on the lot (up to)", s.statute_url || "app/data/statutes.json", "measured", "the law's own limit"), sqft: null, sqftWhy: "the law sets a unit count, not a floor area" };
    } else {
      // multifamily: a multifamily law applied by the statute engine, or the lot's own multifamily zoning on file
      const s = zr.applicable.find(MF_LAW);
      const mfZone = !!(S.parcel && S.parcel.is_multifamily_residential);
      const station = c.id !== "small_multifamily";
      const railOk = num(S.railStationMi) != null && S.railStationMi <= RAIL_STATION_AREA_MI;
      if (station && !railOk && !nearStops.length) { skip(c, num(S.railStationMi) != null ? `the nearest rail station on file is ${round(S.railStationMi, 2)} miles away (station-area courses need one within ${RAIL_STATION_AREA_MI} mile) and no planned-rail stop city is within ${STOP_RADIUS_MI} mile` : `no rail station distance is on file for this ${S.kind} and no planned-rail stop city is within ${STOP_RADIUS_MI} mile`, "does_not_apply"); continue; }
      if (!s && !mfZone) {
        const h = heldFor(zr, MF_LAW);
        const why = [`the ${S.kind}'s zoning (${S.parcel.base_zoning_code}) is not classed as multifamily, and ${h.length ? "no state multifamily law on file could be applied: " + h.length + " could not be confirmed (listed next)" : "no state multifamily law on file applies"}`].concat(h.slice(0, 3)).concat(h.length > 3 ? [`and ${h.length - 3} more laws on file with the same kind of gap`] : []);
        if (station && S.railNote) why.push(S.railNote);
        skip(c, why); continue;
      }
      if (s) {
        legal = legalFromStatute(s, ctx.laws);
        const d = num(s.min_allowed_density_du_per_acre), far = num(s.max_far);
        const units = d != null && acres != null ? range(Math.floor(acres * d), Math.floor(acres * d), "homes the law requires the city to allow at least", s.statute_url || "app/data/statutes.json", "modelled", "the law's minimum density times the measured site area") : null;
        const sqft = far != null && acres != null ? range(Math.floor(far * acres * SQFT_PER_ACRE), Math.floor(far * acres * SQFT_PER_ACRE), "sq ft of floor area (the law's floor-area limit)", s.statute_url || "app/data/statutes.json", "modelled", "the law's floor-area ratio times the measured site area") : null;
        sizing = { units, sqft, density: d, far, acres, acresSrc,
          unitsWhy: units ? null : d == null ? "the law on file sets no minimum density" : "the site area is not on file",
          sqftWhy: sqft ? null : far == null ? "the law on file sets no floor-area ratio" : "the site area is not on file" };
      } else {
        legal = { determined: true, basis: "zoning on file", zone: S.parcel.base_zoning_code, note: `the zoning map classes ${S.parcel.base_zoning_code} as multifamily; a screen, not a permit` };
        sizing = { units: null, sqft: null, unitsWhy: `the density limit for ${S.parcel.base_zoning_code} is not in the zoning standards on file (app/data/zoning_standards.json)`, sqftWhy: "no floor-area limit for this zone on file" };
      }
    }
    const variants = c.affordable ? [false, true] : [false];
    for (const aff of variants) courses.push(courseFigures(c, aff, { S, legal, sizing, costRows, fmr, ilim, vm, uplift, ctx, state, fips, internal }));
  }
  const order = courses.slice().sort(evidenceCompare);
  const missing = [...new Set(courses.flatMap(x => x.missing).concat(notAssessed.flatMap(x => x.missing)))];
  return {
    schema: "city-pretty/project-card@1", engineVersion: PROJECT_CARD_ENGINE_VERSION,
    subject: { kind: S.kind, id: S.id || null, name: S.name || null, countyFips: fips, stateCode: state, city: S.city || null,
      acres: acres != null ? fig(round(acres, 2), "acres", acresSrc, "measured") : null, nearStops },
    courses: order, notAssessed, missing,
    ordering: "courses with a measured cost first, then modelled, then those with no cost; then by the legal basis's own check (verified before partly verified); then the fixed menu order. No course is ranked by a return figure: none has a tested basis.",
    internal_only: { note: "INTERNAL USE ONLY. Estimates from rows marked display_allowed: false (ICC Building Valuation Data). Never rendered on the page and never sent to the advisor (cardsForAdvisor drops this branch).", estimates: internal },
  };
}

const BASIS_RANK = { measured: 0, modelled: 1, assumed: 2 };
const LEGAL_RANK = { verified: 0, partially_verified: 1 };
function evidenceCompare(a, b) {
  const ca = a.cost ? BASIS_RANK[a.cost.basis] ?? 3 : 4, cb = b.cost ? BASIS_RANK[b.cost.basis] ?? 3 : 4;
  if (ca !== cb) return ca - cb;
  const la = LEGAL_RANK[a.legal.verification] ?? 2, lb = LEGAL_RANK[b.legal.verification] ?? 2;
  if (la !== lb) return la - lb;
  return (COURSE_INDEX[a.course] - COURSE_INDEX[b.course]) || ((a.affordable ? 1 : 0) - (b.affordable ? 1 : 0));
}

function courseFigures(c, aff, k) {
  const { S, legal, sizing, costRows, fmr, ilim, vm, uplift, ctx, state, fips, internal } = k;
  const inputs = [], missing = [], risks = [];
  const out = { course: c.id, affordable: aff, label: c.label + (aff ? " with an affordable share" : ""), legal, size: null, cost: null, costWhy: null, publicMoney: [], income: null, incomeWhy: null, value: null, valueWhy: null, transitUplift: uplift, inputs, missing, risks };
  if (legal.basis === "statute") {
    inputs.push(inputRow("Legal basis", legal.citation, null, legal.url || "app/data/statutes.json", "measured", `law text check: ${String(legal.verification || "not on file").replace(/_/g, " ")}${legal.checked ? ", " + legal.checked : ""}`));
    for (const u of legal.unconfirmedFields) risks.push(`Legal: not confirmed in the law's text: ${u}`);
    for (const u of legal.limitsNotChecked) risks.push(`Legal: the law limits itself where ${u}; not checked for this ${S.kind}`);
    risks.push("Legal: " + legal.note);
  } else if (legal.basis === "zoning on file") inputs.push(inputRow("Legal basis", legal.note, null, "the parcel zoning layer", "measured"));
  else risks.push("Legal: " + legal.note);

  // ---- size
  if (c.id === "hold") {
    out.size = S.acres && num(S.acres.value) != null ? { area: range(S.acres.value, S.acres.value, "acres (the property as it is)", S.acres.source, "measured", "measured parcel area") } : null;
    out.sizeWhy = out.size ? null : (S.kind === "neighborhood" || S.kind === "stop_area") ? "a neighborhood has no single property to size" : "the property's area is not on file";
    missing.push(`Size: the number of rentable spaces (parking, storage, roof) is not on file for this ${S.kind}`);
  } else {
    out.size = sizing ? { units: sizing.units, sqft: sizing.sqft } : null;
    if (sizing && !sizing.units) missing.push("Size (homes): " + (sizing.unitsWhy || "not sized"));
    if (sizing && !sizing.sqft) missing.push("Size (floor area): " + (sizing.sqftWhy || "not sized"));
    if (sizing && sizing.units) inputs.push(inputRow("Homes", sizing.units.low.value, sizing.units.unit, sizing.units.source, sizing.units.basis, sizing.units.exact));
    if (sizing && sizing.density != null) inputs.push(inputRow("Minimum density the law requires", sizing.density, "homes per acre", legal.url, "measured"));
    if (sizing && sizing.far != null) inputs.push(inputRow("Floor-area ratio the law allows", sizing.far, "x site area", legal.url, "measured"));
    if (sizing && sizing.acres != null && (sizing.density != null || sizing.far != null)) inputs.push(inputRow("Site area", round(sizing.acres, 2), "acres", sizing.acresSrc, "measured"));
  }

  // ---- cost (displayable rows only)
  if (c.id === "hold") {
    holdCost(out, S, vm, inputs, missing);
  } else if (c.id === "adu") {
    const sq = laAduRow(costRows, S.city, "per_sqft"), pu = laAduRow(costRows, S.city, "per_unit");
    const size = pu ? num(+((String(pu.unit).match(/median size ([\d,]+) sq ft/) || [])[1] || "").replace(/,/g, "")) : null;
    if (sq && Array.isArray(sq.range) && size != null) {
      out.cost = range(sq.range[0] * size, sq.range[1] * size, "USD, declared permit valuation", sq.source_url, "modelled");
      out.cost.label = "declared permit valuations";
      inputs.push(inputRow(`Declared cost per sq ft, new-construction ADUs, Los Angeles ${sq.year} (middle half of permits)`, null, "USD per sq ft", sq.source_url, "measured", `${sq.range[0]} to ${sq.range[1]} (median ${sq.value}); ${sq.quote}`));
      inputs[inputs.length - 1].range = range(sq.range[0], sq.range[1], "USD per sq ft", sq.source_url, "measured");
      inputs.push(inputRow(`Median floor area of those permits (${pu.year})`, size, "sq ft", pu.source_url, "measured", "the typical size permitted in Los Angeles, not a limit for this lot"));
      inputs.push(inputRow(`Median declared cost per ADU (${pu.year})`, pu.value, "USD", pu.source_url, "measured", pu.quote));
      risks.push(`Cost: ${sq.unit}; declared permit valuations usually leave out land, fees, utility hookups and some site work`);
      risks.push(`Cost: the size used is the median of permitted Los Angeles ADUs (${size} sq ft); a larger or smaller unit costs more or less`);
    } else {
      out.costWhy = `cost not on file for this place: the only displayable ADU cost rows are City of Los Angeles permit valuations${S.city ? ` and this ${S.kind} is in ${S.city}` : ` and this ${S.kind}'s city is not on file`}`;
    }
    internalEstimate(internal, out, "R-3", ["VB", "VA"], S, state, costRows, size != null ? size : null, size != null ? "median floor area of permitted Los Angeles ADUs" : null);
  } else {
    out.costWhy = `cost not on file for this place: no displayable construction cost for ${/station/.test(c.id) || c.id === "small_multifamily" ? "multifamily buildings" : "added units"} in ${state || "this state"} (${PROMPT.build_cost})`;
    if (c.id === "station_prefab") risks.push("Cost: no study on file gives a like-for-like prefabricated versus conventional cost for finished multifamily buildings; the schedule and cost findings on file (Terner Center) are not cleared for display");
    const gross = out.size && out.size.sqft ? out.size.sqft.low.value : null;
    internalEstimate(internal, out, "R-2", ["VB", "VA", "IIIA", "IA"], S, state, costRows, gross, gross != null ? "the law's floor-area limit times the site area" : null);
  }
  if (!out.cost && out.costWhy) missing.push("Cost: " + out.costWhy);
  if (c.id !== "hold" && !out.cost) {
    const f = dodStateFactor(costRows, state);
    if (f) inputs.push(inputRow(`Regional cost factor on file (${STATE_NAMES[state]}, DoD area cost factor; no displayable base cost here to apply it to)`, f.value, "x the 96-city average", f.source_url, "measured", `sites range ${f.range ? f.range.join(" to ") : "not on file"}. Publisher's limit: "Do not use the MILCON ACFs to modify ... commercial cost data"`));
  }

  // ---- income
  const brBand = c.id === "adu" ? [0, 2] : [0, 3];
  if (c.id === "hold") {
    out.incomeWhy = `space rental income not on file: no sourced rate for parking, storage or roof space is in the data (${PROMPT.space_rent})`;
    missing.push("Income: " + out.incomeWhy);
  } else if (aff) {
    affordableIncome(out, S, ilim, ctx, inputs, missing);
  } else if (fmr) {
    const lo = Math.min(...fmr.br.slice(brBand[0], brBand[1] + 1)), hi = Math.max(...fmr.br.slice(brBand[0], brBand[1] + 1));
    const src = fmr.url || "app/data/hud_fair_market_rents.json";
    out.income = { perUnitMonthly: range(lo, hi, "USD per home per month (HUD Fair Market Rent)", src, "measured"), label: "HUD Fair Market Rents: payment standards (40th-percentile gross rent including utilities), not market rents" };
    if (out.size && out.size.units && out.size.units.exact && c.id === "adu") out.income.yearly = range(lo * 12, hi * 12, "USD per year for the one ADU (HUD Fair Market Rent x 12)", src, "modelled");
    inputs.push(inputRow(`HUD Fair Market Rent FY${fmr.fy}, ${fmr.area}`, null, "USD per month", src, "measured", fmr.br.map((v, i) => `${i === 0 ? "studio" : i + " bed"} $${v}`).join(", ")));
    inputs.push(inputRow("Bedrooms per home", `${brBand[0] === 0 ? "studio" : brBand[0]} to ${brBand[1]} bedrooms`, null, "not on file: the course does not set a bedroom count", "assumed"));
    risks.push("Income: HUD Fair Market Rents are payment standards for vouchers, not what a new home here would rent for; vacancy, upkeep and taxes are not taken off");
  } else {
    out.incomeWhy = `HUD Fair Market Rent not on file for county ${fips}`;
    missing.push("Income: " + out.incomeWhy);
  }

  // ---- value
  if (c.id === "hold") {
    if (out.cost) { out.value = Object.assign({}, out.cost, { label: out.cost.label }); out.valueNote = "today's value of the property as it is; the course adds no building"; }
    else { out.valueWhy = out.costWhy; }
  } else {
    out.valueWhy = vm
      ? `no finished value: this county's tested home-value model (median error ${round(vm.tested.mdape * 100, 1)}% on ${vm.tested.n.toLocaleString("en-US")} test sales) was tested on existing one- and two-family homes, not on ${c.id === "adu" ? "lots with a new ADU" : "new apartment buildings"}; a value needs a sourced capitalisation rate or a valuation model tested on this kind of building here`
      : "no finished value: a value needs a sourced capitalisation rate or a valuation model tested on this kind of building in this county; neither is on file (income and cost are shown instead)";
    missing.push("Value: " + out.valueWhy);
  }
  if (uplift) {
    risks.push(`Transit: ${uplift.caution}`);
    for (const b of uplift.bands) if (b.caveat) { risks.push(`Transit study: ${b.caveat}`); break; }
  }
  // public money (affordable variants)
  if (aff) publicMoney(out, S, legal, ctx, ilim, inputs, missing);
  out.missing = [...new Set(missing)];
  out.risks = [...new Set(risks)];
  return out;
}

function holdCost(out, S, vm, inputs, missing) {
  if (S.kind === "lot") {
    const cv = S.currentValue;
    // the tested error band for the estimate's price band (the bands the back-test reports), else none
    const band = cv && num(cv.value) != null ? (cv.value < 500000 ? "under $500k" : cv.value < 1000000 ? "$500k-$1M" : cv.value < 2000000 ? "$1M-$2M" : "$2M and up") : null;
    const bm = vm && band && vm.tested.by_price_band ? vm.tested.by_price_band[band] : null;
    const p80 = bm ? num(bm.p80_abs_error) : null;
    if (cv && band) cv.tested = Object.assign({}, cv.tested || {}, { band, p80 });
    if (cv && num(cv.value) != null && cv.recordedSale) {
      out.cost = range(cv.value, cv.value, "USD, recorded sale price", cv.source || "the county's recorded sale", "measured", "a recorded sale price");
      out.cost.label = "recorded sale";
      inputs.push(inputRow("Recorded sale price", cv.value, "USD", cv.source || null, "measured", cv.method || null));
      return;
    }
    if (cv && num(cv.value) != null && vm && p80 != null) {
      out.cost = range(Math.round(Math.max(0, cv.value * (1 - p80))), Math.round(cv.value * (1 + p80)), "USD, today's value (back-tested estimate; 80% of test sales were within this band)", cv.source || vm.source, "modelled");
      out.cost.label = "back-tested home-value estimate";
      inputs.push(inputRow("Back-tested estimate for this lot", cv.value, "USD", cv.source || vm.source, "modelled", cv.method || null));
      inputs.push(inputRow(`Tested error band (${cv.tested.band || "all sales"}): 80% of test sales were within`, round(p80 * 100, 1), "%", vm.source, "measured", `median error ${round(vm.tested.mdape * 100, 1)}% on ${vm.tested.n.toLocaleString("en-US")} sales`));
      return;
    }
    out.costWhy = !vm ? "the purchase price is not on file: this county has no home-value model that passed its back-test" : (cv && cv.reason) ? "the purchase price is not on file: " + cv.reason : !cv ? "the purchase price is not on file: the back-tested estimate for this lot has not been computed (open the lot's panel on the map)" : "the purchase price is not on file: no tested error band for this price band";
    return;
  }
  if (S.kind === "site") { out.costWhy = "the purchase price is not on file: the site record's market land value is an unverified model estimate, and its assessed value is a tax base, not a price"; return; }
  // neighborhood, stop area: recorded sales medians (passed county) or Census medians, per block group
  const bgs = S.blockGroups || [];
  const sales = vm ? bgs.map(b => ({ b, s: vm.stats && vm.stats.bg ? vm.stats.bg[b.id] : null })).filter(x => x.s && x.s[0] >= 5) : [];
  if (sales.length) {
    const vals = sales.map(x => x.s[1]), n = sales.reduce((a, x) => a + x.s[0], 0);
    const d0 = sales.map(x => x.s[3]).sort()[0], d1 = sales.map(x => x.s[4]).sort().slice(-1)[0];
    out.cost = range(Math.min(...vals), Math.max(...vals), sales.length === 1 ? "USD, median recorded sale price in this block group" : "USD, median recorded sale price, lowest to highest block group", "app/data/county_valuation_models.json", "measured", sales.length === 1 ? "a median of recorded sales, not a price range" : null);
    out.cost.label = "recorded sales";
    inputs.push(inputRow(`Recorded sales (${n} sales, ${String(d0).slice(0, 7)} to ${String(d1).slice(0, 7)}, ${sales.length} block group${sales.length === 1 ? "" : "s"} with 5 or more)`, null, null, "app/data/county_valuation_models.json", "measured", "the sales the county's tested model is anchored on"));
    return;
  }
  // Census top-codes the median at $2,000,000 or more (stored as 2,000,001) and bottom-codes it at $10,000 or less: such a
  // block group has no upper (or lower) figure, so it is left out of the range and counted instead.
  const coded = bgs.filter(b => num(b.hv) != null && (b.hv >= 2000001 || b.hv <= 10000));
  const hv = bgs.filter(b => num(b.hv) != null && !coded.includes(b));
  if (coded.length) inputs.push(inputRow(`Block groups left out of the range: Census reports their median as "$2,000,000 or more" or "$10,000 or less"`, coded.length, "block groups", hv.length ? hv[0].hvSource : coded[0].hvSource, "measured"));
  if (hv.length) {
    const vals = hv.map(b => b.hv);
    out.cost = range(Math.min(...vals), Math.max(...vals), hv.length === 1 ? "USD, Census median home value in this block group (owners' own estimate)" : "USD, Census median home value, lowest to highest block group (owners' own estimate)", hv[0].hvSource || "Census ACS 5-year median home value", "measured", hv.length === 1 ? "a Census median, not a price range" : null);
    out.cost.label = "Census median home value";
    inputs.push(inputRow(`Census median home value, ${hv.length} block group${hv.length === 1 ? "" : "s"}`, null, null, hv[0].hvSource || "Census ACS 5-year", "measured", "owners' own estimate of value, not a sale price"));
    return;
  }
  out.costWhy = "no recorded sales or Census home value on file for these block groups";
}

function affordableIncome(out, S, ilim, ctx, inputs, missing) {
  const share = fundingRow(ctx.fundingRules, "max_rent_share");
  if (!ilim.row) { out.incomeWhy = `HUD income limits not on file for county ${S.countyFips}${ilim.failed ? ": " + ilim.failed.reason : ""}`; missing.push("Income: " + out.incomeWhy); return; }
  if (!share) { out.incomeWhy = "the statute's rent rule (30 percent of the income limit) is not on file"; missing.push("Income: " + out.incomeWhy); return; }
  const k = num(share.value), r = ilim.row, api = (ilim.api || "").replace("<county FIPS>", r.fips);
  const l50 = range(r.il50[0] * k / 12, r.il50[3] * k / 12, "USD per home per month, rent ceiling at the 50% income limit (households of 1 to 4)", api || "app/data/hud_income_limits.json", "modelled");
  const l80 = range(r.il80[0] * k / 12, r.il80[3] * k / 12, "USD per home per month, rent ceiling at the 80% income limit (households of 1 to 4)", api || "app/data/hud_income_limits.json", "modelled");
  out.income = { perUnitMonthly: l50, at80: l80, label: "rent ceilings from HUD income limits (gross rent; the utility allowance comes off): limits, not market rents" };
  inputs.push(inputRow(`HUD income limits FY${ilim.year}, ${r.area_name}: 50% limit, 1 to 4 people`, null, "USD per year", api || "app/data/hud_income_limits.json", "measured", `$${r.il50[0].toLocaleString("en-US")} to $${r.il50[3].toLocaleString("en-US")}; 80% limit $${r.il80[0].toLocaleString("en-US")} to $${r.il80[3].toLocaleString("en-US")}`));
  inputs.push(inputRow("Rent ceiling share of the income limit", k, "fraction", share.source_url, "measured", `"${share.quote}"`));
  missing.push("Income: the 60% limit (the usual tax-credit limit) is not on file: HUD's API gives 30, 50 and 80 percent only");
}

function publicMoney(out, S, legal, ctx, ilim, inputs, missing) {
  const R = ctx.fundingRules;
  const floor9 = fundingRow(R, "applicable_percentage_floor", r => r.value === 0.09), floor4 = fundingRow(R, "applicable_percentage_floor", r => r.value === 0.04);
  const boost = fundingRow(R, "eligible_basis_multiplier"), aside = fundingRow(R, "min_set_aside");
  const list = out.publicMoney;
  const lihtcWhy = [!out.cost ? "the development cost (the eligible basis the credit is a share of) is not on file for this place" : null, "whether the site is in a 2027 qualified census tract or difficult development area is not on file (HUD's list download was not read)", "the state's award (credits are competitive) is not known"].filter(Boolean);
  if (floor9 || floor4) {
    list.push({ programme: "Low-Income Housing Tax Credit (federal)", status: "could apply; not computed", why: lihtcWhy,
      rules: [floor9, floor4, boost, aside].filter(Boolean).map(r => ({ text: r.what_it_funds_or_limits, value: typeof r.value === "number" ? r.value : null, valueText: typeof r.value === "object" && r.value ? JSON.stringify(r.value) : null, quote: r.quote, url: r.source_url })) });
    if (aside && out.size && out.size.units && out.size.units.low.value != null) {
      const u = out.size.units.low.value, shareU = aside.value.share_of_units;
      out.affordableUnits = range(Math.ceil(u * shareU), Math.ceil(u * shareU), `homes at or under the ${aside.value.income_limit_pct_ami}% income limit (the statute's 20-50 test, at least)`, aside.source_url, "modelled", "the statute's minimum share times the homes sized above");
    }
  }
  const home = ((R && R.rows) || []).filter(r => r && r.measure === "max_per_unit_subsidy" && r.display_allowed === true);
  if (home.length) {
    const vals = home.map(r => r.value);
    list.push({ programme: "HOME Investment Partnerships (federal, through the local participating jurisdiction)", status: "could apply; not computed", why: ["an award depends on the local participating jurisdiction's own choices, which are not on file"],
      cap: range(Math.min(...vals), Math.max(...vals), "USD per HOME-assisted home, the federal cap (studio to 4+ bedrooms)", home[0].source_url, "measured"), capNote: home[0].edition });
  }
  if (fundingRow(R, "basic_statutory_mortgage_limit")) list.push({ programme: "FHA multifamily mortgage insurance (HUD Section 221(d)(4) and others)", status: "could apply; not computed", why: ["this county's HUD base city for the high cost percentage is not mapped on file", "the loan depends on underwriting, not only the per-unit limit"] });
  if (legal.statuteId === "fl_live_local") {
    const rec = lawById(ctx.laws, "fl_live_local") || {};
    list.push({ programme: "Florida Live Local Act property-tax exemption (Fla. Stat. 196.1978(3))", status: "could apply; not computed", why: ["the 120% income limit the exemption uses is not on file (HUD's API gives 30, 50 and 80 percent only)", "the assessed value of the new homes is not known before they are built"],
      rules: [{ text: rec.tax_exemption_note || "exemption share in the statute record", value: num(rec.tax_exemption_pct), quote: null, url: rec.statute_url || null }] });
  }
  list.push({ programme: "State housing tax credits, trust funds and density bonuses", status: "not on file", why: [`not loaded yet (${PROMPT.funding})`] });
  for (const p of list) if (p.status !== "computed") missing.push(`Public money: ${p.programme}: ${p.why.join("; ")}`);
}

// ICC table x DoD state factor x floor area: internal use only (display_allowed: false). Never on the page.
function internalEstimate(internal, out, group, types, S, state, rows, sqft, sqftBasis) {
  const icc = types.map(t => iccRow(rows, group, t)).filter(Boolean);
  const f = dodStateFactor(rows, state);
  const base = { course: out.course, affordable: out.affordable, subject: S.id || S.name || null };
  if (!icc.length) { internal.push(Object.assign(base, { computed: false, why: "ICC rows not passed in" })); return; }
  if (sqft == null) { internal.push(Object.assign(base, { computed: false, why: "no floor area on file to multiply" })); return; }
  if (!f || !Array.isArray(f.range)) { internal.push(Object.assign(base, { computed: false, why: "no DoD factor for this state" })); return; }
  const lo = Math.min(...icc.map(r => r.value)) * f.range[0] * sqft, hi = Math.max(...icc.map(r => r.value)) * f.range[1] * sqft;
  internal.push(Object.assign(base, { computed: true, low: round(lo, 0), high: round(hi, 0), unit: "USD, hard cost only (ICC national average x DoD state factor range x floor area)", floorArea: sqft, floorAreaBasis: sqftBasis, iccGroup: group, iccTypes: types, dodFactorRange: f.range,
    caveats: ["ICC: 'This data table is not intended to be used as an estimating guide'", "DoD: not meant to modify commercial cost data", "excludes land, site work, fees, financing and soft costs"] }));
}

// ---------------------------------------------------------------- budget
/**
 * fitToBudget(cards, dollars): the courses whose cost range's upper bound is at or under the budget (within), those whose
 * range straddles it, those wholly over it, and those with no cost on file. Each list keeps the cards' evidence order
 * (evidenceCompare); nothing is ranked by a return figure.
 */
function fitToBudget(cards, dollars) {
  const b = num(dollars);
  const out = { budget: b, within: [], straddle: [], over: [], uncosted: 0, uncostedCourses: [], notAssessed: 0,
    ordering: "each list in the cards' evidence order (measured cost before modelled; verified legal basis before partly verified; then the fixed menu); never by a return figure" };
  (cards || []).forEach((card, ci) => {
    if (!card) return;
    out.notAssessed += (card.notAssessed || []).length;
    for (const x of card.courses || []) {
      const row = { card: ci, subject: card.subject.name || card.subject.id, subjectKind: card.subject.kind, course: x.course, affordable: x.affordable, label: x.label, cost: x.cost, costLabel: x.cost ? x.cost.label || null : null };
      if (!x.cost) { out.uncosted++; out.uncostedCourses.push(Object.assign(row, { why: x.costWhy })); continue; }
      if (b == null) continue;
      if (x.cost.high.value <= b) out.within.push(row);
      else if (x.cost.low.value <= b) out.straddle.push(row);
      else out.over.push(row);
    }
  });
  const cmp = (a, c) => evidenceCompare(cards[a.card].courses.find(z => z.course === a.course && z.affordable === a.affordable), cards[c.card].courses.find(z => z.course === c.course && z.affordable === c.affordable)) || (a.card - c.card);
  out.within.sort(cmp); out.straddle.sort(cmp); out.over.sort(cmp);
  return out;
}

// ---------------------------------------------------------------- advisor form
// Compact, no internal_only branch, capped in size. Every figure keeps its unit, basis and source.
function cardsForAdvisor(cards, maxChars) {
  const cap = num(maxChars) || 6000;
  const f = x => x && x.value != null ? { value: round(x.value, 0), unit: x.unit, basis: x.basis, source: x.source } : null;
  const r = x => x ? { low: round(x.low.value, 0), high: round(x.high.value, 0), unit: x.unit, basis: x.basis, source: urlOf(x.source) || x.source, exact: x.exact || undefined } : null;
  const short = s => String(s || "").slice(0, 220);
  const out = [];
  for (const c of cards || []) {
    if (!c) continue;
    out.push({ subject: { kind: c.subject.kind, id: c.subject.id, name: c.subject.name },
      courses: (c.courses || []).map(x => ({ course: x.label, legal: x.legal.basis === "statute" ? x.legal.citation : x.legal.basis, units: x.size && x.size.units ? r(x.size.units) : null,
        cost: r(x.cost), costLabel: x.cost ? x.cost.label || null : null, costWhy: x.cost ? null : short(x.costWhy), incomePerHomeMonthly: x.income ? r(x.income.perUnitMonthly) : null, incomeLabel: x.income ? x.income.label : short(x.incomeWhy),
        value: x.value ? r(x.value) : null, valueWhy: x.value ? null : short(x.valueWhy), publicMoney: x.publicMoney.map(p => p.programme + ": " + p.status),
        transitUplift: x.transitUplift ? x.transitUplift.bands.map(b => ({ band: b.band, average: f(b.average), range: r(b.range) })) : null })),
      notAssessed: (c.notAssessed || []).map(n => ({ course: n.label, why: short(n.missing[0]) })) });
  }
  const res = { schema: "city-pretty/project-cards-for-advisor@1", howToRead: "Courses of action per subject from app/data tables; ranges are low-high; a course with no cost says why. Ordered by evidence, not by return.", cards: out.slice() };
  while (JSON.stringify(res).length > cap && res.cards.length > 1) res.cards.pop();
  if (JSON.stringify(res).length > cap && res.cards.length === 1) { res.cards[0].notAssessed = res.cards[0].notAssessed.slice(0, 2); res.cards[0].courses = res.cards[0].courses.slice(0, 4); }
  if (JSON.stringify(res).length > cap) res.cards = [];   // the cap is a hard limit: the advisor brief must stay under the Worker's size limit
  res.truncated = out.length - res.cards.length;
  return res;
}

const api = { buildProjectCard, fitToBudget, cardsForAdvisor, stopsNear, transitUplift, COURSES, PROJECT_CARD_ENGINE_VERSION, _internal: { laAduRow, dodStateFactor, fmrFor, incomeLimitsFor, effectModeFor, evidenceCompare } };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.ProjectCardEngine = api;
})();
