// Tests for workers/sources.ts and workers/advisorAgent.ts.
// Fixtures in tests/fixtures/sources are real responses captured from the official services on 2026-11-16
// (Austin, TX: 811 E 41st St / 30.3005, -97.724). Nothing in them was edited.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  acs5,
  addressMismatch,
  cdcPlacesTractHealth,
  censusGeographies,
  epaWalkabilityIndex,
  femaFloodZone,
  femaNationalRiskIndex,
  fhfaTractHpi,
  fhwaNhcci,
  googleSolarBuildingInsights,
  ncesNearbySchools,
  noaaSeaLevelRise,
  npsHistoricPlaces,
  pvwattsV8,
  usgsSeismicDesign,
  geocodeAddress,
  hudFairMarketRentForCounty,
  osmNearby,
  parseOsmHeight,
  siteFacts,
  usgsElevation,
} from "../../workers/sources";
import { runAdvisor, runAdvisorTool, SOURCING_RULES } from "../../workers/advisorAgent";
import { isAllowedOrigin } from "../../workers/api-proxy";

const fx = (name: string) => fs.readFileSync(path.join(__dirname, "../fixtures/sources", name), "utf8");

// A fake fetch that serves fixture text by matching the request URL, and records what was asked.
function fakeFetch(routes: Array<[RegExp, string | number]>) {
  const calls: string[] = [];
  const f = async (url: string) => {
    calls.push(url);
    for (const [re, body] of routes) {
      if (re.test(url)) return typeof body === "number" ? new Response("", { status: body }) : new Response(body, { status: 200 });
    }
    throw new Error("network unreachable");
  };
  return Object.assign(f, { calls });
}

const AUSTIN = fakeFetch([
  [/geocoder\/geographies\/coordinates/, fx("census_geographies_austin.json")],
  [/geocoder\/locations\/onelineaddress/, fx("census_address_austin.json")],
  [/epqs\.nationalmap\.gov/, fx("usgs_elev_austin.json")],
  [/NFHL\/MapServer\/28/, fx("fema_flood_austin.json")],
  [/National_Risk_Index_Census_Tracts/, fx("fema_nri_austin.json")],
  [/earthquake\.usgs\.gov\/ws\/designmaps/, fx("usgs_seismic_austin.json")],
  [/developer\.nlr\.gov\/api\/pvwatts\/v8/, fx("pvwatts_austin.json")],
  [/chronicdata\.cdc\.gov\/resource\/cwsq-ngmh/, fx("cdc_places_austin.json")],
  [/Public_School_Locations_Current/, fx("nces_schools_austin.json")],
  [/WalkabilityIndex\/MapServer\/0/, fx("epa_walkability_austin.json")],
  [/dc_slr\/slr_1ft/, fx("noaa_slr_austin.json")],
  [/solar\.googleapis\.com\/v1\/buildingInsights/, fx("google_solar_austin.json")],
  [/data\.transportation\.gov\/resource\/r94d-n4f9/, fx("fhwa_nhcci_latest.json")],
  [/fhfa\.gov\/hpi\/download\/annual\/hpi_at_tract/, fx("fhfa_hpi_austin.json")],
  [/mapservices\.nps\.gov\/arcgis\/rest\/services\/cultural_resources\/nrhp_locations\/MapServer\/1/, fx("nps_historic_austin.json")],
]);

