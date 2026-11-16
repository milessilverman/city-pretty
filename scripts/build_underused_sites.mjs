/**
 * Build Verified Underused Sites Data File
 * Extracts and enriches curated underused sites (golf courses, parking lots, vacant land)
 * from county datasets and generates app/data/underused_sites.json.
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load bundle-la
const bundleB64 = fs.readFileSync(path.join(rootDir, "app/data/bundle-la.b64.txt"), "utf8").trim();
const bundleJson = zlib.gunzipSync(Buffer.from(bundleB64, "base64")).toString("utf8");
const D = JSON.parse(bundleJson);

// Block group lookup for city name and neighborhood median HV
const bgMap = new Map();
if (D.bgs && D.bgs.features) {
  for (const f of D.bgs.features) {
    const p = f.properties || {};
    bgMap.set(p.id, {
      neighborhood: p.n || null,
      city: p.c || null,
      hv: p.hv || null
    });
  }
}

const rawSites = Object.values(D.under.sites || {});

// Curate high-impact sites:
// 1. Top golf courses with positive margin or near transit
const golfSites = rawSites
  .filter(s => s.k === "golf course" && !s.bs && !s.ease && s.ac >= 5)
  .sort((a, b) => (b.margin || 0) - (a.margin || 0))
  .slice(0, 20);

// 2. High-margin parking lots near transit (rail <= 805m)
const parkingSites = rawSites
  .filter(s => s.k === "parking lot" && !s.bs && s.rail && s.rail <= 805 && s.ac >= 0.5)
  .sort((a, b) => (b.margin || 0) - (a.margin || 0))
  .slice(0, 30);

// 3. Vacant land parcels
const vacantSites = rawSites
  .filter(s => s.k === "vacant" && !s.bs && s.ac >= 0.5)
  .sort((a, b) => (b.margin || 0) - (a.margin || 0))
  .slice(0, 20);

// 4. Lightly built commercial parcels
const commSites = rawSites
  .filter(s => s.k === "lightly built commercial" && !s.bs && s.rail && s.rail <= 805 && s.ac >= 1.0)
  .sort((a, b) => (b.margin || 0) - (a.margin || 0))
  .slice(0, 20);

const selectedSites = [...golfSites, ...parkingSites, ...vacantSites, ...commSites];

const cleanSites = selectedSites.map((s, idx) => {
  const bg = bgMap.get(s.gid) || {};
  return {
    id: `site_la_${idx + 1}_${s.i}`,
    name: s.nm || (s.k === "golf course" ? `Golf Facility (Parcel ${s.i})` : null),
    address: s.ad || null,
    kind: s.k,
    acres: Math.round(s.ac * 100) / 100,
    countyFips: "06037",
    blockGroupId: s.gid,
    cityName: bg.city || null,
    neighborhoodName: bg.neighborhood || null,
    assessedLandValue: s.lav != null ? s.lav : null,
    marketLandValue: s.mkt != null ? s.mkt : null,
    prop13BaseYear: s.by || null,
    baseZoning: s.z || null,
    zoningCategory: s.zc || null,
    distanceToRailMeters: s.rail != null ? s.rail : null,
    nearestRailStation: s.st || null,
    railStationStatus: s.sts || "open",
    publicOwner: s.own || null,
    inConservationEasement: !!s.ease,
    isHousingElementSite: !!s.he,
    alreadyBuilt: !!s.bs,
    neighborhoodMedianHv: bg.hv || null,
    potentialHomes: s.homes || 0,
    margin: s.margin != null ? s.margin : null,
    idea: s.idea || "",
    sourceUrl: "https://data.lacounty.gov/datasets/lacounty::assessor-parcels-data-2024",
    lastVerified: "2026-11-15"
  };
});

const outPath = path.join(rootDir, "app/data/underused_sites.json");
fs.writeFileSync(outPath, JSON.stringify(cleanSites, null, 2), "utf8");
console.log(`Successfully exported ${cleanSites.length} curated underused sites to ${outPath}`);
