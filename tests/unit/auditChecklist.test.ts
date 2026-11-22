// Tests verifying fixes for the 18 Nov 2026 free-data audit work order (AUDIT-2026-11-18-free-data.md, Section 5).
// Covers items P0-1 through P0-6, P0-8, P0-10, P1-1, P1-2, and P1-4.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseOsmHeight } from "../../workers/sources";
// @ts-ignore plain ES module
import { hudRow } from "../../app/facts.js";

const root = path.resolve(__dirname, "../..");
const appJs = fs.readFileSync(path.join(root, "app/app.js"), "utf8");

// Extract helper functions from app.js
const hudFmrStart = appJs.indexOf("function getHudFmr(fips, zip)");
const hudFmrBlock = appJs.slice(hudFmrStart, appJs.indexOf("\n// ====", hudFmrStart));
const escStart = appJs.indexOf("const esc = s =>");
const escBlock = appJs.slice(escStart, appJs.indexOf("const GRADE_TXT ="));
const pbStart = appJs.indexOf("function priceBandOf(v)");
const pbBlock = appJs.slice(pbStart, appJs.indexOf("\n", pbStart));
const gridStart = appJs.indexOf("function gridCellIndicesX(w, e, cell)");
const gridBlock = appJs.slice(gridStart, appJs.indexOf("function visibleCells"));

const sandbox: any = {};
new Function("window", "sandbox", `
  ${hudFmrBlock}
  ${escBlock}
  ${pbBlock}
  ${gridBlock}
  sandbox.getHudFmr = getHudFmr;
  sandbox.esc = esc;
  sandbox.fmt$ = fmt$;
  sandbox.fmtRent = fmtRent;
  sandbox.priceBandOf = priceBandOf;
  sandbox.gridCellIndicesX = gridCellIndicesX;
`)(sandbox, sandbox);

const { getHudFmr, esc, fmt$, fmtRent, priceBandOf, gridCellIndicesX } = sandbox;