describe("official-source connectors (real captured responses)", () => {
  it("Census geographies: county, tract, block group (from the 2020 block), city", async () => {
    const r = await censusGeographies(30.3005, -97.724, AUSTIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.county_fips).toBe("48453");
    expect(r.value.county_name).toBe("Travis County");
    expect(r.value.tract_geoid).toBe("48453000302");
    expect(r.value.block_group_geoid).toBe("484530003023");
    expect(r.source.publisher).toBe("U.S. Census Bureau");
    expect(r.source.url).toContain("geocoding.geo.census.gov");
  });

  it("address geocode", async () => {
    const r = await geocodeAddress("811 E 41st St, Austin, TX", AUSTIN);
    expect(r.ok && r.value.matched_address).toBe("811 E 41ST ST, AUSTIN, TX, 78751");
  });

  it("flags a geocoder match to a different address (seen live: 200 N Spring St -> 200 S SPRING ST)", () => {
    expect(addressMismatch("200 N Spring St, Los Angeles, CA", "200 S SPRING ST, LOS ANGELES, CA, 90012")).toMatch(/direction N vs S/);
    expect(addressMismatch("811 E 41st St, Austin, TX", "811 E 41ST ST, AUSTIN, TX, 78751")).toBeNull();
    expect(addressMismatch("815 E 41st St", "811 E 41ST ST")).toMatch(/house number/);
  });

  it("HUD FMR: FY2027 county values from HUD's API file, with HUD's own caveat", () => {
    const tx = hudFairMarketRentForCounty("48453");
    expect(tx.ok && tx.value.fiscal_year).toBe(2027);
    expect(tx.ok && tx.value.rent_2br).toBe(1817);
    expect(tx.ok && tx.value.fmr_area_name).toBe("Austin-Round Rock-San Marcos, TX MSA");
    expect(tx.ok && tx.notes?.join(" ")).toMatch(/not market asking rents/);
    const la = hudFairMarketRentForCounty("06037");
    expect(la.ok && la.value.rent_2br).toBe(2964);
  });

  it("HUD FMR: New England gives the town range, never a county figure; unknown county gives ok:false", () => {
    const ct = hudFairMarketRentForCounty("09110");
    expect(ct.ok && ct.value.rent_2br).toBeNull();
    expect(ct.ok && ct.value.rent_2br_range_by_town?.length).toBe(2);
    const none = hudFairMarketRentForCounty("99999");
    expect(none.ok).toBe(false);
    expect(none.value).toBeNull();
  });

  it("HUD FMR: supports ZIP-level Small Area FMR (SAFMR) with specific ZIP label and metro fallback", () => {
    const metro = hudFairMarketRentForCounty("48453", "00000");
    expect(metro.ok && metro.value.rent_2br).toBe(1817);
    expect(metro.ok && metro.value.fmr_area_name).toBe("Austin-Round Rock-San Marcos, TX MSA");
  });

  it("USGS elevation, and a no-data point is null with a reason (never a default)", async () => {
    const r = await usgsElevation(30.3005, -97.724, AUSTIN);
    expect(r.ok && Math.round(r.value.elevation_ft)).toBe(581);
    const ocean = await usgsElevation(30, -125.5, fakeFetch([[/epqs/, fx("usgs_elev_ocean.json")]]));
    expect(ocean.ok).toBe(false);
    expect(ocean.value).toBeNull();
  });

  it("FEMA flood zone: this point is in zone AE (special flood hazard area)", async () => {
    const r = await femaFloodZone(30.3005, -97.724, AUSTIN);
    expect(r.ok && r.value).toEqual({ zone: "AE", zone_subtype: null, special_flood_hazard_area: true });
  });

  it("FEMA: no polygon is reported as unmapped, not as safe", async () => {
    const empty = JSON.stringify({ features: [] });
    const r = await femaFloodZone(30, -97, fakeFetch([[/NFHL/, empty]]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unmapped/);
  });

  it("ACS without a key returns null and says why; the key never appears in the cited URL", async () => {
    const r = await acs5({ state: "48", county: "453", tract: "000302" }, 2024, undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/CENSUS_API_KEY/);
    const f = fakeFetch([[/api\.census\.gov/, JSON.stringify([["NAME", "B25077_001E", "B25064_001E", "state", "county", "tract"], ["Tract 3.02", "-666666666", "1500", "48", "453", "000302"]])]]);
    const ok = await acs5({ state: "48", county: "453", tract: "000302" }, 2024, "SECRET", ["B25077_001E", "B25064_001E"], f);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.source.url).not.toContain("SECRET");
    expect(f.calls[0]).toContain("key=SECRET");
    expect(ok.value.values.B25077_001E.value).toBeNull(); // Census "not available" sentinel -> null
    expect(ok.value.values.B25064_001E.value).toBe(1500);
  });

  it("network failure and HTTP errors give ok:false with a reason, never a number", async () => {
    const dead = fakeFetch([]);
    for (const r of [await usgsElevation(30, -97, dead), await censusGeographies(30, -97, fakeFetch([[/census/, 503]]))]) {
      expect(r.ok).toBe(false);
      expect(r.value).toBeNull();
    }
  });

  it("siteFacts bundles every source with its URL", async () => {
    const f = await siteFacts(30.3005, -97.724, { fetcher: AUSTIN });
    for (const k of ["geographies", "hud_fair_market_rent", "elevation", "flood_zone", "national_risk_index", "seismic_design"] as const) {
      expect(f[k].ok).toBe(true);
      expect(f[k].source.url).toMatch(/^https:\/\//);
      expect(f[k].source.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}/); // HUD: the date the bundled file was pulled from HUD
    }
    expect(f.national_risk_index.ok).toBe(true);
    if (f.national_risk_index.ok) {
      expect(f.national_risk_index.value.tract_fips).toBe("48453000302");
      expect(f.national_risk_index.value.risk_rating).toBe("Relatively Low");
    }
    expect(f.seismic_design.ok).toBe(true);
    if (f.seismic_design.ok) {
      expect(f.seismic_design.value.seismic_design_category).toBe("A");
    }
    expect(f.acs_tract && f.acs_tract.ok).toBe(false); // no key in tests
    expect(f.historic_preservation && f.historic_preservation.ok).toBe(true);
    expect(f.fhwa_nhcci && f.fhwa_nhcci.ok).toBe(true);
  });

  it("femaNationalRiskIndex returns composite risk and sub-scores from the Dec 2025 release", async () => {
    const res = await femaNationalRiskIndex(30.3005, -97.724, AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.vintage).toContain("December 2025");
    expect(res.value.tract_fips).toBe("48453000302");
    expect(res.value.risk_rating).toBe("Relatively Low");
    expect(res.value.risk_score).toBeCloseTo(28.1, 1);
    expect(res.value.earthquake_rating).toBe("Very Low");
  });

  it("usgsSeismicDesign returns ASCE 7-22 parameters", async () => {
    const res = await usgsSeismicDesign(30.3005, -97.724, AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.publisher).toContain("U.S. Geological Survey");
    expect(res.value.seismic_design_category).toBe("A");
    expect(res.value.pga_m).toBe(0.032);
    expect(res.value.ss).toBe(0.064);
  });

  it("pvwattsV8 returns annual generation and solar radiation from NLR PVWatts v8", async () => {
    const res = await pvwattsV8(30.3005, -97.724, 4.0, { fetcher: AUSTIN });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // The lab's own site (developer.nlr.gov, read 19 Nov 2026) names it "National Laboratory of the Rockies".
    expect(res.source.publisher).toBe("National Laboratory of the Rockies (NLR)");
    expect(res.value.assumptions).toEqual({ tilt_deg: 20, azimuth_deg: 180, losses_pct: 14, array_type: "fixed, roof mounted", module_type: "standard" });
    expect(res.notes?.join(" ")).toContain("not a quote");
    expect(res.value.ac_annual_kwh).toBe(5932);
    expect(res.value.solrad_annual).toBeCloseTo(5.4, 1);
    expect(res.value.capacity_factor_pct).toBeCloseTo(16.9, 1);
    expect(res.value.system_capacity_kw).toBe(4.0);
  });

  it("cdcPlacesTractHealth returns tract-level health metrics from CDC PLACES 2025", async () => {
    const res = await cdcPlacesTractHealth("48453000302", AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.publisher).toContain("Centers for Disease Control and Prevention");
    expect(res.source.vintage).toContain("PLACES 2025");
    expect(res.value.tract_fips).toBe("48453000302");
    expect(res.value.measures.OBESITY.value_pct).toBe(26.7);
    expect(res.value.measures.LPA.value_pct).toBe(14.4);
    expect(res.value.measures.GHLTH.value_pct).toBe(11.4);
  });

  it("ncesNearbySchools returns nearby public schools sorted by distance", async () => {
    const res = await ncesNearbySchools(30.3005, -97.724, 2000, AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.publisher).toContain("National Center for Education Statistics");
    expect(res.value.count).toBe(6);
    expect(res.value.schools[0].name).toBe("LEE EL");
    expect(res.value.schools[0].distance_m).toBeGreaterThan(0);
    expect(res.value.schools[0].zip).toBe("78705");
  });

  it("googleSolarBuildingInsights returns roof segments and pitch from Google Solar API", async () => {
    const res = await googleSolarBuildingInsights(30.3005, -97.724, "TEST_API_KEY", AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.publisher).toContain("Google Maps Platform");
    expect(res.value.roof_area_m2).toBe(185.8);
    expect(res.value.roof_segments.length).toBe(2);
    expect(res.value.roof_segments[0].pitch_degrees).toBe(21.5);
    expect(res.value.roof_segments[0].azimuth_degrees).toBe(182.0);
    expect(res.value.max_panels_count).toBe(24);
  });

  it("fhwaNhcci returns latest highway construction cost index and 2024 adjustment factor", async () => {
    const res = await fhwaNhcci(undefined, AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.publisher).toContain("Federal Highway Administration");
    expect(res.value.quarter).toBe("2026 Q1");
    expect(res.value.nhcci).toBeCloseTo(3.135, 3);
    expect(res.value.base_year_2024_adjustment_factor).toBeCloseTo(0.9823, 3);
  });

  it("fhfaTractHpi returns annual house price index history, 1-yr change, 5-yr CAGR, and 10-yr appreciation", async () => {
    const res = await fhfaTractHpi("48453000302", AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.publisher).toContain("Federal Housing Finance Agency");
    expect(res.value.tract_fips).toBe("48453000302");
    expect(res.value.state_abbr).toBe("TX");
    expect(res.value.latest_year).toBe(2025);
    expect(res.value.latest_hpi).toBe(954.01);
    expect(res.value.annual_change_pct).toBe(13.28);
    expect(res.value.five_year_appreciation_pct).toBe(47.14);
    expect(res.value.five_year_cagr_pct).toBe(8.03);
    expect(res.value.ten_year_appreciation_pct).toBe(87.8);
    expect(res.value.history.length).toBe(35);

    // Also verify CSV parsing path
    const sampleCsv = `tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000
48453000302,TX,2015,5.92,508.00,,213.84
48453000302,TX,2020,5.72,648.37,,272.93
48453000302,TX,2024,-8.45,842.18,,354.51
48453000302,TX,2025,13.28,954.01,,401.59`;
    const csvFetcher = async () => new Response(sampleCsv, { status: 200, headers: { "Content-Type": "text/csv" } });
    const csvRes = await fhfaTractHpi("48453000302", csvFetcher);
    expect(csvRes.ok).toBe(true);
    if (!csvRes.ok) return;
    expect(csvRes.value.latest_hpi).toBe(954.01);
    expect(csvRes.value.ten_year_appreciation_pct).toBe(87.8);
  });

  // Review 19 Nov 2026: FHFA leaves a cell blank where it has no index (2025 is blank for 17,211 of 63,930 tracts in
  // the file pulled that day). Number("") is 0, so the connector read such a tract as index 0, "+0%" for the year and
  // -100% over 10 years. Fixture: the real rows for tract 06037101220, 2014-2025, copied from hpi_at_tract.csv.
  it("fhfaTractHpi reads FHFA's blank cells as missing, never as 0", async () => {
    const csv = fx("fhfa_hpi_tract_06037101220_2014_2025.csv");
    const res = await fhfaTractHpi("06037101220", (async () => new Response(csv, { status: 200 })) as any);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.latest_year).toBe(2024); // 2025 is blank in FHFA's file
    expect(res.value.latest_hpi).toBe(823.7);
    expect(res.value.annual_change_pct).toBe(9.9);
    expect(res.value.ten_year_appreciation_pct).toBe(125.67); // (823.70 - 365.01) / 365.01, the ingest script's value too
    expect(res.value.history.every((p) => p.hpi > 0)).toBe(true);
    expect(res.source.vintage).toContain("Developmental Index");
    const allBlank = "tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000\n01001020100,AL,2025,,,,\n";
    const none = await fhfaTractHpi("01001020100", (async () => new Response(allBlank, { status: 200 })) as any);
    expect(none.ok).toBe(false);
  });

  it("ncesNearbySchools reads the school year from the layer and never sorts a school without coordinates first", async () => {
    const body = JSON.stringify({ features: [
      { attributes: { NAME: "NO COORDS SCHOOL", LAT: null, LON: null, SCHOOLYEAR: "2024-2025" } },
      { attributes: { NAME: "NEAR SCHOOL", LAT: 30.3006, LON: -97.7241, SCHOOLYEAR: "2024-2025" } },
    ] });
    const res = await ncesNearbySchools(30.3005, -97.724, 2000, (async () => new Response(body, { status: 200 })) as any);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.school_year).toBe("2024-2025");
    expect(res.value.schools[0].name).toBe("NEAR SCHOOL");
    expect(res.value.schools[1].lat).toBeNull();
    expect(res.source.vintage).not.toContain("2023-2024");
    expect(res.notes?.join(" ")).toContain("does not say which school this address is assigned to");
  });

  it("googleSolarBuildingInsights keeps a missing pitch, azimuth or area as null, not 0", async () => {
    const body = JSON.stringify({ solarPotential: { roofSegmentStats: [{ stats: {} }] } });
    const res = await googleSolarBuildingInsights(30.3005, -97.724, "TEST_API_KEY", (async () => new Response(body, { status: 200 })) as any);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.roof_segments[0]).toMatchObject({ pitch_degrees: null, azimuth_degrees: null, area_m2: null });
  });

  it("NHCCI, NRI, seismic and PLACES results carry their limits for the advisor", async () => {
    const nh = await fhwaNhcci(undefined, AUSTIN);
    expect(nh.ok && nh.notes?.join(" ")).toContain("not a home building or renovation cost index");
    const nri = await femaNationalRiskIndex(30.3005, -97.724, AUSTIN);
    expect(nri.ok && nri.source.vintage).toBe("December 2025 (1.20.0)");
    expect(nri.ok && nri.notes?.join(" ")).toContain("meant for planning purposes only");
    const seis = await usgsSeismicDesign(30.3005, -97.724, AUSTIN);
    expect(seis.ok && seis.value.site_class).toBe("D");
    expect(seis.ok && seis.notes?.join(" ")).toContain("not a forecast");
    const pl = await cdcPlacesTractHealth("48453000302", AUSTIN);
    expect(pl.ok && pl.notes?.join(" ")).toContain("model-based census tract estimates");
  });

  it("epaWalkabilityIndex returns walkability score and category for coordinates", async () => {
    const res = await epaWalkabilityIndex(30.3005, -97.724, AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.publisher).toContain("Environmental Protection Agency");
    expect(res.value.walkability_index).toBe(18);
    expect(res.value.category).toBe("Most Walkable");
    expect(res.value.block_group_fips).toBe("484530003025");
    expect(res.value.rankings?.intersection_density_rank).toBe(20);
    expect(res.value.rankings?.land_use_mix_rank).toBe(14);
  });

  // Replaced 19 Nov 2026. The old test passed a captured "Low-lying Areas" hit for Miami Beach as proof of a coastal
  // positive, but NOAA's service returns that same region-wide polygon for San Francisco City Hall and downtown Seattle
  // (identify calls in docs/audit/review-2026-11-19-owner-commits.md), so the result is withheld with its reason.
  it("noaaSeaLevelRise is withheld with its reason and never claims a point is in or out of a zone", async () => {
    let called = false;
    const spy = (async () => { called = true; throw new Error("should not be called"); }) as any;
    for (const [la, ln] of [[30.3005, -97.724], [25.79065, -80.13005], [37.7793, -122.4193]]) {
      const r = await noaaSeaLevelRise(la, ln, 1, spy);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("cannot tell a flooded point from a dry one");
    }
    expect(called).toBe(false);
  });

  it("npsHistoricPlaces screens National Register of Historic Places districts and landmarks", async () => {
    // 1. Austin Perry Estate historic district
    const res = await npsHistoricPlaces(30.3005, -97.724, AUSTIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source.publisher).toContain("National Park Service");
    expect(res.value.is_in_historic_district).toBe(true);
    expect(res.value.resources.length).toBe(1);
    expect(res.value.resources[0].name).toBe("Perry Estate--St. Mary's Academy");
    expect(res.value.resources[0].ref_num).toBe("01000874");
    expect(res.value.resources[0].resource_type).toBe("district");
    expect(res.value.resources[0].is_national_historic_landmark).toBe(false);

    // 2. Texas State Capitol (National Historic Landmark)
    const capitolFetch = fakeFetch([[/nrhp_locations\/MapServer\/1/, fx("nps_historic_capitol.json")]]);
    const capitol = await npsHistoricPlaces(30.2747, -97.7404, capitolFetch);
    expect(capitol.ok).toBe(true);
    if (!capitol.ok) return;
    expect(capitol.value.is_in_historic_district).toBe(true);
    expect(capitol.value.resources[0].name).toBe("Texas State Capitol");
    expect(capitol.value.resources[0].ref_num).toBe("70000770");
    expect(capitol.value.resources[0].is_national_historic_landmark).toBe(true);

    // 3. Negative point outside any historic district
    const negFetch = fakeFetch([[/nrhp_locations\/MapServer\/1/, fx("nps_historic_negative.json")]]);
    const neg = await npsHistoricPlaces(30.2000, -97.7500, negFetch);
    expect(neg.ok).toBe(true);
    if (!neg.ok) return;
    expect(neg.value.is_in_historic_district).toBe(false);
    expect(neg.value.resources.length).toBe(0);
  });

  it("parseOsmHeight converts feet/inches, feet, and meters correctly", () => {
    expect(parseOsmHeight("12'6\"")).toBe(3.81);
    expect(parseOsmHeight("10'")).toBe(3.05);
    expect(parseOsmHeight("40 ft")).toBe(12.19);
    expect(parseOsmHeight("40 feet")).toBe(12.19);
    expect(parseOsmHeight("15.5 m")).toBe(15.5);
    expect(parseOsmHeight("15.5 meters")).toBe(15.5);
    expect(parseOsmHeight("12")).toBe(12);
    expect(parseOsmHeight("")).toBeNull();
    expect(parseOsmHeight(null)).toBeNull();
    expect(parseOsmHeight("approx 3 stories")).toBeNull();
  });

  it("osmNearby parses building height with units accurately", async () => {
    const fakeOverpass = fakeFetch([
      [/overpass|interpreter/, JSON.stringify({
        elements: [
          { type: "way", id: 101, tags: { building: "yes", height: "40 ft", "building:levels": "3" }, center: { lat: 30.3, lon: -97.7 } },
          { type: "way", id: 102, tags: { building: "yes", height: "12 m", "building:levels": "4" }, center: { lat: 30.301, lon: -97.701 } },
        ]
      })]
    ]);
    const res = await osmNearby(30.3, -97.7, 500, "buildings", fakeOverpass);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.elements.length).toBe(2);
    expect(res.value.elements[0].height_m).toBe(12.19);
    expect(res.value.elements[0].levels).toBe(3);
    expect(res.value.elements[1].height_m).toBe(12);
    expect(res.value.elements[1].levels).toBe(4);
  });
});

