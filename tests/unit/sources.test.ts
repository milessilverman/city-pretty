// Tests for workers/sources.ts and workers/advisorAgent.ts.
// Fixtures in tests/fixtures/sources are real responses captured from the official services on 2026-11-16
// (Austin, TX: 811 E 41st St / 30.3005, -97.724). Nothing in them was edited.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  acs5,
  addressMismatch,
  censusGeographies,
  femaFloodZone,
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
    for (const k of ["geographies", "hud_fair_market_rent", "elevation", "flood_zone"] as const) {
      expect(f[k].ok).toBe(true);
      expect(f[k].source.url).toMatch(/^https:\/\//);
      expect(f[k].source.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}/); // HUD: the date the bundled file was pulled from HUD
    }
    expect(f.acs_tract && f.acs_tract.ok).toBe(false); // no key in tests
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