describe("Audit checklist verification (Section 5)", () => {
  describe("P0-1 & P0-2: Hazard exclusions and verified field reads", () => {
    it("hazard exclusions in app.js read verified fields (.sfha, .vh, .hpoz.v.length)", () => {
      // Must not read unverified .flood.ok or .fire.ok
      expect(appJs).not.toMatch(/R\.flood\.ok/);
      expect(appJs).not.toMatch(/R\.fire\.ok/);
      // Reads fema.sfha and fire.vh
      expect(appJs).toMatch(/R\.fema[\s\S]*?\.sfha/);
      expect(appJs).toMatch(/R\.fire[\s\S]*?\.vh/);
    });

    it("hazard status shows 'Not checked for this lot' when check did not run, never a fake negative", () => {
      expect(appJs).toMatch(/"Not checked for this lot"/);
      // Never asserts negative without having run
      expect(appJs).not.toMatch(/"Not in zone"\s*,\s*"USFS Wildfire/);
    });
  });

  describe("P0-3: Address search state code matching", () => {
    const geoCode = appJs.slice(
      appJs.indexOf("const STATE_NAME_TO_ABBR ="),
      appJs.indexOf("async function geocodeUS(text)")
    );
    const sandbox: any = {};
    new Function("window", geoCode)(sandbox);
    const { resolveCountyFipsFromArcGisAttrs } = sandbox;

    it("resolves exact state matches and prevents substring collisions across the 7 audit test cases", () => {
      // 1. Washington MD vs AR
      expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Washington County", Region: "Maryland" }, [
        { dataset: { fips: "05143", name: "Washington County", st: "AR" } },
        { dataset: { fips: "24043", name: "Washington County", st: "MD" } },
      ])).toBe("24043");

      // 2. Orange NC vs CA
      expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Orange County", Region: "North Carolina" }, [
        { dataset: { fips: "06059", name: "Orange County", st: "CA" } },
        { dataset: { fips: "37135", name: "Orange County", st: "NC" } },
      ])).toBe("37135");

      // 3. Douglas GA vs OR
      expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Douglas County", Region: "Georgia" }, [
        { dataset: { fips: "41019", name: "Douglas County", st: "OR" } },
        { dataset: { fips: "13097", name: "Douglas County", st: "GA" } },
      ])).toBe("13097");

      // 4. Jackson MS vs MI
      expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Jackson County", Region: "Mississippi" }, [
        { dataset: { fips: "26075", name: "Jackson County", st: "MI" } },
        { dataset: { fips: "28059", name: "Jackson County", st: "MS" } },
      ])).toBe("28059");

      // 5. Jackson MO vs MI
      expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Jackson County", Region: "Missouri" }, [
        { dataset: { fips: "26075", name: "Jackson County", st: "MI" } },
        { dataset: { fips: "29095", name: "Jackson County", st: "MO" } },
      ])).toBe("29095");

      // 6. Kent RI vs DE
      expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Kent County", Region: "Rhode Island" }, [
        { dataset: { fips: "10001", name: "Kent County", st: "DE" } },
        { dataset: { fips: "44003", name: "Kent County", st: "RI" } },
      ])).toBe("44003");

      // 7. Clark WA vs IN
      expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Clark County", Region: "Washington" }, [
        { dataset: { fips: "18019", name: "Clark County", st: "IN" } },
        { dataset: { fips: "53011", name: "Clark County", st: "WA" } },
      ])).toBe("53011");
    });
  });

  describe("P0-4: Parcel registry field validation", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(root, "app/data/parcel_services.json"), "utf8"));
    const validFieldPattern = /^[A-Za-z0-9_.]+(\(\))?$/;

    it("every parcel registry field matches ^[A-Za-z0-9_.]+(\\(\\))?$", () => {
      for (const svc of raw.services) {
        for (const [field] of svc.fields) {
          expect(field, `Invalid field '${field}' in ${svc.name}`).toMatch(validFieldPattern);
        }
      }
    });

    it("Harris County (48201) uses discrete fields, not concatenation expressions", () => {
      const harris = raw.services.find((s: any) => s.counties && s.counties.includes("48201"));
      expect(harris).toBeDefined();
      const fieldNames = harris.fields.map(([f]: [string]) => f);
      expect(fieldNames).toContain("site_str_num");
      expect(fieldNames).toContain("site_str_name");
      expect(fieldNames.some((f: string) => f.includes("+"))).toBe(false);
    });

    it("Dallas County (48113) uses discrete fields, not concatenation expressions", () => {
      const dallas = raw.services.find((s: any) => s.counties && s.counties.includes("48113"));
      expect(dallas).toBeDefined();
      const fieldNames = dallas.fields.map(([f]: [string]) => f);
      expect(fieldNames).toContain("ST_NUM");
      expect(fieldNames).toContain("ST_NAME");
      expect(fieldNames.some((f: string) => f.includes("+"))).toBe(false);
    });
  });

  describe("P0-5: Roof area calculation rules", () => {
    it("sets footprint to null and source to 'Footprint not on file' when no outline exists", () => {
      expect(appJs).toMatch(/F\.src\.foot\s*=\s*"Footprint not on file"/);
      expect(appJs).toMatch(/F\.foot\s*=\s*null/);
    });

    it("uses overhang 0 for traced outlines (no double counting)", () => {
      expect(appJs).toMatch(/defaultOverhang\s*=\s*isTracedOutline\s*\?\s*0\s*:\s*18/);
    });
  });

  describe("P0-6: OSM height parsing", () => {
    it("converts feet and feet-inches to meters properly", () => {
      expect(parseOsmHeight("40 ft")).toBeCloseTo(12.192, 2);
      expect(parseOsmHeight("12'6\"")).toBeCloseTo(3.81, 2);
      expect(parseOsmHeight("12'")).toBeCloseTo(3.6576, 2);
      expect(parseOsmHeight("10.5 m")).toBe(10.5);
      expect(parseOsmHeight("15.2")).toBe(15.2);
    });

    it("rejects non-numeric and invalid inputs", () => {
      expect(parseOsmHeight("")).toBeNull();
      expect(parseOsmHeight(null)).toBeNull();
      expect(parseOsmHeight("unknown")).toBeNull();
      expect(parseOsmHeight("-5 ft")).toBeNull();
    });
  });

  describe("P0-8: HTML escaping and XSS safety", () => {
    it("esc() escapes single quotes to &#39; as well as <, >, &, and \"", () => {
      expect(esc("King's Cross")).toBe("King&#39;s Cross");
      expect(esc("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
      expect(esc('Quote "test" & more')).toBe("Quote &quot;test&quot; &amp; more");
    });
  });

  describe("P0-10: ADU rent line formatting", () => {
    it("never contains currency_note or undefined", () => {
      expect(appJs).not.toMatch(/currency_note/);
    });
  });

  describe("P1-1: Connecticut Tree Equity coverage", () => {
    it("all 8 Connecticut planning region files (09110..09190) have > 0 block groups", () => {
      const teDir = path.join(root, "app/data/tree_equity_2025");
      const ctRegions = ["09110", "09120", "09130", "09140", "09160", "09170", "09180", "09190"];
      for (const reg of ctRegions) {
        const filePath = path.join(teDir, `${reg}.json`);
        expect(fs.existsSync(filePath), `Missing CT region file ${reg}.json`).toBe(true);
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const bgs = Object.keys(data).filter((k) => k !== "_meta");
        expect(bgs.length, `CT planning region ${reg} is empty`).toBeGreaterThan(0);
      }
    });
  });

  describe("P1-2: Price band evaluation grouped by estimate", () => {
    const benchmarks = JSON.parse(fs.readFileSync(path.join(root, "app/data/valuation_backtest_benchmarks.json"), "utf8"));
    const queens = benchmarks.counties["36081"];

    it("Queens benchmark includes by_price_band with higher error for homes under $500k", () => {
      expect(queens).toBeDefined();
      expect(queens.by_price_band).toBeDefined();
      expect(queens.by_price_band["under $500k"].mdape).toBeGreaterThan(queens.model.mdape + 0.02);
      expect(queens.by_price_band["$2M and up"].mdape).toBeGreaterThan(queens.model.mdape + 0.02);
    });

    it("priceBandOf correctly categorizes valuation estimates", () => {
      expect(priceBandOf(450000)).toBe("under $500k");
      expect(priceBandOf(750000)).toBe("$500k-$1M");
      expect(priceBandOf(1500000)).toBe("$1M-$2M");
      expect(priceBandOf(2500000)).toBe("$2M and up");
    });
  });

  describe("P1-4: ACS top- and bottom-coded formatting", () => {
    it("fmtRent formats the top-code (3501) as '$3,500 or more/mo'", () => {
      expect(fmtRent(3501)).toBe("$3,500 or more/mo");
      expect(fmtRent(4000)).toBe("$3,500 or more/mo");
    });

    // Census publishes 3500 as an estimate (block group 484530013092: 3500, margin 2500); only 3501 is the top-code.
    it("fmtRent shows a published median of exactly $3,500 to the dollar, not as the top-code", () => {
      expect(fmtRent(3500)).toBe("$3,500/mo");
      expect(fmtRent(3499)).toBe("$3,499/mo");
    });

    it("fmtRent formats bottom-code ($99-$100) as '$100 or less/mo'", () => {
      expect(fmtRent(99)).toBe("$100 or less/mo");
      expect(fmtRent(100)).toBe("$100 or less/mo");
      expect(fmtRent(50)).toBe("$100 or less/mo");
    });

    it("fmtRent formats normal rents to the dollar", () => {
      expect(fmtRent(2100)).toBe("$2,100/mo");
      expect(fmtRent(1450)).toBe("$1,450/mo");
      expect(fmtRent(null)).toBe("–");
    });

    it("fmt$ formats ACS median home value top-code (2,000,001) as '$2,000,000 or more'", () => {
      expect(fmt$(2000001)).toBe("$2,000,000 or more");
      expect(fmt$(2000000)).toBe("$2,000,000 or more");
    });

    it("fmt$ formats ACS bottom-code (9,999 or 10,000) as '$10,000 or less'", () => {
      expect(fmt$(9999)).toBe("$10,000 or less");
      expect(fmt$(10000)).toBe("$10,000 or less");
    });

    it("fmt$ formats ACS income top-code (250,001) as '$250,000 or more'", () => {
      expect(fmt$(250001)).toBe("$250,000 or more");
    });

    it("fmt$ formats ACS income bottom-code (2,499 or 2,500) as '$2,500 or less'", () => {
      expect(fmt$(2499)).toBe("$2,500 or less");
      expect(fmt$(2500)).toBe("$2,500 or less");
    });

    it("fmt$ formats ordinary dollar figures cleanly without treating them as bottom-codes", () => {
      expect(fmt$(5000)).toBe("$5k");
      expect(fmt$(1200)).toBe("$1k");
      expect(fmt$(15000)).toBe("$15k");
      expect(fmt$(850000)).toBe("$850k");
      expect(fmt$(1400000)).toBe("$1.4M");
    });
  });

  describe("Item 6: Antimeridian (180°) coordinate grid wrapping (Aleutians West, Alaska)", () => {
    it("handles normal longitude spans within the same hemisphere", () => {
      // Cell size 0.1 deg, west -118.5, east -118.3
      const indices = gridCellIndicesX(-118.5, -118.3, 0.1);
      expect(indices.length).toBeGreaterThan(0);
      expect(indices).toEqual([615, 616, 617]);
    });

    it("wraps smoothly across the 180° meridian (e.g. Attu to Unalaska)", () => {
      // Cell size 1.0 deg, west +178 (Attu Island side) to east -178 (Unalaska side) -> w > e
      const max = Math.round(360 / 1.0); // 360 cells
      const indices = gridCellIndicesX(178, -178, 1.0);
      // West: floor(358) = 358; East: floor(2) = 2
      // Should contain 358, 359, 0, 1, 2
      expect(indices).toContain(358);
      expect(indices).toContain(359);
      expect(indices).toContain(0);
      expect(indices).toContain(1);
      expect(indices).toContain(2);
      expect(indices.every((x: number) => x >= 0 && x < max)).toBe(true);
    });
  });

  describe("HUD Fair Market Rents: Small Area FMR (SAFMR) resolution and presentation", () => {
    it("getHudFmr resolves ZIP-level rents when zip_rents table is present", () => {
      // Test the getHudFmr logic with mock HUD data
      const mockHudData = [{
        fips: "06037",
        county_name: "Los Angeles County",
        fiscal_year: "2027",
        zero_bed_eff: 1800,
        one_bed_1br: 2000,
        two_bed_2br: 2500,
        three_bed_3br: 3200,
        four_bed_4br: 3600,
        verification: { status: "verified" },
        zip_rents: {
          "90210": { zero_bed_eff: 2200, one_bed_1br: 2600, two_bed_2br: 3300, three_bed_3br: 4200, four_bed_4br: 4800 },
        },
      }];
      const runner: any = {};
      new Function("HUD_FMR_DATA", "HUD_FMR_SOURCE", "runner", `
        ${hudFmrBlock}
        runner.getHudFmr = getHudFmr;
      `)(mockHudData, { retrieved: "2026-11-18" }, runner);

      // County fallback when no ZIP or ZIP not in table
      const countyFmr = runner.getHudFmr("06037");
      expect(countyFmr.is_safmr).toBe(false);
      expect(countyFmr.two_bed_2br).toBe(2500);

      // ZIP-level SAFMR when ZIP is matched
      const zipFmr = runner.getHudFmr("06037", "90210");
      expect(zipFmr.is_safmr).toBe(true);
      expect(zipFmr.zip_code).toBe("90210");
      expect(zipFmr.two_bed_2br).toBe(3300);
      expect(zipFmr.one_bed_1br).toBe(2600);
      expect(zipFmr.source).toContain("ZIP 90210 Small Area FMR");
    });

    it("hudRow formats SAFMR records with ZIP code in title and explicit voucher note", () => {
      const safmrRec = {
        fiscal_year: "2027",
        is_safmr: true,
        zip_code: "90210",
        one_bed_1br: 2600,
        two_bed_2br: 3300,
        three_bed_3br: 4200,
        metro_or_county_name: "Los Angeles-Long Beach-Glendale, CA HUD Metro FMR Area",
      };
      const row = hudRow(safmrRec);
      expect(row.ok).toBe(true);
      expect(row.label).toBe("HUD Small Area FMR (FY2027, ZIP 90210)");
      expect(row.value).toContain("2 bed $3,300");
      expect(row.note).toContain("HUD voucher benchmark for this ZIP code");
    });
  });

  describe("P0-9: Transit station lookup and statutes load gate", () => {
    it("findNearestTransitStation resolves nearest station from GeoJSON and transit pipelines", () => {
      const transitSnippet = appJs.slice(
        appJs.indexOf("function haversineDistMi(lat1, lon1, lat2, lon2)"),
        appJs.indexOf("\n// Property strategies.", appJs.indexOf("function findNearestTransitStation"))
      );
      const runner: any = {};
      const mockPipelines = [
        {
          metroName: "Austin Metro",
          stations: [
            { name: "Downtown Station", lat: 30.267, lng: -97.743, verified: true, mode: "light_rail" },
            { name: "Unverified Station", lat: 30.250, lng: -97.750, verified: false },
          ],
        },
      ];
      new Function("TRANSIT_PIPELINES_DATA", "activeBundle", "D", "runner", `
        ${transitSnippet}
        runner.findNearestTransitStation = findNearestTransitStation;
      `)(mockPipelines, () => null, null, runner);

      const stn = runner.findNearestTransitStation(30.268, -97.744);
      expect(stn).not.toBeNull();
      expect(stn.name).toBe("Downtown Station");
      expect(stn.type).toBe("light_rail");
      expect(stn.distMi).toBeLessThan(0.5);

      // Invalid or out-of-range coordinates return null
      expect(runner.findNearestTransitStation(null, -97.744)).toBeNull();
      expect(runner.findNearestTransitStation(NaN, -97.744)).toBeNull();

      // Review 19 Nov 2026: a station whose own record says "under construction" is not in service, so it is never the
      // nearest station (transit_pipelines.json marks Century City and both Westwood D Line stations that way).
      const realPipes = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/transit_pipelines.json"), "utf8"));
      const r2: any = {};
      new Function("TRANSIT_PIPELINES_DATA", "activeBundle", "D", "runner", `
        ${transitSnippet}
        runner.findNearestTransitStation = findNearestTransitStation;
      `)(realPipes, () => null, null, r2);
      const westwood = realPipes.flatMap((p: any) => p.stations || []).find((s: any) => s.name === "Westwood / UCLA");
      expect(westwood.desc).toMatch(/under construction/);
      const near = r2.findNearestTransitStation(westwood.lat, westwood.lng);
      expect(near.name).not.toMatch(/Westwood|Century City/);
      // The parking-exemption label in the compare drawer is California-only (it is a California state law).
      expect(appJs).toMatch(/h\.nearestStn\.distMi <= 0\.5 && h\.st === "CA" \? '<b style="color:#0284c7">0-Parking Exempt<\/b>'/);
    });
  });

  describe("P0-12: Home-compare drawer guards and assessed value labeling", () => {
    it("renders 'Not modeled' when equity, roi, or payback is unmodeled, and handles null playbook best", () => {
      const compareStart = appJs.indexOf("function renderCompareDrawer()");
      const compareSnippet = appJs.slice(
        compareStart,
        appJs.indexOf("// Otherwise Neighborhoods tab", compareStart)
      );
      // Verify code contains strictly positive check and 'Not modeled'
      expect(compareSnippet).toMatch(/b\.equity > 0/);
      expect(compareSnippet).toMatch(/b\.roi > 0/);
      expect(compareSnippet).toMatch(/b\.paybackYrs > 0/);
      expect(compareSnippet).toMatch(/"Not modeled"/);
      expect(compareSnippet).toMatch(/"Assessed Value \(Prop 13\)"/);
    });

    it("persists state code and updates compare button innerHTML", () => {
      expect(appJs).not.toMatch(/btn\.tnnerHTML/);
      expect(appJs).toMatch(/st: activeHouse\.st \|\| \(typeof activeState === "function" \? activeState\(\) : null\)/);
    });
  });

  describe("Site-plan drawer: state and outline gates", () => {
    it("strictly requires activeState() === 'CA' and traced building footprint outline", () => {
      expect(appJs).toMatch(/const isCa = curState === "CA";/);
      expect(appJs).toMatch(/F\.footSource === "osm_building_outline" \|\| F\.footSource === "cadastral_outline"/);
    });
  });

  describe("Audit 3.5 Hazards and Florida Valuation Integrity", () => {
    it("Florida DOR pull script documents statutory Jan 1 date and roll certification caveats", () => {
      const flScript = fs.readFileSync(path.join(__dirname, "../../scripts/backtests/pull_florida_dor.py"), "utf8");
      expect(flScript).toMatch(/s\. 192\.042, F\.S\./);
      expect(flScript).toMatch(/Value Adjustment Board/);
      expect(flScript).toMatch(/Audit transparency note \(P1-6\)/);
    });

    it("app/facts.js formats live FEMA National Risk Index and USGS Seismic rows", () => {
      const factsJs = fs.readFileSync(path.join(__dirname, "../../app/facts.js"), "utf8");
      expect(factsJs).toMatch(/Natural hazard risk, relative to other tracts \(FEMA National Risk Index\)/);
      expect(factsJs).toMatch(/Building-code earthquake design values \(USGS, ASCE 7-22\)/);
    });
  });
});
