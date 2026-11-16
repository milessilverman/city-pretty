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
  hudFairMarketRent,
  siteFacts,
  usgsElevation,
} from "../../workers/sources";
import { runAdvisor, runAdvisorTool, SOURCING_RULES } from "../../workers/advisorAgent";

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
  [/Fair_Market_Rents/, fx("hud_fmr_austin.json")],
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

  it("HUD FMR: values are HUD's, area name is HUD's current name", async () => {
    const r = await hudFairMarketRent(30.3005, -97.724, AUSTIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fmr_area_name).toBe("Austin-Round Rock-San Marcos, TX MSA");
    expect(r.value.rent_2br).toBe(1852);
    expect(r.notes?.join(" ")).toMatch(/not market asking rents/);
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
    for (const r of [await hudFairMarketRent(30, -97, dead), await usgsElevation(30, -97, dead), await censusGeographies(30, -97, fakeFetch([[/census/, 503]]))]) {
      expect(r.ok).toBe(false);
      expect(r.value).toBeNull();
    }
  });

  it("siteFacts bundles every source with its URL", async () => {
    const f = await siteFacts(30.3005, -97.724, { fetcher: AUSTIN });
    for (const k of ["geographies", "hud_fair_market_rent", "elevation", "flood_zone"] as const) {
      expect(f[k].ok).toBe(true);
      expect(f[k].source.url).toMatch(/^https:\/\//);
      expect(f[k].source.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    expect(f.acs_tract && f.acs_tract.ok).toBe(false); // no key in tests
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
});
