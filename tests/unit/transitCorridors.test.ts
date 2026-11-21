// Planned-rail corridors: the data file (app/data/intercity_transit_corridors.json), its stored source texts
// (research/corridors/*.txt), the county matching and the stop-area helper (src/engines/corridorStopAreas.js).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const root = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const load = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf-8"));
const areas = require("../../src/engines/corridorStopAreas.js");

const norm = (s: string) =>
  s.replace(/’|‘/g, "'").replace(/“|”/g, '"').replace(/–|—/g, "-").replace(/ /g, " ").replace(/\s+/g, " ")
    .replace(/(?<=\w)- (?=\w)/g, "-"); // the FRA PDF text breaks lines after a hyphen
const DOCS: Record<string, { file: string; url: string }> = {
  fra_fy22_cid: { file: "fra_fy22_cid_selections.txt", url: "https://railroads.dot.gov/sites/fra.dot.gov/files/2025-02/FY22%20CID%20Project%20Summaries-Map-r3.pdf" },
  amtrak_20231208: { file: "amtrak_2023-12-08_federal_grants.txt", url: "https://media.amtrak.com/2023/12/amtrak-and-partners-receive-federal-grants-to-improve-and-expand-passenger-rail-across-america/" },
  amtrak_20230809: { file: "amtrak_2023-08-09_texas_central.txt", url: "https://media.amtrak.com/2023/08/texas-central-and-amtrak-seek-to-explore-high-speed-rail-service-opportunities-between-dallas-and-houston/" },
  amtrak_20230322: { file: "amtrak_2023-03-22_scranton_new_york.txt", url: "https://media.amtrak.com/2023/03/amtrak-study-examines-scranton-new-york-corridor/" },
  brightline_home: { file: "brightline_west_home.txt", url: "https://www.brightlinewest.com/" },
  brightline_project: { file: "brightline_west_project.txt", url: "https://www.brightlinewest.com/overview/project" },
  brightline_construction: { file: "brightline_west_construction.txt", url: "https://www.brightlinewest.com/construction" },
  wsdot_cascadia: { file: "wsdot_cascadia_high_speed_rail.txt", url: "https://wsdot.wa.gov/construction-planning/search-studies/cascadia-high-speed-rail" },
};
const TEXT: Record<string, string> = {};
for (const [k, d] of Object.entries(DOCS)) TEXT[k] = norm(fs.readFileSync(path.join(root, "research/corridors", d.file), "utf-8"));

const all: any[] = load("app/data/intercity_transit_corridors.json");
const fra = all.filter((c) => c.cid_selection);
const manifest = new Set<string>(load("counties/manifest.json").counties.map((c: any) => c.fips));
const ON_PAGE = new Set([...manifest, "06037", "06059"]); // Los Angeles and Orange are built into the page, not listed in the manifest
const NUMERIC = ["route_length_miles", "max_speed_mph", "projected_one_way_minutes", "highway_comparison_minutes", "estimated_capital_cost_billions"];

