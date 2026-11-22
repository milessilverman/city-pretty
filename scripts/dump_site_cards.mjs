// Print the place rows of the project cards for given station sites, built as the page builds them.
//   node scripts/dump_site_cards.mjs <fips>:<osm id> [...]      (e.g. 48453:way/30769048)
// Used by scripts/recheck_site_cards.py, which re-derives each figure from the source files.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const P = require("../src/engines/projectCardEngine.js");
const SS = require("../src/engines/stationSites.js");
const data = (f) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));
const ctx = { laws: data("statutes.json"), buildingCosts: data("building_costs.json").rows, fundingRules: data("housing_funding_rules.json"), incomeLimits: data("hud_income_limits.json"),
  fmr: data("hud_fair_market_rents.json"), transitEffects: data("transit_value_effects.json"), corridors: data("intercity_transit_corridors.json"),
  qctDda: data("hud_qct_dda.json"), mtspLimits: data("hud_mtsp_income_limits.json") };
const out = [];
for (const a of process.argv.slice(2)) {
  const [fips, osm] = [a.slice(0, 5), a.slice(6)];
  const doc = data(`station_sites/${fips}.json`);
  const L = SS.normalize(doc);
  SS.attachPlaces(L, data(`station_site_places/${fips}.json`));
  const s = L.find((x) => x.osm.id === osm);
  const card = P.buildProjectCard({ kind: "site", id: s.id, name: s.name, siteKind: s.kindLabel, countyFips: fips, stateCode: doc.state, acres: { value: s.acres, source: s.sourceUrl }, nearStops: [], place: s.place || null,
    parcel: { parcel_id: s.id, base_zoning_code: null, exclusions: {} } }, ctx);
  out.push({ site: a, point: s.point, place: s.place || null, placeFacts: card.placeFacts });
}
console.log(JSON.stringify(out));
