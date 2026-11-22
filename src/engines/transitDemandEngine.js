/**
 * Transit demand engine (browser global and CommonJS module; the one copy, loaded by index.html and the tests).
 *
 * Riders, fare revenue, operating cost, operating gap and capital cost for a transit line, each as a range from
 * sourced tables, never a single number. Pure functions: no network, no file reads. Every table is passed in:
 *   tables.model      app/data/transit_demand_model.json      (station model fitted by scripts/transit/fit_station_ridership.py)
 *   tables.operating  app/data/transit_operating_benchmarks.json (NTD 2025 quartiles by mode; agency rows)
 *   tables.costRows   app/data/transit_cost_benchmarks.json rows (capital cost per mile of real projects)
 *   tables.funding    app/data/funding_programs.json rows
 *   tables.thresholds InvestmentDecisionEngine.TRANSIT_THRESHOLDS (FTA CIG quotes and breakpoints)
 * Method: docs/TRANSIT-DEMAND-MODEL.md. A missing input gives null plus a `missing` entry naming it.
 * A range is { low, high, mid, unit, basis, source, inputs }: low/high from the 25th/75th percentiles (or the bracket
 * stated in `inputs`), mid from the medians. basis: "measured" (read from a table) or "modelled" (computed).
 */
(function () {
"use strict";

const TRANSIT_DEMAND_VERSION = "1.0.0";
const FEATURES = ["ln_pop_half", "ln_jobs_half", "ln_pop_ring", "ln_jobs_ring", "terminal", "transfer"];
// engine mode -> NTD mode code (FTA NTD mode names: MB Bus, RB Bus Rapid Transit, LR Light Rail, HR Heavy Rail, CR Commuter Rail, SR Streetcar)
const NTD_CODE = { bus_frequency: "MB", brt: "RB", light_rail: "LR", heavy_rail: "HR", commuter_rail: "CR", streetcar: "SR" };
// capital benchmark rows used per mode (the same grouping as the Invest card's cost table, app/invest.js BENCH_GROUPS)
const COST_MODES = { bus_frequency: [], brt: ["brt"], light_rail: ["light_rail", "streetcar", "urban_rail"], streetcar: ["streetcar", "light_rail"], heavy_rail: ["heavy_rail", "urban_rail"], commuter_rail: ["commuter_rail", "regional_rail"] };
const LADDER = ["bus_frequency", "brt", "light_rail", "heavy_rail"];
const MODE_LABEL = { bus_frequency: "More frequent buses", brt: "Bus rapid transit", light_rail: "Light rail", heavy_rail: "Heavy rail or metro", commuter_rail: "Commuter or regional rail", streetcar: "Streetcar" };

const isNum = x => typeof x === "number" && isFinite(x);
const r0 = x => isNum(x) ? Math.round(x) : null;
const r2 = x => isNum(x) ? Math.round(x * 100) / 100 : null;
function rng(low, high, mid, unit, basis, source, inputs) {
  if (!isNum(low) || !isNum(high)) return null;
  return { low: Math.min(low, high), high: Math.max(low, high), mid: isNum(mid) ? mid : null, unit, basis, source, inputs: inputs || {} };
}
function quantile(xs, q) { // linear interpolation between order statistics (numpy default)
  const s = xs.filter(isNum).slice().sort((a, b) => a - b); if (!s.length) return null;
  const h = (s.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return s[lo] + (s[hi] - s[lo]) * (h - lo);
}

// ---------------------------------------------------------------- 1. station model
function featureVector(stop) {
  return [Math.log1p(stop.pop_half), Math.log1p(stop.jobs_half), Math.log1p(stop.pop_ring), Math.log1p(stop.jobs_ring), stop.terminal ? 1 : 0, stop.transfer ? 1 : 0];
}
function stopInputsMissing(stop) {
  const miss = [];
  for (const k of ["pop_half", "jobs_half", "pop_ring", "jobs_ring"]) if (!stop || !isNum(stop[k])) miss.push(k);
  return miss;
}
function linearPart(coef, stop) { const x = featureVector(stop); return FEATURES.reduce((s, f, i) => s + coef[f] * x[i], 0); }

/** Weekday boardings for one stop: bracket across the fitted systems' levels, plus the held-out error band. */
function predictStop(stop, modeModel) {
  const miss = stopInputsMissing(stop);
  if (!modeModel) return { weekday: null, missing: ["a station model for this mode (no station boardings on file for it)"] };
  if (miss.length) return { weekday: null, missing: miss.map(k => `stop ${k}`) };
  const xb = linearPart(modeModel.coef, stop);
  const ints = Object.values(modeModel.intercepts);
  const lo = Math.exp(Math.min(...ints) + xb), hi = Math.exp(Math.max(...ints) + xb);
  const mid = Math.exp(ints.reduce((a, b) => a + b, 0) / ints.length + xb);
  const band = modeModel.loso_summary && modeModel.loso_summary.log_error_after_scaling_p10_p90;
  return {
    weekday: rng(lo, hi, mid, "station boardings per day (weekday for most fitted systems)", "modelled", "app/data/transit_demand_model.json",
      { bracket: "lowest to highest fitted system level", systems: modeModel.systems.length }),
    errorBand: band ? { lowFactor: Math.exp(band[0]), highFactor: Math.exp(band[1]), meaning: "10th-90th percentile of held-out stations' error after the system scaling" } : null,
    missing: [],
  };
}

/** Line weekday boardings (sum over stops) and annual NTD-basis trips, from the station model. */
function lineRidersFromStations(stops, modeModel, annualRows, stationCount) {
  const per = (stops || []).map(s => Object.assign({ stop: s }, predictStop(s, modeModel)));
  const ok = per.filter(p => p.weekday);
  const missing = [];
  if (!modeModel) missing.push("a station model for this mode (no station boardings on file for it)");
  if (!stops || !stops.length) missing.push("stops with ring people and jobs");
  if (per.length && !ok.length) missing.push("ring people and jobs for every stop");
  if (missing.length) return { perStop: per, weekday: null, annual: null, missing };
  // when the project states more stations than have points on file, the missing ones are assumed to average like those on file
  const scale = isNum(stationCount) && stationCount > ok.length ? stationCount / ok.length : 1;
  const sum = k => ok.reduce((a, p) => a + p.weekday[k], 0) * scale;
  const weekday = rng(sum("low"), sum("high"), sum("mid"), "line boardings per day", "modelled", "app/data/transit_demand_model.json", { stops: ok.length, stopsWithoutData: per.length - ok.length, bracket: "lowest to highest fitted system level", stationsStated: isNum(stationCount) ? stationCount : null, scaledForStationsNotOnFile: scale !== 1 ? { factor: scale, basis: "assumed", note: `${stationCount} stations stated, ${ok.length} with points on file: the others are assumed to average like these` } : null });
  // annual: each fitted system with an NTD factor: exp(a_s + xb) x factor_s, summed over stops; bracket across those systems
  const fac = (annualRows || []).filter(r => isNum(r.factor) && modeModel.intercepts[r.system] != null);
  let annual = null;
  if (fac.length) {
    const vals = fac.map(r => ({ sys: r.system, v: ok.reduce((a, p) => a + Math.exp(modeModel.intercepts[r.system] + linearPart(modeModel.coef, p.stop)), 0) * r.factor * scale }));
    const vs = vals.map(x => x.v);
    annual = rng(Math.min(...vs), Math.max(...vs), quantile(vs, 0.5), "unlinked trips per year (NTD basis)", "modelled",
      "station model x NTD annual trips per weekday station count (app/data/transit_demand_model.json)", { bySystem: vals.map(x => ({ system: x.sys, annual: r0(x.v) })) });
  } else missing.push("NTD annual-trips-per-weekday factor for this mode (no fitted system of this mode has weekday counts of 2020 or later)");
  return { perStop: per, weekday, annual, missing };
}

/** Riders from NTD trips per directional route mile (any mode; ignores the land around the stops). */
function ridersFromRouteMiles(lengthMiles, ntdCode, model) {
  const t = model && model.ntd_extras && model.ntd_extras.by_mode[ntdCode] && model.ntd_extras.by_mode[ntdCode].upt_per_drm;
  if (!isNum(lengthMiles) || lengthMiles <= 0) return { annual: null, missing: ["line length in miles"] };
  if (!t) return { annual: null, missing: [`NTD trips per route mile for mode ${ntdCode}`] };
  const drm = 2 * lengthMiles;
  return { annual: rng(drm * t.p25, drm * t.p75, drm * t.median, "unlinked trips per year (NTD basis)", "modelled", model.ntd_extras.source_url,
    { directionalRouteMiles: drm, tripsPerDirectionalRouteMile: { p25: t.p25, median: t.median, p75: t.p75, n: t.n, year: model.ntd_extras.report_year }, note: "typical operating systems of this mode; knows nothing about the land around the stops" }), missing: [] };
}

// ---------------------------------------------------------------- 2. money
function ntdCut(operating, code, metric) {
  const m = operating && operating.by_mode && operating.by_mode[code];
  const y = m && m.years && m.years["2025"];
  return y && y.cuts && y.cuts.all ? y.cuts.all[metric] || null : null;
}
function agencyRow(operating, code, agency) {
  if (!agency || !operating) return null;
  const rows = operating.agency_rows_rail_brt_latest_year || [];
  const id = agency.ntdId || null, name = agency.name ? String(agency.name).toLowerCase() : null;
  const hit = rows.filter(r => r.mode === code && ((id && r.ntd_id === id) || (name && String(r.agency_name).toLowerCase().includes(name))));
  return hit.length === 1 ? hit[0] : null;
}
const SRC_NTD = "https://data.transportation.gov/d/npsm-38gk";

function fareRevenue(annual, code, operating, agency) {
  if (!annual) return { value: null, missing: ["annual trips"] };
  const own = agencyRow(operating, code, agency);
  if (own && isNum(own.fare_per_upt)) return { value: rng(annual.low * own.fare_per_upt, annual.high * own.fare_per_upt, isNum(annual.mid) ? annual.mid * own.fare_per_upt : null, "USD per year", "modelled", own.source_url || SRC_NTD, { farePerTrip: own.fare_per_upt, from: `${own.agency_name}, NTD ${own.report_year}` }), missing: [] };
  const q = ntdCut(operating, code, "fare_per_upt");
  if (!q) return { value: null, missing: [`NTD fare revenue per trip for mode ${code}`] };
  return { value: rng(annual.low * q.p25, annual.high * q.p75, isNum(annual.mid) ? annual.mid * q.median : null, "USD per year", "modelled", SRC_NTD, { farePerTrip: { p25: q.p25, median: q.median, p75: q.p75, n: q.n, year: "2025" } }), missing: [] };
}

/** Annual operating cost. plan (optional): { spanHours, headwayMin, carsPerTrain, daysPerYear }; default: NTD revenue hours per route mile. */
function operatingCost(lengthMiles, code, operating, model, plan, agency) {
  const missing = [];
  if (!isNum(lengthMiles) || lengthMiles <= 0) return { value: null, revenueHours: null, missing: ["line length in miles"] };
  const own = agencyRow(operating, code, agency);
  const cph = ntdCut(operating, code, "opex_per_vrh");
  if (!cph && !(own && isNum(own.opex_per_vrh))) return { value: null, revenueHours: null, missing: [`NTD operating cost per revenue hour for mode ${code}`] };
  let vrh = null;
  if (plan && (plan.spanHours != null || plan.headwayMin != null)) {
    const spd = model && model.ntd_extras && model.ntd_extras.by_mode[code] && model.ntd_extras.by_mode[code].avg_speed_mph;
    for (const k of ["spanHours", "headwayMin", "daysPerYear"]) if (!isNum(plan[k])) missing.push(`service plan ${k}`);
    const cars = code === "MB" || code === "RB" ? 1 : plan.carsPerTrain;
    if (!isNum(cars)) missing.push("service plan carsPerTrain (NTD counts rail revenue hours per car)");
    if (!spd) missing.push(`NTD average speed for mode ${code}`);
    if (missing.length) return { value: null, revenueHours: null, missing };
    // vehicles running = both directions over the span; hours = vehicle trips x one-way run time x cars
    const trips = 2 * plan.spanHours * 60 / plan.headwayMin;
    const h = s => trips * (lengthMiles / s) * cars * plan.daysPerYear;
    vrh = rng(h(spd.p75), h(spd.p25), h(spd.median), "vehicle revenue hours per year", "modelled", SRC_NTD, { plan, speedMph: { p25: spd.p25, median: spd.median, p75: spd.p75 } });
  } else {
    const q = ntdCut(operating, code, "vrh_per_route_mile");
    if (!q) return { value: null, revenueHours: null, missing: [`NTD revenue hours per route mile for mode ${code}`] };
    const drm = 2 * lengthMiles;
    vrh = rng(drm * q.p25, drm * q.p75, drm * q.median, "vehicle revenue hours per year", "modelled", SRC_NTD, { directionalRouteMiles: drm, revenueHoursPerDirectionalRouteMile: { p25: q.p25, median: q.median, p75: q.p75, n: q.n, year: "2025" }, note: "default service level: the middle half of operating systems of this mode" });
  }
  const c = own && isNum(own.opex_per_vrh) ? { p25: own.opex_per_vrh, median: own.opex_per_vrh, p75: own.opex_per_vrh, from: `${own.agency_name}, NTD ${own.report_year}` } : { p25: cph.p25, median: cph.median, p75: cph.p75, n: cph.n, year: "2025" };
  return { value: rng(vrh.low * c.p25, vrh.high * c.p75, vrh.mid * c.median, "USD per year", "modelled", SRC_NTD, { costPerRevenueHour: c }), revenueHours: vrh, missing: [] };
}
function costPerTripCrossCheck(annual, code, operating) {
  const q = ntdCut(operating, code, "opex_per_upt");
  if (!annual || !q) return null;
  return rng(annual.low * q.p25, annual.high * q.p75, isNum(annual.mid) ? annual.mid * q.median : null, "USD per year", "modelled", SRC_NTD, { costPerTrip: { p25: q.p25, median: q.median, p75: q.p75, n: q.n, year: "2025" }, note: "cross-check: annual trips x NTD cost per trip" });
}
function operatingGap(cost, fares) {
  if (!cost || !fares) return null;
  return rng(cost.low - fares.high, cost.high - fares.low, isNum(cost.mid) && isNum(fares.mid) ? cost.mid - fares.mid : null, "USD per year", "modelled", "operating cost minus fare revenue", { low: "cost low - fares high", high: "cost high - fares low" });
}
function tunnelBand(pct) { return pct == null ? null : pct < 10 ? "at grade or elevated (tunnel under 10%)" : pct < 60 ? "partly tunnelled (10-60%)" : "mostly tunnelled (60% or more)"; }
function capitalCost(lengthMiles, mode, costRows, tunnelSharePct) {
  const want = COST_MODES[mode] || [];
  if (!isNum(lengthMiles) || lengthMiles <= 0) return { value: null, missing: ["line length in miles"] };
  let rows = (costRows || []).filter(r => r && want.includes(r.mode) && isNum(r.cost_per_mile_usd_millions));
  if (!rows.length) return { value: null, missing: [`capital cost per mile for ${MODE_LABEL[mode] || mode} (no benchmark rows)`] };
  let band = null;
  if (isNum(tunnelSharePct)) {
    const b = tunnelBand(tunnelSharePct), inBand = rows.filter(r => isNum(r.tunnel_share_pct) && tunnelBand(r.tunnel_share_pct) === b);
    if (inBand.length >= 2) { rows = inBand; band = b; } else band = `${b}: fewer than 2 rows with that tunnel share, all rows used`;
  }
  const v = rows.map(r => r.cost_per_mile_usd_millions);
  const p25 = quantile(v, 0.25), p75 = quantile(v, 0.75), med = quantile(v, 0.5);
  return { value: rng(p25 * lengthMiles * 1e6, p75 * lengthMiles * 1e6, med * lengthMiles * 1e6, "USD (dollar years as published)", "modelled", "app/data/transit_cost_benchmarks.json",
    { lengthMiles, costPerMileMusd: { p25, median: med, p75, min: Math.min(...v), max: Math.max(...v), n: rows.length }, tunnelBand: band, projects: rows.map(r => r.id), note: "dollar years differ by row and are not adjusted" }), missing: [] };
}

// ---------------------------------------------------------------- 3. one mode, then the comparison
function rateCostPerTrip(v, thresholds) {
  if (!isNum(v) || !thresholds) return null;
  for (const r of thresholds.fta_cig.cost_per_trip_usd_2025) if (v < r.max_exclusive) return r.rating;
  return "Low";
}
const div = (a, b) => (a && b) ? rng(a.low / b.high, a.high / b.low, isNum(a.mid) && isNum(b.mid) && b.mid ? a.mid / b.mid : null, `${a.unit} per ${b.unit}`, "modelled", "ratio of two ranges", { low: "numerator low / denominator high", high: "numerator high / denominator low" }) : null;

/**
 * evaluateMode(line, mode, tables)
 *   line: { lengthMiles, stops: [{ name, pop_half, jobs_half, pop_ring, jobs_ring, homes_half, homes_ring, terminal, transfer }], tunnelSharePct?, plan?, agency? { name, ntdId } }
 */
function evaluateMode(line, mode, tables) {
  tables = tables || {}; line = line || {};
  const code = NTD_CODE[mode], model = tables.model || null;
  const mm = model && model.modes ? model.modes[code] : null;
  const missing = [];
  let riders = null, ridersBasis = null, perStop = [], weekday = null;
  if (mm) {
    const st = lineRidersFromStations(line.stops, mm, model.annual_trips_per_weekday_count ? model.annual_trips_per_weekday_count.rows.filter(r => r.mode === code) : [], line.stationCount);
    perStop = st.perStop;
    if (st.annual) { riders = st.annual; ridersBasis = "station model"; }
    else missing.push(...st.missing);
    weekday = st.weekday;
  }
  const rm = ridersFromRouteMiles(line.lengthMiles, code, model);
  if (!riders && rm.annual) { riders = rm.annual; ridersBasis = "NTD trips per route mile"; }
  if (!riders) missing.push(...rm.missing);
  const fares = fareRevenue(riders, code, tables.operating, line.agency);
  const cost = operatingCost(line.lengthMiles, code, tables.operating, model, line.plan, line.agency);
  const gap = operatingGap(cost.value, fares.value);
  const cap = capitalCost(line.lengthMiles, mode, tables.costRows, line.tunnelSharePct);
  for (const x of [fares, cost, cap]) for (const m of x.missing || []) if (!missing.includes(m)) missing.push(m);
  const opPerTrip = div(cost.value, riders);
  const bestRating = opPerTrip ? rateCostPerTrip(opPerTrip.mid != null ? opPerTrip.mid : (opPerTrip.low + opPerTrip.high) / 2, tables.thresholds) : null;
  const test = mm ? { stations: mm.stations, systems: mm.systems.length, medianError: mm.loso_summary.median_mdape_after_scaling.model, medianRankCorrelation: mm.loso_summary.median_spearman.model, beatsBaseline: mm.beats_people_plus_jobs_baseline } : null;
  return {
    mode, label: MODE_LABEL[mode] || mode, ntdMode: code,
    riders: { annual: riders, weekday, basis: ridersBasis, routeMileCrossCheck: ridersBasis === "station model" ? rm.annual : null, test },
    perStop: perStop.map(p => ({ name: p.stop && p.stop.name, weekday: p.weekday, errorBand: p.errorBand || null, ring: p.stop ? { pop_half: p.stop.pop_half, homes_half: p.stop.homes_half, jobs_half: p.stop.jobs_half, pop_ring: p.stop.pop_ring, homes_ring: p.stop.homes_ring, jobs_ring: p.stop.jobs_ring } : null, missing: p.missing })),
    fareRevenue: fares.value, operatingCost: cost.value, revenueHours: cost.revenueHours, operatingCostCrossCheck: costPerTripCrossCheck(riders, code, tables.operating),
    operatingGap: gap, capitalCost: cap.value,
    capitalPerAnnualRider: div(cap.value, riders), operatingGapPerRider: div(gap, riders), operatingCostPerTrip: opPerTrip,
    bestPossibleFtaRating: bestRating,
    bestPossibleFtaRatingWhy: bestRating ? "operating cost per trip alone, a floor on FTA's (annualised capital + operating cost) per trip; FTA's annualisation factors are not on file" : null,
    missing,
  };
}

const RATING_OK = ["High", "Medium-High", "Medium"];
/**
 * compareModes(line, tables, densitySupports?) -> { modes: [evaluateMode...], fit, runnerUp, why, verdict, missing }
 *   densitySupports: array of engine modes whose TCQSM density threshold is met (from evaluateTransit), or null if unknown.
 */
function compareModes(line, tables, densitySupports) {
  const modes = (line && line.modes) || ["bus_frequency", "brt", "light_rail", "heavy_rail", "commuter_rail"];
  const rows = modes.map(m => evaluateMode(line, m, tables));
  const why = [];
  const pass = r => {
    if (!r.operatingCostPerTrip) return { ok: false, why: `${r.label}: ${r.missing.length ? "missing " + r.missing.join("; ") : "riders or cost not on file"}` };
    if (Array.isArray(densitySupports) && r.mode !== "commuter_rail" && !densitySupports.includes(r.mode)) return { ok: false, why: `${r.label}: the stops' density is below the TCQSM guideline for it` };
    if (!RATING_OK.includes(r.bestPossibleFtaRating)) return { ok: false, why: `${r.label}: operating cost alone is about $${r2(r.operatingCostPerTrip.mid)} a trip, which already rates ${r.bestPossibleFtaRating} on FTA's breakpoints` };
    return { ok: true, why: `${r.label}: operating cost alone about $${r2(r.operatingCostPerTrip.mid)} a trip, so it can still rate ${r.bestPossibleFtaRating} or better once capital is added` };
  };
  const checks = rows.map(r => Object.assign({ mode: r.mode }, pass(r)));
  checks.forEach(c => why.push(c.why));
  const ladder = LADDER.filter(m => modes.includes(m));
  // Among the modes that pass, the one with the lowest capital cost per annual rider (middle of its range) fits; the next
  // lowest is the runner-up. A mode with no capital benchmark (ordinary bus service) is listed, not ranked.
  const okL = ladder.filter(m => checks.find(c => c.mode === m && c.ok));
  const capMid = m => { const r = rows.find(x => x.mode === m); return r && r.capitalPerAnnualRider ? r.capitalPerAnnualRider.mid : null; };
  const ranked = okL.filter(m => isNum(capMid(m))).sort((a, b) => capMid(a) - capMid(b) || LADDER.indexOf(a) - LADDER.indexOf(b));
  const fit = ranked[0] || null, runnerUp = ranked[1] || null;
  for (const m of okL.filter(m => !isNum(capMid(m)))) why.push(`${MODE_LABEL[m]}: passes on operating cost but has no capital cost per mile on file, so it is not ranked on capital.`);
  if (fit) why.push(`${MODE_LABEL[fit]} has the lowest capital cost per annual rider of the modes that pass (about $${r0(capMid(fit)).toLocaleString("en-US")})${runnerUp ? `; next is ${MODE_LABEL[runnerUp]} (about $${r0(capMid(runnerUp)).toLocaleString("en-US")})` : ""}.`);
  const cr = checks.find(c => c.mode === "commuter_rail");
  const missingAll = rows.every(r => !r.operatingCostPerTrip);
  const unranked = okL.filter(m => !isNum(capMid(m)));
  const summary = fit ? `${MODE_LABEL[fit]} fits${runnerUp ? `; runner-up ${MODE_LABEL[runnerUp]}` : ""}`
    : missingAll ? "not enough data"
    : unranked.length ? `no mode chosen: only ${unranked.map(m => MODE_LABEL[m].toLowerCase()).join(" and ")} passes, and it has no capital cost on file to rank`
    : "no mode passes the density and operating-cost tests";
  return {
    summary,
    version: TRANSIT_DEMAND_VERSION,
    verdict: fit ? "fits" : missingAll ? "not_enough_data" : "none_fits",
    fit, runnerUp, alsoPasses: cr && cr.ok ? ["commuter_rail"] : [], notRankedOnCapital: okL.filter(m => !isNum(capMid(m))),
    rule: "of bus, BRT, light rail and heavy rail, the modes whose stops meet their density guideline (when known) and whose operating cost per trip alone still allows an FTA rating of Medium or better; of those, the lowest capital cost per annual rider fits and the next is the runner-up; commuter rail is reported beside them",
    why, modes: rows,
    missing: missingAll ? [...new Set(rows.flatMap(r => r.missing))] : [],
  };
}

// ---------------------------------------------------------------- 4. stops and the line
/** Line inputs for evaluateTransit's density screen, from the stops' half-mile rings. */
function lineArea(stops) {
  const ok = (stops || []).filter(s => isNum(s.homes_half) && isNum(s.pop_half) && isNum(s.jobs_half));
  if (!ok.length) return null;
  const sqmi = ok.length * Math.PI * 0.25, acres = sqmi * 640;
  return {
    householdsPerGrossAcre: ok.reduce((a, s) => a + s.homes_half, 0) / acres,
    stationAreaPopDensityPerSqMi: ok.reduce((a, s) => a + s.pop_half, 0) / sqmi,
    employmentServed: ok.reduce((a, s) => a + s.jobs_half, 0),
    densitySource: `ACS 2020-2024 homes within 0.5 mi of ${ok.length} stop points (overlapping circles counted once each) / circle land of 0.5 mi radius`,
  };
}

// ---------------------------------------------------------------- 5. funding programmes that could apply
const STATE_OF = { tx: "TX", fl: "FL", co: "CO", il: "IL", az: "AZ", ca: "CA", la: "CA" };
function fundingOptions(gapOrCapital, place, tables) {
  place = place || {}; tables = tables || {};
  const out = [];
  const T = tables.thresholds;
  if (T && T.fta_cig) {
    out.push({ program: "FTA Capital Investment Grants (New Starts)", rule: T.fta_cig.source.quote_new_starts, source: T.fta_cig.source.url, share: "share not on file", appliesTo: "capital" });
    out.push({ program: "FTA Capital Investment Grants (warrants for smaller projects)", rule: T.fta_cig.source.quote_warrants, source: T.fta_cig.source.url, share: "share not on file", appliesTo: "capital" });
  }
  for (const p of tables.funding || []) {
    const imp = (p.eligible_improvements || []).join(" ");
    if (!/transit|station|rail/i.test(imp)) continue;
    const pre = String(p.id || "").split("_")[0];
    const st = pre === "federal" ? "US" : STATE_OF[pre] || null;
    if (p.jurisdiction_fips && place.fips && p.jurisdiction_fips !== place.fips) continue;
    if (st && st !== "US" && place.state && st !== place.state) continue;
    if (st === "US" && /intercity/i.test(p.program_name || "") && !place.intercity) continue;
    const v = p.verification || {};
    const shareOk = isNum(p.funding_share_pct) && v.status === "verified" && !(v.unverified_fields || []).some(f => /funding_share/.test(f));
    out.push({ program: p.program_name, rule: v.evidence || null, ruleStatus: v.status || "unverified", source: p.source_url || null, citation: p.statutory_citation || null,
      share: shareOk ? `up to ${Math.round(p.funding_share_pct * 100)}% (${p.funding_share_description || "as quoted"})` : "share not on file", appliesTo: /tax increment|increment|tif/i.test((p.program_name || "") + " " + (p.funding_share_description || "")) ? "capital or station-area costs from tax increment" : "capital" });
  }
  return { gap: gapOrCapital || null, programs: out, note: "Shares are given only where the record's own source states one and the record is verified; no split of the gap between programmes is made." };
}

// ---------------------------------------------------------------- 6. the test (re-run in Node on data/transit/station_ring_features.csv)
function solve(A, b) { // Gaussian elimination with partial pivoting
  const n = A.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
function fitLogLinear(rows) {
  const systems = [...new Set(rows.map(r => r.system))].sort();
  const X = rows.map(r => systems.map(s => r.system === s ? 1 : 0).concat(featureVector(r)));
  const y = rows.map(r => Math.log(r.boardings));
  const k = X[0].length;
  const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((a, x) => a + x[i] * x[j], 0)));
  const Xty = Array.from({ length: k }, (_, i) => X.reduce((a, x, t) => a + x[i] * y[t], 0));
  const beta = solve(XtX, Xty);
  if (!beta) return null;
  const intercepts = {}; systems.forEach((s, i) => { intercepts[s] = beta[i]; });
  const coef = {}; FEATURES.forEach((f, j) => { coef[f] = beta[systems.length + j]; });
  return { systems, intercepts, coef };
}
const median = xs => quantile(xs, 0.5);
function ranks(v) {
  const o = v.map((x, i) => i).sort((a, b) => v[a] - v[b]), r = new Array(v.length);
  for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && v[o[j + 1]] === v[o[i]]) j++; for (let t = i; t <= j; t++) r[o[t]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
function spearman(a, b) {
  if (new Set(a).size < 2 || new Set(b).size < 2) return null;
  const ra = ranks(a), rb = ranks(b), ma = ra.reduce((x, y) => x + y, 0) / ra.length, mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let n = 0, da = 0, db = 0; for (let i = 0; i < ra.length; i++) { n += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
}
function scaledMdape(pred, obs) {
  const k = Math.exp(median(pred.map((p, i) => Math.log(obs[i] / p))));
  return { mdape: median(pred.map((p, i) => Math.abs(p * k - obs[i]) / obs[i])), factor: k };
}
function leaveOneSystemOut(rows) {
  const systems = [...new Set(rows.map(r => r.system))].sort();
  return systems.map(S => {
    const m = fitLogLinear(rows.filter(r => r.system !== S)), te = rows.filter(r => r.system === S);
    const ints = Object.values(m.intercepts), abar = ints.reduce((a, b) => a + b, 0) / ints.length;
    const pred = te.map(r => Math.exp(abar + linearPart(m.coef, r))), obs = te.map(r => r.boardings);
    const s = scaledMdape(pred, obs), b2p = te.map(r => r.pop_half + r.jobs_half + 1);
    return { held_out: S, stations: te.length, model: { spearman: spearman(pred, obs), mdape_after_scaling: s.mdape, level_factor: s.factor },
      baseline_system_average: { mdape_after_scaling: scaledMdape(te.map(() => 1), obs).mdape },
      baseline_people_plus_jobs_half_mile: { spearman: spearman(b2p, obs), mdape_after_scaling: scaledMdape(b2p, obs).mdape } };
  });
}

// ---------------------------------------------------------------- 7. the lines on file for a county
const NOT_STATION = "Station sites are not chosen in the documents; the stop points only rank stops against each other.";
function pipelineMode(title) {
  const t = String(title || "");
  return /streetcar/i.test(t) ? "streetcar" : /light rail/i.test(t) ? "light_rail" : /bus rapid|\bBRT\b/i.test(t) ? "brt" : /subway|red line|heavy rail/i.test(t) ? "heavy_rail" : null;
}
/**
 * linesForCounty(fips, { pipelines, corridors, stops }) -> line inputs for the county's local projects and the intercity
 * corridors with a stop in it. stops: app/data/transit_demand_stops.json. Length comes only from a record's own checked
 * source (a pipeline's fta_profile, a corridor's route_length_miles when its verification confirms it: lengthOk(c)).
 */
function linesForCounty(fips, files, lengthOk) {
  files = files || {}; const S = files.stops || { corridors: {}, pipelines: {} };
  const out = [];
  // state postal code from the corridor table's own stop records (fips and state fields), so no code table is typed here
  const st = (files.corridors || []).flatMap(c => c.proposed_stations || []).find(s => s && s.fips && s.state && String(s.fips).slice(0, 2) === String(fips).slice(0, 2));
  const state = st ? st.state : null;
  for (const p of files.pipelines || []) {
    if (!p || p.fips !== fips) continue;
    const rec = (S.pipelines || {})[p.title];
    const fp = p.fta_profile || null;
    const all = rec ? rec.stops : [];
    out.push({ kind: "pipeline", id: p.title, name: p.title, mode: pipelineMode(p.title), lengthMiles: fp && isNum(fp.project_length_miles) ? fp.project_length_miles : null,
      lengthSource: fp && isNum(fp.project_length_miles) ? { url: fp.source_url, quote: fp.quote } : null, stationCount: fp && isNum(fp.stations) ? fp.stations : null,
      projectCost: fp && isNum(fp.total_capital_cost_musd) ? { musd: fp.total_capital_cost_musd, cigShareMusd: isNum(fp.cig_share_musd) ? fp.cig_share_musd : null, url: fp.source_url, quote: fp.quote } : null,
      agency: { name: String(p.agency || "").replace(/\s*\(.*\)\s*$/, "") }, stops: all.filter(s => s.on_file), stopsNotOnFile: all.filter(s => !s.on_file).map(s => ({ name: s.name, why: s.why })),
      moneyApplies: true, intercity: false, state, fips, siteNote: NOT_STATION + " The points in the project table are marked there as unverified illustrative locations." });
  }
  for (const c of files.corridors || []) {
    if (!c || !(c.proposed_stations || []).some(s => s && s.fips === fips)) continue;
    const rec = (S.corridors || {})[c.id];
    const all = rec ? rec.stops : [];
    const t = c.corridor_type || "";
    const mode = /high_speed/.test(t) ? "hsr" : "commuter_rail";
    const len = lengthOk ? lengthOk(c) : null;
    const money = t === "intercity_commuter_regional";
    out.push({ kind: "corridor", id: c.id, name: c.name, mode, corridorType: t, lengthMiles: isNum(len) ? len : null, lengthSource: isNum(len) ? { url: c.source_url || null } : null, stationCount: null,
      agency: null, stops: all.filter(s => s.on_file), stopsNotOnFile: all.filter(s => !s.on_file).map(s => ({ name: s.name, why: s.why })), countyStops: all.filter(s => s.fips === fips).map(s => s.name),
      moneyApplies: money, intercity: true, state, fips,
      moneyWhy: money ? null : mode === "hsr" ? "High-speed rail: no station boardings, operating costs or fares for it are on file (NTD does not cover it)." : "Intercity rail: NTD does not cover Amtrak or state-supported intercity service, and Amtrak route revenue and cost were not obtained, so fares, operating cost and the gap are not on file. The commuter-rail station model is used only to rank the stops.",
      siteNote: NOT_STATION + " Each stop is the Census internal point of its city." });
  }
  return out;
}

/** Everything the card, the brief and the advisor show for one line: the mode comparison (or the single mode for corridors). */
function evaluateLine(line, tables, densitySupports) {
  if (!line) return null;
  const base = { kind: line.kind, id: line.id, name: line.name, mode: line.mode, lengthMiles: line.lengthMiles, stationCount: line.stationCount, siteNote: line.siteNote, stopsNotOnFile: line.stopsNotOnFile || [] };
  if (line.kind === "pipeline") {
    const cmp = compareModes(line, tables, densitySupports);
    const own = cmp.modes.find(m => m.mode === line.mode) || (line.mode === "streetcar" ? evaluateMode(line, "streetcar", tables) : null);
    return Object.assign(base, { comparison: cmp, proposed: own, funding: fundingOptions(own ? own.operatingGap : null, { fips: line.fips, state: line.state }, tables), projectCost: line.projectCost || null });
  }
  if (line.mode === "hsr") return Object.assign(base, { comparison: null, proposed: null, missing: ["station boardings, operating cost and fares for high-speed rail (none on file)"], moneyWhy: line.moneyWhy });
  const ev = evaluateMode(line, "commuter_rail", tables);
  if (!line.moneyApplies) { for (const k of ["fareRevenue", "operatingCost", "revenueHours", "operatingCostCrossCheck", "operatingGap", "capitalCost", "capitalPerAnnualRider", "operatingGapPerRider", "operatingCostPerTrip", "bestPossibleFtaRating"]) ev[k] = null; ev.riders.annual = null; ev.riders.routeMileCrossCheck = null; }
  return Object.assign(base, { comparison: null, proposed: ev, moneyWhy: line.moneyWhy || null, funding: fundingOptions(line.moneyApplies ? ev.operatingGap : null, { fips: line.fips, state: line.state, intercity: true }, tables) });
}

/** Compact form for the advisor (keeps units, ranges and bases; per-stop rows trimmed to 12). */
function lineForAdvisor(L) {
  if (!L) return null;
  // kept small: the whole advisor brief is capped (DECISION_BRIEF_MAX_CHARS); units are stated once in `units`
  const R = x => x ? [r0(x.low), r0(x.high), x.basis] : null;
  const p = L.proposed, c = L.comparison;
  return {
    kind: L.kind, name: L.name, proposedMode: L.mode, lengthMiles: L.lengthMiles,
    units: "ranges are [low, high, basis]; riders per weekday and per year (NTD trips); money in USD per year, capital in USD",
    modeFit: c ? { verdict: c.verdict, summary: c.summary, fit: c.fit, runnerUp: c.runnerUp, rule: "lowest capital cost per annual rider among modes meeting their density guideline whose operating cost per trip still allows FTA Medium (docs/TRANSIT-DEMAND-MODEL.md section 7)" } : null,
    riders: p ? { weekday: R(p.riders.weekday), annual: R(p.riders.annual), basis: p.riders.basis, tested: testedLine(p) } : null,
    fareRevenue: p ? R(p.fareRevenue) : null, operatingCost: p ? R(p.operatingCost) : null, operatingGap: p ? R(p.operatingGap) : null, capitalCost: p ? R(p.capitalCost) : null,
    stops: p ? p.perStop.slice(0, 8).map(s => [s.name, s.ring ? s.ring.pop_half : null, s.ring ? s.ring.jobs_half : null, s.weekday ? r0(s.weekday.low) : null, s.weekday ? r0(s.weekday.high) : null]) : [],
    stopColumns: ["stop", "people within 0.5 mi", "jobs within 0.5 mi", "boardings a day low", "high"],
    funding: L.funding ? L.funding.programs.map(f => `${f.program}: ${f.share}`) : [],
    projectCost: L.projectCost ? { musd: L.projectCost.musd, cigShareMusd: L.projectCost.cigShareMusd, source: L.projectCost.url } : null,
    notOnFile: [...new Set([...(p ? p.missing : L.missing || []), ...(L.moneyWhy ? [L.moneyWhy] : []), ...L.stopsNotOnFile.map(s => `${s.name}: ${s.why}`)])].slice(0, 5),
    siteNote: L.siteNote,
  };
}

/** Short text for the page and the advisor: "tested on N stations in M systems, typical error X". */
function testedLine(modeResult) {
  const t = modeResult && modeResult.riders && modeResult.riders.test;
  if (!t) return modeResult && modeResult.riders && modeResult.riders.basis === "NTD trips per route mile" ? "no station boardings of this mode on file: riders come from NTD trips per route mile of operating systems, not from the land around the stops" : null;
  return `tested on ${t.stations} stations in ${t.systems} systems, typical error ${Math.round(t.medianError * 100)}% after matching each system's level (rank correlation ${r2(t.medianRankCorrelation)}); the level for a new system is only bracketed`;
}

const api = { TRANSIT_DEMAND_VERSION, linesForCounty, evaluateLine, lineForAdvisor, pipelineMode, FEATURES, NTD_CODE, MODE_LABEL, featureVector, predictStop, lineRidersFromStations, ridersFromRouteMiles, fareRevenue, operatingCost, costPerTripCrossCheck, operatingGap, capitalCost, evaluateMode, compareModes, lineArea, fundingOptions, fitLogLinear, leaveOneSystemOut, spearman, quantile, testedLine };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TransitDemandEngine = api;
})();