describe("advisor loop", () => {
  it("tool results carry their sources back to the page", async () => {
    const r = await runAdvisorTool("lookup_site_facts", { lat: 30.3005, lng: -97.724 }, { fetcher: AUSTIN });
    expect(r.isError).toBe(false);
    expect(r.sources.map((s) => s.publisher)).toContain("Federal Emergency Management Agency");
    expect((await runAdvisorTool("lookup_site_facts", { lat: "x" }, {})).isError).toBe(true);
    expect((await runAdvisorTool("nope", {}, {})).isError).toBe(true);

    const solarRes = await runAdvisorTool("model_solar_pv", { lat: 30.3005, lng: -97.724, system_capacity_kw: 4.0 }, { fetcher: AUSTIN });
    expect(solarRes.isError).toBe(false);
    expect(solarRes.sources.map((s) => s.publisher)).toContain("National Laboratory of the Rockies (NLR)");
    expect(solarRes.text).toContain("5932");

    const healthRes = await runAdvisorTool("lookup_health_profile", { tract_fips: "48453000302" }, { fetcher: AUSTIN });
    expect(healthRes.isError).toBe(false);
    expect(healthRes.sources.map((s) => s.publisher)).toContain("Centers for Disease Control and Prevention (CDC)");
    expect(healthRes.text).toContain("OBESITY");

    const schoolRes = await runAdvisorTool("find_nearby_schools", { lat: 30.3005, lng: -97.724 }, { fetcher: AUSTIN });
    expect(schoolRes.isError).toBe(false);
    expect(schoolRes.sources.map((s) => s.publisher)).toContain("National Center for Education Statistics (NCES)");
    expect(schoolRes.text).toContain("LEE EL");

    const walkRes = await runAdvisorTool("lookup_walkability_index", { lat: 30.3005, lng: -97.724 }, { fetcher: AUSTIN });
    expect(walkRes.isError).toBe(false);
    expect(walkRes.sources.map((s) => s.publisher)).toContain("U.S. Environmental Protection Agency (EPA)");
    expect(walkRes.text).toContain("Most Walkable");

    const slrRes = await runAdvisorTool("check_sea_level_rise", { lat: 30.3005, lng: -97.724, scenario_ft: 1 }, { fetcher: AUSTIN });
    expect(slrRes.sources.some((s) => s.publisher.includes("National Oceanic and Atmospheric Administration"))).toBe(true);
    expect(slrRes.text).toContain("Not on file");
    expect(slrRes.text).not.toContain("in_low_lying_slr_area");

    const hpiRes = await runAdvisorTool("lookup_hpi_appreciation", { tract_fips: "48453000302" }, { fetcher: AUSTIN });
    expect(hpiRes.isError).toBe(false);
    expect(hpiRes.sources.map((s) => s.publisher)).toContain("Federal Housing Finance Agency (FHFA)");
    expect(hpiRes.text).toContain("954.01");
    expect(hpiRes.text).toContain("87.8");

    const histRes = await runAdvisorTool("check_historic_preservation", { lat: 30.3005, lng: -97.724 }, { fetcher: AUSTIN });
    expect(histRes.isError).toBe(false);
    expect(histRes.sources.map((s) => s.publisher)).toContain("National Park Service (NPS)");
    expect(histRes.text).toContain("Perry Estate");

    const nhcciRes = await runAdvisorTool("lookup_construction_cost_index", {}, { fetcher: AUSTIN });
    expect(nhcciRes.isError).toBe(false);
    expect(nhcciRes.sources.map((s) => s.name)).toContain("FHWA National Highway Construction Cost Index (NHCCI)");
    expect(nhcciRes.text).toContain("2026 Q1");
    expect(nhcciRes.text).toContain("3.1348");
  });

  it("runs tools, returns all results in one user turn, and returns the final text with sources", async () => {
    const sent: any[] = [];
    const replies: any[] = [
      { stop_reason: "tool_use", content: [{ type: "text", text: "Checking." }, { type: "tool_use", id: "t1", name: "lookup_site_facts", input: { lat: 30.3005, lng: -97.724 } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "FEMA flood map: zone AE." }] },
    ];
    const client = { beta: { messages: { create: async (body: any) => (sent.push(structuredClone(body)), replies.shift()) } } };
    const out = await runAdvisor(client as any, "SYSTEM", [{ role: "user", content: "Is it in a flood zone?" }], { fetcher: AUSTIN });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.text).toBe("FEMA flood map: zone AE.");
    expect(out.tool_rounds).toBe(1);
    expect(out.sources.some((s) => s.url.includes("hazards.fema.gov"))).toBe(true);
    // Request shape: model, sourcing rules in a cached system block, no forced tool choice, refusal fallback on.
    expect(sent[0].model).toBe("claude-opus-5-5");
    expect(sent[0].system[0].text).toContain(SOURCING_RULES.trim().slice(0, 40));
    expect(sent[0].system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(sent[0].tool_choice).toBeUndefined();
    expect(sent[0].fallbacks).toBe("default");
    // Second request: assistant turn kept whole, then one user turn holding the tool_result.
    const msgs = sent[1].messages;
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[2].content[0].type).toBe("tool_result");
    expect(msgs[2].content[0].tool_use_id).toBe("t1");
  });

  it("a refusal is reported as an error, not as an answer", async () => {
    const client = { beta: { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } } };
    const out = await runAdvisor(client as any, "S", [{ role: "user", content: "q" }], {});
    expect(out.ok).toBe(false);
  });

  describe("Worker security and origin controls", () => {
    it("allows the primary GitHub Pages production origin in all environments", () => {
      expect(isAllowedOrigin("https://milessilverman.github.io")).toBe(true);
      expect(isAllowedOrigin("https://milessilverman.github.io", { ENVIRONMENT: "production" })).toBe(true);
      expect(isAllowedOrigin("https://milessilverman.github.io", { ENVIRONMENT: "development" })).toBe(true);
    });

    it("allows the owner's own domain, which shows the same GitHub Pages site, and nothing that merely resembles it", () => {
      expect(isAllowedOrigin("https://www.milessilverman.com")).toBe(true);
      expect(isAllowedOrigin("https://www.milessilverman.com", { ENVIRONMENT: "production" })).toBe(true);
      expect(isAllowedOrigin("http://www.milessilverman.com", { ENVIRONMENT: "production" })).toBe(false);
      expect(isAllowedOrigin("https://www.milessilverman.com.evil.example", { ENVIRONMENT: "production" })).toBe(false);
      expect(isAllowedOrigin("https://evil-milessilverman.com", { ENVIRONMENT: "production" })).toBe(false);
    });

    it("allows localhost origins during development, but strictly blocks them in production", () => {
      expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
      expect(isAllowedOrigin("http://127.0.0.1:8080")).toBe(true);
      expect(isAllowedOrigin("http://localhost:3000", { ENVIRONMENT: "development" })).toBe(true);

      // Blocked in production
      expect(isAllowedOrigin("http://localhost:3000", { ENVIRONMENT: "production" })).toBe(false);
      expect(isAllowedOrigin("http://127.0.0.1:8080", { ENVIRONMENT: "production" })).toBe(false);
    });

    it("rejects unauthorized external origins and missing origins", () => {
      expect(isAllowedOrigin(null)).toBe(false);
      expect(isAllowedOrigin("")).toBe(false);
      expect(isAllowedOrigin("https://evil-site.com")).toBe(false);
      expect(isAllowedOrigin("https://not-city-pretty.org")).toBe(false);
    });
  });
});
