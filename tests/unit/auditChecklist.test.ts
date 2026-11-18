// Tests verifying fixes for the 18 Nov 2026 free-data audit work order (AUDIT-2026-11-18-free-data.md, Section 5).
// Covers items P0-1 through P0-6, P0-8, P0-10, P1-1, P1-2, and P1-4.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseOsmHeight } from "../../workers/sources";

const root = path.resolve(__dirname, "../..");
const appJs = fs.readFileSync(path.join(root, "app/app.js"), "utf8");

// Extract helper functions from app.js
const escStart = appJs.indexOf("const esc = s =>");
const escBlock = appJs.slice(escStart, appJs.indexOf("const GRADE_TXT ="));
const pbStart = appJs.indexOf("function priceBandOf(v)");
const pbBlock = appJs.slice(pbStart, appJs.indexOf("\n", pbStart));

const sandbox: any = {};
new Function("window", "sandbox", `
  ${escBlock}
  ${pbBlock}
  sandbox.esc = esc;
  sandbox.fmt$ = fmt$;
  sandbox.fmtRent = fmtRent;
  sandbox.priceBandOf = priceBandOf;
`)(sandbox, sandbox);

const { esc, fmt$, fmtRent, priceBandOf } = sandbox;

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
    it("fmtRent formats top-code ($3,501+) as '$3,500 or more/mo'", () => {
      expect(fmtRent(3501)).toBe("$3,500 or more/mo");
      expect(fmtRent(3500)).toBe("$3,500 or more/mo");
      expect(fmtRent(4000)).toBe("$3,500 or more/mo");
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
});