describe("corridor data: every record and every stop has a source and a verbatim quote", () => {
  it("lists the 69 FRA FY22 Corridor ID selections, and Amtrak's release gives the same count", () => {
    expect(fra.length).toBe(69);
    expect(new Set(fra.map((c) => c.id)).size).toBe(69);
    expect(TEXT.amtrak_20231208).toContain("The FRA awarded grant funding to all four applications Amtrak submitted. Another 65 applications submitted by other entities also received funding.");
    expect(fra.filter((c) => c.lead_agencies[0] === "Amtrak").length).toBe(4);
  });

  it("each FRA record's description and step are verbatim in the stored FRA text", () => {
    for (const c of fra) {
      expect(c.cid_selection.source_url, c.id).toBe(DOCS.fra_fy22_cid.url);
      expect(TEXT.fra_fy22_cid, c.id).toContain(norm(c.cid_selection.quote));
      expect(TEXT.fra_fy22_cid, c.id).toContain(norm(c.cid_selection.header));
      expect(c.cid_selection.retrieved).toBe("2026-11-18");
      expect(c.cid_selection.read_from).toMatch(/archived/);
      expect(TEXT.amtrak_20231208).toContain(norm(c.cid_selection.corroboration.quote));
      expect(c.lead_agencies).toEqual([c.cid_selection.sponsor]);
      expect(c.verification.checked_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.verification.status).toBe("partially_verified");
      expect(c.verification.evidence.length).toBeGreaterThan(40);
    }
  });

  it("every stop city is named in its own quote, which is verbatim in the stored document it cites", () => {
    let stops = 0;
    for (const c of fra) {
      for (const s of c.proposed_stations) {
        stops++;
        expect(s.station_basis, s.id).toBe("named_in_source");
        expect(DOCS[s.source_document], s.id).toBeTruthy();
        expect(s.source_url).toBe(DOCS[s.source_document].url);
        expect(TEXT[s.source_document], s.id).toContain(norm(s.quote));
        expect(norm(s.quote), s.id).toContain(norm(s.city));
        for (const a of s.also_named_in || []) expect(TEXT[a.source_document], s.id).toContain(norm(a.quote));
        // county and coordinates come from Census lookups whose URLs are recorded
        expect(s.fips, s.id).toMatch(/^\d{5}$/);
        expect(s.place_lookup_url).toMatch(/^https:\/\/tigerweb\.geo\.census\.gov\//);
        expect(s.county_lookup_url).toMatch(/^https:\/\/tigerweb\.geo\.census\.gov\//);
        expect(s.coordinate_basis).toMatch(/Census internal point/);
        expect(Number.isFinite(s.lat) && Number.isFinite(s.lng)).toBe(true);
        expect(s.verified).toBe(false); // a city point is not a station
        // the county flag says whether the county is on the page yet
        expect(s.county_on_page, s.id).toBe(ON_PAGE.has(s.fips));
        // no per-station market numbers
        for (const f of ["median_home_value_walkshed", "avg_land_cost_per_sqft", "available_underused_acres_walkshed"]) expect(s[f]).toBeNull();
      }
      // places the text names that have no Census city/county are listed with the reason, not given a county
      for (const u of [...c.named_places_without_county, ...c.non_us_named_places]) { expect(u.name).toBeTruthy(); expect(u.why).toBeTruthy(); }
      expect(c.named_places_without_county.map((u: any) => u.name).every((n: string) => norm(c.cid_selection.quote).includes(norm(n)))).toBe(true);
    }
    expect(stops).toBeGreaterThan(250);
  });

  it("a number appears only with a quote from a stored document that states it", () => {
    let withNumbers = 0;
    for (const c of fra) {
      const figs: any[] = c.figures || [];
      for (const f of NUMERIC) {
        if (c[f] == null) continue;
        withNumbers++;
        const fig = figs.find((x) => x.field === f);
        expect(fig, `${c.id} ${f}`).toBeTruthy();
        expect(fig.value).toBe(c[f]);
        expect(TEXT[fig.source_document]).toContain(norm(fig.quote));
        expect(c.verification.evidence).toContain(String(c[f]));
        expect(["verified", "partially_verified"]).toContain(c.verification.status);
      }
      for (const fig of figs) expect(c[fig.field]).toBe(fig.value);
    }
    // Brightline West (3 figures), Dallas-Houston (2), Scranton (2)
    expect(withNumbers).toBe(7);
    const bl = fra.find((c) => c.id === "corridor_brightline_west");
    expect(bl.route_length_miles).toBe(218);
    expect(TEXT.brightline_project).toContain("The 218-mile passenger rail service will operate from Las Vegas to Rancho Cucamonga");
  });

  it("status is stated with its source; stalled or unknown status is said, not hidden", () => {
    for (const c of fra) {
      expect(c.status_stated.text.length).toBeGreaterThan(20);
      expect(DOCS[c.status_stated.source_document]).toBeTruthy();
      if (c.status_stated.quote) expect(TEXT[c.status_stated.source_document]).toContain(norm(c.status_stated.quote));
    }
    const tx = fra.find((c) => c.id === "corridor_cid_texas_hsr_dallas_houston");
    expect(tx.status_stated.as_of).toBe("2023-08-09");
    expect(tx.status_stated.as_of_note).toMatch(/2020/);
    const ca = fra.find((c) => c.id === "corridor_cahsr_phase1");
    expect(ca.status_stated.text).toMatch(/not on file/);
    const cas = fra.find((c) => c.id === "corridor_cascadia_hsgt");
    expect(cas.status_stated.text).toMatch(/will not select a preferred route or identify station locations/);
  });

  it("the leads from the earlier branch that held up, and the one that did not", () => {
    const by = Object.fromEntries(all.map((c) => [c.id, c]));
    const cities = (id: string) => by[id].proposed_stations.map((s: any) => s.city);
    expect(cities("corridor_cascadia_hsgt").sort()).toEqual(["Eugene", "Portland", "Seattle"]);
    expect(cities("corridor_cid_houston_san_antonio").sort()).toEqual(["Flatonia", "Houston", "Rosenberg", "San Antonio", "Seguin"]);
    expect(by["corridor_atx_sat"].verification.status).toBe("unverified"); // Austin-San Antonio is in no fetched document
  });
});

describe("county matching uses the stop cities' county FIPS", () => {
  const forCounty = (fips: string) => all.filter((c) => (c.proposed_stations || []).some((s: any) => s && s.fips === fips)).map((c) => c.id);
  it("a corridor lists the county of each named city and not the rest of its state", () => {
    // Seguin is in Guadalupe County: only the Houston-San Antonio corridor names a city there
    expect(forCounty("48187")).toEqual(["corridor_cid_houston_san_antonio"]);
    // Travis County (Austin): no FRA corridor names Austin; only the unconfirmed Austin-San Antonio record lists it
    expect(forCounty("48453")).toEqual(["corridor_atx_sat"]);
    // Maricopa and Pima: Phoenix-Tucson (and the daily Sunset Limited for Tucson)
    expect(forCounty("04013")).toContain("corridor_phx_tus");
    expect(forCounty("04019")).toEqual(expect.arrayContaining(["corridor_phx_tus", "corridor_cid_daily_sunset_limited"]));
    // a county in a state with corridors but no named city matches nothing
    expect(forCounty("48301")).toEqual([]); // Loving County, TX
  });
  it("every stop's county FIPS agrees with its state", () => {
    const ST: Record<string, string> = { AL: "01", AK: "02", AZ: "04", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", ID: "16", IL: "17", IN: "18", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NV: "32", NJ: "34", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", SC: "45", TN: "47", TX: "48", VT: "50", VA: "51", WA: "53", WI: "55" };
    for (const c of fra) for (const s of c.proposed_stations) expect(s.fips.slice(0, 2), s.id).toBe(ST[s.state]);
  });
});

describe("corridorStopAreas helper", () => {
  const square = (id: string, x0: number, y0: number, x1: number, y1: number) => ({ type: "Feature", properties: { id, n: "N" + id, c: "City" }, geometry: { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } });
  const lat0 = 30, lng0 = -97, mi = 1 / 69.0935; // one mile north-south in degrees
  const bundle = { features: [
    square("in", lng0 - 0.001, lat0 - 0.001, lng0 + 0.001, lat0 + 0.001),       // contains the point
    square("near", lng0 + 0.0001, lat0 + 0.5 * mi, lng0 + 0.002, lat0 + 0.9 * mi), // edge 0.5 mi north
    square("edge", lng0 - 0.001, lat0 + 1.2 * mi, lng0 + 0.001, lat0 + 1.5 * mi),  // edge 1.2 mi north
    square("far", lng0 + 0.5, lat0 + 0.5, lng0 + 0.6, lat0 + 0.6),
  ] };
  it("lists block groups within the radius, nearest first, and not those beyond it", () => {
    const r = areas.blockGroupsWithin(bundle, { lat: lat0, lng: lng0 }, 1);
    expect(r.ok).toBe(true);
    expect(r.areas.map((a: any) => a.id)).toEqual(["in", "near"]);
    expect(r.areas[0].miles).toBe(0);
    expect(r.areas[1].miles).toBeCloseTo(0.5, 1);
    expect(areas.blockGroupsWithin(bundle, { lat: lat0, lng: lng0 }, 1.3).areas.map((a: any) => a.id)).toEqual(["in", "near", "edge"]);
  });
  it("says why it cannot answer instead of returning an empty list as if it were an answer", () => {
    expect(areas.blockGroupsWithin({ features: [] }, { lat: 1, lng: 1 }, 1)).toMatchObject({ ok: false });
    expect(areas.blockGroupsWithin(bundle, { lat: NaN, lng: 1 }, 1).ok).toBe(false);
    expect(areas.blockGroupsWithin(bundle, { lat: 1, lng: 1 }, 0).ok).toBe(false);
  });
  it("on a real county file: Seguin's stop city point lies in Guadalupe County and has block groups within 1 mile", () => {
    const b = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "counties/bundle_48187.json.gz"))).toString());
    const c = all.find((x) => x.id === "corridor_cid_houston_san_antonio");
    const res = areas.stopAreasForCounty(c, b, "48187", 1);
    expect(res.length).toBe(1);
    expect(res[0].stop.city).toBe("Seguin");
    expect(res[0].ok).toBe(true);
    expect(res[0].areas.length).toBeGreaterThan(0);
    for (const a of res[0].areas) { expect(a.id.startsWith("48187")).toBe(true); expect(a.miles).toBeLessThanOrEqual(1); }
    // the same call for a county where the corridor names no city returns nothing
    expect(areas.stopAreasForCounty(c, b, "48453", 1)).toEqual([]);
    // a wider radius never loses a block group
    const wide = areas.stopAreasForCounty(c, b, "48187", 3)[0].areas.map((a: any) => a.id);
    for (const a of res[0].areas) expect(wide).toContain(a.id);
  });
});
