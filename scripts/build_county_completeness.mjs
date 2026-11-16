/**
 * build_county_completeness.mjs
 * Implements Roadmap P1 Item 12 & Rule 3:
 * Computes county readiness tiers (A to D) based on actual data presence and exports
 * a single authoritative data file app/data/county_completeness.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export function computeReadinessTier(c) {
  const hasAssessor = Boolean(c.assessor_roll_vintage && c.assessor_roll_vintage !== "Unverified");
  const hasLiveZoning = c.zoning_source === "live_municipal_gis" || c.zoning_source === "statewide_parcel";
  const hasGtfs = Number(c.gtfs_agencies_count || 0) > 0;
  const crimeOk = c.crime_feed_status === "rolling_12m";

  if (hasAssessor && hasLiveZoning && hasGtfs && crimeOk) {
    return "audited_A";
  } else if (hasAssessor && (hasLiveZoning || hasGtfs)) {
    return "verified_B";
  } else if (hasAssessor || hasGtfs) {
    return "preliminary_C";
  } else {
    return "cadastral_only_D";
  }
}

export function buildCountyCompletenessIndex() {
  const rawJsonPath = path.join(rootDir, "src/data/county_completeness.json");
  const rawList = JSON.parse(fs.readFileSync(rawJsonPath, "utf-8"));

  const index = {};
  const arrayList = [];

  for (const raw of rawList) {
    const fips = String(raw.fips).padStart(5, "0");
    const tier = computeReadinessTier(raw);

    const record = {
      fips,
      name: raw.name ? raw.name.trim() : `County ${fips}`,
      state: raw.state ? raw.state.trim() : "US",
      jurisdiction_type: raw.jurisdiction_type || "county",
      assessor_roll_vintage: raw.assessor_roll_vintage || null,
      sales_comps_window: Array.isArray(raw.sales_comps_window) ? raw.sales_comps_window : null,
      zoning_source: raw.zoning_source || "fallback_2019",
      gtfs_agencies_count: Number(raw.gtfs_agencies_count || 0),
      crime_feed_status: raw.crime_feed_status || "missing",
      canopy_dataset: raw.canopy_dataset || "nlcd_proxy",
      readiness_tier: tier,
      source: "U.S. Census Bureau TIGER/Line & County Administrative Rolls",
      source_url: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
      last_verified: "2026-11-15"
    };

    index[fips] = record;
    arrayList.push(record);
  }

  // Write dict to app/data/county_completeness.json
  const outPath = path.join(rootDir, "app/data/county_completeness.json");
  fs.writeFileSync(outPath, JSON.stringify(index, null, 2), "utf-8");
  console.log(`Wrote ${Object.keys(index).length} county records to ${outPath}`);

  // Also sync src/data/county_completeness.json
  fs.writeFileSync(rawJsonPath, JSON.stringify(arrayList, null, 2), "utf-8");
  console.log(`Synced ${arrayList.length} array records to ${rawJsonPath}`);

  // Build CA counties registry dict
  const caRawPath = path.join(rootDir, "src/data/ca_counties_registry.json");
  if (fs.existsSync(caRawPath)) {
    const caList = JSON.parse(fs.readFileSync(caRawPath, "utf-8"));
    const caDict = {};
    for (const item of caList) {
      caDict[item.fips] = {
        ...item,
        source_url: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
        last_verified: "2026-11-15"
      };
    }
    const caOutPath = path.join(rootDir, "app/data/ca_counties_registry.json");
    fs.writeFileSync(caOutPath, JSON.stringify(caDict, null, 2), "utf-8");
    console.log(`Wrote ${Object.keys(caDict).length} CA registry records to ${caOutPath}`);
  }

  return index;
}

if (process.argv[1] === __filename) {
  buildCountyCompletenessIndex();
}
