import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const appJsPath = path.join(rootDir, "app/app.js");
let appJs = fs.readFileSync(appJsPath, "utf-8");

// 1. Update CP_DATA_FILES
const oldCpDataFiles = `"valuation-benchmarks": "valuation_backtest_benchmarks.json", "underused-sites": "underused_sites.json",\n  "intercity-corridors": "intercity_transit_corridors.json"`;
const newCpDataFiles = `"valuation-benchmarks": "valuation_backtest_benchmarks.json", "underused-sites": "underused_sites.json",\n  "intercity-corridors": "intercity_transit_corridors.json", "county-completeness": "county_completeness.json",\n  "ca-counties-registry": "ca_counties_registry.json"`;

if (appJs.includes(oldCpDataFiles)) {
  appJs = appJs.replace(oldCpDataFiles, newCpDataFiles);
  console.log("Updated CP_DATA_FILES");
} else {
  console.log("CP_DATA_FILES already updated or not found");
}

// 2. Update loadVerifiedDataFiles
const oldLoad = `cpJson("intercity-corridors").then(d => { if (Array.isArray(d)) INTERCITY_CORRIDORS_DATA = d; });`;
const newLoad = `cpJson("intercity-corridors").then(d => { if (Array.isArray(d)) INTERCITY_CORRIDORS_DATA = d; });
  cpJson("county-completeness").then(d => {
    if (d && typeof d === "object") {
      Object.assign(COUNTY_COMPLETENESS_INDEX, d);
      if (typeof syncHeaderDomToCounty === "function" && typeof activeFips === "function") {
        syncHeaderDomToCounty(activeFips());
      }
    }
  });
  cpJson("ca-counties-registry").then(d => {
    if (d && typeof d === "object") {
      Object.assign(CA_COUNTIES_REGISTRY, d);
    }
  });`;

if (appJs.includes(oldLoad) && !appJs.includes('cpJson("county-completeness")')) {
  appJs = appJs.replace(oldLoad, newLoad);
  console.log("Updated loadVerifiedDataFiles");
}

// 3. Find block from `const COUNTY_COMPLETENESS_INDEX = {` to end of `CA_COUNTIES_REGISTRY = { ... };`
const startIndex = appJs.indexOf("const COUNTY_COMPLETENESS_INDEX = {");
if (startIndex !== -1) {
  const targetEndMarker = "\n/**\n * Municipal Finance Engine (ES6 / Browser & Node compatible)";
  const endIndex = appJs.indexOf(targetEndMarker, startIndex);
  if (endIndex !== -1) {
    const bootstrapBlock = `// Multi-county data loaded dynamically from app/data/county_completeness.json and ca_counties_registry.json
// Bootstrapped with LA & Orange County records for synchronous page start
const COUNTY_COMPLETENESS_INDEX = {
  "06037": {
    "fips": "06037",
    "name": "Los Angeles County",
    "state": "CA",
    "jurisdiction_type": "county",
    "assessor_roll_vintage": "2026-09-17",
    "sales_comps_window": ["2022-08-01", "2026-10-31"],
    "zoning_source": "live_municipal_gis",
    "gtfs_agencies_count": 19,
    "crime_feed_status": "rolling_12m",
    "canopy_dataset": "tree_equity_2025",
    "readiness_tier": "audited_A",
    "source_url": "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
    "last_verified": "2026-11-15"
  },
  "06059": {
    "fips": "06059",
    "name": "Orange County",
    "state": "CA",
    "jurisdiction_type": "county",
    "assessor_roll_vintage": "2026-06-30",
    "sales_comps_window": ["2022-01-01", "2026-06-30"],
    "zoning_source": "regional_cog",
    "gtfs_agencies_count": 2,
    "crime_feed_status": "partial_stale",
    "canopy_dataset": "tree_equity_2025",
    "readiness_tier": "preliminary_C",
    "source_url": "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
    "last_verified": "2026-11-15"
  }
};

const CA_COUNTIES_REGISTRY = {
  "06037": {
    "fips": "06037",
    "name": "Los Angeles County",
    "mpo": "SCAG",
    "gtfs": ["LA Metro", "Long Beach Transit", "Foothill Transit", "Big Blue Bus"],
    "funding": "Measure M / Measure R / Measure W",
    "hazard": "Alquist-Priolo / CalFire VHFHSZ",
    "last_verified": "2026-11-15"
  },
  "06059": {
    "fips": "06059",
    "name": "Orange County",
    "mpo": "OCTA / SCAG",
    "gtfs": ["OCTA", "Metrolink"],
    "funding": "OC Measure M2",
    "hazard": "CalFire VHFHSZ / Coastal Surge",
    "last_verified": "2026-11-15"
  }
};
`;

    const before = appJs.substring(0, startIndex);
    const after = appJs.substring(endIndex);
    appJs = before + bootstrapBlock + after;
    console.log(`Replaced monolithic inlined index (${endIndex - startIndex} chars) with lightweight bootstrap`);
  } else {
    console.error("Could not find targetEndMarker");
  }
}

fs.writeFileSync(appJsPath, appJs, "utf-8");
console.log("Successfully updated app/app.js");
