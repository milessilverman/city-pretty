// The page's live-records module (app/facts.js), against real responses captured 2026-11-16 (Austin, TX).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-ignore plain ES module
import { liveSiteFacts, fromWorker } from "../../app/facts.js";
import { siteFacts } from "../../workers/sources";

const fx = (n: string) => fs.readFileSync(path.join(__dirname, "../fixtures/sources", n), "utf8");
const routes: Array<[RegExp, string]> = [
  [/MapServer\/10\/query/, fx("tiger_bg_austin.json")],
  [/MapServer\/82\/query/, fx("tiger_county_austin.json")],
  [/NFHL\/MapServer\/28/, fx("fema_flood_austin.json")],
  [/epqs\.nationalmap\.gov/, fx("usgs_elev_austin.json")],
  [/geocoder\/geographies/, fx("census_geographies_austin.json")],
  [/National_Risk_Index_Census_Tracts/, fx("fema_nri_austin.json")],
  [/earthquake\.usgs\.gov\/ws\/designmaps/, fx("usgs_seismic_austin.json")],
  [/chronicdata\.cdc\.gov\/resource\/cwsq-ngmh/, fx("cdc_places_austin.json")],
  [/Public_School_Locations_Current/, fx("nces_schools_austin.json")],
  [/WalkabilityIndex\/MapServer\/0/, fx("epa_walkability_austin.json")],
  [/dc_slr\/slr_1ft/, fx("noaa_slr_austin.json")],
];
// HUD rents come from the page's FY2027 county file; tests read the same file.
const HUD = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/hud_fair_market_rents.json"), "utf8")).records.map((r: any) => [r.fips, r]));
const hudLookup = (f: string) => HUD[f] || null;
const fake = async (url: string) => {
  for (const [re, body] of routes) if (re.test(url)) return new Response(body, { status: 200 });
  throw new Error("network unreachable");
};

describe("app/facts.js live public records", () => {
  it("shows each agency's value with a link to the exact query", async () => {
    const rows = await liveSiteFacts(30.3005, -97.724, { fetcher: fake, hudLookup });
    const by = Object.fromEntries(rows.map((r: any) => [r.label.split(" (")[0], r]));
    expect(by["Census area"].value).toBe("Travis County · block group 484530003023");
    expect(by["HUD Fair Market Rent"].value).toContain("2 bed $1,817");
    expect(by["FEMA flood zone"].value).toContain("Zone AE");
    expect(by["Ground elevation"].value).toBe("581 ft");
    for (const r of rows) expect(r.url).toMatch(/^https:\/\//);
  });

  it("a failed or empty service says not available, with no number", async () => {
    const rows = await liveSiteFacts(30.3005, -97.724, { fetcher: async () => new Response(JSON.stringify({ features: [] })) });
    for (const r of rows) {
      expect(r.ok).toBe(false);
      expect(r.value).toBeNull();
    }
    expect(rows.find((r: any) => r.label === "FEMA flood zone").reason).toMatch(/unmapped, not 'no risk'/);
    const dead = await liveSiteFacts(30.3005, -97.724, { fetcher: async () => { throw new Error("offline"); } });
    expect(dead.every((r: any) => !r.ok && /offline/.test(r.reason))).toBe(true);
  });

  it("a dropped connection is tried once more; a second failure says not available", async () => {
    // FEMA's NFHL drops some concurrent connections (browser: "TypeError: Failed to fetch"); one retry recovers it.
    let femaTries = 0;
    const flaky = async (url: string) => {
      if (/NFHL/.test(url) && ++femaTries === 1) throw new TypeError("Failed to fetch");
      return fake(url);
    };
    const rows = await liveSiteFacts(30.3005, -97.724, { fetcher: flaky, hudLookup });
    expect(femaTries).toBe(2);
    expect(rows.find((r: any) => r.label === "FEMA flood zone").value).toContain("Zone AE");
    let tries = 0;
    const down = async (url: string) => {
      if (/NFHL/.test(url)) { tries++; throw new TypeError("Failed to fetch"); }
      return fake(url);
    };
    const rows2 = await liveSiteFacts(30.3005, -97.724, { fetcher: down, hudLookup });
    expect(tries).toBe(2);
    const f = rows2.find((r: any) => r.label === "FEMA flood zone");
    expect(f.ok).toBe(false);
    expect(f.value).toBeNull();
  });

  it("the Worker's /api/facts payload renders the same rows", async () => {
    const f = await siteFacts(30.3005, -97.724, { fetcher: fake as any });
    const rows = fromWorker(JSON.parse(JSON.stringify(f)));
    expect(rows.find((r: any) => r.label.startsWith("HUD")).value).toContain("$1,817");
    expect(rows.find((r: any) => r.label === "FEMA flood zone").value).toContain("Zone AE");
    expect(rows.find((r: any) => r.label.includes("FEMA NRI")).value).toContain("Score 28/100");
    expect(rows.find((r: any) => r.label.includes("Earthquake design")).value).toContain("Category A");
    expect(rows.find((r: any) => r.label.includes("CDC PLACES")).value).toContain("Obesity");
    expect(rows.find((r: any) => r.label.includes("NCES EDGE")).value).toContain("LEE EL");
    expect(rows.find((r: any) => r.label.includes("Walkability")).value).toContain("18 / 20 (Most Walkable)");
    expect(rows.find((r: any) => r.label.includes("Sea level rise")).value).toContain("Above 1ft SLR");
  });
});
