// Draw the re-check sample for the site zoning work (docs/audit/site-zoning-2026-11-23.md, step 5).
//   node scripts/site_zoning_sample.mjs <seed> <n>    writes data/backtests/site_zoning_sample_<seed>.json
// Builds each station site's card as scripts/measure_site_cards.mjs does, keeps the sites whose small-multifamily
// course has a home count, and draws <n> of them with a seeded generator (mulberry32), spread over the jurisdictions in
// turn so that every jurisdiction with home counts is in the sample. For each: the site, its point and area, the zone
// and code row used, and the card's homes and cost, for scripts/recheck_site_zoning.py to re-derive by hand.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const P = require("../src/engines/projectCardEngine.js");
const SS = require("../src/engines/stationSites.js");
const data = (f) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));
const seed = +(process.argv[2] || 20261123), N = +(process.argv[3] || 15);
const ST = { "06": "CA", "36": "NY", "48": "TX", "04": "AZ", "17": "IL" };
const ctx = { laws: data("statutes.json"), buildingCosts: data("building_costs.json").rows, fundingRules: data("housing_funding_rules.json"), incomeLimits: data("hud_income_limits.json"),
  fmr: data("hud_fair_market_rents.json"), transitEffects: data("transit_value_effects.json"), corridors: data("intercity_transit_corridors.json"), qctDda: data("hud_qct_dda.json"), mtspLimits: data("hud_mtsp_income_limits.json") };
const ZI = data("site_zoning/index.json");
const ZT = Object.fromEntries(Object.values(ZI.cities).map((c) => [c.key, data("site_zoning/" + c.table)]));
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pool = {};
for (const fips of ZI.counties) {
  const list = SS.normalize(data(`station_sites/${fips}.json`));
  SS.attachPlaces(list, fs.existsSync(path.join(root, `app/data/station_site_places/${fips}.json`)) ? data(`station_site_places/${fips}.json`) : null);
  SS.attachZoning(list, data(`site_zoning/${fips}.json`), ZT, ZI);
  const st = ST[fips.slice(0, 2)] || null;
  for (const s of list) {
    if (!s.zoningLimits || !s.zoningLimits.density) continue;
    const subj = { kind: "site", id: s.id, name: s.name, siteKind: s.kindLabel, countyFips: fips, stateCode: st, city: s.cityName, acres: { value: s.acres, source: s.sourceUrl },
      railStationMi: Number.isFinite(s.distanceToRailMeters) ? s.distanceToRailMeters / 1609.344 : null, nearStops: [], place: s.place || null, parcelRatio: s.parcel && s.parcel.r,
      parcel: { parcel_id: s.id, state_code: st, county_fips: fips, base_zoning_code: s.baseZoning, municipality_name: s.cityName, is_commercial_or_mixed_use: /commercial/.test(s.zoningCategory || ""), is_single_family_residential: s.zoningCategory === "single-family", is_multifamily_residential: s.zoningCategory === "multifamily", exclusions: {}, lot_sqft: s.acres * 43560, zoning_limits: s.zoningLimits } };
    const c = P.buildProjectCard(subj, ctx).courses.find((x) => x.course === "small_multifamily" && !x.affordable);
    if (!c || !c.size || !c.size.units) continue;
    (pool[s.zoning.name] = pool[s.zoning.name] || []).push({ id: s.id, osm: s.osm.id, fips, placeCounty: s.place && s.place.tract ? s.place.tract.slice(0, 5) : fips, city: s.zoning.name, juris: s.zoning.juris, point: s.point, acres: s.acres,
      zone: s.zoning.zone, zoneSource: s.zoning.how, zoneKey: s.zoningLimits.zone, density: s.zoningLimits.density, legal: c.legal.basis,
      homes: [c.size.units.low.value, c.size.units.high.value], cost: c.cost ? [c.cost.low.value, c.cost.high.value] : null, costSource: c.cost ? c.cost.source : null });
  }
}
const rnd = mulberry32(seed), cities = Object.keys(pool).sort(), out = [];
for (const k of cities) pool[k].sort((a, b) => (a.id < b.id ? -1 : 1));
let i = 0;
while (out.length < N && cities.some((k) => pool[k].length)) {
  const k = cities[i++ % cities.length];
  if (!pool[k].length) continue;
  out.push(pool[k].splice(Math.floor(rnd() * pool[k].length), 1)[0]);
}
const file = path.join(root, `data/backtests/site_zoning_sample_${seed}.json`);
fs.writeFileSync(file, JSON.stringify({ seed, generator: "mulberry32", n: out.length, poolByCity: Object.fromEntries(cities.map((k) => [k, pool[k].length + out.filter((x) => x.city === k).length])), sample: out }, null, 1));
console.log(file, out.length, out.map((x) => x.city + " " + x.zone).join("; "));
