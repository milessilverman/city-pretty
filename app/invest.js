// Invest view: the decision brief for one county. Reads the globals app.js sets up (D, D_OC, COUNTY_BUNDLES, SITES,
// activeCounty, activeFips, activeHouse, byId, select, cpJson, findNearestTransitStation, openAiAdvisor, ...) and the
// engine in src/engines/investmentDecisionEngine.js. Every figure comes from the engine's output ({ value, unit, source,
// basis }) or from a data table; this file adds no financial maths. A figure the engine could not fill shows
// "Not on file" with the reason the engine gave. The same verification rules as the map panel apply: an idea carries
// figures only when app/data/intervention_verification.json allows it, a law applies only when the statute engine
// confirms it, and a field a record lists in verification.unverified_fields is shown as not confirmed, not as a number.
(() => {
"use strict";

const BUDGETS = [
  { k: "100k", v: 1e5, label: "About $100k" },
  { k: "500k", v: 5e5, label: "About $500k" },
  { k: "2m", v: 2e6, label: "About $2M" },
  { k: "10m", v: 1e7, label: "About $10M" },
  { k: "50m", v: Infinity, label: "$50M or more" },
];
// Which kind of play a budget opens up (a filter on what is listed, not a calculation)
const TIER_MIN = { house: 0, building: 5e5, site: 2e6, corridor: 1e7 };

const iv = { view: "map", fips: null, budget: 1, hood: null, model: null, key: null, data: null, dataP: null, tries: 0, moreSites: false, moreIdeas: false, moreHoods: false };
const $ = s => document.querySelector(s);
const host = () => document.getElementById("invest");
const E = () => window.InvestmentDecisionEngine;
const esc2 = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = v => (typeof fmt$ === "function") ? fmt$(v) : "$" + Math.round(v).toLocaleString("en-US");
const countyLabel = () => { const el = $("#county-pick-label"); return el ? el.textContent.trim() : "this county"; };
const countyShort = () => countyLabel().replace(/,\s*[A-Z]{2}$/, "");
const fipsNow = () => (typeof activeFips === "function") ? String(activeFips()) : "06037";
const isNum = v => typeof v === "number" && isFinite(v);

// ---------------------------------------------------------------- small renderers
const BASIS_TXT = {
  measured: ["Measured", "Read from a cited table or record."],
  modelled: ["Modelled", "Computed from measured inputs."],
  assumed: ["Assumed", "No evidence behind it; an assumption."],
};
const basisTag = b => b && BASIS_TXT[b] ? `<span class="iv-basis iv-b-${b}" title="${esc2(BASIS_TXT[b][1])}">${BASIS_TXT[b][0]}</span>` : "";
const nof = why => `<span class="iv-nof">Not on file</span>${why ? `<span class="iv-why"> (${esc2(why)})</span>` : ""}`;

// A source string becomes a link when it holds a URL or points at a file under app/data; otherwise it stays as text
function srcMark(s) {
  if (!s) return "";
  const t = String(s);
  const u = t.match(/https?:\/\/[^\s;,)"]+/);
  if (u) return `<a class="iv-src" href="${esc2(u[0])}" target="_blank" rel="noopener" title="${esc2(t)}">source</a>`;
  const f = t.match(/app\/data\/[\w.\-]+\.json/);
  if (f) return `<a class="iv-src" href="${esc2(f[0])}" target="_blank" rel="noopener" title="${esc2(t)}">source</a>`;
  return `<span class="iv-src iv-src-txt" title="${esc2(t)}">source</span>`;
}

function fmtTV(t) {
  const v = t.value, u = String(t.unit || "");
  if (/per USD spent|USD per USD/.test(u)) return "$" + v.toFixed(2) + " per $1";
  if (/^USD per mile/.test(u)) return money(v) + " per mile";
  if (/^USD per trip/.test(u)) return "$" + v.toFixed(2) + " per trip";
  if (/^USD/.test(u)) return money(v);
  if (/^%/.test(u)) return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
  if (/^homes$/.test(u)) return Math.round(v).toLocaleString("en-US") + " homes";
  if (/^acres$/.test(u)) return v.toFixed(1) + " acres";
  if (/^m$/.test(u)) return Math.round(v).toLocaleString("en-US") + " m";
  if (/dwelling units per net acre/.test(u)) return v.toFixed(1) + " homes per net acre";
  if (/^percentile/.test(u)) return Math.round(v) + " of 100";
  return String(Math.round(v * 1000) / 1000) + (u ? " " + u : "");
}
// { value, unit, source, basis } -> text with basis tag and source; null -> Not on file with the reason
function fig(t, why) {
  if (!t || t.value == null || !isNum(t.value)) return nof(why);
  return `<span class="iv-fig" title="${esc2(t.unit || "")}">${esc2(fmtTV(t))}</span> ${basisTag(t.basis)} ${srcMark(t.source)}`;
}
const missList = m => (m && m.length) ? m.map(x => esc2(String(x))).join("; ") : "";
const dk = (o, key) => `data-dk="${esc2(key)}"${o.has(key) ? " open" : ""}`;

const GRADE_TXT = { A: "beat simple baselines in the back-test", B: "a relative-value screen", C: "weak in this county's back-test", D: "failed here or failed a data check" };
const SCALE_TXT = { bus_frequency: "More frequent buses", brt: "Bus rapid transit (BRT)", light_rail: "Light rail", heavy_rail: "Heavy rail or metro", commuter_rail: "Commuter or regional rail", hsr: "High-speed rail" };
const VERDICT_TXT = { build: "Build", do_not_build: "Do not build at this scale", screen_only: "Screen only, no build decision", not_enough_data: "Not enough data to say" };
const TIER_TXT = { measured: "Measured locally", "borrowed study": "Borrowed study", assumed: "Assumed" };
const TIER_CLS = { measured: "iv-t-m", "borrowed study": "iv-t-b", assumed: "iv-t-a" };
const tierCls = t => /measured/i.test(t) ? TIER_CLS.measured : /borrowed/i.test(t) ? TIER_CLS["borrowed study"] : TIER_CLS.assumed;

// ---------------------------------------------------------------- data
function loadData() {
  if (iv.dataP) return iv.dataP;
  const j = id => (typeof cpJson === "function" ? cpJson(id) : Promise.resolve(null)).catch(() => null);
  iv.dataP = Promise.all([j("neighborhood-score-backtest"), j("transit-cost-benchmarks"), j("transit-value-effects"), j("underused-sites"), j("intercity-corridors"), j("transit-pipelines"),
    j("intervention-verification"), j("statutes"), j("unit-costs"), j("county-valuation-models"), fetch("app/data/neighborhood_prediction.json").then(r => r.ok ? r.json() : null).catch(() => null)])
    .then(([bt, cost, eff, sites, corr, pipe, ver, laws, uc, vm, pred]) => {
      const verOk = ver && typeof ver === "object" && !Array.isArray(ver);
      iv.data = { backtest: bt, cost: cost && cost.rows || [], effects: eff && eff.rows || [], sites: Array.isArray(sites) ? sites : [], corridors: Array.isArray(corr) ? corr : [], pipelines: Array.isArray(pipe) ? pipe : [],
        verification: verOk ? ver : null, laws: Array.isArray(laws) ? laws : null, unitCosts: Array.isArray(uc) ? uc : [], valuationModels: vm && vm.counties ? vm : null, prediction: pred && pred.counties ? pred : null };
      return iv.data;
    });
  return iv.dataP;
}
// A record's own verification decides whether a field is a fact here: listed in verification.unverified_fields, or the
// whole record unchecked, gives no figure and the reason instead.
const UNCHECKED = /^(unverified|could_not_check|corridor_not_confirmed)$/;
function checkedNum(rec, field) {
  const v = (rec && rec.verification) || {}, x = rec ? rec[field] : null;
  if (!isNum(x)) return { value: null, why: "not in the record" };
  if (UNCHECKED.test(v.status || "unverified")) return { value: null, why: `not confirmed: the record could not be checked against a source (${v.status || "no status"})` };
  if ((v.unverified_fields || []).some(u => String(u).split(/[\s(]/)[0] === field)) return { value: null, why: "not confirmed: listed as unverified in the record" };
  return { value: x, why: null };
}

const _laCache = {};
function bundleFor(fips) {
  if (fips === "06037") {
    if (typeof D === "undefined" || !D || !D.details || !D.catalog) return null;
    const c = _laCache.b;
    if (c && c.src === D.details) return c.b;
    // LA's details are a lazily unpacked Proxy (lazyDetails in app/app.js) whose keys are not enumerable, so the block
    // group ids come from the map's features and each record is read through the Proxy.
    const det = {};
    // LA's names live on the map features (properties n, c), not in the detail records.
    const props = new Map(((D.bgs && D.bgs.features) || []).filter(f => f && f.properties && typeof f.properties.id === "string").map(f => [f.properties.id, f.properties]));
    const ids = [...props.keys()].filter(k => k.startsWith("06037"));
    for (const k of (ids.length ? ids : Object.keys(D.details))) {
      if (!k.startsWith("06037")) continue;
      const v = D.details[k], p = props.get(k) || {};
      if (v && v.m) det[k] = (v.m.n || !p.n) ? v : Object.assign({}, v, { m: Object.assign({}, v.m, { n: p.n, c: v.m.c || p.c || null }) });
    }
    const b = { details: det, meta: Object.assign({}, D.meta || {}, { fips: "06037", county: "Los Angeles County" }), features: (D.bgs && D.bgs.features) || [] };
    _laCache.b = { src: D.details, b };
    return b;
  }
  const B = (typeof COUNTY_BUNDLES !== "undefined" && COUNTY_BUNDLES[fips]) || ((typeof D_OC !== "undefined" && D_OC && D_OC.meta && D_OC.meta.fips === fips) ? D_OC : null);
  return B || null;
}

// Engine inputs shaped from the data tables (unit conversion and field renaming only)
function engineCosts(rows) {
  return rows.filter(r => r && isNum(r.cost_per_mile_usd_millions)).map(r => ({ mode: r.mode, cost_per_mile: r.cost_per_mile_usd_millions * 1e6, year: r.dollar_year || null, source_url: r.source_url || null }));
}
function effectMode(label) {
  const t = String(label || "").toLowerCase();
  if (/light rail/.test(t)) return "light_rail";
  if (/heavy rail|metro/.test(t)) return "heavy_rail";
  if (/commuter/.test(t)) return "commuter_rail";
  if (/bus rapid|brt/.test(t)) return "brt";
  return "all_rail";
}
function engineEffects(rows) {
  return rows.filter(r => r && isNum(r.effect_pct)).map(r => ({ mode: effectMode(r.mode), distance_band: r.distance_band, effect_pct: r.effect_pct, source_url: r.source_url || null }));
}

// The open lot's facts, read the way the house panel reads them for the statute engine (renderHouse in app/app.js:
// the same zoning-text tests, nearest-station distance and hazard checks), so both give the same legal answer.
function parcelFacts() {
  const h = (typeof activeHouse !== "undefined") ? activeHouse : null;
  if (!h || !h.a) return null;
  const a = h.a;
  const zr = (() => {   // LA's zoning layer at the lot, as renderHouse reads it (zoneAt, zoneRules)
    try {
      const z = h.ll && typeof zoneAt === "function" ? zoneAt(h.ll) : null;
      if (!z || typeof zoneRules !== "function") return null;
      const B = (typeof activeBundle === "function" && activeBundle()) || (typeof D !== "undefined" ? D : null) || {};
      const sel = typeof selected !== "undefined" ? selected : null;
      const p = sel && typeof byId !== "undefined" && byId.get(sel) ? byId.get(sel).properties : {};
      const m = ((B.details && sel && B.details[sel]) || {}).m || p || {};
      return zoneRules(z.zone, (m.z || {}).j || p.c);
    } catch (e) { return null; }
  })();
  const hasZon = !!(zr ? zr.zone : (a.ZoneCode && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(String(a.ZoneCode).trim())));
  const baseZone = zr ? zr.zone : (hasZon ? String(a.ZoneCode).trim() : null);
  const zoneOrUse = String(baseZone || "") + " " + String(a.UseDescription || "");
  const isComm = /comm|c-|c1|c2|cbd|mixed|bu-|b-1|b-2|business/i.test(zoneOrUse);
  const isMulti = (/r-?[2-9]\b|r[2-9]\b|mf\b|multi[- ]?fam|apartment|condo|duplex|triplex|fourplex|residential multi|rm\b/i.test(zoneOrUse) || /[-_]mf\b/i.test(baseZone || ""));
  const isSfr = !isComm && !isMulti && (/r-?1\b|single[- ]?fam|single unit|residential single|sfr\b|\brs\b|\beu[- ]?m\b/i.test(zoneOrUse) || /^r-?[1a-z]$/i.test(String(baseZone || "").trim()));
  let stn = null;
  if (h.ll && typeof findNearestTransitStation === "function") { try { stn = findNearestTransitStation(h.ll.lat, h.ll.lng); } catch (e) { stn = null; } }
  const R = h.st && h.st.R;
  return {
    address: a.SitusFullAddress || null,
    facts: {
      parcel_id: String(a.AIN || a.APN || "PARCEL"),
      state_code: typeof activeState === "function" ? activeState() : null,
      county_fips: fipsNow(),
      base_zoning_code: baseZone,
      municipality_pop: isNum(a.municipality_pop) ? a.municipality_pop : null,
      county_pop: isNum(a.county_pop) ? a.county_pop : null,
      is_commercial_or_mixed_use: isComm,
      is_single_family_residential: isSfr,
      dist_to_heavy_rail_mi: (stn && (stn.type === "heavy_rail" || !stn.type) && isNum(stn.distMi)) ? stn.distMi : null,
      dist_to_frequent_bus_or_brt_mi: (stn && (stn.type === "bus" || stn.type === "brt") && isNum(stn.distMi)) ? stn.distMi : null,
      exclusions: {
        historic_district_hpoz: (R && R.hpoz && R.hpoz.ok) ? ([R.hpoz, R.hcm].filter(Boolean).some(x => x && x.ok && x.v && x.v.length) || (R.hc && R.hc.ok && Array.isArray(R.hc.v) && R.hc.v.some(r => /design|landmark|register/i.test(r.Status_Code_Description || "")))) : null,
        fema_100yr_floodway: (R && R.fema) ? !!R.fema.sfha : null,
        calfire_or_state_vhfhsz: (R && R.fire) ? !!R.fire.vh : null,
      },
      lot_sqft: isNum(h.lot) && h.lot > 0 ? h.lot : null,
    },
  };
}

function transitAreas(fips, d) {
  const corr = d.corridors.filter(c => (c.proposed_stations || []).some(s => s && s.fips === fips));
  const pipes = d.pipelines.filter(p => p && p.fips === fips);
  return { corr, pipes };
}
function pipeMode(p) {
  const t = String(p.title || "");
  return /light rail|streetcar/i.test(t) ? "light_rail" : /bus rapid|\bBRT\b/i.test(t) ? "brt" : /subway|red line|heavy rail/i.test(t) ? "heavy_rail" : null;
}

// ---------------------------------------------------------------- model: everything the engine says for this county
function ready() {
  const fips = fipsNow();
  if (typeof D === "undefined" || !D || !D.catalog || typeof cpJson !== "function") return { state: "loading" };
  const B = bundleFor(fips);
  if (!B) return { state: "loading" };
  if ((B.meta && B.meta.load_failed) || !B.details || !Object.keys(B.details).length) return { state: "nodata", fips, B };
  return { state: "ok", fips, B };
}

function build(fips, B, d) {
  const eng = E();
  const ctx = { backtest: d.backtest, catalog: D.catalog, verification: d.verification, underusedSites: d.sites, sites: (typeof SITES !== "undefined") ? SITES : null, costBenchmarks: engineCosts(d.cost), valueEffects: engineEffects(d.effects),
    laws: d.laws || undefined, unitCosts: d.unitCosts, valuationModels: d.valuationModels, prediction: d.prediction };
  const rk = eng.rankNeighborhoods(B, { backtest: d.backtest, prediction: d.prediction });
  const ranked = rk.ranked || [];
  const clean = ranked.filter(r => !(r.dataFlags && r.dataFlags.length));
  let hood = iv.hood && ranked.some(r => r.id === iv.hood) ? iv.hood : null;
  if (!hood && typeof selected !== "undefined" && selected && B.details[selected] && clean.slice(0, 5).some(r => r.id === selected)) hood = selected;
  if (!hood) hood = clean.length ? clean[0].id : (ranked[0] && ranked[0].id) || null;
  iv.hood = hood;
  const pf = parcelFacts();
  let brief = null;
  try { brief = eng.buildDecisionBrief(B, { blockGroupId: hood, parcel: pf ? pf.facts : null, top: 10 }, ctx); } catch (e) { brief = null; }
  const d0 = hood ? B.details[hood] : null;
  let rec = null;
  if (d0) { try { rec = eng.recommendForNeighborhood({ id: hood, m: d0.m, r: d0.r }, { catalog: D.catalog, verification: d.verification, countyFips: fips, underusedSites: d.sites, sites: (SITES_FOR(hood)) }); } catch (e) { rec = null; } }
  // transit: this county's local projects and intercity corridors, each run through the engine. The project table
  // (transit_pipelines.json) has no length or cost fields; a corridor's length and cost are used only when its own
  // verification confirms them.
  const { corr, pipes } = transitAreas(fips, d);
  const tCtx = { costBenchmarks: ctx.costBenchmarks, valueEffects: ctx.valueEffects };
  const pipeEval = pipes.map(p => ({ row: p, ev: eng.evaluateTransit({ name: p.title, lengthMiles: null, capitalCostUsd: null, mode: pipeMode(p) }, tCtx) }));
  const corrEval = corr.map(c => {
    const len = checkedNum(c, "route_length_miles"), cost = checkedNum(c, "estimated_capital_cost_billions");
    // block groups within 1 mile of each stop city point that lies in this county (src/engines/corridorStopAreas.js)
    const stops = window.CorridorStopAreas ? window.CorridorStopAreas.stopAreasForCounty(c, B, fips, 1) : [];
    return { row: c, len, cost, stops, ev: eng.evaluateTransit({ name: c.name, lengthMiles: len.value, intercityDistanceMiles: len.value, capitalCostUsd: cost.value != null ? cost.value * 1e9 : null, mode: /high_speed/.test(c.corridor_type || "") ? "hsr" : null }, tCtx) };
  });
  return { fips, B, rk, ranked, clean, hood, brief, rec, pf, pipeEval, corrEval, countySites: d.sites.filter(s => s && s.countyFips === fips) };
}
function SITES_FOR(id) {
  try { return (typeof SITES !== "undefined" && SITES && SITES.sites && SITES.sites[id]) ? SITES.sites[id] : []; } catch (e) { return []; }
}

// ---------------------------------------------------------------- shared row helpers
const det = (open, key, summary, inner, cls) => `<details class="iv-det${cls ? " " + cls : ""}" ${dk(open, key)}><summary>${summary}</summary>${inner}</details>`;
const keyFig = (label, html) => `<span class="iv-k">${esc2(label)}</span> ${html}`;
function nofGroup(open, key, items) {
  if (!items.length) return "";
  return det(open, key, `Not on file yet (${items.length}) - what data is missing`, `<ul class="iv-nofl">${items.map(x => `<li><b>${esc2(x.name)}</b>${x.chip ? ` <span class="iv-chip">${esc2(x.chip)}</span>` : ""}<span class="iv-muted"> ${x.why ? esc2(x.why) : "no figure on file"}</span></li>`).join("")}</ul>`, "iv-nofgroup");
}
// The chip says what the data audit found (app/data/intervention_verification.json), as the map panel does.
const VER_TXT = { verified: "Sourced inputs", partially_verified: "Partly verified", unverified: "Not sourced yet" };
function tierChip(ev) {
  if (!ev) return "";
  const t = ev.tier || "assumed";
  const label = ev.verification && VER_TXT[ev.verification] ? VER_TXT[ev.verification] : (TIER_TXT[t] || t);
  return `<span class="iv-tier ${tierCls(t)}" title="${esc2(ev.note || "")}">${esc2(label)}</span>`;
}
function evidenceDetail(ev) {
  if (!ev) return "";
  const srcs = (ev.sources || []).map(s => { const u = String(s).match(/https?:\/\/[^\s;,)"]+/); return `<li>${u ? `<a href="${esc2(u[0])}" target="_blank" rel="noopener">${esc2(s)}</a>` : esc2(s)}</li>`; }).join("");
  return `<div class="iv-ev">${tierChip(ev)}${ev.grade ? `<span class="iv-muted"> catalog grade ${esc2(ev.grade)} (the build's own rating)</span>` : ""}${ev.note ? `<p class="iv-muted">${esc2(ev.note)}</p>` : ""}${ev.evidenceNote ? `<p class="iv-muted">Audit note: ${esc2(ev.evidenceNote)}</p>` : ""}${srcs ? `<p class="iv-k">Sources the catalog cites (${(ev.sources || []).length})</p><ul>${srcs}</ul>` : ""}${ev.caveat ? `<p class="iv-muted">${esc2(ev.caveat)}</p>` : ""}</div>`;
}
function rowHTML(o, open) {
  return `<li class="iv-play iv-row${o.cls ? " " + o.cls : ""}"><div class="iv-row-top">
      <div class="iv-row-name"><b>${esc2(o.name)}</b>${o.chip ? `<span class="iv-chip">${esc2(o.chip)}</span>` : ""}</div>
      <div class="iv-row-fig">${o.fig || ""}</div>
      <div class="iv-row-ev">${o.ev || ""}</div></div>
    ${o.sub ? `<p class="iv-row-sub">${o.sub}</p>` : ""}
    ${o.detail ? det(open, o.key, "Details and sources", o.detail) : ""}</li>`;
}
const hasFig = t => t && t.value != null && isNum(t.value);

// ---------------------------------------------------------------- header strip
function honest(bt, fips, name) {
  if (!bt) return { tone: "neutral", plain: "how well this ranking has worked is not known, so treat these as places to investigate", text: "The back-test file could not be loaded, so how well this ranking has worked is not known." };
  const row = (bt.per_metro || []).find(r => r.fips === fips);
  const n = bt.sample && bt.sample.counties;
  if (!row || (row.engine_rho_P1 == null && row.engine_rho_P2 == null)) {
    return { tone: "neutral", plain: "this county was not back-tested, so treat these as places to investigate, not a forecast", text: `Not back-tested here. The test covered ${n || "50"} large counties, chosen by size from the county data files, and ${name} was not one of them, so we do not know whether this ranking has worked here. Treat it as a list to investigate, not a forecast.` };
  }
  const r1 = row.engine_rho_P1, r2 = row.engine_rho_P2;
  const rho = v => v == null ? "not tested" : String(v);
  if (r2 != null && r2 > 0 && (r1 == null || r1 > 0)) {
    return { tone: "good", plain: "in this county the ranking pointed the right way in 2020-25, but it screens for relative value and does not forecast prices", text: `In 2020-25 this ranking pointed the right way in ${name} (rank correlation ${rho(r2)}; ${rho(r1)} in 2015-20). Even so, it is a screen for relative value, not a forecast of prices.` };
  }
  if (r2 != null && r2 <= 0) {
    return { tone: "bad", plain: "in this county the ranking pointed the wrong way in 2020-25, so treat these as places to investigate", text: `In 2020-25 this ranking pointed the wrong way in ${name} (rank correlation ${rho(r2)}; ${rho(r1)} in 2015-20). Treat it as a list to investigate, not a forecast.` };
  }
  return { tone: "bad", plain: "in this county the ranking failed one of its two tests, so treat these as places to investigate", text: `This ranking failed in one of the two test periods in ${name} (rank correlation ${rho(r1)} in 2015-20, ${rho(r2)} in 2020-25). Treat it as a list to investigate, not a forecast.` };
}
function overall(bt) {
  if (!bt) return "";
  const s = bt.per_metro_summary || {}, p1 = s.engine_P1, p2 = s.engine_P2, v = bt.verdict || {};
  const pct = x => Math.round(x * 100) + "%";
  const chips = [];
  if (p2 && p2.share_positive != null) chips.push(`<li><b>${pct(p2.share_positive)}</b><span>of ${p2.counties} large counties ranked the right way, 2020-25</span></li>`);
  if (p1 && p1.share_positive != null) chips.push(`<li><b>${pct(p1.share_positive)}</b><span>of ${p1.counties} counties, 2015-20</span></li>`);
  if (v.composite_bundle_beats_cheapest_all_schemes === false) chips.push(`<li><b>No better</b><span>than simply picking the cheapest areas in a county</span></li>`);
  return chips.length ? `<ul class="iv-stats">${chips.join("")}</ul>` : "";
}
function testedPanel(bt, h) {
  const li = a => (a || []).map(x => `<li>${esc2(x)}</li>`).join("");
  if (!bt) return `<p>The back-test file could not be loaded.</p>`;
  return `<p class="iv-honest t-${h.tone}">${esc2(h.text)}</p>${overall(bt)}
    <p><b>The question.</b> ${esc2(bt.question || "")}</p>
    <p><b>What was compared.</b> ${esc2((bt.outcome && bt.outcome.measure) || "")}. ${esc2((bt.sample && bt.sample.selection) || "")}</p>
    <p><b>What it found.</b></p><ul>${li(bt.headline)}</ul>
    <p><b>What it cannot tell you.</b></p><ul>${li((bt.limitations || []).slice(0, 6))}</ul>
    <p class="iv-muted">The full write-up is in <a href="docs/DECISION-ENGINE.md" target="_blank" rel="noopener">docs/DECISION-ENGINE.md</a>; the numbers are in <a href="app/data/neighborhood_score_backtest.json" target="_blank" rel="noopener">neighborhood_score_backtest.json</a>.</p>`;
}

// ---------------------------------------------------------------- derived lists (shared by the cards and the bottom line)
const BUDGET_OK = () => BUDGETS[iv.budget].v;
function buildLists(m) {
  const bud = BUDGET_OK(), rec = m.rec;
  const out = { on: [], off: [], hiddenN: 0, hiddenPlays: 0, ideasAll: 0 };
  if (!rec) return out;
  const plays = rec.housingPlays.filter(p => bud >= TIER_MIN[PLAY_TIER[p.play] || "house"]);
  out.hiddenPlays = rec.housingPlays.length - plays.length;
  for (const p of plays) {
    const key = p.cost && hasFig(p.valuePerDollar) ? keyFig("Back per $1", fig(p.valuePerDollar)) : p.cost && hasFig(p.cost) ? keyFig("Cost", fig(p.cost)) : null;
    const item = { kind: "play", name: p.label, chip: "housing play", p, key };
    (key ? out.on : out.off).push(item);
  }
  const aff = rec.ideas.filter(x => x.cost.value == null || x.cost.value <= bud);
  out.hiddenN = rec.ideas.length - aff.length; out.ideasAll = aff.length;
  for (const x of aff) {
    const key = hasFig(x.valuePerDollar) ? keyFig("Back per $1", fig(x.valuePerDollar)) : hasFig(x.cost) ? keyFig("Cost", fig(x.cost)) : null;
    const item = { kind: "idea", name: x.name, chip: x.kind || "improvement", x, key };
    (key ? out.on : out.off).push(item);
  }
  return out;
}
function siteLists(m) {
  const list = m.countySites.slice().sort((a, b) => (b.acres || 0) - (a.acres || 0));
  return { on: list.filter(s => s.acres != null), off: list.filter(s => s.acres == null), all: list };
}
const siteName = s => s.name || ((s.kind ? s.kind.replace(/^./, c => c.toUpperCase()) : "Site") + (s.neighborhoodName ? " in " + s.neighborhoodName : ""));
const hoodName = (m, id) => { const x = m.B.details[id] && m.B.details[id].m || {}; return x.n || "the selected area"; };

// ---------------------------------------------------------------- bottom line
function bottomLine(m) {
  const name = countyShort(), h = honest(iv.data.backtest, m.fips, name), items = [];
  const top3 = m.clean.slice(0, 3).map(r => r.name || "an unnamed area");
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  items.push(["Where", top3.length ? `${top3.join(", ")} look cheapest for what they have; ${h.plain}.` : `No area in ${name} could be ranked.`, "iv-where"]);
  const bl = buildLists(m);
  const picks = bl.on.slice(0, 3).map(x => x.name);
  items.push(["Build", !m.rec ? "No area is selected, so no plays are shown." : picks.length ? `For ${hoodName(m, m.hood)}, the best-supported plays at this budget are ${picks.join("; ")}.` : bl.off.length ? `For ${hoodName(m, m.hood)}, ${bl.off.length} plays fit this budget but none has a cost figure on file yet.` : `For ${hoodName(m, m.hood)}, nothing is listed at this budget.`, "iv-build"]);
  const sl = siteLists(m);
  const big = sl.on[0];
  items.push(["Properties", !sl.all.length ? `None on file for ${name}.` : `${sl.all.length} measured ${sl.all.length === 1 ? "site" : "sites"} in ${name}${big ? `, the largest is ${siteName(big)} (${big.acres.toFixed(1)} acres)` : ""}${BUDGET_OK() < TIER_MIN.site ? "; raise the budget to $2M to list them" : ""}.`, "iv-sites"]);
  const p = m.brief && m.brief.parcel;
  items.push(["This house", !m.pf || !p ? "Open a lot on the map to see what could be added to it." : `${m.pf.address || "The open lot"}: ${p.expansions.length} possible additions checked, ${p.expansions.filter(x => hasFig(x.netValue)).length} with a net-value figure.`, "iv-house"]);
  const area = m.brief && m.brief.transit;
  let t;
  if (!area) t = "No transit answer for the selected area.";
  else if (area.verdict === "not_enough_data" || !area.verdict) { const mi = (area.missing || []).map(plainMissing).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 2); t = `Not enough data: ${mi.length ? mi.join("; ") : "inputs are missing"}.`; }
  else t = `${VERDICT_TXT[area.verdict] || area.verdict}${area.scale ? ", suggested scale: " + (SCALE_TXT[area.scale] || area.scale).toLowerCase() : ""}.`;
  items.push(["Transit", t, "iv-transit"]);
  return `<section class="iv-bottom" id="iv-bottom" aria-labelledby="iv-bottom-h"><h3 id="iv-bottom-h">Bottom line</h3>
    <ul>${items.map(([k, s, id]) => `<li><button type="button" class="iv-bl-k" data-iv-jump="${id}">${k}</button> <span>${esc2(cap(s))}</span></li>`).join("")}</ul></section>`;
}
function plainMissing(t) {
  const x = String(t || "");
  if (/annual/i.test(x)) return "yearly cost and ridership figures";
  const par = x.match(/\(([^)]+)\)/);
  if (/^[a-z]+[A-Z]\w*/.test(x) && par) return par[1].replace(/^for /, "");
  return x.replace(/\s*\([^)]*\)/g, "");
}
const NAV = [["iv-where", "Where"], ["iv-build", "Build"], ["iv-sites", "Properties"], ["iv-house", "This house"], ["iv-transit", "Transit"]];
const navHTML = () => `<nav class="iv-nav" aria-label="Sections">${NAV.map(([id, l]) => `<button type="button" data-iv-jump="${id}">${l}</button>`).join("")}</nav>`;

// ---------------------------------------------------------------- card: where
function whereCard(m, open) {
  const n = iv.moreHoods ? 10 : 5;
  const top = m.clean.slice(0, n);
  const rows = top.map((r, i) => hoodItem(r, i + 1, m, open)).join("");
  const flagged = m.ranked.length - m.clean.length, unscored = (m.rk.unscored || []).length;
  const more = m.clean.length > 5 ? `<button type="button" class="tool-btn" data-iv="more-hoods">${iv.moreHoods ? "Show 5" : `Show ${Math.min(10, m.clean.length)}`}</button>` : "";
  return `<section class="iv-card" id="iv-where" aria-labelledby="iv-where-h">
    <h3 id="iv-where-h">Where</h3>
    <p class="iv-lede">Areas (Census block groups) that look cheapest for what they have, within ${esc2(countyShort())}. The grade says how far to trust each one. Pick one to update Build and the bottom line.</p>
    ${det(open, "grades", "What the grades mean", `<ul>${["A", "B", "C", "D"].map(g => `<li><b>${g}</b> ${esc2(GRADE_TXT[g])}</li>`).join("")}</ul>`)}
    ${top.length ? `<ol class="iv-hoods">${rows}</ol>${more}` : `<p class="iv-empty">No area in this county could be ranked${m.rk.missing && m.rk.missing.length ? ": " + esc2(missList(m.rk.missing)) : ""}.</p>`}
    <p class="iv-muted">${m.ranked.length ? `${m.ranked.length.toLocaleString("en-US")} areas ranked` : "No areas ranked"}${flagged ? `; ${flagged} more failed a data check (for example, a home value that looks like mobile homes or very few owner homes) and are graded D, not listed` : ""}${unscored ? `; ${unscored.toLocaleString("en-US")} could not be scored because a Census input is missing` : ""}.</p>
  </section>`;
}
function hoodItem(r, rank, m, open) {
  const sel = r.id === m.hood;
  const h = r.historicalRelativeChange;
  const hist = h ? `<div class="iv-hist"><span class="iv-k">Back-test, average for this score fifth (${r.scoreQuintile} of 5)</span> 2020-25: ${fig(h["2020_2025"], "back-test table has no value for this fifth")} &nbsp; 2015-20: ${fig(h["2015_2020"], "back-test table has no value for this fifth")}</div>` : `<div class="iv-hist"><span class="iv-k">Back-test history</span> ${nof("no back-test table in this build")}</div>`;
  const pr = r.prediction && r.prediction.relative5y, tested = pr ? `<div class="iv-hist"><span class="iv-k">Tested 5-year range, tract-level (80% of tracts like this)</span> ${fig(pr.low)} to ${fig(pr.high)} vs the county's median tract. <span class="iv-muted">${esc2(r.prediction.testedOn || "")}</span></div>` : "";
  const comps = (r.components || []).map(c => `<tr><td>${esc2(c.label || c.signal)}</td><td>${fig(c.countyPercentile)}</td><td>${fig(c.weight)}</td></tr>`).join("");
  return `<li class="iv-hood${sel ? " sel" : ""}" data-hood="${esc2(r.id)}">
    <div class="iv-hood-top">
      <span class="iv-rank">${rank}</span>
      <div class="iv-hood-name"><b>${esc2(r.name || "Unnamed area")}</b><span>${esc2(r.city || "")}</span></div>
      <span class="iv-grade g-${esc2(r.confidence.grade)}" title="${esc2(r.confidence.reasons.join(" | "))}">Confidence ${esc2(r.confidence.grade)}</span>
      <div class="iv-actions">
        <button type="button" class="tool-btn${sel ? " primary" : ""}" data-iv-hood="${esc2(r.id)}" aria-pressed="${sel}">${sel ? "Selected" : "Select"}</button>
        <button type="button" class="tool-btn" data-iv-map="${esc2(r.id)}"><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg><span>See on map</span></button>
      </div>
    </div>
    <p class="iv-reason1">${esc2(r.reasons[0] || "")}</p>
    ${det(open, "comp-" + r.id, "Score, back-test and all reasons", `<div class="iv-figs"><span class="iv-k">Relative-value score</span> ${fig(r.score)}</div>${hist}${tested}
      <ul class="iv-reasons">${r.reasons.map(x => `<li>${esc2(x)}</li>`).join("")}</ul>
      <div class="iv-tablewrap"><table class="iv-table"><thead><tr><th>Signal</th><th>Where this area sits in the county</th><th>Weight in the score</th></tr></thead><tbody>${comps}</tbody></table></div>
      <p class="iv-k">Why this grade</p><ul class="iv-reasons">${r.confidence.reasons.map(x => `<li>${esc2(x)}</li>`).join("")}</ul>
      <p class="iv-muted">Weights were fitted on real price history (FHFA tract index), see "How this was tested" above.</p>`)}
  </li>`;
}

// ---------------------------------------------------------------- card: what to build
const PLAY_TIER = { adu: "house", lot_split: "house", small_multifamily: "building", underused_site_conversion: "site" };
function buildCard(m, open) {
  const rec = m.rec;
  if (!rec) return `<section class="iv-card" id="iv-build" aria-labelledby="iv-build-h"><h3 id="iv-build-h">Build</h3><p class="iv-empty">No neighborhood is selected. ${nof("no ranked area")}</p></section>`;
  const d = m.B.details[m.hood] && m.B.details[m.hood].m || {};
  const bl = buildLists(m);
  const shown = iv.moreIdeas ? bl.on : bl.on.slice(0, 5);
  const rowFor = it => {
    if (it.kind === "play") {
      const p = it.p;
      return rowHTML({ name: it.name, chip: it.chip, fig: it.key, ev: tierChip(p.evidence), sub: `Legal: ${esc2(p.legal)}.`, key: "pl-" + m.hood + "-" + p.play,
        detail: `<p class="iv-muted">Available: ${esc2(p.available)}. Legal: ${esc2(p.legal)}.</p>
          <dl class="iv-dl"><div><dt>Cost</dt><dd>${fig(p.cost, missList(p.missing))}</dd></div><div><dt>Value added</dt><dd>${fig(p.valueAdded, missList(p.missing))}</dd></div><div><dt>Value back per $1</dt><dd>${fig(p.valuePerDollar, missList(p.missing))}</dd></div></dl>
          ${p.missing && p.missing.length ? `<p class="iv-muted">Missing: ${missList(p.missing)}</p>` : ""}${evidenceDetail(p.evidence)}` }, open);
    }
    const x = it.x;
    return rowHTML({ name: it.name, chip: it.chip, fig: it.key, ev: tierChip(x.evidence), key: "id-" + m.hood + "-" + esc2(it.name),
      detail: `${x.project ? `<p>${esc2(x.project)}</p>` : ""}
        <dl class="iv-dl"><div><dt>Cost</dt><dd>${fig(x.cost, "pipeline gave no cost")}</dd></div>
          <div><dt>Added home value nearby</dt><dd>${fig(x.valueAdded, x.missing.length ? missList(x.missing) : "this kind of idea has no home-value estimate")}</dd></div>
          <div><dt>Value back per $1</dt><dd>${fig(x.valuePerDollar, x.missing.length ? missList(x.missing) : "not priced")}</dd></div></dl>
        ${x.why ? `<p class="iv-muted">Why here: ${esc2(x.why)}</p>` : ""}${evidenceDetail(x.evidence)}` }, open);
  };
  const offItems = bl.off.map(it => ({ name: it.name, chip: it.chip, why: (it.p ? it.p.missing : it.x.missing) && (it.p ? it.p.missing : it.x.missing).length ? missList(it.p ? it.p.missing : it.x.missing) : "no cost or value figure on file" }));
  for (const w of rec.withheld || []) offItems.push({ name: w.name, chip: "no figures", why: w.reason });
  if (rec.missing && rec.missing.length) offItems.push({ name: "Other inputs for this area", why: missList(rec.missing) });
  return `<section class="iv-card" id="iv-build" aria-labelledby="iv-build-h">
    <h3 id="iv-build-h">Build</h3>
    <p class="iv-lede">For <b>${esc2(d.n || "the selected area")}</b>${d.c ? `, ${esc2(d.c)}` : ""}. Housing plays and public improvements, strongest evidence and best return first.</p>
    ${shown.length ? `<ul class="iv-plays">${shown.map(rowFor).join("")}</ul>` : `<p class="iv-empty">Nothing with a cost figure is listed at this budget.</p>`}
    ${bl.on.length > 5 ? `<button type="button" class="tool-btn" data-iv="more-ideas">${iv.moreIdeas ? "Show fewer" : `Show all ${bl.on.length}`}</button>` : ""}
    ${bl.hiddenPlays ? `<p class="iv-gated">${bl.hiddenPlays} larger housing ${bl.hiddenPlays === 1 ? "play opens" : "plays open"} at a bigger budget.</p>` : ""}
    ${bl.hiddenN ? `<p class="iv-gated">${bl.hiddenN} ${bl.hiddenN === 1 ? "idea costs" : "ideas cost"} more than this budget and ${bl.hiddenN === 1 ? "is" : "are"} hidden.</p>` : ""}
    ${nofGroup(open, "off-build", offItems)}
    ${det(open, "caveats", "Caveats", `<ul class="iv-caveats">${rec.caveats.map(c => `<li>${esc2(c)}</li>`).join("")}</ul>`)}
  </section>`;
}

// ---------------------------------------------------------------- card: properties to redevelop
// Model-output fields a site record lists as unverified (homes it could hold, margin, land value) get no figure here;
// the record's own note on how each was made is shown instead.
const SITE_MODEL_FIELDS = [["potentialHomes", "Homes it could hold"], ["margin", "Developer margin"], ["marketLandValue", "Market land value"]];
function siteDetail(s) {
  const v = s.verification || {};
  const uf = (v.unverified_fields || []).map(u => String(u).split(/[\s(]/)[0]);
  const held = SITE_MODEL_FIELDS.filter(([f]) => s[f] != null || uf.includes(f)).map(([f, label]) => `<div><dt>${label}</dt><dd>${uf.includes(f) ? nof("model estimate, listed as unverified in the record" + (v.model_output_fields && v.model_output_fields[f] ? ": " + v.model_output_fields[f] : "")) : isNum(s[f]) ? (f === "potentialHomes" ? Math.round(s[f]).toLocaleString("en-US") : money(s[f])) + " " + basisTag("modelled") : nof("")}</dd></div>`).join("");
  const facts = [
    ["Zoning", s.baseZoning ? `${esc2(s.baseZoning)}${s.zoningCategory ? ` (${esc2(s.zoningCategory)})` : ""} <span class="iv-muted">from the county data bundle, not re-checked</span>` : nof("zoning code not on file")],
    ["Owner", s.publicOwner || s.ownerName ? esc2(s.publicOwner || s.ownerName) : nof("owner not on file")],
    ["Nearest rail", s.nearestRailStation ? `${esc2(s.nearestRailStation)}${s.railStationStatus ? ` (${esc2(s.railStationStatus)})` : ""}${s.distanceToRailMeters != null ? `, ${Math.round(s.distanceToRailMeters).toLocaleString("en-US")} m away` : ""}` : nof("no rail station recorded")],
    ["Median home value nearby", s.neighborhoodMedianHv != null ? fig({ value: s.neighborhoodMedianHv, unit: "USD", source: "Census ACS median home value for the block group", basis: "measured" }) : nof("not on file")],
  ].map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join("");
  const ev = v.evidence_url ? `<a href="${esc2(v.evidence_url)}" target="_blank" rel="noopener">evidence</a>` : "";
  return `${s.address ? `<p class="iv-muted">${esc2(s.address)}${s.cityName ? ", " + esc2(s.cityName) : ""}</p>` : s.cityName ? `<p class="iv-muted">${esc2(s.cityName)}</p>` : ""}
    <p class="iv-muted">Facts verification: ${esc2((v.status || "not verified").replace(/_/g, " "))}${v.audited ? `, checked ${esc2(v.audited)}` : ""} ${ev}${v.source_fields_origin ? ` (${esc2(v.source_fields_origin)})` : ""}</p>
    <dl class="iv-dl iv-facts">${facts}</dl>
    ${held ? `<div class="iv-screen"><div class="iv-screen-h">Model estimates in the record</div><dl class="iv-dl">${held}</dl></div>` : ""}`;
}
function sitesCard(m, open) {
  const bud = BUDGET_OK();
  const sl = siteLists(m), list = sl.all;
  const places = ((m.rec && m.rec.places) || []).filter(p => !p.cost || p.cost.low.value == null || p.cost.low.value <= bud);
  const openTier = bud >= TIER_MIN.site;
  const shown = iv.moreSites ? sl.on : sl.on.slice(0, 4);
  const sRow = s => { const v = s.verification || {}; return rowHTML({ name: siteName(s), chip: s.kind || "site", fig: keyFig("Size", fig({ value: s.acres, unit: "acres", source: s.sourceUrl, basis: "measured" })), ev: `<span class="iv-verif" title="${esc2((v.source_fields || []).join(", "))}">Facts: ${esc2((v.status || "not verified").replace(/_/g, " "))}</span>`, sub: s.cityName ? esc2(s.cityName) : "", key: "site-" + esc2(s.id), detail: siteDetail(s) }, open); };
  let body;
  if (!list.length) body = `<p class="iv-empty">No underused sites have been measured for ${esc2(countyShort())} yet, so none are listed. Only sites whose size was measured from a parcel or map record are shown; none are inferred.</p>`;
  else if (!openTier) body = `<p class="iv-gated">${list.length} measured ${list.length === 1 ? "site is" : "sites are"} listed in ${esc2(countyShort())}. Site-sized plays start at about $2M; raise the budget to see ${list.length === 1 ? "it" : "them"}.</p>`;
  else body = `<ul class="iv-plays">${shown.map(sRow).join("")}</ul>${sl.on.length > 4 ? `<button type="button" class="tool-btn" data-iv="more-sites">${iv.moreSites ? "Show fewer sites" : `Show all ${sl.on.length} sites`}</button>` : ""}`;
  const pOn = places.filter(p => p.cost && hasFig(p.cost.low)), pOff = places.filter(p => !(p.cost && hasFig(p.cost.low)));
  const pRow = p => rowHTML({ name: p.name || p.type || "Site", chip: p.type || "site", fig: keyFig("Cost", `${fig(p.cost.low)} to ${fig(p.cost.high, "no upper figure")}`), key: "pl-" + esc2(p.name || p.type), detail: p.idea ? `<p class="iv-muted">Matches the idea: ${esc2(p.idea)}</p>` : `<p class="iv-muted">Cost range from the sites bundle.</p>` }, open);
  const placeHTML = pOn.length ? `<h4>Small public sites near the selected area</h4><ul class="iv-plays">${pOn.map(pRow).join("")}</ul>` : "";
  const offItems = (openTier ? sl.off.map(s => ({ name: siteName(s), chip: s.kind || "site", why: "size not measured" })) : []).concat(pOff.map(p => ({ name: p.name || p.type || "Site", chip: p.type || "site", why: "no cost range in the sites bundle" })));
  return `<section class="iv-card" id="iv-sites" aria-labelledby="iv-sites-h">
    <h3 id="iv-sites-h">Properties</h3>
    <p class="iv-lede">Golf courses, parking lots and vacant land to redevelop. The facts (size, place) carry a verification status. The record's model estimates (homes it could hold, margin, land value) are listed as unverified, so no figure is shown for them.</p>
    ${body}${placeHTML}${nofGroup(open, "off-sites", offItems)}
  </section>`;
}

// ---------------------------------------------------------------- card: this house
function legalShort(l) { return !l ? "Law not determined" : /^allowed/.test(l.status) ? "Allowed by state law" : "Law not determined"; }
function legalHTML(l) {
  if (!l) return nof("");
  if (/^allowed/.test(l.status)) {
    const st = l.verification_status ? String(l.verification_status).replace(/_/g, " ") : "status not on file";
    const link = l.statute_url ? ` <a class="iv-src" href="${esc2(l.statute_url)}" target="_blank" rel="noopener">law text</a>` : "";
    const unc = (l.unconfirmed_fields || []).length ? `<br><span class="iv-muted">Not confirmed in the law's text: ${esc2(l.unconfirmed_fields.join("; "))}</span>` : "";
    return `Allowed by ${esc2(l.citation || "state law")} (law text ${esc2(st)}${l.checked ? `, checked ${esc2(l.checked)}` : ", check date not on file"})${link}. A screen, not a permit: the city or county decides.${unc}`;
  }
  return `Not determined: ${esc2(l.why || "no rule loaded")}`;
}
function houseCard(m, open) {
  const head = `<section class="iv-card" id="iv-house" aria-labelledby="iv-house-h"><h3 id="iv-house-h">This house</h3>`;
  const p = m.brief && m.brief.parcel;
  if (!m.pf || !p) {
    return head + `<p class="iv-lede">This section works from one lot. Open a lot on the map (search an address, or click a lot) and come back here: it shows what could be added to that house, what the law allows, and what is still unknown.</p>
      <button type="button" class="tool-btn" data-iv-leave="map"><svg class="ic" aria-hidden="true"><use href="#i-map"/></svg><span>Open the map to pick a lot</span></button></section>`;
  }
  const on = p.expansions.filter(x => hasFig(x.netValue) || hasFig(x.cost.low) || hasFig(x.cost.high) || hasFig(x.valueAdded));
  const off = p.expansions.filter(x => !on.includes(x));
  const exps = on.map(x => rowHTML({ name: x.label, fig: hasFig(x.netValue) ? keyFig("Net value", fig(x.netValue)) : keyFig("Cost", `${fig(x.cost.low, "no low figure")} to ${fig(x.cost.high, "no high figure")}`), ev: `<span class="iv-chip">${esc2(legalShort(x.legal))}</span>`, key: "exp-" + esc2(x.expansion),
    detail: `<p class="iv-legal">${legalHTML(x.legal)}</p>
      <dl class="iv-dl"><div><dt>Cost, low to high</dt><dd>${fig(x.cost.low)} to ${fig(x.cost.high)}</dd></div>
        <div><dt>Value added</dt><dd>${fig(x.valueAdded, "no sourced value coefficient for this item")}</dd></div>
        <div><dt>Net value</dt><dd>${fig(x.netValue, "needs both cost and value added")}</dd></div></dl>
      ${x.missing && x.missing.length ? `<p class="iv-k">What data is missing</p><ul>${x.missing.map(t => `<li>${esc2(t)}</li>`).join("")}</ul>` : ""}` }, open)).join("");
  const offItems = off.map(x => ({ name: x.label, chip: legalShort(x.legal), why: [x.legal && x.legal.why ? "Law: " + x.legal.why : "", x.missing && x.missing.length ? x.missing.join("; ") : "no sourced construction cost or value for this item"].filter(Boolean).join(". ") }));
  return head + `<p class="iv-lede">${m.pf.address ? `<b>${esc2(m.pf.address)}</b>` : "The lot open on the map"}${p.parcelId && !String(m.pf.address || "").includes(p.parcelId) ? ` <span class="iv-muted">(parcel ${esc2(p.parcelId)})</span>` : ""}.</p>
    ${exps ? `<ul class="iv-plays">${exps}</ul>` : `<p class="iv-empty">No addition has a cost or value figure on file.</p>`}
    ${nofGroup(open, "off-house", offItems)}
    ${det(open, "house-law", "Zoning, statutes and caveats", `${p.zoning ? `<p class="iv-muted">State laws that apply to this lot: ${p.zoning.statutes.length ? esc2(p.zoning.statutes.join("; ")) : "none confirmed"}. ${esc2(p.zoning.note || "")}</p>${(p.zoning.not_confirmed || []).length ? `<p class="iv-k">Laws on file that could not be applied here</p><ul class="iv-caveats">${p.zoning.not_confirmed.map(c => `<li>${esc2(c)}</li>`).join("")}</ul>` : ""}` : `<p class="iv-muted">Zoning not determined: ${(p.missing || []).includes("base_zoning_code") ? "the parcel record has no zoning code, so no state law was applied" : "the statute engine did not run"}.</p>`}<ul class="iv-caveats">${p.caveats.map(c => `<li>${esc2(c)}</li>`).join("")}</ul>`)}</section>`;
}

// ---------------------------------------------------------------- card: transit
const BENCH_GROUPS = [
  { key: "bus_frequency", label: "More frequent buses", modes: [], note: "No per-mile capital benchmark for ordinary bus service is in the table." },
  { key: "brt", label: "Bus rapid transit", modes: ["brt"] },
  { key: "light_rail", label: "Light rail and streetcar", modes: ["light_rail", "streetcar", "urban_rail"], note: "Includes urban rail rows where the dataset does not separate light from heavy rail." },
  { key: "heavy_rail", label: "Heavy rail or metro", modes: ["heavy_rail", "urban_rail"], note: "Includes urban rail rows where the dataset does not separate light from heavy rail." },
  { key: "commuter_rail", label: "Commuter or regional rail", modes: ["commuter_rail", "regional_rail"] },
  { key: "hsr", label: "High-speed rail", modes: [], note: "No high-speed rail rows are in the table." },
];
function benchRows(g, d) {
  const rows = d.cost.filter(r => r && g.modes.includes(r.mode) && isNum(r.cost_per_mile_usd_millions));
  if (!rows.length) return null;
  const v = rows.map(r => r.cost_per_mile_usd_millions);
  const srcs = [...new Set(rows.map(r => r.source_dataset).filter(Boolean))];
  const url = (rows.find(r => r.listing_url || r.dataset_landing_url) || rows[0]);
  return { n: rows.length, lo: Math.min(...v), hi: Math.max(...v), srcs, url: url.listing_url || url.dataset_landing_url || url.source_url || null };
}
function benchTable(d, scale) {
  const rows = BENCH_GROUPS.map(g => {
    const b = benchRows(g, d);
    return `<tr class="${g.key === scale ? "hl" : ""}"><td>${esc2(g.label)}${g.key === scale ? ' <span class="iv-chip">suggested scale</span>' : ""}</td>
      <td>${b ? `$${Math.round(b.lo).toLocaleString("en-US")}M to $${Math.round(b.hi).toLocaleString("en-US")}M ${basisTag("measured")}` : nof(g.note || "no rows")}</td>
      <td>${b ? b.n : "0"}</td><td>${b ? `${esc2(b.srcs.join("; "))} ${b.url ? srcMark(b.url) : ""}` : ""}</td></tr>`;
  }).join("");
  return `<div class="iv-tablewrap"><table class="iv-table"><caption class="iv-muted">Capital cost per mile of built or planned US and world projects, as reported by their sponsors. Dollar years differ and are not adjusted; the ranges are wide because projects differ (tunnels cost far more than at-grade).</caption>
    <thead><tr><th>Mode</th><th>Cost per mile, lowest to highest</th><th>Projects (n)</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function benchSummary(d) {
  const bs = BENCH_GROUPS.map(g => benchRows(g, d)).filter(Boolean);
  if (!bs.length) return "no rows on file";
  return `${bs.reduce((a, b) => a + b.n, 0)} projects, $${Math.round(Math.min(...bs.map(b => b.lo))).toLocaleString("en-US")}M to $${Math.round(Math.max(...bs.map(b => b.hi))).toLocaleString("en-US")}M per mile`;
}
function effectsTable(d, scale) {
  const want = { brt: "brt", light_rail: "light_rail", heavy_rail: "heavy_rail", commuter_rail: "commuter_rail" }[scale] || null;
  const rows = d.effects.filter(r => { const k = effectMode(r.mode); return k === "all_rail" || k === want; });
  const rest = d.effects.length - rows.length;
  const tr = r => `<tr><td>${esc2(r.mode)}</td><td>${esc2(r.distance_band || "")}</td><td>${r.effect_pct != null ? `${r.effect_pct > 0 ? "+" : ""}${r.effect_pct}% ${basisTag("measured")}` : nof("study reports a premium but no figure")}${r.range_low_pct != null ? `<span class="iv-muted"> (studies range ${r.range_low_pct}% to ${r.range_high_pct}%)</span>` : ""}</td>
      <td>${esc2(r.city || "")}</td><td>${r.source_url ? `<a class="iv-src" href="${esc2(r.source_url)}" target="_blank" rel="noopener" title="${esc2(r.study || "")}">source</a>` : ""}</td></tr>`;
  if (!d.effects.length) return `<p class="iv-empty">${nof("transit_value_effects.json could not be loaded")}</p>`;
  return `<div class="iv-tablewrap"><table class="iv-table"><caption class="iv-muted">Change in nearby property values after a station opened, from published studies (not measured in ${esc2(countyShort())}). ${scale ? "" : "No scale is suggested yet, so only studies of all rail are shown first."}</caption>
    <thead><tr><th>Mode</th><th>Distance</th><th>Effect on value</th><th>Where</th><th>Study</th></tr></thead><tbody>${rows.map(tr).join("")}${rest > 0 ? d.effects.filter(r => !rows.includes(r)).map(tr).join("") : ""}</tbody></table></div>`;
}
function effectsSummary(d) {
  const v = d.effects.map(r => r.effect_pct).filter(isNum);
  if (!d.effects.length) return "no studies on file";
  return `${d.effects.length} studies${v.length ? `, effects from ${Math.min(...v)}% to +${Math.max(...v)}%` : ""}`;
}
function thresholdTable(ev, T) {
  const sup = {}; ((ev && ev.density && ev.density.supports) || []).forEach(s => { sup[s.label] = s; });
  const known = ev && ev.density && ev.density.homesPerNetAcre && ev.density.homesPerNetAcre.value != null;
  const rows = T.tcqsm_density.rows.map(r => {
    const need = Array.isArray(r.du_per_net_acre) ? r.du_per_net_acre.join("-") : r.du_per_net_acre;
    const s = sup[r.label];
    return `<tr><td>${esc2(r.label)}</td><td>${esc2(need)}</td><td>${r.cbd_million_sqft ? esc2(r.cbd_million_sqft.join("-")) + "M sq ft" : r.cbd_million_sqft_min ? "over " + r.cbd_million_sqft_min + "M sq ft" : "not required"}</td><td>${!known ? nof("") : s ? "Density met" : "Density not met"}</td></tr>`;
  }).join("");
  const c = T.fta_cig.cost_per_trip_usd_2025.map((x, i, a) => `${x.rating} ${i === 0 ? "under $" + x.max_exclusive : x.max_exclusive === Infinity ? "$" + a[i - 1].max_exclusive + " and over" : "$" + a[i - 1].max_exclusive + " to under $" + x.max_exclusive}`).join("; ");
  return `<div class="iv-tablewrap"><table class="iv-table"><caption class="iv-muted">Minimum density and downtown size for each service (TCRP Report 165, Exhibit 3-8). Bundle densities are per gross acre and are multiplied by ${T.tcqsm_density.gross_to_net_factor} to compare. <a href="${esc2(T.tcqsm_density.source.url)}" target="_blank" rel="noopener">source</a></caption>
    <thead><tr><th>Service</th><th>Homes per net acre</th><th>Downtown floor area</th><th>This area</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="iv-muted">Federal cost-per-trip ratings (FTA Capital Investment Grants guidance, November 2025): ${esc2(c)}. <a href="${esc2(T.fta_cig.source.url)}" target="_blank" rel="noopener">source</a></p>`;
}
function verdictBox(ev, label, open, key, full) {
  if (!ev) return "";
  const v = ev.verdict || "not_enough_data";
  const inner = `${label ? `<p class="iv-muted">${esc2(label)}</p>` : ""}${ev.reasons && ev.reasons.length ? `<ul class="iv-reasons">${ev.reasons.map(x => `<li>${esc2(x)}</li>`).join("")}</ul>` : ""}
    ${ev.density && ev.density.homesPerNetAcre ? `<p class="iv-muted">Density: ${fig(ev.density.homesPerNetAcre, "needs homes and land area for the area")}</p>` : ""}
    ${ev.capitalCost && ev.capitalCost.value != null ? `<p class="iv-muted">Capital cost: ${fig(ev.capitalCost)}</p>` : ""}
    ${ev.missing && ev.missing.length ? `<p class="iv-k">What is missing for a firmer answer</p><ul>${ev.missing.map(t => `<li>${esc2(t)}</li>`).join("")}</ul>` : ""}`;
  return `<div class="iv-verdict v-${esc2(v)}">
    <div class="iv-verdict-h"><span class="iv-vlabel">${esc2(VERDICT_TXT[ev.verdict] || "Not enough data to say")}</span>${ev.scale ? `<span class="iv-chip">Suggested scale: ${esc2(SCALE_TXT[ev.scale] || ev.scale)}</span>` : `<span class="iv-chip">No scale suggested</span>`}${ev.proposedMode ? `<span class="iv-chip">Proposed: ${esc2(SCALE_TXT[ev.proposedMode] || ev.proposedMode)}</span>` : ""}</div>
    ${ev.verdictMeaning ? `<p>${esc2(ev.verdictMeaning)}</p>` : ""}
    ${det(open, key, "Reasons and what is missing", inner)}
  </div>`;
}
// Neighborhoods within 1 mile of a stop city's centre point (not a station site), each with a link to the map.
function stopAreasHTML(stops, open, id) {
  return (stops || []).map(({ stop, ok, reason, areas }) => {
    const n = areas.length, city = esc2(stop.city);
    const note = stop.site_note ? ` <span class="iv-muted">${esc2(stop.site_note)}</span>` : "";
    if (!ok) return `<p class="iv-muted">${city}: no neighborhood count (${esc2(reason)}).</p>`;
    const lead = `<b>${n}</b> ${n === 1 ? "neighborhood" : "neighborhoods"} within 1 mile of the ${city} stop city centre (the station site itself is not chosen yet)`;
    if (!n) return `<p class="iv-stopareas">${lead}.${note}</p>`;
    const shown = areas.slice(0, 30);
    const list = `<ul class="iv-stoplist">${shown.map(a => `<li><button type="button" class="tool-btn" data-iv-map="${esc2(a.id)}">${esc2(a.name || "Block group " + a.id)}${a.city ? ", " + esc2(a.city) : ""}</button> <span class="iv-muted">${a.miles === 0 ? "contains the point" : a.miles + " mi away"}</span></li>`).join("")}${n > shown.length ? `<li class="iv-muted">and ${n - shown.length} more</li>` : ""}</ul>`;
    return `<div class="iv-stopareas"><p>${lead}.${note}</p>${det(open, "sa-" + esc2(id) + "-" + esc2(stop.id), "Show these neighborhoods", list)}</div>`;
  }).join("");
}
function transitCard(m, open) {
  const d = iv.data, T = E().TRANSIT_THRESHOLDS, bud = BUDGET_OK();
  const area = m.brief && m.brief.transit;
  const d0 = m.B.details[m.hood] && m.B.details[m.hood].m || {};
  const scale = area && area.scale || null;
  const corridorOpen = bud >= TIER_MIN.corridor;
  const nCorr = m.pipeEval.length + m.corrEval.length;
  const pipeRows = [], corrRows = [], offItems = [];
  const verLine = r => { const v = r.verification || {}; return `<p class="iv-muted">Record check: ${esc2(String(v.status || "unverified").replace(/_/g, " "))}${v.checked_on ? `, ${esc2(v.checked_on)}` : ""}.${v.evidence ? ` What the source showed: ${esc2(v.evidence)}` : ""}${(v.unverified_fields || []).length ? ` Not confirmed: ${esc2(v.unverified_fields.join("; "))}.` : ""}</p>`; };
  // The local project table has no length or cost fields, so every project is listed without figures.
  m.pipeEval.forEach(({ row }) => {
    pipeRows.push(rowHTML({ name: row.title, chip: "local project", fig: keyFig("Capital cost", nof("not in the project table")), ev: `<span class="iv-chip">${esc2(String((row.verification && row.verification.status) || "unverified").replace(/_/g, " "))}</span>`, sub: esc2(row.agency || ""), key: "tp-" + esc2(row.title),
      detail: `${row.status ? `<p class="iv-muted">Status on file: ${esc2(row.status)}</p>` : ""}${verLine(row)}
        ${row.rtp_document_url ? `<p class="iv-muted"><a href="${esc2(row.rtp_document_url)}" target="_blank" rel="noopener">Project page</a></p>` : ""}
        <p class="iv-muted">No build verdict: the project table gives no length, cost or ridership, and the density test needs a station-area density that is not on file.</p>` }, open));
  });
  m.corrEval.forEach(({ row, ev, len, cost, stops }) => {
    const st = (row.verification && row.verification.status) || "unverified";
    const unconfirmed = UNCHECKED.test(st);
    const noFig = len.value == null && cost.value == null;
    // a corridor with a stop city in this county is listed even when no length or cost is on file: where the stop is matters for the land around it
    corrRows.push(rowHTML({ name: row.name, chip: "intercity corridor", fig: noFig ? keyFig("Route length and cost", nof("not stated in the source documents")) : cost.value != null ? keyFig("Capital cost", "$" + esc2(cost.value) + "B") : keyFig("Route length", esc2(len.value + " miles")), ev: `<span class="iv-chip${unconfirmed ? " iv-unconf" : ""}">${esc2(st.replace(/_/g, " "))}</span> <span class="iv-chip">${esc2(VERDICT_TXT[ev.verdict] || "Not enough data to say")}</span>`, sub: esc2(row.funding_status || "No funding status on file."), key: "tc-" + esc2(row.name),
      detail: `<dl class="iv-dl"><div><dt>Route length</dt><dd>${len.value != null ? esc2(len.value + " miles") : nof(len.why)}</dd></div>
        <div><dt>Capital cost</dt><dd>${cost.value != null ? "$" + esc2(cost.value) + "B" : nof(cost.why)}</dd></div></dl>
        ${row.status_stated && row.status_stated.text ? `<p class="iv-muted">Status as stated: ${esc2(row.status_stated.text)}${row.status_stated.as_of ? ` (${esc2(row.status_stated.as_of)})` : ""}</p>` : ""}
        ${stopAreasHTML(stops, open, row.id)}
        ${verLine(row)}
        <p class="iv-muted">${(row.official_study_url || row.source_url) ? `<a href="${esc2(row.official_study_url || row.source_url)}" target="_blank" rel="noopener">Source document</a>` : ""}</p>
        ${noFig ? `<p class="iv-muted">No build verdict: the source documents give no length or cost for this corridor.</p>` : verdictBox(ev, "", open, "tcv-" + esc2(row.name))}` }, open));
  });
  const corr = !nCorr ? `<p class="iv-empty">No local rail or bus project and no intercity corridor in the data lists ${esc2(countyShort())}.</p>`
    : !corridorOpen ? `<p class="iv-gated">${nCorr} corridor-scale ${nCorr === 1 ? "project lists" : "projects list"} ${esc2(countyShort())}. Corridor-scale plays start at about $10M; raise the budget to see ${nCorr === 1 ? "it" : "them"}.</p>`
    : (pipeRows.length + corrRows.length ? `<ul class="iv-plays">${pipeRows.join("")}${corrRows.join("")}</ul>` : "");
  const gone = corridorOpen ? offItems : [];
  return `<section class="iv-card" id="iv-transit" aria-labelledby="iv-transit-h">
    <h3 id="iv-transit-h">Transit</h3>
    <p class="iv-lede">Should transit be built, and at what scale? First for <b>${esc2(d0.n || "the selected area")}</b>, from its own density; then for projects that list ${esc2(countyShort())}. These are rules of thumb, not a ridership forecast.</p>
    ${verdictBox(area, "", open, "tm-area")}
    <h4>Projects and corridors that list this county</h4>${corr}${nofGroup(open, "off-transit", gone)}
    <h4>Reference tables</h4>
    ${det(open, "t-rules", `Rules used <span class="iv-muted">(${T.tcqsm_density.rows.length} service levels, density and downtown size)</span>`, thresholdTable(area, T))}
    ${det(open, "t-cost", `What it costs per mile <span class="iv-muted">(${esc2(benchSummary(d))})</span>`, benchTable(d, scale))}
    ${det(open, "t-eff", `What stations did to nearby values <span class="iv-muted">(${esc2(effectsSummary(d))})</span>`, effectsTable(d, scale))}
  </section>`;
}

// ---------------------------------------------------------------- page
function headerHTML(m, open) {
  const bt = iv.data.backtest, name = countyShort();
  const h = honest(bt, m.fips, name);
  const role = m.brief && m.brief.role;
  const budg = BUDGETS.map((b, i) => `<button type="button" class="iv-budget${i === iv.budget ? " active" : ""}" data-iv-budget="${i}" aria-pressed="${i === iv.budget}">${esc2(b.label)}</button>`).join("");
  return `<header class="iv-head">
    <div class="iv-eyebrow">Invest · ${esc2(countyLabel())}</div>
    <h2 class="iv-title">Where to put money in ${esc2(name)}</h2>
    ${bottomLine(m)}
    <div class="iv-controls">
      <div class="iv-budget-wrap"><span class="iv-k" id="iv-budget-l">Budget</span><div class="iv-budgets" role="group" aria-labelledby="iv-budget-l">${budg}</div></div>
      <div class="iv-btns">
        <button type="button" class="tool-btn" data-iv="copy"><svg class="ic" aria-hidden="true"><use href="#i-copy"/></svg><span id="iv-copy-l">Copy brief for the AI advisor</span></button>
        ${typeof openAiAdvisor === "function" ? `<button type="button" class="tool-btn primary" data-iv="ask"><svg class="ic" aria-hidden="true"><use href="#i-sparkle"/></svg><span>Ask the advisor about this</span></button>` : ""}
      </div>
    </div>
    ${det(open, "tested", "How this was tested, and how to read the tags", `${testedPanel(bt, h)}<p class="iv-muted">The budget only decides which kinds of play are listed (house-sized, building-sized, site-sized, corridor-sized) and hides improvements that cost more than it. It does no financial maths.</p>${role ? `<p class="iv-muted">Basis tags: ${basisTag("measured")} read from a cited table; ${basisTag("modelled")} computed from measured inputs; ${basisTag("assumed")} an assumption with no evidence behind it.</p>` : ""}`, "iv-tested")}
  </header>${navHTML()}`;
}

function openSet() {
  const s = new Set(); const el = host();
  if (el) el.querySelectorAll("details[open][data-dk]").forEach(x => s.add(x.getAttribute("data-dk")));
  return s;
}

function render() {
  const el = host(); if (!el || iv.view !== "invest") return;
  const r = ready();
  if (r.state === "loading") {
    el.innerHTML = `<div class="iv-wrap"><p class="iv-loading"><span class="spin"></span> Loading ${esc2(countyShort())}…</p></div>`;
    clearTimeout(render._t);
    if (iv.tries++ < 60) render._t = setTimeout(render, 700);
    return;
  }
  iv.tries = 0;
  if (r.state === "nodata") {
    el.innerHTML = `<div class="iv-wrap"><header class="iv-head"><div class="iv-eyebrow">Invest · ${esc2(countyLabel())}</div><h2 class="iv-title">No brief for ${esc2(countyShort())} yet</h2>
      <p class="iv-honest t-neutral">This county has property lines only: its Census, price and transit data have not been built, so there is nothing to rank and nothing to recommend. Nothing is guessed in its place.</p></header></div>`;
    window.__cpDecisionBrief = null;
    return;
  }
  if (!E()) { el.innerHTML = `<div class="iv-wrap"><p class="iv-empty">The decision engine did not load.</p></div>`; return; }
  const fresh = !iv.data;
  loadData().then(d => {
    if (iv.view !== "invest") return;
    const r2 = ready(); if (r2.state !== "ok") { render(); return; }
    const p = parcelFacts();
    const key = [r2.fips, iv.hood, p && p.facts.parcel_id, p && p.facts.base_zoning_code, p && p.facts.exclusions && JSON.stringify(p.facts.exclusions), d.laws ? d.laws.length : -1, d.verification ? 1 : 0, typeof SITES !== "undefined" && SITES ? 1 : 0].join("|");
    if (key !== iv.key || !iv.model) { iv.model = build(r2.fips, r2.B, d); iv.key = key; }
    const m = iv.model;
    const open = openSet();
    const y = window.scrollY;
    el.innerHTML = `<div class="iv-wrap">${headerHTML(m, open)}<div class="iv-cards">${whereCard(m, open)}${buildCard(m, open)}${sitesCard(m, open)}${houseCard(m, open)}${transitCard(m, open)}</div>
      <p class="iv-foot">Everything here comes from public data and the tests described above. It is a starting point for due diligence, not advice. A figure marked Not on file is missing from our data, and we do not fill gaps with guesses.</p></div>`;
    if (!fresh) window.scrollTo(0, y);
    window.__cpDecisionBrief = m.brief;
  });
}

// ---------------------------------------------------------------- view switching and actions
function setInvest(on, opts) {
  opts = opts || {};
  iv.view = on ? "invest" : "map";
  document.body.classList.toggle("invest-mode", on);
  if (on) {
    document.body.classList.remove("explore-mode");
    document.querySelectorAll("#view-switch [data-view]").forEach(b => { const a = b.dataset.view === "invest"; b.classList.toggle("active", a); b.setAttribute("aria-pressed", a ? "true" : "false"); });
    try { localStorage.setItem("cp_view", "invest"); } catch (e) {}
    if (typeof hideWelcome === "function") { const w = $("#welcome"); if (w && !w.hidden) hideWelcome(); }
    iv.key = null; iv.tries = 0;
    render();
    if (!opts.keepScroll) window.scrollTo(0, 0);
  } else {
    clearTimeout(render._t);
  }
}
function leaveToMap(id) {
  if (window.cpExplore && window.cpExplore.setView) window.cpExplore.setView("map"); else { document.body.classList.remove("explore-mode"); }
  setInvest(false);
  if (typeof map !== "undefined" && map && map.invalidateSize) setTimeout(() => map.invalidateSize(), 0);
  window.scrollTo(0, 0);
  if (id) setTimeout(() => { if (typeof select === "function" && typeof byId !== "undefined" && byId.has(id)) select(id, true); }, 30);
}
function copyBrief() {
  const b = window.__cpDecisionBrief;
  const done = ok => { const l = $("#iv-copy-l"); if (l) l.textContent = ok ? "Copied" : "Could not copy"; if (typeof showToast === "function") showToast(ok ? "Brief copied. Paste it into the AI advisor." : "Could not copy the brief."); setTimeout(() => { const l2 = $("#iv-copy-l"); if (l2) l2.textContent = "Copy brief for the AI advisor"; }, 2200); };
  if (!b) { done(false); return; }
  const text = JSON.stringify(b, null, 2);
  const fallback = () => { try { const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); done(ok); } catch (e) { done(false); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback); else fallback();
}

function onClick(e) {
  const t = e.target.closest("[data-view],[data-iv-jump],[data-iv],[data-iv-budget],[data-iv-hood],[data-iv-map],[data-iv-leave]");
  if (!t) return;
  const d = t.dataset;
  if (d.view) { if (d.view === "invest") setInvest(true); else if (iv.view === "invest") setInvest(false); return; }
  if (!host() || !host().contains(t)) return;
  if (d.ivJump) { const c = document.getElementById(d.ivJump); if (c && c.scrollIntoView) c.scrollIntoView({ block: "start", behavior: "smooth" }); }
  else if (d.ivBudget != null) { iv.budget = +d.ivBudget; render(); }
  else if (d.ivHood) { iv.hood = d.ivHood; iv.moreIdeas = false; render(); const c = document.getElementById("iv-build"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "start" }); }
  else if (d.ivMap) leaveToMap(d.ivMap);
  else if (d.ivLeave) leaveToMap(null);
  else if (d.iv === "copy") copyBrief();
  else if (d.iv === "ask") { if (typeof openAiAdvisor === "function") openAiAdvisor(); }
  else if (d.iv === "more-ideas") { iv.moreIdeas = !iv.moreIdeas; render(); }
  else if (d.iv === "more-hoods") { iv.moreHoods = !iv.moreHoods; render(); }
  else if (d.iv === "more-sites") { iv.moreSites = !iv.moreSites; render(); }
}

function init() {
  const el = host(); if (!el) return;
  document.addEventListener("click", onClick);
  const lbl = $("#county-pick-label");
  if (lbl && window.MutationObserver) new MutationObserver(() => { iv.hood = null; iv.model = null; iv.key = null; iv.moreIdeas = false; iv.moreSites = false; iv.moreHoods = false; if (iv.view === "invest") render(); }).observe(lbl, { childList: true, characterData: true, subtree: true });
  const q = $("#q"); if (q) q.addEventListener("keydown", e => { if (e.key === "Enter" && iv.view === "invest") leaveToMap(null); });
  let want = null;
  try { want = new URLSearchParams(location.hash.replace(/^#/, "")).get("view") || localStorage.getItem("cp_view"); } catch (e) {}
  if (want === "invest") setInvest(true, { keepScroll: true });
}

// The same inputs the cards use, for the advisor's no-AI answers (app/advisor-scripts.js): the engine context from
// the loaded tables, the open lot's facts, this county's measured sites and the back-test honesty line. Builds nothing
// new; null while the county or the tables are still loading.
function advisorInputs() {
  const r = ready();
  if (r.state === "nodata") return Promise.resolve({ state: "nodata", fips: r.fips });
  if (r.state !== "ok" || !E()) return Promise.resolve(null);
  return loadData().then(d => {
    const r2 = ready(); if (r2.state !== "ok") return null;
    const ctx = { backtest: d.backtest, catalog: D.catalog, verification: d.verification, underusedSites: d.sites, sites: (typeof SITES !== "undefined") ? SITES : null, costBenchmarks: engineCosts(d.cost), valueEffects: engineEffects(d.effects),
      laws: d.laws || undefined, unitCosts: d.unitCosts, valuationModels: d.valuationModels, prediction: d.prediction };
    const sl = siteLists({ countySites: d.sites.filter(s => s && s.countyFips === r2.fips) });
    return { state: "ok", fips: r2.fips, countyName: countyShort(), B: r2.B, ctx, pf: parcelFacts(), honest: honest(d.backtest, r2.fips, countyShort()), countySites: sl.all.map(s => Object.assign({}, s, { displayName: siteName(s) })) };
  });
}

window.cpInvest = { render, advisorInputs, setView: v => setInvest(v === "invest"), get state() { return iv; } };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
